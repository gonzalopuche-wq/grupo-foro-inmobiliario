"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

interface Perfil { id: string; nombre: string; apellido: string; matricula: string | null; foto_url: string | null; }
interface Adjunto { url: string; nombre: string; tipo: "imagen" | "video" | "documento" | "audio"; tamano?: number; }
interface Mensaje {
  id: string; grupo_id: string; perfil_id: string; user_id?: string;
  texto: string | null; tipo?: string; mir_id?: string; mir_tipo?: string;
  adjuntos: Adjunto[] | null; reply_id: string | null;
  editado: boolean; eliminado?: boolean; reacciones?: Record<string, string[]>;
  created_at: string; perfiles?: Perfil;
  _reply?: { texto: string | null; perfiles?: { nombre: string; apellido: string } };
}
interface Grupo { id: string; nombre: string; icono: string; tipo: string; va_al_mir: boolean; solo_matriculado: boolean; descripcion: string | null; }

const fullName = (p?: Perfil | null) => p ? `${p.apellido ?? ""}, ${p.nombre ?? ""}`.replace(/^, /, "") : "—";
const initials = (p?: Perfil | null) => p ? `${p.nombre?.charAt(0) ?? ""}${p.apellido?.charAt(0) ?? ""}`.toUpperCase() : "?";
const fmtSeg = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const fmtFecha = (iso: string) => { const d = new Date(iso), h = new Date(), a = new Date(h); a.setDate(a.getDate()-1); if (d.toDateString()===h.toDateString()) return "Hoy"; if (d.toDateString()===a.toDateString()) return "Ayer"; return d.toLocaleDateString("es-AR",{day:"numeric",month:"long"}); };
const fmtTam = (b?: number) => { if (!b) return ""; if (b<1024) return `${b}B`; if (b<1048576) return `${(b/1024).toFixed(1)}KB`; return `${(b/1048576).toFixed(1)}MB`; };
const EMOJIS = ["👍","❤️","😂","😮","😢","🙏","🔥","✅","👀","😡","💯","🎉"];

