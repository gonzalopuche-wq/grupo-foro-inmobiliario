"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function formatFechaPost(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dia = DIAS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dia} ${dd}/${mm} a las ${hh}:${min}`;
}

function EstadoBadge({ estado }: { estado: string }) {
  const estilos: Record<string, { bg: string; border: string; color: string; label: string }> = {
    programado: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", color: "#60a5fa", label: "Programado" },
    publicado:  { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)",  color: "#22c55e", label: "Publicado" },
    cancelado:  { bg: "rgba(100,100,100,0.12)", border: "rgba(100,100,100,0.3)", color: "#888",   label: "Cancelado" },
  };
  const s = estilos[estado] ?? estilos.cancelado;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 9px",
      borderRadius: 12,
      fontSize: 10,
      fontFamily: "Montserrat,sans-serif",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
    }}>
      {s.label}
    </span>
  );
}

export default function InstagramPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("programado");
  const [form, setForm] = useState({ contenido: "", imagen_url: "", fecha_programada: "", estado: "programado" });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [userId, setUserId] = useState("");
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
    };
    init();
  }, []);

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const cargar = async (uid?: string) => {
    const id = uid || userId;
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_posts_sociales")
      .select("*")
      .eq("perfil_id", id)
      .eq("plataforma", "instagram")
      .order("fecha_programada", { ascending: true });
    if (error) {
      // Table may not exist — show empty state gracefully
      setPosts([]);
    } else {
      setPosts(data ?? []);
    }
    setLoading(false);
  };

  const abrirNuevo = () => {
    setForm({ contenido: "", imagen_url: "", fecha_programada: "", estado: "programado" });
    setEditandoId(null);
    setModal(true);
  };

  const abrirEditar = (post: any) => {
    setForm({
      contenido: post.contenido ?? "",
      imagen_url: post.imagen_url ?? "",
      fecha_programada: post.fecha_programada ? post.fecha_programada.slice(0, 16) : "",
      estado: post.estado ?? "programado",
    });
    setEditandoId(post.id);
    setModal(true);
  };

  const guardar = async () => {
    if (!form.contenido.trim() || !form.fecha_programada) {
      mostrarToast("Contenido y fecha son obligatorios", "err");
      return;
    }
    setGuardando(true);

    if (editandoId) {
      const { error } = await supabase
        .from("crm_posts_sociales")
        .update({
          contenido: form.contenido,
          imagen_url: form.imagen_url || null,
          fecha_programada: form.fecha_programada,
          estado: form.estado,
        })
        .eq("id", editandoId);
      if (error) mostrarToast("Error al actualizar", "err");
      else mostrarToast("Post actualizado");
    } else {
      const { error } = await supabase
        .from("crm_posts_sociales")
        .insert({
          perfil_id: userId,
          plataforma: "instagram",
          contenido: form.contenido,
          imagen_url: form.imagen_url || null,
          fecha_programada: form.fecha_programada,
          estado: "programado",
        });
      if (error) mostrarToast("Error al guardar: " + error.message, "err");
      else mostrarToast("Post programado");
    }

    setGuardando(false);
    setModal(false);
    setEditandoId(null);
    await cargar();
  };

  const marcarPublicado = async (id: string) => {
    const { error } = await supabase
      .from("crm_posts_sociales")
      .update({ estado: "publicado" })
      .eq("id", id);
    if (error) mostrarToast("Error al actualizar", "err");
    else { mostrarToast("Marcado como publicado"); await cargar(); }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este post?")) return;
    await supabase.from("crm_posts_sociales").delete().eq("id", id);
    mostrarToast("Post eliminado");
    await cargar();
  };

  const FILTROS = [
    { key: "todos", label: "Todos" },
    { key: "programado", label: "Programados" },
    { key: "publicado", label: "Publicados" },
    { key: "cancelado", label: "Cancelados" },
  ];

  const filtrados = filtro === "todos" ? posts : posts.filter(p => p.estado === filtro);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .ig-wrap { display: flex; flex-direction: column; gap: 20px; }
        .ig-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .ig-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }
        .ig-titulo span { color: #cc0000; }
        .ig-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .ig-btn-nuevo { padding: 10px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .ig-btn-nuevo:hover { background: #e60000; }
        .ig-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .ig-chip { padding: 7px 16px; border-radius: 20px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); transition: all 0.2s; }
        .ig-chip.activo { background: rgba(200,0,0,0.1); border-color: rgba(200,0,0,0.4); color: #ff6666; }
        .ig-chip:hover:not(.activo) { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
        .ig-lista { display: flex; flex-direction: column; gap: 10px; }
        .ig-card { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px; display: flex; gap: 14px; align-items: flex-start; transition: border-color 0.2s; }
        .ig-card:hover { border-color: rgba(200,0,0,0.2); }
        .ig-thumb { width: 60px; height: 60px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; font-size: 24px; }
        .ig-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .ig-card-body { flex: 1; min-width: 0; }
        .ig-card-contenido { font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; }
        .ig-card-meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .ig-card-fecha { font-size: 11px; color: rgba(255,255,255,0.35); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .ig-card-actions { display: flex; gap: 6px; align-items: center; margin-left: auto; flex-shrink: 0; }
        .ig-btn-sm { padding: 6px 12px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 1px solid; transition: all 0.15s; }
        .ig-btn-pub { background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.25); color: #22c55e; }
        .ig-btn-pub:hover { background: rgba(34,197,94,0.18); }
        .ig-btn-edit { background: transparent; border-color: rgba(255,255,255,0.14); color: rgba(255,255,255,0.4); }
        .ig-btn-edit:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .ig-btn-del { background: transparent; border-color: rgba(200,0,0,0.18); color: rgba(200,0,0,0.5); }
        .ig-btn-del:hover { background: rgba(200,0,0,0.1); border-color: #ff4444; color: #ff4444; }
        .ig-empty { padding: 60px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .ig-spinner { display: flex; align-items: center; justify-content: center; padding: 60px; }
        .ig-spin { width: 26px; height: 26px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Modal */
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; }
        .modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.25); border-radius: 6px; padding: 28px 30px; width: 100%; max-width: 540px; position: relative; max-height: 92vh; overflow-y: auto; }
        .modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg,transparent,#cc0000,transparent); border-radius: 6px 6px 0 0; }
        .modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .modal-titulo span { color: #cc0000; }
        .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .field label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .field input, .field select, .field textarea { padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; transition: border-color 0.2s; width: 100%; box-sizing: border-box; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: rgba(200,0,0,0.4); }
        .field input::placeholder, .field textarea::placeholder { color: rgba(255,255,255,0.2); }
        .field select { background: #0f0f0f; }
        .field textarea { resize: vertical; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); margin-top: 6px; }
        .btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .btn-save { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .btn-save:hover:not(:disabled) { background: #e60000; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; z-index: 999; animation: toastIn 0.3s ease; }
        .toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; }
        .toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
      `}</style>

      <div className="ig-wrap">
        {/* Header */}
        <div className="ig-header">
          <div>
            <div className="ig-titulo">
              <span style={{ fontSize: 24 }}>📸</span>
              Instagram — <span>Posts Programados</span>
            </div>
            <div className="ig-sub">Planificá y gestioná tus publicaciones de Instagram</div>
          </div>
          <button className="ig-btn-nuevo" onClick={abrirNuevo}>+ Programar post</button>
        </div>

        {/* Filtros */}
        <div className="ig-chips">
          {FILTROS.map(f => (
            <button
              key={f.key}
              className={`ig-chip${filtro === f.key ? " activo" : ""}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
              {f.key !== "todos" && (
                <span style={{ marginLeft: 6, opacity: 0.6 }}>
                  ({posts.filter(p => p.estado === f.key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="ig-spinner"><div className="ig-spin" /></div>
        ) : filtrados.length === 0 ? (
          <div className="ig-empty">
            {posts.length === 0
              ? "Todavía no hay posts programados. ¡Programá el primero!"
              : "No hay posts con ese filtro."}
          </div>
        ) : (
          <div className="ig-lista">
            {filtrados.map(post => (
              <div key={post.id} className="ig-card">
                {/* Thumbnail */}
                <div className="ig-thumb">
                  {post.imagen_url
                    ? <img src={post.imagen_url} alt="preview" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    : <span>📸</span>
                  }
                </div>

                {/* Body */}
                <div className="ig-card-body">
                  <div className="ig-card-contenido">{post.contenido}</div>
                  <div className="ig-card-meta">
                    <span className="ig-card-fecha">🗓 {formatFechaPost(post.fecha_programada)}</span>
                    <EstadoBadge estado={post.estado} />
                  </div>
                </div>

                {/* Actions */}
                <div className="ig-card-actions">
                  {post.estado === "programado" && (
                    <button className="ig-btn-sm ig-btn-pub" onClick={() => marcarPublicado(post.id)} title="Marcar como publicado">
                      ✅ Publicado
                    </button>
                  )}
                  <button className="ig-btn-sm ig-btn-edit" onClick={() => abrirEditar(post)} title="Editar">
                    ✏
                  </button>
                  <button className="ig-btn-sm ig-btn-del" onClick={() => eliminar(post.id)} title="Eliminar">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) { setModal(false); setEditandoId(null); } }}>
          <div className="modal">
            <div className="modal-titulo">
              {editandoId ? "Editar" : "Programar"} <span>post</span>
            </div>

            <div className="field">
              <label>Contenido *</label>
              <textarea
                rows={6}
                placeholder="Escribí el texto de tu publicación..."
                value={form.contenido}
                onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>URL de imagen (opcional)</label>
              <input
                type="url"
                placeholder="https://..."
                value={form.imagen_url}
                onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>Fecha y hora *</label>
              <input
                type="datetime-local"
                value={form.fecha_programada}
                onChange={e => setForm(f => ({ ...f, fecha_programada: e.target.value }))}
              />
            </div>

            {editandoId && (
              <div className="field">
                <label>Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  <option value="programado">Programado</option>
                  <option value="publicado">Publicado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setModal(false); setEditandoId(null); }}>Cancelar</button>
              <button className="btn-save" onClick={guardar} disabled={guardando || !form.contenido.trim() || !form.fecha_programada}>
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Programar post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
