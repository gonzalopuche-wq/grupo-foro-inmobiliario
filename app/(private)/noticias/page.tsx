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
  estado: string;
  destacado: boolean;
  created_at: string;
  aprobado_at: string | null;
  aprobado_por: string | null;
  perfiles?: { nombre: string; apellido: string } | null;
}

interface Perfil {
  id: string;
  tipo: string;
  nombre: string;
  apellido: string;
}

interface AiFeedItem {
  id: string;
  titulo: string;
  resumen: string | null;
  url: string;
  imagen_url: string | null;
  fuente: string | null;
  fecha_fuente: string | null;
  categoria: string | null;
  score: number;
  estado: string;
  fetched_at: string;
}

const FORM_VACIO = {
  titulo: "",
  cuerpo: "",
  link: "",
  imagen_url: "",
  fuente: "",
  destacado: false,
};

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
  });

const formatFechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default function NoticiasPage() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [noticiaActiva, setNoticiaActiva] = useState<Noticia | null>(null);
  const [vista, setVista] = useState<"todas" | "pendientes" | "ai">("todas");
  const [aprobando, setAprobando] = useState<string | null>(null);
  const [fetchandoLink, setFetchandoLink] = useState(false);
  const [publicandoRedes, setPublicandoRedes] = useState<string | null>(null);
  const [redesResultados, setRedesResultados] = useState<Record<string, { red: string; ok: boolean; error?: string }[]>>({});
  const [verificando, setVerificando] = useState(false);
  const [verificacionResult, setVerificacionResult] = useState<{ red: string; ok: boolean; configurada: boolean; nombre?: string; detalle?: string; error?: string }[] | null>(null);
  const [mostrarVerificacion, setMostrarVerificacion] = useState(false);
  const [aiFeedItems, setAiFeedItems] = useState<AiFeedItem[]>([]);
  const [aiFeedLoading, setAiFeedLoading] = useState(false);
  const [aiFeedFetchando, setAiFeedFetchando] = useState(false);
  const [aiFeedActivo, setAiFeedActivo] = useState<AiFeedItem | null>(null);
  const [publicandoAI, setPublicandoAI] = useState<string | null>(null);
  const [descartandoAI, setDescartandoAI] = useState<string | null>(null);

  const fetchLinkPreview = async (url: string) => {
    if (!url.startsWith("http")) return;
    setFetchandoLink(true);
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        titulo: prev.titulo || data.title || "",
        cuerpo: prev.cuerpo || data.description || "",
        imagen_url: prev.imagen_url || data.image || "",
        fuente: prev.fuente || data.siteName || (new URL(url).hostname.replace("www.", "")) || "",
      }));
    } catch {}
    setFetchandoLink(false);
  };

  const esAdmin = perfil?.tipo === "admin" || perfil?.tipo === "master" || perfil?.tipo === "admin_contenido";

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);

      const { data: p } = await supabase
        .from("perfiles")
        .select("id, tipo, nombre, apellido")
        .eq("id", data.user.id)
        .single();
      setPerfil(p);
      await cargarNoticias(p?.tipo === "admin" || p?.tipo === "master" || p?.tipo === "admin_contenido");
      setLoading(false);
    };
    init();
  }, []);

  const cargarNoticias = async (admin = false) => {
    const query = supabase
      .from("noticias")
      .select("*, perfiles!noticias_autor_id_fkey(nombre, apellido)")
      .order("destacado", { ascending: false })
      .order("created_at", { ascending: false });

    if (!admin) {
      query.eq("estado", "aprobada");
    }

    const { data, error } = await query;
    if (error) { setErrorCarga(true); return; }
    setErrorCarga(false);
    setNoticias((data as unknown as Noticia[]) ?? []);
  };

  const guardarNoticia = async () => {
    if (!userId || !form.titulo.trim() || !form.cuerpo.trim()) return;
    setGuardando(true);
    const { error } = await supabase.from("noticias").insert({
      autor_id: userId,
      titulo: form.titulo.trim(),
      cuerpo: form.cuerpo.trim(),
      link: form.link.trim() || null,
      imagen_url: form.imagen_url.trim() || null,
      fuente: form.fuente.trim() || null,
      destacado: form.destacado,
      estado: esAdmin ? "aprobada" : "pendiente",
      ...(esAdmin ? { aprobado_por: userId, aprobado_at: new Date().toISOString() } : {}),
    });
    if (!error) {
      setForm(FORM_VACIO);
      setMostrarForm(false);
      await cargarNoticias(esAdmin);
    }
    setGuardando(false);
  };

  const aprobar = async (id: string) => {
    if (!userId || aprobando) return;
    setAprobando(id);
    await supabase.from("noticias").update({
      estado: "aprobada",
      aprobado_por: userId,
      aprobado_at: new Date().toISOString(),
    }).eq("id", id);
    await cargarNoticias(esAdmin);
    setAprobando(null);
    // Auto-publicar en redes al aprobar
    const noticia = noticias.find(n => n.id === id);
    if (noticia) publicarEnRedes({ ...noticia, estado: "aprobada" });
  };

  const verificarRedes = async () => {
    setVerificando(true);
    setVerificacionResult(null);
    setMostrarVerificacion(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/social/verificar", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setVerificacionResult(data.resultados ?? []);
    } catch {
      setVerificacionResult([{ red: "Error", ok: false, configurada: false, error: "No se pudo conectar al servidor" }]);
    }
    setVerificando(false);
  };

  const cargarAiFeed = async () => {
    setAiFeedLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/noticias/fetch-ai?estado=pendiente", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setAiFeedItems(data.items ?? []);
    } catch {}
    setAiFeedLoading(false);
  };

  const traerNoticiasAI = async () => {
    if (aiFeedFetchando) return;
    setAiFeedFetchando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/noticias/fetch-ai", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      await cargarAiFeed();
    } catch {}
    setAiFeedFetchando(false);
  };

  const publicarDesdeAI = async (item: AiFeedItem) => {
    if (publicandoAI) return;
    setPublicandoAI(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/noticias/publicar-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ id: item.id }),
      });
      if (res.ok) {
        setAiFeedItems(prev => prev.filter(i => i.id !== item.id));
        setAiFeedActivo(null);
      }
    } catch {}
    setPublicandoAI(null);
  };

  const descartarAI = async (item: AiFeedItem) => {
    if (descartandoAI) return;
    setDescartandoAI(item.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/noticias/publicar-ai?id=${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setAiFeedItems(prev => prev.filter(i => i.id !== item.id));
      setAiFeedActivo(null);
    } catch {}
    setDescartandoAI(null);
  };

  const publicarEnRedes = async (noticia: Noticia) => {
    if (publicandoRedes === noticia.id) return;
    setPublicandoRedes(noticia.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/social/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          tipo: "noticia",
          id: noticia.id,
          titulo: noticia.titulo,
          descripcion: noticia.cuerpo,
          imagen_url: noticia.imagen_url ?? null,
          link: noticia.link ?? window.location.origin + "/noticias",
        }),
      });
      const data = await res.json();
      setRedesResultados(prev => ({ ...prev, [noticia.id]: data.results ?? [] }));
    } catch {
      setRedesResultados(prev => ({ ...prev, [noticia.id]: [{ red: "error", ok: false, error: "Error de conexión" }] }));
    }
    setPublicandoRedes(null);
  };

  const rechazar = async (id: string) => {
    if (!userId) return;
    await supabase.from("noticias").update({ estado: "rechazada" }).eq("id", id);
    await cargarNoticias(esAdmin);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta noticia?")) return;
    await supabase.from("noticias").delete().eq("id", id);
    if (noticiaActiva?.id === id) setNoticiaActiva(null);
    await cargarNoticias(esAdmin);
  };

  const toggleDestacado = async (id: string, actual: boolean) => {
    await supabase.from("noticias").update({ destacado: !actual }).eq("id", id);
    await cargarNoticias(esAdmin);
  };

  const noticiasFiltradas = vista === "pendientes"
    ? noticias.filter(n => n.estado === "pendiente")
    : noticias.filter(n => n.estado === "aprobada");

  const pendientesCount = noticias.filter(n => n.estado === "pendiente").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');

        .not-container { display: flex; gap: 20px; height: calc(100vh - 120px); min-height: 500px; }
        .not-sidebar { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 0; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; overflow: hidden; }
        .not-sidebar-header { padding: 14px 18px; border-bottom: 1px solid var(--gfi-border-subtle); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .not-sidebar-title { font-family: var(--font-display); font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-secondary); }
        .not-tabs { display: flex; gap: 0; padding: 10px 18px; border-bottom: 1px solid var(--gfi-border-subtle); flex-shrink: 0; }
        .not-tab { flex: 1; padding: 7px; background: none; border: 1px solid var(--gfi-border); color: var(--gfi-text-muted); font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; position: relative; }
        .not-tab:first-child { border-radius: 3px 0 0 3px; }
        .not-tab:last-child { border-radius: 0 3px 3px 0; border-left: none; }
        .not-tab.activo { background: rgba(200,0,0,0.1); border-color: #990000; color: #fff; }
        .not-tab-badge { position: absolute; top: -5px; right: -5px; background: #990000; color: #fff; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 8px; min-width: 14px; text-align: center; }
        .not-lista { flex: 1; overflow-y: auto; }
        .not-lista::-webkit-scrollbar { width: 3px; }
        .not-lista::-webkit-scrollbar-thumb { background: var(--gfi-border); }
        .not-item { padding: 14px 18px; border-bottom: 1px solid var(--gfi-border-subtle); cursor: pointer; transition: background 0.15s; display: flex; gap: 10px; }
        .not-item:hover { background: var(--gfi-bg-card); }
        .not-item.activo { background: rgba(200,0,0,0.07); border-left: 2px solid #990000; }
        .not-item-img { width: 52px; height: 52px; border-radius: 5px; object-fit: cover; flex-shrink: 0; background: var(--gfi-border-subtle); }
        .not-item-img-placeholder { width: 52px; height: 52px; border-radius: 5px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.15); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; }
        .not-item-info { flex: 1; min-width: 0; }
        .not-item-titulo { font-family: var(--font-display); font-size: 12px; font-weight: 700; color: #fff; line-height: 1.3; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .not-item-meta { font-size: 10px; color: var(--gfi-text-muted); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .not-item-fuente { font-size: 9px; color: #990000; font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
        .not-badge-dest { font-size: 8px; background: rgba(234,179,8,0.15); border: 1px solid rgba(234,179,8,0.3); color: #d4960c; padding: 1px 5px; border-radius: 3px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .not-badge-pend { font-size: 8px; background: rgba(251,146,60,0.12); border: 1px solid rgba(251,146,60,0.25); color: #fb923c; padding: 1px 5px; border-radius: 3px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .not-btn-nueva { padding: 7px 14px; background: #990000; border: none; border-radius: 3px; color: #fff; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .not-btn-nueva:hover { background: #e60000; }

        /* Detalle */
        .not-detalle { flex: 1; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; overflow-y: auto; display: flex; flex-direction: column; }
        .not-detalle::-webkit-scrollbar { width: 4px; }
        .not-detalle::-webkit-scrollbar-thumb { background: var(--gfi-border); }
        .not-detalle-empty { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: rgba(255,255,255,0.15); }
        .not-detalle-imagen { width: 100%; height: 220px; object-fit: cover; border-radius: 8px 8px 0 0; }
        .not-detalle-body { padding: 24px 28px; flex: 1; }
        .not-detalle-fuente { font-size: 10px; color: #990000; font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .not-detalle-titulo { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: #fff; line-height: 1.3; margin-bottom: 10px; }
        .not-detalle-meta { font-size: 11px; color: var(--gfi-text-muted); margin-bottom: 18px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .not-detalle-cuerpo { font-size: 14px; color: rgba(255,255,255,0.75); line-height: 1.8; font-family: var(--font-body); white-space: pre-wrap; word-break: break-word; }
        .not-detalle-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; padding: 9px 16px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 4px; color: #990000; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: all 0.15s; }
        .not-detalle-link:hover { background: rgba(200,0,0,0.15); color: #fff; }
        .not-detalle-actions { display: flex; gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--gfi-border-subtle); flex-wrap: wrap; }
        .not-btn-aprobar { padding: 8px 16px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 3px; color: #3abab6; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .not-btn-aprobar:hover { background: rgba(34,197,94,0.2); }
        .not-btn-rechazar { padding: 8px 16px; background: transparent; border: 1px solid var(--gfi-border); border-radius: 3px; color: var(--gfi-text-muted); font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .not-btn-rechazar:hover { border-color: rgba(200,0,0,0.3); color: #990000; }
        .not-btn-eliminar { padding: 8px 16px; background: transparent; border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; color: rgba(200,0,0,0.6); font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .not-btn-eliminar:hover { background: rgba(200,0,0,0.1); color: #ff4444; }
        .not-btn-dest { padding: 8px 16px; background: transparent; border: 1px solid rgba(234,179,8,0.2); border-radius: 3px; color: rgba(234,179,8,0.7); font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .not-btn-dest:hover { background: rgba(234,179,8,0.1); color: #d4960c; }
        .not-btn-redes { padding: 8px 16px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 3px; color: #3b82f6; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .not-btn-redes:hover { background: rgba(59,130,246,0.2); }
        .not-btn-redes:disabled { opacity: 0.5; cursor: not-allowed; }
        .not-redes-resultado { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .not-red-badge { font-size: 9px; font-family: var(--font-display); font-weight: 700; padding: 3px 8px; border-radius: 3px; letter-spacing: 0.06em; text-transform: uppercase; }

        /* Modal form */
        .not-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: flex-start; justify-content: center; z-index: 200; padding: 24px; overflow-y: auto; }
        .not-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 28px 32px; width: 100%; max-width: 600px; position: relative; margin: auto; }
        .not-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #990000, transparent); border-radius: 6px 6px 0 0; }
        .not-modal-title { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .not-modal-title span { color: #990000; }
        .not-field { margin-bottom: 14px; }
        .not-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 5px; font-family: var(--font-display); }
        .not-input { width: 100%; padding: 9px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: var(--font-body); transition: border-color 0.2s; }
        .not-input:focus { border-color: rgba(200,0,0,0.5); }
        .not-input::placeholder { color: var(--gfi-text-dim); }
        .not-textarea { width: 100%; padding: 9px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 3px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 120px; font-family: var(--font-body); line-height: 1.6; }
        .not-textarea:focus { border-color: rgba(200,0,0,0.5); }
        .not-modal-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
        .not-btn-cancelar { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .not-btn-guardar { padding: 10px 24px; background: #990000; border: none; border-radius: 3px; color: #fff; font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .not-btn-guardar:hover { background: #e60000; }
        .not-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
        .not-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--gfi-text-muted); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 6px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .not-toggle-row { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .not-toggle { width: 38px; height: 22px; border-radius: 11px; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .not-toggle-knob { position: absolute; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left 0.2s; }
        .not-empty { padding: 60px 32px; text-align: center; color: var(--gfi-text-dim); font-size: 13px; font-style: italic; }
        .not-btn-verificar { padding: 7px 14px; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: 3px; color: #8b5cf6; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .not-btn-verificar:hover { background: rgba(139,92,246,0.2); }
        .not-btn-verificar:disabled { opacity: 0.5; cursor: not-allowed; }
        .not-verif-panel { background: var(--gfi-bg-card); border: 1px solid rgba(139,92,246,0.25); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
        .not-verif-titulo { font-family: var(--font-display); font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #8b5cf6; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
        .not-verif-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .not-verif-card { padding: 12px 14px; border-radius: 6px; border: 1px solid; }
        .not-verif-red { font-family: var(--font-display); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
        .not-verif-nombre { font-size: 13px; font-weight: 600; }
        .not-verif-detalle { font-size: 10px; margin-top: 2px; opacity: 0.55; }
        .not-verif-error { font-size: 11px; margin-top: 4px; }

        /* AI Feed */
        .not-ai-score { font-size: 9px; font-family: var(--font-display); font-weight: 700; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.06em; }
        .not-ai-cat { font-size: 9px; color: var(--gfi-text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--font-display); }
        .not-ai-resumen { background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: var(--gfi-text-primary); font-family: var(--font-body); line-height: 1.6; }
        .not-ai-resumen-label { font-size: 9px; font-family: var(--font-display); font-weight: 700; color: var(--gfi-text-dim); letter-spacing: 0.12em; text-transform: uppercase; display: block; margin-bottom: 6px; }
        .not-btn-traer { padding: 5px 10px; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: 3px; color: #8b5cf6; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .not-btn-traer:hover { background: rgba(139,92,246,0.2); }
        .not-btn-traer:disabled { opacity: 0.5; cursor: not-allowed; }
        .not-btn-publicar-ai { padding: 8px 16px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 3px; color: #3abab6; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .not-btn-publicar-ai:hover { background: rgba(34,197,94,0.2); }
        .not-btn-publicar-ai:disabled { opacity: 0.5; cursor: not-allowed; }
        .not-btn-descartar-ai { padding: 8px 16px; background: transparent; border: 1px solid var(--gfi-border); border-radius: 3px; color: var(--gfi-text-muted); font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .not-btn-descartar-ai:hover { border-color: rgba(200,0,0,0.3); color: #990000; }
        .not-btn-descartar-ai:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 768px) {
          .not-container { flex-direction: column; height: auto; }
          .not-sidebar { width: 100%; height: 320px; }
          .not-detalle { min-height: 400px; }
        }
      `}</style>

      {/* Barra superior */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "#fff" }}>
            Noticias <span style={{ color: "#990000" }}>del Sector</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 2 }}>
            Información relevante para el corredor inmobiliario
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {esAdmin && vista === "ai" && (
            <button className="not-btn-traer" style={{ fontSize: 11, padding: "8px 16px" }} onClick={traerNoticiasAI} disabled={aiFeedFetchando}>
              {aiFeedFetchando ? "Buscando..." : "🤖 Traer noticias ahora"}
            </button>
          )}
          {esAdmin && vista !== "ai" && (
            <button className="not-btn-verificar" onClick={verificarRedes} disabled={verificando}>
              {verificando ? "Verificando..." : "🔍 Verificar redes"}
            </button>
          )}
          {vista !== "ai" && (
            <button className="not-btn-nueva" onClick={() => setMostrarForm(true)}>
              + Nueva noticia
            </button>
          )}
        </div>
      </div>

      {/* Panel de verificación de tokens */}
      {mostrarVerificacion && (
        <div className="not-verif-panel">
          <div className="not-verif-titulo">
            <span>Estado de conexiones — Chequeo interno</span>
            <button onClick={() => setMostrarVerificacion(false)} style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", fontSize: 16, cursor: "pointer" }}>✕</button>
          </div>
          {verificando ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--gfi-text-muted)", fontSize: 13 }}>
              <div style={{ width: 16, height: 16, border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
              Consultando APIs de cada red social...
            </div>
          ) : (
            <div className="not-verif-grid">
              {(verificacionResult ?? []).map(r => (
                <div key={r.red} className="not-verif-card" style={{ background: r.ok ? "rgba(34,197,94,0.05)" : r.configurada ? "rgba(239,68,68,0.05)" : "var(--gfi-bg-card)", borderColor: r.ok ? "rgba(34,197,94,0.2)" : r.configurada ? "rgba(239,68,68,0.2)" : "var(--gfi-border-subtle)" }}>
                  <div className="not-verif-red" style={{ color: r.ok ? "#3abab6" : r.configurada ? "#b80000" : "var(--gfi-text-muted)" }}>
                    {r.ok ? "✓" : r.configurada ? "✗" : "—"} {r.red}
                  </div>
                  {r.ok ? (
                    <>
                      <div className="not-verif-nombre" style={{ color: "#fff" }}>{r.nombre}</div>
                      {r.detalle && <div className="not-verif-detalle" style={{ color: "var(--gfi-text-secondary)" }}>{r.detalle}</div>}
                    </>
                  ) : (
                    <div className="not-verif-error" style={{ color: r.configurada ? "#b80000" : "var(--gfi-text-muted)" }}>
                      {r.error ?? (r.configurada ? "Error de autenticación" : "Sin configurar")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
          <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : errorCarga ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
          <span style={{ fontSize: 36 }}>⚠️</span>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--gfi-text-secondary)" }}>No se pudieron cargar las noticias</div>
          <button
            onClick={() => cargarNoticias(esAdmin)}
            style={{ padding: "8px 20px", background: "rgba(153,0,0,0.12)", border: "1px solid rgba(153,0,0,0.3)", borderRadius: 4, color: "#990000", fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em" }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="not-container">
          {/* Sidebar lista */}
          <div className="not-sidebar">
            <div className="not-sidebar-header">
              <span className="not-sidebar-title">Noticias</span>
            </div>

            {esAdmin && (
              <div className="not-tabs">
                <button className={`not-tab${vista === "todas" ? " activo" : ""}`} onClick={() => setVista("todas")}>
                  Publicadas
                </button>
                <button className={`not-tab${vista === "pendientes" ? " activo" : ""}`} onClick={() => setVista("pendientes")} style={{ position: "relative", borderLeft: "none" }}>
                  Pendientes
                  {pendientesCount > 0 && <span className="not-tab-badge">{pendientesCount}</span>}
                </button>
                <button className={`not-tab${vista === "ai" ? " activo" : ""}`} onClick={() => { setVista("ai"); if (aiFeedItems.length === 0) cargarAiFeed(); }} style={{ borderLeft: "none" }}>
                  🤖 AI
                  {aiFeedItems.length > 0 && <span className="not-tab-badge">{aiFeedItems.length}</span>}
                </button>
              </div>
            )}

            <div className="not-lista">
              {vista === "ai" ? (
                aiFeedLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <div style={{ width: 20, height: 20, border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  </div>
                ) : aiFeedItems.length === 0 ? (
                  <div className="not-empty">
                    Sin noticias AI pendientes.<br />Presioná "Traer noticias ahora" para buscar.
                  </div>
                ) : (
                  aiFeedItems.map(item => {
                    const scoreColor = item.score >= 70 ? "#3abab6" : item.score >= 50 ? "#d4960c" : "#fb923c";
                    const scoreBg = item.score >= 70 ? "rgba(34,197,94,0.15)" : item.score >= 50 ? "rgba(234,179,8,0.15)" : "rgba(251,146,60,0.15)";
                    const scoreBorder = item.score >= 70 ? "rgba(34,197,94,0.3)" : item.score >= 50 ? "rgba(234,179,8,0.3)" : "rgba(251,146,60,0.3)";
                    return (
                      <div key={item.id} className={`not-item${aiFeedActivo?.id === item.id ? " activo" : ""}`} onClick={() => setAiFeedActivo(item)}>
                        {item.imagen_url
                          ? <img src={item.imagen_url} alt="" className="not-item-img" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          : <div className="not-item-img-placeholder">🤖</div>
                        }
                        <div className="not-item-info">
                          <div className="not-item-titulo">{item.titulo}</div>
                          <div className="not-item-meta">
                            {item.fuente && <span className="not-item-fuente">{item.fuente}</span>}
                            <span className="not-ai-score" style={{ background: scoreBg, color: scoreColor, border: `1px solid ${scoreBorder}` }}>{item.score}</span>
                            {item.categoria && <span className="not-ai-cat">{item.categoria}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : noticiasFiltradas.length === 0 ? (
                <div className="not-empty">
                  {vista === "pendientes" ? "No hay noticias pendientes." : "No hay noticias publicadas todavía."}
                </div>
              ) : noticiasFiltradas.map(n => (
                <div key={n.id} className={`not-item${noticiaActiva?.id === n.id ? " activo" : ""}`} onClick={() => setNoticiaActiva(n)}>
                  {n.imagen_url
                    ? <img src={n.imagen_url} alt="" className="not-item-img" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    : <div className="not-item-img-placeholder">📰</div>
                  }
                  <div className="not-item-info">
                    <div className="not-item-titulo">{n.titulo}</div>
                    <div className="not-item-meta">
                      {n.fuente && <span className="not-item-fuente">{n.fuente}</span>}
                      <span>{formatFechaCorta(n.created_at)}</span>
                      {n.destacado && <span className="not-badge-dest">★ Dest.</span>}
                      {n.estado === "pendiente" && <span className="not-badge-pend">Pendiente</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detalle */}
          <div className="not-detalle">
            {vista === "ai" ? (
              !aiFeedActivo ? (
                <div className="not-detalle-empty">
                  <span style={{ fontSize: 48 }}>🤖</span>
                  <span style={{ fontSize: 13 }}>Seleccioná una noticia AI para revisarla</span>
                  <span style={{ fontSize: 11, color: "var(--gfi-border)" }}>Las noticias se ordenan por relevancia inmobiliaria</span>
                </div>
              ) : (
                <>
                  {aiFeedActivo.imagen_url && (
                    <img src={aiFeedActivo.imagen_url} alt="" className="not-detalle-imagen"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="not-detalle-body">
                    {aiFeedActivo.fuente && <div className="not-detalle-fuente">{aiFeedActivo.fuente}</div>}
                    <div className="not-detalle-titulo">{aiFeedActivo.titulo}</div>
                    <div className="not-detalle-meta">
                      {(() => {
                        const s = aiFeedActivo.score;
                        const c = s >= 70 ? "#3abab6" : s >= 50 ? "#d4960c" : "#fb923c";
                        const bg = s >= 70 ? "rgba(34,197,94,0.12)" : s >= 50 ? "rgba(234,179,8,0.12)" : "rgba(251,146,60,0.12)";
                        const bd = s >= 70 ? "rgba(34,197,94,0.3)" : s >= 50 ? "rgba(234,179,8,0.3)" : "rgba(251,146,60,0.3)";
                        return (
                          <span className="not-ai-score" style={{ background: bg, color: c, border: `1px solid ${bd}`, fontSize: 11, padding: "2px 8px" }}>
                            Relevancia: {s}/100
                          </span>
                        );
                      })()}
                      {aiFeedActivo.categoria && <span style={{ fontFamily: "Montserrat", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gfi-text-muted)", background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", padding: "2px 8px", borderRadius: 3 }}>{aiFeedActivo.categoria}</span>}
                      {aiFeedActivo.fecha_fuente && <span>· {formatFecha(aiFeedActivo.fecha_fuente)}</span>}
                    </div>
                    {aiFeedActivo.resumen && (
                      <div className="not-ai-resumen">
                        <span className="not-ai-resumen-label">Análisis IA</span>
                        {aiFeedActivo.resumen}
                      </div>
                    )}
                    <a href={aiFeedActivo.url} target="_blank" rel="noopener noreferrer" className="not-detalle-link">
                      🔗 Ver noticia original
                    </a>
                    <div className="not-detalle-actions">
                      <button className="not-btn-publicar-ai" onClick={() => publicarDesdeAI(aiFeedActivo)} disabled={!!publicandoAI}>
                        {publicandoAI === aiFeedActivo.id ? "Publicando..." : "✓ Publicar en noticias"}
                      </button>
                      <button className="not-btn-descartar-ai" onClick={() => descartarAI(aiFeedActivo)} disabled={!!descartandoAI}>
                        {descartandoAI === aiFeedActivo.id ? "Descartando..." : "✗ Descartar"}
                      </button>
                    </div>
                  </div>
                </>
              )
            ) : !noticiaActiva ? (
              <div className="not-detalle-empty">
                <span style={{ fontSize: 48 }}>📰</span>
                <span style={{ fontSize: 13 }}>Seleccioná una noticia para leerla</span>
              </div>
            ) : (
              <>
                {noticiaActiva.imagen_url && (
                  <img src={noticiaActiva.imagen_url} alt="" className="not-detalle-imagen"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="not-detalle-body">
                  {noticiaActiva.fuente && (
                    <div className="not-detalle-fuente">{noticiaActiva.fuente}</div>
                  )}
                  <div className="not-detalle-titulo">{noticiaActiva.titulo}</div>
                  <div className="not-detalle-meta">
                    <span>{formatFecha(noticiaActiva.created_at)}</span>
                    {noticiaActiva.perfiles && (
                      <span>· Por {noticiaActiva.perfiles.nombre} {noticiaActiva.perfiles.apellido}</span>
                    )}
                    {noticiaActiva.destacado && <span className="not-badge-dest">★ Destacada</span>}
                    {noticiaActiva.estado === "pendiente" && <span className="not-badge-pend">Pendiente de aprobación</span>}
                  </div>
                  <div className="not-detalle-cuerpo">{noticiaActiva.cuerpo}</div>
                  {noticiaActiva.link && (
                    <a href={noticiaActiva.link} target="_blank" rel="noopener noreferrer" className="not-detalle-link">
                      🔗 Ver fuente original
                    </a>
                  )}

                  {esAdmin && (
                    <div>
                      <div className="not-detalle-actions">
                        {noticiaActiva.estado === "pendiente" && (
                          <>
                            <button className="not-btn-aprobar" onClick={() => aprobar(noticiaActiva.id)} disabled={aprobando === noticiaActiva.id}>
                              {aprobando === noticiaActiva.id ? "Aprobando..." : "✓ Aprobar"}
                            </button>
                            <button className="not-btn-rechazar" onClick={() => rechazar(noticiaActiva.id)}>
                              Rechazar
                            </button>
                          </>
                        )}
                        {noticiaActiva.estado === "aprobada" && (
                          <button className="not-btn-redes" onClick={() => publicarEnRedes(noticiaActiva)} disabled={publicandoRedes === noticiaActiva.id}>
                            {publicandoRedes === noticiaActiva.id ? "Publicando..." : "📤 Publicar en redes"}
                          </button>
                        )}
                        <button className="not-btn-dest" onClick={() => toggleDestacado(noticiaActiva.id, noticiaActiva.destacado)}>
                          {noticiaActiva.destacado ? "Quitar destacado" : "★ Destacar"}
                        </button>
                        <button className="not-btn-eliminar" onClick={() => eliminar(noticiaActiva.id)}>
                          Eliminar
                        </button>
                      </div>
                      {redesResultados[noticiaActiva.id] && (
                        <div className="not-redes-resultado">
                          {redesResultados[noticiaActiva.id].map(r => (
                            <span key={r.red} className="not-red-badge" style={{ background: r.ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: r.ok ? "#3abab6" : "#b80000", border: `1px solid ${r.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                              {r.ok ? "✓" : "✗"} {r.red}{!r.ok && r.error ? ` · ${r.error}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal nueva noticia */}
      {mostrarForm && (
        <div className="not-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="not-modal">
            <div className="not-modal-title">Nueva <span>noticia</span></div>

            <div className="not-field">
              <label className="not-label">Título *</label>
              <input className="not-input" placeholder="Título de la noticia" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} />
            </div>
            <div className="not-field">
              <label className="not-label">Contenido *</label>
              <textarea className="not-textarea" placeholder="Cuerpo de la noticia..." value={form.cuerpo} onChange={e => setForm(p => ({ ...p, cuerpo: e.target.value }))} />
            </div>
            <div className="not-field">
              <label className="not-label">Fuente</label>
              <input className="not-input" placeholder="Ej: Infobae, La Nación, COCIR..." value={form.fuente} onChange={e => setForm(p => ({ ...p, fuente: e.target.value }))} />
            </div>
            <div className="not-field">
              <label className="not-label">Link externo</label>
              <div style={{position:"relative"}}>
                <input
                  className="not-input"
                  placeholder="Pegá el link y se autocompleta..."
                  value={form.link}
                  onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                  onBlur={e => fetchLinkPreview(e.target.value)}
                  onPaste={e => { const url = e.clipboardData.getData("text"); setTimeout(() => fetchLinkPreview(url), 100); }}
                  style={{paddingRight: fetchandoLink ? 36 : undefined}}
                />
                {fetchandoLink && (
                  <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",width:14,height:14,border:"2px solid rgba(200,0,0,0.3)",borderTopColor:"#990000",borderRadius:"50%",animation:"not-spin 0.7s linear infinite"}}/>
                )}
              </div>
            </div>
            <div className="not-field">
              <label className="not-label">URL de imagen</label>
              <input className="not-input" placeholder="https://imagen.jpg" value={form.imagen_url} onChange={e => setForm(p => ({ ...p, imagen_url: e.target.value }))} />
            </div>
            {esAdmin && (
              <div className="not-field">
                <div className="not-toggle-row" onClick={() => setForm(p => ({ ...p, destacado: !p.destacado }))}>
                  <div className="not-toggle" style={{ background: form.destacado ? "#990000" : "var(--gfi-border)" }}>
                    <div className="not-toggle-knob" style={{ left: form.destacado ? 19 : 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Marcar como destacada</span>
                </div>
              </div>
            )}
            {!esAdmin && (
              <div style={{ fontSize: 11, color: "var(--gfi-text-dim)", background: "rgba(200,0,0,0.04)", border: "1px solid rgba(200,0,0,0.1)", borderRadius: 4, padding: "8px 12px", marginBottom: 14 }}>
                Tu noticia quedará pendiente de aprobación por un administrador.
              </div>
            )}
            <div className="not-modal-actions">
              <button className="not-btn-cancelar" onClick={() => { setMostrarForm(false); setForm(FORM_VACIO); }}>Cancelar</button>
              <button className="not-btn-guardar" onClick={guardarNoticia} disabled={guardando || !form.titulo.trim() || !form.cuerpo.trim()}>
                {guardando && <span className="not-spinner" />}
                {guardando ? "Guardando..." : "Publicar noticia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
