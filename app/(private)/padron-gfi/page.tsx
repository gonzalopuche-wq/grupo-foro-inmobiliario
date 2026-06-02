"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import PerfilRapidoModal from "../foro/PerfilRapidoModal";

interface RegistroCOCIR {
  id: string;
  matricula: string | null;
  apellido: string;
  nombre: string;
  inmobiliaria: string | null;
  direccion: string | null;
  localidad: string | null;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  estado: string | null;
  actualizado_at: string;
}

interface PerfilGFI {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  telefono: string | null;
  email: string | null;
  inmobiliaria: string | null;
  especialidades: string[] | null;
  foto_url: string | null;
  zona_trabajo: string | null;
  anos_experiencia: number | null;
  bio: string | null;
  socio_cir: boolean;
  tipo: string;
  estado: string;
  created_at: string;
}

interface RegistroUnificado {
  key: string;
  enCOCIR: boolean;
  enGFI: boolean;
  matricula: string | null;
  apellido: string;
  nombre: string;
  inmobiliaria: string | null;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  estadoCOCIR: string | null;
  perfilId: string | null;
  foto_url: string | null;
  zona_trabajo: string | null;
  especialidades: string[] | null;
  socio_cir: boolean;
  tipo: string | null;
}

type Fuente = "cocir" | "gfi" | "ambos";

const ESTADOS_ALERTA = ["suspendido", "suspension", "baja", "dado de baja", "inhabilitado", "inactivo"];

// El scraping de COCIR a veces guarda "TELEFONO EMAIL" en el mismo campo email.
// También puede guardar "DIRECCIÓN Ver mapa" en el campo dirección.
function parseCamposContacto(raw: { celular: string | null; telefono: string | null; email: string | null }) {
  let celular = raw.celular ?? raw.telefono ?? null;
  let email = raw.email ?? null;
  if (!celular && email && email.includes("@")) {
    const partes = email.trim().split(/\s+/);
    const idxEmail = partes.findIndex(p => p.includes("@"));
    if (idxEmail > 0) {
      celular = partes.slice(0, idxEmail).join(" ");
      email = partes.slice(idxEmail).join(" ");
    }
  }
  return { celular, email };
}

function parseDireccion(dir: string | null): { texto: string | null; mapsUrl: string | null } {
  if (!dir) return { texto: null, mapsUrl: null };
  const texto = dir.replace(/\s*Ver mapa\s*/gi, "").trim() || null;
  const mapsUrl = texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}` : null;
  return { texto, mapsUrl };
}

function waLink(num: string) {
  return `https://wa.me/${num.replace(/\D/g, "").replace(/^0/, "549").replace(/^54(?!9)/, "549")}`;
}

const estadoColor = (estado: string | null) => {
  if (!estado) return "#3abab6";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "#ff4444";
  if (e.includes("habilitado") || e.includes("activo") || e.includes("vigente")) return "#3abab6";
  return "#d4960c";
};

