"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

interface Perfil { id: string; nombre: string; apellido: string; matricula: string | null; foto_url: string | null; }
interface Adjunto { url: string; nombre: string; tipo: "imagen" | "video" | "documento" | "audio"; tamano?: number; }
interface Mensaje {
  id: string; chat_id: string; autor_id: string;
  texto: string | null; adjuntos: Adjunto[] | null;
  reply_id: string | null; editado: boolean; eliminado: boolean;
  leido: boolean; reacciones: Record<string, string[]>;
  created_at: string; perfiles?: Perfil;
  _reply?: { texto: string | null; perfiles?: { nombre: string; apellido: string } };
}

const fullName = (p?: Perfil | null) => p ? `${p.apellido ?? ""}, ${p.nombre ?? ""}`.replace(/^, /, "") : "—";
const initials = (p?: Perfil | null) => p ? `${p.nombre?.charAt(0) ?? ""}${p.apellido?.charAt(0) ?? ""}`.toUpperCase() : "?";
const fmtSeg = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const fmtFecha = (iso: string) => { const d = new Date(iso), h = new Date(), a = new Date(h); a.setDate(a.getDate() - 1); if (d.toDateString() === h.toDateString()) return "Hoy"; if (d.toDateString() === a.toDateString()) return "Ayer"; return d.toLocaleDateString("es-AR", { day: "numeric", month: "long" }); };
const fmtTam = (b?: number) => { if (!b) return ""; if (b < 1024) return `${b}B`; if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`; return `${(b / 1048576).toFixed(1)}MB`; };
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "✅", "👀", "😡", "💯", "🎉"];

export default function DMPage() {
  const { perfilId } = useParams() as { perfilId: string };
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userPerfil, setUserPerfil] = useState<Perfil | null>(null);
  const [otroPerfil, setOtroPerfil] = useState<Perfil | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
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
  const [busqueda, setBusqueda] = useState("");
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, any>>({});
  const [inputPreview, setInputPreview] = useState<{ url: string; data: any } | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSeg, setAudioSeg] = useState(0);
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modalMic, setModalMic] = useState(false);
  const [menuAdj, setMenuAdj] = useState(false);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileImgRef = useRef<HTMLInputElement>(null);
  const fileDocRef = useRef<HTMLInputElement>(null);
  const fileCamRef = useRef<HTMLInputElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!perfilId || perfilId === "nuevo") return;
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      const uid = auth.user.id;
      setUserId(uid);

      const [{ data: myPerfil }, { data: otroPer }] = await Promise.all([
        supabase.from("perfiles").select("id,nombre,apellido,matricula,foto_url").eq("id", uid).single(),
        supabase.from("perfiles").select("id,nombre,apellido,matricula,foto_url").eq("id", perfilId).single(),
      ]);
      if (!otroPer) { router.push("/comunidad"); return; }
      setUserPerfil(myPerfil as Perfil);
      setOtroPerfil(otroPer as Perfil);

      // Buscar o crear chat
      const userA = uid < perfilId ? uid : perfilId;
      const userB = uid < perfilId ? perfilId : uid;
      let { data: chat } = await supabase
        .from("dm_chats")
        .select("id")
        .eq("user_a", userA)
        .eq("user_b", userB)
        .single();

      if (!chat) {
        const { data: newChat } = await supabase
          .from("dm_chats")
          .insert({ user_a: userA, user_b: userB })
          .select("id")
          .single();
        chat = newChat;
      }
      if (!chat) { router.push("/comunidad"); return; }
      setChatId(chat.id);
      await cargarMensajes(chat.id, uid);
      setLoading(false);
      suscribir(chat.id, uid);
      // Marcar como leídos
      marcarLeidos(chat.id, uid);
    };
    init();
    return () => {
      if (chatId) supabase.channel(`dm_${chatId}`).unsubscribe();
    };
  }, [perfilId]);

  useEffect(() => {
    if (!mostrarBusqueda) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, mostrarBusqueda]);

  const cargarMensajes = async (cid: string, uid: string) => {
    const { data } = await supabase.from("dm_mensajes")
      .select("*, perfiles:autor_id(id,nombre,apellido,matricula,foto_url)")
      .eq("chat_id", cid)
      .order("created_at", { ascending: true })
      .limit(200);
    if (!data) return;
    const rids = [...new Set(data.map((m: any) => m.reply_id).filter(Boolean))];
    let rm: Record<string, any> = {};
    if (rids.length > 0) {
      const { data: replies } = await supabase
        .from("dm_mensajes")
        .select("id,texto,perfiles:autor_id(nombre,apellido)")
        .in("id", rids);
      (replies ?? []).forEach((r: any) => { rm[r.id] = r; });
    }
    const msgs = data.map((m: any) => {
      const r = m.reply_id ? rm[m.reply_id] : null;
      return { ...m, perfiles: Array.isArray(m.perfiles) ? m.perfiles[0] : m.perfiles, _reply: r ? { texto: r.texto, perfiles: Array.isArray(r.perfiles) ? r.perfiles[0] : r.perfiles } : undefined };
    });
    setMensajes(msgs as any);
    const pv: Record<string, any> = {};
    await Promise.all(msgs.map(async (m: any) => {
      if (!m.texto || m.eliminado) return;
      const u = m.texto.match(/https?:\/\/[^\s]+/)?.[0]; if (!u) return;
      if (pv[u] !== undefined) return; pv[u] = "loading";
      try { const r = await fetch(`/api/link-preview?url=${encodeURIComponent(u)}`); pv[u] = await r.json(); } catch { pv[u] = "error"; }
    }));
    setLinkPreviews(pv);
  };

  const marcarLeidos = async (cid: string, uid: string) => {
    // Marcar mensajes no leídos del otro como leídos
    await supabase.from("dm_mensajes").update({ leido: true }).eq("chat_id", cid).neq("autor_id", uid).eq("leido", false);
    // Reset contador no leídos
    const chat = await supabase.from("dm_chats").select("user_a,user_b").eq("id", cid).single();
    if (!chat.data) return;
    const esA = chat.data.user_a === uid;
    await supabase.from("dm_chats").update(esA ? { no_leido_a: 0 } : { no_leido_b: 0 }).eq("id", cid);
  };

  const suscribir = (cid: string, uid: string) => {
    supabase.channel(`dm_${cid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_mensajes", filter: `chat_id=eq.${cid}` }, async ({ new: row }) => {
        const { data } = await supabase.from("dm_mensajes").select("*, perfiles:autor_id(id,nombre,apellido,matricula,foto_url)").eq("id", (row as any).id).single();
        if (!data) return;
        const d = data as any;
        const msg = { ...d, perfiles: Array.isArray(d.perfiles) ? d.perfiles[0] : d.perfiles };
        if (msg.reply_id) {
          const { data: r } = await supabase.from("dm_mensajes").select("texto,perfiles:autor_id(nombre,apellido)").eq("id", msg.reply_id).single();
          const rd = r as any;
          (msg as any)._reply = rd ? { texto: rd.texto, perfiles: Array.isArray(rd.perfiles) ? rd.perfiles[0] : rd.perfiles } : undefined;
        }
        setMensajes(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.autor_id !== uid) marcarLeidos(cid, uid);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dm_mensajes", filter: `chat_id=eq.${cid}` }, async ({ new: row }) => {
        const { data } = await supabase.from("dm_mensajes").select("*, perfiles:autor_id(id,nombre,apellido,matricula,foto_url)").eq("id", (row as any).id).single();
        if (data) {
          const d = data as any;
          setMensajes(prev => prev.map(m => m.id === d.id ? { ...d, perfiles: Array.isArray(d.perfiles) ? d.perfiles[0] : d.perfiles, _reply: m._reply } : m));
        }
      })
      .subscribe();
  };

  const subirAdj = async (file: File, cid: string): Promise<Adjunto | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const tipo: Adjunto["tipo"] = ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext) ? "imagen" : ["mp4", "mov", "avi", "webm", "mkv"].includes(ext) ? "video" : "documento";
    const path = `dm/${cid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("adjuntos_chat").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) return null;
    const { data: u } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    return { url: u.publicUrl, nombre: file.name, tipo, tamano: file.size };
  };

  const manejarArchivos = async (files: FileList | null) => {
    if (!files || !chatId) return; setSubiendoAdj(true);
    const nuevos: Adjunto[] = [];
    for (const f of Array.from(files)) { if (f.size > 20 * 1024 * 1024) { showToast(`${f.name} supera 20MB`); continue; } const a = await subirAdj(f, chatId); if (a) nuevos.push(a); }
    setAdjuntos(prev => [...prev, ...nuevos]); setSubiendoAdj(false);
  };

  const iniciarGrab = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { showToast("Tu navegador no soporta grabación."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mrRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const finalMime = mr.mimeType || mime || "audio/webm";
        setTimeout(() => {
          const blob = new Blob(chunksRef.current, { type: finalMime });
          if (blob.size > 0) { setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); } else { showToast("Audio vacío — grabá por más tiempo"); }
          setGrabando(false); stream.getTracks().forEach(t => t.stop());
        }, 150);
      };
      mr.start(100); setGrabando(true); setAudioSeg(0);
      timerRef.current = setInterval(() => setAudioSeg(s => s + 1), 1000);
    } catch (err: any) {
      const name = err?.name ?? "Error";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") setModalMic(true);
      else if (name === "NotFoundError") showToast("🎙 No se encontró micrófono.");
      else showToast(`🎙 Error: ${name}`);
    }
  };

  const detenerGrab = () => { if (timerRef.current) clearInterval(timerRef.current); mrRef.current?.stop(); };
  const cancelarAudio = () => { mrRef.current?.stop(); setGrabando(false); setAudioBlob(null); setAudioUrl(null); setAudioSeg(0); if (timerRef.current) clearInterval(timerRef.current); };

  const compartirUbicacion = () => {
    setMenuAdj(false);
    if (!navigator.geolocation) { showToast("Geolocalización no disponible"); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const adj: Adjunto = { tipo: "documento", url: `https://www.google.com/maps?q=${lat},${lng}`, nombre: `📍 Mi ubicación (${lat.toFixed(5)}, ${lng.toFixed(5)})` };
      setAdjuntos(prev => [...prev, adj]);
    }, () => showToast("No se pudo obtener la ubicación"));
  };

  const enviarAudio = async () => {
    if (!audioBlob || !userId || !chatId) return; setSubiendoAudio(true);
    const mime = audioBlob.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    const nombre = `audio_${Date.now()}.${ext}`;
    const path = `dm/${chatId}/${nombre}`;
    const file = new File([audioBlob], nombre, { type: mime });
    const { error: upErr } = await supabase.storage.from("adjuntos_chat").upload(path, file, { contentType: mime, cacheControl: "3600", upsert: false });
    if (upErr) { showToast(`Error al subir: ${upErr.message}`); setSubiendoAudio(false); return; }
    const { data: u } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    const ins: any = { chat_id: chatId, autor_id: userId, texto: null, adjuntos: [{ url: u.publicUrl, nombre, tipo: "audio", tamano: audioBlob.size }] };
    if (replyMsg?.id) ins.reply_id = replyMsg.id;
    const { error: insErr } = await supabase.from("dm_mensajes").insert(ins);
    if (insErr) { showToast(`Error al enviar: ${insErr.message}`); setSubiendoAudio(false); return; }
    // Actualizar último mensaje
    await supabase.from("dm_chats").update({ ultimo_mensaje_at: new Date().toISOString() }).eq("id", chatId);
    setAudioBlob(null); setAudioUrl(null); setAudioSeg(0); setReplyMsg(null); setSubiendoAudio(false);
  };

  const enviar = async () => {
    if ((!input.trim() && adjuntos.length === 0) || !userId || !chatId) return;
    setEnviando(true);
    const txt = input.trim(); const adjs = [...adjuntos]; const rid = replyMsg?.id ?? null;
    const temp: Mensaje = {
      id: `temp-${Date.now()}`, chat_id: chatId, autor_id: userId, texto: txt || null,
      adjuntos: adjs, reply_id: rid, editado: false, eliminado: false, leido: false,
      reacciones: {}, created_at: new Date().toISOString(), perfiles: userPerfil ?? undefined,
      _reply: replyMsg ? { texto: replyMsg.texto, perfiles: replyMsg.perfiles ? { nombre: replyMsg.perfiles.nombre, apellido: replyMsg.perfiles.apellido } : undefined } : undefined,
    };
    setMensajes(prev => [...prev, temp]); setInput(""); setAdjuntos([]); setReplyMsg(null); setInputPreview(null);
    const ins: any = { chat_id: chatId, autor_id: userId, texto: txt || null, adjuntos: adjs.length > 0 ? adjs : null };
    if (rid) ins.reply_id = rid;
    const { data: msg } = await supabase.from("dm_mensajes").insert(ins).select("*, perfiles:autor_id(id,nombre,apellido,matricula,foto_url)").single();
    if (msg) {
      const d = msg as any;
      setMensajes(prev => prev.map(m => m.id === temp.id ? { ...d, perfiles: Array.isArray(d.perfiles) ? d.perfiles[0] : d.perfiles, _reply: temp._reply } : m));
      // Incrementar contador no leídos del otro
      const esA = (await supabase.from("dm_chats").select("user_a").eq("id", chatId).single()).data?.user_a === userId;
      await supabase.from("dm_chats").update({
        ultimo_mensaje_at: new Date().toISOString(),
        ...(esA ? { no_leido_b: (await supabase.from("dm_chats").select("no_leido_b").eq("id", chatId).single()).data?.no_leido_b + 1 } : { no_leido_a: (await supabase.from("dm_chats").select("no_leido_a").eq("id", chatId).single()).data?.no_leido_a + 1 }),
      }).eq("id", chatId);
    }
    setEnviando(false); inputRef.current?.focus();
  };

  const editar = async (id: string) => { if (!editText.trim()) return; await supabase.from("dm_mensajes").update({ texto: editText.trim(), editado: true }).eq("id", id); setEditandoId(null); setEditText(""); };
  const eliminar = async (id: string) => { if (!confirm("¿Eliminar este mensaje?")) return; await supabase.from("dm_mensajes").update({ eliminado: true, texto: null }).eq("id", id); setMenuId(null); };
  const reaccionar = async (msgId: string, emoji: string) => {
    if (!userId) return;
    const msg = mensajes.find(m => m.id === msgId); if (!msg) return;
    const r = { ...(msg.reacciones ?? {}) }; const us = r[emoji] ?? [];
    if (us.includes(userId)) { r[emoji] = us.filter(u => u !== userId); if (!r[emoji].length) delete r[emoji]; } else r[emoji] = [...us, userId];
    setMensajes(prev => prev.map(m => m.id === msgId ? { ...m, reacciones: r } : m)); setMenuId(null);
    await supabase.from("dm_mensajes").update({ reacciones: r }).eq("id", msgId);
  };

  const esMio = (m: Mensaje) => m.autor_id === userId;
  const filtrados = busqueda.trim() ? mensajes.filter(m => m.texto?.toLowerCase().includes(busqueda.toLowerCase())) : mensajes;
  const porFecha: { fecha: string; msgs: Mensaje[] }[] = [];
  filtrados.forEach(m => { const f = fmtFecha(m.created_at); const u = porFecha[porFecha.length - 1]; if (u && u.fecha === f) u.msgs.push(m); else porFecha.push({ fecha: f, msgs: [m] }); });

  const renderTxt = (t: string) => t.split(/(https?:\/\/\S+)/g).map((p, i) => p.match(/^https?:\/\//) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "#4ab8d8", textDecoration: "underline", wordBreak: "break-all" }} onClick={e => e.stopPropagation()}>{p}</a> : <span key={i}>{p}</span>);

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}><div style={{ width: 28, height: 28, border: "2px solid rgba(153,0,0,0.3)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  return (
    <>
      <style>{`
        
        .dc{display:flex;flex-direction:column;height:calc(100vh - 110px);background:#0a0a0a;border-radius:10px;overflow:hidden;border:1px solid var(--gfi-border-subtle);}
        .dc-hd{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--gfi-border-subtle);background:#0f0f0f;flex-shrink:0;}
        .dc-back{background:none;border:none;color:var(--gfi-text-muted);font-size:18px;cursor:pointer;padding:4px 8px;}
        .dc-back:hover{color:#fff;}
        .dc-av{width:38px;height:38px;border-radius:50%;background:rgba(153,0,0,0.1);border:1px solid rgba(153,0,0,0.2);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:13px;font-weight:800;color:#990000;flex-shrink:0;overflow:hidden;}
        .dc-av img{width:100%;height:100%;object-fit:cover;}
        .dc-hn{font-family:var(--font-display);font-size:14px;font-weight:800;color:#fff;}
        .dc-hs{font-size:10px;color:var(--gfi-text-muted);margin-top:1px;}
        .dc-sb{background:var(--gfi-border-subtle);border:1px solid var(--gfi-border);border-radius:6px;color:var(--gfi-text-muted);cursor:pointer;font-size:14px;padding:6px 10px;transition:all 0.15s;}
        .dc-sb.on{background:rgba(153,0,0,0.1);border-color:rgba(153,0,0,0.3);color:#990000;}
        .dc-si{padding:10px 16px;background:var(--gfi-bg-card);border:none;border-bottom:1px solid var(--gfi-border-subtle);color:#fff;font-size:13px;outline:none;font-family:var(--font-body);width:100%;box-sizing:border-box;}
        .dc-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:2px;}
        .dc-msgs::-webkit-scrollbar{width:3px;}
        .dc-msgs::-webkit-scrollbar-thumb{background:var(--gfi-border);}
        .dc-day{text-align:center;margin:10px 0;}
        .dc-day span{font-size:10px;font-family:var(--font-display);font-weight:700;color:var(--gfi-text-dim);background:var(--gfi-border-subtle);border:1px solid var(--gfi-border-subtle);border-radius:20px;padding:3px 12px;display:inline-block;}
        .dc-m{display:flex;gap:8px;padding:3px 0;position:relative;}
        .dc-m.me{flex-direction:row-reverse;}
        .dc-mav{width:30px;height:30px;border-radius:8px;background:rgba(153,0,0,0.1);border:1px solid rgba(153,0,0,0.15);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:10px;font-weight:800;color:#990000;flex-shrink:0;overflow:hidden;align-self:flex-end;}
        .dc-mav img{width:100%;height:100%;object-fit:cover;}
        .dc-bw{max-width:74%;display:flex;flex-direction:column;}
        .dc-m.me .dc-bw{align-items:flex-end;}
        .dc-b{background:var(--gfi-border-subtle);border:1px solid var(--gfi-border);border-radius:12px 12px 12px 3px;padding:8px 12px;position:relative;cursor:pointer;}
        .dc-m.me .dc-b{background:rgba(153,0,0,0.09);border-color:rgba(153,0,0,0.18);border-radius:12px 12px 3px 12px;}
        .dc-b:hover{border-color:rgba(255,255,255,0.15);}
        .dc-m.me .dc-b:hover{border-color:rgba(153,0,0,0.3);}
        .dc-rp{background:var(--gfi-border-subtle);border-left:2px solid rgba(153,0,0,0.4);border-radius:4px;padding:4px 8px;margin-bottom:5px;}
        .dc-rp-a{font-size:10px;font-family:var(--font-display);font-weight:700;color:rgba(153,0,0,0.6);margin-bottom:1px;}
        .dc-rp-t{font-size:11px;color:var(--gfi-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;}
        .dc-txt{font-size:13px;color:rgba(255,255,255,0.85);font-family:var(--font-body);line-height:1.5;word-break:break-word;white-space:pre-wrap;}
        .dc-del{font-size:11px;color:var(--gfi-text-dim);font-style:italic;}
        .dc-meta{display:flex;align-items:center;gap:6px;margin-top:3px;}
        .dc-m.me .dc-meta{justify-content:flex-end;}
        .dc-hora{font-size:9px;color:var(--gfi-text-dim);font-family:var(--font-body);}
        .dc-leido{font-size:10px;color:#4ab8d8;}
        .dc-edit-badge{font-size:9px;color:rgba(255,255,255,0.18);font-style:italic;}
        .dc-reacs{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;}
        .dc-reac{background:var(--gfi-border-subtle);border:1px solid var(--gfi-border);border-radius:12px;padding:2px 7px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;}
        .dc-reac.mia{background:rgba(153,0,0,0.12);border-color:rgba(153,0,0,0.28);}
        .dc-menu{position:absolute;background:#1e1e1e;border:1px solid var(--gfi-border);border-radius:12px;padding:8px 6px;z-index:200;box-shadow:0 4px 20px rgba(0,0,0,0.6);min-width:170px;}
        .dc-menu-emojis{display:flex;gap:2px;padding:2px 4px 6px;border-bottom:1px solid var(--gfi-border-subtle);margin-bottom:2px;flex-wrap:wrap;max-width:220px;}
        .dc-menu-emojis button{background:none;border:none;cursor:pointer;font-size:19px;padding:2px 3px;border-radius:6px;}
        .dc-menu-emojis button:hover{background:var(--gfi-border);}
        .dc-mb{display:flex;align-items:center;gap:10px;background:none;border:none;color:rgba(255,255,255,0.8);font-size:13px;font-family:var(--font-body);cursor:pointer;padding:8px 12px;border-radius:8px;width:100%;text-align:left;}
        .dc-mb:hover{background:rgba(255,255,255,0.06);}
        .dc-mb.r{color:#ff6060;}
        .dc-mb.r:hover{background:rgba(255,0,0,0.07);}
        .dc-ia{border-top:1px solid rgba(255,255,255,0.06);padding:10px 14px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;background:#0f0f0f;}
        .dc-rb{display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(153,0,0,0.06);border:1px solid rgba(153,0,0,0.15);border-radius:5px;}
        .dc-rb-t{flex:1;font-size:11px;color:var(--gfi-text-muted);font-family:var(--font-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .dc-adb{width:34px;height:34px;background:var(--gfi-border-subtle);border:1px solid rgba(255,255,255,0.09);border-radius:6px;color:var(--gfi-text-secondary);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;}
        .dc-adb:hover{border-color:rgba(153,0,0,0.35);color:#990000;}
        .dc-adb-on{border-color:rgba(153,0,0,0.5) !important;color:#990000 !important;background:rgba(153,0,0,0.1) !important;}
        .dc-adj-menu-btn:hover{background:rgba(255,255,255,0.08) !important;}
        .dc-ta{flex:1;padding:9px 12px;background:var(--gfi-border-subtle);border:1px solid rgba(255,255,255,0.09);border-radius:4px;color:#fff;font-size:13px;outline:none;font-family:var(--font-body);resize:none;line-height:1.5;max-height:120px;overflow-y:auto;}
        .dc-ta:focus{border-color:rgba(153,0,0,0.35);}
        .dc-ta::placeholder{color:var(--gfi-text-dim);}
        .dc-send{padding:9px 16px;background:#990000;border:none;border-radius:4px;color:#fff;font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap;flex-shrink:0;}
        .dc-send:hover{background:#b80000;}
        .dc-send:disabled{opacity:0.45;cursor:not-allowed;}
        .dc-thumbs{display:flex;gap:6px;flex-wrap:wrap;}
        .dc-thumb{position:relative;width:56px;height:56px;border-radius:6px;overflow:hidden;background:var(--gfi-border-subtle);border:1px solid var(--gfi-border);}
        .dc-thumb img{width:100%;height:100%;object-fit:cover;}
        .dc-thumb-x{position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:rgba(0,0,0,0.7);border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .dc-a-audio{display:flex;align-items:center;gap:8px;background:rgba(153,0,0,0.06);border:1px solid rgba(153,0,0,0.15);border-radius:8px;padding:8px 10px;margin-top:4px;}
        .dc-a-doc{display:flex;align-items:center;gap:8px;background:var(--gfi-border-subtle);border:1px solid rgba(255,255,255,0.09);border-radius:6px;padding:7px 10px;margin-top:4px;text-decoration:none;}
        .dc-edit-i{width:100%;padding:7px 10px;background:var(--gfi-border-subtle);border:1px solid rgba(153,0,0,0.3);border-radius:4px;color:#fff;font-size:12px;font-family:var(--font-body);outline:none;resize:none;box-sizing:border-box;}
        .dc-adot{width:10px;height:10px;border-radius:50%;background:#990000;animation:pdot 1s ease-in-out infinite;flex-shrink:0;}
        @keyframes pdot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(.8);}}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>

      <div className="dc" onClick={() => { setMenuId(null); setMenuAdj(false); }}>

        {/* Header */}
        <div className="dc-hd">
          <button className="dc-back" onClick={() => router.push("/comunidad")}>←</button>
          <div className="dc-av">
            {otroPerfil?.foto_url
              ? <img src={otroPerfil.foto_url} alt={fullName(otroPerfil)} />
              : initials(otroPerfil)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dc-hn">{fullName(otroPerfil)}</div>
            <div className="dc-hs">
              {otroPerfil?.matricula ? `Mat. ${otroPerfil.matricula}` : "Colega"} · {mensajes.length} mensajes
            </div>
          </div>
          <button className={`dc-sb${mostrarBusqueda ? " on" : ""}`} onClick={() => { setMostrarBusqueda(v => !v); setBusqueda(""); }}>🔍</button>
        </div>

        {mostrarBusqueda && <input autoFocus className="dc-si" placeholder="Buscar en la conversación..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />}

        {/* Mensajes */}
        <div className="dc-msgs">
          {porFecha.map(({ fecha, msgs }) => (
            <div key={fecha}>
              <div className="dc-day"><span>{fecha}</span></div>
              {msgs.map(m => {
                const mio = esMio(m); const p = m.perfiles; const adjs = m.adjuntos ?? [];
                const elim = m.eliminado; const reacs = m.reacciones ?? {};
                const pUrl = m.texto?.match(/https?:\/\/[^\s]+/)?.[0];
                const pvData = pUrl ? linkPreviews[pUrl] : null;
                return (
                  <div key={m.id} className={`dc-m${mio ? " me" : ""}`}>
                    <div className="dc-mav">{p?.foto_url ? <img src={p.foto_url} alt={p.nombre} /> : initials(p)}</div>
                    <div className="dc-bw">
                      <div className="dc-b" onClick={e => { e.stopPropagation(); if (!elim) setMenuId(menuId === m.id ? null : m.id); }}>

                        {menuId === m.id && !elim && editandoId !== m.id && (
                          <div className="dc-menu" style={{ [mio ? "right" : "left"]: 0, bottom: "calc(100% + 6px)", position: "absolute" }} onClick={e => e.stopPropagation()}>
                            <div className="dc-menu-emojis">{EMOJIS.map(e => <button key={e} onClick={() => reaccionar(m.id, e)}>{e}</button>)}</div>
                            <button className="dc-mb" onClick={() => { setReplyMsg(m); setMenuId(null); inputRef.current?.focus(); }}><span style={{ width: 22, textAlign: "center" }}>↩</span>Responder</button>
                            {m.texto && <button className="dc-mb" onClick={() => { navigator.clipboard.writeText(m.texto ?? ""); setMenuId(null); }}><span style={{ width: 22, textAlign: "center" }}>📋</span>Copiar</button>}
                            {mio && m.texto && <button className="dc-mb" onClick={() => { setEditandoId(m.id); setEditText(m.texto ?? ""); setMenuId(null); setTimeout(() => editRef.current?.focus(), 50); }}><span style={{ width: 22, textAlign: "center" }}>✏️</span>Editar</button>}
                            {mio && <button className="dc-mb r" onClick={() => eliminar(m.id)}><span style={{ width: 22, textAlign: "center" }}>🗑</span>Eliminar</button>}
                          </div>
                        )}

                        {m._reply && !elim && <div className="dc-rp"><div className="dc-rp-a">{(m._reply as any).perfiles ? `${(m._reply as any).perfiles.nombre} ${(m._reply as any).perfiles.apellido}` : "Mensaje"}</div><div className="dc-rp-t">{m._reply.texto ?? "🎙 Audio"}</div></div>}

                        {elim ? <div className="dc-del">Mensaje eliminado</div>
                          : editandoId === m.id ? (
                            <div>
                              <textarea ref={editRef} className="dc-edit-i" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); editar(m.id); } if (e.key === "Escape") setEditandoId(null); }} rows={2} autoFocus />
                              <div style={{ display: "flex", gap: 6, marginTop: 5, justifyContent: "flex-end" }}>
                                <button onClick={() => setEditandoId(null)} style={{ fontSize: 10, background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, color: "var(--gfi-text-muted)", padding: "3px 8px", cursor: "pointer", fontFamily: "var(--font-display)", fontWeight: 700 }}>Cancelar</button>
                                <button onClick={() => editar(m.id)} style={{ fontSize: 10, background: "#990000", border: "none", borderRadius: 3, color: "#fff", padding: "3px 8px", cursor: "pointer", fontFamily: "var(--font-display)", fontWeight: 700 }}>Guardar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.texto && <div className="dc-txt">{renderTxt(m.texto)}</div>}
                              {adjs.map((a, i) => {
                                if (a.tipo === "audio") return <div key={i} className="dc-a-audio"><span style={{ fontSize: 18 }}>🎙</span><audio controls style={{ flex: 1, height: 32, minWidth: 0 }}><source src={a.url} type={a.nombre?.endsWith(".mp4") ? "audio/mp4" : a.nombre?.endsWith(".ogg") ? "audio/ogg" : "audio/webm"} /></audio></div>;
                                if (a.tipo === "imagen") return <img key={i} src={a.url} alt={a.nombre} style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", cursor: "pointer", marginTop: 4 }} onClick={e => { e.stopPropagation(); window.open(a.url, "_blank"); }} />;
                                if (a.tipo === "video") return <video key={i} src={a.url} controls style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginTop: 4, display: "block" }} />;
                                return <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="dc-a-doc" onClick={e => e.stopPropagation()}><span style={{ fontSize: 16 }}>📎</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</div>{a.tamano && <div style={{ fontSize: 9, color: "var(--gfi-text-muted)" }}>{fmtTam(a.tamano)}</div>}</div></a>;
                              })}
                              {pvData && pvData !== "loading" && pvData !== "error" && (pvData.title || pvData.image) && (
                                <a href={pUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 10, marginTop: 6, borderRadius: 6, overflow: "hidden", border: "1px solid var(--gfi-border)", background: "rgba(0,0,0,0.35)", textDecoration: "none", minHeight: 60 }}>
                                  {pvData.image && <div style={{ width: 60, minWidth: 60, background: "#000" }}><img src={pvData.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div>}
                                  <div style={{ flex: 1, padding: "6px 8px 6px 0", minWidth: 0 }}>{pvData.siteName && <div style={{ fontSize: 9, color: "#4ab8d8", fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 2 }}>{pvData.siteName}</div>}{pvData.title && <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pvData.title}</div>}</div>
                                </a>
                              )}
                            </>
                          )}
                        {!elim && <div className="dc-meta">{m.editado && <span className="dc-edit-badge">editado</span>}<span className="dc-hora">{fmtHora(m.created_at)}</span>{mio && m.leido && <span className="dc-leido">✓✓</span>}</div>}
                      </div>
                      {Object.keys(reacs).length > 0 && !elim && (
                        <div className="dc-reacs" style={{ justifyContent: mio ? "flex-end" : "flex-start" }}>
                          {Object.entries(reacs).map(([e, us]) => <button key={e} className={`dc-reac${(us as string[]).includes(userId ?? "") ? " mia" : ""}`} onClick={ev => { ev.stopPropagation(); reaccionar(m.id, e); }}>{e} <span style={{ fontSize: 10, color: "var(--gfi-text-secondary)" }}>{(us as string[]).length}</span></button>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {filtrados.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.18)", fontSize: 12, fontFamily: "Inter,sans-serif" }}>{busqueda ? `Sin resultados para "${busqueda}"` : "Empezá la conversación 👋"}</div>}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="dc-ia">
          {replyMsg && <div className="dc-rb"><span style={{ fontSize: 12, color: "rgba(153,0,0,0.6)", fontFamily: "var(--font-display)", fontWeight: 700 }}>↩</span><span className="dc-rb-t">{fullName(replyMsg.perfiles)}: {replyMsg.texto ?? "🎙 Audio"}</span><button style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", cursor: "pointer", fontSize: 16, padding: 0 }} onClick={() => setReplyMsg(null)}>×</button></div>}
          {adjuntos.length > 0 && <div className="dc-thumbs">{adjuntos.map((a, i) => <div key={i} className="dc-thumb">{a.tipo === "imagen" ? <img src={a.url} alt={a.nombre} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{a.tipo === "video" ? "🎬" : "📎"}</div>}<button className="dc-thumb-x" onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== i))}>×</button></div>)}</div>}
          {grabando && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", background: "rgba(153,0,0,0.08)", border: "1px solid rgba(153,0,0,0.25)", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="dc-adot" />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "var(--font-display)", fontWeight: 700 }}>Grabando... {fmtSeg(audioSeg)}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={detenerGrab} style={{ flex: 1, padding: "12px", background: "#990000", border: "none", borderRadius: 8, color: "#fff", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>⏹ Detener y revisar</button>
                <button onClick={cancelarAudio} style={{ padding: "12px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "var(--gfi-text-secondary)", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          )}
          {audioUrl && !grabando && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 14px", background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>🎙</span>
                <audio src={audioUrl} controls style={{ flex: 1, height: 36, minWidth: 0 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={enviarAudio} disabled={subiendoAudio} style={{ flex: 1, padding: "12px", background: "#990000", border: "none", borderRadius: 8, color: "#fff", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{subiendoAudio ? "Enviando..." : "➤ Enviar audio"}</button>
                <button onClick={cancelarAudio} style={{ padding: "12px 16px", background: "transparent", border: "1px solid rgba(153,0,0,0.2)", borderRadius: 8, color: "rgba(153,0,0,0.6)", fontSize: 16, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          )}
          {inputPreview && !grabando && !audioUrl && <div style={{ position: "relative" }}><a href={inputPreview.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 10, borderRadius: 6, overflow: "hidden", border: "1px solid var(--gfi-border)", background: "rgba(0,0,0,0.35)", textDecoration: "none", minHeight: 60 }}>{inputPreview.data.image && <div style={{ width: 60, minWidth: 60, background: "#000" }}><img src={inputPreview.data.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}<div style={{ flex: 1, padding: "8px 10px 8px 0", minWidth: 0 }}>{inputPreview.data.title && <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{inputPreview.data.title}</div>}</div></a><button onClick={e => { e.stopPropagation(); setInputPreview(null); }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button></div>}
          {!grabando && !audioUrl && (
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
              <input ref={fileImgRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={e => manejarArchivos(e.target.files)} />
              <input ref={fileDocRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx,.zip" multiple style={{ display: "none" }} onChange={e => manejarArchivos(e.target.files)} />
              <input ref={fileCamRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => manejarArchivos(e.target.files)} />
              <div style={{ position: "relative", flexShrink: 0 }}>
                {menuAdj && <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setMenuAdj(false)} />
                  <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: 0, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "12px 10px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, width: 216, zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}>
                    {([
                      { icon: "📸", label: "Cámara",    action: () => { setMenuAdj(false); fileCamRef.current?.click(); } },
                      { icon: "🖼",  label: "Galería",   action: () => { setMenuAdj(false); fileImgRef.current?.click(); } },
                      { icon: "📄",  label: "Documento", action: () => { setMenuAdj(false); fileDocRef.current?.click(); } },
                      { icon: "🎙",  label: "Audio",     action: () => { setMenuAdj(false); iniciarGrab(); } },
                      { icon: "📍",  label: "Ubicación", action: compartirUbicacion },
                    ] as { icon: string; label: string; action: () => void }[]).map(({ icon, label, action }) => (
                      <button key={label} onClick={action} className="dc-adj-menu-btn" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 4px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, cursor: "pointer", color: "#fff", fontFamily: "var(--font-body)", fontSize: 10, transition: "background 0.15s" }}>
                        <span style={{ fontSize: 22 }}>{icon}</span>
                        <span style={{ color: "var(--gfi-text-secondary)" }}>{label}</span>
                      </button>
                    ))}
                  </div>
                </>}
                <button className={`dc-adb${menuAdj ? " dc-adb-on" : ""}`} onClick={e => { e.stopPropagation(); setMenuAdj(v => !v); }} title="Adjuntar">📎</button>
              </div>
              <textarea ref={inputRef} className="dc-ta" placeholder="Escribí un mensaje..." value={input} rows={1}
                onChange={e => {
                  setInput(e.target.value);
                  const t = e.target; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px";
                  const u = e.target.value.match(/https?:\/\/[^\s]+/)?.[0];
                  if (u) { if (previewTimer.current) clearTimeout(previewTimer.current); previewTimer.current = setTimeout(async () => { try { const r = await fetch(`/api/link-preview?url=${encodeURIComponent(u)}`); const d = await r.json(); if (d.title || d.image) setInputPreview({ url: u, data: d }); } catch { } }, 600); } else setInputPreview(null);
                }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                disabled={enviando}
              />
              <button className="dc-send" onClick={enviar} disabled={enviando || subiendoAdj || (!input.trim() && adjuntos.length === 0)}>
                {enviando ? "..." : "➤"}
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid var(--gfi-border)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}

      {modalMic && (
        <div onClick={() => setModalMic(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 10000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: "16px 16px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 480, border: "1px solid var(--gfi-border)", borderBottom: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: "#fff" }}>🎙 Habilitar micrófono</div>
              <button onClick={() => setModalMic(false)} style={{ background: "none", border: "none", color: "var(--gfi-text-muted)", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--gfi-text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>El micrófono fue bloqueado para este sitio. Habilitalo desde la configuración del navegador y recargá la página.</p>
            <button onClick={() => { setModalMic(false); window.location.reload(); }} style={{ width: "100%", padding: "13px", background: "#990000", color: "#fff", border: "none", borderRadius: 10, fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              Recargar página
            </button>
          </div>
        </div>
      )}
    </>
  );
}
