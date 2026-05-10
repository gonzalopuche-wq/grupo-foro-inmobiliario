"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import PerfilRapidoModal from "./PerfilRapidoModal";
import NoticiasForoSection from "./NoticiasForoSection";

interface Category { id: string; name: string; slug: string; description: string; }
interface Tag { id: string; name: string; slug: string; }
interface Author { id: string; nombre: string; apellido: string; matricula: string | null; }
interface Topic {
  id: string; title: string; body: string; is_urgent: boolean; is_pinned: boolean;
  is_locked: boolean; status: string; accepted_reply_id: string | null;
  view_count: number; replies_count: number; last_activity_at: string; created_at: string;
  category_id: string; author_id: string;
  forum_categories?: { name: string; slug: string };
  perfiles?: Author;
  forum_topic_tags?: { forum_tags: Tag }[];
}
interface Reply {
  id: string; topic_id: string; author_id: string; body: string;
  is_accepted: boolean; created_at: string;
  perfiles?: Author;
  _voteCount?: number; _myVote?: number;
}
interface ChatMsg {
  id: string; user_id: string; body: string; created_at: string;
  editado?: boolean; eliminado?: boolean;
  reacciones?: Record<string, string[]>;
  reply_id?: string | null;
  adjuntos?: { url: string; nombre: string; tipo: "imagen" | "video" | "documento" | "audio"; tamano?: number }[];
  perfiles?: Author;
  reply?: ChatMsg | null;
}

type MainTab = "temas" | "noticias" | "chat" | "faq";
type Vista = "lista" | "detalle" | "nuevo";

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};
const initials = (p?: Author) => p ? `${p.nombre?.charAt(0) ?? ""}${p.apellido?.charAt(0) ?? ""}`.toUpperCase() : "?";
const fullName = (p?: Author) => p ? `${p.apellido ?? ""}, ${p.nombre ?? ""}` : "—";
const formatTamano = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const WA_GROUPS = [
  { name: "Foro Inmobiliario", sub: "1025 miembros", url: "https://chat.whatsapp.com/CShHa28oS2P2OWJrotLp3j", main: true },
  { name: "Ventas — Búsqueda", sub: "", url: "https://chat.whatsapp.com/KfqcLrP6GprKPDSzgwd8MG", main: false },
  { name: "Ventas — Ofrecidos", sub: "", url: "https://chat.whatsapp.com/CsqIVRLe2gh33wQYK7qe5p", main: false },
  { name: "Alquileres — Búsqueda", sub: "", url: "https://chat.whatsapp.com/KkfMBkfrgdA8XhQUlWiRLs", main: false },
  { name: "Alquileres — Ofrecidos", sub: "", url: "https://chat.whatsapp.com/FfjzdHlTeCYIHleSuhQJlP", main: false },
  { name: "Cotizaciones", sub: "", url: "https://chat.whatsapp.com/F4Tp8bGBZ7670HPmu4RvIn", main: false },
  { name: "Tasaciones", sub: "", url: "https://chat.whatsapp.com/GwtTHC2Qol90kUSZ46HEQk", main: false },
];

