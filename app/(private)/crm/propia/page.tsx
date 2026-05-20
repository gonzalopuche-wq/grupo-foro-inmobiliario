"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Corredor {
  nombre: string;
  matricula?: string;
  telefono?: string;
}

interface PropiedadMLS {
  id: string;
  titulo: string;
  tipo: string;
  operacion: string;
  precio: number | null;
  moneda: string;
  ciudad: string;
  zona: string;
  direccion?: string;
  dormitorios: number | null;
  banos: number | null;
  ambientes: number | null;
  superficie_cubierta: number | null;
  superficie_total: number | null;
  descripcion?: string;
  fotos: string[];
  corredor?: Corredor;
  url_propia?: string;
}

const TIPOS = ["", "Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Cochera"];
const OPERACIONES = ["", "Venta", "Alquiler", "Alquiler temporal"];
const DORMITORIOS = ["", "1", "2", "3", "4", "5+"];

function formatPrecio(precio: number | null, moneda: string): string {
  if (!precio) return "Consultar";
  return `${moneda === "USD" ? "USD" : "$"} ${precio.toLocaleString("es-AR")}`;
}

export default function PropiaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<"buscar" | "mis-publicaciones">("buscar");
  const [sinCredenciales, setSinCredenciales] = useState(false);

  const [tipo, setTipo] = useState("");
  const [operacion, setOperacion] = useState("");
  const [zona, setZona] = useState("");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [dormitorios, setDormitorios] = useState("");
  const [q, setQ] = useState("");

  const [resultados, setResultados] = useState<PropiedadMLS[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [importando, setImportando] = useState<string | null>(null);
  const [importados, setImportados] = useState<Set<string>>(new Set());
  const [msgImport, setMsgImport] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  const buscar = useCallback(async (pag = 1) => {
    if (!token) return;
    setCargando(true);
    setErrorMsg("");
    setMsgImport("");
    const params = new URLSearchParams({ action: tab, pagina: String(pag) });
    if (tipo) params.set("tipo", tipo);
    if (operacion) params.set("operacion", operacion);
    if (zona) params.set("zona", zona);
    if (precioMin) params.set("precio_min", precioMin);
    if (precioMax) params.set("precio_max", precioMax);
    if (dormitorios) params.set("dormitorios", dormitorios);
    if (q) params.set("q", q);

    try {
      const res = await fetch(`/api/crm/propia?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.sinCredenciales) { setSinCredenciales(true); setCargando(false); return; }
      if (!res.ok || json.error) { setErrorMsg(json.error ?? "Error al buscar"); setCargando(false); return; }
      setSinCredenciales(false);
      setResultados(json.properties ?? json.data ?? []);
      setTotal(json.total ?? json.count ?? 0);
      setPagina(pag);
    } catch {
      setErrorMsg("Error de red. Intentá de nuevo.");
    }
    setCargando(false);
  }, [token, tab, tipo, operacion, zona, precioMin, precioMax, dormitorios, q]);

  useEffect(() => {
    if (token) buscar(1);
  }, [token, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function importarPropiedad(prop: PropiedadMLS) {
    if (!token) return;
    setImportando(prop.id);
    setMsgImport("");
    try {
      const body = {
        titulo: prop.titulo || `${prop.tipo} en ${prop.zona}`,
        tipo: prop.tipo,
        operacion: prop.operacion,
        precio: prop.precio,
        moneda: prop.moneda || "USD",
        ciudad: prop.ciudad || "Buenos Aires",
        zona: prop.zona || "",
        direccion: prop.direccion || "",
        dormitorios: prop.dormitorios,
        banos: prop.banos,
        ambientes: prop.ambientes,
        superficie_cubierta: prop.superficie_cubierta,
        superficie_total: prop.superficie_total,
        descripcion: prop.descripcion || "",
        fotos: prop.fotos || [],
        estado: "activa",
      };
      const res = await fetch("/api/cartera/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Error al guardar");
      setImportados(prev => new Set([...prev, prop.id]));
      setMsgImport("Propiedad importada a tu cartera correctamente.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setMsgImport(`Error: ${msg}`);
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

        .propia-tabs { display:flex; gap:2px; margin-bottom:16px; background:rgba(255,255,255,0.04); border-radius:8px; padding:3px; width:fit-content; }
        .propia-tab  { padding:7px 18px; border-radius:6px; border:none; background:transparent; color:rgba(255,255,255,0.45); font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.04em; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
        .propia-tab.act { background:#cc0000; color:#fff; }

        .propia-filtros { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; align-items:flex-end; }
        .propia-fi { display:flex; flex-direction:column; gap:4px; }
        .propia-fi label { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:700; color:rgba(255,255,255,0.3); letter-spacing:0.1em; text-transform:uppercase; }
        .propia-input { padding:8px 10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:6px; color:#fff; font-size:12px; font-family:'Inter',sans-serif; outline:none; min-width:0; }
        .propia-input:focus { border-color:rgba(204,0,0,0.4); }
        .propia-input::placeholder { color:rgba(255,255,255,0.18); }
        .propia-select { padding:8px 10px; background:rgba(12,12,12,0.9); border:1px solid rgba(255,255,255,0.09); border-radius:6px; color:#fff; font-size:12px; font-family:'Inter',sans-serif; outline:none; }
        .propia-buscar-btn { padding:8px 20px; background:#cc0000; border:none; border-radius:6px; color:#fff; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:800; letter-spacing:0.06em; cursor:pointer; height:36px; }
        .propia-buscar-btn:hover { opacity:0.85; }

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
        .propia-card-corredor { font-size:10px; color:rgba(255,255,255,0.25); font-family:'Inter',sans-serif; margin-top:4px; border-top:1px solid rgba(255,255,255,0.06); padding-top:6px; }
        .propia-card-foot { padding:10px 12px; border-top:1px solid rgba(255,255,255,0.06); display:flex; gap:8px; }
        .propia-import-btn { flex:1; padding:7px 0; border:none; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:800; letter-spacing:0.04em; cursor:pointer; transition:opacity 0.15s; background:#cc0000; color:#fff; }
        .propia-import-btn:hover { opacity:0.85; }
        .propia-import-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .propia-import-btn.done { background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.25); color:#22c55e; }
        .propia-import-btn.doing { background:rgba(204,0,0,0.3); color:rgba(255,255,255,0.6); }

        .propia-paginacion { display:flex; gap:8px; align-items:center; justify-content:center; margin-top:24px; }
        .propia-pag-btn { padding:6px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.6); font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; cursor:pointer; }
        .propia-pag-btn:hover { background:rgba(255,255,255,0.08); }
        .propia-pag-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .propia-pag-info { font-size:12px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif; }

        .propia-empty { text-align:center; padding:48px 24px; color:rgba(255,255,255,0.25); font-family:'Inter',sans-serif; font-size:13px; }
        .propia-empty-ico { font-size:36px; margin-bottom:12px; display:block; }

        .propia-loading { text-align:center; padding:48px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif; }
      `}</style>

      <Link href="/crm/portales" style={{ fontSize:11, color:"rgba(255,255,255,0.3)", textDecoration:"none", fontFamily:"Montserrat,sans-serif", fontWeight:700, letterSpacing:"0.06em", display:"inline-block", marginBottom:12 }}>
        ← Portales
      </Link>

      <div className="propia-title">🏛️ Propia MLS</div>
      <div className="propia-sub">Red MLS del colegio de corredores — buscá, visualizá e importá propiedades</div>

      {sinCredenciales && (
        <div className="propia-banner">
          <div className="propia-banner-t">⚙️ Configurá tu API key de Propia</div>
          <div className="propia-banner-d">
            Para usar el MLS de Propia necesitás ingresar tu API key en{" "}
            <Link href="/crm/portales" style={{ color:"#60a5fa", textDecoration:"none", fontWeight:600 }}>
              Portales → Propia MLS
            </Link>
            . El colegio te la va a facilitar cuando te den acceso a la API.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="propia-tabs">
        <button className={`propia-tab${tab === "buscar" ? " act" : ""}`} onClick={() => setTab("buscar")}>
          Buscar en MLS
        </button>
        <button className={`propia-tab${tab === "mis-publicaciones" ? " act" : ""}`} onClick={() => setTab("mis-publicaciones")}>
          Mis publicaciones
        </button>
      </div>

      {/* Filtros (solo en búsqueda) */}
      {tab === "buscar" && (
        <div className="propia-filtros">
          <div className="propia-fi" style={{ flexGrow:1, minWidth:160 }}>
            <label>Buscar</label>
            <input className="propia-input" placeholder="Zona, dirección, título..." value={q} onChange={e => setQ(e.target.value)} style={{ width:"100%" }} />
          </div>
          <div className="propia-fi">
            <label>Tipo</label>
            <select className="propia-select" value={tipo} onChange={e => setTipo(e.target.value)}>
              {TIPOS.map(t => <option key={t} value={t}>{t || "Todos"}</option>)}
            </select>
          </div>
          <div className="propia-fi">
            <label>Operación</label>
            <select className="propia-select" value={operacion} onChange={e => setOperacion(e.target.value)}>
              {OPERACIONES.map(o => <option key={o} value={o}>{o || "Todas"}</option>)}
            </select>
          </div>
          <div className="propia-fi">
            <label>Dormitorios</label>
            <select className="propia-select" value={dormitorios} onChange={e => setDormitorios(e.target.value)}>
              {DORMITORIOS.map(d => <option key={d} value={d}>{d || "Todos"}</option>)}
            </select>
          </div>
          <div className="propia-fi" style={{ width:100 }}>
            <label>Precio mín.</label>
            <input className="propia-input" placeholder="USD 0" value={precioMin} onChange={e => setPrecioMin(e.target.value)} style={{ width:"100%" }} />
          </div>
          <div className="propia-fi" style={{ width:100 }}>
            <label>Precio máx.</label>
            <input className="propia-input" placeholder="USD ∞" value={precioMax} onChange={e => setPrecioMax(e.target.value)} style={{ width:"100%" }} />
          </div>
          <button className="propia-buscar-btn" onClick={() => buscar(1)} disabled={cargando}>
            {cargando ? "Buscando..." : "Buscar"}
          </button>
        </div>
      )}

      {msgImport && (
        <div className={msgImport.startsWith("Error") ? "propia-err" : "propia-ok"}>
          {msgImport}
        </div>
      )}

      {errorMsg && !sinCredenciales && (
        <div className="propia-err">{errorMsg}</div>
      )}

      {!sinCredenciales && !cargando && total > 0 && (
        <div className="propia-meta">
          {total.toLocaleString("es-AR")} propiedad{total !== 1 ? "es" : ""} encontrada{total !== 1 ? "s" : ""}
          {totalPaginas > 1 && ` · Página ${pagina} de ${totalPaginas}`}
        </div>
      )}

      {cargando && <div className="propia-loading">Conectando con Propia MLS...</div>}

      {!cargando && !sinCredenciales && resultados.length === 0 && !errorMsg && (
        <div className="propia-empty">
          <span className="propia-empty-ico">🏛️</span>
          {tab === "buscar" ? "Usá los filtros y hacé clic en Buscar para ver propiedades del MLS" : "No tenés propiedades publicadas en Propia MLS"}
        </div>
      )}

      {!cargando && resultados.length > 0 && (
        <div className="propia-grid">
          {resultados.map(prop => {
            const foto = prop.fotos?.[0];
            const yaImportado = importados.has(prop.id);
            const estaImportando = importando === prop.id;
            return (
              <div key={prop.id} className="propia-card">
                {foto
                  ? <img src={foto} alt={prop.titulo} className="propia-card-img" />
                  : <div className="propia-card-img-ph">🏠</div>
                }
                <div className="propia-card-body">
                  <div className="propia-card-op">{prop.operacion} · {prop.tipo}</div>
                  <div className="propia-card-titulo">{prop.titulo || `${prop.tipo} en ${prop.zona}`}</div>
                  <div className="propia-card-precio">{formatPrecio(prop.precio, prop.moneda)}</div>
                  <div className="propia-card-loc">{[prop.zona, prop.ciudad].filter(Boolean).join(", ")}</div>
                  <div className="propia-card-attrs">
                    {prop.ambientes ? <span className="propia-attr">{prop.ambientes} amb.</span> : null}
                    {prop.dormitorios ? <span className="propia-attr">{prop.dormitorios} dorm.</span> : null}
                    {prop.banos ? <span className="propia-attr">{prop.banos} baño{prop.banos !== 1 ? "s" : ""}</span> : null}
                    {prop.superficie_cubierta ? <span className="propia-attr">{prop.superficie_cubierta} m²</span> : null}
                  </div>
                  {prop.corredor?.nombre && (
                    <div className="propia-card-corredor">
                      Corredor: {prop.corredor.nombre}
                      {prop.corredor.matricula && ` (Mat. ${prop.corredor.matricula})`}
                    </div>
                  )}
                </div>
                <div className="propia-card-foot">
                  <button
                    className={`propia-import-btn${yaImportado ? " done" : estaImportando ? " doing" : ""}`}
                    onClick={() => !yaImportado && !estaImportando && importarPropiedad(prop)}
                    disabled={yaImportado || estaImportando}
                  >
                    {yaImportado ? "✓ Importada" : estaImportando ? "Importando..." : "Importar a mi cartera"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!cargando && totalPaginas > 1 && (
        <div className="propia-paginacion">
          <button className="propia-pag-btn" onClick={() => buscar(pagina - 1)} disabled={pagina <= 1}>
            ← Anterior
          </button>
          <span className="propia-pag-info">Página {pagina} de {totalPaginas}</span>
          <button className="propia-pag-btn" onClick={() => buscar(pagina + 1)} disabled={pagina >= totalPaginas}>
            Siguiente →
          </button>
        </div>
      )}
    </>
  );
}
