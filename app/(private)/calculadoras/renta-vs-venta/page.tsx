"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface AnioData {
  anio: number;
  capitalPF: number;
  alquileresAcum: number;
  valorProp: number;
  totalAlquilerProp: number;
}

interface SensibilidadRow {
  horizonte: number;
  capitalPF: number;
  totalAlquilerProp: number;
  ganador: "alquilar" | "vender";
  diferenciaPct: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
const fmtUSD = (n: number) => `USD ${fmt(Math.round(n))}`;
const fmtARS = (n: number) => `$ ${fmt(Math.round(n))}`;

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#fff",
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
  display: "block",
};

const cardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 10,
  padding: "16px 20px",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 11,
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

// ── Core calculation ──────────────────────────────────────────────────────────

function calcularEscenarios(
  valorActualUSD: number,
  tipoCambio: number,
  alquilerMensualARS: number,
  gastosAnualesARS: number,
  ajusteAlquilerAnual: number,
  apreciacionAnual: number,
  inflacionAnual: number,
  horizonte: number,
  gastosVentaActual: number,
  gastosVentaFuturo: number,
  tasaReinversion: number,
) {
  // ── Opción A: Vender ahora ──────────────────────────────────────────────
  const neteVentaHoy = valorActualUSD * (1 - gastosVentaActual / 100);
  const neteVentaHoyARS = neteVentaHoy * tipoCambio;
  const capitalFinalPF =
    neteVentaHoyARS * Math.pow(1 + tasaReinversion / 100, horizonte);
  const capitalFinalPF_real =
    capitalFinalPF / Math.pow(1 + inflacionAnual / 100, horizonte);
  const capitalFinalPF_USD = capitalFinalPF / tipoCambio;

  // ── Opción B: Mantener en alquiler y vender en año X ───────────────────
  let alquilerARS = alquilerMensualARS;
  let acumuladoAlquileresARS = 0;

  for (let a = 1; a <= horizonte; a++) {
    const ingresoBruto = alquilerARS * 12;
    const ingresoNeto = ingresoBruto - gastosAnualesARS;
    acumuladoAlquileresARS += ingresoNeto;
    alquilerARS *= 1 + ajusteAlquilerAnual / 100;
  }

  const valorFuturoUSD =
    valorActualUSD * Math.pow(1 + apreciacionAnual / 100, horizonte);
  const neteVentaFuturaUSD = valorFuturoUSD * (1 - gastosVentaFuturo / 100);
  const neteVentaFuturaARS = neteVentaFuturaUSD * tipoCambio;
  const totalAlquileresARS = acumuladoAlquileresARS;
  const totalFinalB_ARS = neteVentaFuturaARS + totalAlquileresARS;
  const totalFinalB_USD = totalFinalB_ARS / tipoCambio;
  const totalFinalB_real =
    totalFinalB_ARS / Math.pow(1 + inflacionAnual / 100, horizonte);

  // ── Comparación ─────────────────────────────────────────────────────────
  const diferencia_ARS = totalFinalB_ARS - capitalFinalPF;
  const diferencia_USD = totalFinalB_USD - capitalFinalPF_USD;
  const ganador: "alquilar" | "vender" =
    diferencia_ARS > 0 ? "alquilar" : "vender";
  const ventajaPct =
    (Math.abs(diferencia_ARS) /
      Math.min(totalFinalB_ARS, capitalFinalPF)) *
    100;

  // ── Año a año para chart ─────────────────────────────────────────────────
  const anioData: AnioData[] = [];
  let alqARS2 = alquilerMensualARS;
  let acumAlq = 0;

  for (let a = 0; a <= horizonte; a++) {
    if (a === 0) {
      anioData.push({
        anio: 0,
        capitalPF: neteVentaHoyARS,
        alquileresAcum: 0,
        valorProp: valorActualUSD,
        totalAlquilerProp: valorActualUSD * tipoCambio,
      });
    } else {
      const ingBruto = alqARS2 * 12;
      const ingNeto = ingBruto - gastosAnualesARS;
      acumAlq += ingNeto;
      alqARS2 *= 1 + ajusteAlquilerAnual / 100;

      const capPF =
        neteVentaHoyARS * Math.pow(1 + tasaReinversion / 100, a);
      const valProp =
        valorActualUSD * Math.pow(1 + apreciacionAnual / 100, a);
      const ventaNetaUSD = valProp * (1 - gastosVentaFuturo / 100);
      const totalB = ventaNetaUSD * tipoCambio + acumAlq;

      anioData.push({
        anio: a,
        capitalPF: capPF,
        alquileresAcum: acumAlq,
        valorProp: valProp,
        totalAlquilerProp: totalB,
      });
    }
  }

  // ── Punto de equilibrio ──────────────────────────────────────────────────
  let breakEven: number | null = null;
  for (let a = 1; a <= horizonte; a++) {
    const row = anioData[a];
    if (row && row.totalAlquilerProp > row.capitalPF && breakEven === null) {
      breakEven = a;
    }
  }

  return {
    neteVentaHoy,
    neteVentaHoyARS,
    capitalFinalPF,
    capitalFinalPF_real,
    capitalFinalPF_USD,
    valorFuturoUSD,
    neteVentaFuturaUSD,
    totalAlquileresARS,
    totalFinalB_ARS,
    totalFinalB_USD,
    totalFinalB_real,
    diferencia_ARS,
    diferencia_USD,
    ganador,
    ventajaPct,
    anioData,
    breakEven,
  };
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function LineChart({
  data,
  horizonte,
}: {
  data: AnioData[];
  horizonte: number;
}) {
  const svgW = 860;
  const svgH = 280;
  const padL = 80;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const innerW = svgW - padL - padR;
  const innerH = svgH - padT - padB;

  const allVals = data.flatMap((d) => [
    d.capitalPF,
    d.totalAlquilerProp,
    d.valorProp * (data[0]?.capitalPF
      ? data[0].capitalPF / (data[0]?.valorProp || 1)
      : 1),
  ]);

  const maxVal = Math.max(...data.map((d) => Math.max(d.capitalPF, d.totalAlquilerProp)), 1);
  const minVal = 0;

  const xScale = (i: number) =>
    padL + (i / Math.max(horizonte, 1)) * innerW;
  const yScale = (v: number) =>
    padT + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;

  const makePath = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`)
      .join(" ");

  const pfPath = makePath(data.map((d) => d.capitalPF));
  const totalPath = makePath(data.map((d) => d.totalAlquilerProp));
  const propPath = makePath(
    data.map((d) => d.valorProp * (data[0]
      ? data[0].capitalPF / (data[0].valorProp || 1)
      : 1)),
  );

  // Y axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    minVal + (maxVal - minVal) * (i / tickCount),
  );

  // Punto de equilibrio
  let crossX: number | null = null;
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    if (!prev || !curr) continue;
    const prevDiff = prev.totalAlquilerProp - prev.capitalPF;
    const currDiff = curr.totalAlquilerProp - curr.capitalPF;
    if (prevDiff * currDiff < 0) {
      const t = prevDiff / (prevDiff - currDiff);
      crossX = xScale(i - 1 + t);
      break;
    }
  }

  void allVals;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ overflow: "visible" }}
    >
      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={padL}
            y1={yScale(tick)}
            x2={svgW - padR}
            y2={yScale(tick)}
            stroke="#1e1e1e"
            strokeWidth={1}
          />
          <text
            x={padL - 8}
            y={yScale(tick) + 4}
            fill="#555"
            fontSize={10}
            textAnchor="end"
          >
            {tick >= 1e9
              ? `${(tick / 1e9).toFixed(1)}B`
              : tick >= 1e6
              ? `${(tick / 1e6).toFixed(0)}M`
              : `${(tick / 1e3).toFixed(0)}k`}
          </text>
        </g>
      ))}

      {/* X axis ticks */}
      {data.map((d) => (
        <text
          key={d.anio}
          x={xScale(d.anio)}
          y={padT + innerH + 20}
          fill="#555"
          fontSize={10}
          textAnchor="middle"
        >
          {d.anio}
        </text>
      ))}

      {/* Axis labels */}
      <text
        x={padL + innerW / 2}
        y={svgH - 2}
        fill="#666"
        fontSize={10}
        textAnchor="middle"
      >
        Años
      </text>

      {/* Lines */}
      <path
        d={propPath}
        fill="none"
        stroke="#f97316"
        strokeWidth={2}
        strokeDasharray="6 3"
      />
      <path d={pfPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
      <path d={totalPath} fill="none" stroke="#cc0000" strokeWidth={2.5} />

      {/* Cross point */}
      {crossX !== null && (
        <line
          x1={crossX}
          y1={padT}
          x2={crossX}
          y2={padT + innerH}
          stroke="#ffffff33"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}

      {/* Dots at end */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        if (!last) return null;
        return (
          <>
            <circle cx={xScale(last.anio)} cy={yScale(last.capitalPF)} r={4} fill="#3b82f6" />
            <circle cx={xScale(last.anio)} cy={yScale(last.totalAlquilerProp)} r={4} fill="#cc0000" />
          </>
        );
      })()}
    </svg>
  );
}

// ── SVG Sensitivity Bar Chart ─────────────────────────────────────────────────

function SensitividadChart({ rows }: { rows: SensibilidadRow[] }) {
  const svgW = 860;
  const barH = 22;
  const gap = 8;
  const padL = 60;
  const padR = 20;
  const padT = 10;
  const totalH = padT + rows.length * (barH * 2 + gap + 8) + 20;

  const maxVal = Math.max(...rows.flatMap((r) => [r.capitalPF, r.totalAlquilerProp]), 1);

  const innerW = svgW - padL - padR;

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${totalH}`} style={{ overflow: "visible" }}>
      {rows.map((row, i) => {
        const y = padT + i * (barH * 2 + gap + 8);
        const wPF = (row.capitalPF / maxVal) * innerW;
        const wAlq = (row.totalAlquilerProp / maxVal) * innerW;
        const cambio =
          i > 0 && rows[i - 1]
            ? rows[i - 1]!.ganador !== row.ganador
            : false;

        return (
          <g key={row.horizonte}>
            {cambio && (
              <line
                x1={0}
                y1={y - 4}
                x2={svgW}
                y2={y - 4}
                stroke="#ffffff22"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}
            <text x={padL - 8} y={y + barH / 2 + 4} fill="#888" fontSize={11} textAnchor="end">
              {`Año ${row.horizonte}`}
            </text>

            {/* PF bar */}
            <rect x={padL} y={y} width={Math.max(wPF, 2)} height={barH} fill="#3b82f6" rx={3} opacity={0.85} />
            <text x={padL + Math.max(wPF, 2) + 4} y={y + barH / 2 + 4} fill="#3b82f6" fontSize={10}>
              {`$${(row.capitalPF / 1e6).toFixed(0)}M`}
            </text>

            {/* Alquiler bar */}
            <rect x={padL} y={y + barH + 3} width={Math.max(wAlq, 2)} height={barH} fill="#cc0000" rx={3} opacity={0.85} />
            <text x={padL + Math.max(wAlq, 2) + 4} y={y + barH * 2 + 3 + 4} fill="#cc0000" fontSize={10}>
              {`$${(row.totalAlquilerProp / 1e6).toFixed(0)}M`}
            </text>

            {/* Ganador badge */}
            {row.ganador === "alquilar" ? (
              <text x={svgW - padR} y={y + barH + 8} fill="#cc0000" fontSize={9} textAnchor="end" fontWeight={700}>
                ▲ ALQ +{row.diferenciaPct.toFixed(1)}%
              </text>
            ) : (
              <text x={svgW - padR} y={y + barH + 8} fill="#3b82f6" fontSize={9} textAnchor="end" fontWeight={700}>
                ▲ VTA +{row.diferenciaPct.toFixed(1)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RentaVsVenta() {
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);

  // Inputs
  const [valorActualUSD, setValorActualUSD] = useState(100000);
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [alquilerMensualARS, setAlquilerMensualARS] = useState(350000);
  const [gastosAnualesARS, setGastosAnualesARS] = useState(80000);
  const [ajusteAlquilerAnual, setAjusteAlquilerAnual] = useState(80);
  const [apreciacionAnual, setApreciacionAnual] = useState(3);
  const [inflacionAnual, setInflacionAnual] = useState(80);
  const [horizonte, setHorizonte] = useState(5);
  const [gastosVentaActual, setGastosVentaActual] = useState(6.5);
  const [gastosVentaFuturo, setGastosVentaFuturo] = useState(6.5);
  const [tasaReinversion, setTasaReinversion] = useState(55);

  const r = useMemo(
    () =>
      calcularEscenarios(
        valorActualUSD,
        tipoCambio,
        alquilerMensualARS,
        gastosAnualesARS,
        ajusteAlquilerAnual,
        apreciacionAnual,
        inflacionAnual,
        horizonte,
        gastosVentaActual,
        gastosVentaFuturo,
        tasaReinversion,
      ),
    [
      valorActualUSD,
      tipoCambio,
      alquilerMensualARS,
      gastosAnualesARS,
      ajusteAlquilerAnual,
      apreciacionAnual,
      inflacionAnual,
      horizonte,
      gastosVentaActual,
      gastosVentaFuturo,
      tasaReinversion,
    ],
  );

  // Sensitivity: horizonte 1..10
  const sensibilidad = useMemo<SensibilidadRow[]>(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const h = i + 1;
      const s = calcularEscenarios(
        valorActualUSD,
        tipoCambio,
        alquilerMensualARS,
        gastosAnualesARS,
        ajusteAlquilerAnual,
        apreciacionAnual,
        inflacionAnual,
        h,
        gastosVentaActual,
        gastosVentaFuturo,
        tasaReinversion,
      );
      return {
        horizonte: h,
        capitalPF: s.capitalFinalPF,
        totalAlquilerProp: s.totalFinalB_ARS,
        ganador: s.ganador,
        diferenciaPct: s.ventajaPct,
      };
    });
  }, [
    valorActualUSD,
    tipoCambio,
    alquilerMensualARS,
    gastosAnualesARS,
    ajusteAlquilerAnual,
    apreciacionAnual,
    inflacionAnual,
    gastosVentaActual,
    gastosVentaFuturo,
    tasaReinversion,
  ]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    background: active ? "#cc0000" : "transparent",
    border: active ? "1px solid #cc0000" : "1px solid #333",
    borderRadius: 6,
    color: active ? "#fff" : "#888",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  });

  const fieldRow = (
    label: string,
    value: number,
    setter: (v: number) => void,
    step = 1,
    min?: number,
    max?: number,
  ) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => setter(Number(e.target.value))}
        style={inputStyle}
      />
    </div>
  );

  const kpiCard = (
    label: string,
    primary: string,
    secondary: string,
    accentColor: string,
  ) => (
    <div
      style={{
        ...cardStyle,
        border: `1px solid ${accentColor}33`,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#666",
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>
        {primary}
      </div>
      <div style={{ fontSize: 11, color: "#555" }}>{secondary}</div>
    </div>
  );

  const isAlquilar = r.ganador === "alquilar";
  const ganadorColor = isAlquilar ? "#cc0000" : "#3b82f6";
  const ganadorLabel = isAlquilar
    ? `Mantener en alquiler gana ${r.ventajaPct.toFixed(1)}%`
    : `Vender ahora gana ${r.ventajaPct.toFixed(1)}%`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#111",
          borderBottom: "1px solid #222",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/calculadoras"
          style={{ color: "#888", textDecoration: "none", fontSize: 13 }}
        >
          ← Calculadoras
        </Link>
        <div>
          <h1
            style={{
              margin: 0,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 28,
              color: "#fff",
            }}
          >
            ¿Alquilar o Vender?
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Calculadora comparativa: ¿conviene mantener en alquiler o vender la
            propiedad ahora?
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: "#0d0d0d",
          borderBottom: "1px solid #1a1a1a",
          padding: "12px 24px",
          display: "flex",
          gap: 8,
        }}
      >
        <button style={tabStyle(activeTab === 0)} onClick={() => setActiveTab(0)}>
          Inputs y resultado
        </button>
        <button style={tabStyle(activeTab === 1)} onClick={() => setActiveTab(1)}>
          Evolución año a año
        </button>
        <button style={tabStyle(activeTab === 2)} onClick={() => setActiveTab(2)}>
          Sensibilidad
        </button>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* ── TAB 0: Inputs + Resultado ─────────────────────────────────── */}
        {activeTab === 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "380px 1fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            {/* Left: Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={cardStyle}>
                <h2 style={{ ...sectionTitle, color: "#cc0000" }}>Propiedad</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {fieldRow("Valor actual (USD)", valorActualUSD, setValorActualUSD, 1000)}
                  {fieldRow("Tipo de cambio (ARS/USD)", tipoCambio, setTipoCambio, 10)}
                  {fieldRow("Gastos de venta actual (%)", gastosVentaActual, setGastosVentaActual, 0.1)}
                  {fieldRow("Gastos de venta futuro (%)", gastosVentaFuturo, setGastosVentaFuturo, 0.1)}
                  {fieldRow("Apreciación anual USD (%)", apreciacionAnual, setApreciacionAnual, 0.5)}
                </div>
              </div>

              <div style={cardStyle}>
                <h2 style={{ ...sectionTitle, color: "#f97316" }}>Alquiler</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {fieldRow("Alquiler mensual (ARS)", alquilerMensualARS, setAlquilerMensualARS, 5000)}
                  {fieldRow("Gastos anuales (ARS)", gastosAnualesARS, setGastosAnualesARS, 5000)}
                  {fieldRow("Ajuste anual ICL (%)", ajusteAlquilerAnual, setAjusteAlquilerAnual, 1)}
                </div>
              </div>

              <div style={cardStyle}>
                <h2 style={{ ...sectionTitle, color: "#3b82f6" }}>Horizonte y reinversión</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {fieldRow("Años antes de vender", horizonte, setHorizonte, 1, 1, 20)}
                  {fieldRow("Tasa reinversión TNA (%)", tasaReinversion, setTasaReinversion, 1)}
                  {fieldRow("Inflación anual (%)", inflacionAnual, setInflacionAnual, 1)}
                </div>
              </div>
            </div>

            {/* Right: Resultado */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Badge ganador */}
              <div
                style={{
                  background: `${ganadorColor}15`,
                  border: `2px solid ${ganadorColor}`,
                  borderRadius: 14,
                  padding: "24px 28px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 22,
                    color: ganadorColor,
                    marginBottom: 8,
                  }}
                >
                  {ganadorLabel}
                </div>
                <div style={{ fontSize: 13, color: "#999" }}>
                  {isAlquilar
                    ? `Mantener ${horizonte} año${horizonte !== 1 ? "s" : ""} y luego vender genera más patrimonio`
                    : `Vender hoy e invertir en plazo fijo genera más patrimonio`}
                  {r.breakEven !== null
                    ? ` · Punto de equilibrio: año ${r.breakEven}`
                    : ""}
                </div>
              </div>

              {/* 4 KPI cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {kpiCard(
                  "Vender hoy → PF final",
                  fmtUSD(r.capitalFinalPF_USD),
                  fmtARS(r.capitalFinalPF_real) + " reales",
                  "#3b82f6",
                )}
                {kpiCard(
                  `Mantener ${horizonte} año${horizonte !== 1 ? "s" : ""}`,
                  fmtUSD(r.totalFinalB_USD),
                  fmtARS(r.totalFinalB_real) + " reales",
                  "#cc0000",
                )}
                {kpiCard(
                  "Alquileres acumulados netos",
                  fmtARS(r.totalAlquileresARS),
                  `En ${horizonte} año${horizonte !== 1 ? "s" : ""}`,
                  "#f97316",
                )}
                {kpiCard(
                  "Ganancia de capital",
                  fmtUSD(r.valorFuturoUSD - valorActualUSD),
                  `${r.valorFuturoUSD > valorActualUSD ? "+" : ""}${(((r.valorFuturoUSD - valorActualUSD) / valorActualUSD) * 100).toFixed(1)}% en ${horizonte} años`,
                  "#a78bfa",
                )}
              </div>

              {/* Tabla comparativa */}
              <div style={cardStyle}>
                <h2 style={{ ...sectionTitle, color: "#fff" }}>
                  Comparación directa
                </h2>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          color: "#666",
                          fontWeight: 600,
                          borderBottom: "1px solid #222",
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          textTransform: "uppercase",
                        }}
                      >
                        Concepto
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          color: "#3b82f6",
                          fontWeight: 700,
                          borderBottom: "1px solid #222",
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          textTransform: "uppercase",
                        }}
                      >
                        Vender ahora
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          color: "#cc0000",
                          fontWeight: 700,
                          borderBottom: "1px solid #222",
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          textTransform: "uppercase",
                        }}
                      >
                        Mantener {horizonte} años
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: "Valor neto de venta",
                        a: fmtUSD(r.neteVentaHoy),
                        b: fmtUSD(r.neteVentaFuturaUSD),
                      },
                      {
                        label: "Ingresos adicionales",
                        a: `PF ${fmtARS(r.capitalFinalPF - r.neteVentaHoyARS)}`,
                        b: `Alq. ${fmtARS(r.totalAlquileresARS)}`,
                      },
                      {
                        label: "Total (USD equiv.)",
                        a: fmtUSD(r.capitalFinalPF_USD),
                        b: fmtUSD(r.totalFinalB_USD),
                      },
                      {
                        label: "En ARS reales",
                        a: fmtARS(r.capitalFinalPF_real),
                        b: fmtARS(r.totalFinalB_real),
                      },
                    ].map((row, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: "1px solid #1a1a1a" }}
                      >
                        <td
                          style={{
                            padding: "10px 12px",
                            color: "#999",
                            fontSize: 12,
                          }}
                        >
                          {row.label}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "right",
                            color:
                              i === 2 || i === 3
                                ? isAlquilar
                                  ? "#666"
                                  : "#3b82f6"
                                : "#ccc",
                            fontWeight: i === 2 || i === 3 ? 700 : 400,
                          }}
                        >
                          {row.a}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            textAlign: "right",
                            color:
                              i === 2 || i === 3
                                ? isAlquilar
                                  ? "#cc0000"
                                  : "#666"
                                : "#ccc",
                            fontWeight: i === 2 || i === 3 ? 700 : 400,
                          }}
                        >
                          {row.b}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Disclaimer */}
              <div
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 11,
                  color: "#555",
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: "#666" }}>Supuestos:</strong> El
                escenario &ldquo;Vender ahora&rdquo; reinvierte el neto de venta en
                plazo fijo al {tasaReinversion}% TNA durante {horizonte} años.
                El escenario &ldquo;Mantener&rdquo; asume ajuste ICL del{" "}
                {ajusteAlquilerAnual}% anual sobre el alquiler y apreciación del{" "}
                {apreciacionAnual}% anual en USD. No incluye impacto fiscal.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 1: Evolución año a año ───────────────────────────────── */}
        {activeTab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={cardStyle}>
              <h2
                style={{
                  ...sectionTitle,
                  color: "#fff",
                  marginBottom: 16,
                }}
              >
                Evolución del capital a {horizonte} años (ARS)
              </h2>

              <LineChart data={r.anioData} horizonte={horizonte} />

              {/* Legend */}
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                {[
                  { color: "#3b82f6", label: "Capital reinvertido en PF", dashed: false },
                  { color: "#cc0000", label: `Capital total alquiler + prop.`, dashed: false },
                  { color: "#f97316", label: "Valor de la propiedad (escala ARS)", dashed: true },
                ].map((l) => (
                  <div
                    key={l.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      color: "#888",
                    }}
                  >
                    <svg width={28} height={3}>
                      <line
                        x1={0}
                        y1={1.5}
                        x2={28}
                        y2={1.5}
                        stroke={l.color}
                        strokeWidth={2.5}
                        strokeDasharray={l.dashed ? "5 3" : undefined}
                      />
                    </svg>
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Tabla año a año */}
            <div style={cardStyle}>
              <h2 style={{ ...sectionTitle, color: "#fff" }}>
                Detalle por año
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Año",
                        "Capital PF (ARS)",
                        "Alquileres acum. (ARS)",
                        "Valor prop. (USD)",
                        "Total alquiler+prop (ARS)",
                        "Diferencia (ARS)",
                      ].map((h, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "8px 12px",
                            textAlign: i === 0 ? "center" : "right",
                            color: "#666",
                            fontWeight: 700,
                            borderBottom: "1px solid #222",
                            fontSize: 10,
                            fontFamily: "Montserrat, sans-serif",
                            textTransform: "uppercase",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.anioData.map((d) => {
                      const diff = d.totalAlquilerProp - d.capitalPF;
                      const diffColor =
                        diff > 0 ? "#cc0000" : diff < 0 ? "#3b82f6" : "#888";
                      return (
                        <tr
                          key={d.anio}
                          style={{ borderBottom: "1px solid #1a1a1a" }}
                        >
                          <td
                            style={{
                              padding: "9px 12px",
                              textAlign: "center",
                              color: "#888",
                              fontWeight: 700,
                            }}
                          >
                            {d.anio}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              textAlign: "right",
                              color: "#3b82f6",
                            }}
                          >
                            {fmtARS(d.capitalPF)}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              textAlign: "right",
                              color: "#f97316",
                            }}
                          >
                            {fmtARS(d.alquileresAcum)}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              textAlign: "right",
                              color: "#a78bfa",
                            }}
                          >
                            {fmtUSD(d.valorProp)}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              textAlign: "right",
                              color: "#cc0000",
                            }}
                          >
                            {fmtARS(d.totalAlquilerProp)}
                          </td>
                          <td
                            style={{
                              padding: "9px 12px",
                              textAlign: "right",
                              color: diffColor,
                              fontWeight: 700,
                            }}
                          >
                            {diff > 0 ? "+" : ""}
                            {fmtARS(diff)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Sensibilidad ──────────────────────────────────────── */}
        {activeTab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={cardStyle}>
              <h2 style={{ ...sectionTitle, color: "#fff", marginBottom: 4 }}>
                Sensibilidad por horizonte de tiempo (1–10 años)
              </h2>
              <p style={{ fontSize: 12, color: "#666", margin: "0 0 20px" }}>
                Con los parámetros actuales, ¿qué opción conviene según cuántos
                años se mantiene la propiedad?
              </p>

              <SensitividadChart rows={sensibilidad} />

              {/* Legend */}
              <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
                {[
                  { color: "#3b82f6", label: "Vender ahora + PF" },
                  { color: "#cc0000", label: "Mantener en alquiler" },
                ].map((l) => (
                  <div
                    key={l.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      color: "#888",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 10,
                        background: l.color,
                        borderRadius: 2,
                        opacity: 0.85,
                      }}
                    />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Tabla sensibilidad */}
            <div style={cardStyle}>
              <h2 style={{ ...sectionTitle, color: "#fff" }}>
                Resumen por horizonte
              </h2>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Horizonte",
                      "PF final (ARS)",
                      "Alquiler+Prop (ARS)",
                      "Ganador",
                      "Ventaja",
                    ].map((h, i) => (
                      <th
                        key={i}
                        style={{
                          padding: "8px 12px",
                          textAlign: i <= 1 ? "center" : "right",
                          color: "#666",
                          fontWeight: 700,
                          borderBottom: "1px solid #222",
                          fontSize: 10,
                          fontFamily: "Montserrat, sans-serif",
                          textTransform: "uppercase",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensibilidad.map((row, i) => {
                    const prevRow = i > 0 ? sensibilidad[i - 1] : null;
                    const cambio =
                      prevRow !== undefined &&
                      prevRow !== null &&
                      prevRow.ganador !== row.ganador;
                    return (
                      <tr
                        key={row.horizonte}
                        style={{
                          borderBottom: "1px solid #1a1a1a",
                          background: cambio ? "#ffffff05" : "transparent",
                        }}
                      >
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "center",
                            color: "#888",
                            fontWeight: 700,
                          }}
                        >
                          {row.horizonte} año{row.horizonte !== 1 ? "s" : ""}
                          {cambio && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 9,
                                color: "#fff",
                                background: "#ffffff22",
                                padding: "1px 5px",
                                borderRadius: 3,
                              }}
                            >
                              CAMBIA
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            color: "#3b82f6",
                          }}
                        >
                          {fmtARS(row.capitalPF)}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            color: "#cc0000",
                          }}
                        >
                          {fmtARS(row.totalAlquilerProp)}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            color:
                              row.ganador === "alquilar" ? "#cc0000" : "#3b82f6",
                            fontWeight: 700,
                          }}
                        >
                          {row.ganador === "alquilar"
                            ? "Mantener"
                            : "Vender ahora"}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            color: "#888",
                          }}
                        >
                          +{row.diferenciaPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 12,
                color: "#555",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "#666" }}>Nota:</strong> El horizonte
              óptimo depende de tu situación fiscal y necesidades de liquidez.
              Este análisis es indicativo y no reemplaza el asesoramiento
              profesional.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
