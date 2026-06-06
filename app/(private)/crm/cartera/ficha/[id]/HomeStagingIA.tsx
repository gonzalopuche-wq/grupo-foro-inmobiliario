"use client";

import { useState } from "react";
import { supabase } from "../../../../../lib/supabase";

interface Props {
  propiedadId: string;
  fotos: string[];
}

const ESTILOS: { id: string; label: string; emoji: string }[] = [
  { id: "moderno", label: "Moderno", emoji: "🛋️" },
  { id: "clasico", label: "Clásico", emoji: "🏛️" },
  { id: "nordico", label: "Nórdico", emoji: "🌿" },
  { id: "industrial", label: "Industrial", emoji: "🏭" },
  { id: "premium", label: "Premium", emoji: "💎" },
  { id: "vacio", label: "Vaciar ambiente", emoji: "📐" },
];

export function HomeStagingIA({ propiedadId, fotos }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [fotoSel, setFotoSel] = useState<string>(fotos[0] ?? "");
  const [estilo, setEstilo] = useState("moderno");
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const tieneFotos = fotos.length > 0;

  const generar = async () => {
    if (!fotoSel) { setError("Elegí una foto de base."); return; }
    setGenerando(true);
    setError(null);
    setPendiente(false);
    setResultado(null);
    setGuardado(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Sesión expirada. Recargá la página."); return; }
      const res = await fetch("/api/ia-decorar-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ foto_url: fotoSel, estilo }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.pendiente) setPendiente(true);
        setError(data.error ?? "No se pudo generar la imagen.");
        return;
      }
      setResultado(data.url as string);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  const guardar = async () => {
    if (!resultado) return;
    setGuardando(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Sesión expirada. Recargá la página."); return; }
      const res = await fetch("/api/crm/cartera/guardar-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ propiedadId, imagenUrl: resultado }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? "No se pudo guardar la foto."); return; }
      setGuardado(true);
    } catch {
      setError("Error de conexión al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const card: React.CSSProperties = {
    border: "1px solid var(--gfi-border-subtle)",
    borderRadius: 10,
    background: "var(--gfi-bg-card, rgba(255,255,255,0.02))",
    overflow: "hidden",
  };

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setAbierto(a => !a)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px", borderRadius: 5,
          border: "1px solid rgba(167,139,250,0.35)",
          background: abierto ? "rgba(167,139,250,0.14)" : "rgba(167,139,250,0.08)",
          color: "#c4b5fd", cursor: "pointer",
          fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase",
        }}
      >
        ✨ Home staging con IA
      </button>

      {abierto && (
        <div style={{ ...card, marginTop: 14, padding: "18px 20px" }}>
          <p style={{ fontSize: 12, color: "var(--gfi-text-muted)", margin: "0 0 16px", lineHeight: 1.6 }}>
            Amoblá un ambiente vacío o cambiá su estilo con IA para presentar mejor la propiedad.
            La foto generada se puede guardar en la galería de la propiedad.
          </p>

          {!tieneFotos ? (
            <div style={{ fontSize: 13, color: "var(--gfi-text-muted)", padding: "16px 0" }}>
              Subí fotos a la propiedad para poder usar el home staging.
            </div>
          ) : (
            <>
              {/* Selector de foto base */}
              <div style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>
                1 · Elegí la foto de base
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {fotos.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFotoSel(f)}
                    style={{
                      width: 76, height: 56, borderRadius: 6, overflow: "hidden",
                      border: fotoSel === f ? "2px solid #a78bfa" : "2px solid transparent",
                      padding: 0, cursor: "pointer", background: "var(--gfi-bg-secondary)",
                      boxShadow: fotoSel === f ? "0 0 0 2px rgba(167,139,250,0.3)" : "none",
                    }}
                  >
                    <img src={f} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>

              {/* Selector de estilo */}
              <div style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>
                2 · Elegí el estilo
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {ESTILOS.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEstilo(e.id)}
                    style={{
                      padding: "6px 12px", borderRadius: 20,
                      border: estilo === e.id ? "1px solid rgba(167,139,250,0.6)" : "1px solid var(--gfi-border)",
                      background: estilo === e.id ? "rgba(167,139,250,0.16)" : "transparent",
                      color: estilo === e.id ? "#c4b5fd" : "var(--gfi-text-secondary)",
                      cursor: "pointer", fontSize: 12, fontFamily: "var(--font-body)",
                    }}
                  >
                    {e.emoji} {e.label}
                  </button>
                ))}
              </div>

              <button
                onClick={generar}
                disabled={generando}
                style={{
                  padding: "9px 18px", borderRadius: 5, border: "none",
                  background: generando ? "rgba(167,139,250,0.25)" : "#7c3aed",
                  color: "#fff", cursor: generando ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                }}
              >
                {generando ? "⏳ Generando… (hasta 1 min)" : "✨ Generar staging"}
              </button>

              {error && (
                <div style={{ marginTop: 14, padding: "12px 16px", background: pendiente ? "rgba(196,74,0,0.10)" : "var(--gfi-red-soft)", border: `1px solid ${pendiente ? "rgba(196,74,0,0.28)" : "var(--gfi-red-border)"}`, borderRadius: 8, fontSize: 13, color: pendiente ? "#d4960c" : "var(--gfi-red)", lineHeight: 1.5 }}>
                  {error}
                  {pendiente && (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                      El administrador debe agregar <code>GEMINI_API_KEY</code> en las variables de entorno para habilitar el home staging con IA.
                    </div>
                  )}
                </div>
              )}

              {/* Resultado antes/después */}
              {resultado && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 6 }}>Antes</div>
                      <img src={fotoSel} alt="Original" referrerPolicy="no-referrer" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--gfi-border-subtle)" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#c4b5fd", marginBottom: 6 }}>Después (IA)</div>
                      <img src={resultado} alt="Con staging IA" style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(167,139,250,0.4)" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                    {!guardado ? (
                      <button
                        onClick={guardar}
                        disabled={guardando}
                        style={{
                          padding: "8px 16px", borderRadius: 5, border: "1px solid rgba(58,186,182,0.4)",
                          background: guardando ? "rgba(58,186,182,0.08)" : "rgba(58,186,182,0.14)",
                          color: "var(--gfi-teal-text)", cursor: guardando ? "not-allowed" : "pointer",
                          fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700,
                          letterSpacing: "0.1em", textTransform: "uppercase",
                        }}
                      >
                        {guardando ? "Guardando…" : "💾 Guardar en la propiedad"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--gfi-teal-text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                        ✓ Guardada en la galería. Recargá para verla en las fotos.
                      </span>
                    )}
                    <a href={resultado} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--gfi-text-muted)", textDecoration: "underline" }}>
                      Abrir en tamaño completo
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
