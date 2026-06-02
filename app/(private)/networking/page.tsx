"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface NetPost {
  id: string;
  user_id: string;
  titulo: string;
  descripcion: string;
  tipo: "oportunidad" | "urgencia" | "necesidad" | "otro";
  precio: number | null;
  moneda: string;
  ubicacion: string | null;
  caracteristicas: string | null;
  fotos: string[] | null;
  estado: "activo" | "pausado" | "cerrado";
  contacto_visible: boolean;
  created_at: string;
  autor?: { nombre: string; apellido: string; matricula: string | null; telefono: string | null; email: string | null; };
}

const TIPOS: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  oportunidad: { label: "Oportunidad",  color: "#22c55e",  bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)",   icon: "💎" },
  urgencia:    { label: "Urgencia",     color: "#ef4444",  bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   icon: "🔥" },
  necesidad:   { label: "Busco",        color: "#f59e0b",  bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  icon: "🔍" },
  otro:        { label: "Info",         color: "#94a3b8",  bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", icon: "💬" },
};

const MONEDAS = ["USD", "ARS", "EUR"];
const FORM_VACIO = {
  titulo: "", descripcion: "", tipo: "oportunidad" as NetPost["tipo"],
  precio: "", moneda: "USD", ubicacion: "", caracteristicas: "",
};

