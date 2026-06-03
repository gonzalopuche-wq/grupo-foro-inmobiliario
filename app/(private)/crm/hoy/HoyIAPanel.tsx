"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────
interface AccionIA {
  prioridad: 1 | 2 | 3;
  tipo: "contactar" | "tarea" | "negocio" | "propiedad" | "general";
  titulo: string;
  descripcion: string;
  urgencia: "alta" | "media" | "baja";
  contacto_id: string | null;
  negocio_id: string | null;
  accion_rapida: string;
}

interface ResultadoIA {
  resumen_dia: string;
  mensaje_motivacional: string;
  acciones: AccionIA[];
}

// ── constantes ────────────────────────────────────────────────────────────────
const TIPO_ICON: Record<string, string> = {
  contactar: "📞",
  tarea: "✅",
  negocio: "🤝",
  propiedad: "🏠",
  general: "⭐",
};

const URGENCIA_COLOR: Record<string, string> = {
  alta: "#b80000",
  media: "#d4960c",
  baja: "#3b82f6",
};

const URGENCIA_BG: Record<string, string> = {
  alta: "rgba(184,0,0,0.12)",
  media: "rgba(212,150,12,0.12)",
  baja: "rgba(59,130,246,0.12)",
};

const PRIORIDAD_GRADIENT: Record<number, string> = {
  1: "linear-gradient(135deg, #b80000, #7f0000)",
  2: "linear-gradient(135deg, #d4960c, #a06f00)",
  3: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
};

const CACHE_KEY = "hoy-ia-cache";

interface CacheEntry {
  fecha: string;
  resultado: ResultadoIA;
}

