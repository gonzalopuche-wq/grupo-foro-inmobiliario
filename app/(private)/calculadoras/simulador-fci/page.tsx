"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number, dec = 2): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(dec)}%`;
}

function cagr(valorFinal: number, capital: number, years: number): number {
  if (years === 0 || capital <= 0) return 0;
  return (Math.pow(valorFinal / capital, 1 / years) - 1) * 100;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "config" | "evolucion" | "breakeven";
type FCIArsType = "mm" | "rf" | "acc";

interface Config {
  capital: number;
  tipoCambio: number;
  horizonte: number;
  // Inmueble
  precioCompra: number;
  costosEntrada: number;
  alquilerMensual: number;
  ajusteAlquilerAnual: number;
  gastosAnualesPct: number;
  revalorizacionAnual: number;
  vacancyRate: number;
  // FCI ARS
  fciArsType: FCIArsType;
  tnaMoneyMarket: number;
  tnaRentaFija: number;
  retornoAcciones: number;
  volatAcciones: number;
  inflacionArs: number;
  // FCI USD
  retornoFciUsd: number;
  volatFciUsd: number;
  comisionFciUsd: number;
}

interface YearRow {
  year: number;
  inmuebleValor: number;
  alquilerAcum: number;
  fciArsTotal: number;
  fciUsdTotal: number;
  fciArsMin: number;
  fciArsMax: number;
  fciUsdMin: number;
  fciUsdMax: number;
}

// ── Cálculos ──────────────────────────────────────────────────────────────────

function calcularSerie(cfg: Config): YearRow[] {
  const rows: YearRow[] = [];

  // Inmueble — el valor inicial es el precio de compra; los costos de entrada
  // ya están implícitos en el precio (reducen el retorno neto)
  let inmuebleValor = cfg.precioCompra;
  let alquilerAcum = 0;
  let alquilerMensualActual = cfg.alquilerMensual; // USD/mes

  // FCI ARS — retorno nominal en ARS, convertido a USD descontando depreciación
  // del peso (aproximada por la inflación ARS configurada)
  const tnaArs =
    cfg.fciArsType === "mm"
      ? cfg.tnaMoneyMarket
      : cfg.fciArsType === "rf"
        ? cfg.tnaRentaFija
        : cfg.retornoAcciones;
  const volatArs = cfg.fciArsType === "acc" ? cfg.volatAcciones : 0;
  // Retorno real en USD = (1 + retARS/100) / (1 + inflARS/100) - 1
  const retArsUsd =
    ((1 + tnaArs / 100) / (1 + cfg.inflacionArs / 100) - 1) * 100;
  let fciArsUsd = cfg.capital;
  let fciArsMin = cfg.capital;
  let fciArsMax = cfg.capital;

  // FCI USD
  const retUsdNeto = cfg.retornoFciUsd - cfg.comisionFciUsd;
  let fciUsd = cfg.capital;
  let fciUsdMin = cfg.capital;
  let fciUsdMax = cfg.capital;

  const capitalInmueble = cfg.precioCompra;

  rows.push({
    year: 0,
    inmuebleValor: capitalInmueble,
    alquilerAcum: 0,
    fciArsTotal: cfg.capital,
    fciUsdTotal: cfg.capital,
    fciArsMin: cfg.capital,
    fciArsMax: cfg.capital,
    fciUsdMin: cfg.capital,
    fciUsdMax: cfg.capital,
  });

  for (let y = 1; y <= 10; y++) {
    // Inmueble: revalorización
    inmuebleValor *= 1 + cfg.revalorizacionAnual / 100;

    // Alquiler: 12 meses con vacancy
    const mesesEfectivos = 12 * (1 - cfg.vacancyRate / 100);
    alquilerAcum += alquilerMensualActual * mesesEfectivos;
    // Restar gastos anuales del propietario (% del valor del inmueble)
    alquilerAcum -= inmuebleValor * (cfg.gastosAnualesPct / 100);
    // Ajuste alquiler para próximo año
    alquilerMensualActual *= 1 + cfg.ajusteAlquilerAnual / 100;

    // FCI ARS en USD (retorno real USD)
    fciArsUsd *= 1 + retArsUsd / 100;
    if (volatArs > 0) {
      fciArsMin = cfg.capital * Math.pow(1 + (retArsUsd - volatArs) / 100, y);
      fciArsMax = cfg.capital * Math.pow(1 + (retArsUsd + volatArs) / 100, y);
    } else {
      fciArsMin = fciArsUsd;
      fciArsMax = fciArsUsd;
    }

    // FCI USD
    fciUsd = cfg.capital * Math.pow(1 + retUsdNeto / 100, y);
    fciUsdMin =
      cfg.capital * Math.pow(1 + (retUsdNeto - cfg.volatFciUsd) / 100, y);
    fciUsdMax =
      cfg.capital * Math.pow(1 + (retUsdNeto + cfg.volatFciUsd) / 100, y);

    rows.push({
      year: y,
      inmuebleValor,
      alquilerAcum: Math.max(0, alquilerAcum),
      fciArsTotal: fciArsUsd,
      fciUsdTotal: fciUsd,
      fciArsMin,
      fciArsMax,
      fciUsdMin,
      fciUsdMax,
    });
  }

  return rows;
}

// ── Input Component ───────────────────────────────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  prefix,
  note,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
  note?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 4,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {label}
        {note && (
          <span style={{ color: "#6b7280", marginLeft: 4 }}>({note})</span>
        )}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {prefix && (
          <span
            style={{
              color: "#6b7280",
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step ?? 1}
          style={{
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: 6,
            color: "#e0e0e0",
            padding: "6px 10px",
            fontSize: 14,
            fontFamily: "Inter, sans-serif",
            width: "100%",
            outline: "none",
          }}
        />
        {suffix && (
          <span
            style={{
              color: "#6b7280",
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ── SVG Chart ─────────────────────────────────────────────────────────────────

function ChartEvolucion({
  rows,
  horizonte,
}: {
  rows: YearRow[];
  horizonte: number;
}) {
  const W = 750;
  const H = 320;
  const PAD = { top: 24, right: 24, bottom: 40, left: 72 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const rowsSlice = rows.slice(0, horizonte + 1);

  const allVals = rowsSlice.flatMap((r) => [
    r.inmuebleValor + r.alquilerAcum,
    r.fciArsTotal,
    r.fciUsdTotal,
    r.alquilerAcum,
    r.fciArsMin,
    r.fciArsMax,
    r.fciUsdMin,
    r.fciUsdMax,
  ]);
  const minY = Math.min(...allVals) * 0.9;
  const maxY = Math.max(...allVals) * 1.05;

  const toX = (y: number) => PAD.left + (y / horizonte) * cW;
  const toY = (v: number) =>
    PAD.top + cH - ((v - minY) / (maxY - minY)) * cH;

  const pathFor = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(" ");

  const areaFor = (mins: number[], maxs: number[]) => {
    const top = mins.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
    const bottom = [...maxs].reverse().map((v, i) => `L${toX(horizonte - i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
    return `${top} ${bottom} Z`;
  };

  const inmuebleTotal = rowsSlice.map((r) => r.inmuebleValor + r.alquilerAcum);
  const alquilerOnly = rowsSlice.map((r) => r.alquilerAcum);
  const fciArs = rowsSlice.map((r) => r.fciArsTotal);
  const fciUsd = rowsSlice.map((r) => r.fciUsdTotal);
  const fciArsMinArr = rowsSlice.map((r) => r.fciArsMin);
  const fciArsMaxArr = rowsSlice.map((r) => r.fciArsMax);
  const fciUsdMinArr = rowsSlice.map((r) => r.fciUsdMin);
  const fciUsdMaxArr = rowsSlice.map((r) => r.fciUsdMax);

  // Y-axis ticks
  const tickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(minY + ((maxY - minY) * i) / tickCount);
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={W}
        height={H}
        style={{ display: "block", fontFamily: "Inter, sans-serif" }}
      >
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={toY(v)}
              x2={W - PAD.right}
              y2={toY(v)}
              stroke="#222"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={toY(v) + 4}
              textAnchor="end"
              fill="#6b7280"
              fontSize={10}
            >
              {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X-axis ticks */}
        {rowsSlice.map((r) => (
          <g key={r.year}>
            <line
              x1={toX(r.year)}
              y1={PAD.top + cH}
              x2={toX(r.year)}
              y2={PAD.top + cH + 5}
              stroke="#444"
              strokeWidth={1}
            />
            <text
              x={toX(r.year)}
              y={PAD.top + cH + 17}
              textAnchor="middle"
              fill="#6b7280"
              fontSize={10}
            >
              Año {r.year}
            </text>
          </g>
        ))}

        {/* Shaded ranges */}
        <path
          d={areaFor(fciArsMinArr, fciArsMaxArr)}
          fill="#22c55e"
          fillOpacity={0.1}
        />
        <path
          d={areaFor(fciUsdMinArr, fciUsdMaxArr)}
          fill="#3b82f6"
          fillOpacity={0.1}
        />

        {/* Lines */}
        {/* Alquiler acumulado (naranja) */}
        <path
          d={pathFor(alquilerOnly)}
          fill="none"
          stroke="#f97316"
          strokeWidth={2}
          strokeDasharray="5,3"
        />
        {/* FCI ARS (verde) */}
        <path
          d={pathFor(fciArs)}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2.5}
        />
        {/* FCI USD (azul) */}
        <path
          d={pathFor(fciUsd)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
        />
        {/* Inmueble total (rojo) */}
        <path
          d={pathFor(inmuebleTotal)}
          fill="none"
          stroke="#cc0000"
          strokeWidth={2.5}
        />

        {/* Legend */}
        {[
          { color: "#cc0000", label: "Inmueble (valor + alquiler)", dash: false },
          { color: "#f97316", label: "Renta alquiler acumulada", dash: true },
          { color: "#22c55e", label: "FCI ARS (retorno real USD)", dash: false },
          { color: "#3b82f6", label: "FCI USD", dash: false },
        ].map((item, i) => (
          <g key={i} transform={`translate(${PAD.left + i * 175}, ${H - 10})`}>
            <line
              x1={0}
              y1={0}
              x2={16}
              y2={0}
              stroke={item.color}
              strokeWidth={2}
              strokeDasharray={item.dash ? "5,3" : "none"}
            />
            <text x={20} y={4} fill="#9ca3af" fontSize={10}>
              {item.label}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + cH}
          stroke="#333"
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          y1={PAD.top + cH}
          x2={W - PAD.right}
          y2={PAD.top + cH}
          stroke="#333"
          strokeWidth={1}
        />

        {/* Y-axis label */}
        <text
          x={12}
          y={PAD.top + cH / 2}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={10}
          transform={`rotate(-90, 12, ${PAD.top + cH / 2})`}
        >
          USD
        </text>
      </svg>
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  color,
}: {
  title: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#111111",
        border: `1px solid ${color ?? "#222222"}`,
        borderRadius: 10,
        padding: "18px 20px",
        marginBottom: 16,
      }}
    >
      <h3
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 14,
          color: color ?? "#e0e0e0",
          margin: "0 0 14px 0",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Result Card ───────────────────────────────────────────────────────────────

function ResultCard({
  label,
  valorFinal,
  cagrVal,
  retornoReal,
  liquidez,
  color,
  isBestReturn,
  isBestLiquidity,
  capital,
}: {
  label: string;
  valorFinal: number;
  cagrVal: number;
  retornoReal: number;
  liquidez: string;
  color: string;
  isBestReturn: boolean;
  isBestLiquidity: boolean;
  capital: number;
  horizonte?: number;
}) {
  const ganancia = valorFinal - capital;
  return (
    <div
      style={{
        background: "#111111",
        border: `2px solid ${isBestReturn ? color : "#222222"}`,
        borderRadius: 10,
        padding: "20px 18px",
        flex: 1,
        minWidth: 200,
        position: "relative",
      }}
    >
      {(isBestReturn || isBestLiquidity) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {isBestReturn && (
            <span
              style={{
                background: "#cc0000",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4,
                fontFamily: "Montserrat, sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              MEJOR RENDIMIENTO
            </span>
          )}
          {isBestLiquidity && (
            <span
              style={{
                background: "#22c55e",
                color: "#000",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4,
                fontFamily: "Montserrat, sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              MEJOR LIQUIDEZ
            </span>
          )}
        </div>
      )}
      <div
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          color,
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 800,
          fontSize: 22,
          color: "#fff",
          marginBottom: 4,
        }}
      >
        USD {fmtUSD(valorFinal)}
      </div>
      <div
        style={{
          fontSize: 13,
          color: ganancia >= 0 ? "#22c55e" : "#cc0000",
          marginBottom: 10,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {ganancia >= 0 ? "+" : ""}USD {fmtUSD(ganancia)} ganancia
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px 12px",
          fontSize: 12,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ color: "#6b7280" }}>CAGR</div>
        <div style={{ color: "#e0e0e0" }}>{fmtPct(cagrVal, 1)}</div>
        <div style={{ color: "#6b7280" }}>Retorno real</div>
        <div style={{ color: retornoReal >= 0 ? "#22c55e" : "#cc0000" }}>
          {fmtPct(retornoReal, 1)}
        </div>
        <div style={{ color: "#6b7280" }}>Liquidez</div>
        <div style={{ color: "#e0e0e0" }}>{liquidez}</div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Config = {
  capital: 100000,
  tipoCambio: 1150,
  horizonte: 5,
  precioCompra: 100000,
  costosEntrada: 4,
  alquilerMensual: 500,
  ajusteAlquilerAnual: 5,
  gastosAnualesPct: 2,
  revalorizacionAnual: 3,
  vacancyRate: 5,
  fciArsType: "rf",
  tnaMoneyMarket: 40,
  tnaRentaFija: 65,
  retornoAcciones: 90,
  volatAcciones: 30,
  inflacionArs: 85,
  retornoFciUsd: 12,
  volatFciUsd: 20,
  comisionFciUsd: 1.5,
};

export default function SimuladorFCIPage() {
  const [tab, setTab] = useState<TabId>("config");
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);

  // Break-even sliders
  const [beRetornoFciDelta, setBeRetornoFciDelta] = useState(0);
  const [beRevaloInmDelta, setBeRevaloInmDelta] = useState(0);

  const set = <K extends keyof Config>(key: K, val: Config[K]) =>
    setCfg((prev) => ({ ...prev, [key]: val }));

  // Compute full 10-year series
  const series = useMemo(() => calcularSerie(cfg), [cfg]);

  const horizSeries = series.slice(0, cfg.horizonte + 1);
  const last = horizSeries[horizSeries.length - 1];

  // USD inflation for real return
  const inflUsd = 3;

  // Final values
  const inmuebleFinal = last.inmuebleValor + last.alquilerAcum;
  const fciArsFinal = last.fciArsTotal;
  const fciUsdFinal = last.fciUsdTotal;

  const inmuebleCAGR = cagr(inmuebleFinal, cfg.capital, cfg.horizonte);
  const fciArsCAGR = cagr(fciArsFinal, cfg.capital, cfg.horizonte);
  const fciUsdCAGR = cagr(fciUsdFinal, cfg.capital, cfg.horizonte);

  const inmuebleReal = inmuebleCAGR - inflUsd;
  const fciArsReal = fciArsCAGR - inflUsd;
  const fciUsdReal = fciUsdCAGR - inflUsd;

  const bestReturn = Math.max(inmuebleFinal, fciArsFinal, fciUsdFinal);
  const options = [
    { label: "Inmueble", val: inmuebleFinal },
    { label: "FCI ARS", val: fciArsFinal },
    { label: "FCI USD", val: fciUsdFinal },
  ];
  const bestReturnLabel = options.find((o) => o.val === bestReturn)?.label;

  // Break-even analysis
  const beSeriesImmueble = useMemo(() => {
    const modCfg: Config = {
      ...cfg,
      revalorizacionAnual: cfg.revalorizacionAnual + beRevaloInmDelta,
    };
    const s = calcularSerie(modCfg);
    return s;
  }, [cfg, beRevaloInmDelta]);

  const beSeriesFciUsd = useMemo(() => {
    const modCfg: Config = {
      ...cfg,
      retornoFciUsd: cfg.retornoFciUsd + beRetornoFciDelta,
      revalorizacionAnual: cfg.revalorizacionAnual + beRevaloInmDelta,
    };
    const s = calcularSerie(modCfg);
    return s;
  }, [cfg, beRetornoFciDelta, beRevaloInmDelta]);

  // Find crossover year (FCI USD vs Inmueble)
  let crossoverYear: number | null = null;
  for (let y = 1; y <= 10; y++) {
    const rowInm = beSeriesImmueble[y];
    const rowFci = beSeriesFciUsd[y];
    const prevInm = beSeriesImmueble[y - 1];
    const prevFci = beSeriesFciUsd[y - 1];
    const inmTotal = rowInm.inmuebleValor + rowInm.alquilerAcum;
    const prevInmTotal = prevInm.inmuebleValor + prevInm.alquilerAcum;
    const fciVal = rowFci.fciUsdTotal;
    const prevFciVal = prevFci.fciUsdTotal;
    if (
      (prevFciVal < prevInmTotal && fciVal >= inmTotal) ||
      (prevFciVal > prevInmTotal && fciVal <= inmTotal)
    ) {
      crossoverYear = y;
      break;
    }
  }

  // Sensitivity table: 3×3
  const fciRetDelta = [-5, 0, 5];
  const invRevDelta = [-2, 0, 2];
  const sensitTable = fciRetDelta.map((fd) =>
    invRevDelta.map((id) => {
      const modCfg: Config = {
        ...cfg,
        retornoFciUsd: cfg.retornoFciUsd + fd,
        revalorizacionAnual: cfg.revalorizacionAnual + id,
      };
      const s = calcularSerie(modCfg);
      const row10 = s[10];
      const inm10 = row10.inmuebleValor + row10.alquilerAcum;
      const fci10 = row10.fciUsdTotal;
      return {
        fd,
        id,
        winner: inm10 >= fci10 ? "Inmueble" : "FCI USD",
        inmVal: inm10,
        fciVal: fci10,
      };
    })
  );

  const tabStyle = (t: TabId) => ({
    padding: "10px 20px",
    borderRadius: "8px 8px 0 0",
    border: "1px solid #222",
    borderBottom: tab === t ? "1px solid #0a0a0a" : "1px solid #222",
    background: tab === t ? "#111111" : "#0a0a0a",
    color: tab === t ? "#e0e0e0" : "#6b7280",
    cursor: "pointer" as const,
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    fontWeight: tab === t ? 600 : 400,
    marginRight: 4,
  });

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#e0e0e0",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                fontSize: 26,
                color: "#fff",
                margin: 0,
              }}
            >
              Simulador FCI vs. Inmueble
            </h1>
            <p
              style={{
                color: "#6b7280",
                fontSize: 13,
                margin: "6px 0 0",
              }}
            >
              Compará invertir en Fondos Comunes de Inversión contra comprar un
              inmueble para alquiler en Argentina
            </p>
          </div>
          <Link
            href="/calculadoras"
            style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}
          >
            ← Calculadoras
          </Link>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", marginBottom: -1 }}>
          <button style={tabStyle("config")} onClick={() => setTab("config")}>
            Configuración
          </button>
          <button
            style={tabStyle("evolucion")}
            onClick={() => setTab("evolucion")}
          >
            Evolución
          </button>
          <button
            style={tabStyle("breakeven")}
            onClick={() => setTab("breakeven")}
          >
            Break-even
          </button>
        </div>

        <div
          style={{
            background: "#111111",
            border: "1px solid #222",
            borderRadius: "0 8px 8px 8px",
            padding: "24px 20px",
          }}
        >
          {/* ── TAB 1: Configuración ── */}
          {tab === "config" && (
            <div>
              {/* Global inputs */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: "14px 16px",
                  }}
                >
                  <NumInput
                    label="Capital disponible"
                    value={cfg.capital}
                    onChange={(v) => set("capital", v)}
                    min={1000}
                    step={1000}
                    prefix="USD"
                  />
                  <NumInput
                    label="Tipo de cambio ARS/USD"
                    value={cfg.tipoCambio}
                    onChange={(v) => set("tipoCambio", v)}
                    min={1}
                    step={10}
                    suffix="ARS/USD"
                  />
                  <NumInput
                    label="Horizonte de inversión"
                    value={cfg.horizonte}
                    onChange={(v) => set("horizonte", Math.min(10, Math.max(1, v)))}
                    min={1}
                    max={10}
                    suffix="años"
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: 16,
                  marginBottom: 28,
                }}
              >
                {/* Opción A — Inmueble */}
                <SectionCard title="Opción A — Inmueble en alquiler" color="#cc0000">
                  <NumInput
                    label="Precio de compra"
                    value={cfg.precioCompra}
                    onChange={(v) => set("precioCompra", v)}
                    min={1000}
                    step={1000}
                    prefix="USD"
                  />
                  <NumInput
                    label="Costos de entrada"
                    value={cfg.costosEntrada}
                    onChange={(v) => set("costosEntrada", v)}
                    min={0}
                    max={20}
                    step={0.5}
                    suffix="%"
                    note="escritura + comisiones"
                  />
                  <NumInput
                    label="Alquiler mensual inicial"
                    value={cfg.alquilerMensual}
                    onChange={(v) => set("alquilerMensual", v)}
                    min={0}
                    step={50}
                    prefix="USD"
                  />
                  <NumInput
                    label="Ajuste anual del alquiler"
                    value={cfg.ajusteAlquilerAnual}
                    onChange={(v) => set("ajusteAlquilerAnual", v)}
                    min={0}
                    max={50}
                    step={0.5}
                    suffix="%"
                    note="en USD"
                  />
                  <NumInput
                    label="Gastos anuales del propietario"
                    value={cfg.gastosAnualesPct}
                    onChange={(v) => set("gastosAnualesPct", v)}
                    min={0}
                    max={10}
                    step={0.5}
                    suffix="% del valor"
                    note="ABL, expensas, mantenimiento"
                  />
                  <NumInput
                    label="Revalorización anual"
                    value={cfg.revalorizacionAnual}
                    onChange={(v) => set("revalorizacionAnual", v)}
                    min={-10}
                    max={30}
                    step={0.5}
                    suffix="%"
                  />
                  <NumInput
                    label="Vacancy rate"
                    value={cfg.vacancyRate}
                    onChange={(v) => set("vacancyRate", v)}
                    min={0}
                    max={50}
                    step={1}
                    suffix="%"
                    note="% del tiempo vacío por año"
                  />
                </SectionCard>

                {/* Opción B — FCI ARS */}
                <SectionCard title="Opción B — FCI en ARS" color="#22c55e">
                  {/* Radio buttons */}
                  <div style={{ marginBottom: 14 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "#9ca3af",
                        marginBottom: 8,
                      }}
                    >
                      Tipo de fondo
                    </label>
                    {(
                      [
                        {
                          id: "mm" as FCIArsType,
                          label: "Money Market",
                          note: "muy líquido, bajo riesgo",
                        },
                        {
                          id: "rf" as FCIArsType,
                          label: "Renta Fija",
                          note: "riesgo bajo-medio",
                        },
                        {
                          id: "acc" as FCIArsType,
                          label: "Acciones",
                          note: "mayor potencial, alta volatilidad",
                        },
                      ] as { id: FCIArsType; label: string; note: string }[]
                    ).map((opt) => (
                      <label
                        key={opt.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          color: cfg.fciArsType === opt.id ? "#e0e0e0" : "#9ca3af",
                        }}
                      >
                        <input
                          type="radio"
                          name="fciArsType"
                          value={opt.id}
                          checked={cfg.fciArsType === opt.id}
                          onChange={() => set("fciArsType", opt.id)}
                          style={{ accentColor: "#22c55e" }}
                        />
                        <strong>{opt.label}</strong>
                        <span style={{ color: "#6b7280", fontSize: 12 }}>
                          — {opt.note}
                        </span>
                      </label>
                    ))}
                  </div>

                  <NumInput
                    label="Money Market — TNA"
                    value={cfg.tnaMoneyMarket}
                    onChange={(v) => set("tnaMoneyMarket", v)}
                    min={0}
                    max={200}
                    step={1}
                    suffix="% TNA"
                  />
                  <NumInput
                    label="Renta Fija — TNA"
                    value={cfg.tnaRentaFija}
                    onChange={(v) => set("tnaRentaFija", v)}
                    min={0}
                    max={200}
                    step={1}
                    suffix="% TNA"
                  />
                  <NumInput
                    label="Acciones — Retorno anual esperado"
                    value={cfg.retornoAcciones}
                    onChange={(v) => set("retornoAcciones", v)}
                    min={0}
                    max={300}
                    step={1}
                    suffix="%"
                  />
                  <NumInput
                    label="Acciones — Volatilidad"
                    value={cfg.volatAcciones}
                    onChange={(v) => set("volatAcciones", v)}
                    min={0}
                    max={100}
                    step={1}
                    suffix="±%"
                  />
                  <NumInput
                    label="Inflación ARS anual"
                    value={cfg.inflacionArs}
                    onChange={(v) => set("inflacionArs", v)}
                    min={0}
                    max={500}
                    step={1}
                    suffix="%"
                    note="para calcular retorno real"
                  />
                </SectionCard>

                {/* Opción C — FCI USD */}
                <SectionCard title="Opción C — FCI en USD" color="#3b82f6">
                  <NumInput
                    label="Retorno anual en USD"
                    value={cfg.retornoFciUsd}
                    onChange={(v) => set("retornoFciUsd", v)}
                    min={0}
                    max={100}
                    step={0.5}
                    suffix="%"
                    note="Cedears o globales"
                  />
                  <NumInput
                    label="Volatilidad"
                    value={cfg.volatFciUsd}
                    onChange={(v) => set("volatFciUsd", v)}
                    min={0}
                    max={80}
                    step={1}
                    suffix="±%"
                  />
                  <NumInput
                    label="Comisión anual del fondo"
                    value={cfg.comisionFciUsd}
                    onChange={(v) => set("comisionFciUsd", v)}
                    min={0}
                    max={5}
                    step={0.1}
                    suffix="% sobre AUM"
                  />
                </SectionCard>
              </div>

              {/* Result Cards */}
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#fff",
                  margin: "0 0 16px",
                }}
              >
                Resultados comparativos — {cfg.horizonte} años
              </h2>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <ResultCard
                  label="Inmueble en alquiler"
                  valorFinal={inmuebleFinal}
                  cagrVal={inmuebleCAGR}
                  retornoReal={inmuebleReal}
                  liquidez="Baja (90 días)"
                  color="#cc0000"
                  isBestReturn={bestReturnLabel === "Inmueble"}
                  isBestLiquidity={false}
                  capital={cfg.capital}
                />
                <ResultCard
                  label={`FCI ARS — ${cfg.fciArsType === "mm" ? "Money Market" : cfg.fciArsType === "rf" ? "Renta Fija" : "Acciones"}`}
                  valorFinal={fciArsFinal}
                  cagrVal={fciArsCAGR}
                  retornoReal={fciArsReal}
                  liquidez="Alta (24-48hs)"
                  color="#22c55e"
                  isBestReturn={bestReturnLabel === "FCI ARS"}
                  isBestLiquidity={true}
                  capital={cfg.capital}
                />
                <ResultCard
                  label="FCI USD (Cedears/Global)"
                  valorFinal={fciUsdFinal}
                  cagrVal={fciUsdCAGR}
                  retornoReal={fciUsdReal}
                  liquidez="Alta (48-72hs)"
                  color="#3b82f6"
                  isBestReturn={bestReturnLabel === "FCI USD"}
                  isBestLiquidity={false}
                  capital={cfg.capital}
                />
              </div>

              {/* Note */}
              <p
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginTop: 16,
                  fontFamily: "Inter, sans-serif",
                  lineHeight: 1.6,
                }}
              >
                * El retorno real se calcula descontando inflación USD del 3%
                anual. FCI ARS muestra retorno real en USD (ajustado por
                depreciación del peso estimada con inflación ARS configurada).
                Los resultados son proyecciones basadas en supuestos ingresados y
                no constituyen asesoramiento financiero.
              </p>
            </div>
          )}

          {/* ── TAB 2: Evolución ── */}
          {tab === "evolucion" && (
            <div>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#fff",
                  margin: "0 0 20px",
                }}
              >
                Evolución comparativa (10 años)
              </h2>

              <ChartEvolucion rows={series} horizonte={cfg.horizonte} />

              {/* Table */}
              <div style={{ overflowX: "auto", marginTop: 24 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#1a1a1a" }}>
                      {[
                        "Año",
                        "Inmueble Valor",
                        "Alquiler Acum.",
                        "Total Inmueble",
                        "FCI ARS (USD real)",
                        "FCI USD",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 12px",
                            textAlign: "right",
                            color: "#9ca3af",
                            fontWeight: 600,
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
                    {series.slice(0, cfg.horizonte + 1).map((row, idx) => {
                      const total = row.inmuebleValor + row.alquilerAcum;
                      const isHighlight = idx > 0 && idx === cfg.horizonte;
                      return (
                        <tr
                          key={row.year}
                          style={{
                            background: isHighlight
                              ? "#1a1a1a"
                              : idx % 2 === 0
                                ? "transparent"
                                : "#111",
                            borderBottom: "1px solid #1a1a1a",
                          }}
                        >
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              color: "#9ca3af",
                              fontWeight: isHighlight ? 700 : 400,
                            }}
                          >
                            {row.year}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              color: "#cc0000",
                            }}
                          >
                            {fmtUSD(row.inmuebleValor)}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              color: "#f97316",
                            }}
                          >
                            {fmtUSD(row.alquilerAcum)}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              color: "#e0e0e0",
                              fontWeight: isHighlight ? 700 : 400,
                            }}
                          >
                            {fmtUSD(total)}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              color: "#22c55e",
                            }}
                          >
                            {fmtUSD(row.fciArsTotal)}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              color: "#3b82f6",
                            }}
                          >
                            {fmtUSD(row.fciUsdTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 3: Break-even ── */}
          {tab === "breakeven" && (
            <div>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#fff",
                  margin: "0 0 20px",
                }}
              >
                Análisis de Break-even
              </h2>

              {/* Crossover card */}
              <div
                style={{
                  background: "#111",
                  border: "2px solid #cc0000",
                  borderRadius: 10,
                  padding: "20px 24px",
                  marginBottom: 24,
                  maxWidth: 480,
                }}
              >
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#cc0000",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                  }}
                >
                  Punto de cruce FCI USD vs. Inmueble
                </div>
                {crossoverYear !== null ? (
                  <>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: 32,
                        color: "#fff",
                        marginBottom: 6,
                      }}
                    >
                      Año {crossoverYear}
                    </div>
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>
                      {beSeriesFciUsd[crossoverYear].fciUsdTotal >
                      beSeriesImmueble[crossoverYear].inmuebleValor +
                        beSeriesImmueble[crossoverYear].alquilerAcum
                        ? "El FCI USD supera al inmueble a partir de este año"
                        : "El inmueble supera al FCI USD a partir de este año"}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 14, color: "#9ca3af" }}>
                    No hay cruce en el horizonte de 10 años con los parámetros
                    actuales.
                    <br />
                    <span style={{ color: "#6b7280", fontSize: 12 }}>
                      {beSeriesFciUsd[10].fciUsdTotal >
                      beSeriesImmueble[10].inmuebleValor +
                        beSeriesImmueble[10].alquilerAcum
                        ? "FCI USD lidera en todo el periodo"
                        : "Inmueble lidera en todo el periodo"}
                    </span>
                  </div>
                )}
              </div>

              {/* Sliders */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: "16px",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#9ca3af",
                      marginBottom: 6,
                    }}
                  >
                    Ajuste retorno FCI USD:{" "}
                    <strong style={{ color: "#3b82f6" }}>
                      {beRetornoFciDelta >= 0 ? "+" : ""}
                      {beRetornoFciDelta} puntos
                    </strong>{" "}
                    (base: {cfg.retornoFciUsd}% →{" "}
                    {cfg.retornoFciUsd + beRetornoFciDelta}%)
                  </label>
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={1}
                    value={beRetornoFciDelta}
                    onChange={(e) =>
                      setBeRetornoFciDelta(Number(e.target.value))
                    }
                    style={{ width: "100%", accentColor: "#3b82f6" }}
                  />
                </div>
                <div
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: "16px",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#9ca3af",
                      marginBottom: 6,
                    }}
                  >
                    Ajuste revalorización inmueble:{" "}
                    <strong style={{ color: "#cc0000" }}>
                      {beRevaloInmDelta >= 0 ? "+" : ""}
                      {beRevaloInmDelta} puntos
                    </strong>{" "}
                    (base: {cfg.revalorizacionAnual}% →{" "}
                    {cfg.revalorizacionAnual + beRevaloInmDelta}%)
                  </label>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={1}
                    value={beRevaloInmDelta}
                    onChange={(e) =>
                      setBeRevaloInmDelta(Number(e.target.value))
                    }
                    style={{ width: "100%", accentColor: "#cc0000" }}
                  />
                </div>
              </div>

              {/* Sensitivity table */}
              <h3
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#e0e0e0",
                  margin: "0 0 12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Tabla de sensibilidad — ganador a 10 años
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 14,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Retorno FCI USD (filas) × Revalorización inmueble (columnas)
              </p>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    borderCollapse: "collapse",
                    fontSize: 13,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          padding: "10px 14px",
                          background: "#1a1a1a",
                          color: "#6b7280",
                          border: "1px solid #222",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        FCI USD \ Inm.
                      </th>
                      {invRevDelta.map((id) => (
                        <th
                          key={id}
                          style={{
                            padding: "10px 14px",
                            background: "#1a1a1a",
                            color: "#cc0000",
                            border: "1px solid #222",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Reval. {cfg.revalorizacionAnual + id}%
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitTable.map((row, ri) => (
                      <tr key={ri}>
                        <td
                          style={{
                            padding: "10px 14px",
                            background: "#1a1a1a",
                            color: "#3b82f6",
                            border: "1px solid #222",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          FCI {cfg.retornoFciUsd + fciRetDelta[ri]}%
                        </td>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            style={{
                              padding: "10px 14px",
                              border: "1px solid #222",
                              textAlign: "center",
                              background:
                                cell.winner === "FCI USD"
                                  ? "rgba(59,130,246,0.15)"
                                  : "rgba(204,0,0,0.12)",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                color:
                                  cell.winner === "FCI USD"
                                    ? "#3b82f6"
                                    : "#cc0000",
                                fontSize: 13,
                                marginBottom: 2,
                              }}
                            >
                              {cell.winner}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>
                              Inm: {fmtUSD(cell.inmVal)}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>
                              FCI: {fmtUSD(cell.fciVal)}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
