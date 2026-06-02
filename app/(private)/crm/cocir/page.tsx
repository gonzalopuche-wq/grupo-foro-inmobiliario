"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PadronEntry {
  matricula: string;
  apellido: string | null;
  nombre: string | null;
  estado: string | null;
  inmobiliaria: string | null;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  localidad: string | null;
}

interface SyncResult {
  actualizados: number;
  omitidos: number;
  errores: number;
  total_perfiles: number;
  total_padron: number;
  detalle: { id: string; matricula: string; cambios: Record<string, string> }[];
}

interface PadronStats {
  total: number;
  activos: number;
  conTelefono: number;
  conCelular: number;
  conEmail: number;
  ultimaSync: string | null;
}

type PhoneStatus = "ok" | "sin_telefono_gfi" | "diferente" | "sin_padron";

interface PhoneStatusEntry {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string;
  foto_url: string | null;
  tipo: string;
  estado_gfi: string;
  telefono_gfi: string | null;
  celular_oficina_gfi: string | null;
  whatsapp_negocio_gfi: string | null;
  email_gfi: string | null;
  inmobiliaria_gfi: string | null;
  telefono_cocir: string | null;
  celular_cocir: string | null;
  email_cocir: string | null;
  inmobiliaria_cocir: string | null;
  estado_cocir: string | null;
  tiene_padron: boolean;
  status: PhoneStatus;
}

interface PhoneStatusResponse {
  data: PhoneStatusEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  totales: { total: number; sin_telefono_gfi: number; diferente: number; sin_padron: number; ok: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function estadoColor(estado: string | null) {
  if (!estado) return "#94a3b8";
  const e = estado.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (e.includes("activ") || e.includes("habili") || e.includes("vigente")) return "#3abab6";
  if (e.includes("suspen") || e.includes("inhab")) return "#b80000";
  return "#d4960c";
}

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

function waLink(num: string) {
  return `https://wa.me/${num.replace(/\D/g, "").replace(/^0/, "549").replace(/^54(?!9)/, "549")}`;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function COCIRPage() {
  const [stats, setStats] = useState<PadronStats | null>(null);
  const [cargandoStats, setCargandoStats] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<PadronEntry[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [tab, setTab] = useState<"padron" | "sync" | "buscar" | "telefonos">("padron");
  const [syncCampos, setSyncCampos] = useState<string[]>(["telefono"]);
  const [syncForzar, setSyncForzar] = useState(false);
  const [syncCargando, setSyncCargando] = useState(false);
  const [syncResultado, setSyncResultado] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [perfilCargado, setPerfilCargado] = useState(false);
  const [contacto, setContacto] = useState<PadronEntry | null>(null);
  // Phone status tab state
  const [phoneFilter, setPhoneFilter] = useState<PhoneStatus | "todos">("sin_telefono_gfi");
  const [phoneData, setPhoneData] = useState<PhoneStatusResponse | null>(null);
  const [phonePage, setPhonePage] = useState(0);
  const [phoneCargando, setPhoneCargando] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());

  // Verificar rol admin
  useEffect(() => {
    const verificar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPerfilCargado(true); return; }
      const { data } = await supabase.from("perfiles").select("tipo").eq("id", user.id).single();
      setEsAdmin(data?.tipo === "admin" || data?.tipo === "master");
      setPerfilCargado(true);
    };
    verificar();
  }, []);

  // Stats del padrón
  const cargarStats = useCallback(async () => {
    setCargandoStats(true);
    try {
      // Total
      const { count: total } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true });

      // Activos
      const { count: activos } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true })
        .ilike("estado", "%activ%");

