"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";

const OP_COLOR: Record<string, string> = {
  venta: "#22c55e", compra: "#22c55e", alquiler: "#60a5fa",
  temporario: "#eab308", permuta: "#c084fc",
  comercial: "#f97316", fondo_comercio: "#fb7185", campo: "#84cc16",
};
const OP_LABEL: Record<string, string> = {
  venta: "Venta", compra: "Comprar", alquiler: "Alquiler",
  temporario: "Temporario", permuta: "Permuta",
  comercial: "Comercial", fondo_comercio: "Fondo Comercio", campo: "Campo",
};

const TIPOS = [
  "Departamento","Casa","PH","Terreno o Lote","Departamento de Pasillo",
  "Cochera","Oficina","Local Comercial","Galpón","Campo",
  "Negocio o Fondo de Comercio","Consultorio","Baulera",
];
const CIUDADES = [
  "Rosario","Roldán","Funes","San Lorenzo","Capitán Bermúdez",
  "Granadero Baigorria","Pérez","Soldini","Ricardone","Alvear",
  "Villa Gobernador Gálvez","Pueblo Esther","General Lagos","Arroyo Seco",
  "Casilda","Carcarañá","Cañada de Gómez","Villa Constitución",
  "San Jerónimo Norte","Acebal","Totoras","Rufino","Venado Tuerto",
];

interface Ofrecido {
  id: string;
  perfil_id: string;
  operacion: string;
  tipo_propiedad: string;
  zona: string | null;
  ciudad: string;
  precio: number | null;
  moneda: string;
  dormitorios: number | null;
  banos: number | null;
  superficie_cubierta: number | null;
  superficie_total: number | null;
  antiguedad: string | null;
  apto_credito: boolean;
  uso_comercial: boolean;
  barrio_cerrado: boolean;
  con_cochera: boolean;
  acepta_mascotas: boolean;
  acepta_bitcoin: boolean;
  descripcion: string | null;
  nombre_publicante: string | null;
  honorario_compartir: string | null;
  fotos: string[] | null;
  cartera_id: string | null;
  activo: boolean;
  created_at: string;
  perfiles?: {
    nombre: string;
    apellido: string;
    matricula: string | null;
    telefono: string | null;
    email: string | null;
    foto_url: string | null;
  } | null;
}

const fmt = (n: number | null) => n ? n.toLocaleString("es-AR") : "—";

