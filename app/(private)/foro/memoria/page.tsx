"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

interface Fuente {
  tipo: "tema";
  titulo: string;
  categoria: string;
  fecha: string;
}

interface Entrada {
  rol: "user" | "assistant";
  texto: string;
  fuentes?: Fuente[];
}

const SUGERENCIAS = [
  "¿Cómo se calculan los honorarios en una venta?",
  "¿Qué dicen los corredores sobre ZonaProp vs Argenprop?",
  "Consejos para captar propiedades exclusivas",
  "¿Cómo manejar clientes que quieren bajar demasiado el precio?",
  "Normativa COCIR sobre publicidad inmobiliaria",
  "¿Cuál es la zona con más demanda en Rosario?",
];

export default function MemoriaColectivaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Entrada[]>([]);
  const [consulta, setConsulta] = useState("");
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historial]);

  const consultar = useCallback(async (texto?: string) => {
    const q = (texto ?? consulta).trim();
    if (!q || cargando) return;

    setHistorial(h => [...h, { rol: "user", texto: q }]);
    setConsulta("");
    setCargando(true);

    try {
      const res = await fetch("/api/ia/memoria-colectiva", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consulta: q }),
      });
      const d = await res.json();
      if (d.error) {
        setHistorial(h => [...h, { rol: "assistant", texto: `Error: ${d.error}` }]);
      } else {
        setHistorial(h => [...h, { rol: "assistant", texto: d.respuesta, fuentes: d.fuentes ?? [] }]);
      }
    } catch {
      setHistorial(h => [...h, { rol: "assistant", texto: "Error de conexión. Intentá nuevamente." }]);
    }
    setCargando(false);
  }, [consulta, cargando, token]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0,
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "Inter, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.03)",
        padding: "16px 20px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🧠</span>
          <div>
            <h1 style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.02em",
              margin: 0,
            }}>
              Memoria Colectiva del Foro
            </h1>
            <p style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              margin: 0,
              marginTop: 2,
            }}>
              Consultá el conocimiento acumulado por la comunidad GFI®
            </p>
          </div>
        </div>
      </div>

      {/* Conversación */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px",
        minHeight: 0,
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {historial.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>💬</div>
              <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>
                ¿Qué querés saber?
              </p>
              <p style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 13,
                margin: "0 0 24px",
              }}>
                Buscá en el historial del Foro GFI® y sintetizá el conocimiento colectivo.
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}>
                {SUGERENCIAS.map(s => (
                  <button
                    key={s}
                    onClick={() => consultar(s)}
                    style={{
                      textAlign: "left",
                      fontSize: 12,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      color: "rgba(255,255,255,0.7)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {historial.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: e.rol === "user" ? "flex-end" : "flex-start",
                }}
              >
                {e.rol === "user" ? (
                  <div style={{
                    maxWidth: 480,
                    background: "#cc0000",
                    borderRadius: "16px 16px 4px 16px",
                    padding: "10px 16px",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}>
                    {e.texto}
                  </div>
                ) : (
                  <div style={{ maxWidth: 600, flex: 1 }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 16 }}>🧠</span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.4)",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                      }}>
                        Memoria Colectiva GFI®
                      </span>
                    </div>
                    <div style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: "4px 16px 16px 16px",
                      padding: "14px 18px",
                      fontSize: 13,
                      color: "rgba(255,255,255,0.85)",
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                    }}>
                      {e.texto}
                    </div>
                    {e.fuentes && e.fuentes.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.3)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          margin: "0 0 4px",
                        }}>
                          Fuentes del foro
                        </p>
                        {e.fuentes.slice(0, 4).map((f, fi) => (
                          <div
                            key={fi}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 11,
                              color: "rgba(255,255,255,0.45)",
                              background: "rgba(255,255,255,0.03)",
                              borderRadius: 6,
                              padding: "5px 10px",
                              marginBottom: 3,
                            }}
                          >
                            <span style={{
                              color: "rgba(204,0,0,0.7)",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}>
                              [{f.categoria}]
                            </span>
                            <span style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}>
                              {f.titulo}
                            </span>
                            <span style={{
                              color: "rgba(255,255,255,0.25)",
                              flexShrink: 0,
                            }}>
                              {new Date(f.fecha).toLocaleDateString("es-AR")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {cargando && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 20 }}>
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "4px 16px 16px 16px",
                padding: "12px 18px",
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>🧠</span>
                <span>Buscando en el foro...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.02)",
        padding: "14px 20px",
        flexShrink: 0,
      }}>
        <div style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          gap: 10,
        }}>
          <textarea
            ref={inputRef}
            value={consulta}
            onChange={e => setConsulta(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                consultar();
              }
            }}
            placeholder="Consultá el conocimiento del foro... (Enter para enviar)"
            rows={2}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13,
              color: "#fff",
              resize: "none",
              outline: "none",
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.5,
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(204,0,0,0.5)")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
          />
          <button
            onClick={() => consultar()}
            disabled={!consulta.trim() || cargando}
            style={{
              background: !consulta.trim() || cargando ? "rgba(204,0,0,0.3)" : "#cc0000",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              padding: "0 18px",
              fontSize: 18,
              fontWeight: 700,
              cursor: !consulta.trim() || cargando ? "not-allowed" : "pointer",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            {cargando ? "⋯" : "↑"}
          </button>
        </div>
        <p style={{
          maxWidth: 720,
          margin: "6px auto 0",
          fontSize: 10,
          color: "rgba(255,255,255,0.2)",
          textAlign: "center",
        }}>
          La IA busca en el historial del Foro GFI® · No reemplaza asesoramiento profesional
        </p>
      </div>
    </div>
  );
}
