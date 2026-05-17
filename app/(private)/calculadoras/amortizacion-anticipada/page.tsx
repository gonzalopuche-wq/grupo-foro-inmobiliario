"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type TipoCredito = "uva" | "pesos";
type TipoAmortizacion = "reducir_plazo" | "reducir_cuota" | "cuota_extra";
type VistaTabla = "sin_extra" | "con_extra" | "ambos";
type TabActiva = "config" | "resultado" | "meses";

interface FilaAmortizacion {
  mes: number;
  cuota: number;
  capital: number;
  interes: number;
  saldo: number;
}

interface ResultadoCalculo {
  tablaSin: FilaAmortizacion[];
  tablaCon: FilaAmortizacion[];
  cuotaOriginal: number;
  cuotaNueva: number;
  plazoRestante: number;
  nuevoPlazo: number;
  mesesAhorrados: number;
  totalPagadoSin: number;
  totalPagadoCon: number;
  totalInteresesSin: number;
  totalInteresesCon: number;
  ahorroTotal: number;
  ahorroIntereses: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtARS(n: number): string {
  return `$ ${fmt(n)}`;
}

/** Calculate monthly rate from annual rate % using compound interest */
function tasaMensualDe(tnaAnual: number): number {
  return Math.pow(1 + tnaAnual / 100, 1 / 12) - 1;
}

/** French system payment given saldo, monthly rate and remaining terms */
function calcCuota(saldo: number, r: number, plazo: number): number {
  if (r === 0) return saldo / plazo;
  return (saldo * r) / (1 - Math.pow(1 + r, -plazo));
}

/** Calculate new plazo given saldo, monthly rate and cuota */
function calcNuevoPlazo(saldo: number, r: number, cuota: number): number {
  if (r === 0) return Math.ceil(saldo / cuota);
  const arg = 1 - (saldo * r) / cuota;
  if (arg <= 0) return 1;
  return Math.ceil(-Math.log(arg) / Math.log(1 + r));
}

/** Build amortization table from starting saldo */
function buildTabla(
  saldoInicial: number,
  r: number,
  cuota: number,
  plazo: number,
  mesOffset: number
): FilaAmortizacion[] {
  const rows: FilaAmortizacion[] = [];
  let saldo = saldoInicial;
  for (let i = 1; i <= plazo; i++) {
    const interes = saldo * r;
    const capitalAmort = Math.min(cuota - interes, saldo);
    saldo = Math.max(saldo - capitalAmort, 0);
    rows.push({
      mes: mesOffset + i,
      cuota,
      capital: capitalAmort,
      interes,
      saldo,
    });
  }
  return rows;
}

// ── Main calculation ──────────────────────────────────────────────────────────

function calcularAmortizacion(
  tipoCredito: TipoCredito,
  montoOriginal: number,
  tnaOSpread: number,
  plazoOriginalMeses: number,
  mesActual: number,
  saldoActual: number,
  valorUVA: number,
  tipoAmortizacion: TipoAmortizacion,
  montoExtra: number
): ResultadoCalculo {
  // For UVA: spread is real rate over UVA; the saldo is in ARS but we treat the
  // real rate the same way. For pesos: TNA over ARS.
  const r = tasaMensualDe(tnaOSpread);
  const plazoRestante = plazoOriginalMeses - mesActual + 1;

  // Cuota original (for display only, this is what the cuota would be at mesActual)
  const cuotaOriginal = calcCuota(saldoActual, r, plazoRestante);

  // ── Sin pago extra ─────────────────────────────────────────────────────────
  const tablaSin = buildTabla(saldoActual, r, cuotaOriginal, plazoRestante, mesActual - 1);
  const totalPagadoSin = tablaSin.reduce((acc, row) => acc + row.cuota, 0);
  const totalInteresesSin = tablaSin.reduce((acc, row) => acc + row.interes, 0);

  // ── Con pago extra ─────────────────────────────────────────────────────────
  const nuevoSaldo = Math.max(saldoActual - montoExtra, 0);
  let cuotaNueva = cuotaOriginal;
  let nuevoPlazo = plazoRestante;

  if (tipoAmortizacion === "reducir_plazo" || tipoAmortizacion === "cuota_extra") {
    // Keep original cuota, reduce plazo
    cuotaNueva = cuotaOriginal;
    nuevoPlazo = calcNuevoPlazo(nuevoSaldo, r, cuotaNueva);
    nuevoPlazo = Math.min(nuevoPlazo, plazoRestante);
  } else {
    // reducir_cuota: keep plazo, reduce cuota
    nuevoPlazo = plazoRestante;
    cuotaNueva = calcCuota(nuevoSaldo, r, nuevoPlazo);
  }

  const tablaCon = buildTabla(nuevoSaldo, r, cuotaNueva, nuevoPlazo, mesActual - 1);
  const totalInteresesCon = tablaCon.reduce((acc, row) => acc + row.interes, 0);
  const totalPagadoCon = montoExtra + tablaCon.reduce((acc, row) => acc + row.cuota, 0);
  const ahorroTotal = totalPagadoSin - totalPagadoCon;
  const ahorroIntereses = totalInteresesSin - totalInteresesCon;
  const mesesAhorrados = plazoRestante - nuevoPlazo;

  // For UVA: convert cuotaOriginal to UVA display
  const cuotaOriginalDisplay = tipoCredito === "uva" ? cuotaOriginal : cuotaOriginal;
  const cuotaNuevaDisplay = tipoCredito === "uva" ? cuotaNueva : cuotaNueva;
  void valorUVA; // used externally for UVA cuota display

  return {
    tablaSin,
    tablaCon,
    cuotaOriginal: cuotaOriginalDisplay,
    cuotaNueva: cuotaNuevaDisplay,
    plazoRestante,
    nuevoPlazo,
    mesesAhorrados,
    totalPagadoSin,
    totalPagadoCon,
    totalInteresesSin,
    totalInteresesCon,
    ahorroTotal,
    ahorroIntereses,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#fff",
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "Inter, sans-serif",
  width: "100%",
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

function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={inputStyle}
      />
    </div>
  );
}

// ── SVG Comparativa (stacked bars) ────────────────────────────────────────────

function SVGBarras({
  totalPagadoSin,
  totalInteresesSin,
  totalPagadoCon,
  totalInteresesCon,
  montoExtra,
}: {
  totalPagadoSin: number;
  totalInteresesSin: number;
  totalPagadoCon: number;
  totalInteresesCon: number;
  montoExtra: number;
}) {
  const maxVal = Math.max(totalPagadoSin, totalPagadoCon + montoExtra, 1);
  const barH = 200;
  const barW = 80;
  const gap = 60;
  const svgW = barW * 2 + gap + 80;
  const svgH = barH + 60;

  const capitalSin = totalPagadoSin - totalInteresesSin;
  const capitalCon = totalPagadoCon - totalInteresesCon - montoExtra;

  const hInteresesSin = (totalInteresesSin / maxVal) * barH;
  const hCapitalSin = (capitalSin / maxVal) * barH;
  const hExtra = (montoExtra / maxVal) * barH;
  const hInteresesCon = (totalInteresesCon / maxVal) * barH;
  const hCapitalCon = (capitalCon / maxVal) * barH;

  const x1 = 40;
  const x2 = x1 + barW + gap;

  // Barra izquierda: intereses (rojo, arriba) + capital (gris, abajo)
  const y1Capital = svgH - 40 - hCapitalSin;
  const y1Intereses = y1Capital - hInteresesSin;

  // Barra derecha: extra (amarillo/top) + intereses (rojo) + capital (gris)
  const y2Capital = svgH - 40 - hCapitalCon;
  const y2Intereses = y2Capital - hInteresesCon;
  const y2Extra = y2Intereses - hExtra;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ maxWidth: svgW, display: "block", margin: "0 auto" }}
    >
      {/* Barra izquierda SIN */}
      <rect x={x1} y={y1Intereses} width={barW} height={hInteresesSin} fill="#cc0000" rx={2} />
      <rect x={x1} y={y1Capital} width={barW} height={hCapitalSin} fill="#555" rx={2} />

      {/* Barra derecha CON */}
      {hExtra > 0 && (
        <rect x={x2} y={y2Extra} width={barW} height={hExtra} fill="#f59e0b" rx={2} />
      )}
      <rect x={x2} y={y2Intereses} width={barW} height={hInteresesCon} fill="#991b1b" rx={2} />
      <rect x={x2} y={y2Capital} width={barW} height={hCapitalCon} fill="#444" rx={2} />

      {/* Labels totales */}
      <text x={x1 + barW / 2} y={Math.min(y1Intereses, y2Extra) - 6} fontSize={10} fill="#ccc" textAnchor="middle">
        {`$ ${fmt(totalPagadoSin)}`}
      </text>
      <text x={x2 + barW / 2} y={Math.min(y1Intereses, y2Extra) - 6} fontSize={10} fill="#ccc" textAnchor="middle">
        {`$ ${fmt(totalPagadoCon)}`}
      </text>

      {/* X labels */}
      <text x={x1 + barW / 2} y={svgH - 20} fontSize={11} fill="#888" textAnchor="middle">
        Sin pago extra
      </text>
      <text x={x2 + barW / 2} y={svgH - 20} fontSize={11} fill="#888" textAnchor="middle">
        Con pago extra
      </text>

      {/* Leyenda */}
      <rect x={0} y={svgH - 12} width={10} height={10} fill="#cc0000" rx={2} />
      <text x={14} y={svgH - 3} fontSize={9} fill="#888">Intereses</text>
      <rect x={70} y={svgH - 12} width={10} height={10} fill="#555" rx={2} />
      <text x={84} y={svgH - 3} fontSize={9} fill="#888">Capital</text>
      <rect x={130} y={svgH - 12} width={10} height={10} fill="#f59e0b" rx={2} />
      <text x={144} y={svgH - 3} fontSize={9} fill="#888">Pago extra</text>
    </svg>
  );
}

