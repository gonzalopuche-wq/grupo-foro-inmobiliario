"use client";

import { useState } from "react";
import { supabase } from "../../../../../lib/supabase";

interface PrecioAnalisis {
  veredicto: "bien_posicionado" | "caro" | "barato" | "muy_caro" | "muy_barato";
  porcentaje_diferencia: number;
  resumen: string;
  recomendacion: string;
  precio_mercado_estimado: number;
  confianza: "alta" | "media" | "baja";
}

interface Props {
  propiedadId: string;
  moneda: string;
}

const VEREDICTO_CONFIG: Record<
  PrecioAnalisis["veredicto"],
  { label: string; color: string; bg: string; border: string }
> = {
  bien_posicionado: {
    label: "Bien posicionado",
    color: "var(--gfi-teal-text)",
    bg: "rgba(58,186,182,0.08)",
    border: "rgba(58,186,182,0.25)",
  },
  barato: {
    label: "Por debajo del mercado",
    color: "var(--gfi-teal-text)",
    bg: "rgba(58,186,182,0.08)",
    border: "rgba(58,186,182,0.25)",
  },
  muy_barato: {
    label: "Muy por debajo del mercado",
    color: "var(--gfi-teal-text)",
    bg: "rgba(58,186,182,0.1)",
    border: "rgba(58,186,182,0.3)",
  },
  caro: {
    label: "Por encima del mercado",
    color: "var(--gfi-red)",
    bg: "var(--gfi-red-soft)",
    border: "var(--gfi-red-border)",
  },
  muy_caro: {
    label: "Muy por encima del mercado",
    color: "var(--gfi-red)",
    bg: "var(--gfi-red-soft)",
    border: "var(--gfi-red-border)",
  },
};

const CONFIANZA_LABEL: Record<PrecioAnalisis["confianza"], string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export function AnalizarPrecioButton({ propiedadId, moneda }: Props) {
  const [analisis, setAnalisis] = useState<PrecioAnalisis | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparables, setComparables] = useState<number | null>(null);

  const analizar = async () => {
    setAnalizando(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sesión expirada. Recargá la página.");
        return;
      }
      const resp = await fetch("/api/crm/precio-analisis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ propiedadId }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setError(data.error ?? "Error al analizar el precio.");
        return;
      }
      setAnalisis(data.analisis as PrecioAnalisis);
      setComparables(data.comparables_encontrados ?? null);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setAnalizando(false);
    }
  };

  const cfg = analisis ? VEREDICTO_CONFIG[analisis.veredicto] : null;
  const pct = analisis
    ? (analisis.porcentaje_diferencia > 0 ? "+" : "") + analisis.porcentaje_diferencia.toFixed(1) + "%"
    : null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: analisis ? 16 : 0 }}>
        <button
          onClick={analizar}
          disabled={analizando}
          style={{
            padding: "8px 16px",
            borderRadius: 5,
            border: "1px solid rgba(74,184,216,0.35)",
            background: analizando ? "rgba(74,184,216,0.05)" : "rgba(74,184,216,0.1)",
            color: analizando ? "var(--gfi-text-muted)" : "var(--gfi-teal-text)",
            cursor: analizando ? "not-allowed" : "pointer",
            fontFamily: "var(--font-display)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "var(--gfi-transition)",
          }}
        >
          {analizando ? "⏳ Analizando..." : "🤖 Analizar precio"}
        </button>

        {analisis && (
          <button
            onClick={() => { setAnalisis(null); setError(null); }}
            style={{
              background: "none",
              border: "none",
              color: "var(--gfi-text-muted)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
            title="Cerrar análisis"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 12,
          padding: "12px 16px",
          background: "var(--gfi-red-soft)",
          border: "1px solid var(--gfi-red-border)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--gfi-red)",
        }}>
          {error}
        </div>
      )}

      {analisis && cfg && (
        <div style={{
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 10,
          padding: "20px 22px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Accent line top */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: cfg.color,
            opacity: 0.5,
          }} />

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
            <div>
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gfi-text-muted)",
                marginBottom: 4,
              }}>
                🤖 Análisis de precio vs mercado
              </div>
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 800,
                color: cfg.color,
              }}>
                {cfg.label}
              </div>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 24,
                fontWeight: 700,
                color: cfg.color,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}>
                {pct}
              </div>
              <div style={{
                fontSize: 10,
                color: "var(--gfi-text-muted)",
                fontFamily: "var(--font-display)",
                marginTop: 3,
              }}>
                vs. mercado
              </div>
            </div>
          </div>

          {/* Precio de mercado estimado */}
          <div style={{
            background: "rgba(0,0,0,0.15)",
            borderRadius: 6,
            padding: "10px 14px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Precio de mercado estimado
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--gfi-text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {moneda} {analisis.precio_mercado_estimado.toLocaleString("es-AR")}
            </span>
          </div>

          {/* Resumen */}
          <p style={{
            fontSize: 13,
            color: "var(--gfi-text-secondary)",
            lineHeight: 1.65,
            margin: "0 0 12px",
          }}>
            {analisis.resumen}
          </p>

          {/* Recomendación */}
          <div style={{
            padding: "10px 14px",
            background: "rgba(0,0,0,0.12)",
            borderRadius: 6,
            borderLeft: `3px solid ${cfg.color}`,
            fontSize: 12,
            color: "var(--gfi-text-secondary)",
            fontStyle: "italic",
            marginBottom: 12,
          }}>
            <strong style={{ fontStyle: "normal", color: cfg.color, fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
              Recomendación
            </strong>
            {analisis.recomendacion}
          </div>

          {/* Footer: confianza + comparables */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10,
              color: "var(--gfi-text-muted)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}>
              Confianza: <span style={{ color: analisis.confianza === "alta" ? "var(--gfi-teal-text)" : analisis.confianza === "media" ? "var(--gfi-gold-text)" : "var(--gfi-text-muted)" }}>
                {CONFIANZA_LABEL[analisis.confianza]}
              </span>
            </span>
            {comparables !== null && (
              <span style={{ fontSize: 10, color: "var(--gfi-text-dim)", fontFamily: "var(--font-mono)" }}>
                {comparables} comparable{comparables !== 1 ? "s" : ""} analizados
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
