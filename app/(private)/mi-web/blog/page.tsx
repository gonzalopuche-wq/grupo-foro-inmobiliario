"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Post = {
  id: string;
  perfil_id: string;
  titulo: string;
  slug: string;
  contenido: string;
  resumen: string;
  imagen_url: string | null;
  publicado: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = {
  titulo: string;
  contenido: string;
  resumen: string;
  imagen_url: string;
  publicado: boolean;
};

const FORM_VACIO: FormState = { titulo: "", contenido: "", resumen: "", imagen_url: "", publicado: false };

function generarSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function BlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [userId, setUserId] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "publicados" | "borradores">("todos");
  const [tablaNoExiste, setTablaNoExiste] = useState(false);

  const cargarPosts = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("mi_web_posts")
        .select("*")
        .eq("perfil_id", uid)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTablaNoExiste(true);
        }
        setPosts([]);
      } else {
        setPosts(data ?? []);
      }
    } catch {
      setTablaNoExiste(true);
      setPosts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);
      await cargarPosts(auth.user.id);
    };
    init();
  }, []);

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setModalAbierto(true);
  };

  const abrirEditar = (post: Post) => {
    setForm({
      titulo: post.titulo,
      contenido: post.contenido,
      resumen: post.resumen,
      imagen_url: post.imagen_url ?? "",
      publicado: post.publicado,
    });
    setEditandoId(post.id);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const guardarPost = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    const slug = generarSlug(form.titulo);
    const now = new Date().toISOString();

    if (editandoId) {
      await supabase.from("mi_web_posts").update({
        titulo: form.titulo,
        slug,
        contenido: form.contenido,
        resumen: form.resumen,
        imagen_url: form.imagen_url || null,
        publicado: form.publicado,
        updated_at: now,
      }).eq("id", editandoId);
    } else {
      await supabase.from("mi_web_posts").insert({
        perfil_id: userId,
        titulo: form.titulo,
        slug,
        contenido: form.contenido,
        resumen: form.resumen,
        imagen_url: form.imagen_url || null,
        publicado: form.publicado,
      });
    }

    await cargarPosts(userId);
    setGuardando(false);
    cerrarModal();
  };

  const togglePublicado = async (post: Post) => {
    await supabase.from("mi_web_posts").update({
      publicado: !post.publicado,
      updated_at: new Date().toISOString(),
    }).eq("id", post.id);
    await cargarPosts(userId);
  };

  const eliminarPost = async (id: string) => {
    if (!confirm("¿Eliminar este post permanentemente?")) return;
    await supabase.from("mi_web_posts").delete().eq("id", id);
    await cargarPosts(userId);
  };

  const postsFiltrados = posts.filter(p => {
    if (filtro === "publicados") return p.publicado;
    if (filtro === "borradores") return !p.publicado;
    return true;
  });

  const formatFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
        Cargando posts...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .blog-wrap { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
        .blog-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .blog-titulos {}
        .blog-tag { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #cc0000; font-family: 'Montserrat',sans-serif; margin-bottom: 6px; }
        .blog-titulo { font-family: 'Montserrat',sans-serif; font-size: 26px; font-weight: 800; color: #fff; }
        .blog-btn-nuevo { padding: 10px 18px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .blog-btn-nuevo:hover { background: #e60000; }
        .blog-filtros { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .blog-filtro { padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 700; font-family: 'Montserrat',sans-serif; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.5); background: transparent; transition: all 0.15s; }
        .blog-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.1); }
        .blog-filtro:hover:not(.activo) { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
        .blog-lista { display: flex; flex-direction: column; gap: 12px; }
        .blog-post { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 18px 20px; transition: border-color 0.15s; }
        .blog-post:hover { border-color: rgba(255,255,255,0.12); }
        .blog-post-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 8px; }
        .blog-post-titulo { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 700; color: #fff; }
        .blog-badge { padding: 3px 9px; border-radius: 99px; font-size: 10px; font-weight: 700; font-family: 'Montserrat',sans-serif; white-space: nowrap; }
        .blog-badge.pub { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
        .blog-badge.bor { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.1); }
        .blog-post-resumen { font-size: 13px; color: rgba(255,255,255,0.45); font-family: 'Inter',sans-serif; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .blog-post-meta { font-size: 11px; color: rgba(255,255,255,0.25); font-family: 'Inter',sans-serif; margin-bottom: 14px; }
        .blog-post-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .blog-action-btn { padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; font-family: 'Montserrat',sans-serif; cursor: pointer; border: 1px solid; transition: all 0.15s; }
        .blog-action-btn.edit { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.6); background: transparent; }
        .blog-action-btn.edit:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .blog-action-btn.toggle-pub { border-color: rgba(34,197,94,0.3); color: #22c55e; background: transparent; }
        .blog-action-btn.toggle-pub:hover { background: rgba(34,197,94,0.08); }
        .blog-action-btn.toggle-bor { border-color: rgba(255,165,0,0.3); color: rgba(255,165,0,0.8); background: transparent; }
        .blog-action-btn.toggle-bor:hover { background: rgba(255,165,0,0.06); }
        .blog-action-btn.del { border-color: rgba(200,0,0,0.25); color: rgba(200,0,0,0.7); background: transparent; }
        .blog-action-btn.del:hover { border-color: rgba(200,0,0,0.5); color: #cc0000; background: rgba(200,0,0,0.06); }
        .blog-vacio { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.25); font-family: 'Inter',sans-serif; }
        .blog-vacio-icono { font-size: 40px; margin-bottom: 12px; }
        .blog-vacio-txt { font-size: 14px; margin-bottom: 6px; }
        .blog-vacio-sub { font-size: 12px; color: rgba(255,255,255,0.15); }
        /* Modal */
        .blog-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .blog-modal { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; }
        .blog-modal-header { padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; }
        .blog-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; }
        .blog-modal-close { background: transparent; border: none; color: rgba(255,255,255,0.4); font-size: 20px; cursor: pointer; line-height: 1; padding: 0 4px; }
        .blog-modal-close:hover { color: #fff; }
        .blog-modal-body { padding: 24px; }
        .blog-field { margin-bottom: 16px; }
        .blog-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 7px; font-family: 'Montserrat',sans-serif; }
        .blog-input { width: 100%; padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; transition: border-color 0.2s; }
        .blog-input:focus { border-color: rgba(200,0,0,0.4); }
        .blog-input::placeholder { color: rgba(255,255,255,0.2); }
        .blog-textarea { width: 100%; padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; resize: vertical; line-height: 1.6; transition: border-color 0.2s; }
        .blog-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .blog-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .blog-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
        .blog-toggle-label { font-size: 13px; color: #fff; font-family: 'Inter',sans-serif; }
        .blog-toggle-switch { width: 44px; height: 24px; border-radius: 12px; position: relative; cursor: pointer; transition: background 0.2s; }
        .blog-toggle-knob { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.2s; }
        .blog-modal-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; justify-content: flex-end; gap: 10px; }
        .blog-btn-cancel { padding: 10px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; }
        .blog-btn-save { padding: 10px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
        .blog-btn-save:hover:not(:disabled) { background: #e60000; }
        .blog-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 600px) { .blog-post-top { flex-direction: column; gap: 8px; } }
      `}</style>

      <div className="blog-wrap">

        {/* Header */}
        <div className="blog-header">
          <div className="blog-titulos">
            <div className="blog-tag">Mi Web · Contenido</div>
            <div className="blog-titulo">Blog del Corredor</div>
          </div>
          <button className="blog-btn-nuevo" onClick={abrirNuevo}>
            + Nuevo post
          </button>
        </div>

        {/* Filtros */}
        <div className="blog-filtros">
          {(["todos", "publicados", "borradores"] as const).map(f => (
            <button
              key={f}
              className={`blog-filtro${filtro === f ? " activo" : ""}`}
              onClick={() => setFiltro(f)}
            >
              {f === "todos" ? "Todos" : f === "publicados" ? "Publicados" : "Borradores"}
              {" "}
              <span style={{ opacity: 0.6, fontWeight: 400 }}>
                ({f === "todos" ? posts.length : f === "publicados" ? posts.filter(p => p.publicado).length : posts.filter(p => !p.publicado).length})
              </span>
            </button>
          ))}
        </div>

        {/* Lista de posts */}
        {tablaNoExiste ? (
          <div className="blog-vacio">
            <div className="blog-vacio-icono">📝</div>
            <div className="blog-vacio-txt">La funcionalidad de blog todavía no está activa</div>
            <div className="blog-vacio-sub">Contactá a soporte para habilitar el módulo de blog.</div>
          </div>
        ) : postsFiltrados.length === 0 ? (
          <div className="blog-vacio">
            <div className="blog-vacio-icono">📝</div>
            <div className="blog-vacio-txt">
              {filtro === "todos" ? "Todavía no publicaste ningún post" : `No hay posts ${filtro === "publicados" ? "publicados" : "en borrador"}`}
            </div>
            <div className="blog-vacio-sub">
              {filtro === "todos" ? 'Hacé clic en "+ Nuevo post" para empezar a escribir.' : ""}
            </div>
          </div>
        ) : (
          <div className="blog-lista">
            {postsFiltrados.map(post => (
              <div key={post.id} className="blog-post">
                <div className="blog-post-top">
                  <div className="blog-post-titulo">{post.titulo}</div>
                  <div className={`blog-badge ${post.publicado ? "pub" : "bor"}`}>
                    {post.publicado ? "Publicado" : "Borrador"}
                  </div>
                </div>
                {post.resumen && (
                  <div className="blog-post-resumen">{post.resumen}</div>
                )}
                <div className="blog-post-meta">
                  {formatFecha(post.created_at)}
                  {post.slug && <span style={{ marginLeft: 10, opacity: 0.6 }}>/{post.slug}</span>}
                </div>
                <div className="blog-post-actions">
                  <button className="blog-action-btn edit" onClick={() => abrirEditar(post)}>
                    ✏️ Editar
                  </button>
                  <button
                    className={`blog-action-btn ${post.publicado ? "toggle-bor" : "toggle-pub"}`}
                    onClick={() => togglePublicado(post)}
                  >
                    👁️ {post.publicado ? "Despublicar" : "Publicar"}
                  </button>
                  <button className="blog-action-btn del" onClick={() => eliminarPost(post.id)}>
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div className="blog-modal-overlay" onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="blog-modal">
            <div className="blog-modal-header">
              <div className="blog-modal-titulo">{editandoId ? "Editar post" : "Nuevo post"}</div>
              <button className="blog-modal-close" onClick={cerrarModal}>✕</button>
            </div>

            <div className="blog-modal-body">
              <div className="blog-field">
                <label className="blog-label">Título *</label>
                <input
                  className="blog-input"
                  placeholder="Título del post"
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                />
              </div>

              <div className="blog-field">
                <label className="blog-label">Resumen</label>
                <textarea
                  className="blog-textarea"
                  rows={3}
                  placeholder="Breve descripción del post (se muestra en listados y SEO)"
                  value={form.resumen}
                  onChange={e => setForm(f => ({ ...f, resumen: e.target.value }))}
                />
              </div>

              <div className="blog-field">
                <label className="blog-label">Contenido</label>
                <textarea
                  className="blog-textarea"
                  rows={10}
                  placeholder="Escribí el contenido completo del post acá..."
                  value={form.contenido}
                  onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                />
              </div>

              <div className="blog-field">
                <label className="blog-label">URL de imagen destacada</label>
                <input
                  className="blog-input"
                  placeholder="https://..."
                  value={form.imagen_url}
                  onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))}
                />
              </div>

              <div className="blog-toggle-row">
                <div className="blog-toggle-label">Publicar inmediatamente</div>
                <div
                  className="blog-toggle-switch"
                  style={{ background: form.publicado ? "#cc0000" : "rgba(255,255,255,0.1)" }}
                  onClick={() => setForm(f => ({ ...f, publicado: !f.publicado }))}
                >
                  <div
                    className="blog-toggle-knob"
                    style={{ left: form.publicado ? 23 : 3 }}
                  />
                </div>
              </div>
            </div>

            <div className="blog-modal-footer">
              <button className="blog-btn-cancel" onClick={cerrarModal}>Cancelar</button>
              <button
                className="blog-btn-save"
                onClick={guardarPost}
                disabled={guardando || !form.titulo.trim()}
              >
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
