"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// Search result shape (from /search/properties endpoint)
interface SearchItem {
  id: number;
  title: string;
  address_to_show?: string;
  price?: number;
  hide_price?: boolean;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  garages?: number;
  environment_amount?: number;
  slug?: string;
  published_on_mls?: boolean;
  type_id?: { id: number; name: string; slug: string };
  operation_id?: { id: number; name: string; slug: string };
  currency_id?: { id: number; symbol: string };
  company_id?: { id: number; name: string };
  images?: { url_do?: string; url_thumb_do?: string; url_external?: string }[];
}

// Feed item shape (from /properties/feed endpoint)
interface FeedItem {
  id: number;
  title: string;
  address_to_show?: string;
  price?: string | number;
  hide_price?: boolean;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  garages?: number;
  slug?: string;
  published_on_mls?: boolean;
  published_on_portal?: boolean;
  external_identifier?: string;
  currency?: { id: number; symbol?: string; iso?: string };
  images?: { url_do?: string; url_thumb_do?: string }[];
}

// Price stats shape (from /stats/prices endpoint)
interface PriceStats {
  average_price: number;
  median_price: number;
  min_price: number;
  max_price: number;
  total_properties: number;
  property_type?: string;
  operation_type?: string;
  currency?: string;
  location?: { city?: string; neighborhood?: string; subneighborhood?: string };
}

type TabId = "mls" | "portal" | "mis" | "mercado";

const TABS: { id: TabId; label: string }[] = [
  { id: "mls",     label: "MLS" },
  { id: "portal",  label: "Portal" },
  { id: "mis",     label: "Mis publicaciones" },
  { id: "mercado", label: "Mercado" },
];

const TIPOS = ["", "Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Cochera"];
const TIPO_IDS: Record<string, number> = { Departamento: 2, Casa: 1, PH: 5, Local: 6, Oficina: 7, Terreno: 3, Cochera: 11 };
const OP_IDS: Record<string, number> = { Venta: 1, Alquiler: 2, "Alquiler temporal": 4 };

function formatPrecio(p?: string | number, symbol?: string): string {
  if (!p || p === "0" || p === 0) return "Consultar";
  const n = typeof p === "string" ? parseFloat(p) : p;
  if (!n || isNaN(n)) return "Consultar";
  return `${symbol ?? "USD"} ${Math.round(n).toLocaleString("es-AR")}`;
}

