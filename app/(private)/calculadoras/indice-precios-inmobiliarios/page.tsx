"use client";

import { useState, useMemo } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number, dec = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtARS(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

// ── Data ─────────────────────────────────────────────────────────────────────

interface ZonaData {
  id: string;
  nombre: string;
  region: string;
  precioUSD: number;        // Mayo 2026
  varMensual: number;       // % vs Dic 2025
  varAnual: number;         // % anual
}

const ZONAS: ZonaData[] = [
  { id: "ros_norte",      nombre: "Zona Norte (Fisherton, Alberdi Norte)", region: "Rosario",  precioUSD: 1450, varMensual: 2.1, varAnual: 6.0 },
  { id: "ros_macro",      nombre: "Macrocentro (Centro, Rep. de la Sexta)", region: "Rosario", precioUSD: 1600, varMensual: 3.2, varAnual: 8.0 },
  { id: "ros_parque",     nombre: "Barrio Parque, Echesortu",               region: "Rosario", precioUSD: 1350, varMensual: 1.5, varAnual: 5.4 },
  { id: "ros_pichi",      nombre: "Pichincha, Refinería",                   region: "Rosario", precioUSD: 1200, varMensual: 1.0, varAnual: 4.3 },
  { id: "ros_villa",      nombre: "Villa del Parque, Lomas de Zamora",      region: "Rosario", precioUSD: 1100, varMensual: 0.9, varAnual: 3.8 },
  { id: "ros_periferia",  nombre: "Barrios periféricos",                    region: "Rosario", precioUSD:  950, varMensual: 0.5, varAnual: 2.6 },
  { id: "caba_palermo",   nombre: "Palermo, Belgrano",                      region: "CABA",    precioUSD: 2800, varMensual: 1.4, varAnual: 5.7 },
  { id: "caba_caballito", nombre: "Caballito, Villa Crespo",                region: "CABA",    precioUSD: 2200, varMensual: 1.2, varAnual: 4.8 },
  { id: "caba_telmo",     nombre: "San Telmo, La Boca",                     region: "CABA",    precioUSD: 1800, varMensual: 0.8, varAnual: 3.7 },
  { id: "gba_norte",      nombre: "GBA Norte (Tigre, San Isidro)",          region: "GBA",     precioUSD: 2000, varMensual: 1.0, varAnual: 4.5 },
  { id: "gba_oeste",      nombre: "GBA Oeste (Morón, Castelar)",            region: "GBA",     precioUSD: 1400, varMensual: 0.7, varAnual: 3.5 },
  { id: "cba_nueva",      nombre: "Córdoba Capital - Nueva Córdoba",        region: "Córdoba", precioUSD: 1500, varMensual: 1.3, varAnual: 5.8 },
  { id: "mza_capital",    nombre: "Mendoza Capital",                        region: "Mendoza", precioUSD: 1300, varMensual: 0.8, varAnual: 4.0 },
];

// ── Historical data ───────────────────────────────────────────────────────────

const PERIODOS_LABELS = [
  "Oct 2024", "Dic 2024", "Feb 2025", "Abr 2025", "Jun 2025",
  "Ago 2025", "Oct 2025", "Dic 2025", "Feb 2026", "May 2026",
];

interface SerieHistorica {
  id: string;
  nombre: string;
  color: string;
  datos: number[];
}

const SERIES_HISTORICAS: SerieHistorica[] = [
  {
    id: "ros_macro",
    nombre: "Rosario Macrocentro",
    color: "#cc0000",
    datos: [1380, 1410, 1440, 1460, 1500, 1520, 1550, 1580, 1595, 1600],
  },
  {
    id: "ros_norte",
    nombre: "Rosario Zona Norte",
    color: "#f97316",
    datos: [1250, 1270, 1295, 1310, 1350, 1370, 1400, 1420, 1440, 1450],
  },
  {
    id: "caba_palermo",
    nombre: "CABA Palermo",
    color: "#3b82f6",
    datos: [2500, 2550, 2600, 2650, 2700, 2730, 2760, 2780, 2795, 2800],
  },
  {
    id: "cba_nueva",
    nombre: "Córdoba Capital",
    color: "#a78bfa",
    datos: [1300, 1320, 1340, 1370, 1400, 1420, 1450, 1470, 1490, 1500],
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    background: "#0a0a0a",
    color: "#e0e0e0",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif",
    padding: "32px 16px 64px",
  } as React.CSSProperties,

  inner: {
    maxWidth: 900,
    margin: "0 auto",
  } as React.CSSProperties,

  heading: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
    color: "#ffffff",
    marginBottom: 4,
    lineHeight: 1.2,
  } as React.CSSProperties,

  subtitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 32,
  } as React.CSSProperties,

  tabBar: {
    display: "flex",
    gap: 4,
    marginBottom: 32,
    borderBottom: "1px solid #222",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  tab: (active: boolean): React.CSSProperties => ({
    padding: "10px 18px",
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
    color: active ? "#ffffff" : "#888",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    transition: "color 0.15s",
    marginBottom: -1,
  }),

  card: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 10,
    padding: "20px 24px",
  } as React.CSSProperties,

  label: {
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
    display: "block",
  } as React.CSSProperties,

  input: {
    background: "#0f0f0f",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    padding: "8px 12px",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  select: {
    background: "#0f0f0f",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    padding: "8px 12px",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  badge: (color: string, bg: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    letterSpacing: "0.03em",
  }),

  regionColor: (region: string): string => {
    const map: Record<string, string> = {
      Rosario: "#cc0000",
      CABA: "#3b82f6",
      GBA: "#f97316",
      Córdoba: "#a78bfa",
      Mendoza: "#22c55e",
    };
    return map[region] ?? "#888";
  },

  sectionTitle: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    color: "#ffffff",
    marginBottom: 16,
    marginTop: 0,
  } as React.CSSProperties,
};

