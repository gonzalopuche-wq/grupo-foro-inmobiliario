"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n: number, dec = 0): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function cuotaFrances(capital: number, tnaAnual: number, plazoMeses: number): number {
  if (capital <= 0 || plazoMeses <= 0) return 0;
  const tem = tnaAnual / 100 / 12;
  if (tem === 0) return capital / plazoMeses;
  return (capital * tem * Math.pow(1 + tem, plazoMeses)) / (Math.pow(1 + tem, plazoMeses) - 1);
}

/** Computes IRR via Newton-Raphson (monthly cashflows). Returns annualized %. */
function calcIRR(cashflows: number[]): number {
  let rate = 0.01;
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0;
    let dnpv = 0;
    cashflows.forEach((cf, t) => {
      const disc = Math.pow(1 + rate, t);
      npv += cf / disc;
      dnpv -= (t * cf) / (disc * (1 + rate));
    });
    const newRate = rate - npv / dnpv;
    if (!isFinite(newRate)) break;
    if (Math.abs(newRate - rate) < 1e-9) {
      rate = newRate;
      break;
    }
    rate = newRate;
  }
  return (Math.pow(1 + rate, 12) - 1) * 100; // annualized %
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Moneda = "ARS" | "USD";
type TipoHipoteca = "uva" | "peso_fijo";
type Tab = "comparacion" | "evolucion" | "sensibilidad";

