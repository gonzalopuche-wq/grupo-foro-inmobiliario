"use client";

import { useState, useMemo } from "react";

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtUSD(v: number, decimals = 2): string {
  return (
    "USD " +
    v.toLocaleString("es-AR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

function fmtPct(v: number, decimals = 2): string {
  return (
    v.toLocaleString("es-AR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + "%"
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ConfigGlobal {
  capitalUSD: number;
  horizonteAnios: number;
  inflacionUSDPct: number;
}

interface ConfigInmueble {
  precioM2USD: number;
  m2: number;
  alquilerAnualPct: number;
  revalorizacionAnualPct: number;
}

interface ConfigPlazoFijoUSD {
  tasaAnualPct: number;
}

interface ConfigPlazoFijoARS {
  tnaPct: number;
  inflacionARSPct: number;
}

interface ConfigAcciones {
  retornoNominalPct: number;
  volatilidadPct: number;
}

interface ResultadoInversion {
  nombre: string;
  color: string;
  capitalInicial: number;
  valorFinal: number;
  gananciaTotal: number;
  cagr: number;
  retornoReal: number;
  rentaAcumulada: number;
  revalorizacion: number;
  evolucion: number[]; // valor en USD para cada año 0..horizonte
  // solo acciones
  valorFinalPesimista?: number;
  valorFinalOptimista?: number;
  evolucionPesimista?: number[];
  evolucionOptimista?: number[];
}

// ─── Calculations ──────────────────────────────────────────────────────────────

function calcularInmueble(
  cfg: ConfigGlobal,
  inv: ConfigInmueble
): ResultadoInversion {
  const capitalInicial = cfg.capitalUSD;
  const valorInmueble = inv.precioM2USD * inv.m2;
  // Si el capital es menor al valor del inmueble, la participación es proporcional
  const participacion = capitalInicial / valorInmueble;
  const anos = cfg.horizonteAnios;

  const evolucion: number[] = [];
  let rentaAcumulada = 0;

  for (let a = 0; a <= anos; a++) {
    const valorActivo = valorInmueble * Math.pow(1 + inv.revalorizacionAnualPct / 100, a);
    const valorPropio = valorActivo * participacion;
    const rentaAnio = a === 0 ? 0 : valorInmueble * participacion * (inv.alquilerAnualPct / 100);
    if (a > 0) rentaAcumulada += rentaAnio;
    evolucion.push(valorPropio + (a === 0 ? 0 : rentaAcumulada));
  }

  const valorFinal = evolucion[anos];
  const gananciaTotal = valorFinal - capitalInicial;
  const cagr = Math.pow(valorFinal / capitalInicial, 1 / anos) - 1;
  const retornoReal = (1 + cagr) / (1 + cfg.inflacionUSDPct / 100) - 1;
  const revalorizacion =
    valorInmueble * participacion * Math.pow(1 + inv.revalorizacionAnualPct / 100, anos) -
    capitalInicial;

  return {
    nombre: "Inmueble en alquiler",
    color: "#cc0000",
    capitalInicial,
    valorFinal,
    gananciaTotal,
    cagr: cagr * 100,
    retornoReal: retornoReal * 100,
    rentaAcumulada,
    revalorizacion,
    evolucion,
  };
}

function calcularPlazoFijoUSD(
  cfg: ConfigGlobal,
  inv: ConfigPlazoFijoUSD
): ResultadoInversion {
  const capitalInicial = cfg.capitalUSD;
  const anos = cfg.horizonteAnios;
  const evolucion: number[] = [];

  for (let a = 0; a <= anos; a++) {
    evolucion.push(capitalInicial * Math.pow(1 + inv.tasaAnualPct / 100, a));
  }

  const valorFinal = evolucion[anos];
  const gananciaTotal = valorFinal - capitalInicial;
  const cagr = Math.pow(valorFinal / capitalInicial, 1 / anos) - 1;
  const retornoReal = (1 + cagr) / (1 + cfg.inflacionUSDPct / 100) - 1;

  return {
    nombre: "Plazo fijo USD",
    color: "#22c55e",
    capitalInicial,
    valorFinal,
    gananciaTotal,
    cagr: cagr * 100,
    retornoReal: retornoReal * 100,
    rentaAcumulada: gananciaTotal,
    revalorizacion: 0,
    evolucion,
  };
}

function calcularPlazoFijoARS(
  cfg: ConfigGlobal,
  inv: ConfigPlazoFijoARS
): ResultadoInversion {
  const capitalInicial = cfg.capitalUSD;
  const anos = cfg.horizonteAnios;
  const tasaReal = (1 + inv.tnaPct / 100) / (1 + inv.inflacionARSPct / 100) - 1;
  const evolucion: number[] = [];

  for (let a = 0; a <= anos; a++) {
    evolucion.push(capitalInicial * Math.pow(1 + tasaReal, a));
  }

  const valorFinal = evolucion[anos];
  const gananciaTotal = valorFinal - capitalInicial;
  const cagr = Math.pow(Math.max(valorFinal, 0.01) / capitalInicial, 1 / anos) - 1;
  const retornoReal = (1 + cagr) / (1 + cfg.inflacionUSDPct / 100) - 1;

  return {
    nombre: "Plazo fijo ARS",
    color: "#3b82f6",
    capitalInicial,
    valorFinal,
    gananciaTotal,
    cagr: cagr * 100,
    retornoReal: retornoReal * 100,
    rentaAcumulada: gananciaTotal,
    revalorizacion: 0,
    evolucion,
  };
}

function calcularAcciones(
  cfg: ConfigGlobal,
  inv: ConfigAcciones
): ResultadoInversion {
  const capitalInicial = cfg.capitalUSD;
  const anos = cfg.horizonteAnios;
  const r = inv.retornoNominalPct / 100;
  const vol = inv.volatilidadPct / 100;

  const evolucion: number[] = [];
  const evolucionPesimista: number[] = [];
  const evolucionOptimista: number[] = [];

  for (let a = 0; a <= anos; a++) {
    evolucion.push(capitalInicial * Math.pow(1 + r, a));
    evolucionPesimista.push(capitalInicial * Math.pow(1 + r - vol, a));
    evolucionOptimista.push(capitalInicial * Math.pow(1 + r + vol, a));
  }

  const valorFinal = evolucion[anos];
  const valorFinalPesimista = evolucionPesimista[anos];
  const valorFinalOptimista = evolucionOptimista[anos];
  const gananciaTotal = valorFinal - capitalInicial;
  const cagr = Math.pow(valorFinal / capitalInicial, 1 / anos) - 1;
  const retornoReal = (1 + cagr) / (1 + cfg.inflacionUSDPct / 100) - 1;

  return {
    nombre: "Acciones / CEDEARs",
    color: "#f97316",
    capitalInicial,
    valorFinal,
    valorFinalPesimista,
    valorFinalOptimista,
    gananciaTotal,
    cagr: cagr * 100,
    retornoReal: retornoReal * 100,
    rentaAcumulada: gananciaTotal,
    revalorizacion: 0,
    evolucion,
    evolucionPesimista,
    evolucionOptimista,
  };
}

// ─── SVG Chart helpers ─────────────────────────────────────────────────────────

const SVG_W = 800;
const SVG_H = 350;
const PAD_L = 80;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 40;

function buildPath(
  xs: number[],
  ys: number[],
  toSvgX: (i: number) => number,
  toSvgY: (v: number) => number
): string {
  return xs
    .map((_, i) => `${i === 0 ? "M" : "L"}${toSvgX(i).toFixed(1)},${toSvgY(ys[i]).toFixed(1)}`)
    .join(" ");
}

function buildAreaPath(
  ys1: number[],
  ys2: number[],
  toSvgX: (i: number) => number,
  toSvgY: (v: number) => number
): string {
  const top = ys2.map((v, i) => `${i === 0 ? "M" : "L"}${toSvgX(i).toFixed(1)},${toSvgY(v).toFixed(1)}`).join(" ");
  const bottom = [...ys1]
    .reverse()
    .map((v, i) => `L${toSvgX(ys1.length - 1 - i).toFixed(1)},${toSvgY(v).toFixed(1)}`)
    .join(" ");
  return `${top} ${bottom} Z`;
}

// ─── Label style ───────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  color: "#888",
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: 4,
};

const INPUT_STYLE: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #222",
  borderRadius: 6,
  color: "#e0e0e0",
  padding: "7px 10px",
  fontSize: 13,
  width: "100%",
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
};

const CARD_STYLE: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #222222",
  borderRadius: 10,
  padding: 18,
};

// ─── Main component ────────────────────────────────────────────────────────────

export default function CompararInversionesPage() {
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // ── Config global
  const [capitalUSD, setCapitalUSD] = useState(50000);
  const [horizonteAnios, setHorizonteAnios] = useState(10);
  const [inflacionUSDPct, setInflacionUSDPct] = useState(3);

  // ── Inmueble
  const [precioM2USD, setPrecioM2USD] = useState(2500);
  const [m2, setM2] = useState(40);
  const [alquilerAnualPct, setAlquilerAnualPct] = useState(5);
  const [revalorizacionAnualPct, setRevalorizacionAnualPct] = useState(4);

  // ── Plazo fijo USD
  const [tasaPFUSD, setTasaPFUSD] = useState(5);

  // ── Plazo fijo ARS
  const [tnaPct, setTnaPct] = useState(38);
  const [inflacionARSPct, setInflacionARSPct] = useState(60);

  // ── Acciones
  const [retornoNominalPct, setRetornoNominalPct] = useState(10);
  const [volatilidadPct, setVolatilidadPct] = useState(15);

  const cfg: ConfigGlobal = useMemo(
    () => ({ capitalUSD, horizonteAnios, inflacionUSDPct }),
    [capitalUSD, horizonteAnios, inflacionUSDPct]
  );

  const resultados = useMemo<ResultadoInversion[]>(() => {
    const anos = Math.max(1, Math.min(20, horizonteAnios));
    const safeCfg = { ...cfg, horizonteAnios: anos };
    return [
      calcularInmueble(safeCfg, { precioM2USD, m2, alquilerAnualPct, revalorizacionAnualPct }),
      calcularPlazoFijoUSD(safeCfg, { tasaAnualPct: tasaPFUSD }),
      calcularPlazoFijoARS(safeCfg, { tnaPct, inflacionARSPct }),
      calcularAcciones(safeCfg, { retornoNominalPct, volatilidadPct }),
    ];
  }, [cfg, precioM2USD, m2, alquilerAnualPct, revalorizacionAnualPct, tasaPFUSD, tnaPct, inflacionARSPct, retornoNominalPct, volatilidadPct, horizonteAnios]);

  const ganador = useMemo(
    () => resultados.reduce((best, r) => (r.valorFinal > best.valorFinal ? r : best), resultados[0]),
    [resultados]
  );

  // ── SVG chart data
  const allValues = useMemo(() => {
    const vals: number[] = [];
    resultados.forEach((r) => {
      vals.push(...r.evolucion);
      if (r.evolucionPesimista) vals.push(...r.evolucionPesimista);
      if (r.evolucionOptimista) vals.push(...r.evolucionOptimista);
    });
    return vals;
  }, [resultados]);

  const minY = Math.min(...allValues, capitalUSD * 0.5);
  const maxY = Math.max(...allValues, capitalUSD * 1.1);

  const toSvgX = (i: number) =>
    PAD_L + (i / Math.max(1, horizonteAnios)) * (SVG_W - PAD_L - PAD_R);
  const toSvgY = (v: number) =>
    PAD_T + (1 - (v - minY) / Math.max(1, maxY - minY)) * (SVG_H - PAD_T - PAD_B);

  // ── CAGR max for bar charts
  const maxCAGR = Math.max(...resultados.map((r) => Math.abs(r.cagr)), 1);

  // ── Tab styles
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "9px 20px",
    borderRadius: "8px 8px 0 0",
    border: `1px solid ${active ? "#333" : "#1a1a1a"}`,
    borderBottom: active ? "1px solid #111111" : "1px solid #222",
    background: active ? "#111111" : "#0a0a0a",
    color: active ? "#e0e0e0" : "#555",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  });

  // ── Input field helper
  function numInput(
    label: string,
    value: number,
    setter: (v: number) => void,
    opts: { step?: number; min?: number; max?: number; suffix?: string } = {}
  ) {
    return (
      <div>
        <label style={LABEL_STYLE}>
          {label}
          {opts.suffix ? <span style={{ color: "#555", fontWeight: 400 }}> ({opts.suffix})</span> : null}
        </label>
        <input
          type="number"
          value={value}
          step={opts.step ?? 1}
          min={opts.min ?? 0}
          max={opts.max}
          onChange={(e) => setter(parseFloat(e.target.value) || 0)}
          style={INPUT_STYLE}
        />
      </div>
    );
  }

  // ── Y-axis tick values
  const yTicks = useMemo(() => {
    const range = maxY - minY;
    const step = Math.pow(10, Math.floor(Math.log10(range))) / 2;
    const ticks: number[] = [];
    let cur = Math.ceil(minY / step) * step;
    while (cur <= maxY + step * 0.1) {
      ticks.push(cur);
      cur += step;
    }
    return ticks.slice(0, 8);
  }, [minY, maxY]);

  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#e0e0e0",
        fontFamily: "Inter, sans-serif",
        padding: "28px 20px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ── Header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 26,
              margin: 0,
              color: "#fff",
            }}
          >
            Comparador de Inversiones
          </h1>
          <p style={{ color: "#666", fontSize: 13, margin: "6px 0 0" }}>
            Inmueble · Plazo fijo USD · Plazo fijo ARS · Acciones/CEDEARs — Argentina 2026
          </p>
        </div>

        {/* ── Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 0, borderBottom: "1px solid #222" }}>
          {(["Configuración y Resultados", "Evolución", "Comparación detallada"] as const).map(
            (name, i) => (
              <button key={name} onClick={() => setTab(i as 0 | 1 | 2)} style={tabStyle(tab === i)}>
                {name}
              </button>
            )
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB 0 — Configuración y Resultados
        ════════════════════════════════════════════════════════════════ */}
        {tab === 0 && (
          <div
            style={{
              background: "#111111",
              border: "1px solid #222",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              padding: 24,
            }}
          >
            {/* Global config */}
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 11,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 14,
                  borderBottom: "1px solid #1a1a1a",
                  paddingBottom: 8,
                }}
              >
                Parámetros Generales
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 16,
                }}
              >
                {numInput("Capital inicial", capitalUSD, setCapitalUSD, { step: 5000, min: 1000, suffix: "USD" })}
                {numInput("Horizonte", horizonteAnios, setHorizonteAnios, { step: 1, min: 1, max: 20, suffix: "años" })}
                {numInput("Inflación USD estimada", inflacionUSDPct, setInflacionUSDPct, { step: 0.5, suffix: "%" })}
              </div>
            </div>

            {/* 4 investment configs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                gap: 16,
                marginBottom: 28,
              }}
            >
              {/* Inmueble */}
              <div style={{ ...CARD_STYLE, borderLeft: "3px solid #cc0000" }}>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#cc0000",
                    textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                >
                  Inmueble en alquiler
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {numInput("Precio m²", precioM2USD, setPrecioM2USD, { step: 100, suffix: "USD/m²" })}
                  {numInput("Superficie", m2, setM2, { step: 5, min: 1, suffix: "m²" })}
                  {numInput("Tasa de alquiler anual", alquilerAnualPct, setAlquilerAnualPct, { step: 0.5, suffix: "% del valor" })}
                  {numInput("Revalorización anual", revalorizacionAnualPct, setRevalorizacionAnualPct, { step: 0.5, suffix: "%" })}
                </div>
              </div>

              {/* Plazo fijo USD */}
              <div style={{ ...CARD_STYLE, borderLeft: "3px solid #22c55e" }}>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#22c55e",
                    textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                >
                  Plazo fijo en USD
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {numInput("Tasa anual en USD", tasaPFUSD, setTasaPFUSD, { step: 0.5, suffix: "%" })}
                </div>
              </div>

              {/* Plazo fijo ARS */}
              <div style={{ ...CARD_STYLE, borderLeft: "3px solid #3b82f6" }}>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#3b82f6",
                    textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                >
                  Plazo fijo en ARS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {numInput("TNA", tnaPct, setTnaPct, { step: 1, suffix: "%" })}
                  {numInput("Inflación ARS estimada", inflacionARSPct, setInflacionARSPct, { step: 1, suffix: "%" })}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#555",
                      background: "#0a0a0a",
                      borderRadius: 6,
                      padding: "6px 10px",
                    }}
                  >
                    Tasa real:{" "}
                    <span style={{ color: (1 + tnaPct / 100) / (1 + inflacionARSPct / 100) - 1 >= 0 ? "#22c55e" : "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      {fmtPct(((1 + tnaPct / 100) / (1 + inflacionARSPct / 100) - 1) * 100)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div style={{ ...CARD_STYLE, borderLeft: "3px solid #f97316" }}>
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#f97316",
                    textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                >
                  Acciones / CEDEARs
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {numInput("Retorno nominal anual", retornoNominalPct, setRetornoNominalPct, { step: 0.5, suffix: "%" })}
                  {numInput("Volatilidad anual", volatilidadPct, setVolatilidadPct, { step: 0.5, suffix: "%" })}
                  <div style={{ fontSize: 11, color: "#555", background: "#0a0a0a", borderRadius: 6, padding: "6px 10px" }}>
                    Rango:{" "}
                    <span style={{ color: "#cc6600" }}>{fmtPct(retornoNominalPct - volatilidadPct)}</span>
                    {" / "}
                    <span style={{ color: "#22c55e" }}>{fmtPct(retornoNominalPct + volatilidadPct)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results table */}
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 11,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 14,
                borderBottom: "1px solid #1a1a1a",
                paddingBottom: 8,
              }}
            >
              Resumen comparativo — {horizonteAnios} años
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Inversión", "Valor final", "Ganancia total", "CAGR", "Retorno real"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "Inversión" ? "left" : "right",
                          padding: "9px 14px",
                          fontSize: 10,
                          color: "#666",
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          borderBottom: "1px solid #222",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => {
                    const esMejor = r.nombre === ganador.nombre;
                    return (
                      <tr
                        key={r.nombre}
                        style={{
                          borderBottom: "1px solid #1a1a1a",
                          background: esMejor ? `${r.color}11` : "transparent",
                        }}
                      >
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                background: r.color,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontFamily: "Montserrat, sans-serif",
                                fontWeight: 700,
                                color: esMejor ? r.color : "#e0e0e0",
                              }}
                            >
                              {r.nombre}
                            </span>
                            {esMejor && (
                              <span
                                style={{
                                  background: r.color,
                                  color: "#fff",
                                  fontSize: 9,
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: 800,
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Mejor
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            textAlign: "right",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color: r.color,
                          }}
                        >
                          {fmtUSD(r.valorFinal)}
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            textAlign: "right",
                            color: r.gananciaTotal >= 0 ? "#22c55e" : "#cc0000",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {fmtUSD(r.gananciaTotal)}
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            textAlign: "right",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color: r.cagr >= 0 ? "#e0e0e0" : "#cc0000",
                          }}
                        >
                          {fmtPct(r.cagr)}
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            textAlign: "right",
                            color: r.retornoReal >= 0 ? "#22c55e" : "#cc0000",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {fmtPct(r.retornoReal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#444" }}>
              * Retorno real ajustado por inflación USD del {fmtPct(inflacionUSDPct, 1)} anual. Los cálculos son proyecciones y no garantizan resultados futuros.
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 1 — Evolución SVG
        ════════════════════════════════════════════════════════════════ */}
        {tab === 1 && (
          <div
            style={{
              background: "#111111",
              border: "1px solid #222",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              padding: 24,
            }}
          >
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 11,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 16,
              }}
            >
              Evolución del capital — {horizonteAnios} años (USD)
            </div>
            <div style={{ overflowX: "auto" }}>
              <svg
                width="100%"
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                style={{ display: "block", minWidth: 420 }}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Background */}
                <rect x={PAD_L} y={PAD_T} width={SVG_W - PAD_L - PAD_R} height={SVG_H - PAD_T - PAD_B} fill="#0a0a0a" rx={4} />

                {/* Grid lines + Y labels */}
                {yTicks.map((tick) => {
                  const sy = toSvgY(tick);
                  if (sy < PAD_T - 2 || sy > SVG_H - PAD_B + 2) return null;
                  const label =
                    tick >= 1000000
                      ? `${(tick / 1000000).toFixed(1)}M`
                      : tick >= 1000
                      ? `${(tick / 1000).toFixed(0)}k`
                      : tick.toFixed(0);
                  return (
                    <g key={tick}>
                      <line
                        x1={PAD_L}
                        x2={SVG_W - PAD_R}
                        y1={sy}
                        y2={sy}
                        stroke="#1e1e1e"
                        strokeWidth={1}
                      />
                      <text
                        x={PAD_L - 6}
                        y={sy + 4}
                        textAnchor="end"
                        fill="#555"
                        fontSize={9}
                        fontFamily="Inter, sans-serif"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* X axis labels */}
                {Array.from({ length: horizonteAnios + 1 }, (_, i) => i)
                  .filter((i) => i === 0 || i === horizonteAnios || i % Math.max(1, Math.floor(horizonteAnios / 5)) === 0)
                  .map((a) => (
                    <text
                      key={a}
                      x={toSvgX(a)}
                      y={SVG_H - PAD_B + 16}
                      textAnchor="middle"
                      fill="#555"
                      fontSize={9}
                      fontFamily="Inter, sans-serif"
                    >
                      Año {a}
                    </text>
                  ))}

                {/* Acciones band (pesimista/optimista) */}
                {(() => {
                  const acc = resultados.find((r) => r.nombre === "Acciones / CEDEARs");
                  if (!acc?.evolucionPesimista || !acc?.evolucionOptimista) return null;
                  const areaD = buildAreaPath(
                    acc.evolucionPesimista,
                    acc.evolucionOptimista,
                    toSvgX,
                    toSvgY
                  );
                  return (
                    <path
                      d={areaD}
                      fill={acc.color}
                      fillOpacity={0.12}
                      stroke="none"
                    />
                  );
                })()}

                {/* Lines */}
                {resultados.map((r) => (
                  <path
                    key={r.nombre}
                    d={buildPath(
                      Array.from({ length: r.evolucion.length }, (_, i) => i),
                      r.evolucion,
                      toSvgX,
                      toSvgY
                    )}
                    fill="none"
                    stroke={r.color}
                    strokeWidth={r.nombre === ganador.nombre ? 2.5 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {/* End-point dots */}
                {resultados.map((r) => {
                  const x = toSvgX(r.evolucion.length - 1);
                  const y = toSvgY(r.valorFinal);
                  return (
                    <circle key={r.nombre + "-dot"} cx={x} cy={y} r={4} fill={r.color} />
                  );
                })}
              </svg>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 16 }}>
              {resultados.map((r) => (
                <div key={r.nombre} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div
                    style={{
                      width: 24,
                      height: 3,
                      background: r.color,
                      borderRadius: 2,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#aaa", fontFamily: "Inter, sans-serif" }}>
                    {r.nombre}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      color: r.color,
                    }}
                  >
                    {fmtUSD(r.valorFinal, 0)}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div
                  style={{
                    width: 24,
                    height: 10,
                    background: "#f97316",
                    opacity: 0.2,
                    borderRadius: 2,
                  }}
                />
                <span style={{ fontSize: 12, color: "#666" }}>Rango acciones (±volatilidad)</span>
              </div>
            </div>

            {/* Year-by-year mini table */}
            <div style={{ marginTop: 24, overflowX: "auto" }}>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 10,
                  color: "#555",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Tabla año a año
              </div>
              <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "6px 12px",
                        color: "#555",
                        fontFamily: "Montserrat, sans-serif",
                        fontSize: 10,
                        borderBottom: "1px solid #1a1a1a",
                      }}
                    >
                      Año
                    </th>
                    {resultados.map((r) => (
                      <th
                        key={r.nombre}
                        style={{
                          textAlign: "right",
                          padding: "6px 12px",
                          color: r.color,
                          fontFamily: "Montserrat, sans-serif",
                          fontSize: 10,
                          fontWeight: 700,
                          borderBottom: "1px solid #1a1a1a",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: horizonteAnios + 1 }, (_, a) => (
                    <tr key={a} style={{ borderBottom: "1px solid #141414" }}>
                      <td
                        style={{
                          padding: "5px 12px",
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          color: "#666",
                          fontSize: 12,
                        }}
                      >
                        {a}
                      </td>
                      {resultados.map((r) => (
                        <td
                          key={r.nombre}
                          style={{
                            padding: "5px 12px",
                            textAlign: "right",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color: r.evolucion[a] > capitalUSD ? "#e0e0e0" : "#cc0000",
                            fontSize: 12,
                          }}
                        >
                          {fmtUSD(r.evolucion[a], 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB 2 — Comparación detallada
        ════════════════════════════════════════════════════════════════ */}
        {tab === 2 && (
          <div
            style={{
              background: "#111111",
              border: "1px solid #222",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              padding: 24,
            }}
          >
            {/* Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
                marginBottom: 28,
              }}
            >
              {resultados.map((r) => {
                const esMejor = r.nombre === ganador.nombre;
                return (
                  <div
                    key={r.nombre}
                    style={{
                      background: "#0f0f0f",
                      border: `1px solid ${esMejor ? r.color : "#1e1e1e"}`,
                      borderRadius: 10,
                      padding: 18,
                      position: "relative",
                    }}
                  >
                    {esMejor && (
                      <div
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          background: r.color,
                          color: "#fff",
                          fontSize: 9,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Mejor
                      </div>
                    )}
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        color: r.color,
                        textTransform: "uppercase",
                        marginBottom: 14,
                      }}
                    >
                      {r.nombre}
                    </div>
                    {[
                      { label: "Capital inicial", value: fmtUSD(r.capitalInicial) },
                      {
                        label: "Renta / interés acumulado",
                        value: fmtUSD(r.rentaAcumulada),
                        color: r.rentaAcumulada >= 0 ? "#22c55e" : "#cc0000",
                      },
                      {
                        label: "Revalorización",
                        value: fmtUSD(r.revalorizacion),
                        color: "#888",
                      },
                      { label: "Valor final", value: fmtUSD(r.valorFinal), color: r.color, bold: true },
                      {
                        label: "Ganancia total",
                        value: fmtUSD(r.gananciaTotal),
                        color: r.gananciaTotal >= 0 ? "#22c55e" : "#cc0000",
                        bold: true,
                      },
                      {
                        label: "CAGR",
                        value: fmtPct(r.cagr),
                        color: r.cagr >= 0 ? "#e0e0e0" : "#cc0000",
                      },
                      {
                        label: "Retorno real",
                        value: fmtPct(r.retornoReal),
                        color: r.retornoReal >= 0 ? "#22c55e" : "#cc0000",
                      },
                      ...(r.nombre === "Acciones / CEDEARs" && r.valorFinalPesimista !== undefined && r.valorFinalOptimista !== undefined
                        ? [
                            {
                              label: "Escenario pesimista",
                              value: fmtUSD(r.valorFinalPesimista),
                              color: "#cc0000",
                            },
                            {
                              label: "Escenario optimista",
                              value: fmtUSD(r.valorFinalOptimista),
                              color: "#22c55e",
                            },
                          ]
                        : []),
                    ].map((row) => (
                      <div
                        key={row.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "7px 0",
                          borderBottom: "1px solid #1a1a1a",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#666" }}>{row.label}</span>
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: row.bold ? 800 : 700,
                            color: row.color ?? "#e0e0e0",
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* CAGR bar chart */}
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 11,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 14,
                borderBottom: "1px solid #1a1a1a",
                paddingBottom: 8,
              }}
            >
              CAGR comparativo
            </div>
            <svg
              width="100%"
              viewBox={`0 0 600 ${resultados.length * 52 + 20}`}
              style={{ display: "block" }}
            >
              {resultados
                .slice()
                .sort((a, b) => b.cagr - a.cagr)
                .map((r, i) => {
                  const barW = Math.max(0, (r.cagr / maxCAGR) * 480);
                  const y = i * 52 + 10;
                  return (
                    <g key={r.nombre}>
                      <text
                        x={0}
                        y={y + 14}
                        fill={r.color}
                        fontSize={11}
                        fontFamily="Montserrat, sans-serif"
                        fontWeight="700"
                      >
                        {r.nombre}
                      </text>
                      <rect
                        x={0}
                        y={y + 20}
                        width={480}
                        height={18}
                        fill="#0a0a0a"
                        rx={4}
                      />
                      <rect
                        x={0}
                        y={y + 20}
                        width={barW}
                        height={18}
                        fill={r.color}
                        fillOpacity={0.85}
                        rx={4}
                      />
                      <text
                        x={barW + 6}
                        y={y + 33}
                        fill={r.color}
                        fontSize={11}
                        fontFamily="Montserrat, sans-serif"
                        fontWeight="700"
                      >
                        {fmtPct(r.cagr)}
                      </text>
                    </g>
                  );
                })}
            </svg>

            {/* Nota aclaratoria */}
            <div
              style={{
                marginTop: 20,
                padding: "12px 16px",
                background: "#0a0a0a",
                border: "1px solid #1a1a1a",
                borderRadius: 8,
                fontSize: 11,
                color: "#555",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "#666" }}>Notas metodológicas:</strong> Inmueble: renta anual
              calculada sobre el valor del inmueble proporcional al capital invertido, más
              revalorización compuesta. Plazo fijo ARS: tasa real = (1 + TNA) / (1 + inflación ARS) − 1,
              aplicada sobre capital equivalente en USD. Acciones: media geométrica con escenarios
              ±volatilidad. Retorno real ajustado por inflación USD del {fmtPct(inflacionUSDPct, 1)}.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
