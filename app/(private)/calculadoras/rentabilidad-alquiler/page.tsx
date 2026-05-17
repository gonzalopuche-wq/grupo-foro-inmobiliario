"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function ars(n: number): string { return `$${fmt(Math.round(n))}`; }
function pct(n: number, dec = 2): string { return `${n.toFixed(dec)}%`; }
function pctSigned(n: number, dec = 2): string { return `${n >= 0 ? "+" : ""}${n.toFixed(dec)}%`; }

// ─── Input field helper ───────────────────────────────────────────────────────
function Field({
  label, value, onChange, step = 1, min, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 3 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: 6,
            color: "#e5e5e5",
            padding: "7px 10px",
            fontSize: 13,
            width: "100%",
            boxSizing: "border-box",
          }}
        />
        {suffix && <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color = "#fff",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = "resumen" | "proyeccion" | "escenarios";

// ─── Proyección row ───────────────────────────────────────────────────────────
interface ProyRow {
  anio: number;
  alquilerAnio: number;
  acumuladoNeto: number;
  valorPropARS: number;
  patrimonioTotal: number;
  plazoFijo: number;
}

export default function RentabilidadAlquilerPage() {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  const [valorCompra, setValorCompra] = useState(80000);
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [gastosCompra, setGastosCompra] = useState(7.5);
  const [gastosAnualesMantenimiento, setGastosAnualesMantenimiento] = useState(60000);
  const [alquilerMensual, setAlquilerMensual] = useState(250000);
  const [mesesOcupados, setMesesOcupados] = useState(11);
  const [ajusteAnual, setAjusteAnual] = useState(80);
  const [tasaPlazoFijo, setTasaPlazoFijo] = useState(35);
  const [inflacionAnual, setInflacionAnual] = useState(80);

  const [tab, setTab] = useState<Tab>("resumen");

  // ── Cálculos principales ────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const precioCompraARS = valorCompra * tipoCambio;
    const gastosCompraARS = precioCompraARS * gastosCompra / 100;
    const inversionTotalARS = precioCompraARS + gastosCompraARS;

    const alquilerAnualBruto = alquilerMensual * mesesOcupados;
    const alquilerAnualNeto = alquilerAnualBruto - gastosAnualesMantenimiento;

    const rentBrutaPct = (alquilerAnualBruto / inversionTotalARS) * 100;
    const rentNetaPct = (alquilerAnualNeto / inversionTotalARS) * 100;
    const rentBrutaUSD = (alquilerAnualBruto / tipoCambio / valorCompra) * 100;

    const paybackAnios = alquilerAnualNeto > 0 ? inversionTotalARS / alquilerAnualNeto : Infinity;

    const rendimientoPF = inversionTotalARS * tasaPlazoFijo / 100;
    const rentPFpct = tasaPlazoFijo;

    const rentRealNeta = ((1 + rentNetaPct / 100) / (1 + inflacionAnual / 100) - 1) * 100;
    const rentRealPF = ((1 + tasaPlazoFijo / 100) / (1 + inflacionAnual / 100) - 1) * 100;

    return {
      precioCompraARS,
      gastosCompraARS,
      inversionTotalARS,
      alquilerAnualBruto,
      alquilerAnualNeto,
      rentBrutaPct,
      rentNetaPct,
      rentBrutaUSD,
      paybackAnios,
      rendimientoPF,
      rentPFpct,
      rentRealNeta,
      rentRealPF,
    };
  }, [valorCompra, tipoCambio, gastosCompra, gastosAnualesMantenimiento, alquilerMensual, mesesOcupados, ajusteAnual, tasaPlazoFijo, inflacionAnual]);

  // ── Proyección 10 años ──────────────────────────────────────────────────────
  const proyeccion = useMemo((): ProyRow[] => {
    const rows: ProyRow[] = [];
    let acumuladoNeto = 0;

    for (let anio = 0; anio <= 10; anio++) {
      const alquilerAnio = anio === 0
        ? 0
        : alquilerMensual * Math.pow(1 + ajusteAnual / 100, anio) * mesesOcupados;
      acumuladoNeto += anio === 0 ? 0 : (alquilerAnio - gastosAnualesMantenimiento);

      const valorPropARS = valorCompra * Math.pow(1 + inflacionAnual / 100 * 0.5, anio) * tipoCambio;
      const patrimonioTotal = valorPropARS + Math.max(0, acumuladoNeto);
      const plazoFijo = calc.inversionTotalARS * Math.pow(1 + tasaPlazoFijo / 100, anio);

      rows.push({ anio, alquilerAnio, acumuladoNeto, valorPropARS, patrimonioTotal, plazoFijo });
    }
    return rows;
  }, [valorCompra, tipoCambio, ajusteAnual, mesesOcupados, alquilerMensual, gastosAnualesMantenimiento, inflacionAnual, tasaPlazoFijo, calc.inversionTotalARS]);

  // ── Escenarios (heatmap) ────────────────────────────────────────────────────
  const alquilerVariantes = useMemo((): number[] => {
    const base = alquilerMensual;
    return [-30, -20, -10, 0, 10, 20, 30].map(d => base * (1 + d / 100));
  }, [alquilerMensual]);

  const mesesVariantes = [6, 8, 10, 11, 12];

  const heatmapData = useMemo((): number[][] => {
    return mesesVariantes.map(mes =>
      alquilerVariantes.map(alq => {
        const bruto = alq * mes;
        const neto = bruto - gastosAnualesMantenimiento;
        return (neto / calc.inversionTotalARS) * 100;
      })
    );
  }, [alquilerVariantes, gastosAnualesMantenimiento, calc.inversionTotalARS]);

  // ── Semáforo ─────────────────────────────────────────────────────────────────
  const semaforo = useMemo(() => {
    const r = calc.rentNetaPct;
    if (r < 4) return { color: "#cc0000", label: "Baja rentabilidad", bg: "rgba(204,0,0,0.1)" };
    if (r < 7) return { color: "#eab308", label: "Rentabilidad aceptable", bg: "rgba(234,179,8,0.1)" };
    return { color: "#22c55e", label: "Buena rentabilidad", bg: "rgba(34,197,94,0.1)" };
  }, [calc.rentNetaPct]);

  // ── SVG Proyección ───────────────────────────────────────────────────────────
  const SVG_W = 900;
  const SVG_H = 300;
  const PAD_L = 80;
  const PAD_B = 40;
  const PAD_T = 20;
  const PAD_R = 20;

  const proyMaxY = Math.max(...proyeccion.map(r => Math.max(r.patrimonioTotal, r.plazoFijo)));
  const proyMinY = Math.min(...proyeccion.map(r => Math.min(r.acumuladoNeto, 0))) * 0.1;

  const toSvgX = (anio: number) =>
    PAD_L + (anio / 10) * (SVG_W - PAD_L - PAD_R);
  const toSvgY = (v: number) =>
    PAD_T + (1 - (v - proyMinY) / (proyMaxY - proyMinY + 1)) * (SVG_H - PAD_T - PAD_B);

  function polyPoints(values: number[]): string {
    return values.map((v, i) => `${toSvgX(i)},${toSvgY(v)}`).join(" ");
  }

  // ── Celda heatmap color ───────────────────────────────────────────────────────
  function cellColor(val: number): string {
    if (val < 4) return "rgba(204,0,0,0.35)";
    if (val < 7) return "rgba(234,179,8,0.30)";
    return "rgba(34,197,94,0.30)";
  }

  // ── Tab pill ──────────────────────────────────────────────────────────────────
  function TabPill({ id, label }: { id: Tab; label: string }) {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          padding: "8px 20px",
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: active ? "#cc0000" : "#1f2937",
          color: active ? "#fff" : "#9ca3af",
          transition: "background 0.2s",
        }}
      >
        {label}
      </button>
    );
  }

  const alquilerSuperaPF = calc.alquilerAnualNeto > calc.rendimientoPF;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#fff", margin: 0 }}>
              Rentabilidad de Alquiler
            </h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 0" }}>
              Calculá rentabilidad bruta, neta y payback. Compará vs plazo fijo.
            </p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>
            ← Calculadoras
          </Link>
        </div>

        {/* Layout: inputs + resultados */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>

          {/* ─── Panel de inputs ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Propiedad */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <SectionTitle>Propiedad</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Valor de compra (USD)" value={valorCompra} onChange={setValorCompra} step={5000} suffix="USD" />
                </div>
                <Field label="Tipo de cambio (ARS/USD)" value={tipoCambio} onChange={setTipoCambio} step={50} suffix="ARS" />
                <Field label="Gastos de compra (%)" value={gastosCompra} onChange={setGastosCompra} step={0.5} suffix="%" />
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Gastos anuales (ARS)" value={gastosAnualesMantenimiento} onChange={setGastosAnualesMantenimiento} step={5000} suffix="ARS/año" />
                </div>
              </div>
            </div>

            {/* Alquiler */}
            <div style={{ background: "#111", border: "1px solid #cc000033", borderRadius: 10, padding: 16 }}>
              <SectionTitle>Alquiler</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Alquiler mensual (ARS)" value={alquilerMensual} onChange={setAlquilerMensual} step={10000} suffix="ARS" />
                </div>
                <Field label="Meses ocupados" value={mesesOcupados} onChange={setMesesOcupados} step={1} min={1} suffix="/12" />
                <Field label="Ajuste anual %" value={ajusteAnual} onChange={setAjusteAnual} step={5} suffix="%" />
              </div>
            </div>

            {/* Comparativa */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <SectionTitle>Comparativa</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Field label="Tasa plazo fijo TNA (%)" value={tasaPlazoFijo} onChange={setTasaPlazoFijo} step={1} suffix="%" />
                <Field label="Inflación anual esperada (%)" value={inflacionAnual} onChange={setInflacionAnual} step={5} suffix="%" />
              </div>
            </div>

            {/* Resumen inversión */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16, fontSize: 12 }}>
              <SectionTitle>Resumen inversión</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, color: "#9ca3af" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Precio en ARS</span>
                  <span style={{ color: "#e5e5e5" }}>{ars(calc.precioCompraARS)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Gastos escritura/comp.</span>
                  <span style={{ color: "#e5e5e5" }}>{ars(calc.gastosCompraARS)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid #1f2937", fontWeight: 700 }}>
                  <span style={{ color: "#fff" }}>Inversión total</span>
                  <span style={{ color: "#cc0000", fontFamily: "Montserrat, sans-serif" }}>{ars(calc.inversionTotalARS)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Panel de resultados ─────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8 }}>
              <TabPill id="resumen" label="Resumen" />
              <TabPill id="proyeccion" label="Proyección 10 años" />
              <TabPill id="escenarios" label="Escenarios" />
            </div>

            {/* ═══ TAB 1: RESUMEN ═══════════════════════════════════════════════ */}
            {tab === "resumen" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* KPI grid 3×2 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  <KpiCard
                    label="Rent. Bruta ARS"
                    value={pct(calc.rentBrutaPct)}
                    sub={`${ars(calc.alquilerAnualBruto)} / año`}
                    color="#e5e5e5"
                  />
                  <KpiCard
                    label="Rent. Neta ARS"
                    value={pct(calc.rentNetaPct)}
                    sub={`${ars(calc.alquilerAnualNeto)} / año`}
                    color={semaforo.color}
                  />
                  <KpiCard
                    label="Rent. Bruta USD"
                    value={pct(calc.rentBrutaUSD)}
                    sub="sobre precio USD"
                    color="#4a9eff"
                  />
                  <KpiCard
                    label="Payback"
                    value={isFinite(calc.paybackAnios) ? `${calc.paybackAnios.toFixed(1)} años` : "∞"}
                    sub="para recuperar inversión"
                    color="#9ca3af"
                  />
                  <KpiCard
                    label="Rent. Real Neta"
                    value={pctSigned(calc.rentRealNeta)}
                    sub={`descontando ${inflacionAnual}% inflación`}
                    color={calc.rentRealNeta >= 0 ? "#22c55e" : "#cc0000"}
                  />
                  <KpiCard
                    label="vs Plazo Fijo"
                    value={pctSigned(calc.rentNetaPct - calc.rentPFpct)}
                    sub={`PF rinde ${pct(calc.rentPFpct, 0)} TNA`}
                    color={calc.rentNetaPct >= calc.rentPFpct ? "#22c55e" : "#cc0000"}
                  />
                </div>

                {/* Semáforo */}
                <div style={{ background: semaforo.bg, border: `1px solid ${semaforo.color}44`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: semaforo.color, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: semaforo.color }}>{semaforo.label}</span>
                    <span style={{ fontSize: 13, color: "#9ca3af", marginLeft: 10 }}>
                      Rentabilidad neta: {pct(calc.rentNetaPct)} · Real: {pctSigned(calc.rentRealNeta)}
                    </span>
                  </div>
                </div>

                {/* Tabla desglose */}
                <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
                  <SectionTitle>Desglose</SectionTitle>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Concepto", "ARS / año", "% sobre inversión"].map(h => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: h === "Concepto" ? "left" : "right", fontSize: 11, color: "#6b7280", borderBottom: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          label: "Ingreso anual bruto",
                          val: calc.alquilerAnualBruto,
                          pctVal: calc.rentBrutaPct,
                          color: "#22c55e",
                        },
                        {
                          label: "Gastos de mantenimiento",
                          val: -gastosAnualesMantenimiento,
                          pctVal: -(gastosAnualesMantenimiento / calc.inversionTotalARS) * 100,
                          color: "#cc0000",
                        },
                        {
                          label: "Ingreso anual neto",
                          val: calc.alquilerAnualNeto,
                          pctVal: calc.rentNetaPct,
                          color: calc.alquilerAnualNeto >= 0 ? "#e5e5e5" : "#cc0000",
                          bold: true,
                        },
                        {
                          label: "Gastos de compra",
                          val: -calc.gastosCompraARS,
                          pctVal: -(calc.gastosCompraARS / calc.inversionTotalARS) * 100,
                          color: "#6b7280",
                        },
                        {
                          label: "Inversión total",
                          val: calc.inversionTotalARS,
                          pctVal: null,
                          color: "#fff",
                          bold: true,
                        },
                      ].map((row) => (
                        <tr key={row.label} style={{ borderBottom: "1px solid #1a1a1a" }}>
                          <td style={{ padding: "8px 10px", fontFamily: row.bold ? "Montserrat, sans-serif" : "Inter, sans-serif", fontWeight: row.bold ? 700 : 400, color: row.color }}>
                            {row.label}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: row.color }}>
                            {ars(row.val)}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280" }}>
                            {row.pctVal !== null ? pct(row.pctVal) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Comparativa vs Plazo Fijo */}
                <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
                  <SectionTitle>Comparativa vs Plazo Fijo</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#0f0f0f", borderRadius: 8 }}>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>
                        Plazo Fijo rinde <strong style={{ color: "#4a9eff" }}>{ars(calc.rendimientoPF)}</strong> / año al {pct(calc.rentPFpct, 0)} TNA
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#0f0f0f", borderRadius: 8 }}>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>
                        Tu alquiler neto es <strong style={{ color: "#cc0000" }}>{ars(calc.alquilerAnualNeto)}</strong> / año
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "8px 20px",
                        borderRadius: 999,
                        background: alquilerSuperaPF ? "rgba(34,197,94,0.15)" : "rgba(204,0,0,0.15)",
                        border: `1px solid ${alquilerSuperaPF ? "#22c55e" : "#cc0000"}55`,
                        color: alquilerSuperaPF ? "#22c55e" : "#cc0000",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                      }}>
                        {alquilerSuperaPF
                          ? "El alquiler SUPERA al plazo fijo"
                          : "El plazo fijo supera al alquiler"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#4b5563", textAlign: "center" }}>
                      Return real PF: {pctSigned(calc.rentRealPF)} · Return real alquiler: {pctSigned(calc.rentRealNeta)} (descontando {inflacionAnual}% inflación)
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ═══ TAB 2: PROYECCIÓN 10 AÑOS ════════════════════════════════════ */}
            {tab === "proyeccion" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* SVG chart */}
                <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
                  <SectionTitle>Evolución patrimonial a 10 años</SectionTitle>
                  <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
                    {/* Grid horizontal */}
                    {[0.2, 0.4, 0.6, 0.8, 1].map((p) => {
                      const yVal = proyMinY + p * (proyMaxY - proyMinY);
                      const y = toSvgY(yVal);
                      const label = Math.abs(yVal) >= 1_000_000
                        ? `$${(yVal / 1_000_000).toFixed(1)}M`
                        : `$${(yVal / 1_000).toFixed(0)}K`;
                      return (
                        <g key={p}>
                          <line x1={PAD_L} x2={SVG_W - PAD_R} y1={y} y2={y} stroke="#1f2937" strokeWidth={1} />
                          <text x={PAD_L - 6} y={y + 4} textAnchor="end" fill="#4b5563" fontSize={9} fontFamily="Montserrat">
                            {label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Línea X=0 */}
                    {proyMinY < 0 && (
                      <line x1={PAD_L} x2={SVG_W - PAD_R} y1={toSvgY(0)} y2={toSvgY(0)} stroke="#333" strokeWidth={1} strokeDasharray="4 4" />
                    )}

                    {/* Línea 1: Patrimonio total (roja) */}
                    <polyline
                      points={polyPoints(proyeccion.map(r => r.patrimonioTotal))}
                      fill="none"
                      stroke="#cc0000"
                      strokeWidth={2.5}
                    />

                    {/* Línea 2: Plazo fijo (azul) */}
                    <polyline
                      points={polyPoints(proyeccion.map(r => r.plazoFijo))}
                      fill="none"
                      stroke="#4a9eff"
                      strokeWidth={2}
                    />

                    {/* Línea 3: Alquileres acumulados (verde punteada) */}
                    <polyline
                      points={polyPoints(proyeccion.map(r => Math.max(0, r.acumuladoNeto)))}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                    />

                    {/* Labels eje X */}
                    {proyeccion.map(r => (
                      <text key={r.anio} x={toSvgX(r.anio)} y={SVG_H - 8} textAnchor="middle" fill="#6b7280" fontSize={9} fontFamily="Montserrat">
                        {r.anio === 0 ? "Hoy" : `Año ${r.anio}`}
                      </text>
                    ))}

                    {/* Dots en año 5 y 10 */}
                    {[5, 10].map(a => {
                      const row = proyeccion[a];
                      return (
                        <g key={a}>
                          <circle cx={toSvgX(a)} cy={toSvgY(row.patrimonioTotal)} r={4} fill="#cc0000" />
                          <circle cx={toSvgX(a)} cy={toSvgY(row.plazoFijo)} r={4} fill="#4a9eff" />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Leyenda */}
                  <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
                    {[
                      { color: "#cc0000", label: "Patrimonio total (prop. + alquileres)", dash: false },
                      { color: "#4a9eff", label: "Solo Plazo Fijo", dash: false },
                      { color: "#22c55e", label: "Alquileres acumulados netos", dash: true },
                    ].map(l => (
                      <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: l.color }}>
                        <svg width={24} height={8}>
                          <line x1={0} y1={4} x2={24} y2={4} stroke={l.color} strokeWidth={l.dash ? 1.5 : 2} strokeDasharray={l.dash ? "5 3" : undefined} />
                        </svg>
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tabla proyección */}
                <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
                  <SectionTitle>Tabla año por año</SectionTitle>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {["Año", "Valor propiedad", "Alq. acum. neto", "Patrimonio total", "vs Plazo Fijo", "Diferencia"].map(h => (
                            <th key={h} style={{ padding: "6px 10px", textAlign: h === "Año" ? "center" : "right", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif", fontWeight: 700, whiteSpace: "nowrap" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {proyeccion.map(row => {
                          const diff = row.patrimonioTotal - row.plazoFijo;
                          return (
                            <tr key={row.anio} style={{ borderBottom: "1px solid #1a1a1a", background: row.anio % 2 === 0 ? "rgba(255,255,255,0.01)" : undefined }}>
                              <td style={{ padding: "7px 10px", textAlign: "center", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#6b7280" }}>{row.anio}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>{ars(row.valorPropARS)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: "#22c55e" }}>{ars(Math.max(0, row.acumuladoNeto))}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: "#fff", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{ars(row.patrimonioTotal)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: "#4a9eff" }}>{ars(row.plazoFijo)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", color: diff >= 0 ? "#22c55e" : "#cc0000", fontWeight: 600 }}>
                                {diff >= 0 ? "+" : ""}{ars(diff)}
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

            {/* ═══ TAB 3: ESCENARIOS ════════════════════════════════════════════ */}
            {tab === "escenarios" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
                  <SectionTitle>Sensibilidad: rent. neta % según alquiler y ocupación</SectionTitle>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>
                    Celda actual resaltada en blanco. Fijo todo salvo alquiler mensual (±30%) y meses ocupados.
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif", whiteSpace: "nowrap" }}>
                            Meses \ Alquiler
                          </th>
                          {alquilerVariantes.map((alq, ci) => {
                            const delta = [-30, -20, -10, 0, 10, 20, 30][ci];
                            return (
                              <th key={ci} style={{ padding: "8px 10px", textAlign: "center", fontSize: 10, color: "#9ca3af", borderBottom: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif", whiteSpace: "nowrap" }}>
                                {delta === 0 ? "Base" : `${delta > 0 ? "+" : ""}${delta}%`}
                                <br />
                                <span style={{ color: "#4b5563", fontWeight: 400 }}>{ars(alq)}</span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {mesesVariantes.map((mes, ri) => (
                          <tr key={mes}>
                            <td style={{ padding: "8px 12px", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#9ca3af", borderRight: "1px solid #1f2937", whiteSpace: "nowrap" }}>
                              {mes} {mes === 1 ? "mes" : "meses"}
                            </td>
                            {alquilerVariantes.map((alq, ci) => {
                              const val = heatmapData[ri][ci];
                              const isCurrent =
                                Math.abs(alq - alquilerMensual) < 0.01 &&
                                mes === mesesOcupados;
                              return (
                                <td
                                  key={ci}
                                  style={{
                                    padding: "10px 14px",
                                    textAlign: "center",
                                    background: cellColor(val),
                                    border: isCurrent ? "2px solid #fff" : "1px solid #1a1a1a",
                                    fontFamily: "Montserrat, sans-serif",
                                    fontWeight: isCurrent ? 800 : 600,
                                    color: isCurrent ? "#fff" : "#e5e5e5",
                                    fontSize: isCurrent ? 13 : 12,
                                  }}
                                >
                                  {pct(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Leyenda heatmap */}
                  <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 11 }}>
                    {[
                      { color: "rgba(204,0,0,0.35)", label: "< 4% — Baja" },
                      { color: "rgba(234,179,8,0.30)", label: "4–7% — Aceptable" },
                      { color: "rgba(34,197,94,0.30)", label: "> 7% — Buena" },
                    ].map(l => (
                      <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af" }}>
                        <span style={{ display: "inline-block", width: 14, height: 14, background: l.color, borderRadius: 3 }} />
                        {l.label}
                      </span>
                    ))}
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af" }}>
                      <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #fff", borderRadius: 3 }} />
                      Escenario actual
                    </span>
                  </div>
                </div>

                {/* Análisis de sensibilidad por texto */}
                <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
                  <SectionTitle>Análisis rápido</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      {
                        label: "Escenario pesimista",
                        alq: alquilerMensual * 0.7,
                        mes: Math.max(6, mesesOcupados - 2),
                        color: "#cc0000",
                      },
                      {
                        label: "Escenario base",
                        alq: alquilerMensual,
                        mes: mesesOcupados,
                        color: "#eab308",
                      },
                      {
                        label: "Escenario optimista",
                        alq: alquilerMensual * 1.3,
                        mes: Math.min(12, mesesOcupados + 1),
                        color: "#22c55e",
                      },
                    ].map(s => {
                      const bruto = s.alq * s.mes;
                      const neto = bruto - gastosAnualesMantenimiento;
                      const rentNeta = (neto / calc.inversionTotalARS) * 100;
                      return (
                        <div key={s.label} style={{ background: "#0f0f0f", borderRadius: 8, padding: 14, border: `1px solid ${s.color}33` }}>
                          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: s.color, marginBottom: 8 }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div>Alquiler: <span style={{ color: "#e5e5e5" }}>{ars(s.alq)}/mes</span></div>
                            <div>Meses: <span style={{ color: "#e5e5e5" }}>{s.mes}</span></div>
                            <div>Neto: <span style={{ color: "#e5e5e5" }}>{ars(neto)}/año</span></div>
                            <div style={{ marginTop: 4 }}>
                              Rent. neta:{" "}
                              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: s.color }}>
                                {pct(rentNeta)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Disclaimer */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
              <strong style={{ color: "#9ca3af" }}>Aviso:</strong> Esta calculadora es orientativa. Los valores dependen de variables de mercado. Consultá un profesional antes de tomar decisiones de inversión.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