interface FilaAnual {
  anio: number;
  saldoActual: number;
  cuotaActual: number;
  saldoNuevo: number;
  cuotaNueva: number;
  ahorroMensual: number;
  ahorroAcumulado: number;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  page: {
    background: "#0a0a0a",
    minHeight: "100vh",
    color: "#e0e0e0",
    fontFamily: "'Inter', sans-serif",
    padding: "24px 16px 80px",
    maxWidth: 960,
    margin: "0 auto",
  } as React.CSSProperties,
  title: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    fontSize: 26,
    color: "#ffffff",
    marginBottom: 4,
  } as React.CSSProperties,
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 24,
  } as React.CSSProperties,
  card: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  } as React.CSSProperties,
  cardTitle: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: 13,
    color: "#cc0000",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: 14,
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 600,
    display: "block",
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,
  input: {
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    padding: "7px 10px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box" as const,
    outline: "none",
  } as React.CSSProperties,
  select: {
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    padding: "7px 10px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box" as const,
    outline: "none",
  } as React.CSSProperties,
  row: {
    display: "grid",
    gap: 12,
  } as React.CSSProperties,
  fieldGroup: {
    marginBottom: 10,
  } as React.CSSProperties,
  tabBar: {
    display: "flex",
    gap: 4,
    marginBottom: 20,
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 10,
    padding: 4,
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "9px 12px",
    borderRadius: 7,
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Montserrat', sans-serif",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    background: active ? "#cc0000" : "transparent",
    color: active ? "#fff" : "#6b7280",
    transition: "all 0.15s",
  }),
  resultCard: (color: string): React.CSSProperties => ({
    background: "#111111",
    border: `1px solid ${color}33`,
    borderRadius: 10,
    padding: "14px 18px",
    textAlign: "center" as const,
  }),
  resultValue: (color: string): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    fontSize: 22,
    color,
    display: "block",
  }),
  resultLabel: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginTop: 2,
    display: "block",
  } as React.CSSProperties,
  badge: (ok: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Montserrat', sans-serif",
    letterSpacing: "0.06em",
    background: ok ? "#166534" : "#7f1d1d",
    color: ok ? "#86efac" : "#fca5a5",
    border: `1px solid ${ok ? "#16a34a" : "#dc2626"}`,
  }),
  th: {
    padding: "8px 10px",
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid #222222",
    textAlign: "right" as const,
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  td: {
    padding: "7px 10px",
    fontSize: 12,
    color: "#e0e0e0",
    borderBottom: "1px solid #1a1a1a",
    textAlign: "right" as const,
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Sensitivity cell color
// ---------------------------------------------------------------------------
function cellColor(meses: number): string {
  if (meses <= 0 || !isFinite(meses)) return "#1a3a1a";
  if (meses < 12) return "#14532d";
  if (meses <= 24) return "#713f12";
  return "#7f1d1d";
}
function cellTextColor(meses: number): string {
  if (meses <= 0 || !isFinite(meses)) return "#86efac";
  if (meses < 12) return "#86efac";
  if (meses <= 24) return "#fde68a";
  return "#fca5a5";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RefinanciacionHipotecaPage() {
  const [activeTab, setActiveTab] = useState<Tab>("comparacion");

  // — Hipoteca actual —
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [saldoDeuda, setSaldoDeuda] = useState(20000000);
  const [tnaActual, setTnaActual] = useState(8.5);
  const [plazoActual, setPlazoActual] = useState(240);
  const [tipoHipoteca, setTipoHipoteca] = useState<TipoHipoteca>("uva");
  const [tipoCambio, setTipoCambio] = useState(1350);

  // — Nueva hipoteca —
  const [tnaNueva, setTnaNueva] = useState(6.5);
  const [plazoNuevo, setPlazoNuevo] = useState(240);
  const [comisionPct, setComisionPct] = useState(1);
  const [gastosNotariales, setGastosNotariales] = useState(150000);
  const [seguroMensual, setSeguroMensual] = useState(8000);
  const [periodoGracia, setPeriodoGracia] = useState(0);

  // — Sensibilidad / UVA —
  const [inflacionUVA, setInflacionUVA] = useState(85);

  // — Derived: saldo en ARS —
  const saldoARS = moneda === "USD" ? saldoDeuda * tipoCambio : saldoDeuda;

  const results = useMemo(() => {
    if (saldoARS <= 0 || plazoActual <= 0 || plazoNuevo <= 0) return null;

    // Cuota actual (sistema francés)
    const cuotaActual = cuotaFrances(saldoARS, tnaActual, plazoActual);

    // Costo de refinanciación (pago único al inicio)
    const costoComision = saldoARS * (comisionPct / 100);
    const costoTotal = costoComision + gastosNotariales;

    // Cuota nueva (sin seguro)
    const cuotaNueva = cuotaFrances(saldoARS, tnaNueva, plazoNuevo) + seguroMensual;

    // Ahorro mensual efectivo (después del período de gracia)
    const ahorroMensual = cuotaActual - cuotaNueva;

    // Período de recupero
    let mesesRecupero = Infinity;
    if (ahorroMensual > 0) {
      mesesRecupero = costoTotal / ahorroMensual + periodoGracia;
    }

    // Deuda total
    const deudaTotalActual = cuotaActual * plazoActual;
    const deudaTotalNueva = (cuotaFrances(saldoARS, tnaNueva, plazoNuevo) * plazoNuevo) + (seguroMensual * plazoNuevo) + costoTotal;

    // Ahorro total = diferencia en deuda total
    const ahorroTotal = deudaTotalActual - deudaTotalNueva;

    // TIR: cashflows = [-costo inicial, ahorro mes 1, ahorro mes 2, ...]
    let tirAnual = 0;
    if (ahorroMensual > 0 && costoTotal > 0) {
      const cfMeses = Math.min(plazoNuevo, 120);
      const cashflows: number[] = [-costoTotal];
      for (let m = 1; m <= cfMeses; m++) {
        cashflows.push(m <= periodoGracia ? 0 : ahorroMensual);
      }
      try {
        tirAnual = calcIRR(cashflows);
      } catch {
        tirAnual = 0;
      }
    }

    // Badge
    const conviene = mesesRecupero < 24 && ahorroTotal > 0;

    return {
      cuotaActual,
      cuotaNueva,
      ahorroMensual,
      ahorroTotal,
      costoTotal,
      costoComision,
      mesesRecupero,
      deudaTotalActual,
      deudaTotalNueva,
      tirAnual,
      conviene,
    };
  }, [
    saldoARS,
    tnaActual,
    plazoActual,
    tnaNueva,
    plazoNuevo,
    comisionPct,
    gastosNotariales,
    seguroMensual,
    periodoGracia,
  ]);

  // — Evolution data —
  const evolutionData = useMemo((): FilaAnual[] => {
    if (!results) return [];
    const filas: FilaAnual[] = [];
    const maxAnios = Math.ceil(Math.max(plazoActual, plazoNuevo) / 12);
    const temActual = tnaActual / 100 / 12;
    const temNueva = tnaNueva / 100 / 12;

    let saldoA = saldoARS;
    let saldoN = saldoARS;
    let acumActual = 0;
    let acumNuevo = results.costoTotal;
    let ahorroAcum = -results.costoTotal;

    for (let a = 1; a <= maxAnios; a++) {
      for (let m = 0; m < 12; m++) {
        const mesGlobal = (a - 1) * 12 + m;

        // Actual
        if (mesGlobal < plazoActual) {
          const intA = saldoA * temActual;
          const capA = results.cuotaActual - intA;
          saldoA = Math.max(0, saldoA - capA);
          acumActual += results.cuotaActual;
        }

        // Nuevo
        if (mesGlobal < plazoNuevo) {
          const cuotaBase = cuotaFrances(saldoARS, tnaNueva, plazoNuevo);
          const intN = saldoN * temNueva;
          const capN = cuotaBase - intN;
          saldoN = Math.max(0, saldoN - capN);
          acumNuevo += cuotaBase + seguroMensual;
          const ahorro = mesGlobal >= periodoGracia ? results.cuotaActual - results.cuotaNueva : 0;
          ahorroAcum += ahorro;
        }
      }

      filas.push({
        anio: a,
        saldoActual: Math.max(0, saldoA),
        cuotaActual: acumActual,
        saldoNuevo: Math.max(0, saldoN),
        cuotaNueva: acumNuevo,
        ahorroMensual: results.ahorroMensual,
        ahorroAcumulado: ahorroAcum,
      });
    }
    return filas;
  }, [results, saldoARS, tnaActual, plazoActual, tnaNueva, plazoNuevo, seguroMensual, periodoGracia]);

  // — SVG chart data —
  const svgData = useMemo(() => {
    if (!results) return null;
    const W = 720;
    const H = 300;
    const PAD = { top: 20, right: 20, bottom: 40, left: 80 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const maxMeses = Math.max(plazoActual, plazoNuevo);
    const temActual = tnaActual / 100 / 12;
    const temNueva = tnaNueva / 100 / 12;

    const points = {
      saldoActual: [] as [number, number][],
      acumActual: [] as [number, number][],
      saldoNuevo: [] as [number, number][],
      acumNuevo: [] as [number, number][],
    };

    let sA = saldoARS;
    let sN = saldoARS;
    let acA = 0;
    let acN = results.costoTotal;

    points.saldoActual.push([0, saldoARS]);
    points.acumActual.push([0, 0]);
    points.saldoNuevo.push([0, saldoARS]);
    points.acumNuevo.push([0, results.costoTotal]);

    const step = Math.max(1, Math.floor(maxMeses / 60));
    const cuotaBase = cuotaFrances(saldoARS, tnaNueva, plazoNuevo);

    for (let m = 1; m <= maxMeses; m++) {
      if (m <= plazoActual) {
        const int = sA * temActual;
        const cap = results.cuotaActual - int;
        sA = Math.max(0, sA - cap);
        acA += results.cuotaActual;
      }
      if (m <= plazoNuevo) {
        const int = sN * temNueva;
        const cap = cuotaBase - int;
        sN = Math.max(0, sN - cap);
        acN += cuotaBase + seguroMensual;
      }
      if (m % step === 0 || m === maxMeses) {
        points.saldoActual.push([m, Math.max(0, sA)]);
        points.acumActual.push([m, acA]);
        points.saldoNuevo.push([m, Math.max(0, sN)]);
        points.acumNuevo.push([m, acN]);
      }
    }

    const allVals = [
      ...points.saldoActual.map((p) => p[1]),
      ...points.acumActual.map((p) => p[1]),
      ...points.saldoNuevo.map((p) => p[1]),
      ...points.acumNuevo.map((p) => p[1]),
    ];
    const maxVal = Math.max(...allVals);

    function toSVG(m: number, v: number): [number, number] {
      const x = PAD.left + (m / maxMeses) * innerW;
      const y = PAD.top + innerH - (v / (maxVal || 1)) * innerH;
      return [x, y];
    }

    function toPath(pts: [number, number][]): string {
      return pts.map(([m, v], i) => {
        const [x, y] = toSVG(m, v);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
    }

    // Find crossover month (acumActual < acumNuevo transition)
    let crossoverX: number | null = null;
    for (let i = 1; i < points.acumActual.length; i++) {
      const prevA = points.acumActual[i - 1][1];
      const prevN = points.acumNuevo[i - 1][1];
      const currA = points.acumActual[i][1];
      const currN = points.acumNuevo[i][1];
      if (prevA <= prevN && currA > currN) {
        const m = points.acumActual[i][0];
        const [x] = toSVG(m, 0);
        crossoverX = x;
        break;
      }
    }

    // Y axis ticks
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
      const val = (maxVal / tickCount) * i;
      const [, y] = toSVG(0, val);
      return { val, y };
    });

    // X axis ticks
    const xTicks: { m: number; x: number }[] = [];
    const xStep = Math.ceil(maxMeses / 6 / 12) * 12;
    for (let m = 0; m <= maxMeses; m += xStep) {
      const [x] = toSVG(m, 0);
      xTicks.push({ m, x });
    }

    return {
      W,
      H,
      PAD,
      paths: {
        saldoActual: toPath(points.saldoActual),
        acumActual: toPath(points.acumActual),
        saldoNuevo: toPath(points.saldoNuevo),
        acumNuevo: toPath(points.acumNuevo),
      },
      crossoverX,
      ticks,
      xTicks,
      maxVal,
      innerH,
    };
  }, [results, saldoARS, tnaActual, plazoActual, tnaNueva, plazoNuevo, seguroMensual]);

  // — Sensitivity matrix —
  const tasasEje = useMemo(() => {
    const base = tnaNueva;
    return [base - 3, base - 2, base - 1, base, base + 0.5];
  }, [tnaNueva]);

  const costosEje = [0, 0.5, 1, 1.5, 2]; // % del saldo

  function calcRecuperoSens(tasaPct: number, costoPct: number): number {
    if (saldoARS <= 0) return Infinity;
    const cuotaA = cuotaFrances(saldoARS, tnaActual, plazoActual);
    const cuotaN = cuotaFrances(saldoARS, tasaPct, plazoNuevo) + seguroMensual;
    const ahorro = cuotaA - cuotaN;
    const costo = saldoARS * (costoPct / 100) + gastosNotariales;
    if (ahorro <= 0) return Infinity;
    return costo / ahorro;
  }

  // — UVA inflation projection —
  const inflacionEscenarios = [
    { label: "85% anual", pct: 85, color: "#f97316" },
    { label: "100% anual", pct: 100, color: "#a855f7" },
    { label: "120% anual", pct: 120, color: "#cc0000" },
  ];

  function cuotaUVAEnMes(inflPct: number, mes: number): number {
    const cuotaUVAInicial = cuotaFrances(saldoARS, tnaActual, plazoActual);
    const inflMensual = Math.pow(1 + inflPct / 100, 1 / 12) - 1;
    return cuotaUVAInicial * Math.pow(1 + inflMensual, mes);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={S.page}>
      {/* Header */}
      <Link
        href="/calculadoras"
        style={{ color: "#cc0000", fontSize: 12, textDecoration: "none", display: "inline-block", marginBottom: 12 }}
      >
        ← Volver a Calculadoras
      </Link>
      <h1 style={S.title}>Refinanciación Hipotecaria</h1>
      <p style={S.subtitle}>
        ¿Conviene refinanciar tu hipoteca actual por una nueva con mejor tasa?
      </p>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {(
          [
            { key: "comparacion", label: "Hipoteca Actual vs. Nueva" },
            { key: "evolucion", label: "Evolución Comparativa" },
            { key: "sensibilidad", label: "Sensibilidad" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button key={t.key} style={S.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ================================================================ TAB 1 */}
      {activeTab === "comparacion" && (
        <div>
          {/* Inputs grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            {/* Hipoteca actual */}
            <div style={S.card}>
              <div style={S.cardTitle}>Hipoteca Actual</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Moneda</label>
                  <select
                    style={S.select}
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value as Moneda)}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Tipo</label>
                  <select
                    style={S.select}
                    value={tipoHipoteca}
                    onChange={(e) => setTipoHipoteca(e.target.value as TipoHipoteca)}
                  >
                    <option value="uva">UVA</option>
                    <option value="peso_fijo">Peso Fijo</option>
                  </select>
                </div>
              </div>

              {moneda === "USD" && (
                <div style={S.fieldGroup}>
                  <label style={S.label}>Tipo de Cambio (ARS/USD)</label>
                  <input
                    type="number"
                    style={S.input}
                    value={tipoCambio}
                    onChange={(e) => setTipoCambio(Number(e.target.value))}
                    min={1}
                  />
                </div>
              )}

              <div style={S.fieldGroup}>
                <label style={S.label}>
                  Saldo de Deuda Actual ({moneda})
                </label>
                <input
                  type="number"
                  style={S.input}
                  value={saldoDeuda}
                  onChange={(e) => setSaldoDeuda(Number(e.target.value))}
                  min={0}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Tasa Anual Actual (%)</label>
                  <input
                    type="number"
                    style={S.input}
                    value={tnaActual}
                    onChange={(e) => setTnaActual(Number(e.target.value))}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Plazo Restante (meses)</label>
                  <input
                    type="number"
                    style={S.input}
                    value={plazoActual}
                    onChange={(e) => setPlazoActual(Number(e.target.value))}
                    min={1}
                  />
                </div>
              </div>

              {results && (
                <div
                  style={{
                    background: "#0a0a0a",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "8px 12px",
                    marginTop: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Cuota mensual actual</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e0" }}>
                    ARS {fmt(results.cuotaActual)}
                  </span>
                </div>
              )}
            </div>

            {/* Nueva hipoteca */}
            <div style={S.card}>
              <div style={S.cardTitle}>Nueva Hipoteca (Refinanciación)</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Nueva Tasa Anual (%)</label>
                  <input
                    type="number"
                    style={S.input}
                    value={tnaNueva}
                    onChange={(e) => setTnaNueva(Number(e.target.value))}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Nuevo Plazo (meses)</label>
                  <input
                    type="number"
                    style={S.input}
                    value={plazoNuevo}
                    onChange={(e) => setPlazoNuevo(Number(e.target.value))}
                    min={1}
                  />
                </div>
              </div>

              <div style={S.fieldGroup}>
                <label style={S.label}>Comisión Bancaria (% del saldo)</label>
                <input
                  type="number"
                  style={S.input}
                  value={comisionPct}
                  onChange={(e) => setComisionPct(Number(e.target.value))}
                  step={0.1}
                  min={0}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Gastos Notariales (ARS)</label>
                  <input
                    type="number"
                    style={S.input}
                    value={gastosNotariales}
                    onChange={(e) => setGastosNotariales(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Seguro (ARS/mes)</label>
                  <input
                    type="number"
                    style={S.input}
                    value={seguroMensual}
                    onChange={(e) => setSeguroMensual(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>

              <div style={S.fieldGroup}>
                <label style={S.label}>Período de Gracia (meses)</label>
                <input
                  type="number"
                  style={S.input}
                  value={periodoGracia}
                  onChange={(e) => setPeriodoGracia(Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Results */}
          {results && (
            <>
              {/* Verdict badge */}
              <div style={{ ...S.card, textAlign: "center", padding: "20px 20px" }}>
                <div style={{ marginBottom: 10 }}>
                  <span style={S.badge(results.conviene)}>
                    {results.conviene ? "✓ CONVIENE REFINANCIAR" : "✗ NO CONVIENE"}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                  {results.conviene
                    ? `Período de recupero: ${fmt(results.mesesRecupero)} meses — el ahorro neto es positivo`
                    : results.mesesRecupero === Infinity
                    ? "La nueva cuota es mayor que la actual — no hay ahorro"
                    : `El período de recupero de ${fmt(results.mesesRecupero)} meses supera los 24 meses recomendados`}
                </p>
              </div>

              {/* Key metrics grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div style={S.resultCard("#3b82f6")}>
                  <span style={S.resultValue("#3b82f6")}>ARS {fmt(results.cuotaNueva)}</span>
                  <span style={S.resultLabel}>Nueva Cuota Mensual</span>
                </div>
                <div style={S.resultCard(results.ahorroMensual >= 0 ? "#22c55e" : "#cc0000")}>
                  <span
                    style={S.resultValue(results.ahorroMensual >= 0 ? "#22c55e" : "#cc0000")}
                  >
                    ARS {fmt(Math.abs(results.ahorroMensual))}
                  </span>
                  <span style={S.resultLabel}>
                    {results.ahorroMensual >= 0 ? "Ahorro Mensual" : "Costo Extra / Mes"}
                  </span>
                </div>
                <div style={S.resultCard(results.ahorroTotal >= 0 ? "#22c55e" : "#cc0000")}>
                  <span
                    style={S.resultValue(results.ahorroTotal >= 0 ? "#22c55e" : "#cc0000")}
                  >
                    ARS {fmt(Math.abs(results.ahorroTotal))}
                  </span>
                  <span style={S.resultLabel}>
                    {results.ahorroTotal >= 0 ? "Ahorro Total" : "Costo Total Extra"}
                  </span>
                </div>
                <div style={S.resultCard("#f97316")}>
                  <span style={S.resultValue("#f97316")}>ARS {fmt(results.costoTotal)}</span>
                  <span style={S.resultLabel}>Costo de Refinanciación</span>
                </div>
                <div style={S.resultCard("#a855f7")}>
                  <span style={S.resultValue("#a855f7")}>
                    {isFinite(results.mesesRecupero) ? `${fmt(results.mesesRecupero)} m` : "∞"}
                  </span>
                  <span style={S.resultLabel}>Período de Recupero</span>
                </div>
                <div style={S.resultCard("#06b6d4")}>
                  <span style={S.resultValue("#06b6d4")}>
                    {isFinite(results.tirAnual) && results.tirAnual > 0
                      ? `${fmt(results.tirAnual, 1)}%`
                      : "—"}
                  </span>
                  <span style={S.resultLabel}>TIR Anualizada</span>
                </div>
              </div>

              {/* Deuda total comparison */}
              <div style={S.card}>
                <div style={S.cardTitle}>Deuda Total a Pagar</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                      Hipoteca Actual (capital + intereses)
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif",
                        color: "#cc0000",
                      }}
                    >
                      ARS {fmt(results.deudaTotalActual)}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Intereses: ARS {fmt(results.deudaTotalActual - saldoARS)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                      Nueva Hipoteca (capital + intereses + costos)
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif",
                        color: "#3b82f6",
                      }}
                    >
                      ARS {fmt(results.deudaTotalNueva)}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                      Costos refinanciación: ARS {fmt(results.costoTotal)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================ TAB 2 */}
      {activeTab === "evolucion" && (
        <div>
          {!results ? (
            <div style={{ ...S.card, color: "#6b7280", textAlign: "center" }}>
              Ingresá los datos en la pestaña anterior para ver la evolución.
            </div>
          ) : (
            <>
              {/* SVG Chart */}
              <div style={{ ...S.card, overflowX: "auto" }}>
                <div style={S.cardTitle}>Evolución Comparativa</div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12, fontSize: 11 }}>
                  {[
                    { color: "#cc0000", dash: false, label: "Saldo deuda actual" },
                    { color: "#cc0000", dash: true, label: "Cuota acumulada actual" },
                    { color: "#3b82f6", dash: false, label: "Saldo deuda nueva" },
                    { color: "#3b82f6", dash: true, label: "Cuota acumulada + costos" },
                  ].map((l) => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width={24} height={10}>
                        <line
                          x1={0}
                          y1={5}
                          x2={24}
                          y2={5}
                          stroke={l.color}
                          strokeWidth={2}
                          strokeDasharray={l.dash ? "4 3" : undefined}
                        />
                      </svg>
                      <span style={{ color: "#9ca3af" }}>{l.label}</span>
                    </div>
                  ))}
                </div>

                {svgData && (
                  <svg
                    viewBox={`0 0 ${svgData.W} ${svgData.H}`}
                    style={{ width: "100%", maxWidth: svgData.W, display: "block" }}
                  >
                    {/* Grid lines */}
                    {svgData.ticks.map((t, i) => (
                      <g key={i}>
                        <line
                          x1={svgData.PAD.left}
                          y1={t.y}
                          x2={svgData.W - svgData.PAD.right}
                          y2={t.y}
                          stroke="#1f1f1f"
                          strokeWidth={1}
                        />
                        <text
                          x={svgData.PAD.left - 6}
                          y={t.y + 4}
                          textAnchor="end"
                          fontSize={9}
                          fill="#4b5563"
                        >
                          {t.val >= 1_000_000
                            ? `${fmt(t.val / 1_000_000, 1)}M`
                            : `${fmt(t.val / 1_000)}K`}
                        </text>
                      </g>
                    ))}

                    {/* X ticks */}
                    {svgData.xTicks.map((t, i) => (
                      <g key={i}>
                        <line
                          x1={t.x}
                          y1={svgData.PAD.top}
                          x2={t.x}
                          y2={svgData.PAD.top + svgData.innerH}
                          stroke="#1a1a1a"
                          strokeWidth={1}
                        />
                        <text
                          x={t.x}
                          y={svgData.PAD.top + svgData.innerH + 16}
                          textAnchor="middle"
                          fontSize={9}
                          fill="#4b5563"
                        >
                          {t.m}m
                        </text>
                      </g>
                    ))}

                    {/* Crossover line */}
                    {svgData.crossoverX !== null && (
                      <>
                        <line
                          x1={svgData.crossoverX}
                          y1={svgData.PAD.top}
                          x2={svgData.crossoverX}
                          y2={svgData.PAD.top + svgData.innerH}
                          stroke="#6b7280"
                          strokeWidth={1}
                          strokeDasharray="4 3"
                        />
                        <text
                          x={svgData.crossoverX + 4}
                          y={svgData.PAD.top + 12}
                          fontSize={9}
                          fill="#6b7280"
                        >
                          Punto recupero
                        </text>
                      </>
                    )}

                    {/* Paths */}
                    <path d={svgData.paths.saldoActual} fill="none" stroke="#cc0000" strokeWidth={2} />
                    <path
                      d={svgData.paths.acumActual}
                      fill="none"
                      stroke="#cc0000"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                    <path d={svgData.paths.saldoNuevo} fill="none" stroke="#3b82f6" strokeWidth={2} />
                    <path
                      d={svgData.paths.acumNuevo}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                  </svg>
                )}
              </div>

              {/* Year-by-year table */}
              <div style={{ ...S.card, overflowX: "auto" }}>
                <div style={S.cardTitle}>Tabla Año a Año</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {[
                        "Año",
                        "Saldo Actual",
                        "Cuota Acum. Actual",
                        "Saldo Nuevo",
                        "Cuota Acum. Nueva",
                        "Ahorro Mensual",
                        "Ahorro Acumulado",
                      ].map((h) => (
                        <th key={h} style={S.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evolutionData.map((row) => (
                      <tr key={row.anio}>
                        <td style={{ ...S.td, textAlign: "center" }}>{row.anio}</td>
                        <td style={S.td}>ARS {fmt(row.saldoActual)}</td>
                        <td style={S.td}>ARS {fmt(row.cuotaActual)}</td>
                        <td style={S.td}>ARS {fmt(row.saldoNuevo)}</td>
                        <td style={S.td}>ARS {fmt(row.cuotaNueva)}</td>
                        <td
                          style={{
                            ...S.td,
                            color: row.ahorroMensual >= 0 ? "#22c55e" : "#cc0000",
                          }}
                        >
                          ARS {fmt(row.ahorroMensual)}
                        </td>
                        <td
                          style={{
                            ...S.td,
                            color: row.ahorroAcumulado >= 0 ? "#22c55e" : "#cc0000",
                          }}
                        >
                          ARS {fmt(row.ahorroAcumulado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================ TAB 3 */}
      {activeTab === "sensibilidad" && (
        <div>
          {/* Sensitivity matrix */}
          <div style={{ ...S.card, overflowX: "auto" }}>
            <div style={S.cardTitle}>Matriz de Sensibilidad — Período de Recupero (meses)</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
              Eje X: nueva tasa anual (%) · Eje Y: costo de refinanciación (% del saldo)
            </div>
            <table style={{ borderCollapse: "collapse", minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, textAlign: "left" }}>Costo / Tasa</th>
                  {tasasEje.map((t) => (
                    <th key={t} style={S.th}>
                      {fmt(t, 1)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costosEje.map((costo) => (
                  <tr key={costo}>
                    <td
                      style={{
                        ...S.td,
                        textAlign: "left",
                        color: "#6b7280",
                        fontWeight: 600,
                      }}
                    >
                      {fmt(costo, 1)}%
                    </td>
                    {tasasEje.map((tasa) => {
                      const m = calcRecuperoSens(tasa, costo);
                      return (
                        <td
                          key={tasa}
                          style={{
                            ...S.td,
                            background: cellColor(m),
                            color: cellTextColor(m),
                            fontWeight: 700,
                            textAlign: "center",
                            borderRadius: 4,
                          }}
                        >
                          {isFinite(m) ? fmt(m, 0) : "∞"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10 }}>
              {[
                { bg: "#14532d", text: "#86efac", label: "< 12 meses" },
                { bg: "#713f12", text: "#fde68a", label: "12–24 meses" },
                { bg: "#7f1d1d", text: "#fca5a5", label: "> 24 meses" },
              ].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: l.bg,
                      borderRadius: 2,
                    }}
                  />
                  <span style={{ color: "#9ca3af" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* UVA inflation slider */}
          <div style={S.card}>
            <div style={S.cardTitle}>Proyección UVA — Impacto de Inflación</div>
            {tipoHipoteca === "uva" ? (
              <>
                <div style={S.fieldGroup}>
                  <label style={S.label}>
                    Inflación UVA anual proyectada: {fmt(inflacionUVA)}%
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={200}
                    step={5}
                    value={inflacionUVA}
                    onChange={(e) => setInflacionUVA(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#cc0000" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      color: "#6b7280",
                      marginTop: 2,
                    }}
                  >
                    <span>50%</span>
                    <span>200%</span>
                  </div>
                </div>

                {/* Projection table */}
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ ...S.th, textAlign: "left" }}>Escenario</th>
                        <th style={S.th}>Hoy</th>
                        <th style={S.th}>12 meses</th>
                        <th style={S.th}>24 meses</th>
                        <th style={S.th}>36 meses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inflacionEscenarios.map((esc) => {
                        const cuotaHoy = results ? results.cuotaActual : 0;
                        return (
                          <tr key={esc.label}>
                            <td style={{ ...S.td, textAlign: "left" }}>
                              <span style={{ color: esc.color, fontWeight: 700 }}>
                                {esc.label}
                              </span>
                            </td>
                            <td style={S.td}>ARS {fmt(cuotaHoy)}</td>
                            <td style={S.td}>
                              ARS {fmt(cuotaUVAEnMes(esc.pct, 12))}
                            </td>
                            <td style={S.td}>
                              ARS {fmt(cuotaUVAEnMes(esc.pct, 24))}
                            </td>
                            <td style={S.td}>
                              ARS {fmt(cuotaUVAEnMes(esc.pct, 36))}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Nueva hipoteca row */}
                      {results && (
                        <tr>
                          <td
                            style={{
                              ...S.td,
                              textAlign: "left",
                              color: "#3b82f6",
                              fontWeight: 700,
                            }}
                          >
                            Nueva hipoteca (fija)
                          </td>
                          {[0, 12, 24, 36].map((m) => (
                            <td key={m} style={{ ...S.td, color: "#3b82f6" }}>
                              ARS {fmt(results.cuotaNueva)}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
                  La nueva hipoteca a tasa fija no ajusta por UVA — su cuota permanece constante en términos nominales.
                </p>
              </>
            ) : (
              <p style={{ color: "#6b7280", fontSize: 13 }}>
                La proyección UVA aplica cuando la hipoteca actual es de tipo UVA. Cambiá el tipo en la pestaña &ldquo;Hipoteca Actual vs. Nueva&rdquo;.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
