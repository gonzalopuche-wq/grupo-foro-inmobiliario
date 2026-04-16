"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Enlace {
  id: string;
  nombre: string;
  descripcion: string;
  url: string;
  categoria: string;
  localidad: string | null;
  destacado: boolean;
  orden: number;
}

const CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "padron", label: "Padrón y Colegios" },
  { id: "impuestos", label: "Impuestos Provinciales" },
  { id: "catastro", label: "Catastro y Registro" },
  { id: "tasas", label: "Tasas Municipales" },
  { id: "servicios", label: "Servicios Públicos" },
  { id: "tramites", label: "Trámites y Portales" },
];

const LOCALIDADES = ["Todas", "Rosario", "Funes", "Roldán", "Villa Constitución"];

export default function EnlacesPage() {
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [catActiva, setCatActiva] = useState("todos");
  const [localidad, setLocalidad] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarSugerencia, setMostrarSugerencia] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [formSug, setFormSug] = useState({ nombre: "", url: "", descripcion: "", categoria: "" });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    };
    init();
    cargarEnlaces();
  }, []);

  const cargarEnlaces = async () => {
    setLoading(true);
    const { data } = await supabase.from("enlaces_utiles").select("*").eq("activo", true).order("orden");
    setEnlaces((data as Enlace[]) ?? []);
    setLoading(false);
  };

  const enviarSugerencia = async () => {
    if (!userId || !formSug.nombre || !formSug.url) return;
    setEnviando(true);
    await supabase.from("enlaces_sugerencias").insert({
      perfil_id: userId, nombre: formSug.nombre, url: formSug.url,
      descripcion: formSug.descripcion || null, categoria: formSug.categoria || null,
    });
    setEnviando(false);
    setEnviado(true);
    setFormSug({ nombre: "", url: "", descripcion: "", categoria: "" });
    setTimeout(() => { setEnviado(false); setMostrarSugerencia(false); }, 2000);
  };

  const filtrados = enlaces.filter(e => {
    if (catActiva !== "todos" && e.categoria !== catActiva) return false;
    if (localidad !== "Todas" && e.localidad !== localidad) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      if (!e.nombre.toLowerCase().includes(q) && !e.descripcion?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const destacados = filtrados.filter(e => e.destacado);
  const resto = filtrados.filter(e => !e.destacado);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .enl-layout { display: grid; grid-template-columns: 200px 1fr; gap: 24px; align-items: start; }
        .enl-side { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 80px; }
        .enl-side-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .enl-side-title { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .enl-side-item { padding: 9px 14px; cursor: pointer; transition: all 0.15s; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; color: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: space-between; }
        .enl-side-item:last-child { border-bottom: none; }
        .enl-side-item:hover { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.8); }
        .enl-side-item.active { background: rgba(200,0,0,0.08); color: #fff; border-left: 2px solid #cc0000; font-weight: 600; }
        .enl-side-count { font-size: 9px; color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 10px; font-family: 'Montserrat',sans-serif; }
        .enl-main { display: flex; flex-direction: column; gap: 16px; }
        .enl-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .enl-search { flex: 1; position: relative; min-width: 200px; }
        .enl-search input { width: 100%; padding: 9px 14px 9px 34px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter',sans-serif; }
        .enl-search input:focus { border-color: rgba(200,0,0,0.4); }
        .enl-search input::placeholder { color: rgba(255,255,255,0.2); }
        .enl-search-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 12px; color: rgba(255,255,255,0.3); }
        .enl-loc-select { padding: 9px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; outline: none; font-family: 'Inter',sans-serif; cursor: pointer; }
        .enl-btn-sugerir { padding: 9px 16px; background: transparent; border: 1px solid rgba(200,0,0,0.3); border-radius: 4px; color: #cc0000; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .enl-btn-sugerir:hover { background: rgba(200,0,0,0.1); }
        .enl-count { font-size: 11px; color: rgba(255,255,255,0.25); white-space: nowrap; }
        .enl-seccion-titulo { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 8px; }
        .enl-seccion-titulo::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .enl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .enl-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s; text-decoration: none; }
        .enl-card:hover { border-color: rgba(200,0,0,0.3); background: rgba(14,14,14,1); transform: translateY(-1px); }
        .enl-card.dest { border-color: rgba(200,0,0,0.2); background: rgba(200,0,0,0.03); }
        .enl-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .enl-card-nombre { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #fff; line-height: 1.4; flex: 1; }
        .enl-card-star { font-size: 11px; color: #eab308; flex-shrink: 0; }
        .enl-card-desc { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.5; flex: 1; }
        .enl-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
        .enl-cat-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; }
        .enl-loc-badge { font-size: 9px; color: rgba(255,255,255,0.25); }
        .enl-arrow { font-size: 12px; color: rgba(200,0,0,0.4); transition: color 0.15s; }
        .enl-card:hover .enl-arrow { color: #cc0000; }
        .enl-skeleton { background: rgba(255,255,255,0.06); border-radius: 4px; animation: skp 1.5s ease-in-out infinite; display: block; }
        @keyframes skp { 0%,100%{opacity:0.4}50%{opacity:0.8} }
        .enl-empty { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .enl-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 24px; }
        .enl-modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.25); border-radius: 6px; padding: 28px 32px; width: 100%; max-width: 480px; position: relative; }
        .enl-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .enl-modal-title { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .enl-modal-title span { color: #cc0000; }
        .enl-field { margin-bottom: 12px; }
        .enl-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .enl-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; transition: border-color 0.2s; }
        .enl-input:focus { border-color: rgba(200,0,0,0.4); }
        .enl-input::placeholder { color: rgba(255,255,255,0.2); }
        .enl-select { width: 100%; padding: 9px 12px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .enl-modal-actions { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }
        .enl-btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .enl-btn-enviar { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .enl-btn-enviar:hover:not(:disabled) { background: #e60000; }
        .enl-btn-enviar:disabled { opacity: 0.6; cursor: not-allowed; }
        .enl-enviado { text-align: center; padding: 20px; color: #22c55e; font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; }
        @media (max-width: 900px) { .enl-layout { grid-template-columns: 1fr; } .enl-side { position: static; flex-direction: row; overflow-x: auto; } .enl-side-box { min-width: 160px; } }
        @media (max-width: 600px) { .enl-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="enl-layout">
        <aside className="enl-side">
          <div className="enl-side-box">
            <div className="enl-side-title">Categorías</div>
            {CATEGORIAS.map(c => {
              const count = c.id === "todos" ? enlaces.length : enlaces.filter(e => e.categoria === c.id).length;
              return (
                <div key={c.id} className={`enl-side-item${catActiva === c.id ? " active" : ""}`} onClick={() => setCatActiva(c.id)}>
                  <span>{c.label}</span>
                  <span className="enl-side-count">{count}</span>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="enl-main">
          <div className="enl-topbar">
            <div className="enl-search">
              <span className="enl-search-ico">🔍</span>
              <input placeholder="Buscar enlaces..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <select className="enl-loc-select" value={localidad} onChange={e => setLocalidad(e.target.value)}>
              {LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button className="enl-btn-sugerir" onClick={() => setMostrarSugerencia(true)}>+ Sugerir enlace</button>
            <span className="enl-count">{filtrados.length} enlaces</span>
          </div>

          {loading ? (
            <div className="enl-grid">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="enl-card">
                  <span className="enl-skeleton" style={{height:14,width:"70%"}}/>
                  <span className="enl-skeleton" style={{height:11,width:"100%",marginTop:4}}/>
                  <span className="enl-skeleton" style={{height:11,width:"80%"}}/>
                </div>
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="enl-empty">No hay enlaces con esos filtros.</div>
          ) : (
            <>
              {destacados.length > 0 && (
                <>
                  <div className="enl-seccion-titulo">⭐ Más usados</div>
                  <div className="enl-grid">
                    {destacados.map(e => (
                      <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="enl-card dest">
                        <div className="enl-card-top">
                          <div className="enl-card-nombre">{e.nombre}</div>
                          <span className="enl-card-star">★</span>
                        </div>
                        <div className="enl-card-desc">{e.descripcion}</div>
                        <div className="enl-card-footer">
                          <span className="enl-cat-badge">{CATEGORIAS.find(c => c.id === e.categoria)?.label}</span>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {e.localidad && <span className="enl-loc-badge">📍 {e.localidad}</span>}
                            <span className="enl-arrow">↗</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </>
              )}
              {resto.length > 0 && (
                <>
                  {destacados.length > 0 && <div className="enl-seccion-titulo">Todos los enlaces</div>}
                  <div className="enl-grid">
                    {resto.map(e => (
                      <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="enl-card">
                        <div className="enl-card-top">
                          <div className="enl-card-nombre">{e.nombre}</div>
                        </div>
                        <div className="enl-card-desc">{e.descripcion}</div>
                        <div className="enl-card-footer">
                          <span className="enl-cat-badge">{CATEGORIAS.find(c => c.id === e.categoria)?.label}</span>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {e.localidad && <span className="enl-loc-badge">📍 {e.localidad}</span>}
                            <span className="enl-arrow">↗</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {mostrarSugerencia && (
        <div className="enl-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarSugerencia(false); }}>
          <div className="enl-modal">
            <div className="enl-modal-title">Sugerir <span>enlace</span></div>
            {enviado ? (
              <div className="enl-enviado">✓ Sugerencia enviada. El admin la revisará.</div>
            ) : (
              <>
                <div className="enl-field">
                  <label className="enl-label">Nombre *</label>
                  <input className="enl-input" placeholder="Ej: Catastro Municipal de Rosario" value={formSug.nombre} onChange={e => setFormSug(f => ({...f, nombre: e.target.value}))} />
                </div>
                <div className="enl-field">
                  <label className="enl-label">URL *</label>
                  <input className="enl-input" placeholder="https://..." value={formSug.url} onChange={e => setFormSug(f => ({...f, url: e.target.value}))} />
                </div>
                <div className="enl-field">
                  <label className="enl-label">Descripción</label>
                  <input className="enl-input" placeholder="¿Para qué sirve?" value={formSug.descripcion} onChange={e => setFormSug(f => ({...f, descripcion: e.target.value}))} />
                </div>
                <div className="enl-field">
                  <label className="enl-label">Categoría</label>
                  <select className="enl-select" value={formSug.categoria} onChange={e => setFormSug(f => ({...f, categoria: e.target.value}))}>
                    <option value="">Sin categoría</option>
                    {CATEGORIAS.filter(c => c.id !== "todos").map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="enl-modal-actions">
                  <button className="enl-btn-cancel" onClick={() => setMostrarSugerencia(false)}>Cancelar</button>
                  <button className="enl-btn-enviar" onClick={enviarSugerencia} disabled={enviando || !formSug.nombre || !formSug.url}>
                    {enviando ? "Enviando..." : "Enviar sugerencia"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