      // Con teléfono
      const { count: conTelefono } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true })
        .not("telefono", "is", null);

      // Con celular
      const { count: conCelular } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true })
        .not("celular", "is", null);

      // Con email
      const { count: conEmail } = await supabase
        .from("cocir_padron")
        .select("*", { count: "exact", head: true })
        .not("email", "is", null);

      // Última sync — buscamos el actualizado_at más reciente
      const { data: ultima } = await supabase
        .from("cocir_padron")
        .select("actualizado_at")
        .order("actualizado_at", { ascending: false })
        .limit(1);

      setStats({
        total: total ?? 0,
        activos: activos ?? 0,
        conTelefono: conTelefono ?? 0,
        conCelular: conCelular ?? 0,
        conEmail: conEmail ?? 0,
        ultimaSync: ultima?.[0]?.actualizado_at ?? null,
      });
    } catch {
      setStats(null);
    } finally {
      setCargandoStats(false);
    }
  }, []);

  useEffect(() => { cargarStats(); }, [cargarStats]);

  // Búsqueda en padrón
  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const isNumero = /^\d+$/.test(q.trim());
      let query = supabase
        .from("cocir_padron")
        .select("matricula, apellido, nombre, estado, inmobiliaria, telefono, celular, email, localidad")
        .limit(30);

      if (isNumero) {
        query = query.ilike("matricula", `%${q.trim()}%`);
      } else {
        query = query.or(
          `apellido.ilike.%${q}%,nombre.ilike.%${q}%,inmobiliaria.ilike.%${q}%`
        );
      }

      const { data } = await query;
      setResultados((data ?? []) as PadronEntry[]);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => buscar(busqueda), 350);
    return () => clearTimeout(timeout);
  }, [busqueda, buscar]);

  // Phone sync
  const ejecutarSync = async () => {
    if (!esAdmin) return;
    setSyncCargando(true);
    setSyncError("");
    setSyncResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setSyncError("Sesión expirada."); return; }
      const url = `/api/admin/sync-phones-cocir${syncForzar ? "?forzar=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ campos: syncCampos }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setSyncError(data.error ?? "Error"); return; }
      setSyncResultado(data as SyncResult);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setSyncCargando(false);
    }
  };

  const toggleCampo = (campo: string) => {
    setSyncCampos(prev =>
      prev.includes(campo) ? prev.filter(c => c !== campo) : [...prev, campo]
    );
  };

  const cargarPhoneStatus = useCallback(async (filtro: PhoneStatus | "todos", page: number) => {
    setPhoneCargando(true);
    setPhoneError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setPhoneError("Sesión expirada."); return; }
      const res = await fetch(`/api/admin/cocir-phone-status?estado=${filtro}&page=${page}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok || json.error) { setPhoneError(json.error ?? "Error"); return; }
      setPhoneData(json as PhoneStatusResponse);
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setPhoneCargando(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "telefonos" && esAdmin) {
      cargarPhoneStatus(phoneFilter, phonePage);
    }
  }, [tab, phoneFilter, phonePage, esAdmin, cargarPhoneStatus]);

  const syncPhoneIndividual = async (entry: PhoneStatusEntry) => {
    setSyncingIds(prev => new Set(prev).add(entry.id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/admin/cocir-phone-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ perfil_id: entry.id, campos: ["telefono", "celular"] }),
      });
      const json = await res.json();
      if (json.ok && json.actualizados > 0) {
        setSyncedIds(prev => new Set(prev).add(entry.id));
        setPhoneData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            data: prev.data.map(d =>
              d.id === entry.id
                ? { ...d, telefono_gfi: entry.telefono_cocir ?? d.telefono_gfi, status: "ok" as PhoneStatus }
                : d
            ),
          };
        });
      }
    } finally {
      setSyncingIds(prev => { const s = new Set(prev); s.delete(entry.id); return s; });
    }
  };

  if (!perfilCargado) return null;

  return (
    <>
      <style>{`
        .cc-wrap { max-width: 900px; display: flex; flex-direction: column; gap: 20px; font-family: var(--font-body); }
        /* Header */
        .cc-titulo { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--gfi-text-primary); letter-spacing: -0.02em; }
        .cc-titulo span { color: var(--gfi-red); }
        .cc-sub { font-size: 13px; color: var(--gfi-text-secondary); margin-top: 3px; }
        /* KPI cards — using gfi-card pattern */
        .cc-kpis { display: grid; grid-template-columns: repeat(6,1fr); gap: 10px; }
        .cc-kpi { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); padding: 14px 16px; position: relative; overflow: hidden; transition: var(--gfi-transition); }
        .cc-kpi:hover { border-color: var(--gfi-border-bright); box-shadow: var(--gfi-shadow-sm); }
        .cc-kpi::before { content:''; position:absolute; inset:0; background: linear-gradient(135deg, rgba(255,255,255,0.012) 0%, transparent 60%); pointer-events:none; }
        .cc-kpi-val { font-family: var(--font-display); font-size: 22px; font-weight: 900; color: var(--gfi-text-primary); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1; }
        .cc-kpi-label { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-text-muted); margin-top: 4px; font-family: var(--font-display); }
        /* Tabs with red active indicator */
        .cc-tabs { display: flex; border-bottom: 1px solid var(--gfi-border); gap: 2px; }
        .cc-tab { padding: 10px 18px; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: var(--gfi-text-muted); cursor: pointer; border-bottom: 2px solid transparent; background: none; border-top: none; border-left: none; border-right: none; transition: var(--gfi-transition); }
        .cc-tab:hover { color: var(--gfi-text-secondary); }
        .cc-tab.on { color: var(--gfi-text-primary); border-bottom-color: var(--gfi-red); }
        /* Card */
        .cc-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); padding: 18px 20px; }
        /* Input */
        .cc-input { width: 100%; padding: 11px 14px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-family: var(--font-body); font-size: 13px; outline: none; transition: var(--gfi-transition); box-sizing: border-box; }
        .cc-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-glow); }
        .cc-input::placeholder { color: var(--gfi-text-muted); }
        /* Table — gfi-table pattern */
        .cc-tabla { width: 100%; border-collapse: collapse; font-size: 12px; }
        .cc-tabla th { padding: 10px 12px; text-align: left; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gfi-text-muted); border-bottom: 1px solid var(--gfi-border); white-space: nowrap; }
        .cc-tabla tbody tr { border-bottom: 1px solid var(--gfi-border-subtle); transition: background 0.1s; }
        .cc-tabla tbody tr:nth-child(even) { background: rgba(255,255,255,0.012); }
        .cc-tabla td { padding: 10px 12px; border-bottom: 1px solid var(--gfi-border-subtle); vertical-align: middle; color: var(--gfi-text-secondary); }
        .cc-tabla tbody tr:hover { background: rgba(153,0,0,0.04); }
        .cc-tabla tbody tr:hover td { color: var(--gfi-text-primary); }
        /* Badge */
        .cc-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.06em; }
        /* Checkbox rows */
        .cc-cb-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--gfi-bg-secondary); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); cursor: pointer; transition: var(--gfi-transition); }
        .cc-cb-row:hover { background: var(--gfi-bg-hover); border-color: var(--gfi-border-bright); }
        .cc-cb-row input { accent-color: var(--gfi-red); width: 15px; height: 15px; cursor: pointer; }
        /* Buttons — using gfi-btn pattern */
        .cc-btn { padding: 10px 20px; border-radius: var(--gfi-radius-md); font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: 1px solid transparent; transition: var(--gfi-transition); display: inline-flex; align-items: center; gap: 6px; }
        .cc-btn-primary { background: var(--gfi-red-gradient); color: #fff; border-color: transparent; box-shadow: var(--gfi-shadow-red); }
        .cc-btn-primary:hover { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }
        .cc-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        /* Spinner */
        .cc-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.15); border-top-color: var(--gfi-red); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 6px; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Sync result cards */
        .cc-sync-stat { background: var(--gfi-bg-secondary); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); padding: 14px 16px; text-align: center; }
        .cc-sync-stat-val { font-family: var(--font-display); font-size: 28px; font-weight: 900; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .cc-sync-stat-label { font-size: 9px; color: var(--gfi-text-muted); margin-top: 4px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; }
        /* Phone status filters */
        .cc-phone-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .cc-phone-pill { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.07em; cursor: pointer; transition: var(--gfi-transition); }
        .cc-phone-pill:hover { background: var(--gfi-bg-hover); color: var(--gfi-text-primary); border-color: var(--gfi-border-bright); }
        .cc-phone-pill.on { background: var(--gfi-red-soft); border-color: var(--gfi-red-border); color: var(--gfi-red); }
        .cc-phone-pill.ok.on { background: rgba(10,61,46,0.4); border-color: rgba(58,186,182,0.3); color: var(--gfi-green-text); }
        .cc-phone-pill.diferente.on { background: rgba(196,74,0,0.12); border-color: var(--gfi-orange-border); color: #d4960c; }
        .cc-phone-pill.sin-padron.on { background: rgba(255,255,255,0.05); border-color: var(--gfi-border-bright); color: var(--gfi-text-secondary); }
        /* Phone rows */
        .cc-phone-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--gfi-border-subtle); transition: background 0.1s; }
        .cc-phone-row:hover { background: rgba(153,0,0,0.03); }
        .cc-phone-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); flex-shrink: 0; }
        .cc-phone-name { font-family: var(--font-display); font-size: 12px; font-weight: 700; color: var(--gfi-text-primary); }
        .cc-phone-mat { font-family: var(--font-mono); font-size: 10px; font-weight: 600; color: var(--gfi-red); letter-spacing: 0.04em; }
        .cc-phone-tel { font-size: 11px; color: var(--gfi-text-secondary); font-family: var(--font-mono); }
        .cc-phone-cocir { font-size: 11px; color: var(--gfi-green-text); font-family: var(--font-mono); font-weight: 600; }
        .cc-phone-missing { font-size: 11px; color: var(--gfi-text-muted); font-style: italic; font-family: var(--font-body); }
        .cc-phone-status { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; font-family: var(--font-display); font-size: 9px; font-weight: 700; }
        /* Sync action buttons */
        .cc-sync-btn { padding: 5px 13px; border-radius: var(--gfi-radius-md); background: rgba(10,61,46,0.4); border: 1px solid rgba(58,186,182,0.3); color: var(--gfi-green-text); font-family: var(--font-display); font-size: 10px; font-weight: 700; cursor: pointer; transition: var(--gfi-transition); white-space: nowrap; }
        .cc-sync-btn:hover { background: rgba(10,61,46,0.6); border-color: rgba(58,186,182,0.5); }
        .cc-sync-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .cc-sync-done { padding: 5px 13px; border-radius: var(--gfi-radius-md); background: rgba(10,61,46,0.2); border: 1px solid rgba(58,186,182,0.2); color: rgba(58,186,182,0.5); font-family: var(--font-display); font-size: 10px; font-weight: 700; }
        .cc-phone-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 16px; }
        @media (max-width: 700px) {
          .cc-kpis { grid-template-columns: repeat(3,1fr); }
          .cc-phone-kpis { grid-template-columns: repeat(2,1fr); }
        }
      `}</style>

      <div className="cc-wrap">
        {/* Header */}
        <div>
          <div className="cc-titulo">Padrón <span>COCIR</span></div>
          <div className="cc-sub">Gestión del padrón de corredores matriculados · Colegio de Corredores Inmobiliarios de CABA.</div>
        </div>

        {/* KPIs */}
        {cargandoStats ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            <div className="cc-spinner" /> Cargando estadísticas del padrón...
          </div>
        ) : stats ? (
          <div className="cc-kpis">
            <div className="cc-kpi">
              <div className="cc-kpi-val">{stats.total.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Total matriculados</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ color: "#3abab6" }}>{stats.activos.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Activos / habilitados</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ color: "#3b82f6" }}>{stats.conTelefono.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Con teléfono</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ color: "#06b6d4" }}>{stats.conCelular.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Con celular</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ color: "#a78bfa" }}>{stats.conEmail.toLocaleString("es-AR")}</div>
              <div className="cc-kpi-label">Con email</div>
            </div>
            <div className="cc-kpi">
              <div className="cc-kpi-val" style={{ fontSize: 13, color: stats.ultimaSync ? "#d4960c" : "rgba(255,255,255,0.3)" }}>
                {stats.ultimaSync
                  ? new Date(stats.ultimaSync).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
                  : "—"}
              </div>
              <div className="cc-kpi-label">Última actualización</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            {stats === null && !cargandoStats ? "El padrón COCIR aún no fue sincronizado." : ""}
          </div>
        )}

        {/* Tabs */}
        <div className="cc-tabs">
          <button className={`cc-tab${tab === "padron" ? " on" : ""}`} onClick={() => setTab("padron")}>📋 Padrón</button>
          <button className={`cc-tab${tab === "buscar" ? " on" : ""}`} onClick={() => setTab("buscar")}>🔍 Buscar matriculado</button>
          {esAdmin && <button className={`cc-tab${tab === "telefonos" ? " on" : ""}`} onClick={() => setTab("telefonos")}>📱 Teléfonos GFI vs COCIR</button>}
          {esAdmin && <button className={`cc-tab${tab === "sync" ? " on" : ""}`} onClick={() => setTab("sync")}>🔄 Sincronizar masivo</button>}
        </div>

        {/* ═══ PADRÓN ═══ */}
        {tab === "padron" && (
          <div className="cc-card">
            {stats && stats.total > 0 ? (
              <div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                  Muestra del padrón — últimos 20 registros
                </div>
                <PadronMuestra onSelect={setContacto} />
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>📭</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                  Padrón vacío
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
                  {esAdmin
                    ? "El padrón COCIR no ha sido sincronizado. Ejecutá la sincronización desde el panel de administración (/admin/sync)."
                    : "El padrón aún no fue cargado. Contactá al administrador."}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ BUSCAR ═══ */}
        {tab === "buscar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              className="cc-input"
              placeholder="Nombre, apellido, inmobiliaria o número de matrícula..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {buscando && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                <div className="cc-spinner" /> Buscando en el padrón...
              </div>
            )}
            {!buscando && busqueda.length >= 2 && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                {resultados.length === 0 ? "Sin resultados." : `${resultados.length} resultado${resultados.length > 1 ? "s" : ""}`}
              </div>
            )}
            {resultados.length > 0 && (
              <div className="cc-card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="gfi-table">
                  <thead>
                    <tr>
                      <th>Matrícula</th>
                      <th>Apellido y Nombre</th>
                      <th>Estado</th>
                      <th>Inmobiliaria</th>
                      <th>Celular / WhatsApp</th>
                      <th>Email</th>
                      <th>Localidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map(r => (
                      <tr key={r.matricula} style={{ cursor: "pointer" }} onClick={() => setContacto(r)}>
                        <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--gfi-red)", letterSpacing: "0.04em" }}>{r.matricula}</td>
                        <td style={{ color: "var(--gfi-text-primary)", fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 12 }}>
                          {[r.apellido, r.nombre].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td>
                          <span className="cc-badge" style={{ background: `${estadoColor(r.estado)}18`, color: estadoColor(r.estado), border: `1px solid ${estadoColor(r.estado)}35` }}>
                            {r.estado ?? "—"}
                          </span>
                        </td>
                        <td style={{ color: "var(--gfi-text-secondary)", fontSize: 11 }}>{r.inmobiliaria || "—"}</td>
                        <td style={{fontSize:11}}>
                          {(() => {
                            const { celular } = parseCamposContacto({ celular: r.celular, telefono: r.telefono, email: r.email });
                            return celular
                              ? <a href={waLink(celular)} target="_blank" rel="noopener noreferrer" style={{color:"#25d366",textDecoration:"none",fontFamily:"var(--font-mono)",display:"inline-flex",alignItems:"center",gap:4}}>
                                  💬 {celular}
                                </a>
                              : <span style={{color:"var(--gfi-text-muted)"}}>—</span>;
                          })()}
                        </td>
                        <td style={{fontSize:11}}>
                          {(() => {
                            const { email } = parseCamposContacto({ celular: r.celular, telefono: r.telefono, email: r.email });
                            return email
                              ? <a href={`mailto:${email}`} style={{color:"#f87171",textDecoration:"none",wordBreak:"break-all"}}>
                                  {email.toLowerCase()}
                                </a>
                              : <span style={{color:"var(--gfi-text-muted)"}}>—</span>;
                          })()}
                        </td>
                        <td style={{ color: "var(--gfi-text-muted)", fontSize: 11 }}>{r.localidad || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {busqueda.length < 2 && (
              <div style={{ padding: "30px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>🔍</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>
                  Ingresá al menos 2 caracteres para buscar
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TELÉFONOS GFI vs COCIR (solo admin) ═══ */}
        {tab === "telefonos" && esAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* KPIs de estado */}
            {phoneData?.totales && (
              <div className="cc-phone-kpis">
                <div className="cc-kpi" style={{ borderColor: "rgba(153,0,0,0.2)" }}>
                  <div className="cc-kpi-val" style={{ color: "#ff4444" }}>{phoneData.totales.sin_telefono_gfi}</div>
                  <div className="cc-kpi-label">Sin teléfono en GFI</div>
                </div>
                <div className="cc-kpi" style={{ borderColor: "rgba(234,179,8,0.2)" }}>
                  <div className="cc-kpi-val" style={{ color: "#d4960c" }}>{phoneData.totales.diferente}</div>
                  <div className="cc-kpi-label">Número diferente</div>
                </div>
                <div className="cc-kpi" style={{ borderColor: "rgba(34,197,94,0.2)" }}>
                  <div className="cc-kpi-val" style={{ color: "#3abab6" }}>{phoneData.totales.ok}</div>
                  <div className="cc-kpi-label">Coinciden / OK</div>
                </div>
                <div className="cc-kpi">
                  <div className="cc-kpi-val" style={{ color: "rgba(255,255,255,0.3)" }}>{phoneData.totales.sin_padron}</div>
                  <div className="cc-kpi-label">Sin registro COCIR</div>
                </div>
              </div>
            )}

            {/* Filtros */}
            <div className="cc-phone-filters">
              {[
                { id: "sin_telefono_gfi", label: "Sin teléfono en GFI", cls: "" },
                { id: "diferente", label: "Número diferente", cls: "diferente" },
                { id: "ok", label: "OK / coincide", cls: "ok" },
                { id: "sin_padron", label: "Sin registro COCIR", cls: "sin-padron" },
                { id: "todos", label: "Todos", cls: "" },
              ].map(f => (
                <button
                  key={f.id}
                  className={`cc-phone-pill ${f.cls}${phoneFilter === f.id ? " on" : ""}`}
                  onClick={() => { setPhoneFilter(f.id as PhoneStatus | "todos"); setPhonePage(0); }}
                >
                  {f.label}
                  {phoneData?.totales && f.id !== "todos" && (
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>
                      ({phoneData.totales[f.id as keyof typeof phoneData.totales] ?? 0})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Lista */}
            <div className="cc-card" style={{ padding: 0, overflow: "hidden" }}>
              {phoneCargando && (
                <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  <div className="cc-spinner" /> Cargando comparación de teléfonos...
                </div>
              )}
              {phoneError && (
                <div style={{ padding: "14px 16px", fontSize: 12, color: "#ff4444" }}>⚠ {phoneError}</div>
              )}
              {!phoneCargando && !phoneError && phoneData && phoneData.data.length === 0 && (
                <div style={{ padding: "30px 20px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  No hay registros en esta categoría.
                </div>
              )}
              {!phoneCargando && phoneData && phoneData.data.map(entry => {
                const syncing = syncingIds.has(entry.id);
                const synced = syncedIds.has(entry.id);
                const canSync = !syncing && !synced && entry.tiene_padron && (entry.status === "sin_telefono_gfi" || entry.status === "diferente");
                const telCOCIR = entry.telefono_cocir ?? entry.celular_cocir;
                const telGFI = entry.telefono_gfi ?? entry.celular_oficina_gfi;

                const statusColors: Record<PhoneStatus, string> = {
                  ok: "#3abab6",
                  sin_telefono_gfi: "#ff4444",
                  diferente: "#d4960c",
                  sin_padron: "#64748b",
                };
                const statusLabels: Record<PhoneStatus, string> = {
                  ok: "OK",
                  sin_telefono_gfi: "Sin teléfono GFI",
                  diferente: "Diferente",
                  sin_padron: "Sin COCIR",
                };

                return (
                  <div key={entry.id} className="cc-phone-row">
                    {/* Avatar */}
                    {entry.foto_url
                      ? <img src={entry.foto_url} alt="" className="cc-phone-avatar" referrerPolicy="no-referrer" onError={e => { (e.target as HTMLImageElement).src = ""; }} />
                      : <div className="cc-phone-avatar" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                          {entry.apellido?.[0] ?? "?"}
                        </div>
                    }
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cc-phone-name">{entry.apellido}, {entry.nombre}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                        <span className="cc-phone-mat">#{entry.matricula}</span>
                        <span className="cc-phone-status" style={{
                          background: `${statusColors[entry.status]}18`,
                          border: `1px solid ${statusColors[entry.status]}35`,
                          color: statusColors[entry.status],
                        }}>
                          {statusLabels[entry.status]}
                        </span>
                      </div>
                    </div>
                    {/* Teléfonos */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>GFI</div>
                      {telGFI
                        ? <span className="cc-phone-tel">{telGFI}</span>
                        : <span className="cc-phone-missing">sin teléfono</span>
                      }
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>COCIR</div>
                      {telCOCIR
                        ? <span className="cc-phone-cocir">{telCOCIR}</span>
                        : <span className="cc-phone-missing">—</span>
                      }
                    </div>
                    {/* Acción */}
                    <div style={{ flexShrink: 0 }}>
                      {synced ? (
                        <span className="cc-sync-done">✓ Sync</span>
                      ) : canSync ? (
                        <button
                          className="cc-sync-btn"
                          disabled={syncing}
                          onClick={() => syncPhoneIndividual(entry)}
                        >
                          {syncing ? <span className="cc-spinner" style={{ margin: 0 }} /> : "↓ Sincronizar"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginación */}
            {phoneData && (phoneData.page > 0 || phoneData.hasMore) && (
              <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                {phoneData.page > 0 && (
                  <button className="cc-btn" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }} onClick={() => setPhonePage(p => p - 1)}>
                    ← Anterior
                  </button>
                )}
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", alignSelf: "center" }}>
                  Página {phoneData.page + 1} · {phoneData.total} perfiles
                </span>
                {phoneData.hasMore && (
                  <button className="cc-btn cc-btn-primary" onClick={() => setPhonePage(p => p + 1)}>
                    Siguiente →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ SYNC TELÉFONOS (solo admin) ═══ */}
        {tab === "sync" && esAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="cc-card">
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                Sincronización de datos desde padrón COCIR → perfiles
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.6 }}>
                Copia los datos del padrón COCIR hacia los perfiles de usuarios registrados, cruzando por número de matrícula. Por defecto solo actualiza campos vacíos.
              </div>

              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                Campos a sincronizar
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {[
                  { id: "telefono", label: "Teléfono fijo", desc: "Teléfono fijo del padrón COCIR → perfil.telefono" },
                  { id: "celular", label: "Celular", desc: "Celular del padrón COCIR → perfil.celular_oficina" },
                  { id: "email", label: "Email", desc: "Dirección de email del padrón → perfil.email" },
                  { id: "inmobiliaria", label: "Inmobiliaria", desc: "Razón social de la inmobiliaria → perfil.inmobiliaria" },
                ].map(campo => (
                  <label key={campo.id} className="cc-cb-row">
                    <input
                      type="checkbox"
                      checked={syncCampos.includes(campo.id)}
                      onChange={() => toggleCampo(campo.id)}
                    />
                    <div>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: syncCampos.includes(campo.id) ? "#fff" : "rgba(255,255,255,0.5)" }}>
                        {campo.label}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{campo.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <label className="cc-cb-row" style={{ marginBottom: 16, borderColor: syncForzar ? "rgba(234,179,8,0.3)" : undefined, background: syncForzar ? "rgba(234,179,8,0.05)" : undefined }}>
                <input type="checkbox" checked={syncForzar} onChange={e => setSyncForzar(e.target.checked)} />
                <div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: syncForzar ? "#d4960c" : "rgba(255,255,255,0.5)" }}>
                    ⚠ Forzar sobreescritura
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Actualiza aunque el perfil ya tenga el dato cargado</div>
                </div>
              </label>

              {syncError && (
                <div style={{ padding: "10px 14px", background: "rgba(153,0,0,0.08)", border: "1px solid rgba(153,0,0,0.25)", borderRadius: 6, fontSize: 12, color: "rgba(255,100,100,0.9)", marginBottom: 12 }}>
                  ⚠ {syncError}
                </div>
              )}

              <button
                className="cc-btn cc-btn-primary"
                onClick={ejecutarSync}
                disabled={syncCargando || syncCampos.length === 0}
              >
                {syncCargando ? <><span className="cc-spinner" />Sincronizando...</> : `▶ Ejecutar sincronización (${syncCampos.join(", ")})`}
              </button>
            </div>

            {/* Resultado */}
            {syncResultado && (
              <div className="cc-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
                  Resultado de la sincronización
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
                  <div className="cc-sync-stat">
                    <div className="cc-sync-stat-val" style={{ color: "#3abab6" }}>{syncResultado.actualizados}</div>
                    <div className="cc-sync-stat-label">Actualizados</div>
                  </div>
                  <div className="cc-sync-stat">
                    <div className="cc-sync-stat-val" style={{ color: "rgba(255,255,255,0.4)" }}>{syncResultado.omitidos}</div>
                    <div className="cc-sync-stat-label">Omitidos</div>
                  </div>
                  <div className="cc-sync-stat">
                    <div className="cc-sync-stat-val" style={{ color: syncResultado.errores > 0 ? "#b80000" : "rgba(255,255,255,0.4)" }}>{syncResultado.errores}</div>
                    <div className="cc-sync-stat-label">Errores</div>
                  </div>
                  <div className="cc-sync-stat">
                    <div className="cc-sync-stat-val" style={{ color: "#3b82f6" }}>{syncResultado.total_perfiles}</div>
                    <div className="cc-sync-stat-label">Perfiles totales</div>
                  </div>
                </div>

                {syncResultado.detalle.length > 0 && (
                  <>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                      Detalle de cambios ({syncResultado.detalle.length})
                    </div>
                    <div style={{ maxHeight: 250, overflowY: "auto" }}>
                      {syncResultado.detalle.map(d => (
                        <div key={d.id} style={{ padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 800, color: "#990000", flexShrink: 0 }}>#{d.matricula}</span>
                          <div style={{ flex: 1 }}>
                            {Object.entries(d.cambios).map(([campo, valor]) => (
                              <span key={campo} style={{ fontSize: 11, color: "#3abab6", fontFamily: "Montserrat,sans-serif", marginRight: 10 }}>
                                {campo}: <strong>{valor}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {contacto && (
        <div
          style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
          onClick={() => setContacto(null)}
        >
          <div
            style={{ background:"var(--gfi-bg-card)",border:"1px solid var(--gfi-border)",borderRadius:"var(--gfi-radius-xl)",padding:"28px 24px",maxWidth:480,width:"100%",display:"flex",flexDirection:"column",gap:16,boxShadow:"var(--gfi-shadow-lg)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{fontFamily:"var(--font-display)",fontWeight:800,fontSize:18,color:"var(--gfi-text-primary)",letterSpacing:"-0.01em"}}>
                  {[contacto.apellido, contacto.nombre].filter(Boolean).join(", ") || "—"}
                </div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--gfi-red)",fontWeight:600,marginTop:4,letterSpacing:"0.04em"}}>
                  Matrícula {contacto.matricula}
                </div>
              </div>
              <button onClick={() => setContacto(null)} style={{background:"none",border:"none",color:"var(--gfi-text-muted)",fontSize:22,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
            </div>
            {contacto.estado && (
              <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:20,background:`${estadoColor(contacto.estado)}18`,border:`1px solid ${estadoColor(contacto.estado)}40`,alignSelf:"flex-start"}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:estadoColor(contacto.estado),display:"inline-block"}}/>
                <span style={{fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",color:estadoColor(contacto.estado)}}>{contacto.estado.toUpperCase()}</span>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10,borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:16}}>
              {contacto.inmobiliaria && (
                <div style={{display:"flex",gap:10}}>
                  <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",paddingTop:1}}>Inmob.</span>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{contacto.inmobiliaria}</span>
                </div>
              )}
              {contacto.localidad && (
                <div style={{display:"flex",gap:10}}>
                  <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",paddingTop:1}}>Localidad</span>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{contacto.localidad}</span>
                </div>
              )}
              {contacto.celular && (
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>Celular</span>
                  <a href={`https://wa.me/${contacto.celular.replace(/\D/g,"").replace(/^0/,"549").replace(/^54(?!9)/,"549")}`} target="_blank" rel="noopener noreferrer" style={{color:"#25d366",textDecoration:"none",fontWeight:700,fontSize:13}}>
                    {contacto.celular}
                  </a>
                </div>
              )}
              {contacto.telefono && contacto.telefono !== contacto.celular && (
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>Teléfono</span>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{contacto.telefono}</span>
                </div>
              )}
              {contacto.email && (
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{minWidth:80,fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>Email</span>
                  <a href={`mailto:${contacto.email}`} style={{color:"#f87171",textDecoration:"none",fontSize:13,wordBreak:"break-all"}}>{contacto.email}</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-componente: muestra del padrón ───────────────────────────────────────

function PadronMuestra({ onSelect }: { onSelect: (r: PadronEntry) => void }) {
  const [filas, setFilas] = useState<PadronEntry[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from("cocir_padron")
        .select("matricula, apellido, nombre, estado, inmobiliaria, telefono, celular, email, localidad")
        .order("matricula", { ascending: false })
        .limit(20);
      setFilas((data ?? []) as PadronEntry[]);
      setCargando(false);
    };
    cargar();
  }, []);

  if (cargando) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Cargando...</div>;
  if (filas.length === 0) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Sin datos en el padrón.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="gfi-table" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            {["Matrícula", "Apellido y Nombre", "Estado", "Inmobiliaria", "Celular / WhatsApp", "Email", "Localidad"].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(r => (
            <tr key={r.matricula} style={{ cursor: "pointer" }} onClick={() => onSelect(r)}>
              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--gfi-red)", letterSpacing: "0.04em" }}>{r.matricula}</td>
              <td style={{ color: "var(--gfi-text-primary)", fontWeight: 600, fontFamily: "var(--font-display)", fontSize: 12 }}>
                {[r.apellido, r.nombre].filter(Boolean).join(", ") || "—"}
              </td>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 10, fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 700, background: `${estadoColor(r.estado)}18`, color: estadoColor(r.estado), border: `1px solid ${estadoColor(r.estado)}35` }}>
                  {r.estado ?? "—"}
                </span>
              </td>
              <td style={{ color: "var(--gfi-text-secondary)", fontSize: 11 }}>{r.inmobiliaria || "—"}</td>
              <td style={{fontSize:11}}>
                {(() => {
                  const { celular } = parseCamposContacto({ celular: r.celular, telefono: r.telefono, email: r.email });
                  return celular
                    ? <a href={waLink(celular)} target="_blank" rel="noopener noreferrer" style={{color:"#25d366",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>
                        💬 {celular}
                      </a>
                    : <span style={{color:"var(--gfi-text-muted)"}}>—</span>;
                })()}
              </td>
              <td style={{fontSize:11}}>
                {(() => {
                  const { email } = parseCamposContacto({ celular: r.celular, telefono: r.telefono, email: r.email });
                  return email
                    ? <a href={`mailto:${email}`} style={{color:"#f87171",textDecoration:"none",wordBreak:"break-all"}}>
                        {email.toLowerCase()}
                      </a>
                    : <span style={{color:"var(--gfi-text-muted)"}}>—</span>;
                })()}
              </td>
              <td style={{ color: "var(--gfi-text-muted)", fontSize: 11 }}>{r.localidad || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
