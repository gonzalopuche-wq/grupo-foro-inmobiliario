"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Noticia {
  id: string;
  titulo: string;
  cuerpo: string;
  link: string | null;
  imagen_url: string | null;
  fuente: string | null;
  destacado: boolean;
  created_at: string;
  perfiles?: { nombre: string; apellido: string } | null;
}

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

const formatFechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

export default function NoticiasWidget() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [activa, setActiva] = useState<Noticia | null>(null);

  useEffect(() => {
    supabase
      .from("noticias")
      .select("*, perfiles!noticias_autor_id_fkey(nombre, apellido)")
      .eq("estado", "aprobada")
      .order("destacado", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setNoticias((data as unknown as Noticia[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading || noticias.length === 0) return null;

  return (
    <>
      <style>{`
        .nw-section { margin-bottom: 20px; }
        .nw-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .nw-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .nw-ver-todas { font-size: 10px; color: rgba(200,0,0,0.7); font-family: 'Montserrat', sans-serif; font-weight: 700; text-decoration: none; letter-spacing: 0.08em; }
        .nw-ver-todas:hover { color: #cc0000; }
        .nw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .nw-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; }
        .nw-card:hover { border-color: rgba(200,0,0,0.25); transform: translateY(-2px); }
        .nw-card.destacada { border-color: rgba(234,179,8,0.2); }
        .nw-card-img { width: 100%; height: 110px; object-fit: cover; background: rgba(200,0,0,0.06); display: block; }
        .nw-card-img-placeholder { width: 100%; height: 80px; background: rgba(200,0,0,0.06); display: flex; align-items: center; justify-content: center; font-size: 24px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .nw-card-body { padding: 12px 14px; flex: 1; display: flex; flex-direction: column; gap: 5px; }
        .nw-card-fuente { font-size: 9px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
        .nw-card-titulo { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; color: #fff; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .nw-card-meta { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: auto; padding-top: 6px; display: flex; gap: 6px; align-items: center; }
        .nw-dest-badge { font-size: 8px; background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.25); color: #eab308; padding: 1px 5px; border-radius: 3px; font-family: 'Montserrat', sans-serif; font-weight: 700; }

        /* Modal */
        .nw-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; }
        .nw-modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.2); border-radius: 8px; width: 100%; max-width: 640px; max-height: 85vh; overflow-y: auto; position: relative; }
        .nw-modal::-webkit-scrollbar { width: 4px; }
        .nw-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .nw-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .nw-modal-img { width: 100%; height: 220px; object-fit: cover; border-radius: 8px 8px 0 0; display: block; }
        .nw-modal-body { padding: 24px 28px; }
        .nw-modal-fuente { font-size: 10px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .nw-modal-titulo { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1.3; margin-bottom: 10px; }
        .nw-modal-meta { font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 18px; display: flex; gap: 10px; flex-wrap: wrap; }
        .nw-modal-cuerpo { font-size: 14px; color: rgba(255,255,255,0.75); line-height: 1.8; font-family: 'Inter', sans-serif; white-space: pre-wrap; word-break: break-word; }
        .nw-modal-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; padding: 9px 16px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 4px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: all 0.15s; }
        .nw-modal-link:hover { background: rgba(200,0,0,0.15); color: #fff; }
        .nw-modal-cerrar { position: absolute; top: 12px; right: 14px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 30px; height: 30px; color: rgba(255,255,255,0.6); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; transition: all 0.15s; }
        .nw-modal-cerrar:hover { background: rgba(200,0,0,0.3); color: #fff; border-color: rgba(200,0,0,0.4); }
      `}</style>

      <div className="nw-section">
        <div className="nw-header">
          <span className="nw-titulo">Noticias del Sector</span>
          <a href="/noticias" className="nw-ver-todas">Ver todas →</a>
        </div>
        <div className="nw-grid">
          {noticias.map(n => (
            <div key={n.id} className={`nw-card${n.destacado ? " destacada" : ""}`} onClick={() => setActiva(n)}>
              {n.imagen_url
                ? <img src={n.imagen_url} alt="" className="nw-card-img" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                : <div className="nw-card-img-placeholder">📰</div>
              }
              <div className="nw-card-body">
                {n.fuente && <div className="nw-card-fuente">{n.fuente}</div>}
                <div className="nw-card-titulo">{n.titulo}</div>
                <div className="nw-card-meta">
                  {n.destacado && <span className="nw-dest-badge">★ Dest.</span>}
                  <span>{formatFechaCorta(n.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {activa && (
        <div className="nw-modal-bg" onClick={e => { if (e.target === e.currentTarget) setActiva(null); }}>
          <div className="nw-modal">
            <button className="nw-modal-cerrar" onClick={() => setActiva(null)}>×</button>
            {activa.imagen_url && (
              <img src={activa.imagen_url} alt="" className="nw-modal-img"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div className="nw-modal-body">
              {activa.fuente && <div className="nw-modal-fuente">{activa.fuente}</div>}
              <div className="nw-modal-titulo">{activa.titulo}</div>
              <div className="nw-modal-meta">
                <span>{formatFecha(activa.created_at)}</span>
                {activa.perfiles && <span>· {activa.perfiles.nombre} {activa.perfiles.apellido}</span>}
                {activa.destacado && <span className="nw-dest-badge">★ Destacada</span>}
              </div>
              <div className="nw-modal-cuerpo">{activa.cuerpo}</div>
              {activa.link && (
                <a href={activa.link} target="_blank" rel="noopener noreferrer" className="nw-modal-link">
                  🔗 Ver fuente original
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