// ── SVG Line Chart ─────────────────────────────────────────────────────────────

function SVGLineChart({
  tablaSin,
  tablaCon,
  mesActual,
}: {
  tablaSin: FilaAmortizacion[];
  tablaCon: FilaAmortizacion[];
  mesActual: number;
}) {
  const W = 860;
  const H = 220;
  const PADL = 60;
  const PADR = 10;
  const PADT = 10;
  const PADB = 30;
  const chartW = W - PADL - PADR;
  const chartH = H - PADT - PADB;

  const totalMeses = tablaSin.length;
  if (totalMeses === 0) return null;

  // Build saldo series: start with saldo before first mes
  const maxSaldo = tablaSin[0]
    ? tablaSin[0].saldo + tablaSin[0].capital + tablaSin[0].interes
    : 1;

  const sampleCount = Math.min(totalMeses, 120);

  function pointsForTabla(tabla: FilaAmortizacion[]): string {
    const pts: string[] = [];
    // Add initial point
    if (tabla.length > 0) {
      const firstRow = tabla[0];
      const initialSaldo = firstRow.saldo + firstRow.capital;
      const x = PADL;
      const y = PADT + chartH - (initialSaldo / maxSaldo) * chartH;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const step = Math.max(1, Math.floor(tabla.length / sampleCount));
    for (let i = step - 1; i < tabla.length; i += step) {
      const row = tabla[i];
      const progMes = i + 1;
      const x = PADL + (progMes / totalMeses) * chartW;
      const y = PADT + chartH - (row.saldo / maxSaldo) * chartH;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    // Final zero point
    const lastRow = tabla[tabla.length - 1];
    if (lastRow) {
      const x = PADL + (tabla.length / totalMeses) * chartW;
      const y = PADT + chartH;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }

  // X position of mesActual marker
  const xMesActual = PADL + ((mesActual - 1) / totalMeses) * chartW;

  // Y axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", minWidth: 400, maxWidth: W, display: "block" }}
      >
        {/* Grid lines */}
        {yLabels.map((pct) => {
          const y = PADT + chartH - pct * chartH;
          return (
            <g key={pct}>
              <line
                x1={PADL}
                y1={y}
                x2={W - PADR}
                y2={y}
                stroke="#222"
                strokeWidth={1}
              />
              <text x={PADL - 4} y={y + 4} fontSize={9} fill="#555" textAnchor="end">
                {`$${fmt(maxSaldo * pct)}`}
              </text>
            </g>
          );
        })}

        {/* Mes actual marker */}
        <line
          x1={xMesActual}
          y1={PADT}
          x2={xMesActual}
          y2={PADT + chartH}
          stroke="#cc000066"
          strokeWidth={1}
          strokeDasharray="4,3"
        />
        <text x={xMesActual + 3} y={PADT + 12} fontSize={9} fill="#cc0000">
          Mes {mesActual}
        </text>

        {/* Lines */}
        <polyline
          points={pointsForTabla(tablaSin)}
          fill="none"
          stroke="#cc0000"
          strokeWidth={2}
        />
        <polyline
          points={pointsForTabla(tablaCon)}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2}
        />

        {/* X axis */}
        <line
          x1={PADL}
          y1={PADT + chartH}
          x2={W - PADR}
          y2={PADT + chartH}
          stroke="#333"
          strokeWidth={1}
        />

        {/* X labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const mes = Math.round(pct * totalMeses);
          const x = PADL + pct * chartW;
          return (
            <text
              key={pct}
              x={x}
              y={PADT + chartH + 16}
              fontSize={9}
              fill="#555"
              textAnchor="middle"
            >
              {`M${mes}`}
            </text>
          );
        })}

        {/* Legend */}
        <line x1={PADL} y1={H - 4} x2={PADL + 20} y2={H - 4} stroke="#cc0000" strokeWidth={2} />
        <text x={PADL + 24} y={H - 1} fontSize={9} fill="#888">Sin pago extra</text>
        <line x1={PADL + 100} y1={H - 4} x2={PADL + 120} y2={H - 4} stroke="#22c55e" strokeWidth={2} />
        <text x={PADL + 124} y={H - 1} fontSize={9} fill="#888">Con pago extra</text>
      </svg>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AmortizacionAnticipadaPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState<TabActiva>("config");
  const [tipoCredito, setTipoCredito] = useState<TipoCredito>("uva");
  const [montoOriginal, setMontoOriginal] = useState(20_000_000);
  const [tnaOSpread, setTnaOSpread] = useState(6.0);
  const [plazoOriginalMeses, setPlazoOriginalMeses] = useState(240);
  const [mesActual, setMesActual] = useState(12);
  const [usarSaldoCalculado, setUsarSaldoCalculado] = useState(true);
  const [saldoManual, setSaldoManual] = useState(19_000_000);
  const [valorUVA, setValorUVA] = useState(1200);
  const [inflacionAnual, setInflacionAnual] = useState(80);
  const [tipoAmortizacion, setTipoAmortizacion] = useState<TipoAmortizacion>("reducir_plazo");
  const [montoExtra, setMontoExtra] = useState(1_000_000);
  const [vistaTabla, setVistaTabla] = useState<VistaTabla>("ambos");

  // ── Derived: saldo calculado al mes mesActual ──────────────────────────────
  const saldoCalculado = useMemo(() => {
    const r = tasaMensualDe(tnaOSpread);
    const cuota = calcCuota(montoOriginal, r, plazoOriginalMeses);
    let saldo = montoOriginal;
    const mesesPasados = Math.min(mesActual - 1, plazoOriginalMeses);
    for (let i = 0; i < mesesPasados; i++) {
      const interes = saldo * r;
      const capitalAmort = Math.min(cuota - interes, saldo);
      saldo = Math.max(saldo - capitalAmort, 0);
    }
    return saldo;
  }, [montoOriginal, tnaOSpread, plazoOriginalMeses, mesActual]);

  const saldoActual = usarSaldoCalculado ? saldoCalculado : saldoManual;

  // ── Cuota actual preview ───────────────────────────────────────────────────
  const cuotaActualPreview = useMemo(() => {
    const r = tasaMensualDe(tnaOSpread);
    const plazoRestante = plazoOriginalMeses - mesActual + 1;
    if (plazoRestante <= 0) return 0;
    return calcCuota(saldoActual, r, plazoRestante);
  }, [tnaOSpread, plazoOriginalMeses, mesActual, saldoActual]);

  const cuotaUVADisplay = useMemo(() => {
    if (tipoCredito !== "uva") return null;
    return cuotaActualPreview / valorUVA;
  }, [tipoCredito, cuotaActualPreview, valorUVA]);

  // ── Main calculation ───────────────────────────────────────────────────────
  const resultado = useMemo((): ResultadoCalculo | null => {
    if (
      montoOriginal <= 0 ||
      plazoOriginalMeses <= 0 ||
      mesActual < 1 ||
      mesActual > plazoOriginalMeses ||
      montoExtra <= 0
    )
      return null;
    return calcularAmortizacion(
      tipoCredito,
      montoOriginal,
      tnaOSpread,
      plazoOriginalMeses,
      mesActual,
      saldoActual,
      valorUVA,
      tipoAmortizacion,
      montoExtra
    );
  }, [
    tipoCredito,
    montoOriginal,
    tnaOSpread,
    plazoOriginalMeses,
    mesActual,
    saldoActual,
    valorUVA,
    tipoAmortizacion,
    montoExtra,
  ]);

  // ── Styles ─────────────────────────────────────────────────────────────────

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    fontSize: 13,
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    cursor: "pointer",
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
    color: active ? "#fff" : "#666",
    transition: "all 0.15s",
  });

  const kpiCardStyle = (color: string): React.CSSProperties => ({
    background: "#111",
    border: `1px solid ${color}44`,
    borderRadius: 10,
    padding: 20,
    textAlign: "center",
  });

  const sectionStyle: React.CSSProperties = {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 10,
    padding: "20px 24px",
    marginBottom: 16,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
              fontSize: 22,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              color: "#fff",
            }}
          >
            Amortizacion Anticipada
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Simula el ahorro de pagar capital extra en un credito hipotecario UVA o pesos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: "#111",
          borderBottom: "1px solid #222",
          display: "flex",
          paddingLeft: 24,
        }}
      >
        <button style={tabStyle(tabActiva === "config")} onClick={() => setTabActiva("config")}>
          1. Configurar credito
        </button>
        <button style={tabStyle(tabActiva === "resultado")} onClick={() => setTabActiva("resultado")}>
          2. Resultado
        </button>
        <button style={tabStyle(tabActiva === "meses")} onClick={() => setTabActiva("meses")}>
          3. Mes a mes
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* ── TAB 1: CONFIGURAR CRÉDITO ──────────────────────────────────── */}
        {tabActiva === "config" && (
          <div>
            {/* Toggle UVA/Pesos */}
            <div style={sectionStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#fff",
                }}
              >
                Tipo de credito
              </h2>
              <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", width: "fit-content", border: "1px solid #333" }}>
                {(["uva", "pesos"] as TipoCredito[]).map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setTipoCredito(tipo)}
                    style={{
                      padding: "8px 24px",
                      fontSize: 13,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      background: tipoCredito === tipo ? "#cc0000" : "#1a1a1a",
                      color: tipoCredito === tipo ? "#fff" : "#666",
                      transition: "all 0.15s",
                    }}
                  >
                    {tipo === "uva" ? "UVA" : "Pesos"}
                  </button>
                ))}
              </div>
            </div>

            {/* Datos del credito */}
            <div style={sectionStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#fff",
                }}
              >
                Datos del credito
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 16,
                }}
              >
                <NumberInput
                  label="Monto original (ARS)"
                  value={montoOriginal}
                  onChange={setMontoOriginal}
                  step={100_000}
                />
                <NumberInput
                  label={tipoCredito === "uva" ? "Spread sobre UVA (%)" : "TNA (%)"}
                  value={tnaOSpread}
                  onChange={setTnaOSpread}
                  step={0.1}
                  min={0}
                />
                <NumberInput
                  label="Plazo original (meses)"
                  value={plazoOriginalMeses}
                  onChange={(v) => setPlazoOriginalMeses(Math.max(1, Math.round(v)))}
                  step={12}
                  min={1}
                />
                <NumberInput
                  label="Mes actual (donde se paga extra)"
                  value={mesActual}
                  onChange={(v) =>
                    setMesActual(
                      Math.max(1, Math.min(Math.round(v), plazoOriginalMeses))
                    )
                  }
                  step={1}
                  min={1}
                  max={plazoOriginalMeses}
                />
                {tipoCredito === "uva" && (
                  <>
                    <NumberInput
                      label="Valor UVA actual ($)"
                      value={valorUVA}
                      onChange={setValorUVA}
                      step={10}
                      min={1}
                    />
                    <NumberInput
                      label="Inflacion anual esperada (%)"
                      value={inflacionAnual}
                      onChange={setInflacionAnual}
                      step={5}
                      min={0}
                    />
                  </>
                )}
              </div>

              {/* Saldo actual */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #222" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Saldo deudor al mes {mesActual}</label>
                  <button
                    onClick={() => setUsarSaldoCalculado(!usarSaldoCalculado)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      borderRadius: 5,
                      border: "1px solid #444",
                      background: usarSaldoCalculado ? "#22c55e22" : "#1a1a1a",
                      color: usarSaldoCalculado ? "#22c55e" : "#888",
                      cursor: "pointer",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    {usarSaldoCalculado ? "Calculado" : "Manual"}
                  </button>
                </div>
                {usarSaldoCalculado ? (
                  <div
                    style={{
                      background: "#0d0d0d",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: 15,
                      color: "#22c55e",
                      fontWeight: 700,
                      display: "inline-block",
                    }}
                  >
                    {fmtARS(saldoCalculado)}
                  </div>
                ) : (
                  <NumberInput
                    label="Saldo deudor (ARS)"
                    value={saldoManual}
                    onChange={setSaldoManual}
                    step={100_000}
                  />
                )}
              </div>
            </div>

            {/* Preview cuota actual */}
            <div
              style={{
                ...sectionStyle,
                background: "#0d0d0d",
                border: "1px solid #cc000033",
              }}
            >
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
                Cuota mensual actual (frances, mes {mesActual})
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  color: "#cc0000",
                }}
              >
                {fmtARS(cuotaActualPreview)}
              </div>
              {tipoCredito === "uva" && cuotaUVADisplay !== null && (
                <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                  = {fmt(cuotaUVADisplay, 2)} UVAs x {fmtARS(valorUVA)}/UVA
                </div>
              )}
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Plazo restante: {plazoOriginalMeses - mesActual + 1} meses &nbsp;|&nbsp;
                Saldo: {fmtARS(saldoActual)}
              </div>
            </div>

            {/* Pago extra */}
            <div style={sectionStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#fff",
                }}
              >
                Pago extra
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                <NumberInput
                  label="Monto extra (ARS)"
                  value={montoExtra}
                  onChange={setMontoExtra}
                  step={100_000}
                  min={0}
                />
                <div>
                  <label style={labelStyle}>Tipo de amortizacion</label>
                  <select
                    value={tipoAmortizacion}
                    onChange={(e) => setTipoAmortizacion(e.target.value as TipoAmortizacion)}
                    style={selectStyle}
                  >
                    <option value="reducir_plazo">Reducir plazo (misma cuota)</option>
                    <option value="reducir_cuota">Reducir cuota (mismo plazo)</option>
                    <option value="cuota_extra">Cuota extra (reduce plazo)</option>
                  </select>
                </div>
              </div>

              {/* Descripcion tipo */}
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  background: "#0d0d0d",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#888",
                  borderLeft: "3px solid #cc0000",
                }}
              >
                {tipoAmortizacion === "reducir_plazo" &&
                  "Aplicas el pago extra al capital. La cuota mensual queda igual pero terminAs de pagar antes."}
                {tipoAmortizacion === "reducir_cuota" &&
                  "Aplicas el pago extra al capital. El plazo queda igual pero la cuota mensual baja."}
                {tipoAmortizacion === "cuota_extra" &&
                  "Pagas una cuota extra de capital. La cuota regular queda igual y el plazo se reduce."}
              </div>
            </div>

            {/* CTA ir a resultado */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setTabActiva("resultado")}
                style={{
                  padding: "12px 28px",
                  background: "#cc0000",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  cursor: "pointer",
                  letterSpacing: "0.03em",
                }}
              >
                Ver resultado →
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 2: RESULTADO ─────────────────────────────────────────────── */}
        {tabActiva === "resultado" && (
          <div>
            {!resultado ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#666",
                  fontSize: 14,
                }}
              >
                Revisa la configuracion en el Tab 1 para obtener resultados.
              </div>
            ) : (
              <>
                {/* 3 KPI cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  {/* Meses ahorrados */}
                  <div style={kpiCardStyle("#22c55e")}>
                    <div
                      style={{
                        fontSize: 48,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        color: "#22c55e",
                        lineHeight: 1.1,
                      }}
                    >
                      {resultado.mesesAhorrados}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        color: "#22c55e",
                      }}
                    >
                      meses ahorrados
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                      {resultado.plazoRestante} → {resultado.nuevoPlazo} meses
                    </div>
                  </div>

                  {/* Ahorro en intereses */}
                  <div style={kpiCardStyle("#3b82f6")}>
                    <div
                      style={{
                        fontSize: 24,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        color: "#3b82f6",
                        lineHeight: 1.2,
                      }}
                    >
                      {fmtARS(resultado.ahorroIntereses)}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        color: "#3b82f6",
                      }}
                    >
                      ahorro en intereses
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                      intereses totales: {fmtARS(resultado.totalInteresesSin)} → {fmtARS(resultado.totalInteresesCon)}
                    </div>
                  </div>

                  {/* Nueva cuota */}
                  <div style={kpiCardStyle("#f59e0b")}>
                    <div
                      style={{
                        fontSize: 24,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        color: "#f59e0b",
                        lineHeight: 1.2,
                      }}
                    >
                      {fmtARS(resultado.cuotaNueva)}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        color: "#f59e0b",
                      }}
                    >
                      {tipoAmortizacion === "reducir_cuota" ? "nueva cuota mensual" : "cuota (sin cambio)"}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                      {tipoAmortizacion === "reducir_cuota"
                        ? `antes: ${fmtARS(resultado.cuotaOriginal)}`
                        : `misma cuota, termina antes`}
                    </div>
                  </div>
                </div>

                {/* SVG Barras */}
                <div
                  style={{
                    ...sectionStyle,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <h2
                    style={{
                      margin: "0 0 20px",
                      fontSize: 13,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: "#fff",
                      alignSelf: "flex-start",
                    }}
                  >
                    Total pagado — comparativa
                  </h2>
                  <SVGBarras
                    totalPagadoSin={resultado.totalPagadoSin}
                    totalInteresesSin={resultado.totalInteresesSin}
                    totalPagadoCon={resultado.totalPagadoCon}
                    totalInteresesCon={resultado.totalInteresesCon}
                    montoExtra={montoExtra}
                  />
                </div>

                {/* Tabla comparativa */}
                <div style={{ ...sectionStyle, padding: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid #222",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 13,
                      textTransform: "uppercase",
                    }}
                  >
                    Comparativa detallada
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#0d0d0d" }}>
                        <th
                          style={{
                            padding: "10px 16px",
                            textAlign: "left",
                            color: "#666",
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Concepto
                        </th>
                        <th
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            color: "#666",
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Sin extra
                        </th>
                        <th
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            color: "#666",
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Con extra
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          label: "Plazo restante",
                          sin: `${resultado.plazoRestante} meses`,
                          con: `${resultado.nuevoPlazo} meses`,
                          color: resultado.mesesAhorrados > 0 ? "#22c55e" : undefined,
                        },
                        {
                          label: "Cuota mensual",
                          sin: fmtARS(resultado.cuotaOriginal),
                          con: fmtARS(resultado.cuotaNueva),
                          color: tipoAmortizacion === "reducir_cuota" ? "#22c55e" : undefined,
                        },
                        {
                          label: "Total a pagar",
                          sin: fmtARS(resultado.totalPagadoSin),
                          con: fmtARS(resultado.totalPagadoCon),
                          color: "#22c55e",
                        },
                        {
                          label: "Total intereses",
                          sin: fmtARS(resultado.totalInteresesSin),
                          con: fmtARS(resultado.totalInteresesCon),
                          color: "#22c55e",
                        },
                        {
                          label: "Ahorro total",
                          sin: "—",
                          con: fmtARS(resultado.ahorroTotal),
                          color: "#22c55e",
                          highlight: true,
                        },
                      ].map((row, i) => (
                        <tr
                          key={row.label}
                          style={{
                            background: row.highlight
                              ? "#22c55e11"
                              : i % 2 === 0
                              ? "#0d0d0d"
                              : "transparent",
                            borderBottom: "1px solid #1a1a1a",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "#aaa",
                              fontFamily: "Montserrat, sans-serif",
                              fontSize: 12,
                              fontWeight: row.highlight ? 700 : 400,
                            }}
                          >
                            {row.label}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              color: "#888",
                              fontFamily: "Inter, sans-serif",
                              fontSize: 13,
                            }}
                          >
                            {row.sin}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              color: row.color ?? "#fff",
                              fontFamily: "Inter, sans-serif",
                              fontSize: 13,
                              fontWeight: row.highlight ? 700 : 400,
                            }}
                          >
                            {row.con}
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

        {/* ── TAB 3: AMORTIZACIÓN MES A MES ───────────────────────────────── */}
        {tabActiva === "meses" && (
          <div>
            {!resultado ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#666",
                  fontSize: 14,
                }}
              >
                Revisa la configuracion en el Tab 1 para obtener resultados.
              </div>
            ) : (
              <>
                {/* Line chart */}
                <div style={{ ...sectionStyle }}>
                  <h2
                    style={{
                      margin: "0 0 16px",
                      fontSize: 13,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: "#fff",
                    }}
                  >
                    Evolucion del saldo deudor
                  </h2>
                  <SVGLineChart
                    tablaSin={resultado.tablaSin}
                    tablaCon={resultado.tablaCon}
                    mesActual={mesActual}
                  />
                </div>

                {/* Vista selector */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 16,
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#666" }}>Ver:</span>
                  {(
                    [
                      { id: "sin_extra", label: "Sin extra" },
                      { id: "con_extra", label: "Con extra" },
                      { id: "ambos", label: "Ambos" },
                    ] as { id: VistaTabla; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setVistaTabla(opt.id)}
                      style={{
                        padding: "5px 14px",
                        fontSize: 12,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        border: "1px solid #333",
                        borderRadius: 5,
                        cursor: "pointer",
                        background: vistaTabla === opt.id ? "#cc0000" : "#1a1a1a",
                        color: vistaTabla === opt.id ? "#fff" : "#888",
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Tabla mes a mes */}
                <div
                  style={{
                    background: "#111",
                    border: "1px solid #222",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ maxHeight: 500, overflowY: "auto" }}>
                    {vistaTabla === "ambos" ? (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "#111",
                            zIndex: 1,
                          }}
                        >
                          <tr style={{ background: "#0d0d0d" }}>
                            <th
                              style={{
                                padding: "10px 10px",
                                textAlign: "center",
                                color: "#555",
                                fontSize: 10,
                                fontFamily: "Montserrat, sans-serif",
                                fontWeight: 700,
                                borderBottom: "1px solid #222",
                              }}
                            >
                              Mes
                            </th>
                            {["Capital", "Interes", "Cuota", "Saldo"].map((h) => (
                              <th
                                key={`sin-${h}`}
                                style={{
                                  padding: "10px 10px",
                                  textAlign: "right",
                                  color: "#cc0000",
                                  fontSize: 10,
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: 700,
                                  borderBottom: "1px solid #222",
                                  borderLeft: "1px solid #1a1a1a",
                                }}
                              >
                                {h} (sin)
                              </th>
                            ))}
                            {["Capital", "Interes", "Cuota", "Saldo"].map((h) => (
                              <th
                                key={`con-${h}`}
                                style={{
                                  padding: "10px 10px",
                                  textAlign: "right",
                                  color: "#22c55e",
                                  fontSize: 10,
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: 700,
                                  borderBottom: "1px solid #222",
                                  borderLeft: "1px solid #1a1a1a",
                                }}
                              >
                                {h} (con)
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.tablaSin.map((rowSin, i) => {
                            const rowCon = resultado.tablaCon[i];
                            const esExtraMes = rowSin.mes === mesActual;
                            const bg = esExtraMes
                              ? "#cc000018"
                              : i % 2 === 0
                              ? "#0d0d0d"
                              : "transparent";
                            return (
                              <tr
                                key={rowSin.mes}
                                style={{ background: bg, borderBottom: "1px solid #111" }}
                              >
                                <td
                                  style={{
                                    padding: "6px 10px",
                                    textAlign: "center",
                                    color: esExtraMes ? "#cc0000" : "#555",
                                    fontWeight: esExtraMes ? 700 : 400,
                                  }}
                                >
                                  {rowSin.mes}
                                </td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#22c55e", borderLeft: "1px solid #1a1a1a" }}>{fmtARS(rowSin.capital)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#ef4444" }}>{fmtARS(rowSin.interes)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#ccc" }}>{fmtARS(rowSin.cuota)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#888" }}>{fmtARS(rowSin.saldo)}</td>
                                {rowCon ? (
                                  <>
                                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#22c55e", borderLeft: "1px solid #1a1a1a" }}>{fmtARS(rowCon.capital)}</td>
                                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#ef4444" }}>{fmtARS(rowCon.interes)}</td>
                                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#ccc" }}>{fmtARS(rowCon.cuota)}</td>
                                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#888" }}>{fmtARS(rowCon.saldo)}</td>
                                  </>
                                ) : (
                                  <>
                                    <td colSpan={4} style={{ padding: "6px 10px", textAlign: "center", color: "#22c55e", borderLeft: "1px solid #1a1a1a", fontSize: 11 }}>
                                      Credito cancelado
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "#111",
                            zIndex: 1,
                          }}
                        >
                          <tr style={{ background: "#0d0d0d" }}>
                            {["Mes", "Capital", "Interes", "Cuota", "Saldo"].map((h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "10px 14px",
                                  textAlign: h === "Mes" ? "center" : "right",
                                  color: vistaTabla === "sin_extra" ? "#cc0000" : "#22c55e",
                                  fontSize: 10,
                                  fontFamily: "Montserrat, sans-serif",
                                  fontWeight: 700,
                                  borderBottom: "1px solid #222",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(vistaTabla === "sin_extra" ? resultado.tablaSin : resultado.tablaCon).map(
                            (row, i) => {
                              const esExtraMes = row.mes === mesActual;
                              const bg = esExtraMes
                                ? "#cc000018"
                                : i % 2 === 0
                                ? "#0d0d0d"
                                : "transparent";
                              return (
                                <tr
                                  key={row.mes}
                                  style={{ background: bg, borderBottom: "1px solid #111" }}
                                >
                                  <td
                                    style={{
                                      padding: "6px 14px",
                                      textAlign: "center",
                                      color: esExtraMes ? "#cc0000" : "#555",
                                      fontWeight: esExtraMes ? 700 : 400,
                                    }}
                                  >
                                    {row.mes}
                                  </td>
                                  <td style={{ padding: "6px 14px", textAlign: "right", color: "#22c55e" }}>{fmtARS(row.capital)}</td>
                                  <td style={{ padding: "6px 14px", textAlign: "right", color: "#ef4444" }}>{fmtARS(row.interes)}</td>
                                  <td style={{ padding: "6px 14px", textAlign: "right", color: "#ccc" }}>{fmtARS(row.cuota)}</td>
                                  <td style={{ padding: "6px 14px", textAlign: "right", color: "#888" }}>{fmtARS(row.saldo)}</td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Nota sobre mes de pago */}
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "#cc000011",
                    border: "1px solid #cc000033",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#888",
                  }}
                >
                  Las filas resaltadas en{" "}
                  <span style={{ color: "#cc0000", fontWeight: 700 }}>rojo suave</span>{" "}
                  corresponden al mes {mesActual}, donde se aplica el pago extra de{" "}
                  <span style={{ color: "#fff", fontWeight: 700 }}>{fmtARS(montoExtra)}</span>.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
