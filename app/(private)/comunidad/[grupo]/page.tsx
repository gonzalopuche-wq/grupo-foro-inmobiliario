"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

interface Adjunto {
  url: string;
  nombre: string;
  tipo: "imagen" | "video" | "documento";
  tamano?: number;
}

interface Mensaje {
  id: string;
  texto: string;
  tipo: string;
  mir_id?: string;
  mir_tipo?: string;
  created_at: string;
  user_id: string;
  reply_id?: string | null;
  editado?: boolean;
  eliminado?: boolean;
  reacciones?: Record<string, string[]>;
  adjuntos?: Adjunto[];
  perfiles: { nombre: string; apellido: string; matricula: string };
  reply?: Mensaje | null;
}

interface Grupo {
  id: string;
  nombre: string;
  icono: string;
  va_al_mir: boolean;
  solo_matriculado: boolean;
}

export default function GrupoChatPage() {
  const router = useRouter();
  const params = useParams();
  const grupoId = params.grupo as string;

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [userId, setUserId] = useState("");
  const [perfil, setPerfil] = useState<any>(null);
  const [parserInfo, setParserInfo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);
  const [replyMsg, setReplyMsg] = useState<Mensaje | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [linkPreviews, setLinkPreviews] = useState<Record<string, any>>({});
  const [inputPreview, setInputPreview] = useState<{ url: string; data: any } | null>(null);
  const [adjuntosPendientes, setAdjuntosPendientes] = useState<Adjunto[]>([]);
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false);
  const inputPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputDocRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
      const { data: perfilData } = await supabase.from("perfiles").select("nombre, apellido, matricula, tipo").eq("id", session.user.id).single();
      setPerfil(perfilData);
      const { data: grupoData } = await supabase.from("grupos_chat").select("*").eq("id", grupoId).single();
      if (!grupoData) { router.push("/comunidad"); return; }
      if (grupoData.solo_matriculado && perfilData?.tipo === "colaborador") { router.push("/comunidad"); return; }
      setGrupo(grupoData);
      await cargarMensajes();
      setLoading(false);
    };
    init();
  }, [grupoId]);

  useEffect(() => {
    if (!grupoId) return;
    const channel = supabase.channel(`chat_${grupoId}_${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_chat", filter: `grupo_id=eq.${grupoId}` },
        async (payload) => {
          const { data } = await supabase.from("mensajes_chat").select("*, perfiles(nombre,apellido,matricula)").eq("id", payload.new.id).single();
          if (!data) return;
          let reply = null;
          if ((data as any).reply_id) {
            const { data: r } = await supabase.from("mensajes_chat").select("id,texto,user_id,perfiles(nombre,apellido)").eq("id", (data as any).reply_id).single();
            reply = r ?? null;
          }
          setMensajes(prev => { if (prev.some(m => m.id === (data as any).id)) return prev; return [...prev, { ...data, reply } as any]; });
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mensajes_chat", filter: `grupo_id=eq.${grupoId}` },
        async (payload) => {
          const { data } = await supabase.from("mensajes_chat").select("*, perfiles(nombre,apellido,matricula)").eq("id", payload.new.id).single();
          if (data) setMensajes(prev => prev.map(m => m.id === (data as any).id ? { ...data, reply: m.reply } as any : m));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [grupoId]);

  useEffect(() => {
    if (!mostrarBusqueda) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, mostrarBusqueda]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuMsgId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const extraerPrimeraUrl = (texto: string): string | null => {
    const m = texto.match(/https?:\/\/[^\s]+/);
    return m ? m[0] : null;
  };

  const cargarMensajes = async () => {
    const { data } = await supabase.from("mensajes_chat")
      .select("*, perfiles(nombre,apellido,matricula)")
      .eq("grupo_id", grupoId).order("created_at", { ascending: true }).limit(200);
    if (!data) return;
    const replyIds = [...new Set(data.map((m: any) => m.reply_id).filter(Boolean))];
    let repliesMap: Record<string, any> = {};
    if (replyIds.length > 0) {
      const { data: replies } = await supabase.from("mensajes_chat").select("id, texto, user_id, perfiles(nombre,apellido)").in("id", replyIds);
      (replies ?? []).forEach((r: any) => { repliesMap[r.id] = r; });
    }
    const msgsConReply = data.map((m: any) => ({ ...m, reply: m.reply_id ? repliesMap[m.reply_id] ?? null : null }));
    setMensajes(msgsConReply as any);
    const previews: Record<string, any> = {};
    await Promise.all(msgsConReply.map(async (m: any) => {
      if (!m.texto || m.eliminado) return;
      const urlMatch = m.texto.match(/https?:\/\/[^\s]+/);
      if (!urlMatch) return;
      const url = urlMatch[0];
      if (previews[url] !== undefined) return;
      previews[url] = "loading";
      try { const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`); previews[url] = await res.json(); } catch { previews[url] = "error"; }
    }));
    setLinkPreviews(previews);
  };

  // ── SUBIR ADJUNTO A SUPABASE STORAGE ──
  const subirArchivo = async (file: File): Promise<Adjunto | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const esImagen = ["jpg","jpeg","png","gif","webp","heic"].includes(ext);
    const esVideo = ["mp4","mov","avi","webm","mkv"].includes(ext);
    const esDoc = !esImagen && !esVideo;
    const tipo: Adjunto["tipo"] = esImagen ? "imagen" : esVideo ? "video" : "documento";
    const path = `chat/${grupoId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("adjuntos_chat").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) { console.error("Upload error:", error); return null; }
    const { data: urlData } = supabase.storage.from("adjuntos_chat").getPublicUrl(path);
    return { url: urlData.publicUrl, nombre: file.name, tipo, tamano: file.size };
  };

  const manejarArchivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubiendoAdjunto(true);
    const nuevos: Adjunto[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { alert(`${file.name} supera el límite de 20MB`); continue; }
      const adj = await subirArchivo(file);
      if (adj) nuevos.push(adj);
    }
    setAdjuntosPendientes(prev => [...prev, ...nuevos]);
    setSubiendoAdjunto(false);
  };

  const quitarAdjunto = (idx: number) => setAdjuntosPendientes(prev => prev.filter((_, i) => i !== idx));

  const enviar = async () => {
    if ((!texto.trim() && adjuntosPendientes.length === 0) || enviando || !userId || !grupo) return;
    setEnviando(true);
    const textoEnviar = texto.trim();
    const adjuntosEnviar = [...adjuntosPendientes];
    setTexto(""); setInputPreview(null); setAdjuntosPendientes([]);
    const replyId = replyMsg?.id ?? null;
    setReplyMsg(null);

    const temp: Mensaje = {
      id: `temp-${Date.now()}`, texto: textoEnviar, tipo: "mensaje",
      created_at: new Date().toISOString(), user_id: userId,
      reply_id: replyId, editado: false, eliminado: false, reacciones: {},
      adjuntos: adjuntosEnviar,
      perfiles: { nombre: perfil?.nombre ?? "", apellido: perfil?.apellido ?? "", matricula: perfil?.matricula ?? "" },
      reply: replyMsg ?? null,
    };
    setMensajes(prev => [...prev, temp]);

    const insertData: any = { grupo_id: grupoId, user_id: userId, texto: textoEnviar, tipo: "mensaje" };
    if (replyId) insertData.reply_id = replyId;
    if (adjuntosEnviar.length > 0) insertData.adjuntos = adjuntosEnviar;

    const { data: msg, error: insertError } = await supabase.from("mensajes_chat").insert(insertData).select("*, perfiles(nombre,apellido,matricula)").single();
    if (insertError) console.error("INSERT ERROR:", insertError);
    if (msg) setMensajes(prev => prev.map(m => m.id === temp.id ? msg as any : m));

    if (grupo.va_al_mir && msg && textoEnviar) {
      try {
        const res = await fetch("/api/comunidad/parser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: textoEnviar, grupo_id: grupoId, user_id: userId, mensaje_id: (msg as any).id }) });
        const result = await res.json();
        if (result.cargado) { setParserInfo(`Cargado al MIR como ${result.tipo}`); setTimeout(() => setParserInfo(null), 4000); }
      } catch {}
    }
    setEnviando(false);
    inputRef.current?.focus();
  };

  const editarMensaje = async (id: string) => {
    if (!textoEdit.trim()) return;
    await supabase.from("mensajes_chat").update({ texto: textoEdit.trim(), editado: true }).eq("id", id);
    setEditandoId(null); setTextoEdit("");
  };

  const eliminarMensaje = async (id: string) => {
    await supabase.from("mensajes_chat").update({ eliminado: true, texto: "" }).eq("id", id);
    setMenuMsgId(null);
  };

  const reaccionar = async (msgId: string, emoji: string) => {
    const msg = mensajes.find(m => m.id === msgId);
    if (!msg) return;
    const reacs = { ...(msg.reacciones ?? {}) };
    const usuarios = reacs[emoji] ?? [];
    if (usuarios.includes(userId)) { reacs[emoji] = usuarios.filter(u => u !== userId); if (reacs[emoji].length === 0) delete reacs[emoji]; }
    else reacs[emoji] = [...usuarios, userId];
    setMensajes(prev => prev.map(m => m.id === msgId ? { ...m, reacciones: reacs } : m));
    setMenuMsgId(null);
    supabase.from("mensajes_chat").update({ reacciones: reacs }).eq("id", msgId);
  };

  const formatHora = (f: string) => new Date(f).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const formatFecha = (f: string) => {
    const d = new Date(f), hoy = new Date(), ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return "Hoy";
    if (d.toDateString() === ayer.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  };
  const formatTamano = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const renderTexto = (texto: string) => {
    const urlRegex = /(https?:\/\/\S+)/g;
    return texto.split(urlRegex).map((p, i) =>
      p.match(/^https?:\/\//) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline", wordBreak: "break-all" }} onClick={e => e.stopPropagation()}>{p}</a> : <span key={i}>{p}</span>
    );
  };

  const LinkPreview = ({ url }: { url: string }) => {
    const data = linkPreviews[url];
    if (!data || data === "loading" || data === "error" || (!data.title && !data.image)) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
        style={{ display: "flex", gap: 10, marginTop: 6, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)", textDecoration: "none", minHeight: 72 }}>
        {data.image && <div style={{ width: 72, minWidth: 72, background: "#000", flexShrink: 0 }}><img src={data.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} /></div>}
        <div style={{ flex: 1, padding: "8px 10px 8px 0", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
          {data.siteName && <div style={{ fontSize: 9, color: "#60a5fa", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{data.siteName}</div>}
          {data.title && <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.title}</div>}
          {data.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{data.description}</div>}
        </div>
      </a>
    );
  };

  // Renderizar adjuntos en mensaje
  const RenderAdjuntos = ({ adjuntos }: { adjuntos: Adjunto[] }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: adjuntos.length > 0 ? 6 : 0 }}>
      {adjuntos.map((adj, i) => {
        if (adj.tipo === "imagen") return (
          <a key={i} href={adj.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <img src={adj.url} alt={adj.nombre} style={{ maxWidth: 240, maxHeight: 200, borderRadius: 6, display: "block", objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }} />
          </a>
        );
        if (adj.tipo === "video") return (
          <video key={i} src={adj.url} controls style={{ maxWidth: 280, borderRadius: 6, display: "block", border: "1px solid rgba(255,255,255,0.1)" }} onClick={e => e.stopPropagation()} />
        );
        return (
          <a key={i} href={adj.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, textDecoration: "none", transition: "background 0.15s" }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>
              {adj.nombre.match(/\.(pdf)$/i) ? "📄" : adj.nombre.match(/\.(xls|xlsx)$/i) ? "📊" : adj.nombre.match(/\.(doc|docx)$/i) ? "📝" : "📎"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#fff", fontFamily: "Inter,sans-serif", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adj.nombre}</div>
              {adj.tamano && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{formatTamano(adj.tamano)}</div>}
            </div>
            <span style={{ fontSize: 12, color: "#cc0000", flexShrink: 0 }}>↓</span>
          </a>
        );
      })}
    </div>
  );

  const mensajesFiltrados = busqueda.trim() ? mensajes.filter(m => m.texto?.toLowerCase().includes(busqueda.toLowerCase())) : mensajes;
  const mensajesPorFecha: { fecha: string; msgs: Mensaje[] }[] = [];
  mensajesFiltrados.forEach(m => {
    const fecha = formatFecha(m.created_at);
    const ultimo = mensajesPorFecha[mensajesPorFecha.length - 1];
    if (ultimo && ultimo.fecha === fecha) ultimo.msgs.push(m);
    else mensajesPorFecha.push({ fecha, msgs: [m] });
  });

  if (loading || !grupo) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <button onClick={() => router.push("/comunidad")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18, padding: "4px 8px 4px 0" }}>←</button>
        <div style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, background: grupo.va_al_mir ? "rgba(200,0,0,0.12)" : "rgba(255,255,255,0.06)", border: grupo.va_al_mir ? "1px solid rgba(200,0,0,0.25)" : "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>{grupo.icono}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>{grupo.nombre}</span>
            {grupo.va_al_mir && <span style={{ fontSize: 8, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#cc0000", background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.2)", padding: "2px 5px", borderRadius: 3 }}>MIR</span>}
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", marginTop: 1 }}>{mensajes.length} mensajes</p>
        </div>
        <button onClick={() => { setMostrarBusqueda(v => !v); setBusqueda(""); }}
          style={{ background: mostrarBusqueda ? "rgba(200,0,0,0.1)" : "none", border: mostrarBusqueda ? "1px solid rgba(200,0,0,0.3)" : "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: mostrarBusqueda ? "#cc0000" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14, padding: "6px 10px" }}>🔍</button>
      </div>

      {mostrarBusqueda && (
        <div style={{ padding: "10px 0 6px", flexShrink: 0 }}>
          <input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar en el chat..."
            style={{ width: "100%", padding: "9px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#fff", fontSize: 13, outline: "none", fontFamily: "Inter,sans-serif" }} />
          {busqueda && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 5 }}>{mensajesFiltrados.length} resultado{mensajesFiltrados.length !== 1 ? "s" : ""}</div>}
        </div>
      )}

      {parserInfo && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "7px 14px", margin: "6px 0", fontSize: 11, color: "#4ade80", flexShrink: 0 }}>{parserInfo}</div>
      )}

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {mensajesPorFecha.map(({ fecha, msgs }) => (
          <div key={fecha}>
            <div style={{ textAlign: "center", margin: "10px 0" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat,sans-serif", background: "rgba(255,255,255,0.04)", padding: "3px 10px", borderRadius: 10 }}>{fecha}</span>
            </div>
            {msgs.map(m => {
              const esMio = m.user_id === userId;
              const eliminado = m.eliminado;
              const adjuntos: Adjunto[] = (m as any).adjuntos ?? [];
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: esMio ? "flex-end" : "flex-start", marginBottom: 4, padding: "0 4px", position: "relative" }}
                  onClick={() => !eliminado && setMenuMsgId(prev => prev === m.id ? null : m.id)}>
                  <div style={{ maxWidth: "78%", position: "relative" }}>
                    {!eliminado && (
                      <div style={{ position: "absolute", right: 4, top: -10, background: "rgba(40,40,40,0.9)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 6.5L5 3.5L8 6.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                    {!esMio && !eliminado && (
                      <div style={{ fontSize: 10, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, marginBottom: 3, paddingLeft: 4 }}>
                        {m.perfiles?.nombre} {m.perfiles?.apellido}
                        {m.perfiles?.matricula && <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}> · {m.perfiles.matricula}</span>}
                      </div>
                    )}
                    <div style={{ background: eliminado ? "transparent" : esMio ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.06)", border: eliminado ? "1px solid rgba(255,255,255,0.06)" : esMio ? `1px solid ${menuMsgId === m.id ? "rgba(200,0,0,0.5)" : "rgba(200,0,0,0.25)"}` : `1px solid ${menuMsgId === m.id ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: esMio ? "12px 12px 3px 12px" : "12px 12px 12px 3px", padding: "8px 12px", transition: "border-color 0.15s" }}>
                      {m.reply && !eliminado && (
                        <div style={{ background: "rgba(255,255,255,0.04)", borderLeft: "2px solid #cc0000", borderRadius: "0 4px 4px 0", padding: "4px 8px", marginBottom: 6, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                          <div style={{ fontSize: 9, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, marginBottom: 2 }}>{(m.reply as any).perfiles?.nombre ?? ""}</div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{(m.reply as any).texto}</div>
                        </div>
                      )}
                      {m.mir_id && !eliminado && <div style={{ fontSize: 9, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>◈ MIR · {m.mir_tipo?.toUpperCase()}</div>}
                      {eliminado ? (
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Mensaje eliminado</p>
                      ) : editandoId === m.id ? (
                        <div>
                          <textarea ref={editRef} value={textoEdit} onChange={e => setTextoEdit(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); editarMensaje(m.id); } if (e.key === "Escape") { setEditandoId(null); setTextoEdit(""); } }}
                            style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(200,0,0,0.4)", borderRadius: 4, color: "#fff", fontSize: 12, fontFamily: "Inter,sans-serif", padding: "6px 8px", outline: "none", resize: "none", minHeight: 60 }} autoFocus />
                          <div style={{ display: "flex", gap: 6, marginTop: 5, justifyContent: "flex-end" }}>
                            <button onClick={() => { setEditandoId(null); setTextoEdit(""); }} style={{ fontSize: 10, background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, color: "rgba(255,255,255,0.4)", padding: "3px 8px", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Cancelar</button>
                            <button onClick={() => editarMensaje(m.id)} style={{ fontSize: 10, background: "#cc0000", border: "none", borderRadius: 3, color: "#fff", padding: "3px 8px", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Guardar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {m.texto && <p style={{ fontSize: 12, color: "#fff", fontFamily: "Inter,sans-serif", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{renderTexto(m.texto)}</p>}
                          {adjuntos.length > 0 && <RenderAdjuntos adjuntos={adjuntos} />}
                          {m.texto && extraerPrimeraUrl(m.texto) && <LinkPreview url={extraerPrimeraUrl(m.texto)!} />}
                        </>
                      )}
                      {!eliminado && (
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "right", marginTop: 4, display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                          {m.editado && <span style={{ fontStyle: "italic" }}>editado</span>}
                          {adjuntos.length > 0 && <span>📎 {adjuntos.length}</span>}
                          {formatHora(m.created_at)}
                        </div>
                      )}
                    </div>
                    {!eliminado && m.reacciones && Object.keys(m.reacciones).length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, justifyContent: esMio ? "flex-end" : "flex-start" }}>
                        {Object.entries(m.reacciones).map(([emoji, users]) => (
                          <button key={emoji} onClick={() => reaccionar(m.id, emoji)}
                            style={{ background: (users as string[]).includes(userId) ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.06)", border: (users as string[]).includes(userId) ? "1px solid rgba(200,0,0,0.3)" : "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "2px 7px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            {emoji} <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{(users as string[]).length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Menú popup */}
                  {menuMsgId === m.id && !eliminado && editandoId !== m.id && (
                    <div onClick={e => e.stopPropagation()}
                      style={{ position: "absolute", [esMio ? "right" : "left"]: 0, bottom: "100%", marginBottom: 6, background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 6px", zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 2, minWidth: 160 }}>
                      <div style={{ display: "flex", gap: 2, padding: "2px 4px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 2, flexWrap: "wrap", maxWidth: 220 }}>
                        {["👍","❤️","😂","😮","😢","🙏","🔥","✅","👀","😡","💯","🎉"].map(emoji => (
                          <button key={emoji} onClick={() => { reaccionar(m.id, emoji); setMenuMsgId(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: "2px 4px", borderRadius: 6 }}>{emoji}</button>
                        ))}
                      </div>
                      {([
                        { icon: "↩", label: "Responder", action: () => { setReplyMsg(m); setMenuMsgId(null); inputRef.current?.focus(); } },
                        { icon: "📋", label: "Copiar", action: () => { navigator.clipboard.writeText(m.texto); setMenuMsgId(null); } },
                        ...(esMio ? [
                          { icon: "✏", label: "Editar", action: () => { setEditandoId(m.id); setTextoEdit(m.texto); setMenuMsgId(null); setTimeout(() => editRef.current?.focus(), 50); } },
                          { icon: "🗑", label: "Eliminar", action: () => eliminarMensaje(m.id), danger: true },
                        ] : [
                          { icon: "🚩", label: "Reportar", action: () => { alert("Mensaje reportado al admin."); setMenuMsgId(null); } },
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
                </div>
              );
            })}
          </div>
        ))}
        {mensajesFiltrados.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.2)", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
            {busqueda ? `Sin resultados para "${busqueda}"` : "Sin mensajes aún. ¡Sé el primero en escribir!"}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyMsg && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(200,0,0,0.06)", border: "1px solid rgba(200,0,0,0.15)", borderRadius: "6px 6px 0 0", borderBottom: "none" }}>
          <div style={{ borderLeft: "2px solid #cc0000", paddingLeft: 8, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, marginBottom: 2 }}>Respondiendo a {replyMsg.perfiles?.nombre}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyMsg.texto}</div>
          </div>
          <button onClick={() => setReplyMsg(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16, padding: 4, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Preview adjuntos pendientes */}
      {adjuntosPendientes.length > 0 && (
        <div style={{ flexShrink: 0, padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "none", borderRadius: replyMsg ? "0" : "6px 6px 0 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Adjuntos:</span>
          {adjuntosPendientes.map((adj, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "4px 8px 4px 6px" }}>
              {adj.tipo === "imagen" && <img src={adj.url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover" }} />}
              {adj.tipo === "video" && <span style={{ fontSize: 18 }}>🎬</span>}
              {adj.tipo === "documento" && <span style={{ fontSize: 18 }}>{adj.nombre.match(/\.pdf$/i) ? "📄" : adj.nombre.match(/\.(xls|xlsx)$/i) ? "📊" : "📝"}</span>}
              <div style={{ maxWidth: 100 }}>
                <div style={{ fontSize: 10, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adj.nombre}</div>
                {adj.tamano && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{formatTamano(adj.tamano)}</div>}
              </div>
              <button onClick={() => quitarAdjunto(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          ))}
          {subiendoAdjunto && <div style={{ width: 16, height: 16, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
        </div>
      )}

      {/* Input */}
      <div style={{ flexShrink: 0, paddingTop: (replyMsg || adjuntosPendientes.length > 0) ? 0 : 10, borderTop: (replyMsg || adjuntosPendientes.length > 0) ? "none" : "1px solid rgba(255,255,255,0.07)" }}>
        {!(replyMsg || adjuntosPendientes.length > 0) && <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginBottom: 10 }} />}
        {grupo.va_al_mir && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", marginBottom: 7 }}>Los mensajes de ofrecidos y búsquedas se cargan al MIR automáticamente</div>}
        {inputPreview && (
          <div style={{ marginBottom: 8 }}>
            <a href={inputPreview.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", gap: 10, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)", textDecoration: "none", minHeight: 72, position: "relative" }}>
              {inputPreview.data.image && <div style={{ width: 72, minWidth: 72, background: "#000" }}><img src={inputPreview.data.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
              <div style={{ flex: 1, padding: "8px 10px 8px 0", minWidth: 0 }}>
                {inputPreview.data.title && <div style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{inputPreview.data.title}</div>}
              </div>
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); setInputPreview(null); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </a>
          </div>
        )}

        {/* Inputs row */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: adjuntosPendientes.length > 0 || replyMsg ? "8px 12px" : "0", background: adjuntosPendientes.length > 0 || replyMsg ? "rgba(255,255,255,0.02)" : "transparent", borderRadius: adjuntosPendientes.length > 0 || replyMsg ? "0 0 6px 6px" : 0, border: adjuntosPendientes.length > 0 || replyMsg ? "1px solid rgba(255,255,255,0.07)" : "none", borderTop: "none" }}>

          {/* Botón adjuntar fotos/videos */}
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={e => manejarArchivos(e.target.files)} />
          <button onClick={() => fileInputRef.current?.click()} disabled={subiendoAdjunto}
            title="Fotos y videos"
            style={{ width: 38, height: 38, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: subiendoAdjunto ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", cursor: subiendoAdjunto ? "default" : "pointer", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
            onMouseEnter={e => { if (!subiendoAdjunto) (e.currentTarget.style.borderColor = "rgba(200,0,0,0.4)"); (e.currentTarget.style.color = "#cc0000"); }}
            onMouseLeave={e => { (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"); (e.currentTarget.style.color = subiendoAdjunto ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)"); }}>
            📷
          </button>

          {/* Botón adjuntar documentos */}
          <input ref={fileInputDocRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx,.zip,.rar" multiple style={{ display: "none" }} onChange={e => manejarArchivos(e.target.files)} />
          <button onClick={() => fileInputDocRef.current?.click()} disabled={subiendoAdjunto}
            title="Documentos"
            style={{ width: 38, height: 38, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: subiendoAdjunto ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", cursor: subiendoAdjunto ? "default" : "pointer", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
            onMouseEnter={e => { if (!subiendoAdjunto) (e.currentTarget.style.borderColor = "rgba(200,0,0,0.4)"); (e.currentTarget.style.color = "#cc0000"); }}
            onMouseLeave={e => { (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"); (e.currentTarget.style.color = subiendoAdjunto ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)"); }}>
            📎
          </button>

          <textarea ref={inputRef} value={texto}
            onChange={e => {
              const val = e.target.value; setTexto(val);
              const urlMatch = val.match(/https?:\/\/[^\s]+/);
              if (urlMatch) {
                const url = urlMatch[0];
                if (inputPreviewTimer.current) clearTimeout(inputPreviewTimer.current);
                inputPreviewTimer.current = setTimeout(async () => {
                  try { const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`); const data = await res.json(); if (data.title || data.image) setInputPreview({ url, data }); } catch {}
                }, 600);
              } else setInputPreview(null);
            }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Escribí un mensaje..."
            rows={1}
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 13, fontFamily: "Inter,sans-serif", resize: "none", outline: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
            onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }}
          />
          <button onClick={enviar} disabled={(!texto.trim() && adjuntosPendientes.length === 0) || enviando}
            style={{ background: (texto.trim() || adjuntosPendientes.length > 0) ? "#cc0000" : "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, width: 40, height: 40, cursor: (texto.trim() || adjuntosPendientes.length > 0) ? "pointer" : "default", color: (texto.trim() || adjuntosPendientes.length > 0) ? "#fff" : "rgba(255,255,255,0.2)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}>
            {enviando ? "..." : "➤"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