// Carga todos los registros vía API server-side (bypasea RLS con service role)
async function cargarPadron(token: string): Promise<{
  cocir: RegistroCOCIR[]
  gfi: PerfilGFI[]
  errores: { cocir: string | null; gfi: string | null }
}> {
  const res = await fetch("/api/padron", {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Error ${res.status}: ${err}`)
  }
  return res.json()
}

export default function PadronGFIPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [fuente, setFuente] = useState<Fuente>("cocir");
  const [cocirData, setCocirData] = useState<RegistroCOCIR[]>([]);
  const [gfiData, setGfiData] = useState<PerfilGFI[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [perfilRapidoId, setPerfilRapidoId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const POR_PAGINA = 50;
  const [syncPhonesState, setSyncPhonesState] = useState<"idle" | "loading" | "done">("idle");
  const [syncPhonesResult, setSyncPhonesResult] = useState<{ actualizados: number; omitidos: number; errores: number; total_perfiles: number } | null>(null);
  const [contactoSeleccionado, setContactoSeleccionado] = useState<RegistroUnificado | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = "/login"; return; }
      setUserId(session.user.id);
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", session.user.id).single();
      setIsAdmin(p?.tipo === "admin" || p?.tipo === "master");
      try {
        const resultado = await cargarPadron(session.access_token)
        if (resultado.errores.cocir) setErrorCarga(`Error COCIR: ${resultado.errores.cocir}`)
        else if (resultado.errores.gfi) setErrorCarga(`Error GFI: ${resultado.errores.gfi}`)
        setCocirData(resultado.cocir)
        setGfiData(resultado.gfi)
      } catch (e: any) {
        setErrorCarga(e.message || "Error desconocido al cargar el padrón")
      }
      setLoading(false);
    };
    init();
  }, []);

  // Construir lista unificada según fuente
  const registros: RegistroUnificado[] = useMemo(() => {
    if (fuente === "cocir") {
      return cocirData.map(c => ({
        key: `cocir-${c.id}`,
        enCOCIR: true, enGFI: false,
        matricula: c.matricula, apellido: c.apellido, nombre: c.nombre,
        inmobiliaria: c.inmobiliaria, telefono: c.telefono, celular: c.celular, email: c.email,
        direccion: c.direccion, localidad: c.localidad, estadoCOCIR: c.estado,
        perfilId: null, foto_url: null, zona_trabajo: null,
        especialidades: null, socio_cir: false, tipo: null,
      })).sort((a, b) => (a.apellido ?? "").localeCompare(b.apellido ?? "", "es-AR") || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es-AR"));
    }

    if (fuente === "gfi") {
      return gfiData.map(g => ({
        key: `gfi-${g.id}`,
        enCOCIR: false, enGFI: true,
        matricula: g.matricula, apellido: g.apellido, nombre: g.nombre,
        inmobiliaria: g.inmobiliaria, telefono: g.telefono, celular: null, email: g.email,
        direccion: null, localidad: null, estadoCOCIR: null,
        perfilId: g.id, foto_url: g.foto_url, zona_trabajo: g.zona_trabajo,
        especialidades: g.especialidades, socio_cir: g.socio_cir, tipo: g.tipo,
      })).sort((a, b) => (a.apellido ?? "").localeCompare(b.apellido ?? "", "es-AR") || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es-AR"));
    }

    // ambos: cruzar por matrícula
    const resultado: RegistroUnificado[] = [];
    const gfiPorMatricula = new Map<string, PerfilGFI>();
    gfiData.forEach(g => { if (g.matricula) gfiPorMatricula.set(g.matricula.trim(), g); });
    const cocirUsados = new Set<string>();

    cocirData.forEach(c => {
      const mat = c.matricula?.trim() ?? "";
      const gfi = mat ? gfiPorMatricula.get(mat) : undefined;
      if (mat) cocirUsados.add(mat);
      resultado.push({
        key: `ambos-${c.id}`, enCOCIR: true, enGFI: !!gfi,
        matricula: c.matricula, apellido: c.apellido, nombre: c.nombre,
        inmobiliaria: gfi?.inmobiliaria ?? c.inmobiliaria,
        telefono: gfi?.telefono ?? c.telefono, celular: c.celular, email: gfi?.email ?? c.email,
        direccion: c.direccion, localidad: c.localidad, estadoCOCIR: c.estado,
        perfilId: gfi?.id ?? null, foto_url: gfi?.foto_url ?? null,
        zona_trabajo: gfi?.zona_trabajo ?? null, especialidades: gfi?.especialidades ?? null,
        socio_cir: gfi?.socio_cir ?? false, tipo: gfi?.tipo ?? null,
      });
    });

    gfiData.forEach(g => {
      const mat = g.matricula?.trim() ?? "";
      if (!mat || !cocirUsados.has(mat)) {
        resultado.push({
          key: `gfi-solo-${g.id}`, enCOCIR: false, enGFI: true,
          matricula: g.matricula, apellido: g.apellido, nombre: g.nombre,
          inmobiliaria: g.inmobiliaria, telefono: g.telefono, celular: null, email: g.email,
          direccion: null, localidad: null, estadoCOCIR: null,
          perfilId: g.id, foto_url: g.foto_url, zona_trabajo: g.zona_trabajo,
          especialidades: g.especialidades, socio_cir: g.socio_cir, tipo: g.tipo,
        });
      }
    });

    return resultado.sort((a, b) => a.apellido.localeCompare(b.apellido));
  }, [fuente, cocirData, gfiData]);

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return registros;
    const q = busqueda.toLowerCase();
    return registros.filter(r =>
      r.apellido?.toLowerCase().includes(q) ||
      r.nombre?.toLowerCase().includes(q) ||
      r.matricula?.toLowerCase().includes(q) ||
      r.inmobiliaria?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  }, [registros, busqueda]);

  const ordenados = useMemo(() => {
    if (!sortCol) return filtrados;
    return [...filtrados].sort((a, b) => {
      let sa = "", sb = "";
      if (sortCol === "nombre") { sa = `${a.apellido} ${a.nombre}`; sb = `${b.apellido} ${b.nombre}`; }
      else if (sortCol === "matricula") { sa = a.matricula ?? ""; sb = b.matricula ?? ""; }
      else if (sortCol === "inmobiliaria") { sa = a.inmobiliaria ?? ""; sb = b.inmobiliaria ?? ""; }
      else if (sortCol === "email") { sa = a.email ?? ""; sb = b.email ?? ""; }
      else if (sortCol === "estado") { sa = a.estadoCOCIR ?? ""; sb = b.estadoCOCIR ?? ""; }
      const cmp = sa.toLowerCase().localeCompare(sb.toLowerCase(), "es-AR");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtrados, sortCol, sortDir]);

  const totalPaginas = Math.ceil(ordenados.length / POR_PAGINA);
  const paginados = ordenados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const cambiarFuente = (f: Fuente) => { setFuente(f); setBusqueda(""); setPagina(0); };
  const cambiarBusqueda = (v: string) => { setBusqueda(v); setPagina(0); };
  const toggleSort = (col: string) => {
    setPagina(0);
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };
  const sortIcon = (col: string) => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const sincronizarTelefonos = async () => {
    setSyncPhonesState("loading");
    setSyncPhonesResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/sync-phones-cocir", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ campos: ["telefono", "email", "inmobiliaria"] }),
    });
    const json = await res.json();
    setSyncPhonesResult(json);
    setSyncPhonesState("done");
  };

  const ultimaSync = useMemo(() => {
    if (!cocirData.length) return null;
    const max = cocirData.reduce((acc, c) => {
      const t = c.actualizado_at ? new Date(c.actualizado_at).getTime() : 0;
      return t > acc ? t : acc;
    }, 0);
    if (!max) return null;
    return new Date(max).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }, [cocirData]);

  return (
    <>
      <style>{`
        .pad-wrap { display: flex; flex-direction: column; gap: 20px; }
        /* Header */
        .pad-titulo { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--gfi-text-primary); letter-spacing: -0.02em; }
        .pad-titulo span { color: var(--gfi-red); }
        .pad-sub { font-size: 13px; color: var(--gfi-text-secondary); margin-top: 4px; font-family: var(--font-body); }
        /* Source tabs */
        .pad-fuentes { display: flex; gap: 8px; flex-wrap: wrap; }
        .pad-fuente-btn { padding: 8px 18px; border-radius: var(--gfi-radius-md); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-secondary); }
        .pad-fuente-btn:hover { border-color: var(--gfi-red-border); color: var(--gfi-text-primary); background: var(--gfi-red-soft); }
        .pad-fuente-btn.activo { border-color: var(--gfi-red); color: var(--gfi-text-primary); background: var(--gfi-red-soft); box-shadow: 0 0 0 1px var(--gfi-red-border); }
        /* Stats bar — reusing gfi-card layout */
        .pad-statsbar { display: flex; align-items: center; gap: 20px; padding: 14px 20px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); flex-wrap: wrap; position: relative; overflow: hidden; }
        .pad-statsbar::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, var(--gfi-red) 0%, rgba(153,0,0,0.05) 60%, transparent 100%); }
        .pad-stat { display: flex; flex-direction: column; gap: 2px; }
        .pad-stat-val { font-family: var(--font-display); font-size: 22px; font-weight: 900; color: var(--gfi-text-primary); line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .pad-stat-label { font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-muted); font-family: var(--font-display); margin-top: 2px; }
        .pad-stat-sep { width: 1px; height: 36px; background: var(--gfi-border); }
        /* Search / filter bar */
        .pad-buscador { display: flex; gap: 10px; align-items: center; }
        .pad-search-wrap { flex: 1; position: relative; }
        .pad-search-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--gfi-text-muted); pointer-events: none; }
        .pad-input { width: 100%; padding: 11px 14px 11px 40px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); }
        .pad-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-glow); }
        .pad-input::placeholder { color: var(--gfi-text-muted); }
        .pad-count { font-size: 11px; color: var(--gfi-text-muted); white-space: nowrap; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
        /* Table wrapper */
        .pad-tabla-wrap { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
        .pad-tabla { width: 100%; border-collapse: collapse; min-width: 680px; }
        .pad-tabla thead tr { background: var(--gfi-bg-secondary); border-bottom: 1px solid var(--gfi-border); }
        .pad-tabla th { padding: 11px 14px; text-align: left; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-muted); white-space: nowrap; }
        .pad-tabla tbody tr { border-bottom: 1px solid var(--gfi-border-subtle); transition: background 0.12s; }
        .pad-tabla tbody tr:last-child { border-bottom: none; }
        .pad-tabla tbody tr:nth-child(even) { background: rgba(255,255,255,0.012); }
        .pad-tabla tbody tr:hover { background: rgba(153,0,0,0.025); }
        .pad-tabla tbody tr.clickable:hover { background: rgba(153,0,0,0.05); cursor: pointer; }
        .pad-tabla td { padding: 12px 14px; font-size: 12px; color: var(--gfi-text-secondary); vertical-align: middle; }
        .pad-nombre { font-weight: 600; color: var(--gfi-text-primary); font-size: 13px; font-family: var(--font-body); }
        .pad-mat { font-size: 10px; color: var(--gfi-text-muted); margin-top: 2px; font-family: var(--font-mono); font-weight: 500; }
        .pad-avatar { width: 34px; height: 34px; border-radius: var(--gfi-radius-md); background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 11px; font-weight: 800; color: var(--gfi-red); overflow: hidden; flex-shrink: 0; }
        .pad-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .pad-estado-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 20px; font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; }
        .pad-badge { font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; }
        .pad-empty { padding: 64px 32px; text-align: center; color: var(--gfi-text-muted); font-size: 14px; font-style: italic; font-family: var(--font-body); }
        .pad-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px; gap: 16px; }
        .pad-spin { width: 28px; height: 28px; border: 2px solid var(--gfi-red-soft); border-top-color: var(--gfi-red); border-radius: 50%; animation: spin 0.7s linear infinite; }
        .pad-loading-txt { font-size: 12px; color: var(--gfi-text-muted); font-family: var(--font-body); }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Pagination — ghost buttons */
        .pad-paginacion { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-top: 1px solid var(--gfi-border); flex-wrap: wrap; gap: 8px; }
        .pad-pag-btn { padding: 7px 16px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .pad-pag-btn:hover:not(:disabled) { border-color: var(--gfi-red-border); color: var(--gfi-red); background: var(--gfi-red-soft); }
        .pad-pag-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .pad-pag-info { font-size: 11px; color: var(--gfi-text-muted); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
        .pad-contact-btn { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 10px; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-decoration: none; transition: var(--gfi-transition); }
        .pad-contact-btn:hover { opacity: 0.8; }
        .pad-tabla th.sortable { cursor: pointer; user-select: none; }
        .pad-tabla th.sortable:hover { color: var(--gfi-text-secondary); }
        .pad-tabla th.sort-activo { color: var(--gfi-red) !important; }
        @media (max-width: 700px) {
          .pad-tabla-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .pad-tabla { min-width: 700px; }
          .pad-tabla th:nth-child(4), .pad-tabla td:nth-child(4) { display: none; }
        }
      `}</style>

      <div className="pad-wrap">
        <div>
          <div className="pad-titulo">Padrón <span>GFI®</span></div>
          <div className="pad-sub">Consultá corredores del padrón COCIR, de GFI o de ambos</div>
        </div>

        {/* Selector */}
        <div className="pad-fuentes">
          <button className={`pad-fuente-btn${fuente === "cocir" ? " activo" : ""}`} onClick={() => cambiarFuente("cocir")}>
            🏛 Padrón COCIR
          </button>
          <button className={`pad-fuente-btn${fuente === "gfi" ? " activo" : ""}`} onClick={() => cambiarFuente("gfi")}>
            ◈ Miembros GFI
          </button>
          <button className={`pad-fuente-btn${fuente === "ambos" ? " activo" : ""}`} onClick={() => cambiarFuente("ambos")}>
            🔗 Vista unificada
          </button>
          <a href="/padron-gfi/mapa" className="pad-fuente-btn" style={{ textDecoration: 'none' }}>
            📍 Mapa de zonas
          </a>
          {isAdmin && (
            <button
              className="pad-fuente-btn"
              onClick={sincronizarTelefonos}
              disabled={syncPhonesState === "loading"}
              style={{ borderColor: syncPhonesState === "done" ? "rgba(34,197,94,0.5)" : "rgba(99,102,241,0.4)", color: syncPhonesState === "done" ? "#3abab6" : "#818cf8" }}
            >
              {syncPhonesState === "loading" ? "⏳ Sincronizando…" : syncPhonesState === "done" ? "✓ Sincronizado" : "🔄 Sync teléfonos COCIR"}
            </button>
          )}
        </div>
        {syncPhonesState === "done" && syncPhonesResult && (
          <div style={{ padding: "10px 16px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, fontSize: 12, color: "var(--gfi-text-primary)", fontFamily: "Inter,sans-serif" }}>
            <strong style={{ color: "#3abab6" }}>{syncPhonesResult.actualizados}</strong> perfiles actualizados ·{" "}
            <strong style={{ color: "var(--gfi-text-muted)" }}>{syncPhonesResult.omitidos}</strong> sin cambios ·{" "}
            <strong style={{ color: syncPhonesResult.errores > 0 ? "#f87171" : "var(--gfi-text-muted)" }}>{syncPhonesResult.errores}</strong> errores
            {" · "}Total: {syncPhonesResult.total_perfiles} perfiles con matrícula
          </div>
        )}

        {/* Stats */}
        <div className="pad-statsbar">
          <div className="pad-stat">
            <div className="pad-stat-val">
              {loading ? "..." : registros.length.toLocaleString("es-AR")}
            </div>
            <div className="pad-stat-label">
              {fuente === "cocir" ? "Matriculados COCIR" : fuente === "gfi" ? "Miembros GFI" : "Total registros"}
            </div>
          </div>
          <div className="pad-stat-sep" />
          {fuente === "cocir" && !loading && (
            <>
              <div className="pad-stat">
                <div className="pad-stat-val" style={{color:"#3abab6"}}>
                  {cocirData.filter(c => {
                    if (!c.estado) return true;
                    return !ESTADOS_ALERTA.some(s => c.estado!.toLowerCase().includes(s));
                  }).length.toLocaleString("es-AR")}
                </div>
                <div className="pad-stat-label">Habilitados</div>
              </div>
              <div className="pad-stat-sep" />
            </>
          )}
          {fuente === "ambos" && !loading && (
            <>
              <div className="pad-stat">
                <div className="pad-stat-val" style={{color:"#3abab6"}}>{registros.filter(r => r.enCOCIR && r.enGFI).length}</div>
                <div className="pad-stat-label">En ambos</div>
              </div>
              <div className="pad-stat-sep" />
              <div className="pad-stat">
                <div className="pad-stat-val" style={{color:"#4ab8d8"}}>{registros.filter(r => r.enCOCIR && !r.enGFI).length.toLocaleString("es-AR")}</div>
                <div className="pad-stat-label">Solo COCIR</div>
              </div>
              <div className="pad-stat-sep" />
              <div className="pad-stat">
                <div className="pad-stat-val" style={{color:"#d4960c"}}>{registros.filter(r => !r.enCOCIR && r.enGFI).length}</div>
                <div className="pad-stat-label">Solo GFI</div>
              </div>
              <div className="pad-stat-sep" />
            </>
          )}
          <div className="pad-stat">
            <div className="pad-stat-val" style={{color:"var(--gfi-text-secondary)"}}>
              {busqueda ? filtrados.length.toLocaleString("es-AR") : "—"}
            </div>
            <div className="pad-stat-label">Resultados búsqueda</div>
          </div>
          <div style={{marginLeft:"auto",textAlign:"right"}}>
            <div style={{fontSize:11,color:"var(--gfi-text-dim)",fontStyle:"italic"}}>
              {fuente === "cocir" ? "Padrón oficial COCIR · Solo lectura" :
               fuente === "gfi" ? "Miembros registrados en GFI®" :
               "Cruce COCIR + GFI por matrícula"}
            </div>
            {fuente === "cocir" && ultimaSync && (
              <div style={{fontSize:10,color:"rgba(255,255,255,0.15)",marginTop:2}}>
                Última sync: {ultimaSync}
              </div>
            )}
          </div>
        </div>

        {/* Buscador */}
        <div className="pad-buscador">
          <div className="pad-search-wrap">
            <span className="pad-search-ico">🔍</span>
            <input
              className="pad-input"
              placeholder="Buscar por nombre, apellido, matrícula, inmobiliaria o email..."
              value={busqueda}
              onChange={e => cambiarBusqueda(e.target.value)}
              disabled={loading}
            />
          </div>
          <span className="pad-count">
            {loading ? "Cargando..." : `${filtrados.length.toLocaleString("es-AR")} resultado${filtrados.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Error de carga */}
        {errorCarga && (
          <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#b80000', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Error cargando el padrón</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{errorCarga}</div>
              <div style={{ fontSize: 11, marginTop: 6, opacity: 0.6 }}>Verificá que la tabla exista en Supabase y que las políticas RLS permitan lectura para usuarios autenticados.</div>
            </div>
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="pad-tabla-wrap">
            <div className="pad-loading">
              <div className="pad-spin" />
              <div className="pad-loading-txt">
                Cargando padrón…
              </div>
            </div>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="pad-tabla-wrap">
            <div className="pad-empty">
              {busqueda ? `No se encontraron resultados para "${busqueda}"` : "Sin registros"}
            </div>
          </div>
        ) : (
          <div className="pad-tabla-wrap">
            <table className="pad-tabla">
              <thead>
                <tr>
                  <th className={`sortable${sortCol==="nombre"?" sort-activo":""}`} onClick={() => toggleSort("nombre")}>Nombre{sortIcon("nombre")}</th>
                  <th className={`sortable${sortCol==="matricula"?" sort-activo":""}`} onClick={() => toggleSort("matricula")}>Matrícula{sortIcon("matricula")}</th>
                  <th className={`sortable${sortCol==="inmobiliaria"?" sort-activo":""}`} onClick={() => toggleSort("inmobiliaria")}>Inmobiliaria{sortIcon("inmobiliaria")}</th>
                  <th>Dirección</th>
                  <th>Celular</th>
                  <th className={`sortable${sortCol==="email"?" sort-activo":""}`} onClick={() => toggleSort("email")}>Email{sortIcon("email")}</th>
                  {fuente === "ambos" && <th>Fuente</th>}
                  <th className={`sortable${sortCol==="estado"?" sort-activo":""}`} onClick={() => toggleSort("estado")}>Estado{sortIcon("estado")}</th>
                </tr>
              </thead>
              <tbody>
                {paginados.map(r => {
                  const color = estadoColor(r.estadoCOCIR);
                  const esAlerta = r.estadoCOCIR && ESTADOS_ALERTA.some(s => r.estadoCOCIR!.toLowerCase().includes(s));

                  return (
                    <tr
                      key={r.key}
                      className="clickable"
                      onClick={() => {
                        if (r.perfilId) setPerfilRapidoId(r.perfilId);
                        else setContactoSeleccionado(r);
                      }}
                    >
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {r.enGFI && (
                            <div className="pad-avatar">
                              {r.foto_url ? <img src={r.foto_url} alt="" /> :
                                `${r.nombre?.charAt(0) ?? ""}${r.apellido?.charAt(0) ?? ""}`.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="pad-nombre">{[r.apellido, r.nombre].filter(Boolean).join(", ") || "—"}</div>
                            {r.zona_trabajo && <div style={{fontSize:10,color:"var(--gfi-text-muted)",marginTop:2}}>📍 {r.zona_trabajo}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {r.matricula
                          ? <span style={{fontFamily:"var(--font-mono)",fontWeight:600,fontSize:12,color:"var(--gfi-red)",letterSpacing:"0.02em"}}>{r.matricula}</span>
                          : <span style={{color:"var(--gfi-text-muted)"}}>—</span>}
                      </td>
                      <td style={{color:"var(--gfi-text-secondary)"}}>
                        {r.inmobiliaria || <span style={{color:"var(--gfi-text-dim)"}}>—</span>}
                      </td>
                      <td style={{color:"var(--gfi-text-secondary)",fontSize:11}}>
                        {(() => {
                          const { texto, mapsUrl } = parseDireccion(r.direccion);
                          if (!texto) return <span style={{color:"var(--gfi-text-dim)"}}>—</span>;
                          return <>{texto}{r.localidad ? ` · ${r.localidad}` : ""}{mapsUrl && <> <a href={mapsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{color:"var(--gfi-ocean-text)",fontSize:10,textDecoration:"none",fontWeight:600,marginLeft:4}}>📍</a></>}</>;
                        })()}
                      </td>
                      <td style={{fontSize:12}}>
                        {(() => {
                          const { celular } = parseCamposContacto({ celular: r.celular, telefono: r.telefono, email: r.email });
                          return celular
                            ? <a href={waLink(celular)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{color:"#25d366",textDecoration:"none",fontFamily:"Inter,sans-serif",display:"inline-flex",alignItems:"center",gap:4}}>
                                <span style={{fontSize:13}}>💬</span>{celular}
                              </a>
                            : <span style={{color:"var(--gfi-text-dim)"}}>—</span>;
                        })()}
                      </td>
                      <td style={{fontSize:12}}>
                        {(() => {
                          const { email } = parseCamposContacto({ celular: r.celular, telefono: r.telefono, email: r.email });
                          return email
                            ? <a href={`mailto:${email}`} onClick={e => e.stopPropagation()} style={{color:"#f87171",textDecoration:"none",fontFamily:"Inter,sans-serif",wordBreak:"break-all"}}>
                                {email.toLowerCase()}
                              </a>
                            : <span style={{color:"var(--gfi-text-dim)"}}>—</span>;
                        })()}
                      </td>
                      {fuente === "ambos" && (
                        <td>
                          {r.enCOCIR && r.enGFI && <span className="pad-badge" style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",color:"#3abab6"}}>Ambos</span>}
                          {r.enCOCIR && !r.enGFI && <span className="pad-badge" style={{background:"rgba(74,184,216,0.1)",border:"1px solid rgba(74,184,216,0.25)",color:"#4ab8d8"}}>COCIR</span>}
                          {!r.enCOCIR && r.enGFI && <span className="pad-badge" style={{background:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.25)",color:"#d4960c"}}>GFI</span>}
                        </td>
                      )}
                      <td>
                        {r.enCOCIR ? (
                          <span className="pad-estado-pill" style={{background:`${color}18`,border:`1px solid ${color}40`,color}}>
                            {esAlerta ? "⛔" : "✅"} {r.estadoCOCIR?.toUpperCase() || "HABILITADO"}
                          </span>
                        ) : (
                          <span className="pad-badge" style={{background:"var(--gfi-border-subtle)",border:"1px solid var(--gfi-border)",color:"var(--gfi-text-muted)"}}>
                            Solo GFI
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPaginas > 1 && (
              <div className="pad-paginacion">
                <button className="pad-pag-btn" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>← Anterior</button>
                <span className="pad-pag-info">Página {pagina + 1} de {totalPaginas} · {filtrados.length.toLocaleString("es-AR")} registros</span>
                <button className="pad-pag-btn" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}>Siguiente →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {perfilRapidoId && (
        <PerfilRapidoModal
          perfilId={perfilRapidoId}
          miUserId={userId}
          onClose={() => setPerfilRapidoId(null)}
        />
      )}

      {contactoSeleccionado && (
        <div
          style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={() => setContactoSeleccionado(null)}
        >
          <div
            style={{ background:"var(--gfi-bg-card)",border:"1px solid var(--gfi-border)",borderRadius:"var(--gfi-radius-xl)",padding:"28px 24px",maxWidth:480,width:"100%",display:"flex",flexDirection:"column",gap:16,boxShadow:"var(--gfi-shadow-lg)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{fontFamily:"var(--font-display)",fontWeight:800,fontSize:18,color:"var(--gfi-text-primary)",letterSpacing:"-0.01em"}}>
                  {[contactoSeleccionado.apellido, contactoSeleccionado.nombre].filter(Boolean).join(", ") || "—"}
                </div>
                {contactoSeleccionado.matricula && (
                  <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--gfi-red)",fontWeight:600,marginTop:4,letterSpacing:"0.04em"}}>
                    Matrícula {contactoSeleccionado.matricula}
                  </div>
                )}
              </div>
              <button onClick={() => setContactoSeleccionado(null)} style={{background:"none",border:"none",color:"var(--gfi-text-muted)",fontSize:22,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
            </div>

            {contactoSeleccionado.estadoCOCIR && (
              <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:20,background:`${estadoColor(contactoSeleccionado.estadoCOCIR)}18`,border:`1px solid ${estadoColor(contactoSeleccionado.estadoCOCIR)}40`,alignSelf:"flex-start"}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:estadoColor(contactoSeleccionado.estadoCOCIR),display:"inline-block"}}/>
                <span style={{fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",color:estadoColor(contactoSeleccionado.estadoCOCIR)}}>
                  {contactoSeleccionado.estadoCOCIR.toUpperCase()}
                </span>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:10,borderTop:"1px solid var(--gfi-border-subtle)",paddingTop:16}}>
              {contactoSeleccionado.inmobiliaria && (
                <div style={{display:"flex",gap:10}}>
                  <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--gfi-text-muted)",paddingTop:1}}>Inmob.</span>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{contactoSeleccionado.inmobiliaria}</span>
                </div>
              )}
              {(contactoSeleccionado.direccion || contactoSeleccionado.localidad) && (() => {
                const { texto, mapsUrl } = parseDireccion(contactoSeleccionado.direccion);
                const dirTexto = [texto, contactoSeleccionado.localidad].filter(Boolean).join(" · ");
                return dirTexto ? (
                  <div style={{display:"flex",gap:10}}>
                    <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--gfi-text-muted)",paddingTop:1}}>Dirección</span>
                    <span style={{fontSize:13,color:"var(--gfi-text-primary)"}}>
                      {dirTexto}
                      {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{color:"var(--gfi-ocean-text)",marginLeft:8,fontSize:12,textDecoration:"none"}}>📍 Ver mapa</a>}
                    </span>
                  </div>
                ) : null;
              })()}
              {(() => {
                const { celular } = parseCamposContacto({ celular: contactoSeleccionado.celular, telefono: contactoSeleccionado.telefono, email: contactoSeleccionado.email });
                return celular ? (
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--gfi-text-muted)"}}>Celular</span>
                    <a href={waLink(celular)} target="_blank" rel="noopener noreferrer" style={{color:"#25d366",textDecoration:"none",fontWeight:700,fontSize:13,display:"inline-flex",alignItems:"center",gap:6}}>
                      💬 {celular}
                    </a>
                  </div>
                ) : null;
              })()}
              {(() => {
                const { email } = parseCamposContacto({ celular: contactoSeleccionado.celular, telefono: contactoSeleccionado.telefono, email: contactoSeleccionado.email });
                return email ? (
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--gfi-text-muted)"}}>Email</span>
                    <a href={`mailto:${email}`} style={{color:"#f87171",textDecoration:"none",fontSize:13,wordBreak:"break-all"}}>
                      ✉️ {email.toLowerCase()}
                    </a>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