export default function PropiaPage() {
  const [token, setToken]   = useState<string | null>(null);
  const [tab, setTab]       = useState<TabId>("mls");
  const [sinCreds, setSinCreds] = useState(false);

  // Search state
  const [q, setQ]             = useState("");
  const [tipo, setTipo]       = useState("");
  const [operacion, setOp]    = useState("");
  const [dormitorios, setDorm] = useState("");
  const [precioMin, setPmin]  = useState("");
  const [precioMax, setPmax]  = useState("");

  const [resultados, setResultados] = useState<SearchItem[]>([]);
  const [feedItems, setFeedItems]   = useState<FeedItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [pagina, setPagina]         = useState(1);
  const [cargando, setCargando]     = useState(false);
  const [errorMsg, setErrorMsg]     = useState("");
  const [importando, setImportando] = useState<number | null>(null);
  const [importados, setImportados] = useState<Set<number>>(new Set());
  const [msgImport, setMsgImport]   = useState("");

  // Mercado state
  const [mCity, setMCity]             = useState("Rosario");
  const [mNeighborhood, setMNeigh]    = useState("");
  const [mTipo, setMTipo]             = useState("");
  const [mOp, setMOp]                 = useState("venta");
  const [mercado, setMercado]         = useState<PriceStats | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  function buildFilter() {
    const f: Record<string, unknown> = {};
    if (tipo && TIPO_IDS[tipo])    f.type_id  = { _eq: TIPO_IDS[tipo] };
    if (operacion && OP_IDS[operacion]) f.operation_id = { _eq: OP_IDS[operacion] };
    if (dormitorios === "5+")      f.bedrooms = { _gte: 5 };
    else if (dormitorios)          f.bedrooms = { _gte: parseInt(dormitorios) };
    const price: Record<string, number> = {};
    if (precioMin) price._gte = parseFloat(precioMin);
    if (precioMax) price._lte = parseFloat(precioMax);
    if (Object.keys(price).length) f.price = price;
    return Object.keys(f).length ? JSON.stringify(f) : undefined;
  }

  const buscar = useCallback(async (pag = 1) => {
    if (!token || !q.trim()) return;
    setCargando(true);
    setErrorMsg("");
    setMsgImport("");

    const target = tab === "mls" ? "red" : "portal";
    const params = new URLSearchParams({
      action: "search",
      target,
      q: q.trim(),
      limit: "24",
      page: String(pag),
    });
    const filter = buildFilter();
    if (filter) params.set("filter", filter);

    try {
      const res  = await fetch(`/api/crm/propia?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.sinCredenciales) { setSinCreds(true); setCargando(false); return; }
      if (!res.ok || json.error) { setErrorMsg(json.error ?? "Error al buscar"); setCargando(false); return; }
      setSinCreds(false);
      setResultados(json.data ?? []);
      setTotal(json.meta?.filter_count ?? json.meta?.total_count ?? (json.data?.length ?? 0));
      setPagina(pag);
    } catch {
      setErrorMsg("Error de red. Intentá de nuevo.");
    }
    setCargando(false);
  }, [token, tab, q, tipo, operacion, dormitorios, precioMin, precioMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarFeed = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    setErrorMsg("");
    setMsgImport("");
    try {
      const res  = await fetch(`/api/crm/propia?action=feed&limit=100`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.sinCredenciales) { setSinCreds(true); setCargando(false); return; }
      if (!res.ok || json.error) { setErrorMsg(json.error ?? "Error al cargar"); setCargando(false); return; }
      setSinCreds(false);
      setFeedItems(json.data ?? []);
    } catch {
      setErrorMsg("Error de red.");
    }
    setCargando(false);
  }, [token]);

  const buscarMercado = useCallback(async () => {
    if (!token || (!mCity && !mNeighborhood)) return;
    setCargando(true);
    setErrorMsg("");
    const params = new URLSearchParams({ action: "precios" });
    if (mCity)         params.set("city", mCity);
    if (mNeighborhood) params.set("neighborhood", mNeighborhood);
    if (mTipo)         params.set("property_type", mTipo.toLowerCase());
    if (mOp)           params.set("operation", mOp);
    try {
      const res  = await fetch(`/api/crm/propia?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.sinCredenciales) { setSinCreds(true); setCargando(false); return; }
      if (!res.ok || json.error) { setErrorMsg(json.error ?? "Sin datos para esa búsqueda"); setCargando(false); return; }
      setSinCreds(false);
      setMercado((json.data ?? null) as PriceStats | null);
    } catch {
      setErrorMsg("Error de red.");
    }
    setCargando(false);
  }, [token, mCity, mNeighborhood, mTipo, mOp]);

  useEffect(() => {
    if (token && tab === "mis") cargarFeed();
  }, [token, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function importarPropiedad(item: SearchItem) {
    if (!token) return;
    setImportando(item.id);
    setMsgImport("");
    try {
      const body = {
        titulo: item.title,
        tipo: item.type_id?.name ?? "",
        operacion: item.operation_id?.name ?? "",
        precio: item.price ?? null,
        moneda: item.currency_id?.symbol ?? "USD",
        ciudad: "",
        zona: item.address_to_show ?? "",
        direccion: item.address_to_show ?? "",
        dormitorios: item.bedrooms ?? null,
        banos: item.bathrooms ?? null,
        ambientes: item.environment_amount ?? null,
        superficie_cubierta: null,
        superficie_total: item.area ?? null,
        descripcion: "",
        fotos: (item.images ?? []).map(i => i.url_do ?? i.url_external ?? "").filter(Boolean),
        estado: "activa",
      };
      const res  = await fetch("/api/cartera/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Error al guardar");
      setImportados(prev => new Set([...prev, item.id]));
      setMsgImport("Propiedad importada a tu cartera correctamente.");
    } catch (e: unknown) {
      setMsgImport(`Error: ${e instanceof Error ? e.message : "desconocido"}`);
    }
    setImportando(null);
  }

  const totalPaginas = Math.ceil(total / 24);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .propia-title { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:800; color:#fff; margin-bottom:3px; }
        .propia-sub   { font-size:12px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif; margin-bottom:20px; }
        .propia-tabs { display:flex; gap:2px; margin-bottom:16px; background:rgba(255,255,255,0.04); border-radius:8px; padding:3px; width:fit-content; flex-wrap:wrap; }
        .propia-tab  { padding:7px 18px; border-radius:6px; border:none; background:transparent; color:rgba(255,255,255,0.45); font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.04em; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
        .propia-tab.act { background:#cc0000; color:#fff; }
        .propia-filtros { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; align-items:flex-end; }
        .propia-fi { display:flex; flex-direction:column; gap:4px; }
        .propia-fi label { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; color:rgba(255,255,255,0.3); letter-spacing:0.1em; text-transform:uppercase; }
        .propia-input { padding:8px 10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:6px; color:#fff; font-size:12px; font-family:'Inter',sans-serif; outline:none; min-width:0; }
        .propia-input:focus { border-color:rgba(204,0,0,0.4); }
        .propia-input::placeholder { color:rgba(255,255,255,0.18); }
        .propia-select { padding:8px 10px; background:rgba(12,12,12,0.9); border:1px solid rgba(255,255,255,0.09); border-radius:6px; color:#fff; font-size:12px; font-family:'Inter',sans-serif; outline:none; }
        .propia-btn { padding:8px 20px; background:#cc0000; border:none; border-radius:6px; color:#fff; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:800; letter-spacing:0.06em; cursor:pointer; height:36px; white-space:nowrap; }
        .propia-btn:hover { opacity:0.85; }
        .propia-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .propia-banner { background:rgba(96,165,250,0.07); border:1px solid rgba(96,165,250,0.18); border-radius:10px; padding:16px 20px; margin-bottom:20px; }
        .propia-banner-t { font-family:'Montserrat',sans-serif; font-size:13px; font-weight:800; color:#60a5fa; margin-bottom:6px; }
        .propia-banner-d { font-size:12px; color:rgba(255,255,255,0.45); font-family:'Inter',sans-serif; line-height:1.6; }
        .propia-err { background:rgba(200,0,0,0.08); border:1px solid rgba(200,0,0,0.2); border-radius:8px; padding:12px 14px; font-size:12px; color:#f87171; font-family:'Inter',sans-serif; margin-bottom:16px; }
        .propia-ok  { background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); border-radius:8px; padding:12px 14px; font-size:12px; color:#22c55e; font-family:'Inter',sans-serif; margin-bottom:16px; }
        .propia-meta { font-size:12px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif; margin-bottom:12px; }
        .propia-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
        .propia-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; transition:border-color 0.15s; }
        .propia-card:hover { border-color:rgba(255,255,255,0.14); }
        .propia-card-img { width:100%; height:150px; object-fit:cover; background:#111; display:block; }
        .propia-card-img-ph { width:100%; height:150px; background:rgba(255,255,255,0.03); display:flex; align-items:center; justify-content:center; font-size:30px; }
        .propia-card-body { padding:12px; flex:1; display:flex; flex-direction:column; gap:4px; }
        .propia-card-op { font-family:'Montserrat',sans-serif; font-size:8px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#cc0000; margin-bottom:2px; }
        .propia-card-titulo { font-family:'Montserrat',sans-serif; font-size:12px; font-weight:700; color:#fff; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .propia-card-precio { font-family:'Montserrat',sans-serif; font-size:14px; font-weight:800; color:#fff; margin-top:2px; }
        .propia-card-loc { font-size:11px; color:rgba(255,255,255,0.4); font-family:'Inter',sans-serif; }
        .propia-card-attrs { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
        .propia-attr { font-size:10px; color:rgba(255,255,255,0.5); font-family:'Inter',sans-serif; background:rgba(255,255,255,0.05); padding:2px 7px; border-radius:4px; }
        .propia-card-foot { padding:10px 12px; border-top:1px solid rgba(255,255,255,0.06); display:flex; gap:8px; }
        .propia-import-btn { flex:1; padding:7px 0; border:none; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:800; letter-spacing:0.04em; cursor:pointer; transition:opacity 0.15s; background:#cc0000; color:#fff; }
        .propia-import-btn:hover { opacity:0.85; }
        .propia-import-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .propia-import-btn.done { background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.25); color:#22c55e; }
        .propia-import-btn.doing { background:rgba(204,0,0,0.3); color:rgba(255,255,255,0.6); }
        .propia-link-btn { flex:1; padding:7px 0; border:1px solid rgba(255,255,255,0.1); border-radius:5px; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; cursor:pointer; background:transparent; color:rgba(255,255,255,0.5); text-align:center; text-decoration:none; display:block; line-height:1.6; }
        .propia-link-btn:hover { background:rgba(255,255,255,0.05); color:#fff; }
        .propia-paginacion { display:flex; gap:8px; align-items:center; justify-content:center; margin-top:24px; }
        .propia-pag-btn { padding:6px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.6); font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; cursor:pointer; }
        .propia-pag-btn:hover { background:rgba(255,255,255,0.08); }
        .propia-pag-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .propia-pag-info { font-size:12px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif; }
        .propia-empty { text-align:center; padding:48px 24px; color:rgba(255,255,255,0.25); font-family:'Inter',sans-serif; font-size:13px; }
        .propia-empty-ico { font-size:36px; margin-bottom:12px; display:block; }
        .propia-loading { text-align:center; padding:48px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif; }
        .propia-badge { display:inline-block; font-family:'Montserrat',sans-serif; font-size:7px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; padding:2px 6px; border-radius:3px; }
        .propia-badge.on { background:rgba(96,165,250,0.15); color:#60a5fa; border:1px solid rgba(96,165,250,0.25); }
        .propia-badge.off { background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.3); border:1px solid rgba(255,255,255,0.08); }
        .propia-stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; margin-top:16px; }
        .propia-stat-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:16px; }
        .propia-stat-label { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; color:rgba(255,255,255,0.3); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px; }
        .propia-stat-value { font-family:'Montserrat',sans-serif; font-size:18px; font-weight:800; color:#fff; }
        .propia-stat-sub { font-size:10px; color:rgba(255,255,255,0.2); font-family:'Inter',sans-serif; margin-top:3px; }
      `}</style>

      <Link href="/crm/portales" style={{ fontSize:11, color:"rgba(255,255,255,0.3)", textDecoration:"none", fontFamily:"Montserrat,sans-serif", fontWeight:700, letterSpacing:"0.06em", display:"inline-block", marginBottom:12 }}>
        ← Portales
      </Link>

      <div className="propia-title">🏛️ Propia</div>
      <div className="propia-sub">Portal y MLS del colegio de corredores · búsqueda, mis publicaciones y estadísticas de mercado</div>

      {sinCreds && (
        <div className="propia-banner">
          <div className="propia-banner-t">⚙️ Configurá tu API key de Propia</div>
          <div className="propia-banner-d">
            Para usar Propia necesitás ingresar tu API key en{" "}
            <Link href="/crm/portales" style={{ color:"#60a5fa", textDecoration:"none", fontWeight:600 }}>
              Portales → Propia
            </Link>
            . Solicitala a <strong>soporte@propia.com</strong> indicando que sos corredor de GFI.
          </div>
        </div>
      )}

      <div className="propia-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`propia-tab${tab === t.id ? " act" : ""}`}
            onClick={() => { setTab(t.id); setErrorMsg(""); setMsgImport(""); setResultados([]); setTotal(0); setMercado(null); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msgImport && (
        <div className={msgImport.startsWith("Error") ? "propia-err" : "propia-ok"}>{msgImport}</div>
      )}
      {errorMsg && !sinCreds && (
        <div className="propia-err">{errorMsg}</div>
      )}

      {/* ══ MLS / Portal search tabs ══════════════════════════════════════════ */}
      {(tab === "mls" || tab === "portal") && (
        <>
          <div className="propia-filtros">
            <div className="propia-fi" style={{ flexGrow:1, minWidth:160 }}>
              <label>Buscar</label>
              <input
                className="propia-input"
                placeholder={tab === "mls" ? "Buscar en la red MLS…" : "Buscar en el portal Propia…"}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && buscar(1)}
                style={{ width:"100%" }}
              />
            </div>
            <div className="propia-fi">
              <label>Tipo</label>
              <select className="propia-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{t || "Todos"}</option>)}
              </select>
            </div>
            <div className="propia-fi">
              <label>Operación</label>
              <select className="propia-select" value={operacion} onChange={e => setOp(e.target.value)}>
                <option value="">Todas</option>
                <option value="Venta">Venta</option>
                <option value="Alquiler">Alquiler</option>
                <option value="Alquiler temporal">Alquiler temporal</option>
              </select>
            </div>
            <div className="propia-fi" style={{ width:80 }}>
              <label>Dormitorios</label>
              <select className="propia-select" value={dormitorios} onChange={e => setDorm(e.target.value)}>
                {["", "1", "2", "3", "4", "5+"].map(d => <option key={d} value={d}>{d || "Todos"}</option>)}
              </select>
            </div>
            <div className="propia-fi" style={{ width:90 }}>
              <label>Precio mín.</label>
              <input className="propia-input" placeholder="USD 0" value={precioMin} onChange={e => setPmin(e.target.value)} style={{ width:"100%" }} />
            </div>
            <div className="propia-fi" style={{ width:90 }}>
              <label>Precio máx.</label>
              <input className="propia-input" placeholder="Sin límite" value={precioMax} onChange={e => setPmax(e.target.value)} style={{ width:"100%" }} />
            </div>
            <button className="propia-btn" onClick={() => buscar(1)} disabled={cargando || !q.trim()}>
              {cargando ? "Buscando…" : "Buscar"}
            </button>
          </div>

          {cargando && <div className="propia-loading">Conectando con Propia…</div>}

          {!cargando && !sinCreds && total > 0 && (
            <div className="propia-meta">
              {total.toLocaleString("es-AR")} resultado{total !== 1 ? "s" : ""}
              {totalPaginas > 1 && ` · Página ${pagina} de ${totalPaginas}`}
            </div>
          )}

          {!cargando && !sinCreds && resultados.length === 0 && !errorMsg && (
            <div className="propia-empty">
              <span className="propia-empty-ico">{tab === "mls" ? "🏛️" : "🌐"}</span>
              {tab === "mls"
                ? "Ingresá un término para buscar propiedades en la red MLS"
                : "Ingresá un término para buscar propiedades en el portal de Propia"}
            </div>
          )}

          {!cargando && resultados.length > 0 && (
            <div className="propia-grid">
              {resultados.map(item => {
                const foto = item.images?.[0]?.url_do ?? item.images?.[0]?.url_external;
                const yaImportado  = importados.has(item.id);
                const estaImport   = importando === item.id;
                const propiaUrl    = `https://propia.com.ar/propiedad/${item.id}${item.slug ? `/${item.slug}` : ""}`;
                return (
                  <div key={item.id} className="propia-card">
                    {foto
                      ? <img src={foto} alt={item.title} className="propia-card-img" />
                      : <div className="propia-card-img-ph">🏠</div>
                    }
                    <div className="propia-card-body">
                      <div className="propia-card-op">
                        {[item.operation_id?.name, item.type_id?.name].filter(Boolean).join(" · ")}
                      </div>
                      <div className="propia-card-titulo">{item.title}</div>
                      <div className="propia-card-precio">
                        {item.hide_price ? "Precio a consultar" : formatPrecio(item.price, item.currency_id?.symbol)}
                      </div>
                      <div className="propia-card-loc">{item.address_to_show}</div>
                      <div className="propia-card-attrs">
                        {item.environment_amount ? <span className="propia-attr">{item.environment_amount} amb.</span> : null}
                        {item.bedrooms           ? <span className="propia-attr">{item.bedrooms} dorm.</span> : null}
                        {item.bathrooms          ? <span className="propia-attr">{item.bathrooms} baño{item.bathrooms !== 1 ? "s" : ""}</span> : null}
                        {item.area               ? <span className="propia-attr">{item.area} m²</span> : null}
                        {item.garages            ? <span className="propia-attr">{item.garages} coch.</span> : null}
                      </div>
                      {item.company_id?.name && (
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.22)", fontFamily:"Inter,sans-serif", marginTop:4 }}>
                          {item.company_id.name}
                        </div>
                      )}
                    </div>
                    <div className="propia-card-foot">
                      <button
                        className={`propia-import-btn${yaImportado ? " done" : estaImport ? " doing" : ""}`}
                        onClick={() => !yaImportado && !estaImport && importarPropiedad(item)}
                        disabled={yaImportado || estaImport}
                      >
                        {yaImportado ? "✓ Importada" : estaImport ? "Importando…" : "Importar a cartera"}
                      </button>
                      <a href={propiaUrl} target="_blank" rel="noopener noreferrer" className="propia-link-btn">
                        Ver ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!cargando && totalPaginas > 1 && (
            <div className="propia-paginacion">
              <button className="propia-pag-btn" onClick={() => buscar(pagina - 1)} disabled={pagina <= 1}>← Anterior</button>
              <span className="propia-pag-info">Página {pagina} de {totalPaginas}</span>
              <button className="propia-pag-btn" onClick={() => buscar(pagina + 1)} disabled={pagina >= totalPaginas}>Siguiente →</button>
            </div>
          )}
        </>
      )}

      {/* ══ Mis publicaciones ═════════════════════════════════════════════════ */}
      {tab === "mis" && (
        <>
          {cargando && <div className="propia-loading">Cargando tus publicaciones en Propia…</div>}

          {!cargando && !sinCreds && feedItems.length === 0 && !errorMsg && (
            <div className="propia-empty">
              <span className="propia-empty-ico">📋</span>
              No tenés propiedades publicadas en Propia todavía.
              <br />
              <span style={{ fontSize:11, marginTop:8, display:"block" }}>
                Podés publicar desde la ficha de cada propiedad en tu cartera o desde{" "}
                <Link href="/crm/portales" style={{ color:"#60a5fa" }}>CRM → Portales</Link>.
              </span>
            </div>
          )}

          {!cargando && feedItems.length > 0 && (
            <>
              <div className="propia-meta">{feedItems.length} propiedad{feedItems.length !== 1 ? "es" : ""} en Propia</div>
              <div className="propia-grid">
                {feedItems.map(item => {
                  const foto      = item.images?.[0]?.url_do ?? item.images?.[0]?.url_thumb_do;
                  const propiaUrl = `https://propia.com.ar/propiedad/${item.id}${item.slug ? `/${item.slug}` : ""}`;
                  const sym       = item.currency?.symbol ?? item.currency?.iso ?? "USD";
                  return (
                    <div key={item.id} className="propia-card">
                      {foto
                        ? <img src={foto} alt={item.title} className="propia-card-img" />
                        : <div className="propia-card-img-ph">🏠</div>
                      }
                      <div className="propia-card-body">
                        <div className="propia-card-titulo">{item.title}</div>
                        <div className="propia-card-precio">
                          {item.hide_price ? "Precio a consultar" : formatPrecio(item.price, sym)}
                        </div>
                        <div className="propia-card-loc">{item.address_to_show}</div>
                        <div className="propia-card-attrs">
                          {item.bedrooms  ? <span className="propia-attr">{item.bedrooms} dorm.</span> : null}
                          {item.bathrooms ? <span className="propia-attr">{item.bathrooms} baño{item.bathrooms !== 1 ? "s" : ""}</span> : null}
                          {item.area      ? <span className="propia-attr">{item.area} m²</span> : null}
                          {item.garages   ? <span className="propia-attr">{item.garages} coch.</span> : null}
                        </div>
                        <div style={{ display:"flex", gap:6, marginTop:6 }}>
                          <span className={`propia-badge ${item.published_on_portal ? "on" : "off"}`}>
                            Portal {item.published_on_portal ? "✓" : "✗"}
                          </span>
                          <span className={`propia-badge ${item.published_on_mls ? "on" : "off"}`}>
                            MLS {item.published_on_mls ? "✓" : "✗"}
                          </span>
                        </div>
                        {item.external_identifier && (
                          <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontFamily:"Inter,sans-serif", marginTop:4 }}>
                            ID externo: {item.external_identifier}
                          </div>
                        )}
                      </div>
                      <div className="propia-card-foot">
                        <a href={propiaUrl} target="_blank" rel="noopener noreferrer" className="propia-link-btn">
                          Ver en Propia ↗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ══ Mercado ═══════════════════════════════════════════════════════════ */}
      {tab === "mercado" && (
        <>
          <div className="propia-filtros">
            <div className="propia-fi" style={{ minWidth:130 }}>
              <label>Ciudad</label>
              <input className="propia-input" placeholder="Ej: Rosario" value={mCity} onChange={e => setMCity(e.target.value)} style={{ width:"100%" }} />
            </div>
            <div className="propia-fi" style={{ minWidth:120 }}>
              <label>Barrio</label>
              <input className="propia-input" placeholder="Ej: Centro" value={mNeighborhood} onChange={e => setMNeigh(e.target.value)} style={{ width:"100%" }} />
            </div>
            <div className="propia-fi">
              <label>Tipo</label>
              <select className="propia-select" value={mTipo} onChange={e => setMTipo(e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{t || "Todos"}</option>)}
              </select>
            </div>
            <div className="propia-fi">
              <label>Operación</label>
              <select className="propia-select" value={mOp} onChange={e => setMOp(e.target.value)}>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>
            <button className="propia-btn" onClick={buscarMercado} disabled={cargando || (!mCity && !mNeighborhood)}>
              {cargando ? "Buscando…" : "Ver estadísticas"}
            </button>
          </div>

          {cargando && <div className="propia-loading">Cargando estadísticas de mercado…</div>}

          {!cargando && mercado && (
            <>
              <div className="propia-meta">
                {[mercado.property_type, mercado.operation_type].filter(Boolean).join(" en ")}
                {mercado.location?.city && ` · ${mercado.location.city}`}
                {mercado.location?.neighborhood && `, ${mercado.location.neighborhood}`}
                {` · ${(mercado.total_properties ?? 0).toLocaleString("es-AR")} propiedades`}
              </div>
              <div className="propia-stats-grid">
                {[
                  { label: "Precio Promedio",  value: mercado.average_price },
                  { label: "Precio Mediano",   value: mercado.median_price },
                  { label: "Precio Mínimo",    value: mercado.min_price },
                  { label: "Precio Máximo",    value: mercado.max_price },
                ].map(({ label, value }) => (
                  <div key={label} className="propia-stat-card">
                    <div className="propia-stat-label">{label}</div>
                    <div className="propia-stat-value">
                      {mercado.currency ?? "USD"} {typeof value === "number" ? Math.round(value).toLocaleString("es-AR") : "—"}
                    </div>
                    <div className="propia-stat-sub">Fuente: propia.com.ar</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!cargando && !mercado && !errorMsg && (
            <div className="propia-empty">
              <span className="propia-empty-ico">📊</span>
              Seleccioná una ciudad o barrio para ver las estadísticas de precios del mercado
            </div>
          )}
        </>
      )}
    </>
  );
}
