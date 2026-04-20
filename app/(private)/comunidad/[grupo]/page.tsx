"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

interface Mensaje {
  id: string;
  texto: string;
  tipo: string;
  mir_id?: string;
  mir_tipo?: string;
  created_at: string;
  user_id: string;
  perfiles: { nombre: string; apellido: string; matricula: string };
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);

      const { data: perfilData } = await supabase
        .from("perfiles")
        .select("nombre, apellido, matricula, tipo")
        .eq("id", session.user.id)
        .single();
      setPerfil(perfilData);

      const { data: grupoData } = await supabase
        .from("grupos_chat")
        .select("*")
        .eq("id", grupoId)
        .single();

      if (!grupoData) { router.push("/comunidad"); return; }

      // Verificar acceso
      if (grupoData.solo_matriculado && perfilData?.tipo === "colaborador") {
        router.push("/comunidad");
        return;
      }
      setGrupo(grupoData);

      const { data: msgsData } = await supabase
        .from("mensajes_chat")
        .select("*, perfiles(nombre, apellido, matricula)")
        .eq("grupo_id", grupoId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (msgsData) setMensajes(msgsData as any);
      setLoading(false);
    };
    init();
  }, [grupoId]);

  // Tiempo real
  useEffect(() => {
    if (!grupoId) return;
    const channel = supabase
      .channel(`chat_${grupoId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "mensajes_chat",
        filter: `grupo_id=eq.${grupoId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from("mensajes_chat")
          .select("*, perfiles(nombre, apellido, matricula)")
          .eq("id", payload.new.id)
          .single();
        if (data) setMensajes(prev => [...prev, data as any]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [grupoId]);

  // Scroll al fondo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const enviar = async () => {
    if (!texto.trim() || enviando || !userId || !grupo) return;
    setEnviando(true);
    const textoEnviar = texto.trim();
    setTexto("");

    // 1. Guardar mensaje
    const { data: msg } = await supabase
      .from("mensajes_chat")
      .insert({
        grupo_id: grupoId,
        user_id: userId,
        texto: textoEnviar,
        tipo: "mensaje",
      })
      .select("*, perfiles(nombre, apellido, matricula)")
      .single();

    // 2. Si el grupo va al MIR, parsear con IA
    if (grupo.va_al_mir && msg) {
      try {
        const res = await fetch("/api/comunidad/parser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: textoEnviar,
            grupo_id: grupoId,
            user_id: userId,
            mensaje_id: msg.id,
          }),
        });
        const result = await res.json();
        if (result.cargado) {
          setParserInfo(`✓ Cargado al MIR como ${result.tipo}`);
          setTimeout(() => setParserInfo(null), 4000);
        }
      } catch {}
    }

    setEnviando(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  const formatHora = (fecha: string) => {
    return new Date(fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatFecha = (fecha: string) => {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return "Hoy";
    if (d.toDateString() === ayer.toDateString()) return "Ayer";
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  };

  // Agrupar mensajes por fecha
  const mensajesPorFecha: { fecha: string; msgs: Mensaje[] }[] = [];
  mensajes.forEach(m => {
    const fecha = formatFecha(m.created_at);
    const ultimo = mensajesPorFecha[mensajesPorFecha.length - 1];
    if (ultimo && ultimo.fecha === fecha) {
      ultimo.msgs.push(m);
    } else {
      mensajesPorFecha.push({ fecha, msgs: [m] });
    }
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
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "0 0 16px",
        borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 0, flexShrink: 0,
      }}>
        <button onClick={() => router.push("/comunidad")} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.4)",
          cursor: "pointer", fontSize: 18, padding: "4px 8px 4px 0",
        }}>←</button>
        <div style={{
          width: 38, height: 38, borderRadius: 8, fontSize: 18,
          background: grupo.va_al_mir ? "rgba(200,0,0,0.12)" : "rgba(255,255,255,0.06)",
          border: grupo.va_al_mir ? "1px solid rgba(200,0,0,0.25)" : "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {grupo.icono}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>
              {grupo.nombre}
            </span>
            {grupo.va_al_mir && (
              <span style={{
                fontSize: 8, fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "#cc0000", background: "rgba(200,0,0,0.1)",
                border: "1px solid rgba(200,0,0,0.2)", padding: "2px 5px", borderRadius: 3,
              }}>MIR automático</span>
            )}
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif", marginTop: 1 }}>
            {mensajes.length} mensajes
          </p>
        </div>
      </div>

      {/* Parser info */}
      {parserInfo && (
        <div style={{
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 6, padding: "8px 14px", margin: "8px 0",
          fontSize: 11, color: "#4ade80", fontFamily: "Inter, sans-serif", flexShrink: 0,
        }}>
          {parserInfo}
        </div>
      )}

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
        {mensajesPorFecha.map(({ fecha, msgs }) => (
          <div key={fecha}>
            <div style={{ textAlign: "center", margin: "12px 0" }}>
              <span style={{
                fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat, sans-serif",
                background: "rgba(255,255,255,0.04)", padding: "3px 10px", borderRadius: 10,
              }}>
                {fecha}
              </span>
            </div>
            {msgs.map(m => {
              const esMio = m.user_id === userId;
              return (
                <div key={m.id} style={{
                  display: "flex", justifyContent: esMio ? "flex-end" : "flex-start",
                  marginBottom: 6, padding: "0 4px",
                }}>
                  <div style={{ maxWidth: "75%" }}>
                    {!esMio && (
                      <div style={{ fontSize: 10, color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, marginBottom: 3, paddingLeft: 4 }}>
                        {m.perfiles?.nombre} {m.perfiles?.apellido}
                        {m.perfiles?.matricula && <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}> · Mat. {m.perfiles.matricula}</span>}
                      </div>
                    )}
                    <div style={{
                      background: esMio ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.06)",
                      border: esMio ? "1px solid rgba(200,0,0,0.25)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: esMio ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                      padding: "8px 12px",
                    }}>
                      {m.mir_id && (
                        <div style={{
                          fontSize: 9, color: "#cc0000", fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4,
                        }}>
                          ◈ CARGADO AL MIR · {m.mir_tipo?.toUpperCase()}
                        </div>
                      )}
                      <p style={{ fontSize: 12, color: "#fff", fontFamily: "Inter, sans-serif", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {m.texto}
                      </p>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "right", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
                        {formatHora(m.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {mensajes.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.2)", fontSize: 12, fontFamily: "Inter, sans-serif" }}>
            Sin mensajes aún. ¡Sé el primero en escribir!
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0, paddingTop: 12,
        borderTop: "1px solid rgba(255,255,255,0.07)",
      }}>
        {grupo.va_al_mir && (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Inter, sans-serif", marginBottom: 8, paddingLeft: 2 }}>
            💡 Los mensajes de ofrecidos y búsquedas se cargan automáticamente al MIR
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu mensaje... (Enter para enviar)"
            rows={1}
            style={{
              flex: 1, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
              padding: "10px 14px", color: "#fff", fontSize: 13,
              fontFamily: "Inter, sans-serif", resize: "none",
              outline: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
            }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            style={{
              background: texto.trim() ? "#cc0000" : "rgba(255,255,255,0.05)",
              border: "none", borderRadius: 8, width: 40, height: 40,
              cursor: texto.trim() ? "pointer" : "default",
              color: texto.trim() ? "#fff" : "rgba(255,255,255,0.2)",
              fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s", flexShrink: 0,
            }}
          >
            {enviando ? "..." : "➤"}
          </button>
        </div>
      </div>
    </div>
  );
}