export default function ForoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Author | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("temas");
  const [vista, setVista] = useState<Vista>("lista");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [replyLoading, setReplyLoading] = useState(false);
  const [catFilter, setCatFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [perfilRapidoId, setPerfilRapidoId] = useState<string | null>(null);

  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nCat, setNCat] = useState("");
  const [nTags, setNTags] = useState<string[]>([]);
  const [nUrgent, setNUrgent] = useState(false);
  const [nError, setNError] = useState("");
  const [nLoading, setNLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [mostrarModalEvento, setMostrarModalEvento] = useState(false);
  const [eventoForm, setEventoForm] = useState({
    titulo: "", descripcion: "", fecha: "", hora: "09:00",
    lugar: "", plataforma: "presencial", link_reunion: "",
    gratuito: true, precio_entrada: "", capacidad: "", link_externo: "",
    tipo: "gfi",
  });
  const [guardandoEvento, setGuardandoEvento] = useState(false);
  const [eventoMediaFiles, setEventoMediaFiles] = useState<{tipo:"foto"|"video";url:string;thumb?:string}[]>([]);
  const [eventoLinkVideo, setEventoLinkVideo] = useState("");
  const [eventoSubiendoFoto, setEventoSubiendoFoto] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatReplyMsg, setChatReplyMsg] = useState<ChatMsg | null>(null);
  const [chatMenuId, setChatMenuId] = useState<string | null>(null);
  const [chatEditId, setChatEditId] = useState<string | null>(null);
  const [chatEditText, setChatEditText] = useState("");
  const [chatLinkPreviews, setChatLinkPreviews] = useState<Record<string, any>>({});
  const [chatInputPreview, setChatInputPreview] = useState<{ url: string; data: any } | null>(null);
  // Adjuntos foro chat
  const [chatAdjuntos, setChatAdjuntos] = useState<{url:string;nombre:string;tipo:"imagen"|"video"|"documento"|"audio";tamano?:number}[]>([]);
  const [subiendoChatAdj, setSubiendoChatAdj] = useState(false);
  const chatInputPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatEditRef = useRef<HTMLTextAreaElement>(null);
  const chatFileImgRef = useRef<HTMLInputElement>(null);
  const chatFileDocRef = useRef<HTMLInputElement>(null);
  // Audio grabación
  const [grabando, setGrabando] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSegundos, setAudioSegundos] = useState(0);
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modalMic, setModalMic] = useState(false);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [faqTopics, setFaqTopics] = useState<Topic[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      const { data: perfil } = await supabase.from("perfiles").select("id,nombre,apellido,matricula").eq("id", data.user.id).single();
      if (perfil) setUserProfile(perfil as Author);
      await Promise.all([loadCategories(), loadTags(), loadSaved(data.user.id), loadFaq()]);
      await loadTopics({ cat: "todas", status: "todas", q: "" });
      await loadChat();
      subscribeChat();
    };
    init();
    return () => { supabase.channel("forum_chat").unsubscribe(); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-chat-menu]")) setChatMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const extraerUrl = (texto: string) => texto.match(/https?:\/\/[^\s]+/)?.[0] ?? null;

  const loadCategories = async () => {
    const { data } = await supabase.from("forum_categories").select("*").eq("is_active", true).order("sort_order");
    setCategories(data ?? []);
  };
  const loadTags = async () => {
    const { data } = await supabase.from("forum_tags").select("*").order("name");
    setTags(data ?? []);
  };
  const loadTopics = async (opts?: { cat?: string; status?: string; q?: string }) => {
    setLoading(true);
    const cat = opts?.cat !== undefined ? opts.cat : "todas";
    const st = opts?.status !== undefined ? opts.status : "todas";
    const sq = opts?.q !== undefined ? opts.q : "";
    let query = supabase.from("forum_topics")
      .select("*, forum_categories(name,slug), perfiles(nombre,apellido,matricula), forum_topic_tags(forum_tags(id,name,slug))")
      .order("is_pinned", { ascending: false })
      .order("last_activity_at", { ascending: false });
    if (cat !== "todas") { const found = categories.find(c => c.id === cat); if (found) query = query.eq("category_id", found.id); }
    if (st !== "todas") query = query.eq("status", st);
    const { data } = await query;
    let result = (data as unknown as Topic[]) ?? [];
    if (sq.trim()) { const lower = sq.toLowerCase(); result = result.filter(t => t.title.toLowerCase().includes(lower) || t.body.toLowerCase().includes(lower)); }
    setTopics(result);
    setLoading(false);
  };
  const loadFaq = async () => {
    const { data } = await supabase.from("forum_topics")
      .select("*, forum_categories(name,slug), perfiles(nombre,apellido,matricula), forum_topic_tags(forum_tags(id,name,slug))")
      .eq("status", "resolved").order("last_activity_at", { ascending: false }).limit(20);
    setFaqTopics((data as unknown as Topic[]) ?? []);
  };
  const loadSaved = async (uid: string) => {
    const { data } = await supabase.from("forum_saved_topics").select("topic_id").eq("user_id", uid);
    setSavedIds(new Set((data ?? []).map((r: any) => r.topic_id)));
  };
  const loadChat = async () => {
    const { data } = await supabase.from("forum_chat_messages")
      .select("*, perfiles(nombre,apellido,matricula)")
      .order("created_at", { ascending: true }).limit(100);
    const msgs = (data as unknown as ChatMsg[]) ?? [];
    setChatMsgs(msgs);
    const previews: Record<string, any> = {};
    await Promise.all(msgs.map(async (m) => {
      if (!m.body || m.eliminado) return;
      const url = extraerUrl(m.body);
      if (!url || previews[url] !== undefined) return;
      previews[url] = "loading";
      try { const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`); previews[url] = await res.json(); } catch { previews[url] = "error"; }
    }));
    setChatLinkPreviews(previews);
  };
  const subscribeChat = () => {
    supabase.channel("forum_chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "forum_chat_messages" }, async (payload) => {
        const { data } = await supabase.from("forum_chat_messages").select("*, perfiles(nombre,apellido,matricula)").eq("id", payload.new.id).single();
        if (!data) return;
        let reply = null;
        if ((data as any).reply_id) {
          const { data: r } = await supabase.from("forum_chat_messages").select("id,body,user_id,perfiles(nombre,apellido)").eq("id", (data as any).reply_id).single();
          reply = r ?? null;
        }
        setChatMsgs(prev => { if (prev.some(m => m.id === (data as any).id)) return prev; return [...prev, { ...data, reply } as unknown as ChatMsg]; });
        const url = extraerUrl((data as any).body ?? "");
        if (url) { fetch(`/api/link-preview?url=${encodeURIComponent(url)}`).then(r => r.json()).then(d => setChatLinkPreviews(prev => ({ ...prev, [url]: d }))).catch(() => {}); }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "forum_chat_messages" }, async (payload) => {
        const { data } = await supabase.from("forum_chat_messages").select("*, perfiles(nombre,apellido,matricula)").eq("id", payload.new.id).single();
        if (data) setChatMsgs(prev => prev.map(m => m.id === (data as any).id ? { ...data, reply: m.reply } as unknown as ChatMsg : m));
      })
      .subscribe();
  };

  // ── SUBIR ADJUNTO AL CHAT DEL FORO ──
  const subirChatAdjunto = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const esImagen = ["jpg","jpeg","png","gif","webp","heic"].includes(ext);
    const esVideo = ["mp4","mov","avi","webm","mkv"].includes(ext);
    const tipo: "imagen"|"video"|"documento"|"audio" = esImagen ? "imagen" : esVideo ? "video" : "documento";
    const path = `foro_chat/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("adjuntos_chat").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { console.error("Upload error:", error); return null; }
    const { data: urlData } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    return { url: urlData.publicUrl, nombre: file.name, tipo, tamano: file.size };
  };

  const manejarChatArchivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubiendoChatAdj(true);
    const nuevos: typeof chatAdjuntos = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { showToast(`${file.name} supera 20MB`); continue; }
      const adj = await subirChatAdjunto(file);
      if (adj) nuevos.push(adj);
    }
    setChatAdjuntos(prev => [...prev, ...nuevos]);
    setSubiendoChatAdj(false);
  };

  const iniciarGrabacion = async () => {
    const enIframe = typeof window !== "undefined" && window.self !== window.top;
    if (!navigator.mediaDevices?.getUserMedia) {
      if (enIframe) showToast("⚠ App embebida — abrí en pestaña nueva para usar el micrófono.");
      else showToast("Tu navegador no soporta grabación de audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
                       MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" :
                       MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "";
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const finalMime = mr.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setGrabando(false);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(200);
      setGrabando(true);
      setAudioSegundos(0);
      audioTimerRef.current = setInterval(() => setAudioSegundos(s => s + 1), 1000);
    } catch (err: any) {
      const name = err?.name ?? "Error";
      const msg = err?.message ?? "";
      const enIframe = typeof window !== "undefined" && window.self !== window.top;
      if (enIframe) {
        showToast(`⚠ App embebida bloquea el mic. Abrí en pestaña nueva. (${name})`);
      } else if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setModalMic(true);
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        showToast("🎙 No se encontró micrófono.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        showToast("🎙 El micrófono está ocupado por otra app.");
      } else if (name === "SecurityError") {
        showToast("🎙 Requiere HTTPS.");
      } else {
        showToast(`🎙 Error: ${name}${msg ? " — " + msg : ""}`);
      }
    }
  };

  const detenerGrabacion = () => {
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const cancelarAudio = () => {
    mediaRecorderRef.current?.stop();
    setGrabando(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioSegundos(0);
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
  };

  const enviarAudio = async () => {
    if (!audioBlob || !userId) return;
    setSubiendoAudio(true);
    const mime = audioBlob.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    const nombre = `audio_${Date.now()}.${ext}`;
    const path = `foro_chat/${nombre}`;
    const file = new File([audioBlob], nombre, { type: mime });
    const { error } = await supabase.storage.from("adjuntos_chat").upload(path, file, { contentType: mime, cacheControl: "3600", upsert: false });
    if (error) { showToast("Error al subir audio"); setSubiendoAudio(false); return; }
    const { data: urlData } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    const adj = { url: urlData.publicUrl, nombre, tipo: "audio" as const, tamano: audioBlob.size };
    const insertData: any = { user_id: userId, body: "🎙 Audio", adjuntos: [adj] };
    if (chatReplyMsg?.id) insertData.reply_id = chatReplyMsg.id;
    await supabase.from("forum_chat_messages").insert(insertData);
    setAudioBlob(null); setAudioUrl(null); setAudioSegundos(0);
    setChatReplyMsg(null);
    setSubiendoAudio(false);
  };

  const fmtSegundos = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  const setEF = (k: string, v: any) => setEventoForm(p => ({ ...p, [k]: v }));

  const subirFotosEvento = async (files: FileList) => {
    if (!userId) return;
    setEventoSubiendoFoto(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}_${i}.${ext}`;
      const { data, error } = await supabase.storage.from("eventos").upload(path, file, { upsert: true, contentType: file.type });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("eventos").getPublicUrl(data.path);
        setEventoMediaFiles(prev => [...prev, { tipo: "foto", url: urlData.publicUrl }]);
      }
    }
    setEventoSubiendoFoto(false);
  };

  const agregarVideoEvento = () => {
    if (!eventoLinkVideo.trim()) return;
    const url = eventoLinkVideo.trim();
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg` : undefined;
    setEventoMediaFiles(prev => [...prev, { tipo: "video", url, thumb }]);
    setEventoLinkVideo("");
  };

  const guardarEventoDesdeChat = async () => {
    if (!userId || !eventoForm.titulo || !eventoForm.fecha) return;
    setGuardandoEvento(true);
    const fechaISO = new Date(`${eventoForm.fecha}T${eventoForm.hora}:00`).toISOString();
    await supabase.from("eventos").insert({
      titulo: eventoForm.titulo, descripcion: eventoForm.descripcion || null,
      fecha: fechaISO, lugar: eventoForm.lugar || null, plataforma: eventoForm.plataforma || null,
      link_reunion: eventoForm.link_reunion || null, gratuito: eventoForm.gratuito,
      precio_entrada: eventoForm.gratuito ? null : (parseFloat(eventoForm.precio_entrada) || null),
      capacidad: eventoForm.capacidad ? parseInt(eventoForm.capacidad) : null,
      link_externo: eventoForm.link_externo || null, tipo: eventoForm.tipo,
      organizador_id: userId, estado: "pendiente", destacado: false,
      media: eventoMediaFiles.length > 0 ? eventoMediaFiles : null,
    });
    setGuardandoEvento(false);
    setMostrarModalEvento(false);
    setEventoForm({ titulo: "", descripcion: "", fecha: "", hora: "09:00", lugar: "", plataforma: "presencial", link_reunion: "", gratuito: true, precio_entrada: "", capacidad: "", link_externo: "", tipo: "gfi" });
    setEventoMediaFiles([]);
    await supabase.from("forum_chat_messages").insert({ user_id: userId, body: `📅 Propuse un evento: "${eventoForm.titulo}" — pendiente de aprobación del admin.` });
  };

  const sendChat = async () => {
    if ((!chatInput.trim() && chatAdjuntos.length === 0) || !userId) return;
    setChatLoading(true);
    const textoEnviar = chatInput.trim();
    const adjuntosEnviar = [...chatAdjuntos];
    setChatInput(""); setChatInputPreview(null); setChatAdjuntos([]);
    const replyId = chatReplyMsg?.id ?? null;
    setChatReplyMsg(null);
    const insertData: any = { user_id: userId, body: textoEnviar };
    if (replyId) insertData.reply_id = replyId;
    if (adjuntosEnviar.length > 0) insertData.adjuntos = adjuntosEnviar;
    await supabase.from("forum_chat_messages").insert(insertData);
    setChatLoading(false);
    chatInputRef.current?.focus();
  };

  const editarChatMsg = async (id: string) => {
    if (!chatEditText.trim()) return;
    await supabase.from("forum_chat_messages").update({ body: chatEditText.trim(), editado: true }).eq("id", id);
    setChatEditId(null); setChatEditText("");
  };
  const eliminarChatMsg = async (id: string) => {
    await supabase.from("forum_chat_messages").update({ eliminado: true, body: "" }).eq("id", id);
    setChatMenuId(null);
  };
  const reaccionarChat = async (msgId: string, emoji: string) => {
    const msg = chatMsgs.find(m => m.id === msgId);
    if (!msg || !userId) return;
    const reacs = { ...(msg.reacciones ?? {}) };
    const usuarios = reacs[emoji] ?? [];
    if (usuarios.includes(userId)) { reacs[emoji] = usuarios.filter(u => u !== userId); if (reacs[emoji].length === 0) delete reacs[emoji]; }
    else reacs[emoji] = [...usuarios, userId];
    setChatMsgs(prev => prev.map(m => m.id === msgId ? { ...m, reacciones: reacs } : m));
    setChatMenuId(null);
    supabase.from("forum_chat_messages").update({ reacciones: reacs }).eq("id", msgId);
  };

  const openTopic = async (t: Topic) => {
    setTopic(t); setVista("detalle"); setReplyBody("");
    await supabase.from("forum_topics").update({ view_count: t.view_count + 1 }).eq("id", t.id);
    const { data } = await supabase.from("forum_replies").select("*, perfiles(nombre,apellido,matricula)").eq("topic_id", t.id).eq("is_deleted", false).order("created_at");
    if (userId && data) {
      const replyIds = data.map((r: any) => r.id);
      const { data: votes } = await supabase.from("forum_reply_votes").select("reply_id,value,user_id").in("reply_id", replyIds);
      setReplies(data.map((r: any) => ({ ...r, _voteCount: (votes ?? []).filter((v: any) => v.reply_id === r.id).reduce((s: number, v: any) => s + v.value, 0), _myVote: (votes ?? []).find((v: any) => v.reply_id === r.id && v.user_id === userId)?.value ?? 0 })) as Reply[]);
    } else setReplies((data as unknown as Reply[]) ?? []);
  };

  const submitTopic = async () => {
    setNError("");
    if (!nTitle.trim() || !nBody.trim() || !nCat) { setNError("Título, cuerpo y categoría son obligatorios."); return; }
    if (nTags.length < 1) { setNError("Seleccioná al menos 1 tag."); return; }
    setNLoading(true);
    const { data: nuevo, error } = await supabase.from("forum_topics").insert({ author_id: userId, category_id: nCat, title: nTitle.trim(), body: nBody.trim(), is_urgent: nUrgent }).select().single();
    if (error || !nuevo) { setNError("Error al publicar. Intentá de nuevo."); setNLoading(false); return; }
    if (nTags.length > 0) await supabase.from("forum_topic_tags").insert(nTags.map(tid => ({ topic_id: nuevo.id, tag_id: tid })));
    setNLoading(false); setNTitle(""); setNBody(""); setNCat(""); setNTags([]); setNUrgent(false);
    setCatFilter("todas"); setStatusFilter("todas"); setSearch("");
    await loadTopics({ cat: "todas", status: "todas", q: "" });
    setVista("lista");
  };

  const submitReply = async () => {
    if (!replyBody.trim() || !topic || !userId) return;
    setReplyLoading(true);
    const { data: nueva } = await supabase.from("forum_replies").insert({ topic_id: topic.id, author_id: userId, body: replyBody.trim() }).select("*, perfiles(nombre,apellido,matricula)").single();
    if (nueva) {
      setReplies(r => [...r, { ...(nueva as unknown as Reply), _voteCount: 0, _myVote: 0 }]);
      await supabase.from("forum_topics").update({ replies_count: topic.replies_count + 1, last_activity_at: new Date().toISOString() }).eq("id", topic.id);
      setTopic(t => t ? { ...t, replies_count: t.replies_count + 1 } : t);
      if (topic.author_id !== userId) await supabase.from("forum_notifications").insert({ user_id: topic.author_id, type: "reply", topic_id: topic.id, reply_id: nueva.id });
    }
    setReplyBody(""); setReplyLoading(false);
  };

  const acceptReply = async (reply: Reply) => {
    if (!topic || topic.author_id !== userId) return;
    if (topic.accepted_reply_id) await supabase.from("forum_replies").update({ is_accepted: false }).eq("id", topic.accepted_reply_id);
    await supabase.from("forum_replies").update({ is_accepted: true }).eq("id", reply.id);
    await supabase.from("forum_topics").update({ accepted_reply_id: reply.id, status: "resolved" }).eq("id", topic.id);
    setReplies(rs => rs.map(r => ({ ...r, is_accepted: r.id === reply.id })));
    setTopic(t => t ? { ...t, accepted_reply_id: reply.id, status: "resolved" } : t);
    if (reply.author_id !== userId) await supabase.from("forum_notifications").insert({ user_id: reply.author_id, type: "accepted_reply", topic_id: topic.id, reply_id: reply.id });
  };

  const voteReply = async (reply: Reply, val: 1 | -1) => {
    if (!userId) return;
    const newVal = reply._myVote === val ? 0 : val;
    if (newVal === 0) await supabase.from("forum_reply_votes").delete().eq("reply_id", reply.id).eq("user_id", userId);
    else await supabase.from("forum_reply_votes").upsert({ reply_id: reply.id, user_id: userId, value: newVal }, { onConflict: "reply_id,user_id" });
    setReplies(rs => rs.map(r => r.id === reply.id ? { ...r, _myVote: newVal, _voteCount: (r._voteCount ?? 0) - (r._myVote ?? 0) + newVal } : r));
  };

  const toggleSave = async (topicId: string) => {
    if (!userId) return;
    if (savedIds.has(topicId)) { await supabase.from("forum_saved_topics").delete().eq("topic_id", topicId).eq("user_id", userId); setSavedIds(s => { const n = new Set(s); n.delete(topicId); return n; }); }
    else { await supabase.from("forum_saved_topics").insert({ topic_id: topicId, user_id: userId }); setSavedIds(s => new Set([...s, topicId])); }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => loadTopics({ q: val }), 350);
  };
  const applyFilter = (opts: { cat?: string; status?: string }) => {
    const newCat = opts.cat ?? catFilter;
    const newSt = opts.status ?? statusFilter;
    if (opts.cat !== undefined) setCatFilter(opts.cat);
    if (opts.status !== undefined) setStatusFilter(opts.status);
    loadTopics({ cat: newCat, status: newSt });
  };

  const ChatLinkPreview = ({ url }: { url: string }) => {
    const data = chatLinkPreviews[url];
    if (!data || data === "loading" || data === "error" || (!data.title && !data.image)) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", gap: 8, marginTop: 6, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", textDecoration: "none", minHeight: 60 }}
        onClick={e => e.stopPropagation()}>
        {data.image && <div style={{ width: 60, minWidth: 60, background: "#000", flexShrink: 0 }}><img src={data.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} /></div>}
        <div style={{ flex: 1, padding: "6px 8px 6px 0", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {data.title && <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.title}</div>}
          {data.description && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{data.description}</div>}
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{(() => { try { return new URL(url).hostname; } catch { return url; } })()}</div>
        </div>
      </a>
    );
  };

  // Render adjuntos en mensaje del foro chat
  const RenderChatAdjuntos = ({ adjuntos }: { adjuntos: NonNullable<ChatMsg["adjuntos"]> }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
      {adjuntos.map((adj, i) => {
        if (adj.tipo === "imagen") return (
          <a key={i} href={adj.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <img src={adj.url} alt={adj.nombre} style={{ maxWidth: 220, maxHeight: 180, borderRadius: 6, display: "block", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
          </a>
        );
        if (adj.tipo === "video") return (
          <video key={i} src={adj.url} controls style={{ maxWidth: 260, borderRadius: 6, display: "block", border: "1px solid rgba(255,255,255,0.1)" }} onClick={e => e.stopPropagation()} />
        );
        if (adj.tipo === "audio") return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.2)", borderRadius: 8, padding: "8px 10px" }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: 18 }}>🎙</span>
            <audio controls style={{ flex: 1, height: 32, minWidth: 0 }}>
              <source src={adj.url} type={adj.nombre?.endsWith(".mp4") ? "audio/mp4" : adj.nombre?.endsWith(".ogg") ? "audio/ogg" : "audio/webm"} />
            </audio>
          </div>
        );
        return (
          <a key={i} href={adj.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, textDecoration: "none" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{adj.nombre.match(/\.pdf$/i) ? "📄" : adj.nombre.match(/\.(xls|xlsx)$/i) ? "📊" : "📎"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adj.nombre}</div>
              {adj.tamano && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{formatTamano(adj.tamano)}</div>}
            </div>
            <span style={{ fontSize: 12, color: "#cc0000" }}>↓</span>
          </a>
        );
      })}
    </div>
  );

  const TopicCard = ({ t, onClick }: { t: Topic; onClick: () => void }) => (
    <div className={`f-topic${t.is_urgent ? " urgent" : ""}${t.is_pinned ? " pinned" : ""}`} onClick={onClick}>
      <div className="f-topic-top">
        <div style={{ flex: 1 }}>
          <div className="f-topic-badges">
            {t.forum_categories && <span className="f-badge cat">{t.forum_categories.name}</span>}
            {t.is_urgent && <span className="f-badge urg">⚡ Urgente</span>}
            {t.status === "resolved" && <span className="f-badge res">✓ Resuelto</span>}
            {t.is_pinned && <span className="f-badge pin">📌 Fijado</span>}
          </div>
          <div className="f-topic-title">{t.title}</div>
        </div>
        <button className={`f-save${savedIds.has(t.id) ? " saved" : ""}`} onClick={e => { e.stopPropagation(); toggleSave(t.id); }}>{savedIds.has(t.id) ? "❤️" : "🤍"}</button>
      </div>
      <div className="f-topic-body">{t.body}</div>
      <div className="f-topic-footer">
        <span className="f-meta" style={{cursor:"pointer",textDecoration:"underline dotted"}} onClick={e => { e.stopPropagation(); setPerfilRapidoId(t.author_id); }}>👤 {fullName(t.perfiles)}</span>
        <span className="f-meta">💬 {t.replies_count}</span>
        <span className="f-meta">👁 {t.view_count}</span>
        <span className="f-meta">{timeAgo(t.last_activity_at)}</span>
        <div className="f-tags-row">{(t.forum_topic_tags ?? []).slice(0, 3).map((tt: any) => <span key={tt.forum_tags?.id} className="f-tag">{tt.forum_tags?.name}</span>)}</div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .f-layout { display: grid; grid-template-columns: 180px 1fr 240px; gap: 20px; align-items: start; }
        .f-left { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 80px; }
        .f-side-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .f-side-title { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .f-side-item { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; color: rgba(255,255,255,0.55); }
        .f-side-item:last-child { border-bottom: none; }
        .f-side-item:hover { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.8); }
        .f-side-item.active { background: rgba(200,0,0,0.08); color: #fff; border-left: 2px solid #cc0000; }
        .f-center { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
        .f-tabs { display: flex; gap: 4px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 4px; }
        .f-tab { flex: 1; padding: 9px; border: none; border-radius: 4px; background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .f-tab:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.04); }
        .f-tab.active { background: rgba(200,0,0,0.15); color: #fff; border: 1px solid rgba(200,0,0,0.3); }
        .f-topbar { display: flex; align-items: center; gap: 10px; }
        .f-search { flex: 1; position: relative; }
        .f-search input { width: 100%; padding: 9px 14px 9px 34px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter',sans-serif; }
        .f-search input:focus { border-color: rgba(200,0,0,0.4); }
        .f-search input::placeholder { color: rgba(255,255,255,0.2); }
        .f-search-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 12px; color: rgba(255,255,255,0.3); }
        .f-btn-nuevo { padding: 9px 18px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .f-btn-nuevo:hover { background: #e60000; }
        .f-btn-urgente { padding: 9px 14px; background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); border-radius: 4px; color: #eab308; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .f-filtros { display: flex; gap: 6px; flex-wrap: wrap; }
        .f-filtro { padding: 5px 11px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 10px; cursor: pointer; transition: all 0.15s; font-family: 'Inter',sans-serif; }
        .f-filtro:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
        .f-filtro.active { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .f-topic { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .f-topic:hover { border-color: rgba(200,0,0,0.25); }
        .f-topic.urgent { border-color: rgba(234,179,8,0.25); }
        .f-topic.urgent::before, .f-topic.pinned::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
        .f-topic.urgent::before { background: #eab308; }
        .f-topic.pinned::before { background: #60a5fa; }
        .f-topic-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 7px; }
        .f-topic-badges { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 6px; }
        .f-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; border-radius: 10px; font-family: 'Montserrat',sans-serif; }
        .f-badge.cat { background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.2); color: #ff8a80; }
        .f-badge.urg { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.25); color: #eab308; }
        .f-badge.res { background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.25); color: #60a5fa; }
        .f-badge.pin { background: rgba(96,165,250,0.07); border: 1px solid rgba(96,165,250,0.15); color: #93c5fd; }
        .f-topic-title { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; line-height: 1.4; }
        .f-topic-body { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5; margin-bottom: 9px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .f-topic-footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .f-meta { font-size: 10px; color: rgba(255,255,255,0.3); }
        .f-tags-row { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
        .f-tag { font-size: 9px; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); padding: 2px 6px; border-radius: 10px; }
        .f-save { background: none; border: none; font-size: 13px; cursor: pointer; color: rgba(255,255,255,0.25); transition: color 0.15s; padding: 2px; flex-shrink: 0; }
        .f-save.saved { color: #cc0000; }
        .f-chat { display: flex; flex-direction: column; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; height: calc(100vh - 200px); min-height: 400px; }
        .f-chat-header { padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 8px; }
        .f-chat-header-title { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
        .f-chat-live { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 6px rgba(34,197,94,0)} }
        .f-chat-msgs { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
        .f-chat-msgs::-webkit-scrollbar { width: 4px; }
        .f-chat-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .f-chat-input-area { border-top: 1px solid rgba(255,255,255,0.06); padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
        .f-chat-adj-btn { width: 34px; height: 34px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.5); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
        .f-chat-adj-btn:hover { border-color: rgba(200,0,0,0.4); color: #cc0000; }
        .f-chat-input-row { display: flex; gap: 8px; align-items: center; }
        .f-chat-input-row input { flex: 1; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .f-chat-input-row input:focus { border-color: rgba(200,0,0,0.35); }
        .f-chat-input-row input::placeholder { color: rgba(255,255,255,0.2); }
        .f-chat-send { padding: 9px 16px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .f-chat-send:hover { background: #e60000; }
        .f-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
        .f-audio-grabando { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.25); border-radius: 6px; margin-bottom: 6px; }
        .f-audio-dot { width: 10px; height: 10px; border-radius: 50%; background: #cc0000; animation: pulse-dot 1s ease-in-out infinite; flex-shrink: 0; }
        .f-audio-preview { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; margin-bottom: 6px; }
        @keyframes pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
        .f-detalle { display: flex; flex-direction: column; gap: 16px; }
        .f-back { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 12px; cursor: pointer; padding: 0; font-family: 'Inter',sans-serif; display: flex; align-items: center; gap: 5px; }
        .f-back:hover { color: #fff; }
        .f-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 22px 26px; }
        .f-card-title { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 12px; line-height: 1.3; }
        .f-card-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .f-avatar { width: 30px; height: 30px; border-radius: 5px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.25); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 800; color: #cc0000; flex-shrink: 0; cursor: pointer; transition: border-color 0.15s; }
        .f-avatar:hover { border-color: #cc0000; }
        .f-card-body { font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.75); white-space: pre-wrap; }
        .f-replies-title { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 10px; }
        .f-reply { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; margin-bottom: 10px; position: relative; }
        .f-reply.accepted { border-color: rgba(96,165,250,0.35); background: rgba(96,165,250,0.04); }
        .f-reply.accepted::after { content: '✓ Respuesta destacada'; position: absolute; top: -1px; right: 16px; background: #3b82f6; color: #fff; font-size: 8px; font-weight: 700; letter-spacing: 0.12em; font-family: 'Montserrat',sans-serif; padding: 3px 10px; border-radius: 0 0 4px 4px; text-transform: uppercase; }
        .f-reply-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .f-reply-body { font-size: 13px; line-height: 1.7; color: rgba(255,255,255,0.7); white-space: pre-wrap; margin-bottom: 12px; }
        .f-reply-actions { display: flex; align-items: center; gap: 8px; }
        .f-vote { display: flex; align-items: center; gap: 3px; padding: 3px 9px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; transition: all 0.15s; }
        .f-vote.up.voted { border-color: #22c55e; background: rgba(34,197,94,0.09); color: #22c55e; }
        .f-vote.down.voted { border-color: #ef4444; background: rgba(239,68,68,0.09); color: #ef4444; }
        .f-accept-btn { padding: 3px 10px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 3px; color: #60a5fa; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; font-family: 'Montserrat',sans-serif; }
        .f-editor { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 18px 22px; }
        .f-editor-title { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 10px; }
        .f-textarea { width: 100%; padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 90px; font-family: 'Inter',sans-serif; }
        .f-textarea:focus { border-color: rgba(200,0,0,0.35); }
        .f-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .f-submit { margin-top: 9px; padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
        .f-submit:hover:not(:disabled) { background: #e60000; }
        .f-submit:disabled { opacity: 0.55; cursor: not-allowed; }
        .f-nuevo { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 24px 28px; max-width: 680px; }
        .f-nuevo-title { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .f-nuevo-title span { color: #cc0000; }
        .fn-field { margin-bottom: 14px; }
        .fn-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .fn-input { width: 100%; padding: 9px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .fn-input:focus { border-color: rgba(200,0,0,0.4); }
        .fn-input::placeholder { color: rgba(255,255,255,0.2); }
        .fn-select { width: 100%; padding: 9px 13px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .fn-tags { display: flex; gap: 7px; flex-wrap: wrap; }
        .fn-tag { padding: 5px 11px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: 'Inter',sans-serif; }
        .fn-tag.active { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .fn-urg { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(234,179,8,0.05); border: 1px solid rgba(234,179,8,0.15); border-radius: 4px; cursor: pointer; }
        .fn-urg.active { background: rgba(234,179,8,0.09); border-color: rgba(234,179,8,0.28); }
        .fn-urg-t { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: #eab308; }
        .fn-urg-d { font-size: 11px; color: rgba(255,255,255,0.32); margin-top: 1px; }
        .fn-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.07); border: 1px solid rgba(200,0,0,0.18); border-radius: 3px; padding: 9px 13px; margin-bottom: 12px; }
        .fn-actions { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }
        .fn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-submit { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-submit:hover:not(:disabled) { background: #e60000; }
        .fn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .fn-spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .f-right { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 80px; }
        .f-right-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .f-right-title { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 6px; }
        .f-right-title.wa { color: #25d366; }
        .f-right-title.tg { color: #2aabee; }
        .f-right-title.faq { color: rgba(255,255,255,0.3); }
        .f-ext-link { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; gap: 8px; }
        .f-ext-link:last-child { border-bottom: none; }
        .f-ext-link:hover { background: rgba(255,255,255,0.03); }
        .f-ext-link.main { background: rgba(37,211,102,0.04); border-left: 2px solid #25d366; }
        .f-ext-link.main-tg { background: rgba(42,171,238,0.04); border-left: 2px solid #2aabee; }
        .f-ext-name { font-size: 11px; color: rgba(255,255,255,0.6); flex: 1; }
        .f-ext-link.main .f-ext-name { color: #fff; font-weight: 600; }
        .f-ext-sub { font-size: 9px; color: rgba(255,255,255,0.25); white-space: nowrap; }
        .f-ext-arrow { font-size: 11px; color: rgba(255,255,255,0.2); flex-shrink: 0; }
        .f-faq-item { padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.15s; }
        .f-faq-item:last-child { border-bottom: none; }
        .f-faq-item:hover { background: rgba(255,255,255,0.03); }
        .f-faq-title { font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.4; margin-bottom: 3px; }
        .f-faq-meta { font-size: 9px; color: rgba(255,255,255,0.25); }
        .f-empty { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        @media (max-width: 1100px) { .f-layout { grid-template-columns: 160px 1fr; } .f-right { display: none; } }
        @media (max-width: 700px) { .f-layout { grid-template-columns: 1fr; } .f-left { position: static; flex-direction: row; overflow-x: auto; } .f-side-box { min-width: 160px; } }
      `}</style>

      <div className="f-layout">
        <aside className="f-left">
          <div className="f-side-box">
            <div className="f-side-title">Categorías</div>
            <div className={`f-side-item${catFilter === "todas" ? " active" : ""}`} onClick={() => applyFilter({ cat: "todas" })}>Todos los temas</div>
            {categories.map(c => <div key={c.id} className={`f-side-item${catFilter === c.id ? " active" : ""}`} onClick={() => { setMainTab("temas"); applyFilter({ cat: c.id }); }}>{c.name}</div>)}
          </div>
          <div className="f-side-box">
            <div className="f-side-title">Estado</div>
            {[["todas","Todos"],["open","Abiertos"],["resolved","Resueltos"]].map(([v,l]) => (
              <div key={v} className={`f-side-item${statusFilter === v ? " active" : ""}`} onClick={() => applyFilter({ status: v })}>{l}</div>
            ))}
          </div>
        </aside>

        <div className="f-center">
          <div className="f-tabs">
            <button className={`f-tab${mainTab === "temas" ? " active" : ""}`} onClick={() => { setMainTab("temas"); setVista("lista"); }}>💬 Temas</button>
            <button className={`f-tab${mainTab === "noticias" ? " active" : ""}`} onClick={() => setMainTab("noticias")}>📰 Noticias</button>
            <button className={`f-tab${mainTab === "chat" ? " active" : ""}`} onClick={() => setMainTab("chat")}>⚡ Chat en vivo</button>
            <button className={`f-tab${mainTab === "faq" ? " active" : ""}`} onClick={() => setMainTab("faq")}>✓ Resueltos</button>
          </div>

          {mainTab === "temas" && vista === "lista" && (
            <>
              <div className="f-topbar">
                <div className="f-search">
                  <span className="f-search-ico">🔍</span>
                  <input placeholder="Buscar en el foro..." value={search} onChange={e => handleSearch(e.target.value)} />
                </div>
                <button className="f-btn-urgente" onClick={() => applyFilter({ status: "todas" })}>⚡ Urgentes</button>
                <button className="f-btn-nuevo" onClick={() => { setMainTab("temas"); setVista("nuevo"); }}>+ Nueva consulta</button>
              </div>
              <div className="f-filtros">
                {[["todas","Todos"],["open","Abiertos"],["resolved","Resueltos"]].map(([v,l]) => (
                  <button key={v} className={`f-filtro${statusFilter === v ? " active" : ""}`} onClick={() => applyFilter({ status: v })}>{l}</button>
                ))}
              </div>
              {loading ? <div className="f-empty">Cargando...</div> :
               topics.length === 0 ? <div className="f-empty">No hay temas todavía. ¡Publicá la primera consulta!</div> :
               topics.map(t => <TopicCard key={t.id} t={t} onClick={() => openTopic(t)} />)}
            </>
          )}

          {mainTab === "temas" && vista === "detalle" && topic && (
            <div className="f-detalle">
              <button className="f-back" onClick={() => { setVista("lista"); loadTopics(); }}>← Volver</button>
              <div className="f-card">
                <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                  {topic.forum_categories && <span className="f-badge cat">{topic.forum_categories.name}</span>}
                  {topic.is_urgent && <span className="f-badge urg">⚡ Urgente</span>}
                  {topic.status === "resolved" && <span className="f-badge res">✓ Resuelto</span>}
                </div>
                <div className="f-card-title">{topic.title}</div>
                <div className="f-card-meta">
                  <div className="f-avatar" onClick={() => setPerfilRapidoId(topic.author_id)}>{initials(topic.perfiles)}</div>
                  <div style={{cursor:"pointer"}} onClick={() => setPerfilRapidoId(topic.author_id)}>
                    <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{fullName(topic.perfiles)}</div>
                    {topic.perfiles?.matricula && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'Montserrat',sans-serif"}}>Mat. {topic.perfiles.matricula}</div>}
                  </div>
                  <span className="f-meta" style={{marginLeft:6}}>{timeAgo(topic.created_at)}</span>
                  <span className="f-meta">👁 {topic.view_count}</span>
                  <span className="f-meta">💬 {topic.replies_count}</span>
                </div>
                <div className="f-card-body">{topic.body}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                  <div>{(topic.forum_topic_tags ?? []).length > 0 && <div className="f-tags-row">{(topic.forum_topic_tags ?? []).map((tt: any) => <span key={tt.forum_tags?.id} className="f-tag">{tt.forum_tags?.name}</span>)}</div>}</div>
                  {topic.author_id !== userId && (
                    <button onClick={() => {
                      const motivo = prompt("Motivo de la denuncia:\n1. spam\n2. ofensivo\n3. incorrecto\n4. acoso\n5. otro\n\nEscribí el número:");
                      const motivos = ["spam","ofensivo","incorrecto","acoso","otro"];
                      const mot = motivos[(parseInt(motivo ?? "5") || 5) - 1] ?? "otro";
                      fetch("/api/denuncias", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ denunciante_id: userId, tipo_contenido:"forum_topic", contenido_id: topic.id, motivo: mot }) });
                      alert("Denuncia enviada. El equipo de moderación la revisará.");
                    }} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",fontSize:11,padding:"2px 6px"}} title="Denunciar post">
                      ⚑ Denunciar
                    </button>
                  )}
                </div>
              </div>
              {replies.length > 0 && (
                <div>
                  <div className="f-replies-title">{replies.length} {replies.length === 1 ? "Respuesta" : "Respuestas"}</div>
                  {[...replies].sort((a,b) => (b.is_accepted?1:0)-(a.is_accepted?1:0)).map(r => (
                    <div key={r.id} className={`f-reply${r.is_accepted?" accepted":""}`}>
                      <div className="f-reply-meta">
                        <div className="f-avatar" onClick={() => setPerfilRapidoId(r.author_id)}>{initials(r.perfiles)}</div>
                        <div style={{cursor:"pointer"}} onClick={() => setPerfilRapidoId(r.author_id)}>
                          <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{fullName(r.perfiles)}</div>
                          {r.perfiles?.matricula && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'Montserrat',sans-serif"}}>Mat. {r.perfiles.matricula}</div>}
                        </div>
                        <span className="f-meta" style={{marginLeft:6}}>{timeAgo(r.created_at)}</span>
                      </div>
                      <div className="f-reply-body">{r.body}</div>
                      <div className="f-reply-actions">
                        <button className={`f-vote up${r._myVote===1?" voted":""}`} onClick={() => voteReply(r,1)}>▲ {(r._voteCount??0)>0?`+${r._voteCount}`:r._voteCount??0}</button>
                        <button className={`f-vote down${r._myVote===-1?" voted":""}`} onClick={() => voteReply(r,-1)}>▼</button>
                        {topic.author_id === userId && !r.is_accepted && !topic.is_locked && <button className="f-accept-btn" onClick={() => acceptReply(r)}>✓ Marcar destacada</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!topic.is_locked ? (
                <div className="f-editor">
                  <div className="f-editor-title">Tu respuesta</div>
                  <textarea className="f-textarea" placeholder="Escribí tu respuesta..." value={replyBody} onChange={e => setReplyBody(e.target.value)} disabled={replyLoading} />
                  <button className="f-submit" onClick={submitReply} disabled={replyLoading || !replyBody.trim()}>
                    {replyLoading && <span className="fn-spinner"/>}{replyLoading ? "Publicando..." : "Publicar respuesta"}
                  </button>
                </div>
              ) : (
                <div style={{padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>🔒 Tema cerrado</div>
              )}
            </div>
          )}

          {mainTab === "temas" && vista === "nuevo" && (
            <div className="f-nuevo">
              <div className="f-nuevo-title">Nueva <span>consulta</span></div>
              <div className="fn-field">
                <label className="fn-label">Categoría *</label>
                <select className="fn-select" value={nCat} onChange={e => setNCat(e.target.value)}>
                  <option value="">Seleccioná una categoría...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="fn-field">
                <label className="fn-label">Título *</label>
                <input className="fn-input" placeholder="¿Cuál es tu consulta?" value={nTitle} onChange={e => setNTitle(e.target.value)} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Descripción *</label>
                <textarea className="f-textarea" placeholder="Describí tu consulta con detalle..." value={nBody} onChange={e => setNBody(e.target.value)} style={{minHeight:120}} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Tags * (al menos 1)</label>
                <div className="fn-tags">
                  {tags.map(t => <button key={t.id} type="button" className={`fn-tag${nTags.includes(t.id)?" active":""}`} onClick={() => setNTags(prev => prev.includes(t.id) ? prev.filter(x=>x!==t.id) : [...prev,t.id])}>{t.name}</button>)}
                </div>
              </div>
              <div className="fn-field">
                <div className={`fn-urg${nUrgent?" active":""}`} onClick={() => setNUrgent(u=>!u)}>
                  <span style={{fontSize:16}}>⚡</span>
                  <div style={{flex:1}}><div className="fn-urg-t">Marcar como urgente</div><div className="fn-urg-d">Notifica a todos y aparece destacado</div></div>
                  <div style={{width:34,height:18,borderRadius:9,background:nUrgent?"#eab308":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:2,left:nUrgent?18:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                  </div>
                </div>
              </div>
              {nError && <div className="fn-error">{nError}</div>}
              <div className="fn-actions">
                <button className="fn-cancel" onClick={() => setVista("lista")}>Cancelar</button>
                <button className="fn-submit" onClick={submitTopic} disabled={nLoading}>
                  {nLoading && <span className="fn-spinner"/>}{nLoading ? "Publicando..." : "Publicar consulta"}
                </button>
              </div>
            </div>
          )}

          {mainTab === "noticias" && <NoticiasForoSection userId={userId} />}

          {mainTab === "chat" && (
            <div className="f-chat">
              <div className="f-chat-header">
                <div className="f-chat-live"/>
                <span className="f-chat-header-title">Chat General — En vivo</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginLeft:"auto"}}>Tocá un mensaje para ver opciones</span>
              </div>
              <div className="f-chat-msgs">
                {chatMsgs.length === 0 && <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:13,fontStyle:"italic",marginTop:32}}>No hay mensajes todavía. ¡Sé el primero!</div>}
                {chatMsgs.map(m => {
                  const esMio = m.user_id === userId;
                  const eliminado = m.eliminado;
                  const adjuntos = (m as any).adjuntos ?? [];
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: esMio ? "flex-end" : "flex-start", marginBottom: 4, position: "relative", cursor: "pointer" }}
                      onClick={() => !eliminado && setChatMenuId(prev => prev === m.id ? null : m.id)}>
                      {chatMenuId === m.id && !eliminado && chatEditId !== m.id && (
                        <div data-chat-menu onClick={e => e.stopPropagation()}
                          style={{ position: "absolute", [esMio ? "right" : "left"]: 0, bottom: "100%", marginBottom: 6, background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 6px", zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 2, minWidth: 160 }}>
                          <div style={{ display: "flex", gap: 2, padding: "2px 4px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 2, flexWrap: "wrap" }}>
                            {["👍","❤️","😂","😮","😢","🙏","🔥","✅","👀","😡","💯","🎉"].map(emoji => (
                              <button key={emoji} onClick={() => reaccionarChat(m.id, emoji)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: "2px 4px", borderRadius: 6 }}>{emoji}</button>
                            ))}
                          </div>
                          {([
                            { icon: "↩", label: "Responder", action: () => { setChatReplyMsg(m); setChatMenuId(null); chatInputRef.current?.focus(); } },
                            { icon: "↗", label: "Reenviar", action: () => { setChatInput(m.body); setChatMenuId(null); chatInputRef.current?.focus(); } },
                            { icon: "📋", label: "Copiar", action: () => { navigator.clipboard.writeText(m.body); setChatMenuId(null); } },
                            ...(esMio ? [
                              { icon: "✏", label: "Editar", action: () => { setChatEditId(m.id); setChatEditText(m.body); setChatMenuId(null); setTimeout(() => chatEditRef.current?.focus(), 50); } },
                              { icon: "🗑", label: "Eliminar", action: () => eliminarChatMsg(m.id), danger: true },
                            ] : [
                              { icon: "🚩", label: "Reportar", action: () => { showToast("Mensaje reportado al admin."); setChatMenuId(null); } },
                            ]),
                          ] as any[]).map(({ icon, label, action, danger }) => (
                            <button key={label} onClick={action}
                              style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: danger ? "#ff6060" : "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter,sans-serif", cursor: "pointer", padding: "8px 12px", borderRadius: 8, width: "100%", textAlign: "left" }}
                              onMouseEnter={ev => (ev.currentTarget.style.background = danger ? "rgba(255,0,0,0.08)" : "rgba(255,255,255,0.06)")}
                              onMouseLeave={ev => (ev.currentTarget.style.background = "none")}>
                              <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{icon}</span>{label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ maxWidth: "75%", position: "relative" }}>
                        {!eliminado && (
                          <div style={{ position: "absolute", right: 4, top: -10, background: "rgba(40,40,40,0.9)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 6.5L5 3.5L8 6.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                        {!esMio && !eliminado && (
                          <div style={{ fontSize: 10, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, marginBottom: 3, cursor: "pointer" }} onClick={e => { e.stopPropagation(); setPerfilRapidoId(m.user_id); }}>
                            {fullName(m.perfiles)}{m.perfiles?.matricula && <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}> · {m.perfiles.matricula}</span>}
                          </div>
                        )}
                        <div style={{ background: eliminado ? "transparent" : esMio ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.06)", border: eliminado ? "1px solid rgba(255,255,255,0.06)" : esMio ? `1px solid ${chatMenuId === m.id ? "rgba(200,0,0,0.5)" : "rgba(200,0,0,0.25)"}` : `1px solid ${chatMenuId === m.id ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: esMio ? "12px 12px 3px 12px" : "12px 12px 12px 3px", padding: "8px 12px", transition: "border-color 0.15s" }}>
                          {m.reply && !eliminado && (
                            <div style={{ background: "rgba(255,255,255,0.04)", borderLeft: "2px solid #cc0000", borderRadius: "0 4px 4px 0", padding: "4px 8px", marginBottom: 6, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                              <div style={{ fontSize: 9, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, marginBottom: 2 }}>{(m.reply as any).perfiles?.nombre ?? ""}</div>
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{(m.reply as any).body}</div>
                            </div>
                          )}
                          {eliminado ? (
                            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Mensaje eliminado</p>
                          ) : chatEditId === m.id ? (
                            <div onClick={e => e.stopPropagation()}>
                              <textarea ref={chatEditRef} value={chatEditText} onChange={e => setChatEditText(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); editarChatMsg(m.id); } if (e.key === "Escape") { setChatEditId(null); setChatEditText(""); } }}
                                style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(200,0,0,0.4)", borderRadius: 4, color: "#fff", fontSize: 12, padding: "6px 8px", outline: "none", resize: "none", minHeight: 60, fontFamily: "Inter,sans-serif" }} autoFocus />
                              <div style={{ display: "flex", gap: 6, marginTop: 5, justifyContent: "flex-end" }}>
                                <button onClick={() => { setChatEditId(null); setChatEditText(""); }} style={{ fontSize: 10, background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, color: "rgba(255,255,255,0.4)", padding: "3px 8px", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Cancelar</button>
                                <button onClick={() => editarChatMsg(m.id)} style={{ fontSize: 10, background: "#cc0000", border: "none", borderRadius: 3, color: "#fff", padding: "3px 8px", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Guardar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.body && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap", margin: 0 }}>{m.body}</p>}
                              {adjuntos.length > 0 && <RenderChatAdjuntos adjuntos={adjuntos} />}
                            </>
                          )}
                          {!eliminado && extraerUrl(m.body ?? "") && <ChatLinkPreview url={extraerUrl(m.body ?? "")!} />}
                          {!eliminado && (
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "right", marginTop: 4, display: "flex", gap: 5, justifyContent: "flex-end" }}>
                              {m.editado && <span style={{ fontStyle: "italic" }}>editado</span>}
                              {adjuntos.length > 0 && <span>📎 {adjuntos.length}</span>}
                              {timeAgo(m.created_at)}
                            </div>
                          )}
                        </div>
                        {!eliminado && m.reacciones && Object.keys(m.reacciones).length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, justifyContent: esMio ? "flex-end" : "flex-start" }}>
                            {Object.entries(m.reacciones).map(([emoji, users]) => (
                              <button key={emoji} onClick={e => { e.stopPropagation(); reaccionarChat(m.id, emoji); }}
                                style={{ background: (users as string[]).includes(userId ?? "") ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.06)", border: (users as string[]).includes(userId ?? "") ? "1px solid rgba(200,0,0,0.3)" : "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "2px 7px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                {emoji} <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{(users as string[]).length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef}/>
              </div>

              {/* Reply preview */}
              {chatReplyMsg && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(200,0,0,0.06)", borderTop: "1px solid rgba(200,0,0,0.15)" }}>
                  <div style={{ borderLeft: "2px solid #cc0000", paddingLeft: 8, flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, marginBottom: 2 }}>Respondiendo a {fullName(chatReplyMsg.perfiles)}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chatReplyMsg.body}</div>
                  </div>
                  <button onClick={() => setChatReplyMsg(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16, padding: 4 }}>×</button>
                </div>
              )}

              {/* Preview adjuntos pendientes */}
              {chatAdjuntos.length > 0 && (
                <div style={{ padding: "8px 14px", background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Adjuntos:</span>
                  {chatAdjuntos.map((adj, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "4px 8px 4px 6px" }}>
                      {adj.tipo === "imagen" && <img src={adj.url} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }} />}
                      {adj.tipo === "video" && <span style={{ fontSize: 16 }}>🎬</span>}
                      {adj.tipo === "documento" && <span style={{ fontSize: 16 }}>📎</span>}
                      <div style={{ maxWidth: 90 }}>
                        <div style={{ fontSize: 10, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adj.nombre}</div>
                        {adj.tamano && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{formatTamano(adj.tamano)}</div>}
                      </div>
                      <button onClick={() => setChatAdjuntos(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  {subiendoChatAdj && <div style={{ width: 14, height: 14, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                </div>
              )}

              <div className="f-chat-input-area">
                {/* Preview link */}
                {chatInputPreview && (
                  <div style={{ display: "flex", gap: 8, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)", position: "relative", minHeight: 56 }}>
                    {chatInputPreview.data.image && <div style={{ width: 56, minWidth: 56, background: "#000", flexShrink: 0 }}><img src={chatInputPreview.data.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div>}
                    <div style={{ flex: 1, padding: "6px 8px 6px 0", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      {chatInputPreview.data.title && <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chatInputPreview.data.title}</div>}
                    </div>
                    <button onClick={() => setChatInputPreview(null)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                )}
                {/* UI grabando audio */}
                {grabando && (
                  <div className="f-audio-grabando">
                    <div className="f-audio-dot" />
                    <span style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>Grabando {fmtSegundos(audioSegundos)}</span>
                    <button onClick={detenerGrabacion} style={{marginLeft:"auto",padding:"4px 12px",background:"#cc0000",border:"none",borderRadius:4,color:"#fff",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}}>⏹ Detener</button>
                    <button onClick={cancelarAudio} style={{padding:"4px 10px",background:"transparent",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,color:"rgba(255,255,255,0.4)",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}}>✕ Cancelar</button>
                  </div>
                )}
                {/* UI preview audio grabado */}
                {audioUrl && !grabando && (
                  <div className="f-audio-preview">
                    <span style={{fontSize:16}}>🎙</span>
                    <audio src={audioUrl} controls style={{flex:1,height:32,minWidth:0}} />
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"Montserrat,sans-serif"}}>{fmtSegundos(audioSegundos)}</span>
                    <button onClick={enviarAudio} disabled={subiendoAudio} style={{padding:"5px 12px",background:"#cc0000",border:"none",borderRadius:4,color:"#fff",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                      {subiendoAudio ? "Enviando..." : "Enviar"}
                    </button>
                    <button onClick={cancelarAudio} style={{padding:"5px 8px",background:"transparent",border:"1px solid rgba(200,0,0,0.2)",borderRadius:4,color:"rgba(200,0,0,0.5)",fontSize:14,cursor:"pointer",flexShrink:0}}>✕</button>
                  </div>
                )}
                {!grabando && !audioUrl && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {/* Botón proponer evento */}
                    <button onClick={() => setMostrarModalEvento(true)} className="f-chat-adj-btn" title="Proponer evento">📅</button>
                    {/* Adjuntar fotos/videos */}
                    <input ref={chatFileImgRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={e => manejarChatArchivos(e.target.files)} />
                    <button onClick={() => chatFileImgRef.current?.click()} disabled={subiendoChatAdj} className="f-chat-adj-btn" title="Fotos y videos">📷</button>
                    {/* Adjuntar documentos */}
                    <input ref={chatFileDocRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx,.zip" multiple style={{ display: "none" }} onChange={e => manejarChatArchivos(e.target.files)} />
                    <button onClick={() => chatFileDocRef.current?.click()} disabled={subiendoChatAdj} className="f-chat-adj-btn" title="Documentos">📎</button>
                    {/* Grabar audio in-app */}
                    <button onClick={iniciarGrabacion} disabled={subiendoChatAdj} className="f-chat-adj-btn" title="Grabar audio" style={{color:"rgba(200,0,0,0.7)"}}>🎙</button>
                    <input ref={chatInputRef} placeholder="Escribí un mensaje..." value={chatInput}
                      style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif" }}
                      onChange={e => {
                        const val = e.target.value; setChatInput(val);
                        const urlMatch = val.match(/https?:\/\/[^\s]+/);
                        if (urlMatch) {
                          const url = urlMatch[0];
                          if (chatInputPreviewTimer.current) clearTimeout(chatInputPreviewTimer.current);
                          chatInputPreviewTimer.current = setTimeout(async () => {
                            try { const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`); const d = await res.json(); if (d.title || d.image) setChatInputPreview({ url, data: d }); } catch {}
                          }, 600);
                        } else { setChatInputPreview(null); }
                      }}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                      disabled={chatLoading} />
                    <button className="f-chat-send" onClick={sendChat} disabled={chatLoading || (!chatInput.trim() && chatAdjuntos.length === 0)}>Enviar</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {mainTab === "faq" && (
            <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)"}}>Últimas consultas resueltas</div>
                <button className="f-btn-nuevo" onClick={() => { setMainTab("temas"); setVista("nuevo"); }}>+ Nueva consulta</button>
              </div>
              {faqTopics.length === 0 ? <div className="f-empty">No hay consultas resueltas todavía.</div> :
               faqTopics.map(t => <TopicCard key={t.id} t={t} onClick={() => { setMainTab("temas"); openTopic(t); }} />)}
            </>
          )}
        </div>

        <aside className="f-right">
          <div className="f-right-box">
            <div className="f-right-title wa">💬 Grupos WhatsApp</div>
            {WA_GROUPS.map(g => (
              <a key={g.name} href={g.url} target="_blank" rel="noopener noreferrer" className={`f-ext-link${g.main?" main":""}`}>
                <span className="f-ext-name">{g.name}</span>
                {g.sub && <span className="f-ext-sub">{g.sub}</span>}
                <span className="f-ext-arrow">↗</span>
              </a>
            ))}
          </div>
          <div className="f-right-box">
            <div className="f-right-title faq">✓ Últimas resueltas</div>
            {faqTopics.slice(0,5).map(t => (
              <div key={t.id} className="f-faq-item" onClick={() => { setMainTab("temas"); openTopic(t); }}>
                <div className="f-faq-title">{t.title}</div>
                <div className="f-faq-meta">{t.forum_categories?.name} · {timeAgo(t.last_activity_at)}</div>
              </div>
            ))}
            {faqTopics.length === 0 && <div style={{padding:"12px 14px",fontSize:11,color:"rgba(255,255,255,0.2)",fontStyle:"italic"}}>Sin resueltas todavía</div>}
          </div>
        </aside>
      </div>

      {/* Modal proponer evento — igual que antes */}
      {mostrarModalEvento && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setMostrarModalEvento(false); }}>
          <div style={{ background: "#0f0f0f", border: "1px solid rgba(200,0,0,0.2)", borderRadius: 8, padding: "28px 32px", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#cc0000,transparent)", borderRadius: "8px 8px 0 0" }} />
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Proponer <span style={{ color: "#cc0000" }}>evento</span></div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "10px 14px", marginBottom: 16 }}>💡 Tu propuesta será revisada por el admin antes de publicarse en el módulo de Eventos.</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Tipo</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["gfi","GFI®","#cc0000"],["cocir","COCIR","#f97316"],["cir","CIR","#818cf8"],["externo","Externo","#64748b"]].map(([k,l,c]) => (
                  <button key={k} type="button" onClick={() => setEF("tipo", k)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${eventoForm.tipo === k ? c : "rgba(255,255,255,0.1)"}`, background: eventoForm.tipo === k ? `${c}22` : "transparent", color: eventoForm.tipo === k ? c : "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Título *</label>
              <input value={eventoForm.titulo} onChange={e => setEF("titulo", e.target.value)} placeholder="Ej: Desayuno GFI® — Agosto" style={{ width: "100%", padding: "9px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Descripción</label>
              <textarea value={eventoForm.descripcion} onChange={e => setEF("descripcion", e.target.value)} placeholder="¿De qué trata el evento?" style={{ width: "100%", padding: "9px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif", resize: "vertical", minHeight: 80 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Fecha *</label>
                <input type="date" value={eventoForm.fecha} onChange={e => setEF("fecha", e.target.value)} style={{ width: "100%", padding: "9px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif" }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Hora</label>
                <input type="time" value={eventoForm.hora} onChange={e => setEF("hora", e.target.value)} style={{ width: "100%", padding: "9px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16 }}>
              <button onClick={() => setMostrarModalEvento(false)} style={{ padding: "9px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardarEventoDesdeChat} disabled={guardandoEvento || !eventoForm.titulo || !eventoForm.fecha} style={{ padding: "9px 24px", background: "#cc0000", border: "none", borderRadius: 3, color: "#fff", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", opacity: guardandoEvento || !eventoForm.titulo || !eventoForm.fecha ? 0.6 : 1 }}>
                {guardandoEvento ? "Enviando..." : "Enviar propuesta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {perfilRapidoId && <PerfilRapidoModal perfilId={perfilRapidoId} miUserId={userId} onClose={() => setPerfilRapidoId(null)} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}

      {modalMic && (
        <div onClick={() => setModalMic(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 10000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: "16px 16px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 480, border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: "#fff" }}>🎙 Habilitar micrófono</div>
              <button onClick={() => setModalMic(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 12, lineHeight: 1.6 }}>
              El navegador bloqueó el acceso al micrófono.
            </p>
            <div style={{background:"rgba(255,200,0,0.08)",border:"1px solid rgba(255,200,0,0.3)",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
              <div style={{fontSize:10,fontFamily:"Montserrat,sans-serif",fontWeight:800,color:"#ffc800",letterSpacing:"0.1em",marginBottom:4}}>⚠ IMPORTANTE — Dominio a habilitar:</div>
              <div style={{fontSize:13,color:"#fff",fontFamily:"monospace",fontWeight:700,wordBreak:"break-all"}}>{typeof window !== "undefined" ? window.location.host : ""}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:6,lineHeight:1.4}}>Si ves <b>foroinmobiliario.com.ar</b> en Chrome y le pusiste Permitir, ese es el dominio equivocado. Tenés que habilitarlo en el de arriba.</div>
            </div>
            {typeof window !== "undefined" && window.self !== window.top && (
              <div style={{background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.3)",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
                <div style={{fontSize:11,color:"#ff8080",fontFamily:"Inter,sans-serif",lineHeight:1.5}}>🪟 Estás viendo la app embebida en otro sitio (iframe). Probá abrirla en pestaña nueva — el mic puede no funcionar dentro del iframe.</div>
              </div>
            )}
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Pasos:</p>

            <div style={{ background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 10, padding: "14px", marginBottom: 10 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 800, color: "#cc0000", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Opción A — Desde Chrome Android</div>
              {[
                "Tocá los 3 puntitos ⋮ arriba a la derecha de Chrome",
                "Ir a Configuración → Configuración del sitio",
                "Tocá Micrófono",
                "Buscá este sitio y cambialo a Permitir",
                "Volvé atrás y recargá la página",
              ].map((txt, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#cc0000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, paddingTop: 2 }}>{txt}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px", marginBottom: 10 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Opción B — Ajustes de Android</div>
              {[
                "Abrí Ajustes del teléfono",
                "Aplicaciones → Chrome",
                "Permisos → Micrófono → Permitir",
              ].map((txt, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, paddingTop: 2 }}>{txt}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 18, lineHeight: 1.5 }}>
              📱 iPhone: Ajustes → Chrome → Micrófono → Activar
            </div>
            <button onClick={() => { setModalMic(false); window.location.reload(); }} style={{ width: "100%", padding: "13px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 10, fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              Recargar página
            </button>
          </div>
        </div>
      )}
    </>
  );
}
