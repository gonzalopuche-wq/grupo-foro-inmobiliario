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

const estadoColor = (estado: string | null) => {
  if (!estado) return "#22c55e";
  const e = estado.toLowerCase();
  if (ESTADOS_ALERTA.some(s => e.includes(s))) return "#ff4444";
  if (e.includes("habilitado") || e.includes("activo") || e.includes("vigente")) return "#22c55e";
  return "#eab308";
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

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = "/login"; return; }
      setUserId(session.user.id);
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
        inmobiliaria: c.inmobiliaria, telefono: c.telefono, email: c.email,
        direccion: c.direccion, localidad: c.localidad, estadoCOCIR: c.estado,
        perfilId: null, foto_url: null, zona_trabajo: null,
        especialidades: null, socio_cir: false, tipo: null,
      }));
    }

    if (fuente === "gfi") {
      return gfiData.map(g => ({
        key: `gfi-${g.id}`,
        enCOCIR: false, enGFI: true,
        matricula: g.matricula, apellido: g.apellido, nombre: g.nombre,
        inmobiliaria: g.inmobiliaria, telefono: g.telefono, email: g.email,
        direccion: null, localidad: null, estadoCOCIR: null,
        perfilId: g.id, foto_url: g.foto_url, zona_trabajo: g.zona_trabajo,
        especialidades: g.especialidades, socio_cir: g.socio_cir, tipo: g.tipo,
      }));
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
        telefono: gfi?.telefono ?? c.telefono, email: gfi?.email ?? c.email,
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
          inmobiliaria: g.inmobiliaria, telefono: g.telefono, email: g.email,
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

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA);
  const paginados = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const cambiarFuente = (f: Fuente) => { setFuente(f); setBusqueda(""); setPagina(0); };
  const cambiarBusqueda = (v: string) => { setBusqueda(v); setPagina(0); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .pad-wrap { display: flex; flex-direction: column; gap: 20px; }
        .pad-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .pad-titulo span { color: #cc0000; }
        .pad-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .pad-fuentes { display: flex; gap: 8px; flex-wrap: wrap; }
        .pad-fuente-btn { padding: 9px 20px; border-radius: 4px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.1); background: rgba(14,14,14,0.9); color: rgba(255,255,255,0.4); }
        .pad-fuente-btn:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .pad-fuente-btn.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .pad-statsbar { display: flex; align-items: center; gap: 20px; padding: 12px 18px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; flex-wrap: wrap; }
        .pad-stat { display: flex; flex-direction: column; gap: 2px; }
        .pad-stat-val { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1; }
        .pad-stat-label { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; }
        .pad-stat-sep { width: 1px; height: 36px; background: rgba(255,255,255,0.08); }
        .pad-buscador { display: flex; gap: 10px; align-items: center; }
        .pad-search-wrap { flex: 1; position: relative; }
        .pad-search-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 14px; color: rgba(255,255,255,0.25); }
        .pad-input { width: 100%; padding: 11px 14px 11px 38px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #fff; font-size: 14px; outline: none; font-family: 'Inter',sans-serif; transition: border-color 0.2s; }
        .pad-input:focus { border-color: rgba(200,0,0,0.5); }
        .pad-input::placeholder { color: rgba(255,255,255,0.18); }
        .pad-count { font-size: 11px; color: rgba(255,255,255,0.25); white-space: nowrap; }
        .pad-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .pad-tabla { width: 100%; border-collapse: collapse; }
        .pad-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .pad-tabla th { padding: 11px 14px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .pad-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        .pad-tabla tbody tr:last-child { border-bottom: none; }
        .pad-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .pad-tabla tbody tr.clickable:hover { background: rgba(200,0,0,0.04); cursor: pointer; }
        .pad-tabla td { padding: 12px 14px; font-size: 12px; color: rgba(255,255,255,0.7); vertical-align: middle; }
        .pad-nombre { font-weight: 600; color: #fff; font-size: 13px; }
        .pad-mat { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; font-family: 'Montserrat',sans-serif; }
        .pad-avatar { width: 32px; height: 32px; border-radius: 6px; background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.2); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 800; color: #cc0000; overflow: hidden; flex-shrink: 0; }
        .pad-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .pad-estado-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .pad-badge { font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 6px; border-radius: 10px; }
        .pad-empty { padding: 64px 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; font-style: italic; }
        .pad-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px; gap: 16px; }
        .pad-spin { width: 28px; height: 28px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .pad-loading-txt { font-size: 12px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pad-paginacion { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; gap: 8px; }
        .pad-pag-btn { padding: 6px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .pad-pag-btn:hover:not(:disabled) { border-color: rgba(200,0,0,0.4); color: #fff; }
        .pad-pag-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .pad-pag-info { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        @media (max-width: 700px) {
          .pad-tabla th:nth-child(4), .pad-tabla td:nth-child(4),
          .pad-tabla th:nth-child(5), .pad-tabla td:nth-child(5) { display: none; }
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
        </div>

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
                <div className="pad-stat-val" style={{color:"#22c55e"}}>
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
                <div className="pad-stat-val" style={{color:"#22c55e"}}>{registros.filter(r => r.enCOCIR && r.enGFI).length}</div>
                <div className="pad-stat-label">En ambos</div>
              </div>
              <div className="pad-stat-sep" />
              <div className="pad-stat">
                <div className="pad-stat-val" style={{color:"#60a5fa"}}>{registros.filter(r => r.enCOCIR && !r.enGFI).length.toLocaleString("es-AR")}</div>
                <div className="pad-stat-label">Solo COCIR</div>
              </div>
              <div className="pad-stat-sep" />
              <div className="pad-stat">
                <div className="pad-stat-val" style={{color:"#eab308"}}>{registros.filter(r => !r.enCOCIR && r.enGFI).length}</div>
                <div className="pad-stat-label">Solo GFI</div>
              </div>
              <div className="pad-stat-sep" />
            </>
          )}
          <div className="pad-stat">
            <div className="pad-stat-val" style={{color:"rgba(255,255,255,0.5)"}}>
              {busqueda ? filtrados.length.toLocaleString("es-AR") : "—"}
            </div>
            <div className="pad-stat-label">Resultados búsqueda</div>
          </div>
          <div style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,0.2)",fontStyle:"italic"}}>
            {fuente === "cocir" ? "Padrón oficial COCIR · Solo lectura" :
             fuente === "gfi" ? "Miembros registrados en GFI®" :
             "Cruce COCIR + GFI por matrícula"}
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
          <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#ef4444', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
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
                Cargando {fuente === "cocir" ? "3.189 registros" : "registros"}...
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
                  <th>Nombre</th>
                  <th>Matrícula</th>
                  <th>Inmobiliaria</th>
                  <th>Dirección</th>
                  <th>Email / Tel</th>
                  {fuente === "ambos" && <th>Fuente</th>}
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {paginados.map(r => {
                  const color = estadoColor(r.estadoCOCIR);
                  const esAlerta = r.estadoCOCIR && ESTADOS_ALERTA.some(s => r.estadoCOCIR!.toLowerCase().includes(s));
                  const esClickable = !!r.perfilId;

                  return (
                    <tr
                      key={r.key}
                      className={esClickable ? "clickable" : ""}
                      onClick={() => { if (r.perfilId) setPerfilRapidoId(r.perfilId); }}
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
                            <div className="pad-nombre">{r.apellido}, {r.nombre}</div>
                            {r.zona_trabajo && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>📍 {r.zona_trabajo}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {r.matricula
                          ? <span style={{fontFamily:"Montserrat,sans-serif",fontWeight:700,fontSize:12}}>{r.matricula}</span>
                          : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                      </td>
                      <td style={{color:"rgba(255,255,255,0.6)"}}>
                        {r.inmobiliaria || <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                      </td>
                      <td style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>
                        {r.direccion
                          ? <>{r.direccion}{r.localidad ? ` · ${r.localidad}` : ""}</>
                          : <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                      </td>
                      <td style={{fontSize:11}}>
                        {r.telefono && (
                          <div>
                            <a href={`https://wa.me/${(r.telefono as string).replace(/\D/g,"").replace(/^0+/,"549").replace(/^549+9/,"549")}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{color:"rgba(37,211,102,0.8)",textDecoration:"none",fontSize:11}}>
                              💬 {r.telefono}
                            </a>
                          </div>
                        )}
                        {r.email && (
                          <div>
                            <a href={`mailto:${r.email}`} style={{color:"rgba(200,0,0,0.7)",textDecoration:"none"}} onClick={e => e.stopPropagation()}>
                              ✉ {r.email}
                            </a>
                          </div>
                        )}
                        {!r.telefono && !r.email && <span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}
                      </td>
                      {fuente === "ambos" && (
                        <td>
                          {r.enCOCIR && r.enGFI && <span className="pad-badge" style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",color:"#22c55e"}}>Ambos</span>}
                          {r.enCOCIR && !r.enGFI && <span className="pad-badge" style={{background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.25)",color:"#60a5fa"}}>COCIR</span>}
                          {!r.enCOCIR && r.enGFI && <span className="pad-badge" style={{background:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.25)",color:"#eab308"}}>GFI</span>}
                        </td>
                      )}
                      <td>
                        {r.enCOCIR ? (
                          <span className="pad-estado-pill" style={{background:`${color}18`,border:`1px solid ${color}40`,color}}>
                            {esAlerta ? "⛔" : "✅"} {r.estadoCOCIR?.toUpperCase() || "HABILITADO"}
                          </span>
                        ) : (
                          <span className="pad-badge" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.35)"}}>
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
    </>
  );
}
