"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Noticia {
  id: string;
  autor_id: string | null;
  titulo: string;
  cuerpo: string;
  link: string | null;
  imagen_url: string | null;
  fuente: string | null;
  destacado: boolean;
  created_at: string;
  perfiles?: { nombre: string; apellido: string } | null;
}

interface Props {
  userId: string | null;
}

const FORM_VACIO = { titulo: "", cuerpo: "", link: "", imagen_url: "", fuente: "" };

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

export default function NoticiasForoSection({ userId }: Props) {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [activa, setActiva] = useState<Noticia | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    const { data } = await supabase
      .from("noticias")
      .select("*, perfiles!noticias_autor_id_fkey(nombre, apellido)")
      .eq("estado", "aprobada")
      .order("destacado", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
    setNoticias((data as unknown as Noticia[]) ?? []);
    setLoading(false);
  };

  const guardar = async () => {
    if (!userId || !form.titulo.trim() || !form.cuerpo.trim()) return;
    setGuardando(true);
    await supabase.from("noticias").insert({
      autor_id: userId,
      titulo: form.titulo.trim(),
      cuerpo: form.cuerpo.trim(),
      link: form.link.trim() || null,
      imagen_url: form.imagen_url.trim() || null,
      fuente: form.fuente.trim() || null,
      estado: "pendiente",
    });
    setGuardando(false);
    setForm(FORM_VACIO);
    setMostrarForm(false);
    setOk(true);
    setTimeout(() => setOk(false), 4000);
  };

  return (
    <>
      <style>{`
        .nf-topbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .nf-btn-nueva { padding: 9px 18px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .nf-btn-nueva:hover { background: #e60000; }
        .nf-ok { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); border-radius: 6px; padding: 10px 16px; font-size: 12px; color: #4ade80; font-family: 'Inter', sans-serif; }
        .nf-item { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; cursor: pointer; transition: all 0.2s; display: flex; gap: 14px; }
        .nf-item:hover { border-color: rgba(200,0,0,0.2); }
        .nf-item.dest { border-color: rgba(234,179,8,0.2); }
        .nf-item-img { width: 80px; height: 80px; border-radius: 5px; object-fit: cover; flex-shrink: 0; background: rgba(200,0,0,0.06); }
        .nf-item-placeholder { width: 80px; height: 80px; border-radius: 5px; background: rgba(200,0,0,0.06); border: 1px solid rgba(200,0,0,0.12); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 28px; }
        .nf-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
        .nf-item-fuente { font-size: 9px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
        .nf-item-titulo { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: #fff; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .nf-item-cuerpo { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .nf-item-meta { font-size: 10px; color: rgba(255,255,255,0.25); display: flex; gap: 8px; align-items: center; margin-top: auto; }
        .nf-dest-badge { font-size: 8px; background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.25); color: #eab308; padding: 1px 5px; border-radius: 3px; font-family: 'Montserrat', sans-serif; font-weight: 700; }
        .nf-empty { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }

        /* Modal */
        .nf-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; }
        .nf-modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.2); border-radius: 8px; width: 100%; max-width: 640px; max-height: 85vh; overflow-y: auto; position: relative; }
        .nf-modal::-webkit-scrollbar { width: 4px; }
        .nf-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .nf-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .nf-modal-img { width: 100%; height: 220px; object-fit: cover; border-radius: 8px 8px 0 0; display: block; }
        .nf-modal-body { padding: 24px 28px; }
        .nf-modal-fuente { font-size: 10px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .nf-modal-titulo { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1.3; margin-bottom: 10px; }
        .nf-modal-meta { font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 18px; }
        .nf-modal-cuerpo { font-size: 14px; color: rgba(255,255,255,0.75); line-height: 1.8; font-family: 'Inter', sans-serif; white-space: pre-wrap; word-break: break-word; }
        .nf-modal-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; padding: 9px 16px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 4px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; text-decoration: none; transition: all 0.15s; }
        .nf-modal-link:hover { background: rgba(200,0,0,0.15); color: #fff; }
        .nf-modal-cerrar { position: absolute; top: 12px; right: 14px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 30px; height: 30px; color: rgba(255,255,255,0.6); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; }
        .nf-modal-cerrar:hover { background: rgba(200,0,0,0.3); color: #fff; }

        /* Form */
        .nf-form { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 24px; }
        .nf-form-title { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 16px; }
        .nf-form-title span { color: #cc0000; }
        .nf-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat', sans-serif; }
        .nf-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; margin-bottom: 12px; }
        .nf-input:focus { border-color: rgba(200,0,0,0.5); }
        .nf-input::placeholder { color: rgba(255,255,255,0.2); }
        .nf-textarea { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 100px; font-family: 'Inter', sans-serif; margin-bottom: 12px; }
        .nf-textarea:focus { border-color: rgba(200,0,0,0.5); }
        .nf-aviso { font-size: 11px; color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; padding: 8px 12px; margin-bottom: 14px; }
        .nf-form-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .nf-btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .nf-btn-submit { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .nf-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .nf-spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: nf-spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes nf-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Header */}
        <div className="nf-topbar">
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
            Noticias del sector
          </div>
          <button className="nf-btn-nueva" onClick={() => setMostrarForm(v => !v)}>
            {mostrarForm ? "Cancelar" : "+ Sugerir noticia"}
          </button>
        </div>

        {ok && (
          <div className="nf-ok">
            ✓ Tu noticia fue enviada y quedará pendiente de aprobación.
          </div>
        )}

        {/* Form */}
        {mostrarForm && (
          <div className="nf-form">
            <div className="nf-form-title">Sugerir <span>noticia</span></div>
            <label className="nf-label">Título *</label>
            <input className="nf-input" placeholder="Título de la noticia" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} />
            <label className="nf-label">Contenido *</label>
            <textarea className="nf-textarea" placeholder="Resumí la noticia..." value={form.cuerpo} onChange={e => setForm(p => ({ ...p, cuerpo: e.target.value }))} />
            <label className="nf-label">Fuente</label>
            <input className="nf-input" placeholder="Ej: Infobae, La Nación, COCIR..." value={form.fuente} onChange={e => setForm(p => ({ ...p, fuente: e.target.value }))} />
            <label className="nf-label">Link externo</label>
            <input className="nf-input" placeholder="https://..." value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} />
            <label className="nf-label">URL de imagen (opcional)</label>
            <input className="nf-input" placeholder="https://imagen.jpg" value={form.imagen_url} onChange={e => setForm(p => ({ ...p, imagen_url: e.target.value }))} />
            <div className="nf-aviso">Tu sugerencia quedará pendiente de aprobación por el admin antes de publicarse.</div>
            <div className="nf-form-actions">
              <button className="nf-btn-cancel" onClick={() => { setMostrarForm(false); setForm(FORM_VACIO); }}>Cancelar</button>
              <button className="nf-btn-submit" onClick={guardar} disabled={guardando || !form.titulo.trim() || !form.cuerpo.trim()}>
                {guardando && <span className="nf-spinner" />}
                {guardando ? "Enviando..." : "Enviar sugerencia"}
              </button>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="nf-empty">Cargando...</div>
        ) : noticias.length === 0 ? (
          <div className="nf-empty">No hay noticias publicadas todavía.</div>
        ) : (
          noticias.map(n => (
            <div key={n.id} className={`nf-item${n.destacado ? " dest" : ""}`} onClick={() => setActiva(n)}>
              {n.imagen_url
                ? <img src={n.imagen_url} alt="" className="nf-item-img" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                : <div className="nf-item-placeholder">📰</div>
              }
              <div className="nf-item-info">
                {n.fuente && <div className="nf-item-fuente">{n.fuente}</div>}
                <div className="nf-item-titulo">{n.titulo}</div>
                <div className="nf-item-cuerpo">{n.cuerpo}</div>
                <div className="nf-item-meta">
                  {n.destacado && <span className="nf-dest-badge">★ Destacada</span>}
                  <span>{formatFecha(n.created_at)}</span>
                  {n.perfiles && <span>· {n.perfiles.nombre} {n.perfiles.apellido}</span>}
                  {n.link && <span style={{ color: "#60a5fa" }}>🔗 Ver fuente</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal detalle */}
      {activa && (
        <div className="nf-modal-bg" onClick={e => { if (e.target === e.currentTarget) setActiva(null); }}>
          <div className="nf-modal">
            <button className="nf-modal-cerrar" onClick={() => setActiva(null)}>×</button>
            {activa.imagen_url && (
              <img src={activa.imagen_url} alt="" className="nf-modal-img"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div className="nf-modal-body">
              {activa.fuente && <div className="nf-modal-fuente">{activa.fuente}</div>}
              <div className="nf-modal-titulo">{activa.titulo}</div>
              <div className="nf-modal-meta">
                {formatFecha(activa.created_at)}
                {activa.perfiles && ` · ${activa.perfiles.nombre} ${activa.perfiles.apellido}`}
              </div>
              <div className="nf-modal-cuerpo">{activa.cuerpo}</div>
              {activa.link && (
                <a href={activa.link} target="_blank" rel="noopener noreferrer" className="nf-modal-link">
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
