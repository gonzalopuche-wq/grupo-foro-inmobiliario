"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  foto_url: string | null;
}

interface Adjunto {
  url: string;
  nombre: string;
  tipo: "imagen" | "video" | "documento" | "audio";
  tamano?: number;
}

interface Mensaje {
  id: string;
  grupo_id: string;
  perfil_id: string;
  texto: string | null;
  adjuntos: Adjunto[] | null;
  reply_id: string | null;
  editado: boolean;
  created_at: string;
  perfiles?: Perfil;
  _reply?: { texto: string | null; perfiles?: { nombre: string; apellido: string } };
}

interface Grupo {
  id: string;
  nombre: string;
  icono: string;
  tipo: string;
  va_al_mir: boolean;
  solo_matriculado: boolean;
  descripcion: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fullName = (p?: Perfil | null) =>
  p ? `${p.apellido ?? ""}, ${p.nombre ?? ""}`.replace(/^, /, "") : "—";

const initials = (p?: Perfil | null) =>
  p ? `${p.nombre?.charAt(0) ?? ""}${p.apellido?.charAt(0) ?? ""}`.toUpperCase() : "?";

const timeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};

const fmtSegundos = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

// ── Componente principal ───────────────────────────────────────────────────
export default function GrupoChatPage() {
  const params = useParams();
  const grupoId = params?.grupoId as string;
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userPerfil, setUserPerfil] = useState<Perfil | null>(null);
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [replyMsg, setReplyMsg] = useState<Mensaje | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [subiendoAdj, setSubiendoAdj] = useState(false);

  // Audio
  const [grabando, setGrabando] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSegundos, setAudioSegundos] = useState(0);
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileImgRef = useRef<HTMLInputElement>(null);
  const fileDocRef = useRef<HTMLInputElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!grupoId) return;
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);

      const [{ data: perfil }, { data: grupoData }] = await Promise.all([
        supabase.from("perfiles").select("id,nombre,apellido,matricula,foto_url").eq("id", auth.user.id).single(),
        supabase.from("grupos_chat").select("*").eq("id", grupoId).single(),
      ]);

      if (!grupoData) { router.push("/comunidad"); return; }

      // Verificar acceso
      const tipo = (perfil as any)?.tipo ?? "corredor";
      if (tipo === "colaborador" && grupoData.solo_matriculado) {
        router.push("/comunidad"); return;
      }

      setUserPerfil(perfil as Perfil);
      setGrupo(grupoData as Grupo);
      await cargarMensajes();
      setLoading(false);
      suscribir();
    };
    init();
    return () => { supabase.channel(`chat_${grupoId}`).unsubscribe(); };
  }, [grupoId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // ── Carga y suscripción ───────────────────────────────────────────────────
  const cargarMensajes = async () => {
    const { data } = await supabase
      .from("mensajes_chat")
      .select("*, perfiles(id,nombre,apellido,matricula,foto_url)")
      .eq("grupo_id", grupoId)
      .order("created_at", { ascending: true })
      .limit(200);
    const msgs = (data as Mensaje[]) ?? [];
    // Cargar replies
    const conReply = await Promise.all(
      msgs.map(async m => {
        if (!m.reply_id) return m;
        const { data: r } = await supabase
          .from("mensajes_chat").select("texto, perfiles(nombre,apellido)").eq("id", m.reply_id).single();
        return { ...m, _reply: r ?? null };
      })
    );
    setMensajes(conReply);
  };

  const suscribir = () => {
    supabase
      .channel(`chat_${grupoId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_chat", filter: `grupo_id=eq.${grupoId}` },
        async ({ new: row }) => {
          const { data } = await supabase.from("mensajes_chat").select("*, perfiles(id,nombre,apellido,matricula,foto_url)").eq("id", (row as any).id).single();
          if (!data) return;
          let msg = data as Mensaje;
          if (msg.reply_id) {
            const { data: r } = await supabase.from("mensajes_chat").select("texto, perfiles(nombre,apellido)").eq("id", msg.reply_id).single();
            msg = { ...msg, _reply: r ?? null };
          }
          setMensajes(prev => [...prev, msg]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mensajes_chat", filter: `grupo_id=eq.${grupoId}` },
        async ({ new: row }) => {
          const { data } = await supabase.from("mensajes_chat").select("*, perfiles(id,nombre,apellido,matricula,foto_url)").eq("id", (row as any).id).single();
          if (data) setMensajes(prev => prev.map(m => m.id === (data as any).id ? { ...data as Mensaje, _reply: m._reply } : m));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mensajes_chat", filter: `grupo_id=eq.${grupoId}` },
        ({ old: row }) => setMensajes(prev => prev.filter(m => m.id !== (row as any).id)))
      .subscribe();
  };

  // ── Adjuntos ──────────────────────────────────────────────────────────────
  const subirAdjunto = async (file: File): Promise<Adjunto | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const esImg = ["jpg","jpeg","png","gif","webp","heic"].includes(ext);
    const esVid = ["mp4","mov","avi","webm","mkv"].includes(ext);
    const tipo: Adjunto["tipo"] = esImg ? "imagen" : esVid ? "video" : "documento";
    const path = `grupos/${grupoId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("adjuntos_chat").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) return null;
    const { data: u } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    return { url: u.publicUrl, nombre: file.name, tipo, tamano: file.size };
  };

  const manejarArchivos = async (files: FileList | null) => {
    if (!files) return;
    setSubiendoAdj(true);
    const nuevos: Adjunto[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { alert(`${file.name} supera 20MB`); continue; }
      const a = await subirAdjunto(file);
      if (a) nuevos.push(a);
    }
    setAdjuntos(prev => [...prev, ...nuevos]);
    setSubiendoAdj(false);
  };

  // ── Audio ─────────────────────────────────────────────────────────────────
  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setGrabando(true);
      setAudioSegundos(0);
      audioTimerRef.current = setInterval(() => setAudioSegundos(s => s + 1), 1000);
    } catch { alert("No se pudo acceder al micrófono. Verificá los permisos del navegador."); }
  };

  const detenerGrabacion = () => {
    mediaRecorderRef.current?.stop();
    setGrabando(false);
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
  };

  const cancelarAudio = () => {
    mediaRecorderRef.current?.stop();
    setGrabando(false); setAudioBlob(null); setAudioUrl(null); setAudioSegundos(0);
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
  };

  const enviarAudio = async () => {
    if (!audioBlob || !userId) return;
    setSubiendoAudio(true);
    const ext = audioBlob.type.includes("webm") ? "webm" : "ogg";
    const nombre = `audio_${Date.now()}.${ext}`;
    const path = `grupos/${grupoId}/${nombre}`;
    const file = new File([audioBlob], nombre, { type: audioBlob.type });
    const { error } = await supabase.storage.from("adjuntos_chat").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { alert("Error al subir audio"); setSubiendoAudio(false); return; }
    const { data: u } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    const adj: Adjunto = { url: u.publicUrl, nombre, tipo: "audio", tamano: audioBlob.size };
    const insertData: any = {
      grupo_id: grupoId, perfil_id: userId, texto: null, adjuntos: [adj],
    };
    if (replyMsg?.id) insertData.reply_id = replyMsg.id;
    await supabase.from("mensajes_chat").insert(insertData);
    setAudioBlob(null); setAudioUrl(null); setAudioSegundos(0);
    setReplyMsg(null); setSubiendoAudio(false);
  };

  // ── CRUD mensajes ─────────────────────────────────────────────────────────
  const enviar = async () => {
    if ((!input.trim() && adjuntos.length === 0) || !userId) return;
    setEnviando(true);
    const datos: any = {
      grupo_id: grupoId, perfil_id: userId,
      texto: input.trim() || null,
      adjuntos: adjuntos.length > 0 ? adjuntos : null,
    };
    if (replyMsg?.id) datos.reply_id = replyMsg.id;
    setInput(""); setAdjuntos([]); setReplyMsg(null);
    await supabase.from("mensajes_chat").insert(datos);
    setEnviando(false);
    inputRef.current?.focus();
  };

  const editar = async (id: string) => {
    if (!editText.trim()) return;
    await supabase.from("mensajes_chat").update({ texto: editText.trim(), editado: true }).eq("id", id);
    setEditandoId(null); setEditText("");
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este mensaje?")) return;
    await supabase.from("mensajes_chat").delete().eq("id", id);
  };

  const esMio = (m: Mensaje) => m.perfil_id === userId;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .gc-root { display: flex; flex-direction: column; height: calc(100vh - 110px); background: #0a0a0a; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); }
        /* Header */
        .gc-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); background: #0f0f0f; flex-shrink: 0; }
        .gc-back { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 18px; cursor: pointer; padding: 4px 8px; }
        .gc-back:hover { color: #fff; }
        .gc-header-ico { width: 38px; height: 38px; border-radius: 9px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .gc-header-info { flex: 1; min-width: 0; }
        .gc-header-nombre { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .gc-header-sub { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; }
        .gc-mir-badge { font-size: 9px; padding: 2px 7px; border-radius: 3px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.2); color: #cc0000; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        /* Mensajes */
        .gc-msgs { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
        .gc-msgs::-webkit-scrollbar { width: 3px; }
        .gc-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        /* Burbuja */
        .gc-msg { display: flex; gap: 8px; padding: 3px 0; position: relative; }
        .gc-msg.mio { flex-direction: row-reverse; }
        .gc-avatar { width: 30px; height: 30px; border-radius: 8px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.15); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 800; color: #cc0000; flex-shrink: 0; overflow: hidden; align-self: flex-end; }
        .gc-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .gc-bubble-wrap { max-width: 72%; display: flex; flex-direction: column; }
        .gc-msg.mio .gc-bubble-wrap { align-items: flex-end; }
        /* ── IDENTIDAD COCIR: nombre + matrícula ── */
        .gc-identidad { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; flex-wrap: wrap; }
        .gc-identidad-nombre { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: rgba(200,0,0,0.8); cursor: pointer; }
        .gc-identidad-nombre:hover { color: #cc0000; }
        .gc-identidad-mat { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; font-weight: 600; }
        .gc-msg.mio .gc-identidad { justify-content: flex-end; flex-direction: row-reverse; }
        .gc-bubble { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px 12px 12px 3px; padding: 8px 12px; position: relative; cursor: pointer; }
        .gc-msg.mio .gc-bubble { background: rgba(200,0,0,0.09); border-color: rgba(200,0,0,0.18); border-radius: 12px 12px 3px 12px; }
        .gc-bubble:hover { border-color: rgba(255,255,255,0.15); }
        .gc-msg.mio .gc-bubble:hover { border-color: rgba(200,0,0,0.3); }
        .gc-reply-preview { background: rgba(255,255,255,0.04); border-left: 2px solid rgba(200,0,0,0.4); border-radius: 4px; padding: 4px 8px; margin-bottom: 5px; }
        .gc-reply-autor { font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; color: rgba(200,0,0,0.6); margin-bottom: 1px; }
        .gc-reply-txt { font-size: 11px; color: rgba(255,255,255,0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gc-txt { font-size: 13px; color: rgba(255,255,255,0.85); font-family: 'Inter',sans-serif; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
        .gc-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
        .gc-msg.mio .gc-meta { justify-content: flex-end; }
        .gc-hora { font-size: 9px; color: rgba(255,255,255,0.2); font-family: 'Inter',sans-serif; }
        .gc-editado { font-size: 9px; color: rgba(255,255,255,0.18); font-style: italic; }
        /* Menú contextual */
        .gc-menu { position: absolute; top: -8px; right: 0; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px; display: flex; gap: 3px; z-index: 10; box-shadow: 0 4px 16px rgba(0,0,0,0.5); }
        .gc-msg.mio .gc-menu { right: auto; left: 0; }
        .gc-menu-btn { padding: 4px 8px; border-radius: 4px; background: none; border: none; font-size: 10px; color: rgba(255,255,255,0.5); cursor: pointer; font-family: 'Montserrat',sans-serif; font-weight: 700; white-space: nowrap; }
        .gc-menu-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .gc-menu-btn.rojo { color: rgba(200,0,0,0.6); }
        .gc-menu-btn.rojo:hover { background: rgba(200,0,0,0.08); color: #cc0000; }
        /* Input área */
        .gc-input-area { border-top: 1px solid rgba(255,255,255,0.06); padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; background: #0f0f0f; }
        .gc-reply-bar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(200,0,0,0.06); border: 1px solid rgba(200,0,0,0.15); border-radius: 5px; }
        .gc-reply-bar-txt { flex: 1; font-size: 11px; color: rgba(255,255,255,0.4); font-family: 'Inter',sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gc-reply-bar-x { background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; font-size: 16px; padding: 0; }
        .gc-adj-btn { width: 34px; height: 34px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 6px; color: rgba(255,255,255,0.5); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
        .gc-adj-btn:hover { border-color: rgba(200,0,0,0.35); color: #cc0000; }
        .gc-input { flex: 1; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .gc-input:focus { border-color: rgba(200,0,0,0.35); }
        .gc-input::placeholder { color: rgba(255,255,255,0.2); }
        .gc-send { padding: 9px 16px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .gc-send:hover { background: #e60000; }
        .gc-send:disabled { opacity: 0.45; cursor: not-allowed; }
        /* Audio */
        .gc-audio-grabando { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); border-radius: 6px; }
        .gc-audio-dot { width: 10px; height: 10px; border-radius: 50%; background: #cc0000; animation: pulse-dot 1s ease-in-out infinite; flex-shrink: 0; }
        .gc-audio-preview { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; }
        @keyframes pulse-dot { 0%,100% { opacity:1;transform:scale(1); } 50% { opacity:.4;transform:scale(.8); } }
        /* Adjuntos pendientes */
        .gc-adjs-preview { display: flex; gap: 6px; flex-wrap: wrap; }
        .gc-adj-thumb { position: relative; width: 56px; height: 56px; border-radius: 6px; overflow: hidden; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
        .gc-adj-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .gc-adj-thumb-x { position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; border-radius: 50%; background: rgba(0,0,0,0.7); border: none; color: #fff; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        /* Render adjuntos en mensaje */
        .gc-adj-img { max-width: 100%; max-height: 200px; border-radius: 8px; display: block; cursor: pointer; margin-top: 4px; }
        .gc-adj-audio { display: flex; align-items: center; gap: 8px; background: rgba(200,0,0,0.06); border: 1px solid rgba(200,0,0,0.15); border-radius: 8px; padding: 8px 10px; margin-top: 4px; }
        .gc-adj-doc { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 6px; padding: 7px 10px; margin-top: 4px; text-decoration: none; }
        .gc-adj-doc-name { font-size: 11px; color: rgba(255,255,255,0.6); font-family: 'Inter',sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* Día separador */
        .gc-dia { text-align: center; margin: 10px 0; }
        .gc-dia-txt { font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 3px 12px; display: inline-block; }
        /* Edit */
        .gc-edit-area { display: flex; gap: 6px; flex-direction: column; }
        .gc-edit-input { width: 100%; padding: 7px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(200,0,0,0.3); border-radius: 4px; color: #fff; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; resize: none; box-sizing: border-box; }
        .gc-edit-btns { display: flex; gap: 6px; justify-content: flex-end; }
        .gc-edit-save { padding: 4px 12px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; cursor: pointer; }
        .gc-edit-cancel { padding: 4px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; cursor: pointer; }
      `}</style>

      <div className="gc-root">
        {/* Header */}
        <div className="gc-header">
          <button className="gc-back" onClick={() => router.push("/comunidad")}>←</button>
          <div className="gc-header-ico">{grupo?.icono ?? "💬"}</div>
          <div className="gc-header-info">
            <div className="gc-header-nombre">{grupo?.nombre}</div>
            <div className="gc-header-sub">
              {mensajes.length} mensajes
              {grupo?.va_al_mir && " · Conectado al MIR"}
            </div>
          </div>
          {grupo?.va_al_mir && <span className="gc-mir-badge">MIR</span>}
        </div>

        {/* Mensajes */}
        <div className="gc-msgs" onClick={() => setMenuId(null)}>
          {mensajes.map((m, idx) => {
            const mio = esMio(m);
            const p = m.perfiles;
            const diaActual = m.created_at.split("T")[0];
            const diaAnterior = idx > 0 ? mensajes[idx - 1].created_at.split("T")[0] : null;
            const mostrarDia = diaActual !== diaAnterior;
            const adjs = m.adjuntos ?? [];

            return (
              <div key={m.id}>
                {mostrarDia && (
                  <div className="gc-dia">
                    <span className="gc-dia-txt">
                      {new Date(m.created_at).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </div>
                )}
                <div className={`gc-msg${mio ? " mio" : ""}`}>
                  {/* Avatar */}
                  <div className="gc-avatar">
                    {p?.foto_url
                      ? <img src={p.foto_url} alt={p.nombre} />
                      : initials(p)}
                  </div>

                  <div className="gc-bubble-wrap">
                    {/* ── IDENTIDAD COCIR: siempre visible ── */}
                    {!mio && (
                      <div className="gc-identidad">
                        <span className="gc-identidad-nombre">{fullName(p)}</span>
                        {p?.matricula
                          ? <span className="gc-identidad-mat">Mat. {p.matricula}</span>
                          : <span className="gc-identidad-mat" style={{color:"rgba(200,0,0,0.4)"}}>Sin matrícula</span>
                        }
                      </div>
                    )}
                    {mio && (
                      <div className="gc-identidad">
                        <span className="gc-identidad-mat" style={{color:"rgba(255,255,255,0.2)"}}>
                          {userPerfil?.matricula ? `Mat. ${userPerfil.matricula}` : "Sin matrícula"}
                        </span>
                        <span className="gc-identidad-nombre" style={{color:"rgba(255,255,255,0.5)"}}>Vos</span>
                      </div>
                    )}

                    {/* Burbuja */}
                    <div
                      className="gc-bubble"
                      onClick={e => { e.stopPropagation(); setMenuId(menuId === m.id ? null : m.id); }}
                    >
                      {/* Menú contextual */}
                      {menuId === m.id && (
                        <div className="gc-menu">
                          <button className="gc-menu-btn" onClick={e => { e.stopPropagation(); setReplyMsg(m); setMenuId(null); inputRef.current?.focus(); }}>↩ Responder</button>
                          {mio && m.texto && (
                            <button className="gc-menu-btn" onClick={e => { e.stopPropagation(); setEditandoId(m.id); setEditText(m.texto ?? ""); setMenuId(null); }}>✏️ Editar</button>
                          )}
                          {mio && (
                            <button className="gc-menu-btn rojo" onClick={e => { e.stopPropagation(); eliminar(m.id); setMenuId(null); }}>🗑 Eliminar</button>
                          )}
                        </div>
                      )}

                      {/* Reply preview */}
                      {m._reply && (
                        <div className="gc-reply-preview">
                          <div className="gc-reply-autor">
                            {(m._reply as any).perfiles
                              ? `${(m._reply as any).perfiles.nombre} ${(m._reply as any).perfiles.apellido}`
                              : "Mensaje"}
                          </div>
                          <div className="gc-reply-txt">{m._reply.texto ?? "🎙 Audio"}</div>
                        </div>
                      )}

                      {/* Modo edición */}
                      {editandoId === m.id ? (
                        <div className="gc-edit-area">
                          <textarea ref={editRef} className="gc-edit-input" value={editText} onChange={e => setEditText(e.target.value)} rows={2} />
                          <div className="gc-edit-btns">
                            <button className="gc-edit-cancel" onClick={() => setEditandoId(null)}>Cancelar</button>
                            <button className="gc-edit-save" onClick={() => editar(m.id)}>Guardar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Texto */}
                          {m.texto && <div className="gc-txt">{m.texto}</div>}

                          {/* Adjuntos */}
                          {adjs.map((a, i) => {
                            if (a.tipo === "audio") return (
                              <div key={i} className="gc-adj-audio">
                                <span style={{fontSize:18}}>🎙</span>
                                <audio src={a.url} controls style={{flex:1,height:32,minWidth:0}} />
                              </div>
                            );
                            if (a.tipo === "imagen") return (
                              <img key={i} src={a.url} alt={a.nombre} className="gc-adj-img" onClick={e => { e.stopPropagation(); window.open(a.url, "_blank"); }} />
                            );
                            if (a.tipo === "video") return (
                              <video key={i} src={a.url} controls style={{maxWidth:"100%",maxHeight:200,borderRadius:8,marginTop:4,display:"block"}} />
                            );
                            return (
                              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="gc-adj-doc" onClick={e => e.stopPropagation()}>
                                <span style={{fontSize:16}}>📎</span>
                                <span className="gc-adj-doc-name">{a.nombre}</span>
                              </a>
                            );
                          })}
                        </>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="gc-meta">
                      <span className="gc-hora">{timeAgo(m.created_at)}</span>
                      {m.editado && <span className="gc-editado">editado</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Input área */}
        <div className="gc-input-area">
          {/* Reply bar */}
          {replyMsg && (
            <div className="gc-reply-bar">
              <span style={{fontSize:12,color:"rgba(200,0,0,0.6)",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>↩</span>
              <span className="gc-reply-bar-txt">
                {fullName(replyMsg.perfiles)}: {replyMsg.texto ?? "🎙 Audio"}
              </span>
              <button className="gc-reply-bar-x" onClick={() => setReplyMsg(null)}>×</button>
            </div>
          )}

          {/* Adjuntos pendientes */}
          {adjuntos.length > 0 && (
            <div className="gc-adjs-preview">
              {adjuntos.map((a, i) => (
                <div key={i} className="gc-adj-thumb">
                  {a.tipo === "imagen"
                    ? <img src={a.url} alt={a.nombre} />
                    : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{a.tipo === "video" ? "🎬" : "📎"}</div>
                  }
                  <button className="gc-adj-thumb-x" onClick={() => setAdjuntos(prev => prev.filter((_,j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Grabando audio */}
          {grabando && (
            <div className="gc-audio-grabando">
              <div className="gc-audio-dot" />
              <span style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>Grabando {fmtSegundos(audioSegundos)}</span>
              <button onClick={detenerGrabacion} style={{marginLeft:"auto",padding:"4px 12px",background:"#cc0000",border:"none",borderRadius:4,color:"#fff",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}}>⏹ Detener</button>
              <button onClick={cancelarAudio} style={{padding:"4px 10px",background:"transparent",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,color:"rgba(255,255,255,0.4)",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}}>✕</button>
            </div>
          )}

          {/* Preview audio grabado */}
          {audioUrl && !grabando && (
            <div className="gc-audio-preview">
              <span style={{fontSize:16}}>🎙</span>
              <audio src={audioUrl} controls style={{flex:1,height:32,minWidth:0}} />
              <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"Montserrat,sans-serif"}}>{fmtSegundos(audioSegundos)}</span>
              <button onClick={enviarAudio} disabled={subiendoAudio} style={{padding:"5px 12px",background:"#cc0000",border:"none",borderRadius:4,color:"#fff",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                {subiendoAudio ? "Enviando..." : "Enviar"}
              </button>
              <button onClick={cancelarAudio} style={{padding:"5px 8px",background:"transparent",border:"1px solid rgba(200,0,0,0.2)",borderRadius:4,color:"rgba(200,0,0,0.5)",fontSize:14,cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
          )}

          {/* Input normal */}
          {!grabando && !audioUrl && (
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input ref={fileImgRef} type="file" accept="image/*,video/*" multiple style={{display:"none"}} onChange={e => manejarArchivos(e.target.files)} />
              <button className="gc-adj-btn" onClick={() => fileImgRef.current?.click()} disabled={subiendoAdj} title="Fotos y videos">📷</button>
              <input ref={fileDocRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx,.zip" multiple style={{display:"none"}} onChange={e => manejarArchivos(e.target.files)} />
              <button className="gc-adj-btn" onClick={() => fileDocRef.current?.click()} disabled={subiendoAdj} title="Documentos">📎</button>
              <button className="gc-adj-btn" onClick={iniciarGrabacion} title="Grabar audio" style={{color:"rgba(200,0,0,0.7)"}}>🎙</button>
              <input
                ref={inputRef}
                className="gc-input"
                placeholder="Escribí un mensaje..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                disabled={enviando}
              />
              <button className="gc-send" onClick={enviar} disabled={enviando || subiendoAdj || (!input.trim() && adjuntos.length === 0)}>
                Enviar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
