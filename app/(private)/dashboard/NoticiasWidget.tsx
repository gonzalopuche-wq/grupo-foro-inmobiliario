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
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
}

const CATEGORIAS_SUGERIDAS = ["Mercado", "Normativa", "COCIR", "Tecnología", "Economía", "General"];

export default function NoticiasWidget() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: "", cuerpo: "", link: "", imagen_url: "", fuente: "" });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
      await cargarNoticias();
    };
    init();
  }, []);

  const cargarNoticias = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("noticias")
      .select("*, perfiles(nombre, apellido, matricula)")
      .eq("estado", "aprobado")
      .order("destacado", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(9);
    setNoticias((data as unknown as Noticia[]) ?? []);
    setLoading(false);
  };

  const publicar = async () => {
    setError("");
    if (!form.titulo.trim() || !form.cuerpo.trim()) {
      setError("Título y contenido son obligatorios.");
      return;
    }
    if (!userId) return;
    setEnviando(true);
    const { error: err } = await supabase.from("noticias").insert({
      autor_id: userId,
      titulo: form.titulo.trim(),
      cuerpo: form.cuerpo.trim(),
      link: form.link.trim() || null,
      imagen_url: form.imagen_url.trim() || null,
      fuente: form.fuente.trim() || null,
      estado: "pendiente",
    });
    setEnviando(false);
    if (err) { setError("Error al publicar. Intentá de nuevo."); return; }
    setEnviado(true);
    setForm({ titulo: "", cuerpo: "", link: "", imagen_url: "", fuente: "" });
    setTimeout(() => { setEnviado(false); setMostrarForm(false); }, 2500);
  };

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

  const dominio = (url: string | null) => {
    if (!url) return null;
    try { return new URL(url).hostname.replace("www.", ""); } catch { return null; }
  };

  if (loading) return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Noticias del Foro</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: 120, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ padding: "12px 14px" }}>
              <div style={{ height: 12, background: "rgba(255,255,255,0.06)", borderRadius: 3, marginBottom: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 10, width: "60%", background: "rgba(255,255,255,0.04)", borderRadius: 3, animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .not-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .not-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; cursor: pointer; transition: all 0.2s; text-decoration: none; display: flex; flex-direction: column; }
        .not-card:hover { border-color: rgba(200,0,0,0.3); transform: translateY(-2px); }
        .not-card.dest { border-color: rgba(200,0,0,0.2); background: rgba(200,0,0,0.03); }
        .not-img { width: 100%; height: 130px; object-fit: cover; display: block; background: rgba(255,255,255,0.04); }
        .not-img-placeholder { width: 100%; height: 130px; background: linear-gradient(135deg, rgba(200,0,0,0.08), rgba(14,14,14,0.9)); display: flex; align-items: center; justify-content: center; font-size: 28px; }
        .not-body { padding: 12px 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .not-titulo { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .not-cuerpo { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
        .not-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
        .not-fecha { font-size: 9px; color: rgba(255,255,255,0.25); }
        .not-fuente { font-size: 9px; color: rgba(200,0,0,0.6); font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.08em; }
        .not-dest-badge { font-size: 8px; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #eab308; background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.2); padding: 1px 6px; border-radius: 10px; }
        .not-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 24px; }
        .not-modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.25); border-radius: 8px; padding: 28px 32px; width: 100%; max-width: 540px; position: relative; }
        .not-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .not-modal-title { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .not-modal-title span { color: #cc0000; }
        .not-modal-sub { font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 20px; }
        .not-field { margin-bottom: 12px; }
        .not-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 5px; font-family: 'Montserrat', sans-serif; }
        .not-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; box-sizing: border-box; }
        .not-input:focus { border-color: rgba(200,0,0,0.4); }
        .not-input::placeholder { color: rgba(255,255,255,0.2); }
        .not-textarea { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; resize: vertical; min-height: 80px; transition: border-color 0.2s; box-sizing: border-box; }
        .not-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .not-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .not-hint { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 4px; }
        .not-paste-btns { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
        .not-paste-btn { padding: 5px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.5); font-size: 10px; cursor: pointer; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.08em; transition: all 0.15s; }
        .not-paste-btn:hover { border-color: rgba(255,255,255,0.25); color: #fff; background: rgba(255,255,255,0.07); }
        .not-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.07); border: 1px solid rgba(200,0,0,0.18); border-radius: 3px; padding: 8px 12px; margin-bottom: 12px; }
        .not-ok { font-size: 13px; color: #22c55e; background: rgba(34,197,94,0.07); border: 1px solid rgba(34,197,94,0.2); border-radius: 3px; padding: 12px; text-align: center; font-family: 'Montserrat', sans-serif; font-weight: 700; }
        .not-actions { display: flex; gap: 10px; margin-top: 16px; justify-content: flex-end; }
        .not-btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .not-btn-publicar { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .not-btn-publicar:hover:not(:disabled) { background: #e60000; }
        .not-btn-publicar:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 900px) { .not-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .not-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
            Noticias del Foro
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {noticias.length > 0 && (
              <a href="/noticias" style={{ fontSize: 9, padding: "3px 8px", background: "rgba(200,0,0,0.15)", border: "1px solid rgba(200,0,0,0.3)", borderRadius: 20, color: "#cc0000", textDecoration: "none", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Ver todas
              </a>
            )}
            <button
              onClick={() => setMostrarForm(true)}
              style={{ padding: "5px 12px", background: "#cc0000", border: "none", borderRadius: 4, color: "#fff", fontFamily: "Montserrat, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
            >
              + Publicar
            </button>
          </div>
        </div>

        {noticias.length === 0 ? (
          <div style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>📰</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
              No hay noticias todavía. ¡Publicá la primera!
            </div>
          </div>
        ) : (
          <div className="not-grid">
            {noticias.map(n => (
              <a
                key={n.id}
                href={n.link ?? "#"}
                target={n.link ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className={`not-card${n.destacado ? " dest" : ""}`}
                onClick={e => { if (!n.link) e.preventDefault(); }}
              >
                {n.imagen_url ? (
                  <img className="not-img" src={n.imagen_url} alt={n.titulo} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="not-img-placeholder">📰</div>
                )}
                <div className="not-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    {n.destacado && <span className="not-dest-badge">⭐ Destacado</span>}
                  </div>
                  <div className="not-titulo">{n.titulo}</div>
                  <div className="not-cuerpo">{n.cuerpo}</div>
                  <div className="not-footer">
                    <span className="not-fecha">{formatFecha(n.created_at)}</span>
                    <span className="not-fuente">
                      {n.fuente ?? (n.link ? dominio(n.link) : n.perfiles ? `${n.perfiles.nombre} ${n.perfiles.apellido}` : "GFI®")}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {mostrarForm && (
        <div className="not-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="not-modal">
            <div className="not-modal-title">Publicar <span>noticia</span></div>
            <div className="not-modal-sub">Va a revisión del admin antes de publicarse. Podés pegar texto de WhatsApp o Telegram directo.</div>

            {enviado ? (
              <div className="not-ok">✓ Enviado para revisión. El admin la aprobará pronto.</div>
            ) : (
              <>
                <div className="not-paste-btns">
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat, sans-serif", display: "flex", alignItems: "center" }}>Pegá desde:</span>
                  {["WhatsApp 💬", "Telegram ✈️", "Web 🌐"].map(s => (
                    <button key={s} className="not-paste-btn">{s}</button>
                  ))}
                </div>

                <div className="not-field">
                  <label className="not-label">Título *</label>
                  <input className="not-input" placeholder="Título de la noticia..." value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
                </div>

                <div className="not-field">
                  <label className="not-label">Contenido *</label>
                  <textarea className="not-textarea" placeholder="Pegá el texto de WhatsApp, Telegram, o escribí el contenido..." value={form.cuerpo} onChange={e => setForm(f => ({ ...f, cuerpo: e.target.value }))} style={{ minHeight: 100 }} />
                  <div className="not-hint">Podés pegar texto plano directamente desde WhatsApp o Telegram.</div>
                </div>

                <div className="not-field">
                  <label className="not-label">Link (opcional)</label>
                  <input className="not-input" placeholder="https://..." value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="not-field">
                    <label className="not-label">Imagen URL (opcional)</label>
                    <input className="not-input" placeholder="https://imagen.jpg" value={form.imagen_url} onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))} />
                  </div>
                  <div className="not-field">
                    <label className="not-label">Fuente (opcional)</label>
                    <input className="not-input" placeholder="Ej: Infobae, COCIR..." value={form.fuente} onChange={e => setForm(f => ({ ...f, fuente: e.target.value }))} />
                  </div>
                </div>

                {error && <div className="not-error">{error}</div>}

                <div className="not-actions">
                  <button className="not-btn-cancel" onClick={() => { setMostrarForm(false); setError(""); }}>Cancelar</button>
                  <button className="not-btn-publicar" onClick={publicar} disabled={enviando || !form.titulo.trim() || !form.cuerpo.trim()}>
                    {enviando ? "Enviando..." : "Enviar para revisión"}
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