// ── Arrow badge ───────────────────────────────────────────────────────────────

function VarBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 12,
        fontWeight: 600,
        color: up ? "#4ade80" : "#f87171",
      }}
    >
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1 — Precios actuales
// ══════════════════════════════════════════════════════════════════════════════

function Tab1Precios() {
  const [m2, setM2] = useState<string>("70");
  const [zonaId, setZonaId] = useState<string>("ros_macro");
  const [tipoCambio, setTipoCambio] = useState<string>("1150");

  const zona = ZONAS.find((z) => z.id === zonaId) ?? ZONAS[0];
  const metros = parseFloat(m2) || 0;
  const tc = parseFloat(tipoCambio) || 1150;

  const valorBase = zona.precioUSD * metros;
  const valorMin = valorBase * 0.85;
  const valorMax = valorBase * 1.15;

  const regionGroups = useMemo(() => {
    const map: Record<string, ZonaData[]> = {};
    for (const z of ZONAS) {
      if (!map[z.region]) map[z.region] = [];
      map[z.region].push(z);
    }
    return map;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* --- Price cards grid --- */}
      {Object.entries(regionGroups).map(([region, zonas]) => (
        <div key={region}>
          <h3
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              color: S.regionColor(region),
              marginBottom: 12,
              marginTop: 0,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {region}
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {zonas.map((z) => (
              <div key={z.id} style={{ ...S.card, borderLeft: `3px solid ${S.regionColor(z.region)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#888",
                      lineHeight: 1.4,
                      maxWidth: "70%",
                    }}
                  >
                    {z.nombre}
                  </span>
                  <span style={S.badge(S.regionColor(z.region), `${S.regionColor(z.region)}18`)}>
                    {z.region}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 800,
                    fontSize: 28,
                    color: "#ffffff",
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  USD {fmtUSD(z.precioUSD, 0)}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>por m²</div>
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#666" }}>Vs Dic 25 </span>
                    <VarBadge pct={z.varMensual} />
                  </div>
                  <div>
                    <span style={{ color: "#666" }}>Anual </span>
                    <VarBadge pct={z.varAnual} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* --- Calculator --- */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Calculadora de valor estimado</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <label style={S.label}>Superficie (m²)</label>
            <input
              type="number"
              min={0}
              value={m2}
              onChange={(e) => setM2(e.target.value)}
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>Zona</label>
            <select value={zonaId} onChange={(e) => setZonaId(e.target.value)} style={S.select}>
              {ZONAS.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.region} — {z.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Tipo de cambio (ARS/USD)</label>
            <input
              type="number"
              min={1}
              value={tipoCambio}
              onChange={(e) => setTipoCambio(e.target.value)}
              style={S.input}
            />
          </div>
        </div>

        {metros > 0 && (
          <div
            style={{
              background: "#0a0a0a",
              border: "1px solid #cc000040",
              borderRadius: 8,
              padding: "20px 24px",
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "#888" }}>Valor estimado · </span>
              <span style={{ fontSize: 13, color: "#e0e0e0" }}>
                {metros} m² × USD {fmtUSD(zona.precioUSD, 0)}/m²
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: 32,
                color: "#ffffff",
                marginBottom: 4,
              }}
            >
              USD {fmtUSD(valorBase, 2)}
            </div>
            <div style={{ fontSize: 15, color: "#aaa", marginBottom: 20 }}>
              ARS {fmtARS(valorBase * tc)}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                paddingTop: 16,
                borderTop: "1px solid #222",
              }}
            >
              <div
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: 6,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Mínimo (−15%)</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#e0e0e0" }}>
                  USD {fmtUSD(valorMin, 2)}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>ARS {fmtARS(valorMin * tc)}</div>
              </div>
              <div
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: 6,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Máximo (+15%)</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#e0e0e0" }}>
                  USD {fmtUSD(valorMax, 2)}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>ARS {fmtARS(valorMax * tc)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Historical SVG chart
// ══════════════════════════════════════════════════════════════════════════════

const CHART_W = 750;
const CHART_H = 320;
const PAD = { top: 24, right: 24, bottom: 52, left: 64 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

function buildPath(datos: number[], yMin: number, yMax: number): string {
  const n = datos.length;
  return datos
    .map((v, i) => {
      const x = PAD.left + (i / (n - 1)) * PLOT_W;
      const y = PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildDots(datos: number[], yMin: number, yMax: number): { x: number; y: number; v: number }[] {
  const n = datos.length;
  return datos.map((v, i) => ({
    x: PAD.left + (i / (n - 1)) * PLOT_W,
    y: PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H,
    v,
  }));
}

function Tab2Historico() {
  const [activeIds, setActiveIds] = useState<string[]>(["ros_macro", "caba_palermo", "ros_norte", "cba_nueva"]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);

  const activeSeries = SERIES_HISTORICAS.filter((s) => activeIds.includes(s.id));

  const allValues = activeSeries.flatMap((s) => s.datos);
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 3000;
  const padding = (rawMax - rawMin) * 0.12;
  const yMin = Math.max(0, rawMin - padding);
  const yMax = rawMax + padding;

  const yTicks = 5;
  const yTickStep = (yMax - yMin) / yTicks;

  function toggleSerie(id: string) {
    setActiveIds((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((x) => x !== id)
          : prev
        : [...prev, id]
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Legend / toggles */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {SERIES_HISTORICAS.map((s) => {
          const on = activeIds.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggleSerie(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 14px",
                border: `1px solid ${on ? s.color : "#333"}`,
                borderRadius: 20,
                background: on ? `${s.color}18` : "transparent",
                color: on ? "#fff" : "#666",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: on ? s.color : "#444",
                }}
              />
              {s.nombre}
            </button>
          );
        })}
      </div>

      {/* SVG chart */}
      <div
        style={{
          ...S.card,
          overflowX: "auto",
          position: "relative",
        }}
      >
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          style={{ width: "100%", minWidth: 400, display: "block" }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid lines */}
          {Array.from({ length: yTicks + 1 }).map((_, i) => {
            const yVal = yMin + yTickStep * i;
            const y = PAD.top + PLOT_H - ((yVal - yMin) / (yMax - yMin)) * PLOT_H;
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={PAD.left + PLOT_W}
                  y2={y}
                  stroke="#222"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#666"
                  fontSize={11}
                  fontFamily="Inter,sans-serif"
                >
                  {Math.round(yVal).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Y axis label */}
          <text
            x={12}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            fill="#555"
            fontSize={11}
            fontFamily="Inter,sans-serif"
            transform={`rotate(-90, 12, ${PAD.top + PLOT_H / 2})`}
          >
            USD/m²
          </text>

          {/* X axis labels */}
          {PERIODOS_LABELS.map((label, i) => {
            const x = PAD.left + (i / (PERIODOS_LABELS.length - 1)) * PLOT_W;
            return (
              <text
                key={i}
                x={x}
                y={CHART_H - 10}
                textAnchor="middle"
                fill="#666"
                fontSize={10}
                fontFamily="Inter,sans-serif"
              >
                {label}
              </text>
            );
          })}

          {/* Lines */}
          {activeSeries.map((s) => (
            <path
              key={s.id}
              d={buildPath(s.datos, yMin, yMax)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Dots */}
          {activeSeries.map((s) =>
            buildDots(s.datos, yMin, yMax).map((dot, i) => (
              <circle
                key={`${s.id}-${i}`}
                cx={dot.x}
                cy={dot.y}
                r={4}
                fill={s.color}
                stroke="#111"
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onMouseEnter={() =>
                  setTooltip({
                    x: dot.x,
                    y: dot.y,
                    label: `${s.nombre}\n${PERIODOS_LABELS[i]}: USD ${dot.v.toLocaleString()}`,
                  })
                }
              />
            ))
          )}

          {/* Tooltip */}
          {tooltip && (
            <g>
              {(() => {
                const lines = tooltip.label.split("\n");
                const boxW = 170;
                const boxH = 44;
                const tx = Math.min(tooltip.x - boxW / 2, CHART_W - PAD.right - boxW);
                const ty = tooltip.y - boxH - 10;
                return (
                  <>
                    <rect
                      x={tx}
                      y={ty}
                      width={boxW}
                      height={boxH}
                      rx={5}
                      fill="#1a1a1a"
                      stroke="#333"
                    />
                    <text
                      x={tx + 10}
                      y={ty + 16}
                      fill="#aaa"
                      fontSize={11}
                      fontFamily="Inter,sans-serif"
                    >
                      {lines[0]}
                    </text>
                    <text
                      x={tx + 10}
                      y={ty + 32}
                      fill="#fff"
                      fontSize={12}
                      fontFamily="Inter,sans-serif"
                      fontWeight="bold"
                    >
                      {lines[1]}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      {/* Accumulation table */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Variaciones acumuladas</h3>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                {["Zona", "Oct 2024", "May 2026", "Variación total"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      color: "#888",
                      fontWeight: 500,
                      fontSize: 12,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SERIES_HISTORICAS.map((s) => {
                const inicio = s.datos[0];
                const fin = s.datos[s.datos.length - 1];
                const varTotal = ((fin - inicio) / inicio) * 100;
                return (
                  <tr
                    key={s.id}
                    style={{ borderBottom: "1px solid #1a1a1a" }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: s.color,
                            flexShrink: 0,
                          }}
                        />
                        {s.nombre}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#aaa" }}>
                      USD {inicio.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#e0e0e0", fontWeight: 600 }}>
                      USD {fin.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <VarBadge pct={varTotal} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 3 — Zone comparator
// ══════════════════════════════════════════════════════════════════════════════

type TipoPropiedad = "1dorm" | "2dorm" | "3dorm" | "ph";

const TIPOS_PROP: { id: TipoPropiedad; label: string; m2: number }[] = [
  { id: "1dorm", label: "1 dormitorio (~50 m²)", m2: 50 },
  { id: "2dorm", label: "2 dormitorios (~70 m²)", m2: 70 },
  { id: "3dorm", label: "3 dormitorios (~90 m²)", m2: 90 },
  { id: "ph",    label: "PH (~100 m²)",           m2: 100 },
];

const BAR_COLORS = ["#cc0000", "#3b82f6", "#22c55e"];

function Tab3Comparador() {
  const [presupuesto, setPresupuesto] = useState<string>("150000");
  const [tipoProp, setTipoProp] = useState<TipoPropiedad>("2dorm");
  const [selectedZonas, setSelectedZonas] = useState<string[]>(["ros_macro", "caba_palermo", "cba_nueva"]);

  const tipo = TIPOS_PROP.find((t) => t.id === tipoProp) ?? TIPOS_PROP[1];
  const budget = parseFloat(presupuesto) || 0;

  function toggleZona(id: string) {
    setSelectedZonas((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  interface ResultRow {
    zona: ZonaData;
    precio: number;
    alcanza: boolean;
    diferencia: number;
    color: string;
  }

  const resultados: ResultRow[] = selectedZonas.map((id, idx) => {
    const zona = ZONAS.find((z) => z.id === id) ?? ZONAS[0];
    const precio = zona.precioUSD * tipo.m2;
    return {
      zona,
      precio,
      alcanza: budget >= precio,
      diferencia: budget - precio,
      color: BAR_COLORS[idx % BAR_COLORS.length],
    };
  });

  const maxPrecio = Math.max(...resultados.map((r) => r.precio), budget);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Inputs */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Configuración</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <label style={S.label}>Presupuesto (USD)</label>
            <input
              type="number"
              min={0}
              value={presupuesto}
              onChange={(e) => setPresupuesto(e.target.value)}
              style={S.input}
            />
          </div>
          <div>
            <label style={S.label}>Tipo de propiedad</label>
            <select
              value={tipoProp}
              onChange={(e) => setTipoProp(e.target.value as TipoPropiedad)}
              style={S.select}
            >
              {TIPOS_PROP.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Zone selector */}
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Seleccioná hasta 3 zonas</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ZONAS.map((z) => {
            const on = selectedZonas.includes(z.id);
            const idx = selectedZonas.indexOf(z.id);
            const col = on ? BAR_COLORS[idx % BAR_COLORS.length] : "#333";
            return (
              <button
                key={z.id}
                onClick={() => toggleZona(z.id)}
                style={{
                  padding: "6px 13px",
                  border: `1px solid ${col}`,
                  borderRadius: 6,
                  background: on ? `${col}22` : "transparent",
                  color: on ? "#fff" : "#777",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {z.region} — {z.nombre}
              </button>
            );
          })}
        </div>
        {selectedZonas.length >= 3 && (
          <p style={{ fontSize: 12, color: "#666", marginTop: 10, marginBottom: 0 }}>
            Máximo 3 zonas. Deseleccioná una para agregar otra.
          </p>
        )}
      </div>

      {/* Results */}
      {resultados.length > 0 && budget > 0 && (
        <div style={S.card}>
          <h3 style={S.sectionTitle}>
            Resultado — {tipo.m2} m² ({tipo.label})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {resultados.map((r) => {
              const barPct = (r.precio / maxPrecio) * 100;
              const budgetPct = (budget / maxPrecio) * 100;
              return (
                <div
                  key={r.zona.id}
                  style={{
                    ...S.card,
                    borderLeft: `3px solid ${r.color}`,
                    background: "#0d0d0d",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "#fff",
                          marginBottom: 2,
                        }}
                      >
                        {r.zona.region} — {r.zona.nombre}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {tipo.m2} m² × USD {fmtUSD(r.zona.precioUSD, 0)}/m²
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: 800,
                          fontSize: 22,
                          color: "#fff",
                        }}
                      >
                        USD {fmtUSD(r.precio, 0)}
                      </div>
                      <span
                        style={{
                          ...S.badge(
                            r.alcanza ? "#4ade80" : "#f87171",
                            r.alcanza ? "#4ade8022" : "#f8717122"
                          ),
                          fontSize: 12,
                        }}
                      >
                        {r.alcanza ? "✓ Alcanza" : "✗ No alcanza"}
                      </span>
                    </div>
                  </div>

                  {/* Bar SVG */}
                  <svg
                    viewBox="0 0 400 44"
                    style={{ width: "100%", display: "block", marginBottom: 8 }}
                  >
                    {/* Background track */}
                    <rect x={0} y={6} width={400} height={14} rx={4} fill="#1a1a1a" />
                    {/* Budget line */}
                    <rect
                      x={0}
                      y={6}
                      width={(budgetPct / 100) * 400}
                      height={14}
                      rx={4}
                      fill="#333"
                    />
                    {/* Price bar */}
                    <rect
                      x={0}
                      y={6}
                      width={(barPct / 100) * 400}
                      height={14}
                      rx={4}
                      fill={r.color}
                      opacity={0.8}
                    />
                    {/* Budget marker */}
                    <line
                      x1={(budgetPct / 100) * 400}
                      y1={2}
                      x2={(budgetPct / 100) * 400}
                      y2={24}
                      stroke="#fff"
                      strokeWidth={2}
                      strokeDasharray="3,2"
                    />
                    {/* Labels */}
                    <text x={0} y={42} fill="#555" fontSize={10} fontFamily="Inter,sans-serif">
                      USD 0
                    </text>
                    <text
                      x={(budgetPct / 100) * 400}
                      y={42}
                      textAnchor="middle"
                      fill="#aaa"
                      fontSize={10}
                      fontFamily="Inter,sans-serif"
                    >
                      Presupuesto
                    </text>
                    <text
                      x={400}
                      y={42}
                      textAnchor="end"
                      fill="#555"
                      fontSize={10}
                      fontFamily="Inter,sans-serif"
                    >
                      USD {fmtUSD(maxPrecio, 0)}
                    </text>
                  </svg>

                  {/* Difference */}
                  <div
                    style={{
                      fontSize: 13,
                      color: r.alcanza ? "#4ade80" : "#f87171",
                      fontWeight: 600,
                    }}
                  >
                    {r.alcanza
                      ? `Sobran USD ${fmtUSD(r.diferencia, 0)}`
                      : `Faltan USD ${fmtUSD(Math.abs(r.diferencia), 0)}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Root page
// ══════════════════════════════════════════════════════════════════════════════

type TabId = "precios" | "historico" | "comparador";

const TABS: { id: TabId; label: string }[] = [
  { id: "precios",     label: "Precios por m² actuales" },
  { id: "historico",   label: "Evolución histórica" },
  { id: "comparador",  label: "Comparador de zonas" },
];

export default function IndicePrecios() {
  const [tab, setTab] = useState<TabId>("precios");

  return (
    <div style={S.page}>
      <div style={S.inner}>
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <span
            style={{
              ...S.badge("#cc0000", "#cc000020"),
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Mayo 2026
          </span>
        </div>
        <h1 style={S.heading}>Índice de Precios Inmobiliarios</h1>
        <p style={S.subtitle}>
          Precios de referencia USD/m² · Departamentos usados · Rosario, CABA y principales ciudades
        </p>

        {/* Tabs */}
        <div style={S.tabBar}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={S.tab(tab === t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "precios"    && <Tab1Precios />}
        {tab === "historico"  && <Tab2Historico />}
        {tab === "comparador" && <Tab3Comparador />}

        {/* Footer note */}
        <p
          style={{
            marginTop: 40,
            fontSize: 12,
            color: "#444",
            borderTop: "1px solid #1a1a1a",
            paddingTop: 20,
          }}
        >
          * Datos de referencia elaborados a partir de publicaciones de portales inmobiliarios y
          estimaciones de mercado. No constituyen tasación oficial. Actualizado: Mayo 2026.
        </p>
      </div>
    </div>
  );
}
