"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface LeadScoreResultado {
  score: number;
  nivel: "frío" | "tibio" | "caliente" | "muy_caliente";
  factores_positivos: string[];
  factores_negativos: string[];
  recomendacion: string;
}

interface LeadScoreButtonProps {
  contactoId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const NIVEL_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string; glow: string }
> = {
  frío: {
    color: "#60a5fa",
    bg: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.30)",
    label: "Frío",
    glow: "rgba(59,130,246,0.25)",
  },
  tibio: {
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.30)",
    label: "Tibio",
    glow: "rgba(251,191,36,0.25)",
  },
  caliente: {
    color: "#34d399",
    bg: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.30)",
    label: "Caliente",
    glow: "rgba(52,211,153,0.25)",
  },
  muy_caliente: {
    color: "#4ade80",
    bg: "rgba(74,222,128,0.12)",
    border: "rgba(74,222,128,0.40)",
    label: "Muy caliente",
    glow: "rgba(74,222,128,0.35)",
  },
};

function ScoreGauge({ score, nivel }: { score: number; nivel: string }) {
  const cfg = NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG["tibio"];
  const clampedScore = Math.max(0, Math.min(100, score));

  // SVG arc gauge
  const radius = 52;
  const cx = 70;
  const cy = 70;
  const startAngle = -210;
  const endAngle = 30;
  const totalDegrees = endAngle - startAngle;
  const scoreDegrees = (clampedScore / 100) * totalDegrees;

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const s = polarToCartesian(cx, cy, r, startDeg);
    const e = polarToCartesian(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const bgArc = describeArc(cx, cy, radius, startAngle, endAngle);
  const fgArc = clampedScore > 0
    ? describeArc(cx, cy, radius, startAngle, startAngle + scoreDegrees)
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 }}>
      <svg width="140" height="110" viewBox="0 0 140 110">
        {/* Track */}
        <path
          d={bgArc}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Fill */}
        {fgArc && (
          <path
            d={fgArc}
            fill="none"
            stroke={cfg.color}
            strokeWidth="10"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${cfg.glow})` }}
          />
        )}
        {/* Score text */}
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fill={cfg.color}
          fontSize="30"
          fontWeight="900"
          fontFamily="var(--font-display)"
          style={{ filter: `drop-shadow(0 0 8px ${cfg.glow})` }}
        >
          {clampedScore}
        </text>
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          fill="var(--gfi-text-muted)"
          fontSize="9"
          fontWeight="700"
          fontFamily="var(--font-display)"
          letterSpacing="2"
          textDecoration="none"
        >
          / 100
        </text>
      </svg>
      <span
        style={{
          display: "inline-block",
          padding: "3px 14px",
          borderRadius: 20,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginTop: -4,
        }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeadScoreButton({ contactoId }: LeadScoreButtonProps) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<LeadScoreResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calcularScore = async () => {
    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("No hay sesión activa.");
        return;
      }

      const res = await fetch("/api/crm/lead-scoring", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contacto_id: contactoId }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Error al calcular el score.");
        return;
      }

      setResultado(json.resultado as LeadScoreResultado);
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--gfi-bg-card)",
        border: "1px solid var(--gfi-border)",
        borderRadius: "var(--gfi-radius-lg)",
        padding: "16px 18px",
        marginBottom: 12,
      }}
    >
      <style>{`
        .lsb-card-title {
          font-size: 9px; font-family: var(--font-display); font-weight: 800;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--gfi-text-muted); margin-bottom: 13px;
          display: flex; align-items: center; gap: 10px;
        }
        .lsb-card-title::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, var(--gfi-border) 0%, transparent 100%);
        }
        .lsb-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px;
          border-radius: var(--gfi-radius-md);
          border: 1px solid var(--gfi-border);
          background: var(--gfi-bg-elevated);
          color: var(--gfi-text-secondary);
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          cursor: pointer; transition: var(--gfi-transition); width: 100%;
          justify-content: center;
        }
        .lsb-btn:hover:not(:disabled) {
          background: var(--gfi-bg-hover);
          color: var(--gfi-text-primary);
          border-color: var(--gfi-border-bright);
        }
        .lsb-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .lsb-factor {
          display: flex; align-items: flex-start; gap: 7px;
          font-size: 12px; color: var(--gfi-text-secondary);
          line-height: 1.45; margin-bottom: 5px;
        }
        .lsb-factor-icon { flex-shrink: 0; font-size: 13px; margin-top: -1px; }
        .lsb-rec {
          background: rgba(153,0,0,0.07);
          border: 1px solid var(--gfi-red-border);
          border-radius: var(--gfi-radius-md);
          padding: 10px 13px; margin-top: 10px;
        }
        .lsb-rec-label {
          font-size: 8px; font-family: var(--font-display); font-weight: 800;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--gfi-red); margin-bottom: 5px;
        }
        .lsb-rec-text {
          font-size: 12px; color: var(--gfi-text-primary); line-height: 1.5;
        }
        .lsb-section-label {
          font-size: 8px; font-family: var(--font-display); font-weight: 800;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--gfi-text-muted); margin-bottom: 7px; margin-top: 10px;
        }
        @keyframes lsb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .lsb-spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.15);
          border-top-color: var(--gfi-text-secondary);
          border-radius: 50%;
          animation: lsb-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
      `}</style>

      <div className="lsb-card-title">Acciones IA</div>

      <button
        className="lsb-btn"
        onClick={calcularScore}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="lsb-spinner" />
            Analizando...
          </>
        ) : (
          <>🤖 Score IA</>
        )}
      </button>

      {error && (
        <div style={{
          marginTop: 10, padding: "8px 12px",
          background: "rgba(153,0,0,0.08)",
          border: "1px solid var(--gfi-red-border)",
          borderRadius: "var(--gfi-radius-md)",
          color: "var(--gfi-red)", fontSize: 12,
          fontFamily: "var(--font-body)",
        }}>
          {error}
        </div>
      )}

      {resultado && (
        <div style={{ marginTop: 16 }}>
          <ScoreGauge score={resultado.score} nivel={resultado.nivel} />

          {resultado.factores_positivos.length > 0 && (
            <>
              <div className="lsb-section-label">Factores positivos</div>
              {resultado.factores_positivos.map((f, i) => (
                <div key={i} className="lsb-factor">
                  <span className="lsb-factor-icon">✅</span>
                  <span>{f}</span>
                </div>
              ))}
            </>
          )}

          {resultado.factores_negativos.length > 0 && (
            <>
              <div className="lsb-section-label">Factores negativos</div>
              {resultado.factores_negativos.map((f, i) => (
                <div key={i} className="lsb-factor">
                  <span className="lsb-factor-icon">⚠️</span>
                  <span>{f}</span>
                </div>
              ))}
            </>
          )}

          {resultado.recomendacion && (
            <div className="lsb-rec">
              <div className="lsb-rec-label">Acción recomendada</div>
              <div className="lsb-rec-text">{resultado.recomendacion}</div>
            </div>
          )}

          <button
            className="lsb-btn"
            onClick={calcularScore}
            disabled={loading}
            style={{ marginTop: 12, opacity: 0.7 }}
          >
            🔄 Recalcular
          </button>
        </div>
      )}
    </div>
  );
}
