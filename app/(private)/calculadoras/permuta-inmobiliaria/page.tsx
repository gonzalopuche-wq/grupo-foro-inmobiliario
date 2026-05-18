"use client";

import { useState, useMemo } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtUSD(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}USD ${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}USD ${(abs / 1_000).toFixed(1)}k`;
  return `${sign}USD ${abs.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtUSDFull(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  return `${sign}USD ${abs.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtPct(n: number): string {
  return n.toFixed(2) + "%";
}

// ── Styles ───────────────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0a0a0a",
  red: "#cc0000",
  text: "#e0e0e0",
  card: "#111111",
  border: "#222222",
  muted: "rgba(224,224,224,0.45)",
  colA: "#3b82f6",
  colB: "#f97316",
  green: "#22c55e",
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "Inter, sans-serif",
    padding: "28px 20px 60px",
    maxWidth: 960,
    margin: "0 auto",
  },
  h1: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: "clamp(22px, 4vw, 30px)",
    color: "#fff",
    margin: "0 0 6px",
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    margin: "0 0 28px",
  },
  tabBar: {
    display: "flex",
    gap: 4,
    borderBottom: `1px solid ${COLORS.border}`,
    marginBottom: 28,
    flexWrap: "wrap" as const,
  },
  card: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: "18px 20px",
  },
  label: {
    display: "block",
    fontSize: 11,
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: COLORS.muted,
    marginBottom: 5,
  },
  input: {
    background: "#0d0d0d",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    color: COLORS.text,
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    padding: "8px 10px",
    width: "100%",
    boxSizing: "border-box" as const,
    outline: "none",
  },
  row: {
    display: "grid",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: COLORS.muted,
    marginBottom: 12,
    borderBottom: `1px solid ${COLORS.border}`,
    paddingBottom: 6,
  },
  resultRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: `1px solid rgba(34,34,34,0.6)`,
    fontSize: 14,
  },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "Montserrat, sans-serif",
    letterSpacing: "0.06em",
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface PropState {
  descripcion: string;
  valor: string;
  deuda: string;
  pctEscritura: string;
  pctComision: string;
  viviendaUnica: boolean;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PermutaInmobiliariaPage() {
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // ── Tab 1 State ──
  const [propA, setPropA] = useState<PropState>({
    descripcion: "Departamento 3 ambientes, Palermo",
    valor: "180000",
    deuda: "0",
    pctEscritura: "2.5",
    pctComision: "3",
    viviendaUnica: true,
  });
  const [propB, setPropB] = useState<PropState>({
    descripcion: "Casa PH, Villa Crespo",
    valor: "150000",
    deuda: "0",
    pctEscritura: "2.5",
    pctComision: "3",
    viviendaUnica: false,
  });

  // ── Tab 3 State ──
  const [sliderPct, setSliderPct] = useState<number>(100);
  const [mesesAlquiler, setMesesAlquiler] = useState<string>("12");

  // ── Calculations ──────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const vA = parseFloat(propA.valor) || 0;
    const vB = parseFloat(propB.valor) || 0;
    const dA = parseFloat(propA.deuda) || 0;
    const dB = parseFloat(propB.deuda) || 0;
    const pEscA = (parseFloat(propA.pctEscritura) || 0) / 100;
    const pEscB = (parseFloat(propB.pctEscritura) || 0) / 100;
    const pComA = (parseFloat(propA.pctComision) || 0) / 100;
    const pComB = (parseFloat(propB.pctComision) || 0) / 100;
    const itiPct = 0.015;

    // Valores netos
    const netoA = vA - dA;
    const netoB = vB - dB;

    // Costos de transferencia
    const escA = vA * pEscA;
    const escB = vB * pEscB;
    const comA = vA * pComA;
    const comB = vB * pComB;
    const itiA = propA.viviendaUnica ? 0 : vA * itiPct;
    const itiB = propB.viviendaUnica ? 0 : vB * itiPct;

    const costosA = escA + comA + itiA;
    const costosB = escB + comB + itiB;

    // Saldo (diferencia de valores netos)
    const diffNetos = netoA - netoB; // positivo → A vale más → B paga saldo a A
    const saldoBruto = Math.abs(diffNetos);
    const quienPagaSaldo: "A" | "B" | "nadie" =
      diffNetos > 1 ? "B" : diffNetos < -1 ? "A" : "nadie";

    // Saldo neto: ajustado por diferencia de costos de transferencia
    const diffCostos = costosA - costosB; // si A tiene más costos, el saldo se ajusta
    const saldoNeto = saldoBruto - Math.abs(diffCostos);

    // Ahorro vs venta + compra por separado
    // Escenario venta+compra: cada uno paga costos de venta (comisión vendedor) + costos de compra (escritura + comisión comprador)
    const costoVentaA = vA * pComA + itiA; // vende A
    const costoCompraB_porA = vB * pEscB + vB * pComB; // A compra B
    const costoVentaB = vB * pComB + itiB; // vende B
    const costoCompraA_porB = vA * pEscA + vA * pComA; // B compra A

    const costoTotalVC_A = costoVentaA + costoCompraB_porA;
    const costoTotalVC_B = costoVentaB + costoCompraA_porB;
    const costoTotalVCTotal = costoTotalVC_A + costoTotalVC_B;

    const costoPermutaTotal = costosA + costosB;
    const ahorro = costoTotalVCTotal - costoPermutaTotal;

    // Ventaja fiscal
    const itiAhorradoA = propA.viviendaUnica ? vA * itiPct : 0;
    const itiAhorradoB = propB.viviendaUnica ? vB * itiPct : 0;

    return {
      vA, vB, dA, dB, netoA, netoB,
      escA, escB, comA, comB, itiA, itiB,
      costosA, costosB,
      diffNetos, saldoBruto, saldoNeto, quienPagaSaldo,
      diffCostos,
      costoTotalVC_A, costoTotalVC_B, costoTotalVCTotal,
      costoPermutaTotal, ahorro,
      itiAhorradoA, itiAhorradoB,
    };
  }, [propA, propB]);

  // ── Tab 3 slider calc ──
  const sliderCalc = useMemo(() => {
    const baseA = parseFloat(propA.valor) || 0;
    const vB = parseFloat(propB.valor) || 0;
    const dA = parseFloat(propA.deuda) || 0;
    const dB = parseFloat(propB.deuda) || 0;

    const rows: Array<{ pct: number; vA: number; netoA: number; netoB: number; saldo: number; isZero: boolean }> = [];
    for (let p = 80; p <= 120; p += 5) {
      const vA = baseA * (p / 100);
      const nA = vA - dA;
      const nB = vB - dB;
      const diff = nA - nB;
      rows.push({ pct: p, vA, netoA: nA, netoB: nB, saldo: diff, isZero: Math.abs(diff) < baseA * 0.01 });
    }

    const vASlider = baseA * (sliderPct / 100);
    const nASlider = vASlider - dA;
    const nBSlider = vB - dB;
    const saldoSlider = nASlider - nBSlider;

    return { rows, vASlider, saldoSlider };
  }, [propA.valor, propA.deuda, propB.valor, propB.deuda, sliderPct]);

  // ── Tab 3 alquiler calc ──
  const alquilerCalc = useMemo(() => {
    const vA = parseFloat(propA.valor) || 0;
    const meses = parseInt(mesesAlquiler) || 12;
    // Renta típica: 0.5% mensual del valor
    const rentaMensual = vA * 0.005;
    const rentaTotal = rentaMensual * meses;
    return { rentaMensual, rentaTotal, meses };
  }, [propA.valor, mesesAlquiler]);

  // ── Helpers ──
  function updateA(key: keyof PropState, val: string | boolean) {
    setPropA((prev) => ({ ...prev, [key]: val }));
  }
  function updateB(key: keyof PropState, val: string | boolean) {
    setPropB((prev) => ({ ...prev, [key]: val }));
  }

  function TabButton({ idx, label }: { idx: 0 | 1 | 2; label: string }) {
    const active = tab === idx;
    return (
      <button
        onClick={() => setTab(idx)}
        style={{
          background: active ? COLORS.red : "transparent",
          border: active ? `1px solid ${COLORS.red}` : `1px solid transparent`,
          borderBottom: active ? "none" : "none",
          borderRadius: "6px 6px 0 0",
          color: active ? "#fff" : COLORS.muted,
          cursor: "pointer",
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.06em",
          padding: "9px 18px",
          textTransform: "uppercase",
          transition: "all 0.15s",
          marginBottom: active ? -1 : 0,
        }}
      >
        {label}
      </button>
    );
  }

  function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 12 }}>
        <span style={s.label}>{label}</span>
        {children}
      </div>
    );
  }

  function ResultLine({
    label,
    value,
    color,
    bold,
  }: {
    label: string;
    value: string;
    color?: string;
    bold?: boolean;
  }) {
    return (
      <div style={{ ...s.resultRow, fontWeight: bold ? 700 : 400 }}>
        <span style={{ color: COLORS.muted, fontSize: 13 }}>{label}</span>
        <span style={{ color: color ?? COLORS.text, fontSize: 14 }}>{value}</span>
      </div>
    );
  }

  // ── SVG Bar Chart ──
  function BarChart({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
    const max = Math.max(...items.map((i) => i.value), 1);
    return (
      <div>
        {items.map((item, idx) => {
          const pct = Math.min((item.value / max) * 100, 100);
          return (
            <div key={idx} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>
                <span>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700 }}>{fmtUSD(item.value)}</span>
              </div>
              <div style={{ background: COLORS.border, borderRadius: 4, height: 10, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: item.color,
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <h1 style={s.h1}>Calculadora de Permuta Inmobiliaria</h1>
      <p style={s.subtitle}>
        Analizá si una permuta conviene y cuál es el saldo a pagar
      </p>

      {/* Tab Bar */}
      <div style={s.tabBar}>
        <TabButton idx={0} label="Propiedades" />
        <TabButton idx={1} label="Análisis comparativo" />
        <TabButton idx={2} label="Simulador de saldo" />
      </div>

      {/* ── TAB 1 ── */}
      {tab === 0 && (
        <div>
          {/* Inputs grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              marginBottom: 28,
            }}
          >
            {(
              [
                { prop: propA, update: updateA, color: COLORS.colA, label: "Propiedad A" },
                { prop: propB, update: updateB, color: COLORS.colB, label: "Propiedad B" },
              ] as Array<{
                prop: PropState;
                update: (k: keyof PropState, v: string | boolean) => void;
                color: string;
                label: string;
              }>
            ).map(({ prop, update, color, label: colLabel }) => (
              <div
                key={colLabel}
                style={{
                  ...s.card,
                  borderTop: `3px solid ${color}`,
                }}
              >
                <div
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    color,
                    marginBottom: 16,
                  }}
                >
                  {colLabel}
                </div>

                <FieldGroup label="Descripción">
                  <input
                    style={s.input}
                    value={prop.descripcion}
                    onChange={(e) => update("descripcion", e.target.value)}
                    placeholder="Ej: Departamento 3 ambientes"
                  />
                </FieldGroup>

                <FieldGroup label="Valor de mercado (USD)">
                  <input
                    style={s.input}
                    type="number"
                    min="0"
                    value={prop.valor}
                    onChange={(e) => update("valor", e.target.value)}
                  />
                </FieldGroup>

                <FieldGroup label="Deuda hipotecaria pendiente (USD)">
                  <input
                    style={s.input}
                    type="number"
                    min="0"
                    value={prop.deuda}
                    onChange={(e) => update("deuda", e.target.value)}
                  />
                </FieldGroup>

                <FieldGroup label="Gastos de escritura / transferencia (%)">
                  <input
                    style={s.input}
                    type="number"
                    min="0"
                    step="0.1"
                    value={prop.pctEscritura}
                    onChange={(e) => update("pctEscritura", e.target.value)}
                  />
                </FieldGroup>

                <FieldGroup label="Comisión inmobiliaria (%)">
                  <input
                    style={s.input}
                    type="number"
                    min="0"
                    step="0.1"
                    value={prop.pctComision}
                    onChange={(e) => update("pctComision", e.target.value)}
                  />
                </FieldGroup>

                {/* ITI info */}
                <div
                  style={{
                    background: "#0d0d0d",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginTop: 4,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={prop.viviendaUnica}
                      onChange={(e) => update("viviendaUnica", e.target.checked)}
                      style={{ accentColor: color, width: 16, height: 16, cursor: "pointer" }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          color: COLORS.text,
                          fontWeight: 600,
                        }}
                      >
                        Vivienda única y de ocupación permanente
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                        {prop.viviendaUnica
                          ? "Exento de ITI (1.5%)"
                          : `ITI: ${fmtUSD((parseFloat(prop.valor) || 0) * 0.015)}`}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Mini results */}
                <div style={{ marginTop: 16 }}>
                  <ResultLine
                    label="Valor de mercado"
                    value={fmtUSDFull(parseFloat(prop.valor) || 0)}
                  />
                  <ResultLine
                    label="Deuda hipotecaria"
                    value={`- ${fmtUSDFull(parseFloat(prop.deuda) || 0)}`}
                    color={COLORS.red}
                  />
                  <ResultLine
                    label="Valor neto (equity)"
                    value={fmtUSDFull(
                      (parseFloat(prop.valor) || 0) - (parseFloat(prop.deuda) || 0)
                    )}
                    color={color}
                    bold
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Costos detallados */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              marginBottom: 28,
            }}
          >
            {(
              [
                { label: "Propiedad A", color: COLORS.colA, esc: calc.escA, com: calc.comA, iti: calc.itiA, total: calc.costosA },
                { label: "Propiedad B", color: COLORS.colB, esc: calc.escB, com: calc.comB, iti: calc.itiB, total: calc.costosB },
              ] as Array<{ label: string; color: string; esc: number; com: number; iti: number; total: number }>
            ).map(({ label: colLabel, color, esc, com, iti, total }) => (
              <div key={colLabel} style={s.card}>
                <div style={{ ...s.sectionTitle, color }}>
                  Costos de transferencia — {colLabel}
                </div>
                <ResultLine label="Escritura / transferencia" value={fmtUSDFull(esc)} />
                <ResultLine label="Comisión inmobiliaria" value={fmtUSDFull(com)} />
                <ResultLine label="ITI (1.5%)" value={iti > 0 ? fmtUSDFull(iti) : "Exento"} color={iti > 0 ? COLORS.red : COLORS.green} />
                <ResultLine label="Total costos" value={fmtUSDFull(total)} bold color={color} />
              </div>
            ))}
          </div>

          {/* Cards resumen */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {/* Saldo */}
            <div
              style={{
                ...s.card,
                borderLeft: `4px solid ${COLORS.red}`,
              }}
            >
              <div style={s.sectionTitle}>Saldo a pagar</div>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 28,
                  color: calc.quienPagaSaldo === "nadie" ? COLORS.green : COLORS.text,
                  marginBottom: 6,
                }}
              >
                {calc.quienPagaSaldo === "nadie" ? "Equilibrado" : fmtUSDFull(calc.saldoBruto)}
              </div>
              {calc.quienPagaSaldo !== "nadie" && (
                <>
                  <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>
                    Paga:{" "}
                    <span
                      style={{
                        color: calc.quienPagaSaldo === "A" ? COLORS.colA : COLORS.colB,
                        fontWeight: 700,
                      }}
                    >
                      Parte {calc.quienPagaSaldo} (propiedad de menor valor)
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>
                    Saldo neto (ajustado por diferencia de costos):{" "}
                    <span style={{ color: COLORS.text, fontWeight: 600 }}>
                      {fmtUSDFull(Math.max(0, calc.saldoNeto))}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Ahorro */}
            <div
              style={{
                ...s.card,
                borderLeft: `4px solid ${COLORS.green}`,
              }}
            >
              <div style={s.sectionTitle}>Ahorro vs. venta + compra</div>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 28,
                  color: calc.ahorro >= 0 ? COLORS.green : COLORS.red,
                  marginBottom: 6,
                }}
              >
                {calc.ahorro >= 0 ? "+" : ""}{fmtUSD(calc.ahorro)}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Costo permuta: {fmtUSD(calc.costoPermutaTotal)}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Costo venta+compra: {fmtUSD(calc.costoTotalVCTotal)}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                {calc.ahorro >= 0
                  ? "La permuta es más económica"
                  : "La venta separada sería más barata"}
              </div>
            </div>

            {/* ITI */}
            <div
              style={{
                ...s.card,
                borderLeft: `4px solid ${COLORS.colA}`,
              }}
            >
              <div style={s.sectionTitle}>Ventaja fiscal (ITI)</div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 6 }}>
                Ahorro por exención de ITI
              </div>
              {calc.itiAhorradoA > 0 || calc.itiAhorradoB > 0 ? (
                <>
                  {calc.itiAhorradoA > 0 && (
                    <ResultLine
                      label="Parte A (vivienda única)"
                      value={`+ ${fmtUSD(calc.itiAhorradoA)}`}
                      color={COLORS.green}
                    />
                  )}
                  {calc.itiAhorradoB > 0 && (
                    <ResultLine
                      label="Parte B (vivienda única)"
                      value={`+ ${fmtUSD(calc.itiAhorradoB)}`}
                      color={COLORS.green}
                    />
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      fontWeight: 700,
                      fontSize: 16,
                      color: COLORS.green,
                    }}
                  >
                    Total: {fmtUSD(calc.itiAhorradoA + calc.itiAhorradoB)}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: COLORS.muted }}>
                  Ninguna parte está exenta. ITI aplica en ambas.
                </div>
              )}
            </div>
          </div>

          {/* Comparativa individual */}
          <div style={{ marginTop: 28, ...s.card }}>
            <div style={s.sectionTitle}>Situación neta por parte</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 20,
              }}
            >
              {(
                [
                  {
                    parte: "A",
                    color: COLORS.colA,
                    label: propA.descripcion,
                    recibe: calc.vB,
                    paga_saldo: calc.quienPagaSaldo === "A" ? calc.saldoBruto : 0,
                    recibe_saldo: calc.quienPagaSaldo === "B" ? calc.saldoBruto : 0,
                    costos: calc.costosA,
                    neto: calc.netoA,
                  },
                  {
                    parte: "B",
                    color: COLORS.colB,
                    label: propB.descripcion,
                    recibe: calc.vA,
                    paga_saldo: calc.quienPagaSaldo === "B" ? calc.saldoBruto : 0,
                    recibe_saldo: calc.quienPagaSaldo === "A" ? calc.saldoBruto : 0,
                    costos: calc.costosB,
                    neto: calc.netoB,
                  },
                ] as Array<{
                  parte: string;
                  color: string;
                  label: string;
                  recibe: number;
                  paga_saldo: number;
                  recibe_saldo: number;
                  costos: number;
                  neto: number;
                }>
              ).map(({ parte, color, label, recibe, paga_saldo, recibe_saldo, costos, neto }) => {
                const resultado = recibe + recibe_saldo - paga_saldo - costos;
                return (
                  <div key={parte}>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        color,
                        marginBottom: 8,
                      }}
                    >
                      Parte {parte} — {label}
                    </div>
                    <ResultLine label="Propiedad entregada (equity)" value={`- ${fmtUSDFull(neto)}`} color={COLORS.red} />
                    <ResultLine label="Propiedad recibida" value={`+ ${fmtUSDFull(recibe)}`} color={COLORS.green} />
                    {paga_saldo > 0 && <ResultLine label="Saldo pagado" value={`- ${fmtUSDFull(paga_saldo)}`} color={COLORS.red} />}
                    {recibe_saldo > 0 && <ResultLine label="Saldo recibido" value={`+ ${fmtUSDFull(recibe_saldo)}`} color={COLORS.green} />}
                    <ResultLine label="Costos de transferencia" value={`- ${fmtUSDFull(costos)}`} color={COLORS.red} />
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 0",
                        borderTop: `1px solid ${COLORS.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ color: COLORS.muted, fontSize: 13 }}>Resultado neto operación</span>
                      <span
                        style={{
                          fontSize: 16,
                          color: resultado >= 0 ? COLORS.green : COLORS.red,
                        }}
                      >
                        {resultado >= 0 ? "+" : ""}{fmtUSDFull(resultado)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2 ── */}
      {tab === 1 && (
        <div>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>
            Comparación de los tres escenarios para mover las propiedades entre las partes.
          </p>

          {/* Escenario cards */}
          {(() => {
            const scenarios = [
              {
                id: "permuta",
                nombre: "1. Permuta directa",
                costoA: calc.costosA + (calc.quienPagaSaldo === "A" ? calc.saldoBruto : 0),
                costoB: calc.costosB + (calc.quienPagaSaldo === "B" ? calc.saldoBruto : 0),
                desc: "Intercambio directo con pago de saldo si corresponde",
              },
              {
                id: "venta_compra",
                nombre: "2. Venta A + Compra B",
                costoA: calc.costoTotalVC_A,
                costoB: calc.costoTotalVC_B,
                desc: "Cada parte vende y compra la propiedad del otro en operaciones separadas",
              },
              {
                id: "alquiler",
                nombre: "3. Alquiler temporal",
                costoA: calc.vA * 0.005 * (parseInt(mesesAlquiler) || 12) + calc.costoTotalVC_A,
                costoB: calc.costoTotalVC_B,
                desc: `A alquila su propiedad ${mesesAlquiler} meses y luego compra B`,
              },
            ];

            const minCostoA = Math.min(...scenarios.map((s2) => s2.costoA));
            const minCostoB = Math.min(...scenarios.map((s2) => s2.costoB));

            return (
              <>
                {/* Alquiler meses input */}
                <div style={{ marginBottom: 20, maxWidth: 240 }}>
                  <span style={s.label}>Meses de alquiler (escenario 3)</span>
                  <input
                    style={s.input}
                    type="number"
                    min="1"
                    max="60"
                    value={mesesAlquiler}
                    onChange={(e) => setMesesAlquiler(e.target.value)}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 20,
                    marginBottom: 32,
                  }}
                >
                  {scenarios.map((sc) => {
                    const bestA = sc.costoA === minCostoA;
                    const bestB = sc.costoB === minCostoB;
                    const best = bestA || bestB;
                    return (
                      <div
                        key={sc.id}
                        style={{
                          ...s.card,
                          borderTop: best ? `3px solid ${COLORS.red}` : `3px solid ${COLORS.border}`,
                          position: "relative",
                        }}
                      >
                        {best && (
                          <div
                            style={{
                              position: "absolute",
                              top: -1,
                              right: 16,
                              background: COLORS.red,
                              color: "#fff",
                              fontSize: 10,
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 800,
                              letterSpacing: "0.1em",
                              padding: "3px 10px",
                              borderRadius: "0 0 6px 6px",
                            }}
                          >
                            MEJOR OPCIÓN
                          </div>
                        )}
                        <div
                          style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#fff",
                            marginBottom: 6,
                          }}
                        >
                          {sc.nombre}
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
                          {sc.desc}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                          }}
                        >
                          {(
                            [
                              { parte: "A", costo: sc.costoA, color: COLORS.colA, best: bestA },
                              { parte: "B", costo: sc.costoB, color: COLORS.colB, best: bestB },
                            ] as Array<{ parte: string; costo: number; color: string; best: boolean }>
                          ).map(({ parte, costo, color, best: isBest }) => (
                            <div
                              key={parte}
                              style={{
                                background: "#0d0d0d",
                                border: `1px solid ${isBest ? color : COLORS.border}`,
                                borderRadius: 8,
                                padding: "10px 12px",
                              }}
                            >
                              <div style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "Montserrat, sans-serif", marginBottom: 4 }}>
                                PARTE {parte}
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: isBest ? color : COLORS.text }}>
                                {fmtUSD(costo)}
                              </div>
                              {isBest && (
                                <div style={{ fontSize: 10, color: COLORS.green, marginTop: 2 }}>
                                  más económico
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bar charts */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 20,
                  }}
                >
                  <div style={s.card}>
                    <div style={{ ...s.sectionTitle, color: COLORS.colA }}>Costo total — Parte A</div>
                    <BarChart
                      items={scenarios.map((sc) => ({
                        label: sc.nombre,
                        value: sc.costoA,
                        color: sc.costoA === minCostoA ? COLORS.green : COLORS.colA,
                      }))}
                    />
                  </div>
                  <div style={s.card}>
                    <div style={{ ...s.sectionTitle, color: COLORS.colB }}>Costo total — Parte B</div>
                    <BarChart
                      items={scenarios.map((sc) => ({
                        label: sc.nombre,
                        value: sc.costoB,
                        color: sc.costoB === minCostoB ? COLORS.green : COLORS.colB,
                      }))}
                    />
                  </div>
                </div>

                {/* Alquiler detail */}
                <div style={{ ...s.card, marginTop: 20 }}>
                  <div style={s.sectionTitle}>Detalle escenario 3 — Alquiler temporal</div>
                  <ResultLine
                    label="Renta mensual estimada (0.5% del valor A)"
                    value={fmtUSDFull(alquilerCalc.rentaMensual)}
                  />
                  <ResultLine
                    label={`Renta total ${alquilerCalc.meses} meses`}
                    value={fmtUSDFull(alquilerCalc.rentaTotal)}
                    color={COLORS.green}
                  />
                  <ResultLine
                    label="Costo compra B (A como comprador)"
                    value={fmtUSD(calc.costoTotalVC_A)}
                    color={COLORS.red}
                  />
                  <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 10 }}>
                    Nota: Si la renta acumulada cubre el saldo de la permuta (
                    {fmtUSD(calc.saldoBruto)}), el alquiler puede ser viable como estrategia de ahorro previo.
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── TAB 3 ── */}
      {tab === 2 && (
        <div>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>
            Simulá cómo cambia el saldo según el valor de mercado de la Propiedad A.
          </p>

          {/* Slider */}
          <div style={{ ...s.card, marginBottom: 28 }}>
            <div style={s.sectionTitle}>Variación del valor de Propiedad A</div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: COLORS.muted,
                marginBottom: 6,
              }}
            >
              <span>80% — {fmtUSD((parseFloat(propA.valor) || 0) * 0.8)}</span>
              <span style={{ fontWeight: 700, color: COLORS.text }}>
                {sliderPct}% — {fmtUSD(sliderCalc.vASlider)}
              </span>
              <span>120% — {fmtUSD((parseFloat(propA.valor) || 0) * 1.2)}</span>
            </div>
            <input
              type="range"
              min={80}
              max={120}
              step={1}
              value={sliderPct}
              onChange={(e) => setSliderPct(parseInt(e.target.value))}
              style={{ width: "100%", accentColor: COLORS.red, cursor: "pointer" }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 16,
                marginTop: 20,
              }}
            >
              <div
                style={{
                  background: "#0d0d0d",
                  border: `1px solid ${COLORS.colA}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 11, color: COLORS.colA, fontFamily: "Montserrat, sans-serif", fontWeight: 700, marginBottom: 4 }}>
                  VALOR A ({sliderPct}%)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>
                  {fmtUSD(sliderCalc.vASlider)}
                </div>
              </div>

              <div
                style={{
                  background: "#0d0d0d",
                  border: `1px solid ${COLORS.colB}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 11, color: COLORS.colB, fontFamily: "Montserrat, sans-serif", fontWeight: 700, marginBottom: 4 }}>
                  VALOR B (fijo)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>
                  {fmtUSD(parseFloat(propB.valor) || 0)}
                </div>
              </div>

              <div
                style={{
                  background: "#0d0d0d",
                  border: `1px solid ${Math.abs(sliderCalc.saldoSlider) < 1 ? COLORS.green : COLORS.red}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Montserrat, sans-serif", fontWeight: 700, marginBottom: 4 }}>
                  SALDO
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: Math.abs(sliderCalc.saldoSlider) < 1 ? COLORS.green : COLORS.text,
                  }}
                >
                  {Math.abs(sliderCalc.saldoSlider) < 1
                    ? "Equilibrado"
                    : fmtUSD(sliderCalc.saldoSlider)}
                </div>
                {Math.abs(sliderCalc.saldoSlider) >= 1 && (
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                    Paga: Parte {sliderCalc.saldoSlider > 0 ? "B" : "A"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={s.card}>
            <div style={s.sectionTitle}>Tabla de sensibilidad — Saldo según valor A</div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr>
                    {["% del valor base", "Valor A", "Valor neto A", "Valor neto B", "Saldo", "Quién paga"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "8px 12px",
                            color: COLORS.muted,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 11,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            borderBottom: `1px solid ${COLORS.border}`,
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sliderCalc.rows.map((row) => {
                    const isZero = Math.abs(row.saldo) < (parseFloat(propA.valor) || 1) * 0.01;
                    const isCurrent = row.pct === sliderPct;
                    return (
                      <tr
                        key={row.pct}
                        style={{
                          background: isZero
                            ? "rgba(34, 197, 94, 0.08)"
                            : isCurrent
                            ? "rgba(204, 0, 0, 0.08)"
                            : "transparent",
                          border: isZero ? `1px solid ${COLORS.green}` : "none",
                        }}
                      >
                        <td
                          style={{
                            padding: "9px 12px",
                            borderBottom: `1px solid rgba(34,34,34,0.5)`,
                            fontWeight: isCurrent ? 700 : 400,
                            color: isCurrent ? COLORS.text : COLORS.muted,
                          }}
                        >
                          {row.pct}%
                          {isZero && (
                            <span
                              style={{
                                ...s.badge,
                                background: "rgba(34,197,94,0.15)",
                                color: COLORS.green,
                                marginLeft: 8,
                                fontSize: 9,
                              }}
                            >
                              EQUILIBRIO
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            borderBottom: `1px solid rgba(34,34,34,0.5)`,
                            color: COLORS.colA,
                          }}
                        >
                          {fmtUSD(row.vA)}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            borderBottom: `1px solid rgba(34,34,34,0.5)`,
                          }}
                        >
                          {fmtUSD(row.netoA)}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            borderBottom: `1px solid rgba(34,34,34,0.5)`,
                            color: COLORS.colB,
                          }}
                        >
                          {fmtUSD(row.netoB)}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            borderBottom: `1px solid rgba(34,34,34,0.5)`,
                            fontWeight: 700,
                            color: isZero ? COLORS.green : Math.abs(row.saldo) > 0 ? COLORS.text : COLORS.muted,
                          }}
                        >
                          {isZero ? "—" : fmtUSD(Math.abs(row.saldo))}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            borderBottom: `1px solid rgba(34,34,34,0.5)`,
                            fontSize: 12,
                          }}
                        >
                          {isZero ? (
                            <span style={{ color: COLORS.green }}>Ninguna</span>
                          ) : row.saldo > 0 ? (
                            <span style={{ color: COLORS.colB }}>Parte B</span>
                          ) : (
                            <span style={{ color: COLORS.colA }}>Parte A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Zero point note */}
            <div style={{ marginTop: 16, fontSize: 12, color: COLORS.muted }}>
              El punto de equilibrio (saldo = 0) se alcanza cuando A vale{" "}
              <span style={{ color: COLORS.text, fontWeight: 600 }}>
                {fmtUSD((parseFloat(propB.valor) || 0) + (parseFloat(propA.deuda) || 0) - (parseFloat(propB.deuda) || 0))}
              </span>{" "}
              (valor neto idéntico al de B).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
