"use client";

import { useState, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FactorPlusvalía {
  id: string;
  label: string;
  descripcion: string;
  valor: number;
  peso: number;
  icon: string;
}

interface ZonaPreset {
  nombre: string;
  descripcion: string;
  valores: Record<string, number>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FACTORES_BASE: Omit<FactorPlusvalía, "valor">[] = [
  { id: "transporte",      label: "Transporte público",   descripcion: "Colectivo, tren, metro a <300m",           peso: 0.15, icon: "🚇" },
  { id: "comercios",       label: "Comercios y servicios", descripcion: "Supermercado, banco, farmacia",            peso: 0.12, icon: "🛒" },
  { id: "seguridad",       label: "Seguridad de la zona",  descripcion: "Índice delictivo relativo a la ciudad",   peso: 0.18, icon: "🛡️" },
  { id: "educacion",       label: "Educación",             descripcion: "Escuelas, universidades a <1km",           peso: 0.10, icon: "🎓" },
  { id: "salud",           label: "Salud",                 descripcion: "Hospital, clínica, CAPS",                  peso: 0.08, icon: "🏥" },
  { id: "parques",         label: "Espacios verdes",       descripcion: "Parques y plazas a <500m",                 peso: 0.10, icon: "🌳" },
  { id: "gastronomia",     label: "Gastronomía y ocio",    descripcion: "Bares, restaurantes, cines",               peso: 0.07, icon: "🍕" },
  { id: "ruido",           label: "Niveles de ruido",      descripcion: "Zona tranquila vs ruidosa",                peso: 0.08, icon: "🔇" },
  { id: "contaminacion",   label: "Calidad ambiental",     descripcion: "Aire limpio, sin industrias",              peso: 0.07, icon: "🌿" },
  { id: "infraestructura", label: "Infraestructura vial",  descripcion: "Accesos, autopistas, ciclovías",           peso: 0.05, icon: "🛣️" },
];

const ZONAS: ZonaPreset[] = [
  {
    nombre: "Centro histórico",
    descripcion: "Alta densidad, mucho comercio",
    valores: { transporte: 80, comercios: 90, seguridad: 20, educacion: 60, salud: 70, parques: -30, gastronomia: 90, ruido: -70, contaminacion: -40, infraestructura: 60 },
  },
  {
    nombre: "Barrio residencial",
    descripcion: "Zona tranquila, bien conectada",
    valores: { transporte: 40, comercios: 30, seguridad: 70, educacion: 50, salud: 40, parques: 60, gastronomia: 20, ruido: 70, contaminacion: 50, infraestructura: 30 },
  },
  {
    nombre: "Periferia urbana",
    descripcion: "Emergente, en desarrollo",
    valores: { transporte: -30, comercios: -40, seguridad: 30, educacion: -20, salud: -30, parques: 40, gastronomia: -40, ruido: 40, contaminacion: 30, infraestructura: -20 },
  },
  {
    nombre: "Zona universitaria",
    descripcion: "Alto tráfico estudiantil",
    valores: { transporte: 70, comercios: 60, seguridad: 40, educacion: 100, salud: 50, parques: 30, gastronomia: 70, ruido: -30, contaminacion: -10, infraestructura: 50 },
  },
];

// Radar axes (subset shown in spider chart)
const RADAR_AXES = ["transporte", "seguridad", "parques", "comercios", "educacion"] as const;
type RadarAxis = typeof RADAR_AXES[number];

const RADAR_LABELS: Record<RadarAxis, string> = {
  transporte: "Transporte",
  seguridad: "Seguridad",
  parques: "Parques",
  comercios: "Comercios",
  educacion: "Educación",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtSign(n: number, dec = 0): string {
  const s = fmt(Math.abs(n), dec);
  return n >= 0 ? `+${s}` : `-${s}`;
}

// ── Radar SVG ──────────────────────────────────────────────────────────────────

const ZONA_COLORS = ["#cc0000", "#22c55e", "#f97316", "#a855f7"];

function polarToXY(angleDeg: number, r: number, cx: number, cy: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

interface RadarChartProps {
  zonas: ZonaPreset[];
}

function RadarChart({ zonas }: RadarChartProps) {
  const cx = 200;
  const cy = 200;
  const maxR = 140;
  const n = RADAR_AXES.length;
  const angles = RADAR_AXES.map((_, i) => (360 / n) * i);

  // Grid circles
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const gridCircles = gridLevels.map((level, gi) => {
    const pts = angles.map((a) => {
      const [x, y] = polarToXY(a, maxR * level, cx, cy);
      return `${x},${y}`;
    });
    return (
      <polygon
        key={gi}
        points={pts.join(" ")}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />
    );
  });

  // Axis lines
  const axisLines = angles.map((a, i) => {
    const [x, y] = polarToXY(a, maxR, cx, cy);
    return (
      <line
        key={i}
        x1={cx}
        y1={cy}
        x2={x}
        y2={y}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />
    );
  });

  // Labels
  const axisLabels = RADAR_AXES.map((axis, i) => {
    const [x, y] = polarToXY(angles[i], maxR + 22, cx, cy);
    return (
      <text
        key={axis}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.7)"
        fontSize={11}
        fontFamily="Inter, sans-serif"
      >
        {RADAR_LABELS[axis]}
      </text>
    );
  });

  // Zona polygons
  const zonaPolygons = zonas.map((zona, zi) => {
    const pts = RADAR_AXES.map((axis, i) => {
      const raw = zona.valores[axis] ?? 0; // -100 to 100
      const normalized = (raw + 100) / 200; // 0 to 1
      const [x, y] = polarToXY(angles[i], maxR * normalized, cx, cy);
      return `${x},${y}`;
    });
    return (
      <polygon
        key={zi}
        points={pts.join(" ")}
        fill={ZONA_COLORS[zi % ZONA_COLORS.length] + "33"}
        stroke={ZONA_COLORS[zi % ZONA_COLORS.length]}
        strokeWidth={1.5}
        opacity={0.85}
      />
    );
  });

  return (
    <svg width={400} height={400} viewBox="0 0 400 400" style={{ maxWidth: "100%" }}>
      {gridCircles}
      {axisLines}
      {zonaPolygons}
      {axisLabels}
    </svg>
  );
}

// ── Waterfall SVG ──────────────────────────────────────────────────────────────

interface WaterfallBar {
  label: string;
  value: number;   // USD contribution or absolute
  isBase: boolean;
  isFinal: boolean;
}

interface WaterfallChartProps {
  bars: WaterfallBar[];
  baseValue: number;
  finalValue: number;
}

function WaterfallChart({ bars, baseValue, finalValue }: WaterfallChartProps) {
  const W = 600;
  const H = 300;
  const padL = 60;
  const padR = 20;
  const padT = 30;
  const padB = 60;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allValues = bars.map((b) => b.value);
  const maxAbsVal = Math.max(Math.abs(baseValue), Math.abs(finalValue), ...allValues.map(Math.abs));
  const scale = chartH / (maxAbsVal * 2.2);

  const barW = Math.min(40, (chartW / bars.length) * 0.6);
  const spacing = chartW / bars.length;
  const baseline = padT + chartH / 2;

  // running total for intermediate bars
  let running = baseValue;

  const rects = bars.map((bar, i) => {
    const x = padL + i * spacing + spacing / 2 - barW / 2;
    let color: string;
    let rectY: number;
    let rectH: number;

    if (bar.isBase || bar.isFinal) {
      color = bar.isFinal ? (finalValue >= baseValue ? "#22c55e" : "#cc0000") : "#4b5563";
      const h = Math.abs(bar.value * scale);
      rectY = bar.value >= 0 ? baseline - h : baseline;
      rectH = h;
    } else {
      color = bar.value >= 0 ? "#22c55e" : "#cc0000";
      const top = running;
      const bottom = running + bar.value;
      const yTop = baseline - top * scale;
      const yBottom = baseline - bottom * scale;
      rectY = Math.min(yTop, yBottom);
      rectH = Math.abs(yTop - yBottom);
      running += bar.value;
    }

    const labelY = rectY - 5;
    const valLabel =
      bar.isBase || bar.isFinal
        ? `$${fmt(bar.value)}`
        : fmtSign(bar.value) + " USD";

    return (
      <g key={i}>
        <rect x={x} y={rectY} width={barW} height={Math.max(rectH, 1)} fill={color} rx={2} />
        <text
          x={x + barW / 2}
          y={labelY}
          textAnchor="middle"
          fill="rgba(255,255,255,0.85)"
          fontSize={9}
          fontFamily="Inter, sans-serif"
        >
          {valLabel}
        </text>
        <text
          x={x + barW / 2}
          y={padT + chartH + 14}
          textAnchor="middle"
          fill="rgba(255,255,255,0.5)"
          fontSize={8}
          fontFamily="Inter, sans-serif"
        >
          {bar.label.length > 10 ? bar.label.slice(0, 9) + "…" : bar.label}
        </text>
      </g>
    );
  });

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ maxWidth: "100%", display: "block" }}
    >
      {/* Baseline */}
      <line
        x1={padL}
        y1={baseline}
        x2={W - padR}
        y2={baseline}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
        strokeDasharray="4,4"
      />
      {/* Y-axis label */}
      <text
        x={padL - 8}
        y={baseline}
        textAnchor="end"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.4)"
        fontSize={9}
        fontFamily="Inter, sans-serif"
      >
        $0
      </text>
      {rects}
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type TabId = "factores" | "resultado" | "comparativa";

export default function PlusvaliaUrbanaPage() {
  const [activeTab, setActiveTab] = useState<TabId>("factores");
  const [valorBase, setValorBase] = useState<number>(80000);
  const [superficieM2, setSuperficieM2] = useState<number>(60);
  const [tipoCambio, setTipoCambio] = useState<number>(1300);
  const [factorValues, setFactorValues] = useState<Record<string, number>>(
    Object.fromEntries(FACTORES_BASE.map((f) => [f.id, 0]))
  );

  const factoresConValores: FactorPlusvalía[] = FACTORES_BASE.map((f) => ({
    ...f,
    valor: factorValues[f.id] ?? 0,
  }));

  const setFactorValue = (id: string, v: number) => {
    setFactorValues((prev) => ({ ...prev, [id]: v }));
  };

  const resetAll = () => {
    setFactorValues(Object.fromEntries(FACTORES_BASE.map((f) => [f.id, 0])));
  };

  const applyZona = (zona: ZonaPreset) => {
    setFactorValues({ ...zona.valores });
    setActiveTab("factores");
  };

  // ── Core calculation ─────────────────────────────────────────────────────────

  const calcs = useMemo(() => {
    const plusvaliaTotalPct = factoresConValores.reduce((acc, f) => {
      return acc + (f.valor / 100) * f.peso * 30;
    }, 0);

    const valorAjustado = valorBase * (1 + plusvaliaTotalPct / 100);
    const plusvaliaUSD = valorAjustado - valorBase;
    const precioM2Base = superficieM2 > 0 ? valorBase / superficieM2 : 0;
    const precioM2Ajustado = superficieM2 > 0 ? valorAjustado / superficieM2 : 0;

    const contribucionesUSD = factoresConValores.map((f) => {
      const pct = (f.valor / 100) * f.peso * 30;
      return { ...f, contribucionPct: pct, contribucionUSD: valorBase * (pct / 100) };
    });

    // Waterfall bars
    const waterfallBars: WaterfallBar[] = [
      { label: "Valor base", value: valorBase, isBase: true, isFinal: false },
      ...contribucionesUSD
        .filter((f) => f.valor !== 0)
        .map((f) => ({
          label: f.label,
          value: f.contribucionUSD,
          isBase: false,
          isFinal: false,
        })),
      { label: "Valor ajustado", value: valorAjustado, isBase: false, isFinal: true },
    ];

    return {
      plusvaliaTotalPct,
      valorAjustado,
      plusvaliaUSD,
      precioM2Base,
      precioM2Ajustado,
      contribucionesUSD,
      waterfallBars,
    };
  }, [factoresConValores, valorBase, superficieM2]);

  // ── Zona calcs ───────────────────────────────────────────────────────────────

  const zonaCalcs = useMemo(() => {
    return ZONAS.map((zona) => {
      const pct = FACTORES_BASE.reduce((acc, f) => {
        const v = zona.valores[f.id] ?? 0;
        return acc + (v / 100) * f.peso * 30;
      }, 0);
      const adj = valorBase * (1 + pct / 100);
      const pm2 = superficieM2 > 0 ? adj / superficieM2 : 0;
      return { ...zona, pct, adj, pm2 };
    });
  }, [valorBase, superficieM2]);

  // ── Styles ───────────────────────────────────────────────────────────────────

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "Inter, sans-serif",
      padding: "24px 16px 48px",
    } as React.CSSProperties,

    maxW: {
      maxWidth: 960,
      margin: "0 auto",
    } as React.CSSProperties,

    heading: {
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 800,
      fontSize: 28,
      color: "#fff",
      margin: "0 0 6px",
      letterSpacing: "-0.5px",
    } as React.CSSProperties,

    subheading: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 14,
      margin: "0 0 28px",
    } as React.CSSProperties,

    tabBar: {
      display: "flex",
      gap: 8,
      marginBottom: 28,
      flexWrap: "wrap" as const,
    } as React.CSSProperties,

    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "20px 24px",
    } as React.CSSProperties,

    input: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      color: "#fff",
      fontFamily: "Inter, sans-serif",
      fontSize: 15,
      padding: "10px 14px",
      width: "100%",
      boxSizing: "border-box" as const,
      outline: "none",
    } as React.CSSProperties,

    label: {
      fontSize: 12,
      color: "rgba(255,255,255,0.5)",
      marginBottom: 6,
      display: "block",
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
    } as React.CSSProperties,

    sectionTitle: {
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 700,
      fontSize: 14,
      color: "rgba(255,255,255,0.7)",
      margin: "0 0 16px",
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
    } as React.CSSProperties,
  };

  const tabBtn = (id: TabId, label: string) => ({
    style: {
      padding: "9px 20px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      fontWeight: 600,
      background: activeTab === id ? "#cc0000" : "rgba(255,255,255,0.07)",
      color: activeTab === id ? "#fff" : "rgba(255,255,255,0.6)",
      transition: "all 0.15s",
    } as React.CSSProperties,
    onClick: () => setActiveTab(id),
    children: label,
  });

  // ── Slider color ─────────────────────────────────────────────────────────────

  const sliderTrackColor = (v: number): string => {
    if (v > 0) return "#22c55e";
    if (v < 0) return "#cc0000";
    return "#4b5563";
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.maxW}>
        {/* Header */}
        <h1 style={s.heading}>Plusvalía Urbana</h1>
        <p style={s.subheading}>
          Estimá cuánto vale más (o menos) una propiedad según los factores urbanos de su entorno
        </p>

        {/* Tabs */}
        <div style={s.tabBar}>
          <button {...tabBtn("factores", "📊 Factores")} />
          <button {...tabBtn("resultado", "📈 Resultado")} />
          <button {...tabBtn("comparativa", "🗺️ Comparativa de zonas")} />
        </div>

        {/* ─── Tab 1: Factores ──────────────────────────────────────────────── */}
        {activeTab === "factores" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
            {/* Left panel — base inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={s.card}>
                <p style={s.sectionTitle}>Propiedad base</p>

                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Valor actual (USD)</label>
                  <input
                    type="number"
                    value={valorBase}
                    onChange={(e) => setValorBase(Number(e.target.value))}
                    style={s.input}
                    min={0}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Superficie (m²)</label>
                  <input
                    type="number"
                    value={superficieM2}
                    onChange={(e) => setSuperficieM2(Number(e.target.value))}
                    style={s.input}
                    min={1}
                  />
                </div>

                <div>
                  <label style={s.label}>Tipo de cambio (ARS/USD)</label>
                  <input
                    type="number"
                    value={tipoCambio}
                    onChange={(e) => setTipoCambio(Number(e.target.value))}
                    style={s.input}
                    min={1}
                  />
                </div>
              </div>

              {/* Quick result preview */}
              <div
                style={{
                  ...s.card,
                  borderColor:
                    calcs.plusvaliaTotalPct > 0
                      ? "rgba(34,197,94,0.3)"
                      : calcs.plusvaliaTotalPct < 0
                      ? "rgba(204,0,0,0.3)"
                      : "rgba(255,255,255,0.08)",
                }}
              >
                <p style={s.sectionTitle}>Preview</p>
                <div style={{ fontSize: 28, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: calcs.plusvaliaTotalPct >= 0 ? "#22c55e" : "#cc0000" }}>
                  {fmtSign(calcs.plusvaliaTotalPct, 1)}%
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                  USD {fmt(calcs.valorAjustado)}
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={resetAll}
                style={{
                  background: "rgba(204,0,0,0.15)",
                  border: "1px solid rgba(204,0,0,0.3)",
                  borderRadius: 8,
                  color: "#cc0000",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px 16px",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Resetear todos
              </button>
            </div>

            {/* Right panel — factors */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Factores de entorno</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {factoresConValores.map((f) => {
                  const contrib = (f.valor / 100) * f.peso * 30;
                  return (
                    <div key={f.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 16, marginRight: 8 }}>{f.icon}</span>
                          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#fff" }}>
                            {f.label}
                          </span>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                            {f.descripcion}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              fontFamily: "Montserrat, sans-serif",
                              color: f.valor > 0 ? "#22c55e" : f.valor < 0 ? "#cc0000" : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {f.valor >= 0 ? "+" : ""}{f.valor}%
                          </span>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                            {contrib >= 0 ? "+" : ""}{fmt(contrib, 1)} pts
                          </div>
                        </div>
                      </div>
                      <div style={{ position: "relative" }}>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={5}
                          value={f.valor}
                          onChange={(e) => setFactorValue(f.id, Number(e.target.value))}
                          style={{
                            width: "100%",
                            cursor: "pointer",
                            accentColor: sliderTrackColor(f.valor),
                            height: 6,
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                        <span>-100%</span>
                        <span>0</span>
                        <span>+100%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── Tab 2: Resultado ─────────────────────────────────────────────── */}
        {activeTab === "resultado" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {/* Plusvalía total */}
              <div
                style={{
                  ...s.card,
                  borderColor:
                    calcs.plusvaliaTotalPct > 0
                      ? "rgba(34,197,94,0.3)"
                      : calcs.plusvaliaTotalPct < 0
                      ? "rgba(204,0,0,0.3)"
                      : "rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Plusvalía total
                </div>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 32,
                    color: calcs.plusvaliaTotalPct >= 0 ? "#22c55e" : "#cc0000",
                  }}
                >
                  {fmtSign(calcs.plusvaliaTotalPct, 1)}%
                </div>
              </div>

              {/* Valor ajustado */}
              <div style={s.card}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Valor ajustado
                </div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff" }}>
                  USD {fmt(calcs.valorAjustado)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  ARS {fmt(calcs.valorAjustado * tipoCambio)}
                </div>
              </div>

              {/* Diferencia */}
              <div style={s.card}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Diferencia
                </div>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 26,
                    color: calcs.plusvaliaUSD >= 0 ? "#22c55e" : "#cc0000",
                  }}
                >
                  {fmtSign(calcs.plusvaliaUSD)} USD
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  base: USD {fmt(valorBase)}
                </div>
              </div>

              {/* Precio/m² ajustado */}
              <div style={s.card}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Precio/m² ajustado
                </div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff" }}>
                  USD {fmt(calcs.precioM2Ajustado, 0)}/m²
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  base: USD {fmt(calcs.precioM2Base, 0)}/m²
                </div>
              </div>
            </div>

            {/* Waterfall */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Desglose por factor (Waterfall)</p>
              {calcs.waterfallBars.length <= 2 ? (
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "20px 0" }}>
                  Ajustá al menos un factor en la pestaña de Factores para ver el waterfall.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <WaterfallChart
                    bars={calcs.waterfallBars}
                    baseValue={valorBase}
                    finalValue={calcs.valorAjustado}
                  />
                </div>
              )}
            </div>

            {/* Table */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Contribución por factor</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["Factor", "Slider", "Peso", "Contribución %", "Contribución USD"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "8px 12px",
                            color: "rgba(255,255,255,0.45)",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calcs.contribucionesUSD.map((f) => (
                      <tr
                        key={f.id}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <td style={{ padding: "10px 12px", color: "#fff" }}>
                          <span style={{ marginRight: 6 }}>{f.icon}</span>
                          {f.label}
                        </td>
                        <td style={{ padding: "10px 12px", color: f.valor > 0 ? "#22c55e" : f.valor < 0 ? "#cc0000" : "rgba(255,255,255,0.4)" }}>
                          {f.valor >= 0 ? "+" : ""}{f.valor}%
                        </td>
                        <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.5)" }}>
                          {(f.peso * 100).toFixed(0)}%
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            color: f.contribucionPct > 0 ? "#22c55e" : f.contribucionPct < 0 ? "#cc0000" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {fmtSign(f.contribucionPct, 2)}%
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color: f.contribucionUSD > 0 ? "#22c55e" : f.contribucionUSD < 0 ? "#cc0000" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {fmtSign(f.contribucionUSD)} USD
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)" }}>
                      <td colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: "Montserrat, sans-serif" }}>
                        TOTAL
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontWeight: 800,
                          fontFamily: "Montserrat, sans-serif",
                          color: calcs.plusvaliaTotalPct >= 0 ? "#22c55e" : "#cc0000",
                        }}
                      >
                        {fmtSign(calcs.plusvaliaTotalPct, 2)}%
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontWeight: 800,
                          fontFamily: "Montserrat, sans-serif",
                          color: calcs.plusvaliaUSD >= 0 ? "#22c55e" : "#cc0000",
                        }}
                      >
                        {fmtSign(calcs.plusvaliaUSD)} USD
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── Tab 3: Comparativa de zonas ──────────────────────────────────── */}
        {activeTab === "comparativa" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Comparison table */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Comparativa de zonas predefinidas</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      {["Zona", "Descripción", "Plusvalía %", "Valor ajustado", "Precio/m²", ""].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "8px 14px",
                            color: "rgba(255,255,255,0.45)",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zonaCalcs.map((z, zi) => (
                      <tr
                        key={z.nombre}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <td style={{ padding: "12px 14px" }}>
                          <div
                            style={{
                              display: "inline-block",
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: ZONA_COLORS[zi % ZONA_COLORS.length],
                              marginRight: 8,
                              verticalAlign: "middle",
                            }}
                          />
                          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>
                            {z.nombre}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                          {z.descripcion}
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 800,
                            color: z.pct >= 0 ? "#22c55e" : "#cc0000",
                          }}
                        >
                          {fmtSign(z.pct, 1)}%
                        </td>
                        <td style={{ padding: "12px 14px", color: "#fff", fontWeight: 600 }}>
                          USD {fmt(z.adj)}
                        </td>
                        <td style={{ padding: "12px 14px", color: "rgba(255,255,255,0.7)" }}>
                          USD {fmt(z.pm2, 0)}/m²
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <button
                            onClick={() => applyZona(ZONAS[zi])}
                            style={{
                              background: "rgba(204,0,0,0.15)",
                              border: "1px solid rgba(204,0,0,0.4)",
                              borderRadius: 6,
                              color: "#cc0000",
                              fontFamily: "Inter, sans-serif",
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "5px 12px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Aplicar zona
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Radar chart */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Radar comparativo (5 ejes principales)</p>
              <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
                <RadarChart zonas={ZONAS} />

                {/* Legend */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16 }}>
                  {ZONAS.map((z, zi) => (
                    <div key={z.nombre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          background: ZONA_COLORS[zi % ZONA_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#fff" }}>
                          {z.nombre}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                          {z.descripcion}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.3)", maxWidth: 200 }}>
                    Los ejes representan valores de -100 a +100 normalizados al radio.
                  </div>
                </div>
              </div>
            </div>

            {/* Factor detail per zone */}
            <div style={s.card}>
              <p style={s.sectionTitle}>Detalle de factores por zona</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "rgba(255,255,255,0.45)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>
                        Factor
                      </th>
                      {ZONAS.map((z, zi) => (
                        <th
                          key={z.nombre}
                          style={{
                            textAlign: "right",
                            padding: "8px 12px",
                            color: ZONA_COLORS[zi % ZONA_COLORS.length],
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          {z.nombre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FACTORES_BASE.map((f) => (
                      <tr key={f.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "8px 12px", color: "rgba(255,255,255,0.8)" }}>
                          <span style={{ marginRight: 6 }}>{f.icon}</span>
                          {f.label}
                        </td>
                        {ZONAS.map((z, zi) => {
                          const v = z.valores[f.id] ?? 0;
                          return (
                            <td
                              key={zi}
                              style={{
                                padding: "8px 12px",
                                textAlign: "right",
                                fontWeight: 600,
                                color: v > 0 ? "#22c55e" : v < 0 ? "#cc0000" : "rgba(255,255,255,0.3)",
                              }}
                            >
                              {v >= 0 ? "+" : ""}{v}%
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
