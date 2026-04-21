"use client";

import { useEffect, useState, useRef } from "react";
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

export default function NoticiasWidget() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [link, setLink] = useState("");
  const [fuente, setFuente] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [tituloAuto, setTituloAuto] = useState(false);
  const [linkAuto, setLinkAuto] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        const { data: p } = await supabase
          .from("perfiles")
          .select("tipo")
          .eq("id", data.user.id)
          .single();
        if (p?.tipo === "admin") setEsAdmin(true);
      }
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

  const extraerLink = (texto: string): string => {
    const match = texto.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : "";
  };

  const handlePegadoTexto = (texto: string) => {
    const linkDetectado = extraerLink(texto);
    const cuerpoSinLink = texto.replace(linkDetectado, "").trim();
    const primeraLinea = cuerpoSinLink
      .split("\n")
      .map(l => l.replace(/[\u{1F300}-\u{1FAFF}🚨⚠️📅📍💻🎙️🔗📌❗]/gu, "").replace(/^[*_~`•\-\s]+/, "").trim())
      .find(l => l.length > 8) ?? "";
    const tituloSugerido = primeraLinea.slice(0, 120);

    setCuerpo(prev => prev ? prev + "\n" + texto : texto);
    if (!link && linkDetectado) { setLink(linkDetectado); setLinkAuto(true); }
    if (!titulo && tituloSugerido) { setTitulo(tituloSugerido); setTituloAuto(true); }
  };

  const subirImagen = async (file: File) => {
    setSubiendo(true);
    const reader = new FileReader();
    reader.onload = (ev) => setImgPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `noticias/${Date.now()}.${ext}`;
      const { error: errUp } = await supabase.storage
        .from("imagenes")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (!errUp) {
        const { data: urlData } = supabase.storage.from("imagenes").getPublicUrl(path);
        setImgUrl(urlData.publicUrl);
      }
    } catch { /* imagen queda solo como preview */ }
    setSubiendo(false);
  };

  const handleAreaPaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imgItem = items.find(i => i.type.startsWith("image/"));
    if (imgItem) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (file) await subirImagen(file);
      const textItem = items.find(i => i.type === "text/plain");
      if (textItem) textItem.getAsString(txt => handlePegadoTexto(txt));
      return;
    }
    const texto = e.clipboardData.getData("text/plain");
    if (texto) { e.preventDefault(); handlePegadoTexto(texto); }
  };

  const publicar = async () => {
    setError("");
    if (!titulo.trim() || !cuerpo.trim()) { setError("Título y contenido son obligatorios."); return; }
    if (!userId) return;
    setEnviando(true);

    // Admin publica directo sin revisión
    const estado = esAdmin ? "aprobado" : "pendiente";
    const ahora = esAdmin ? new Date().toISOString() : null;

    const { error: err } = await supabase.from("noticias").insert({
      autor_id: userId,
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      link: link.trim() || null,
      imagen_url: imgUrl || null,
      fuente: fuente.trim() || null,
      estado,
      aprobado_at: ahora,
      aprobado_por: esAdmin ? userId : null,
    });
    setEnviando(false);
    if (err) { setError("Error al publicar. Intentá de nuevo."); return; }
    setEnviado(true);
    resetForm(false);
    await cargarNoticias();
    setTimeout(() => { setEnviado(false); setMostrarForm(false); }, 2000);
  };

  const resetForm = (cerrar = true) => {
    if (cerrar) setMostrarForm(false);
    setError(""); setTitulo(""); setCuerpo(""); setLink(""); setFuente("");
    setImgUrl(""); setImgPreview(null); setTituloAuto(false); setLinkAuto(false);
  };

  const quitarImagen = () => { setImgUrl(""); setImgPreview(null); };

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
            <div style={{ height: 120, background: "rgba(255,255,255,0.04)" }} />
            <div style={{ padding: "12px 14px" }}>
              <div style={{ height: 12, background: "rgba(255,255,255,0.06)", borderRadius: 3, marginBottom: 6 }} />
              <div style={{ height: 10, width: "60%", background: "rgba(255,255,255,0.04)", borderRadius: 3 }} />
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
        .not-img { width: 100%; height: 130px; object-fit: cover; display: block; }
        .not-img-placeholder { width: 100%; height: 130px; background: linear-gradient(135deg, rgba(200,0,0,0.08), rgba(14,14,14,0.9)); display: flex; align-items: center; justify-content: center; font-size: 28px; }
        .not-body { padding: 12px 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .not-titulo { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; color: #fff; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .not-cuerpo { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
        .not-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
        .not-fecha { font-size: 9px; color: rgba(255,255,255,0.25); }
        .not-fuente { font-size: 9px; color: rgba(200,0,0,0.6); font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.08em; }
        .not-dest-badge { font-size: 8px; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #eab308; background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.2); padding: 1px 6px; border-radius: 10px; }
        .not-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; overflow-y: auto; }
        .not-modal { background: #111; border: 1px solid rgba(200,0,0,0.2); border-radius: 10px; width: 100%; max-width: 560px; position: relative; margin: auto; overflow: hidden; }
        .not-modal-header { padding: 18px 20px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .not-modal-title { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .not-modal-title span { color: #cc0000; }
        .not-modal-sub { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 3px; }
        .not-compose { padding: 0; }
        .not-img-preview-wrap { position: relative; background: #000; }
        .not-img-preview-img { width: 100%; max-height: 260px; object-fit: contain; display: block; }
        .not-img-quitar { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); border: none; border-radius: 50%; width: 28px; height: 28px; color: #fff; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .not-img-uploading { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 13px; color: rgba(255,255,255,0.7); font-family: 'Montserrat', sans-serif; }
        .not-paste-area { padding: 14px 16px; min-height: 120px; background: transparent; border: none; outline: none; color: #fff; font-size: 13px; font-family: 'Inter', sans-serif; line-height: 1.6; width: 100%; box-sizing: border-box; resize: none; }
        .not-paste-area::placeholder { color: rgba(255,255,255,0.2); }
        .not-toolbar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
        .not-toolbar-btn { background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px; color: rgba(255,255,255,0.5); font-size: 16px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
        .not-toolbar-btn:hover { border-color: rgba(255,255,255,0.25); color: #fff; background: rgba(255,255,255,0.05); }
        .not-toolbar-hint { font-size: 10px; color: rgba(255,255,255,0.2); font-family: 'Inter', sans-serif; flex: 1; }
        .not-extras { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 8px; }
        .not-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .not-mini-label { font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 4px; font-family: 'Montserrat', sans-serif; display: block; }
        .not-mini-input { width: 100%; padding: 8px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box; transition: border-color 0.2s; }
        .not-mini-input:focus { border-color: rgba(200,0,0,0.4); }
        .not-mini-input::placeholder { color: rgba(255,255,255,0.18); }
        .not-auto-badge { font-size: 9px; color: #22c55e; margin-top: 3px; }
        .not-modal-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .not-error { font-size: 11px; color: #ff4444; flex: 1; }
        .not-ok { font-size: 12px; color: #22c55e; font-family: 'Montserrat', sans-serif; font-weight: 700; text-align: center; padding: 14px; }
        .not-btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .not-btn-send { padding: 8px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .not-btn-send:hover:not(:disabled) { background: #e60000; }
        .not-btn-send:disabled { opacity: 0.55; cursor: not-allowed; }
        @media (max-width: 900px) { .not-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .not-grid { grid-template-columns: 1fr; } .not-field-row { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── LISTADO ── */}
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
            <button onClick={() => setMostrarForm(true)} style={{ padding: "5px 12px", background: "#cc0000", border: "none", borderRadius: 4, color: "#fff", fontFamily: "Montserrat, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
              + Publicar
            </button>
          </div>
        </div>

        {noticias.length === 0 ? (
          <div style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>📰</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>No hay noticias todavía. ¡Publicá la primera!</div>
          </div>
        ) : (
          <div className="not-grid">
            {noticias.map(n => (
              <a key={n.id} href={n.link ?? "#"} target={n.link ? "_blank" : "_self"} rel="noopener noreferrer"
                className={`not-card${n.destacado ? " dest" : ""}`}
                onClick={e => { if (!n.link) e.preventDefault(); }}>
                {n.imagen_url
                  ? <img className="not-img" src={n.imagen_url} alt={n.titulo} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <div className="not-img-placeholder">📰</div>}
                <div className="not-body">
                  {n.destacado && <span className="not-dest-badge">⭐ Destacado</span>}
                  <div className="not-titulo">{n.titulo}</div>
                  <div className="not-cuerpo">{n.cuerpo}</div>
                  <div className="not-footer">
                    <span className="not-fecha">{formatFecha(n.created_at)}</span>
                    <span className="not-fuente">{n.fuente ?? (n.link ? dominio(n.link) : n.perfiles ? `${n.perfiles.nombre} ${n.perfiles.apellido}` : "GFI®")}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      {mostrarForm && (
        <div className="not-modal-bg" onClick={e => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="not-modal">
            <div className="not-modal-header">
              <div className="not-modal-title">Nueva <span>noticia</span></div>
              <div className="not-modal-sub">
                {esAdmin
                  ? "Se publica directamente sin revisión."
                  : "Va a revisión del admin antes de publicarse. Pegá foto + texto juntos o un link de internet."}
              </div>
            </div>

            {enviado ? (
              <div className="not-ok">
                {esAdmin ? "✓ Noticia publicada." : "✓ Enviado para revisión. El admin la aprobará pronto."}
              </div>
            ) : (
              <>
                <div className="not-compose" onPaste={handleAreaPaste}>
                  {imgPreview && (
                    <div className="not-img-preview-wrap">
                      <img className="not-img-preview-img" src={imgPreview} alt="preview" />
                      {subiendo && <div className="not-img-uploading">⏳ Subiendo imagen...</div>}
                      <button className="not-img-quitar" onClick={quitarImagen}>✕</button>
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    className="not-paste-area"
                    placeholder={"Pegá el texto de WhatsApp, Telegram o un link de internet acá...\n\nTambién podés pegar una foto con Ctrl+V o arrastrarla."}
                    value={cuerpo}
                    onChange={e => setCuerpo(e.target.value)}
                    onPaste={handleAreaPaste}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) subirImagen(f); }}
                    onDragOver={e => e.preventDefault()}
                  />
                  <div className="not-toolbar">
                    <button className="not-toolbar-btn" title="Adjuntar imagen" onClick={() => inputFileRef.current?.click()}>🖼️</button>
                    <span className="not-toolbar-hint">Ctrl+V · arrastrar · o elegir archivo</span>
                    <input ref={inputFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) subirImagen(f); }} />
                  </div>
                </div>

                <div className="not-extras">
                  <div>
                    <label className="not-mini-label">Título *</label>
                    <input className="not-mini-input" placeholder="Título de la noticia..." value={titulo}
                      onChange={e => { setTitulo(e.target.value); setTituloAuto(false); }} />
                    {tituloAuto && titulo && <div className="not-auto-badge">✓ Detectado automáticamente — podés editarlo</div>}
                  </div>
                  <div className="not-field-row">
                    <div>
                      <label className="not-mini-label">Link</label>
                      <input className="not-mini-input" placeholder="https://..." value={link}
                        onChange={e => { setLink(e.target.value); setLinkAuto(false); }} />
                      {linkAuto && link && <div className="not-auto-badge">✓ Detectado del texto</div>}
                    </div>
                    <div>
                      <label className="not-mini-label">Fuente</label>
                      <input className="not-mini-input" placeholder="Ej: COCIR, Infobae..." value={fuente}
                        onChange={e => setFuente(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="not-modal-footer">
                  {error ? <span className="not-error">{error}</span> : <span />}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="not-btn-cancel" onClick={() => resetForm()}>Cancelar</button>
                    <button className="not-btn-send" onClick={publicar}
                      disabled={enviando || subiendo || !titulo.trim() || !cuerpo.trim()}>
                      {enviando ? "Publicando..." : subiendo ? "Subiendo imagen..." : esAdmin ? "Publicar" : "Enviar para revisión"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
