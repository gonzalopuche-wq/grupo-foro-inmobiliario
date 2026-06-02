"use client";

import { useState, useRef, useEffect } from "react";

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

interface ChatPortalProps {
  perfilId: string;
  nombreCorredor: string;
  colorPrimario: string;
}

export default function ChatPortal({
  perfilId,
  nombreCorredor,
  colorPrimario,
}: ChatPortalProps) {
  const primerMensaje: Mensaje = {
    role: "assistant",
    content: `¡Hola! 👋 Soy el asistente de ${nombreCorredor}. Puedo ayudarte a encontrar la propiedad ideal. ¿Qué estás buscando?`,
  };

  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([primerMensaje]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [mensajes, cargando]);

  async function enviar() {
    const pregunta = input.trim();
    if (!pregunta || cargando) return;

    const nuevosMensajes: Mensaje[] = [
      ...mensajes,
      { role: "user", content: pregunta },
    ];
    setMensajes(nuevosMensajes);
    setInput("");
    setCargando(true);

    try {
      // El historial que mandamos excluye el primer mensaje automático (índice 0)
      // y el último mensaje que acabamos de agregar (lo mandamos como "pregunta")
      const historial = nuevosMensajes.slice(1, -1);

      const res = await fetch("/api/chat-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta, perfil_id: perfilId, historial }),
      });

      const data = await res.json();
      setMensajes([
        ...nuevosMensajes,
        {
          role: "assistant",
          content: data.respuesta ?? "Lo siento, no pude procesar tu consulta.",
        },
      ]);
    } catch {
      setMensajes([
        ...nuevosMensajes,
        {
          role: "assistant",
          content: "Lo siento, hubo un error al procesar tu consulta. Intentá de nuevo.",
        },
      ]);
    } finally {
      setCargando(false);
    }
  }

  function manejarTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Abrir chat de consultas"
        style={{
          position: "fixed",
          bottom: abierto ? 464 : 24,
          right: 24,
          zIndex: 1000,
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: colorPrimario,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          transition: "bottom 0.25s ease",
        }}
      >
        {abierto ? "✕" : "💬"}
      </button>

      {/* Panel del chat */}
      {abierto && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 999,
            width: 300,
            height: 420,
            borderRadius: 12,
            background: "#fff",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: colorPrimario,
              color: "#fff",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14 }}>Consultas</span>
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ✕
            </button>
          </div>

          {/* Lista de mensajes */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {mensajes.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "8px 11px",
                    borderRadius:
                      m.role === "user"
                        ? "12px 12px 2px 12px"
                        : "12px 12px 12px 2px",
                    background:
                      m.role === "user" ? colorPrimario : "#f0f0f0",
                    color: m.role === "user" ? "#fff" : "#1a1a1a",
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {cargando && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "8px 11px",
                    borderRadius: "12px 12px 12px 2px",
                    background: "#f0f0f0",
                    color: "#666",
                    fontSize: 13,
                    fontStyle: "italic",
                  }}
                >
                  Escribiendo...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            style={{
              padding: "8px 10px",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={manejarTecla}
              placeholder="Escribí tu consulta..."
              disabled={cargando}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                background: cargando ? "#f9f9f9" : "#fff",
                color: "#1a1a1a",
              }}
            />
            <button
              onClick={enviar}
              disabled={cargando || !input.trim()}
              style={{
                padding: "8px 12px",
                background:
                  cargando || !input.trim() ? "#d1d5db" : colorPrimario,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor:
                  cargando || !input.trim() ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