export default function GrupoChatPage() {
  const { grupoId } = useParams() as { grupoId: string };
  const router = useRouter();
  const [userId, setUserId] = useState<string|null>(null);
  const [userPerfil, setUserPerfil] = useState<Perfil|null>(null);
  const [grupo, setGrupo] = useState<Grupo|null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [replyMsg, setReplyMsg] = useState<Mensaje|null>(null);
  const [menuId, setMenuId] = useState<string|null>(null);
  const [editandoId, setEditandoId] = useState<string|null>(null);
  const [editText, setEditText] = useState("");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [subiendoAdj, setSubiendoAdj] = useState(false);
  const [parserInfo, setParserInfo] = useState<string|null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<Record<string,any>>({});
  const [inputPreview, setInputPreview] = useState<{url:string;data:any}|null>(null);
  const [grabando, setGrabando] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob|null>(null);
  const [audioUrl, setAudioUrl] = useState<string|null>(null);
  const [audioSeg, setAudioSeg] = useState(0);
  const [subiendoAudio, setSubiendoAudio] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [modalMic, setModalMic] = useState(false);
  const [micEstado, setMicEstado] = useState<'ok'|'denegado'|'sin-soporte'|'desconocido'>('desconocido');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };
  const mrRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileImgRef = useRef<HTMLInputElement>(null);
  const fileDocRef = useRef<HTMLInputElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    if (!grupoId) return;
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);
      const [{ data: perfil }, { data: g }] = await Promise.all([
        supabase.from("perfiles").select("id,nombre,apellido,matricula,foto_url,tipo").eq("id", auth.user.id).single(),
        supabase.from("grupos_chat").select("*").eq("id", grupoId).single(),
      ]);
      if (!g) { router.push("/comunidad"); return; }
      if (g.solo_matriculado && (perfil as any)?.tipo === "colaborador") { router.push("/comunidad"); return; }
      setUserPerfil(perfil as Perfil);
      setGrupo(g as Grupo);
      await cargarMensajes();
      setLoading(false);
      suscribir();
    };
    init();
    return () => { supabase.channel(`chat_${grupoId}`).unsubscribe(); };
  }, [grupoId]);

  useEffect(() => { if (!mostrarBusqueda) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes, mostrarBusqueda]);

  const cargarMensajes = async () => {
    const { data } = await supabase.from("mensajes_chat")
      .select("*, perfiles(id,nombre,apellido,matricula,foto_url)")
      .eq("grupo_id", grupoId).order("created_at", { ascending: true }).limit(200);
    if (!data) return;
    const rids = [...new Set(data.map((m:any) => m.reply_id).filter(Boolean))];
    let rm: Record<string,any> = {};
    if (rids.length > 0) {
      const { data: replies } = await supabase.from("mensajes_chat").select("id,texto,perfiles(nombre,apellido)").in("id", rids);
      (replies ?? []).forEach((r:any) => { rm[r.id] = r; });
    }
    const msgs = data.map((m:any) => { const r = m.reply_id ? rm[m.reply_id] : null; return { ...m, _reply: r ? { texto: r.texto, perfiles: Array.isArray(r.perfiles) ? r.perfiles[0] : r.perfiles } : undefined }; });
    setMensajes(msgs as any);
    // link previews
    const pv: Record<string,any> = {};
    await Promise.all(msgs.map(async (m:any) => {
      if (!m.texto || m.eliminado) return;
      const u = m.texto.match(/https?:\/\/[^\s]+/)?.[0]; if (!u) return;
      if (pv[u] !== undefined) return; pv[u] = "loading";
      try { const r = await fetch(`/api/link-preview?url=${encodeURIComponent(u)}`); pv[u] = await r.json(); } catch { pv[u] = "error"; }
    }));
    setLinkPreviews(pv);
  };

  const suscribir = () => {
    supabase.channel(`chat_${grupoId}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"mensajes_chat", filter:`grupo_id=eq.${grupoId}` }, async ({new:row}) => {
        const { data } = await supabase.from("mensajes_chat").select("*, perfiles(id,nombre,apellido,matricula,foto_url)").eq("id",(row as any).id).single();
        if (!data) return;
        let msg = data as Mensaje;
        if (msg.reply_id) { const {data:r} = await supabase.from("mensajes_chat").select("texto,perfiles(nombre,apellido)").eq("id",msg.reply_id).single(); const rData = r as any; msg = {...msg, _reply: rData ? { texto: rData.texto, perfiles: Array.isArray(rData.perfiles) ? rData.perfiles[0] : rData.perfiles } : undefined}; }
        setMensajes(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"mensajes_chat", filter:`grupo_id=eq.${grupoId}` }, async ({new:row}) => {
        const { data } = await supabase.from("mensajes_chat").select("*, perfiles(id,nombre,apellido,matricula,foto_url)").eq("id",(row as any).id).single();
        if (data) setMensajes(prev => prev.map(m => m.id === (data as any).id ? {...data as Mensaje, _reply: m._reply} : m));
      })
      .on("postgres_changes", { event:"DELETE", schema:"public", table:"mensajes_chat", filter:`grupo_id=eq.${grupoId}` }, ({old:row}) => setMensajes(prev => prev.filter(m => m.id !== (row as any).id)))
      .subscribe();
  };

  const subirAdj = async (file: File): Promise<Adjunto|null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const tipo: Adjunto["tipo"] = ["jpg","jpeg","png","gif","webp","heic"].includes(ext) ? "imagen" : ["mp4","mov","avi","webm","mkv"].includes(ext) ? "video" : "documento";
    const path = `grupos/${grupoId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const { error } = await supabase.storage.from("adjuntos_chat").upload(path, file, { cacheControl:"3600", upsert:false });
    if (error) return null;
    const { data: u } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    return { url: u.publicUrl, nombre: file.name, tipo, tamano: file.size };
  };

  const manejarArchivos = async (files: FileList|null) => {
    if (!files) return; setSubiendoAdj(true);
    const nuevos: Adjunto[] = [];
    for (const f of Array.from(files)) { if (f.size > 20*1024*1024) { showToast(`${f.name} supera 20MB`); continue; } const a = await subirAdj(f); if (a) nuevos.push(a); }
    setAdjuntos(prev => [...prev, ...nuevos]); setSubiendoAdj(false);
  };

  const iniciarGrab = async () => {
    const enIframe = typeof window !== "undefined" && window.self !== window.top;
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(enIframe ? "⚠ App embebida sin soporte de mic" : "Tu navegador no soporta grabación.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" :
                   MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" :
                   MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mrRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const finalMime = mime || mr.mimeType || "audio/webm";
        showToast(`onstop: ${chunksRef.current.length} chunks, mime=${finalMime}`);
        setTimeout(() => {
          const blob = new Blob(chunksRef.current, { type: finalMime });
          showToast(`blob: ${blob.size}B`);
          if (blob.size > 0) {
            setAudioBlob(blob);
            setAudioUrl(URL.createObjectURL(blob));
          } else {
            showToast("Audio vacío, intentá más largo");
          }
          setGrabando(false);
          stream.getTracks().forEach(t => t.stop());
        }, 150);
      };
      mr.start(100); setGrabando(true); setAudioSeg(0);
      showToast("🎙 Grabando — tocá Detener cuando termines");
      timerRef.current = setInterval(() => setAudioSeg(s => s+1), 1000);
    } catch (err: any) {
      const name = err?.name ?? "Error";
      const msg = err?.message ?? "";
      console.error("[mic]", name, msg, err);
      if (enIframe) {
        showToast(`⚠ App embebida bloquea el micrófono. Abrí en pestaña nueva. (${name})`);
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

  const detenerGrab = () => { if (timerRef.current) clearInterval(timerRef.current); mrRef.current?.stop(); };
  const cancelarAudio = () => { mrRef.current?.stop(); setGrabando(false); setAudioBlob(null); setAudioUrl(null); setAudioSeg(0); if (timerRef.current) clearInterval(timerRef.current); };

  const enviarAudio = async () => {
    if (!audioBlob || !userId) return; setSubiendoAudio(true);
    const mime = audioBlob.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    const nombre = `audio_${Date.now()}.${ext}`;
    const path = `grupos/${grupoId}/${nombre}`;
    const file = new File([audioBlob], nombre, { type: mime });
    const { error: upErr } = await supabase.storage.from("adjuntos_chat").upload(path, file, { cacheControl:"3600", upsert:false });
    if (upErr) { showToast(`Error al subir: ${upErr.message}`); setSubiendoAudio(false); return; }
    const { data: u } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    const ins: any = { grupo_id: grupoId, perfil_id: userId, texto: null, adjuntos: [{ url: u.publicUrl, nombre, tipo: "audio", tamano: audioBlob.size }] };
    if (replyMsg?.id) ins.reply_id = replyMsg.id;
    const { error: insErr } = await supabase.from("mensajes_chat").insert(ins);
    if (insErr) { showToast(`Error al enviar: ${insErr.message}`); setSubiendoAudio(false); return; }
    setAudioBlob(null); setAudioUrl(null); setAudioSeg(0); setReplyMsg(null); setSubiendoAudio(false);
    showToast("🎙 Audio enviado");
  };

  const enviar = async () => {
    if ((!input.trim() && adjuntos.length === 0) || !userId || !grupo) return;
    setEnviando(true);
    const txt = input.trim(); const adjs = [...adjuntos]; const rid = replyMsg?.id ?? null;
    const temp: Mensaje = { id:`temp-${Date.now()}`, grupo_id: grupoId, perfil_id: userId, texto: txt||null, adjuntos: adjs, reply_id: rid, editado:false, eliminado:false, reacciones:{}, created_at: new Date().toISOString(), perfiles: userPerfil ?? undefined, _reply: replyMsg ?? undefined };
    setMensajes(prev => [...prev, temp]); setInput(""); setAdjuntos([]); setReplyMsg(null); setInputPreview(null);
    const ins: any = { grupo_id: grupoId, perfil_id: userId, texto: txt||null, adjuntos: adjs.length > 0 ? adjs : null };
    if (rid) ins.reply_id = rid;
    const { data: msg } = await supabase.from("mensajes_chat").insert(ins).select("*, perfiles(id,nombre,apellido,matricula,foto_url)").single();
    if (msg) setMensajes(prev => prev.map(m => m.id === temp.id ? {...msg as Mensaje, _reply: temp._reply} : m));
    if (grupo.va_al_mir && msg && txt) {
      try { const r = await fetch("/api/comunidad/parser",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({texto:txt,grupo_id:grupoId,user_id:userId,mensaje_id:(msg as any).id})}); const res = await r.json(); if (res.cargado) { setParserInfo(`Cargado al MIR como ${res.tipo}`); setTimeout(()=>setParserInfo(null),4000); } } catch {}
    }
    setEnviando(false); inputRef.current?.focus();
  };

  const editar = async (id: string) => { if (!editText.trim()) return; await supabase.from("mensajes_chat").update({texto:editText.trim(),editado:true}).eq("id",id); setEditandoId(null); setEditText(""); };
  const eliminar = async (id: string) => { if (!confirm("¿Eliminar este mensaje?")) return; await supabase.from("mensajes_chat").update({eliminado:true,texto:""}).eq("id",id); setMenuId(null); };
  const reaccionar = async (msgId: string, emoji: string) => {
    if (!userId) return;
    const msg = mensajes.find(m => m.id === msgId); if (!msg) return;
    const r = {...(msg.reacciones??{})}; const us = r[emoji]??[];
    if (us.includes(userId)) { r[emoji]=us.filter(u=>u!==userId); if (!r[emoji].length) delete r[emoji]; } else r[emoji]=[...us,userId];
    setMensajes(prev => prev.map(m => m.id === msgId ? {...m,reacciones:r} : m)); setMenuId(null);
    await supabase.from("mensajes_chat").update({reacciones:r}).eq("id",msgId);
  };
  const esMio = (m: Mensaje) => (m.perfil_id??m.user_id) === userId;

  const filtrados = busqueda.trim() ? mensajes.filter(m => m.texto?.toLowerCase().includes(busqueda.toLowerCase())) : mensajes;
  const porFecha: {fecha:string;msgs:Mensaje[]}[] = [];
  filtrados.forEach(m => { const f=fmtFecha(m.created_at); const u=porFecha[porFecha.length-1]; if(u&&u.fecha===f) u.msgs.push(m); else porFecha.push({fecha:f,msgs:[m]}); });

  const renderTxt = (t: string) => t.split(/(https?:\/\/\S+)/g).map((p,i) => p.match(/^https?:\/\//) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{color:"#60a5fa",textDecoration:"underline",wordBreak:"break-all"}} onClick={e=>e.stopPropagation()}>{p}</a> : <span key={i}>{p}</span>);

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}><div style={{width:28,height:28,border:"2px solid rgba(200,0,0,0.3)",borderTopColor:"#cc0000",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        .gc{display:flex;flex-direction:column;height:calc(100vh - 110px);background:#0a0a0a;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);}
        .gc-hd{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);background:#0f0f0f;flex-shrink:0;}
        .gc-back{background:none;border:none;color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer;padding:4px 8px;}
        .gc-back:hover{color:#fff;}
        .gc-ico{width:38px;height:38px;border-radius:9px;background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
        .gc-hn{font-family:'Montserrat',sans-serif;font-size:14px;font-weight:800;color:#fff;}
        .gc-hs{font-size:10px;color:rgba(255,255,255,0.3);margin-top:1px;}
        .gc-mir-b{font-size:9px;padding:2px 7px;border-radius:3px;background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.2);color:#cc0000;font-family:'Montserrat',sans-serif;font-weight:700;}
        .gc-sb{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:rgba(255,255,255,0.4);cursor:pointer;font-size:14px;padding:6px 10px;transition:all 0.15s;}
        .gc-sb.on{background:rgba(200,0,0,0.1);border-color:rgba(200,0,0,0.3);color:#cc0000;}
        .gc-si{padding:10px 16px;background:rgba(255,255,255,0.03);border:none;border-bottom:1px solid rgba(255,255,255,0.07);color:#fff;font-size:13px;outline:none;font-family:'Inter',sans-serif;width:100%;box-sizing:border-box;}
        .gc-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:2px;}
        .gc-msgs::-webkit-scrollbar{width:3px;}
        .gc-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);}
        .gc-day{text-align:center;margin:10px 0;}
        .gc-day span{font-size:10px;font-family:'Montserrat',sans-serif;font-weight:700;color:rgba(255,255,255,0.2);background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:3px 12px;display:inline-block;}
        .gc-m{display:flex;gap:8px;padding:3px 0;position:relative;}
        .gc-m.me{flex-direction:row-reverse;}
        .gc-av{width:30px;height:30px;border-radius:8px;background:rgba(200,0,0,0.1);border:1px solid rgba(200,0,0,0.15);display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:800;color:#cc0000;flex-shrink:0;overflow:hidden;align-self:flex-end;}
        .gc-av img{width:100%;height:100%;object-fit:cover;}
        .gc-bw{max-width:74%;display:flex;flex-direction:column;}
        .gc-m.me .gc-bw{align-items:flex-end;}
        .gc-id{display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;}
        .gc-m.me .gc-id{justify-content:flex-end;flex-direction:row-reverse;}
        .gc-id-n{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:rgba(200,0,0,0.85);}
        .gc-id-m{font-size:10px;color:rgba(255,255,255,0.3);font-family:'Montserrat',sans-serif;font-weight:600;}
        .gc-b{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px 12px 12px 3px;padding:8px 12px;position:relative;cursor:pointer;}
        .gc-m.me .gc-b{background:rgba(200,0,0,0.09);border-color:rgba(200,0,0,0.18);border-radius:12px 12px 3px 12px;}
        .gc-b:hover{border-color:rgba(255,255,255,0.15);}
        .gc-m.me .gc-b:hover{border-color:rgba(200,0,0,0.3);}
        .gc-rp{background:rgba(255,255,255,0.04);border-left:2px solid rgba(200,0,0,0.4);border-radius:4px;padding:4px 8px;margin-bottom:5px;}
        .gc-rp-a{font-size:10px;font-family:'Montserrat',sans-serif;font-weight:700;color:rgba(200,0,0,0.6);margin-bottom:1px;}
        .gc-rp-t{font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;}
        .gc-txt{font-size:13px;color:rgba(255,255,255,0.85);font-family:'Inter',sans-serif;line-height:1.5;word-break:break-word;white-space:pre-wrap;}
        .gc-del{font-size:11px;color:rgba(255,255,255,0.2);font-style:italic;}
        .gc-meta{display:flex;align-items:center;gap:6px;margin-top:3px;}
        .gc-m.me .gc-meta{justify-content:flex-end;}
        .gc-hora{font-size:9px;color:rgba(255,255,255,0.2);font-family:'Inter',sans-serif;}
        .gc-edit-badge{font-size:9px;color:rgba(255,255,255,0.18);font-style:italic;}
        .gc-reacs{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;}
        .gc-reac{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:2px 7px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;}
        .gc-reac.mia{background:rgba(200,0,0,0.12);border-color:rgba(200,0,0,0.28);}
        .gc-menu{position:absolute;background:#1e1e1e;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:8px 6px;z-index:200;box-shadow:0 4px 20px rgba(0,0,0,0.6);min-width:170px;}
        .gc-menu-emojis{display:flex;gap:2px;padding:2px 4px 6px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:2px;flex-wrap:wrap;max-width:220px;}
        .gc-menu-emojis button{background:none;border:none;cursor:pointer;font-size:19px;padding:2px 3px;border-radius:6px;}
        .gc-menu-emojis button:hover{background:rgba(255,255,255,0.08);}
        .gc-mb{display:flex;align-items:center;gap:10px;background:none;border:none;color:rgba(255,255,255,0.8);font-size:13px;font-family:'Inter',sans-serif;cursor:pointer;padding:8px 12px;border-radius:8px;width:100%;text-align:left;}
        .gc-mb:hover{background:rgba(255,255,255,0.06);}
        .gc-mb.r{color:#ff6060;}
        .gc-mb.r:hover{background:rgba(255,0,0,0.07);}
        .gc-ia{border-top:1px solid rgba(255,255,255,0.06);padding:10px 14px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;background:#0f0f0f;}
        .gc-rb{display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(200,0,0,0.06);border:1px solid rgba(200,0,0,0.15);border-radius:5px;}
        .gc-rb-t{flex:1;font-size:11px;color:rgba(255,255,255,0.4);font-family:'Inter',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .gc-adb{width:34px;height:34px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:6px;color:rgba(255,255,255,0.5);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;}
        .gc-adb:hover{border-color:rgba(200,0,0,0.35);color:#cc0000;}
        .gc-ta{flex:1;padding:9px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:4px;color:#fff;font-size:13px;outline:none;font-family:'Inter',sans-serif;resize:none;line-height:1.5;max-height:120px;overflow-y:auto;}
        .gc-ta:focus{border-color:rgba(200,0,0,0.35);}
        .gc-ta::placeholder{color:rgba(255,255,255,0.2);}
        .gc-send{padding:9px 16px;background:#cc0000;border:none;border-radius:4px;color:#fff;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap;flex-shrink:0;}
        .gc-send:hover{background:#e60000;}
        .gc-send:disabled{opacity:0.45;cursor:not-allowed;}
        .gc-agrab{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(200,0,0,0.08);border:1px solid rgba(200,0,0,0.25);border-radius:6px;}
        .gc-adot{width:10px;height:10px;border-radius:50%;background:#cc0000;animation:pdot 1s ease-in-out infinite;flex-shrink:0;}
        .gc-aprev{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;}
        .gc-thumbs{display:flex;gap:6px;flex-wrap:wrap;}
        .gc-thumb{position:relative;width:56px;height:56px;border-radius:6px;overflow:hidden;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);}
        .gc-thumb img{width:100%;height:100%;object-fit:cover;}
        .gc-thumb-x{position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:rgba(0,0,0,0.7);border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .gc-a-audio{display:flex;align-items:center;gap:8px;background:rgba(200,0,0,0.06);border:1px solid rgba(200,0,0,0.15);border-radius:8px;padding:8px 10px;margin-top:4px;}
        .gc-a-doc{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:6px;padding:7px 10px;margin-top:4px;text-decoration:none;}
        .gc-edit-i{width:100%;padding:7px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(200,0,0,0.3);border-radius:4px;color:#fff;font-size:12px;font-family:'Inter',sans-serif;outline:none;resize:none;box-sizing:border-box;}
        .gc-parser{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:6px;padding:7px 14px;font-size:11px;color:#4ade80;flex-shrink:0;}
        @keyframes pdot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(.8);}}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>

      <div className="gc" onClick={() => setMenuId(null)}>

        {/* Header */}
        <div className="gc-hd">
          <button className="gc-back" onClick={() => router.push("/comunidad")}>←</button>
          <div className="gc-ico">{grupo?.icono ?? "💬"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className="gc-hn">{grupo?.nombre}</div>
            <div className="gc-hs">{mensajes.length} mensajes{grupo?.va_al_mir ? " · Conectado al MIR" : ""}</div>
          </div>
          {grupo?.va_al_mir && <span className="gc-mir-b">MIR</span>}
          <button className={`gc-sb${mostrarBusqueda?" on":""}`} onClick={() => { setMostrarBusqueda(v=>!v); setBusqueda(""); }}>🔍</button>
        </div>

        {mostrarBusqueda && <input autoFocus className="gc-si" placeholder="Buscar en el chat..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />}
        {parserInfo && <div className="gc-parser">{parserInfo}</div>}

        {/* Mensajes */}
        <div className="gc-msgs">
          {porFecha.map(({fecha,msgs}) => (
            <div key={fecha}>
              <div className="gc-day"><span>{fecha}</span></div>
              {msgs.map(m => {
                const mio = esMio(m); const p = m.perfiles; const adjs = m.adjuntos ?? [];
                const elim = m.eliminado; const reacs = m.reacciones ?? {};
                const pUrl = m.texto?.match(/https?:\/\/[^\s]+/)?.[0];
                const pvData = pUrl ? linkPreviews[pUrl] : null;
                return (
                  <div key={m.id} className={`gc-m${mio?" me":""}`}>
                    <div className="gc-av">{p?.foto_url ? <img src={p.foto_url} alt={p.nombre}/> : initials(p)}</div>
                    <div className="gc-bw">
                      {/* Identidad COCIR */}
                      {!mio && !elim && <div className="gc-id"><span className="gc-id-n">{fullName(p)}</span><span className="gc-id-m" style={!p?.matricula?{color:"rgba(200,0,0,0.35)"}:{}}>{p?.matricula ? `Mat. ${p.matricula}` : "Sin matrícula"}</span></div>}
                      {mio && !elim && <div className="gc-id"><span className="gc-id-m" style={{color:"rgba(255,255,255,0.18)"}}>{userPerfil?.matricula ? `Mat. ${userPerfil.matricula}` : "Sin matrícula"}</span><span className="gc-id-n" style={{color:"rgba(255,255,255,0.4)"}}>Vos</span></div>}

                      <div className="gc-b" onClick={e => { e.stopPropagation(); if (!elim) setMenuId(menuId===m.id?null:m.id); }}>

                        {/* Menú contextual */}
                        {menuId===m.id && !elim && editandoId!==m.id && (
                          <div className="gc-menu" style={{[mio?"right":"left"]:0,bottom:"calc(100% + 6px)",position:"absolute"}} onClick={e=>e.stopPropagation()}>
                            <div className="gc-menu-emojis">{EMOJIS.map(e => <button key={e} onClick={()=>reaccionar(m.id,e)}>{e}</button>)}</div>
                            <button className="gc-mb" onClick={()=>{setReplyMsg(m);setMenuId(null);inputRef.current?.focus();}}><span style={{width:22,textAlign:"center"}}>↩</span>Responder</button>
                            {m.texto && <button className="gc-mb" onClick={()=>{navigator.clipboard.writeText(m.texto??"");setMenuId(null);}}><span style={{width:22,textAlign:"center"}}>📋</span>Copiar</button>}
                            {mio && m.texto && <button className="gc-mb" onClick={()=>{setEditandoId(m.id);setEditText(m.texto??"");setMenuId(null);setTimeout(()=>editRef.current?.focus(),50);}}><span style={{width:22,textAlign:"center"}}>✏️</span>Editar</button>}
                            {mio && <button className="gc-mb r" onClick={()=>eliminar(m.id)}><span style={{width:22,textAlign:"center"}}>🗑</span>Eliminar</button>}
                            {!mio && <button className="gc-mb" onClick={()=>{showToast("Mensaje reportado al admin.");setMenuId(null);}}><span style={{width:22,textAlign:"center"}}>🚩</span>Reportar</button>}
                          </div>
                        )}

                        {m._reply && !elim && <div className="gc-rp"><div className="gc-rp-a">{(m._reply as any).perfiles ? `${(m._reply as any).perfiles.nombre} ${(m._reply as any).perfiles.apellido}` : "Mensaje"}</div><div className="gc-rp-t">{m._reply.texto ?? "🎙 Audio"}</div></div>}
                        {m.mir_id && !elim && <div style={{fontSize:9,color:"#cc0000",fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.1em",marginBottom:4}}>◈ MIR · {m.mir_tipo?.toUpperCase()}</div>}

                        {elim ? <div className="gc-del">Mensaje eliminado</div>
                          : editandoId===m.id ? (
                            <div>
                              <textarea ref={editRef} className="gc-edit-i" value={editText} onChange={e=>setEditText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();editar(m.id);}if(e.key==="Escape")setEditandoId(null);}} rows={2} autoFocus/>
                              <div style={{display:"flex",gap:6,marginTop:5,justifyContent:"flex-end"}}>
                                <button onClick={()=>setEditandoId(null)} style={{fontSize:10,background:"none",border:"1px solid rgba(255,255,255,0.15)",borderRadius:3,color:"rgba(255,255,255,0.4)",padding:"3px 8px",cursor:"pointer",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>Cancelar</button>
                                <button onClick={()=>editar(m.id)} style={{fontSize:10,background:"#cc0000",border:"none",borderRadius:3,color:"#fff",padding:"3px 8px",cursor:"pointer",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>Guardar</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.texto && <div className="gc-txt">{renderTxt(m.texto)}</div>}
                              {adjs.map((a,i) => {
                                if (a.tipo==="audio") return <div key={i} className="gc-a-audio"><span style={{fontSize:18}}>🎙</span><audio src={a.url} controls style={{flex:1,height:32,minWidth:0}}/></div>;
                                if (a.tipo==="imagen") return <img key={i} src={a.url} alt={a.nombre} style={{maxWidth:"100%",maxHeight:200,borderRadius:8,display:"block",cursor:"pointer",marginTop:4}} onClick={e=>{e.stopPropagation();window.open(a.url,"_blank");}}/>;
                                if (a.tipo==="video") return <video key={i} src={a.url} controls style={{maxWidth:"100%",maxHeight:200,borderRadius:8,marginTop:4,display:"block"}}/>;
                                return <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="gc-a-doc" onClick={e=>e.stopPropagation()}><span style={{fontSize:16}}>📎</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nombre}</div>{a.tamano&&<div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{fmtTam(a.tamano)}</div>}</div></a>;
                              })}
                              {pvData && pvData !== "loading" && pvData !== "error" && (pvData.title || pvData.image) && (
                                <a href={pUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{display:"flex",gap:10,marginTop:6,borderRadius:6,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(0,0,0,0.35)",textDecoration:"none",minHeight:60}}>
                                  {pvData.image && <div style={{width:60,minWidth:60,background:"#000"}}><img src={pvData.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/></div>}
                                  <div style={{flex:1,padding:"6px 8px 6px 0",minWidth:0}}>{pvData.siteName&&<div style={{fontSize:9,color:"#60a5fa",fontFamily:"Montserrat,sans-serif",fontWeight:700,marginBottom:2}}>{pvData.siteName}</div>}{pvData.title&&<div style={{fontSize:11,color:"#fff",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pvData.title}</div>}</div>
                                </a>
                              )}
                            </>
                          )
                        }
                        {!elim && <div className="gc-meta">{m.editado&&<span className="gc-edit-badge">editado</span>}<span className="gc-hora">{fmtHora(m.created_at)}</span></div>}
                      </div>

                      {Object.keys(reacs).length > 0 && !elim && (
                        <div className="gc-reacs" style={{justifyContent:mio?"flex-end":"flex-start"}}>
                          {Object.entries(reacs).map(([e,us]) => <button key={e} className={`gc-reac${(us as string[]).includes(userId??"")?" mia":""}`} onClick={ev=>{ev.stopPropagation();reaccionar(m.id,e);}}>{e} <span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{(us as string[]).length}</span></button>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {filtrados.length===0 && <div style={{textAlign:"center",padding:40,color:"rgba(255,255,255,0.18)",fontSize:12,fontFamily:"Inter,sans-serif"}}>{busqueda?`Sin resultados para "${busqueda}"`:"Sin mensajes aún. ¡Sé el primero en escribir!"}</div>}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div className="gc-ia">
          {replyMsg && <div className="gc-rb"><span style={{fontSize:12,color:"rgba(200,0,0,0.6)",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>↩</span><span className="gc-rb-t">{fullName(replyMsg.perfiles)}: {replyMsg.texto??"🎙 Audio"}</span><button style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:16,padding:0}} onClick={()=>setReplyMsg(null)}>×</button></div>}
          {adjuntos.length>0 && <div className="gc-thumbs">{adjuntos.map((a,i)=><div key={i} className="gc-thumb">{a.tipo==="imagen"?<img src={a.url} alt={a.nombre}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{a.tipo==="video"?"🎬":"📎"}</div>}<button className="gc-thumb-x" onClick={()=>setAdjuntos(prev=>prev.filter((_,j)=>j!==i))}>×</button></div>)}</div>}
          {grabando && (
            <div style={{display:"flex",flexDirection:"column",gap:10,padding:"12px 14px",background:"rgba(200,0,0,0.08)",border:"1px solid rgba(200,0,0,0.25)",borderRadius:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div className="gc-adot"/>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>Grabando... {fmtSeg(audioSeg)}</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={detenerGrab} style={{flex:1,padding:"12px",background:"#cc0000",border:"none",borderRadius:8,color:"#fff",fontFamily:"Montserrat,sans-serif",fontSize:13,fontWeight:800,cursor:"pointer"}}>⏹ Detener y revisar</button>
                <button onClick={cancelarAudio} style={{padding:"12px 16px",background:"transparent",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"rgba(255,255,255,0.5)",fontFamily:"Montserrat,sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕</button>
              </div>
            </div>
          )}
          {audioUrl && !grabando && (
            <div style={{display:"flex",flexDirection:"column",gap:10,padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>🎙</span>
                <audio src={audioUrl} controls style={{flex:1,height:36,minWidth:0}}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={enviarAudio} disabled={subiendoAudio} style={{flex:1,padding:"12px",background:"#cc0000",border:"none",borderRadius:8,color:"#fff",fontFamily:"Montserrat,sans-serif",fontSize:13,fontWeight:800,cursor:"pointer"}}>{subiendoAudio?"Enviando...":"➤ Enviar audio"}</button>
                <button onClick={cancelarAudio} style={{padding:"12px 16px",background:"transparent",border:"1px solid rgba(200,0,0,0.2)",borderRadius:8,color:"rgba(200,0,0,0.6)",fontSize:16,cursor:"pointer"}}>✕</button>
              </div>
            </div>
          )}
          {grupo?.va_al_mir && !grabando && !audioUrl && <div style={{fontSize:10,color:"rgba(255,255,255,0.18)",fontFamily:"Inter,sans-serif"}}>Los mensajes de ofrecidos y búsquedas se cargan al MIR automáticamente</div>}
          {inputPreview && !grabando && !audioUrl && <div style={{position:"relative"}}><a href={inputPreview.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",gap:10,borderRadius:6,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(0,0,0,0.35)",textDecoration:"none",minHeight:60}}>{inputPreview.data.image&&<div style={{width:60,minWidth:60,background:"#000"}}><img src={inputPreview.data.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}<div style={{flex:1,padding:"8px 10px 8px 0",minWidth:0}}>{inputPreview.data.title&&<div style={{fontSize:12,color:"#fff",fontWeight:600}}>{inputPreview.data.title}</div>}</div></a><button onClick={e=>{e.stopPropagation();setInputPreview(null);}} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:18,height:18,color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>}
          {!grabando && !audioUrl && (
            <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
              <input ref={fileImgRef} type="file" accept="image/*,video/*" multiple style={{display:"none"}} onChange={e=>manejarArchivos(e.target.files)}/>
              <button className="gc-adb" onClick={()=>fileImgRef.current?.click()} disabled={subiendoAdj} title="Fotos y videos">📷</button>
              <input ref={fileDocRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx,.zip" multiple style={{display:"none"}} onChange={e=>manejarArchivos(e.target.files)}/>
              <button className="gc-adb" onClick={()=>fileDocRef.current?.click()} disabled={subiendoAdj} title="Documentos">📎</button>
              <button className="gc-adb" onClick={iniciarGrab} title="Grabar audio" style={{color:"rgba(200,0,0,0.7)"}}>🎙</button>
              <textarea ref={inputRef} className="gc-ta" placeholder="Escribí un mensaje..." value={input} rows={1}
                onChange={e=>{
                  setInput(e.target.value);
                  const t=e.target;t.style.height="auto";t.style.height=Math.min(t.scrollHeight,120)+"px";
                  const u=e.target.value.match(/https?:\/\/[^\s]+/)?.[0];
                  if(u){if(previewTimer.current)clearTimeout(previewTimer.current);previewTimer.current=setTimeout(async()=>{try{const r=await fetch(`/api/link-preview?url=${encodeURIComponent(u)}`);const d=await r.json();if(d.title||d.image)setInputPreview({url:u,data:d});}catch{}},600);}else setInputPreview(null);
                }}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviar();}}}
                disabled={enviando}
              />
              <button className="gc-send" onClick={enviar} disabled={enviando||subiendoAdj||(!input.trim()&&adjuntos.length===0)}>
                {enviando?"...":"➤"}
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center" }}>
          {toast}
        </div>
      )}

      {/* Modal permisos micrófono */}
      {modalMic && (
        <div onClick={() => setModalMic(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 10000, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom,0)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1a1a", borderRadius: "16px 16px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 480, border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: "#fff" }}>🎙 Habilitar micrófono</div>
              <button onClick={() => setModalMic(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 12, lineHeight: 1.6 }}>
              Chrome bloqueó el micrófono para este sitio. Seguí estos pasos exactos:
            </p>

            {/* Paso único claro */}
            <div style={{ background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 10, padding: "14px", marginBottom: 10 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 800, color: "#cc0000", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Desde Chrome Android</div>
              {[
                { n:1, t:"Tocá los 3 puntitos ⋮ arriba a la derecha" },
                { n:2, t:"Configuración → Configuración del sitio → Micrófono" },
                { n:3, t:"Mirá si foroinmobiliario.com.ar aparece en la lista de Bloqueados — si está ahí, tocalo y cambialo a Permitir" },
                { n:4, t:"Si no aparece en bloqueados, tocá el toggle superior para que quede en Permitir (azul), luego entrá al sitio y en el popup de permiso elegí Permitir" },
                { n:5, t:'Volvé a la app y tocá "Recargar página" abajo' },
              ].map(({ n, t }) => (
                <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#cc0000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: "#fff", flexShrink: 0 }}>{n}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, paddingTop: 2 }}>{t}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 18, lineHeight: 1.5 }}>
              📱 <b>Nota:</b> que Android permita el mic para Chrome no alcanza — Chrome también necesita permiso por sitio. Son dos permisos separados.
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