export default function RedGFIPage() {
  const [items, setItems] = useState<Ofrecido[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroOp, setFiltroOp] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCiudad, setFiltroCiudad] = useState("");
  const [filtroDorm, setFiltroDorm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiarFicha = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/red-gfi/ficha/${id}`;
    navigator.clipboard.writeText(url);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
      await cargar();
    };
    init();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mir_ofrecidos")
      .select(`
        *,
        perfiles:perfil_id (nombre, apellido, matricula, telefono, email, foto_url)
      `)
      .eq("activo", true)
      .order("created_at", { ascending: false });
    setItems((data as Ofrecido[]) ?? []);
    setLoading(false);
  };

  const filtrados = useMemo(() => {
    let r = items;
    if (filtroOp) r = r.filter(i => i.operacion === filtroOp);
    if (filtroTipo) r = r.filter(i => i.tipo_propiedad === filtroTipo);
    if (filtroCiudad) r = r.filter(i => i.ciudad === filtroCiudad);
    if (filtroDorm) r = r.filter(i => (i.dormitorios ?? 0) >= parseInt(filtroDorm));
    if (busqueda) {
      const q = busqueda.toLowerCase();
      r = r.filter(i =>
        i.tipo_propiedad?.toLowerCase().includes(q) ||
        i.ciudad?.toLowerCase().includes(q) ||
        i.zona?.toLowerCase().includes(q) ||
        i.descripcion?.toLowerCase().includes(q) ||
        i.nombre_publicante?.toLowerCase().includes(q) ||
        i.perfiles?.nombre?.toLowerCase().includes(q) ||
        i.perfiles?.apellido?.toLowerCase().includes(q)
      );
    }
    return r;
  }, [items, filtroOp, filtroTipo, filtroCiudad, filtroDorm, busqueda]);

  const selected = selectedId ? items.find(i => i.id === selectedId) ?? null : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .rgfi-wrap { max-width: 1400px; }
        .rgfi-header { margin-bottom: 24px; }
        .rgfi-title { font-family:'Montserrat',sans-serif; font-size:22px; font-weight:800; color:#fff; }
        .rgfi-title span { color:#cc0000; }
        .rgfi-sub { font-size:13px; color:rgba(255,255,255,0.35); margin-top:4px; font-family:'Inter',sans-serif; }
        .rgfi-stats { display:flex; gap:16px; margin-top:12px; flex-wrap:wrap; }
        .rgfi-stat { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px 16px; }
        .rgfi-stat-n { font-family:'Montserrat',sans-serif; font-size:20px; font-weight:800; color:#fff; }
        .rgfi-stat-l { font-size:10px; color:rgba(255,255,255,0.3); font-family:'Inter',sans-serif; }
        .rgfi-filters { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px 16px; margin-bottom:20px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .rgfi-filter-input { flex:1; min-width:180px; padding:8px 12px; background:rgba(12,12,12,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:6px; color:#fff; font-size:13px; font-family:'Inter',sans-serif; outline:none; }
        .rgfi-filter-input::placeholder { color:rgba(255,255,255,0.2); }
        .rgfi-filter-sel { padding:8px 10px; background:rgba(12,12,12,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:6px; color:rgba(255,255,255,0.6); font-size:12px; font-family:'Inter',sans-serif; outline:none; cursor:pointer; }
        .rgfi-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }
        .rgfi-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; overflow:hidden; cursor:pointer; transition:border-color 0.15s,transform 0.1s; }
        .rgfi-card:hover { border-color:rgba(204,0,0,0.3); transform:translateY(-1px); }
        .rgfi-card.selected { border-color:#cc0000; }
        .rgfi-card-foto { height:160px; background:rgba(255,255,255,0.03); position:relative; overflow:hidden; }
        .rgfi-card-foto img { width:100%; height:100%; object-fit:cover; }
        .rgfi-card-foto-empty { height:100%; display:flex; align-items:center; justify-content:center; font-size:40px; }
        .rgfi-op-badge { position:absolute; top:8px; left:8px; padding:3px 8px; border-radius:4px; font-family:'Montserrat',sans-serif; font-size:9px; font-weight:800; letter-spacing:0.08em; }
        .rgfi-card-body { padding:14px; }
        .rgfi-card-tipo { font-size:11px; color:rgba(255,255,255,0.3); font-family:'Montserrat',sans-serif; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; }
        .rgfi-card-precio { font-family:'Montserrat',sans-serif; font-size:18px; font-weight:800; color:#fff; margin:4px 0; }
        .rgfi-card-loc { font-size:12px; color:rgba(255,255,255,0.45); margin-bottom:8px; }
        .rgfi-card-meta { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
        .rgfi-meta-item { font-size:11px; color:rgba(255,255,255,0.4); }
        .rgfi-chips { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:10px; }
        .rgfi-chip { font-size:9px; padding:2px 6px; border-radius:3px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.4); font-family:'Montserrat',sans-serif; font-weight:700; letter-spacing:0.04em; }
        .rgfi-corredor { display:flex; align-items:center; gap:8px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); }
        .rgfi-corredor-ava { width:28px; height:28px; border-radius:6px; background:rgba(200,0,0,0.12); border:1px solid rgba(200,0,0,0.2); display:flex; align-items:center; justify-content:center; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:800; color:#cc0000; flex-shrink:0; overflow:hidden; }
        .rgfi-corredor-ava img { width:100%; height:100%; object-fit:cover; }
        .rgfi-corredor-nombre { font-size:12px; font-weight:600; color:rgba(255,255,255,0.7); font-family:'Inter',sans-serif; }
        .rgfi-corredor-mat { font-size:10px; color:rgba(255,255,255,0.25); }
        .rgfi-corredor-tel { font-size:10px; color:rgba(96,165,250,0.8); }
        .rgfi-my-badge { position:absolute; top:8px; right:8px; background:rgba(200,0,0,0.85); color:#fff; font-size:8px; font-family:'Montserrat',sans-serif; font-weight:800; padding:2px 6px; border-radius:3px; letter-spacing:0.06em; }
        /* Detail modal */
        .rgfi-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
        .rgfi-detail { background:#111; border:1px solid rgba(255,255,255,0.1); border-radius:14px; width:100%; max-width:680px; max-height:90vh; overflow-y:auto; }
        .rgfi-detail-header { padding:20px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .rgfi-detail-close { background:none; border:none; color:rgba(255,255,255,0.4); font-size:18px; cursor:pointer; padding:4px; flex-shrink:0; }
        .rgfi-detail-close:hover { color:#fff; }
        .rgfi-detail-fotos { display:flex; gap:8px; padding:16px; overflow-x:auto; }
        .rgfi-detail-fotos img { height:160px; width:auto; border-radius:6px; flex-shrink:0; }
        .rgfi-detail-body { padding:0 20px 20px; }
        .rgfi-detail-section { margin-bottom:16px; }
        .rgfi-detail-section-title { font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; color:rgba(255,255,255,0.25); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:8px; }
        .rgfi-detail-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .rgfi-detail-item { background:rgba(255,255,255,0.03); border-radius:6px; padding:8px 10px; }
        .rgfi-detail-item-label { font-size:9px; color:rgba(255,255,255,0.25); font-family:'Montserrat',sans-serif; letter-spacing:0.06em; text-transform:uppercase; }
        .rgfi-detail-item-value { font-size:13px; color:#fff; font-family:'Inter',sans-serif; font-weight:500; margin-top:2px; }
        .rgfi-contact-card { background:rgba(200,0,0,0.06); border:1px solid rgba(200,0,0,0.15); border-radius:8px; padding:14px; }
        .rgfi-contact-name { font-family:'Montserrat',sans-serif; font-size:15px; font-weight:800; color:#fff; }
        .rgfi-contact-mat { font-size:11px; color:rgba(255,255,255,0.3); margin-bottom:10px; }
        .rgfi-contact-btns { display:flex; gap:8px; flex-wrap:wrap; }
        .rgfi-contact-btn { padding:8px 16px; border-radius:6px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; text-decoration:none; letter-spacing:0.04em; display:inline-block; }
        .rgfi-contact-btn-wa { background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); color:#22c55e; }
        .rgfi-contact-btn-mail { background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.2); color:#60a5fa; }
        .rgfi-contact-btn-ficha { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.7); }
        .rgfi-honor-badge { background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.2); border-radius:4px; padding:4px 10px; font-size:10px; font-family:'Montserrat',sans-serif; color:rgba(234,179,8,0.8); font-weight:700; }
        .rgfi-ficha-btn { margin-top:10px; width:100%; padding:8px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; color:rgba(255,255,255,0.4); font-family:'Montserrat',sans-serif; font-size:10px; font-weight:700; letter-spacing:0.06em; cursor:pointer; transition:background 0.15s,color 0.15s; text-align:center; text-decoration:none; display:block; }
        .rgfi-ficha-btn:hover { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); }
        .rgfi-empty { text-align:center; padding:60px 20px; color:rgba(255,255,255,0.2); font-family:'Inter',sans-serif; }
        .rgfi-empty-ico { font-size:48px; margin-bottom:12px; }
        @media (max-width:700px) {
          .rgfi-grid { grid-template-columns:1fr; }
          .rgfi-detail-grid { grid-template-columns:repeat(2,1fr); }
        }
      `}</style>

      <div className="rgfi-wrap">
        <div className="rgfi-header">
          <div className="rgfi-title">Red <span>GFI</span></div>
          <div className="rgfi-sub">Propiedades compartidas por todos los corredores matriculados</div>
          <div className="rgfi-stats">
            <div className="rgfi-stat">
              <div className="rgfi-stat-n">{items.length}</div>
              <div className="rgfi-stat-l">Propiedades activas</div>
            </div>
            <div className="rgfi-stat">
              <div className="rgfi-stat-n">{new Set(items.map(i => i.perfil_id)).size}</div>
              <div className="rgfi-stat-l">Corredores activos</div>
            </div>
            <div className="rgfi-stat">
              <div className="rgfi-stat-n">{filtrados.length}</div>
              <div className="rgfi-stat-l">Resultados</div>
            </div>
          </div>
        </div>

        <div className="rgfi-filters">
          <input
            className="rgfi-filter-input"
            placeholder="Buscar por tipo, ciudad, zona, corredor..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select className="rgfi-filter-sel" value={filtroOp} onChange={e => setFiltroOp(e.target.value)}>
            <option value="">Todas las operaciones</option>
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
            <option value="temporario">Temporario</option>
            <option value="permuta">Permuta</option>
            <option value="comercial">Comercial</option>
            <option value="campo">Campo</option>
          </select>
          <select className="rgfi-filter-sel" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t}>{t}</option>)}
          </select>
          <select className="rgfi-filter-sel" value={filtroCiudad} onChange={e => setFiltroCiudad(e.target.value)}>
            <option value="">Todas las ciudades</option>
            {CIUDADES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="rgfi-filter-sel" value={filtroDorm} onChange={e => setFiltroDorm(e.target.value)}>
            <option value="">Cualquier dorm.</option>
            <option value="1">1+ dorm.</option>
            <option value="2">2+ dorm.</option>
            <option value="3">3+ dorm.</option>
            <option value="4">4+ dorm.</option>
          </select>
          {(busqueda || filtroOp || filtroTipo || filtroCiudad || filtroDorm) && (
            <button
              onClick={() => { setBusqueda(""); setFiltroOp(""); setFiltroTipo(""); setFiltroCiudad(""); setFiltroDorm(""); }}
              style={{ padding:"8px 12px", background:"rgba(200,0,0,0.1)", border:"1px solid rgba(200,0,0,0.2)", borderRadius:6, color:"#cc0000", fontFamily:"Montserrat,sans-serif", fontSize:11, fontWeight:700, cursor:"pointer" }}
            >
              Limpiar
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.2)" }}>
            <div style={{ width:32, height:32, border:"2px solid rgba(200,0,0,0.2)", borderTopColor:"#cc0000", borderRadius:"50%", animation:"spin 0.7s linear infinite", margin:"0 auto 12px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            Cargando Red GFI...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rgfi-empty">
            <div className="rgfi-empty-ico">🏠</div>
            <div style={{ fontSize:16, fontWeight:600, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>
              {items.length === 0 ? "Aún no hay propiedades en la Red GFI" : "Sin resultados para los filtros seleccionados"}
            </div>
            <div style={{ fontSize:13 }}>
              {items.length === 0
                ? "Los corredores pueden compartir propiedades desde su Cartera → botón \"Red GFI\""
                : "Probá ajustando los filtros de búsqueda"}
            </div>
          </div>
        ) : (
          <div className="rgfi-grid">
            {filtrados.map(item => {
              const foto = (item.fotos ?? [])[0];
              const opColor = OP_COLOR[item.operacion] ?? "#6b7280";
              const opLabel = OP_LABEL[item.operacion] ?? item.operacion;
              const esPropio = item.perfil_id === userId;
              const p = item.perfiles;
              return (
                <div
                  key={item.id}
                  className={`rgfi-card${selectedId === item.id ? " selected" : ""}`}
                  onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                >
                  <div className="rgfi-card-foto">
                    {foto
                      ? <img src={foto} alt={item.nombre_publicante ?? item.tipo_propiedad} loading="lazy" />
                      : <div className="rgfi-card-foto-empty">🏠</div>
                    }
                    <div className="rgfi-op-badge" style={{ background: opColor + "22", color: opColor, border:`1px solid ${opColor}44` }}>{opLabel}</div>
                    {esPropio && <div className="rgfi-my-badge">MI PROPIEDAD</div>}
                  </div>
                  <div className="rgfi-card-body">
                    <div className="rgfi-card-tipo">{item.tipo_propiedad}</div>
                    <div className="rgfi-card-precio">
                      {item.precio ? `${item.moneda} ${fmt(item.precio)}` : "Consultar"}
                    </div>
                    <div className="rgfi-card-loc">
                      📍 {item.ciudad}{item.zona ? ` · ${item.zona}` : ""}
                    </div>
                    <div className="rgfi-card-meta">
                      {item.dormitorios != null && <span className="rgfi-meta-item">🛏 {item.dormitorios}</span>}
                      {item.banos != null && <span className="rgfi-meta-item">🚿 {item.banos}</span>}
                      {item.superficie_cubierta != null && <span className="rgfi-meta-item">📐 {item.superficie_cubierta} m²</span>}
                      {item.superficie_total != null && item.superficie_total !== item.superficie_cubierta && (
                        <span className="rgfi-meta-item">🗺 {item.superficie_total} m² tot.</span>
                      )}
                    </div>
                    <div className="rgfi-chips">
                      {item.apto_credito && <span className="rgfi-chip">Apto crédito</span>}
                      {item.con_cochera && <span className="rgfi-chip">Cochera</span>}
                      {item.barrio_cerrado && <span className="rgfi-chip">B.Cerrado</span>}
                      {item.acepta_mascotas && <span className="rgfi-chip">Mascotas</span>}
                      {item.uso_comercial && <span className="rgfi-chip">Uso comercial</span>}
                      {item.honorario_compartir && item.honorario_compartir !== "No comparte" && (
                        <span className="rgfi-chip" style={{ background:"rgba(234,179,8,0.1)", color:"rgba(234,179,8,0.7)" }}>
                          🤝 {item.honorario_compartir}
                        </span>
                      )}
                    </div>
                    {p && (
                      <div className="rgfi-corredor">
                        <div className="rgfi-corredor-ava">
                          {p.foto_url
                            ? <img src={p.foto_url} alt={p.nombre} />
                            : `${p.nombre?.charAt(0) ?? ""}${p.apellido?.charAt(0) ?? ""}`.toUpperCase()
                          }
                        </div>
                        <div>
                          <div className="rgfi-corredor-nombre">{p.nombre} {p.apellido}</div>
                          <div className="rgfi-corredor-mat">{p.matricula ? `Mat. ${p.matricula}` : "Corredor GFI"}</div>
                        </div>
                      </div>
                    )}
                    <a
                      href={`/red-gfi/ficha/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rgfi-ficha-btn"
                      onClick={e => e.stopPropagation()}
                    >
                      📄 Ver / Compartir ficha anónima
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {selected && (
        <div className="rgfi-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}>
          <div className="rgfi-detail">
            <div className="rgfi-detail-header">
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ background: (OP_COLOR[selected.operacion] ?? "#6b7280") + "22", color: OP_COLOR[selected.operacion] ?? "#6b7280", border:`1px solid ${(OP_COLOR[selected.operacion] ?? "#6b7280")}44`, padding:"2px 8px", borderRadius:4, fontFamily:"Montserrat,sans-serif", fontSize:9, fontWeight:800, letterSpacing:"0.08em" }}>
                    {OP_LABEL[selected.operacion] ?? selected.operacion}
                  </span>
                  {selected.honorario_compartir && selected.honorario_compartir !== "No comparte" && (
                    <span className="rgfi-honor-badge">🤝 Comparte {selected.honorario_compartir}</span>
                  )}
                </div>
                <div style={{ fontFamily:"Montserrat,sans-serif", fontSize:20, fontWeight:800, color:"#fff" }}>
                  {selected.nombre_publicante ?? selected.tipo_propiedad}
                </div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
                  {selected.tipo_propiedad} · {selected.ciudad}{selected.zona ? ` · ${selected.zona}` : ""}
                </div>
              </div>
              <button className="rgfi-detail-close" onClick={() => setSelectedId(null)}>✕</button>
            </div>

            {(selected.fotos ?? []).length > 0 && (
              <div className="rgfi-detail-fotos">
                {selected.fotos!.map((f, i) => (
                  <img key={i} src={f} alt={`Foto ${i + 1}`} />
                ))}
              </div>
            )}

            <div className="rgfi-detail-body">
              {/* Precio */}
              <div className="rgfi-detail-section">
                <div className="rgfi-detail-section-title">Precio</div>
                <div style={{ fontFamily:"Montserrat,sans-serif", fontSize:26, fontWeight:800, color:"#fff" }}>
                  {selected.precio ? `${selected.moneda} ${fmt(selected.precio)}` : "A consultar"}
                </div>
              </div>

              {/* Características */}
              <div className="rgfi-detail-section">
                <div className="rgfi-detail-section-title">Características</div>
                <div className="rgfi-detail-grid">
                  {selected.dormitorios != null && (
                    <div className="rgfi-detail-item">
                      <div className="rgfi-detail-item-label">Dormitorios</div>
                      <div className="rgfi-detail-item-value">{selected.dormitorios}</div>
                    </div>
                  )}
                  {selected.banos != null && (
                    <div className="rgfi-detail-item">
                      <div className="rgfi-detail-item-label">Baños</div>
                      <div className="rgfi-detail-item-value">{selected.banos}</div>
                    </div>
                  )}
                  {selected.superficie_cubierta != null && (
                    <div className="rgfi-detail-item">
                      <div className="rgfi-detail-item-label">Sup. cubierta</div>
                      <div className="rgfi-detail-item-value">{selected.superficie_cubierta} m²</div>
                    </div>
                  )}
                  {selected.superficie_total != null && (
                    <div className="rgfi-detail-item">
                      <div className="rgfi-detail-item-label">Sup. total</div>
                      <div className="rgfi-detail-item-value">{selected.superficie_total} m²</div>
                    </div>
                  )}
                  {selected.antiguedad && (
                    <div className="rgfi-detail-item">
                      <div className="rgfi-detail-item-label">Antigüedad</div>
                      <div className="rgfi-detail-item-value">{selected.antiguedad}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Atributos */}
              <div className="rgfi-chips" style={{ marginBottom:16 }}>
                {selected.apto_credito && <span className="rgfi-chip">✓ Apto crédito</span>}
                {selected.con_cochera && <span className="rgfi-chip">✓ Cochera</span>}
                {selected.barrio_cerrado && <span className="rgfi-chip">✓ B.Cerrado</span>}
                {selected.acepta_mascotas && <span className="rgfi-chip">✓ Mascotas OK</span>}
                {selected.acepta_bitcoin && <span className="rgfi-chip">₿ Bitcoin</span>}
                {selected.uso_comercial && <span className="rgfi-chip">✓ Uso comercial</span>}
              </div>

              {/* Descripción */}
              {selected.descripcion && (
                <div className="rgfi-detail-section">
                  <div className="rgfi-detail-section-title">Descripción</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.6, fontFamily:"Inter,sans-serif", whiteSpace:"pre-wrap" }}>
                    {selected.descripcion}
                  </div>
                </div>
              )}

              {/* Contacto */}
              {selected.perfiles && (
                <div className="rgfi-detail-section">
                  <div className="rgfi-detail-section-title">Contacto</div>
                  <div className="rgfi-contact-card">
                    <div className="rgfi-contact-name">
                      {selected.perfiles.nombre} {selected.perfiles.apellido}
                    </div>
                    <div className="rgfi-contact-mat">
                      {selected.perfiles.matricula ? `Corredor Mat. ${selected.perfiles.matricula}` : "Corredor GFI"}
                    </div>
                    <div className="rgfi-contact-btns">
                      {selected.perfiles.telefono && (
                        <a
                          href={`https://wa.me/${selected.perfiles.telefono.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rgfi-contact-btn rgfi-contact-btn-wa"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      {selected.perfiles.email && (
                        <a
                          href={`mailto:${selected.perfiles.email}`}
                          className="rgfi-contact-btn rgfi-contact-btn-mail"
                        >
                          ✉ Email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Ficha anónima */}
              <div className="rgfi-detail-section">
                <div className="rgfi-detail-section-title">Ficha para compartir</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <a
                    href={`/red-gfi/ficha/${selected.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rgfi-contact-btn rgfi-contact-btn-ficha"
                  >
                    📄 Ver ficha anónima
                  </a>
                  <button
                    className="rgfi-contact-btn rgfi-contact-btn-ficha"
                    style={{ cursor:"pointer" }}
                    onClick={() => copiarFicha(selected.id, { stopPropagation: () => {} } as React.MouseEvent)}
                  >
                    {copiado === selected.id ? "✓ Enlace copiado" : "🔗 Copiar enlace de ficha"}
                  </button>
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", marginTop:8 }}>
                  La ficha no revela datos de la inmobiliaria. Podés enviarla a cualquier colega de la red.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