// ── componente ────────────────────────────────────────────────────────────────
export default function HoyIAPanel() {
  const [resultado, setResultado] = useState<ResultadoIA | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrado, setMostrado] = useState(false);

  const hoyStr = new Date().toISOString().slice(0, 10);

  const cargarDesdeCache = (): ResultadoIA | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const entry: CacheEntry = JSON.parse(raw);
      if (entry.fecha === hoyStr) return entry.resultado;
    } catch {
      // ignore
    }
    return null;
  };

  const guardarEnCache = (r: ResultadoIA) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fecha: hoyStr, resultado: r }));
    } catch {
      // ignore
    }
  };

  const analizarDia = async (forzar = false) => {
    // Intentar desde cache si no es forzado
    if (!forzar) {
      const cached = cargarDesdeCache();
      if (cached) {
        setResultado(cached);
        setMostrado(true);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Sesión expirada"); setLoading(false); return; }

      const res = await fetch("/api/crm/hoy-ia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: string }).error ?? "Error al analizar");
        setLoading(false);
        return;
      }

      const data = await res.json() as { ok: boolean; resumen_dia: string; mensaje_motivacional: string; acciones: AccionIA[] };
      const resultado: ResultadoIA = {
        resumen_dia: data.resumen_dia,
        mensaje_motivacional: data.mensaje_motivacional,
        acciones: (data.acciones ?? []).slice(0, 3),
      };

      guardarEnCache(resultado);
      setResultado(resultado);
      setMostrado(true);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const getAccionHref = (accion: AccionIA): string => {
    if (accion.contacto_id) return `/crm/contactos/${accion.contacto_id}`;
    if (accion.negocio_id) return `/crm/negocios/${accion.negocio_id}`;
    const hrefs: Record<string, string> = {
      contactar: "/crm/contactos",
      tarea: "/crm/tareas",
      negocio: "/crm/negocios",
      propiedad: "/cartera",
      general: "/crm/hoy",
    };
    return hrefs[accion.tipo] ?? "/crm/hoy";
  };

  return (
    <>
      <style>{`
        @keyframes hoia-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes hoia-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .hoia-btn-primary {
          background: var(--gfi-red-gradient, linear-gradient(135deg, #b80000, #7f0000));
          border: none;
          border-radius: var(--gfi-radius-lg, 10px);
          color: #fff;
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.04em;
          padding: 16px 32px;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 24px rgba(184,0,0,0.35);
        }
        .hoia-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .hoia-btn-primary:active { transform: translateY(0); }
        .hoia-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .hoia-card-accion {
          background: var(--gfi-bg-card);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg, 10px);
          padding: 18px 20px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .hoia-card-accion:hover {
          border-color: rgba(184,0,0,0.35);
          box-shadow: 0 2px 16px rgba(0,0,0,0.25);
        }
        .hoia-btn-accion {
          border: none;
          border-radius: 6px;
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 8px 14px;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s, transform 0.15s;
          text-decoration: none;
          display: inline-block;
        }
        .hoia-btn-accion:hover { opacity: 0.82; transform: translateY(-1px); }
        .hoia-regenerar {
          background: transparent;
          border: 1px solid var(--gfi-border);
          border-radius: 6px;
          color: var(--gfi-text-secondary);
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 8px 16px;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .hoia-regenerar:hover { border-color: rgba(184,0,0,0.5); color: #b80000; }
        .hoia-loading-text {
          animation: hoia-pulse 1.4s ease-in-out infinite;
        }
      `}</style>

      <div style={{
        background: "var(--gfi-bg-card)",
        border: "1px solid var(--gfi-border)",
        borderRadius: "var(--gfi-radius-lg, 10px)",
        overflow: "hidden",
      }}>

        {/* ── Franja superior ── */}
        <div style={{
          padding: "4px 20px",
          background: "var(--gfi-red-gradient, linear-gradient(135deg, #b80000, #7f0000))",
          fontSize: 9,
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.85)",
        }}>
          ✨ Inteligencia Artificial · Panel de Hoy
        </div>

        <div style={{ padding: "24px 24px 20px" }}>

          {/* ── Estado inicial: botón CTA ── */}
          {!mostrado && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "12px 0" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                  ¿Qué hacer primero hoy?
                </div>
                <div style={{ fontSize: 13, color: "var(--gfi-text-secondary)", fontFamily: "Inter,sans-serif", maxWidth: 380 }}>
                  La IA analiza tu cartera y genera las 3 acciones más importantes del día
                </div>
              </div>
              <button className="hoia-btn-primary" onClick={() => analizarDia(false)}>
                ✨ Ver mis 3 prioridades del día
              </button>
              {error && (
                <div style={{ fontSize: 12, color: "#b80000", fontFamily: "Inter,sans-serif", textAlign: "center" }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid rgba(184,0,0,0.15)", borderTop: "3px solid #b80000", animation: "spin 0.9s linear infinite" }}>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
              <div className="hoia-loading-text" style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--gfi-text-secondary)", letterSpacing: "0.03em" }}>
                Analizando tu cartera...
              </div>
              <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>
                Claude está revisando contactos, tareas y negocios
              </div>
            </div>
          )}

          {/* ── Resultado ── */}
          {mostrado && resultado && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Encabezado con resumen */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8,
                padding: "14px 16px",
              }}>
                <div style={{ fontSize: 13, color: "var(--gfi-text-primary, #fff)", fontFamily: "Inter,sans-serif", lineHeight: 1.5, marginBottom: 8 }}>
                  {resultado.resumen_dia}
                </div>
                <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", fontStyle: "italic" }}>
                  💡 {resultado.mensaje_motivacional}
                </div>
              </div>

              {/* 3 acciones */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {resultado.acciones
                  .sort((a, b) => a.prioridad - b.prioridad)
                  .map((accion) => (
                    <div key={accion.prioridad} className="hoia-card-accion">

                      {/* Número de prioridad */}
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: PRIORIDAD_GRADIENT[accion.prioridad] ?? PRIORIDAD_GRADIENT[3],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        fontWeight: 900,
                        color: "#fff",
                        flexShrink: 0,
                        boxShadow: `0 2px 10px ${URGENCIA_COLOR[accion.urgencia] ?? "#3b82f6"}40`,
                      }}>
                        {accion.prioridad}
                      </div>

                      {/* Contenido */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                          <span style={{ fontSize: 17 }}>{TIPO_ICON[accion.tipo] ?? "⭐"}</span>
                          <span style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#fff",
                          }}>
                            {accion.titulo}
                          </span>
                          <span style={{
                            fontSize: 9,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: 20,
                            background: URGENCIA_BG[accion.urgencia] ?? "rgba(255,255,255,0.06)",
                            color: URGENCIA_COLOR[accion.urgencia] ?? "#fff",
                            border: `1px solid ${URGENCIA_COLOR[accion.urgencia] ?? "#fff"}35`,
                          }}>
                            {accion.urgencia}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: "var(--gfi-text-secondary)",
                          fontFamily: "Inter,sans-serif",
                          lineHeight: 1.5,
                          marginBottom: 10,
                        }}>
                          {accion.descripcion}
                        </div>
                        <Link
                          href={getAccionHref(accion)}
                          className="hoia-btn-accion"
                          style={{
                            background: URGENCIA_BG[accion.urgencia] ?? "rgba(255,255,255,0.06)",
                            color: URGENCIA_COLOR[accion.urgencia] ?? "#fff",
                            border: `1px solid ${URGENCIA_COLOR[accion.urgencia] ?? "#fff"}40`,
                          }}
                        >
                          {accion.accion_rapida} →
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Footer */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
                <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif" }}>
                  Generado por Claude Haiku · Caché del día
                </div>
                <button className="hoia-regenerar" onClick={() => analizarDia(true)}>
                  ↻ Regenerar análisis
                </button>
              </div>

              {error && (
                <div style={{ fontSize: 12, color: "#b80000", fontFamily: "Inter,sans-serif" }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