export default function NetworkingPage() {
  const [posts, setPosts] = useState<NetPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [postVer, setPostVer] = useState<NetPost | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [misPostsOnly, setMisPostsOnly] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      setUserId(data.user.id);
      const { data: p } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (p?.tipo === "admin" || p?.tipo === "master") setEsAdmin(true);
      await cargarPosts();
    };
    init();
  }, []);

  const cargarPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("networking_posts")
      .select("*, autor:user_id(nombre, apellido, matricula, telefono, email)")
      .in("estado", ["activo"])
      .order("created_at", { ascending: false });
    setPosts((data ?? []) as NetPost[]);
    setLoading(false);
  };

  const cargarMisPosts = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("networking_posts")
      .select("*, autor:user_id(nombre, apellido, matricula, telefono, email)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setPosts((data ?? []) as NetPost[]);
    setLoading(false);
  };

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const subirFoto = async (files: FileList) => {
    if (!userId) return;
    setSubiendoFoto(true);
    const nuevas: string[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i];
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `networking/${userId}/${Date.now()}_${i}.${ext}`;
      const { data } = await supabase.storage.from("eventos").upload(path, file, { upsert: true, contentType: file.type });
      if (data) {
        const { data: u } = supabase.storage.from("eventos").getPublicUrl(data.path);
        nuevas.push(u.publicUrl);
      }
    }
    setFotos(p => [...p, ...nuevas].slice(0, 5));
    setSubiendoFoto(false);
  };

  const guardarPost = async () => {
    if (!userId || !form.titulo || !form.descripcion) { mostrarToast("Título y descripción son obligatorios", "err"); return; }
    setGuardando(true);
    const { error } = await supabase.from("networking_posts").insert({
      user_id: userId,
      titulo: form.titulo,
      descripcion: form.descripcion,
      tipo: form.tipo,
      precio: form.precio ? parseFloat(form.precio.replace(/\./g, "").replace(",", ".")) : null,
      moneda: form.moneda,
      ubicacion: form.ubicacion || null,
      caracteristicas: form.caracteristicas || null,
      fotos: fotos.length > 0 ? fotos : null,
      estado: "activo",
      contacto_visible: true,
    });
    setGuardando(false);
    if (error) { mostrarToast("Error al publicar", "err"); return; }
    setMostrarForm(false);
    setForm(FORM_VACIO);
    setFotos([]);
    mostrarToast("Publicado en el Networking ✓");
    await cargarPosts();
  };

  const cambiarEstado = async (id: string, estado: "activo" | "pausado" | "cerrado") => {
    await supabase.from("networking_posts").update({ estado }).eq("id", id);
    if (misPostsOnly && userId) await cargarMisPosts(userId);
    else await cargarPosts();
    mostrarToast(estado === "cerrado" ? "Operación cerrada" : estado === "pausado" ? "Post pausado" : "Post reactivado");
  };

  const eliminarPost = async (id: string) => {
    if (!confirm("¿Eliminar este post?")) return;
    await supabase.from("networking_posts").delete().eq("id", id);
    if (misPostsOnly && userId) await cargarMisPosts(userId);
    else await cargarPosts();
    mostrarToast("Eliminado");
  };

  const formatPrecio = (post: NetPost) => {
    if (!post.precio) return null;
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(post.precio) + " " + post.moneda;
  };

  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

  const postsFiltrados = posts.filter(p => filtroTipo === "todos" || p.tipo === filtroTipo);

  const contadores = {
    todos:       posts.length,
    oportunidad: posts.filter(p => p.tipo === "oportunidad").length,
    urgencia:    posts.filter(p => p.tipo === "urgencia").length,
    necesidad:   posts.filter(p => p.tipo === "necesidad").length,
    otro:        posts.filter(p => p.tipo === "otro").length,
  };

  return (
    <>
      <style>{`
        .net-root { display: flex; flex-direction: column; gap: 20px; }
        .net-header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .net-titulo { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--gfi-text-primary); }
        .net-titulo span { color: var(--gfi-red); }
        .net-sub { font-size: 13px; color: var(--gfi-text-secondary); margin-top: 4px; }
        .net-btn-nuevo { padding: 9px 20px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-md); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; box-shadow: var(--gfi-shadow-red); transition: var(--gfi-transition); }
        .net-btn-nuevo:hover { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }
        .net-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .net-filtro { padding: 7px 14px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); cursor: pointer; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-text-secondary); transition: var(--gfi-transition); display: flex; align-items: center; gap: 6px; }
        .net-filtro:hover { border-color: var(--gfi-red-border); color: var(--gfi-text-primary); }
        .net-filtro.activo { border-color: var(--gfi-red); color: var(--gfi-text-primary); background: var(--gfi-red-soft); }
        .net-filtro-count { font-size: 9px; font-weight: 800; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 10px; font-family: var(--font-mono); }
        .net-filtro.activo .net-filtro-count { background: var(--gfi-red-soft); color: var(--gfi-red); }
        .net-grid { display: flex; flex-direction: column; gap: 10px; }
        .net-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); overflow: hidden; display: flex; transition: var(--gfi-transition); cursor: pointer; }
        .net-card:hover { border-color: var(--gfi-red-border); box-shadow: var(--gfi-shadow-md); }
        .net-tipo-col { width: 4px; flex-shrink: 0; }
        .net-card-body { flex: 1; padding: 16px 18px; min-width: 0; }
        .net-card-top { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .net-card-titulo { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--gfi-text-primary); line-height: 1.3; flex: 1; }
        .net-badge { font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; border: 1px solid; white-space: nowrap; }
        .net-card-desc { font-size: 13px; color: var(--gfi-text-secondary); line-height: 1.5; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .net-card-meta { display: flex; gap: 14px; flex-wrap: wrap; }
        .net-meta-item { font-size: 11px; color: var(--gfi-text-muted); display: flex; align-items: center; gap: 4px; }
        .net-precio { font-size: 16px; font-weight: 700; color: var(--gfi-green-text); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
        .net-fotos { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
        .net-foto { width: 60px; height: 60px; border-radius: var(--gfi-radius-sm); object-fit: cover; border: 1px solid var(--gfi-border); cursor: zoom-in; }
        .net-empty { padding: 48px; text-align: center; color: var(--gfi-text-muted); font-size: 13px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); }
        .net-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px; }
        .net-modal { background: var(--gfi-bg-panel); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-lg); padding: 28px 32px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; position: relative; box-shadow: var(--gfi-shadow-lg); }
        .net-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--gfi-red), transparent); border-radius: var(--gfi-radius-lg) var(--gfi-radius-lg) 0 0; }
        .net-modal-titulo { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--gfi-text-primary); margin-bottom: 20px; }
        .net-modal-titulo span { color: var(--gfi-red); }
        .net-field { margin-bottom: 14px; }
        .net-label { display: block; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 6px; }
        .net-input { width: 100%; padding: 9px 13px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); }
        .net-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .net-input::placeholder { color: var(--gfi-text-muted); }
        .net-textarea { width: 100%; padding: 9px 13px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); resize: vertical; min-height: 100px; transition: var(--gfi-transition); }
        .net-textarea:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .net-textarea::placeholder { color: var(--gfi-text-muted); }
        .net-select { width: 100%; padding: 9px 13px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); }
        .net-select:focus { border-color: var(--gfi-red); }
        .net-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .net-tipo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .net-tipo-btn { padding: 7px 14px; border-radius: 20px; border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-secondary); font-size: 11px; font-weight: 700; font-family: var(--font-display); cursor: pointer; transition: var(--gfi-transition); }
        .net-tipo-btn:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .net-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; border-top: 1px solid var(--gfi-border-subtle); padding-top: 16px; }
        .net-btn-cancel { padding: 9px 20px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .net-btn-cancel:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .net-btn-save { padding: 9px 24px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-md); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: var(--gfi-shadow-red); transition: var(--gfi-transition); }
        .net-btn-save:hover { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }
        .net-btn-save:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
        .net-sec { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gfi-text-muted); margin: 16px 0 12px; border-bottom: 1px solid var(--gfi-border-subtle); padding-bottom: 6px; }
        .net-det-autor { font-size: 13px; color: var(--gfi-text-secondary); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .net-det-mat { font-size: 11px; background: rgba(255,255,255,0.04); border: 1px solid var(--gfi-border); border-radius: 20px; padding: 2px 9px; color: var(--gfi-text-muted); }
        .net-det-desc { font-size: 14px; color: var(--gfi-text-primary); line-height: 1.7; white-space: pre-wrap; margin-bottom: 16px; }
        .net-det-caract { font-size: 13px; color: var(--gfi-text-secondary); background: var(--gfi-bg-secondary); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); padding: 12px 14px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 14px; }
        .net-det-contact { background: var(--gfi-green-soft); border: 1px solid rgba(16,185,129,0.2); border-radius: var(--gfi-radius-md); padding: 14px 16px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .net-det-contact-label { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-green-text); margin-bottom: 4px; }
        .net-det-wa { padding: 8px 16px; background: var(--gfi-green-text); border: none; border-radius: var(--gfi-radius-md); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-block; transition: var(--gfi-transition); }
        .net-det-wa:hover { filter: brightness(1.1); }
        .net-owner-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .net-btn-sm { padding: 6px 12px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .net-btn-sm:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .net-btn-sm.danger { border-color: var(--gfi-red-border); color: var(--gfi-red); }
        .net-btn-sm.danger:hover { border-color: var(--gfi-red); background: var(--gfi-red-soft); }
        .net-btn-sm.success { border-color: rgba(16,185,129,0.25); color: var(--gfi-green-text); }
        .net-btn-sm.success:hover { border-color: var(--gfi-green-text); background: var(--gfi-green-soft); }
        .net-mis-btn { padding: 7px 14px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); cursor: pointer; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gfi-text-secondary); transition: var(--gfi-transition); }
        .net-mis-btn.activo { border-color: var(--gfi-red); color: var(--gfi-red); background: var(--gfi-red-soft); }
        .net-estado-badge { font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 20px; border: 1px solid; }
        .net-toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: var(--gfi-radius-md); font-family: var(--font-display); font-size: 12px; font-weight: 700; z-index: 999; animation: gfi-fade-in 0.3s ease; }
        .net-toast.ok { background: rgba(10,61,46,0.6); border: 1px solid rgba(16,185,129,0.35); color: var(--gfi-green-text); }
        .net-toast.err { background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); color: #ff6666; }
        @media (max-width: 600px) { .net-row2 { grid-template-columns: 1fr; } }
      `}</style>

      <div className="net-root">

        {/* Header */}
        <div className="net-header">
          <div>
            <div className="net-titulo">Networking <span>Inmobiliario</span></div>
            <div className="net-sub">Rueda de negocios interna — oportunidades, urgencias y búsquedas entre colegas</div>
          </div>
          <button className="net-btn-nuevo" onClick={() => setMostrarForm(true)}>+ Publicar</button>
        </div>

        {/* Filtros */}
        <div className="net-toolbar">
          {([
            { key: "todos",       label: "Todos" },
            { key: "oportunidad", label: "💎 Oportunidades" },
            { key: "urgencia",    label: "🔥 Urgencias" },
            { key: "necesidad",   label: "🔍 Busco" },
            { key: "otro",        label: "💬 Info" },
          ] as const).map(f => (
            <button key={f.key} className={`net-filtro${filtroTipo === f.key ? " activo" : ""}`} onClick={() => setFiltroTipo(f.key)}>
              {f.label}
              <span className="net-filtro-count">{contadores[f.key]}</span>
            </button>
          ))}
          <button
            className={`net-mis-btn${misPostsOnly ? " activo" : ""}`}
            onClick={async () => {
              const nuevoEstado = !misPostsOnly;
              setMisPostsOnly(nuevoEstado);
              setFiltroTipo("todos");
              if (nuevoEstado && userId) await cargarMisPosts(userId);
              else await cargarPosts();
            }}
          >
            {misPostsOnly ? "✓ Mis publicaciones" : "Mis publicaciones"}
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Cargando...</div>
        ) : postsFiltrados.length === 0 ? (
          <div className="net-empty">
            {misPostsOnly ? "Todavía no publicaste nada en el Networking." : "No hay publicaciones activas en esta categoría."}
            <div style={{ marginTop: 12 }}>
              <button className="net-btn-nuevo" onClick={() => setMostrarForm(true)}>Publicar ahora</button>
            </div>
          </div>
        ) : (
          <div className="net-grid">
            {postsFiltrados.map(post => {
              const t = TIPOS[post.tipo] ?? TIPOS.otro;
              const precio = formatPrecio(post);
              const esPropio = post.user_id === userId;
              return (
                <div key={post.id} className="net-card" onClick={() => setPostVer(post)}>
                  <div className="net-tipo-col" style={{ background: t.color }} />
                  <div className="net-card-body">
                    <div className="net-card-top">
                      <div className="net-card-titulo">{t.icon} {post.titulo}</div>
                      <span className="net-badge" style={{ color: t.color, background: t.bg, borderColor: t.border }}>{t.label}</span>
                      {post.estado !== "activo" && (
                        <span className="net-estado-badge" style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
                          {post.estado === "pausado" ? "Pausado" : "Cerrado"}
                        </span>
                      )}
                    </div>
                    {precio && <div className="net-precio">{precio}</div>}
                    {post.fotos && post.fotos.length > 0 && (
                      <div className="net-fotos" onClick={e => e.stopPropagation()}>
                        {post.fotos.slice(0, 4).map((f, i) => (
                          <img key={i} src={f} alt="" className="net-foto" onClick={() => {}} />
                        ))}
                        {post.fotos.length > 4 && (
                          <div style={{ width: 60, height: 60, borderRadius: 4, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>+{post.fotos.length - 4}</div>
                        )}
                      </div>
                    )}
                    <div className="net-card-desc">{post.descripcion}</div>
                    <div className="net-card-meta">
                      {post.ubicacion && <span className="net-meta-item">📍 {post.ubicacion}</span>}
                      <span className="net-meta-item">👤 {post.autor?.apellido}, {post.autor?.nombre}</span>
                      {post.autor?.matricula && <span className="net-meta-item">Mat. {post.autor.matricula}</span>}
                      <span className="net-meta-item" style={{ marginLeft: "auto" }}>{formatFecha(post.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DETALLE */}
      {postVer && (
        <div className="net-modal-bg" onClick={e => { if (e.target === e.currentTarget) setPostVer(null); }}>
          <div className="net-modal">
            <button onClick={() => setPostVer(null)} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
            {(() => {
              const t = TIPOS[postVer.tipo] ?? TIPOS.otro;
              const precio = formatPrecio(postVer);
              const esPropio = postVer.user_id === userId;
              return (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <div className="net-modal-titulo" style={{ marginBottom: 0, flex: 1 }}>{t.icon} {postVer.titulo}</div>
                    <span className="net-badge" style={{ color: t.color, background: t.bg, borderColor: t.border, alignSelf: "flex-start" }}>{t.label}</span>
                  </div>
                  {precio && <div className="net-precio" style={{ marginBottom: 12 }}>{precio}</div>}
                  {postVer.ubicacion && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>📍 {postVer.ubicacion}</div>}

                  <div className="net-det-autor">
                    <span>Por {postVer.autor?.apellido}, {postVer.autor?.nombre}</span>
                    {postVer.autor?.matricula && <span className="net-det-mat">Mat. {postVer.autor.matricula}</span>}
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>{formatFecha(postVer.created_at)}</span>
                  </div>

                  {postVer.fotos && postVer.fotos.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      {postVer.fotos.map((f, i) => (
                        <img key={i} src={f} alt="" style={{ width: 90, height: 90, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", cursor: "zoom-in" }} />
                      ))}
                    </div>
                  )}

                  <div className="net-det-desc">{postVer.descripcion}</div>

                  {postVer.caracteristicas && (
                    <>
                      <div style={{ fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>Características</div>
                      <div className="net-det-caract">{postVer.caracteristicas}</div>
                    </>
                  )}

                  {postVer.contacto_visible && postVer.autor && !esPropio && (
                    <div className="net-det-contact">
                      <div style={{ flex: 1 }}>
                        <div className="net-det-contact-label">Contacto</div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{postVer.autor.apellido}, {postVer.autor.nombre}</div>
                        {postVer.autor.email && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{postVer.autor.email}</div>}
                      </div>
                      {postVer.autor.telefono && (
                        <a
                          href={`https://wa.me/${postVer.autor.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, vi tu publicación "${postVer.titulo}" en el Networking de GFI®`)}`}
                          target="_blank" rel="noopener noreferrer" className="net-det-wa"
                          onClick={e => e.stopPropagation()}>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}

                  {(esPropio || esAdmin) && (
                    <div className="net-owner-actions">
                      {postVer.estado === "activo" && (
                        <button className="net-btn-sm" onClick={e => { e.stopPropagation(); cambiarEstado(postVer.id, "pausado"); setPostVer(null); }}>Pausar</button>
                      )}
                      {postVer.estado === "pausado" && (
                        <button className="net-btn-sm success" onClick={e => { e.stopPropagation(); cambiarEstado(postVer.id, "activo"); setPostVer(null); }}>Reactivar</button>
                      )}
                      {postVer.estado !== "cerrado" && (
                        <button className="net-btn-sm success" onClick={e => { e.stopPropagation(); cambiarEstado(postVer.id, "cerrado"); setPostVer(null); }}>Marcar cerrado</button>
                      )}
                      <button className="net-btn-sm danger" onClick={e => { e.stopPropagation(); eliminarPost(postVer.id); setPostVer(null); }}>Eliminar</button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL CREAR */}
      {mostrarForm && (
        <div className="net-modal-bg" onClick={e => { if (e.target === e.currentTarget) { setMostrarForm(false); setForm(FORM_VACIO); setFotos([]); } }}>
          <div className="net-modal">
            <div className="net-modal-titulo">Nueva <span>publicación</span></div>

            <div className="net-field">
              <label className="net-label">Tipo de publicación</label>
              <div className="net-tipo-grid">
                {Object.entries(TIPOS).map(([k, t]) => (
                  <button key={k} type="button" className="net-tipo-btn"
                    style={form.tipo === k ? { borderColor: t.border, background: t.bg, color: t.color } : {}}
                    onClick={() => setF("tipo", k)}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
                💎 <b style={{ color: "rgba(255,255,255,0.5)" }}>Oportunidad</b>: propiedad interesante sin urgencia ·
                🔥 <b style={{ color: "rgba(255,255,255,0.5)" }}>Urgencia</b>: necesita venderse rápido, autorización por vencer, situación especial ·
                🔍 <b style={{ color: "rgba(255,255,255,0.5)" }}>Busco</b>: cliente que necesita propiedad específica
              </div>
            </div>

            <div className="net-field">
              <label className="net-label">Título *</label>
              <input className="net-input" value={form.titulo} onChange={e => setF("titulo", e.target.value)} placeholder="Ej: Dpto 3 amb en Fisherton — autorización vence en 15 días" />
            </div>

            <div className="net-field">
              <label className="net-label">Descripción completa * <small style={{ opacity: 0.5, fontWeight: 400, textTransform: "none" }}>— lo bueno, lo malo, lo urgente</small></label>
              <textarea className="net-textarea" value={form.descripcion} onChange={e => setF("descripcion", e.target.value)}
                placeholder={"Describí la situación con detalle:\n· Estado general del inmueble\n· Por qué es urgente o una oportunidad\n· Qué necesita el cliente\n· Condiciones especiales"} />
            </div>

            <div className="net-sec">Datos comerciales</div>
            <div className="net-row2">
              <div className="net-field">
                <label className="net-label">Precio</label>
                <input className="net-input" value={form.precio} onChange={e => setF("precio", e.target.value)} placeholder="180.000" />
              </div>
              <div className="net-field">
                <label className="net-label">Moneda</label>
                <select className="net-select" value={form.moneda} onChange={e => setF("moneda", e.target.value)}>
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="net-field">
              <label className="net-label">Ubicación</label>
              <input className="net-input" value={form.ubicacion} onChange={e => setF("ubicacion", e.target.value)} placeholder="Ej: Fisherton, Rosario — o Barrio Echesortu" />
            </div>
            <div className="net-field">
              <label className="net-label">Características <small style={{ opacity: 0.5, fontWeight: 400, textTransform: "none" }}>opcional — m², amb, baños, etc.</small></label>
              <textarea className="net-textarea" style={{ minHeight: 70 }} value={form.caracteristicas} onChange={e => setF("caracteristicas", e.target.value)}
                placeholder={"Ej:\n· 3 ambientes · 75 m² · 1 cochera\n· Piso 4 con balcón · Apto crédito"} />
            </div>

            <div className="net-sec">Fotos (hasta 5)</div>
            <div className="net-field">
              <label style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.1)", borderRadius: 6, cursor: "pointer" }}>
                <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => e.target.files && subirFoto(e.target.files)} />
                <span style={{ fontSize: 22 }}>📷</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{subiendoFoto ? "⏳ Subiendo..." : "Seleccionar fotos"}</span>
              </label>
              {fotos.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {fotos.map((f, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={f} alt="" style={{ width: 60, height: 60, borderRadius: 4, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <button type="button" onClick={() => setFotos(p => p.filter((_, j) => j !== i))}
                        style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, background: "#cc0000", border: "none", borderRadius: "50%", color: "#fff", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="net-modal-actions">
              <button className="net-btn-cancel" onClick={() => { setMostrarForm(false); setForm(FORM_VACIO); setFotos([]); }}>Cancelar</button>
              <button className="net-btn-save" onClick={guardarPost} disabled={guardando || !form.titulo || !form.descripcion}>
                {guardando ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`net-toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
