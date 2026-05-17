"use client";

import { useState, useMemo } from "react";

interface BaseScenario {
  precioCompraUSD: number;
  alquilerMensualUSD: number;
  vacanciaPct: number;
  gastosOperativosPct: number;
  financiamientoPct: number; // % del precio financiado
  tasaAnualPct: number; // TNA del crédito
  plazoAnios: number;
}

interface SensibilidadRow {
  variacion: number; // -20, -15, -10, -5, 0, +5, +10, +15, +20
  precioCompra: number;
  alquiler: number;
  vacancia: number;
  financiamiento: number;
}

function calcRentaNeta(
  precioUSD: number,
  alquilerMensualUSD: number,
  vacanciaPct: number,
  gastosOperativosPct: number
): number {
  const rentaBrutaAnual = alquilerMensualUSD * 12;
  const rentaEfectiva = rentaBrutaAnual * (1 - vacanciaPct / 100);
  const gastos = rentaEfectiva * (gastosOperativosPct / 100);
  const rentaNetaAnual = rentaEfectiva - gastos;
  return (rentaNetaAnual / precioUSD) * 100;
}

function calcPayback(rentaNetaPct: number): number {
  if (rentaNetaPct <= 0) return 999;
  return 100 / rentaNetaPct;
}

function calcCuotaMensual(capital: number, tnaAnual: number, plazoAnios: number): number {
  const r = tnaAnual / 100 / 12;
  const n = plazoAnios * 12;
  if (r === 0) return capital / n;
  return (capital * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcCashflowMensual(
  precioUSD: number,
  alquilerMensualUSD: number,
  vacanciaPct: number,
  gastosOperativosPct: number,
  financiamientoPct: number,
  tasaAnualPct: number,
  plazoAnios: number
): number {
  const capitalFinanciado = precioUSD * (financiamientoPct / 100);
  const cuotaMensual = calcCuotaMensual(capitalFinanciado, tasaAnualPct, plazoAnios);
  const ingresoNeto =
    alquilerMensualUSD *
    (1 - vacanciaPct / 100) *
    (1 - gastosOperativosPct / 100);
  return ingresoNeto - cuotaMensual;
}

const VARIACIONES = [-20, -15, -10, -5, 0, 5, 10, 15, 20];

function colorForValue(val: number, base: number, invertido: boolean): string {
  const diff = val - base;
  const pct = base !== 0 ? (diff / Math.abs(base)) * 100 : 0;
  if (Math.abs(pct) < 0.1) return "#1a1a1a";
  if (invertido) {
    if (pct > 5) return "rgba(204,0,0,0.45)";
    if (pct > 0) return "rgba(204,0,0,0.2)";
    if (pct < -5) return "rgba(34,197,94,0.35)";
    return "rgba(34,197,94,0.15)";
  } else {
    if (pct > 5) return "rgba(34,197,94,0.35)";
    if (pct > 0) return "rgba(34,197,94,0.15)";
    if (pct < -5) return "rgba(204,0,0,0.45)";
    return "rgba(204,0,0,0.2)";
  }
}

function fmtPct(val: number): string {
  return val.toFixed(2) + "%";
}

function fmtAnios(val: number): string {
  if (val >= 99) return ">99a";
  return val.toFixed(1) + "a";
}

function fmtUSD(val: number): string {
  return "$" + Math.round(val).toLocaleString("es-AR");
}

type Metrica = "renta_neta" | "payback" | "cashflow";

export default function SensibilidadPage() {
  const [base, setBase] = useState<BaseScenario>({
    precioCompraUSD: 100000,
    alquilerMensualUSD: 600,
    vacanciaPct: 8,
    gastosOperativosPct: 20,
    financiamientoPct: 0,
    tasaAnualPct: 8,
    plazoAnios: 20,
  });
  const [metrica, setMetrica] = useState<Metrica>("renta_neta");

  const baseRenta = useMemo(
    () =>
      calcRentaNeta(
        base.precioCompraUSD,
        base.alquilerMensualUSD,
        base.vacanciaPct,
        base.gastosOperativosPct
      ),
    [base]
  );

  const baseCashflow = useMemo(
    () =>
      calcCashflowMensual(
        base.precioCompraUSD,
        base.alquilerMensualUSD,
        base.vacanciaPct,
        base.gastosOperativosPct,
        base.financiamientoPct,
        base.tasaAnualPct,
        base.plazoAnios
      ),
    [base]
  );

  const rows = useMemo((): SensibilidadRow[] => {
    return VARIACIONES.map((v) => {
      const factorPrecio = 1 + v / 100;
      const factorAlquiler = 1 + v / 100;
      const vacanciaAbs = Math.max(0, Math.min(100, base.vacanciaPct + v));
      const tasaAbs = Math.max(0, base.tasaAnualPct + v);

      const rentaPrecio = calcRentaNeta(
        base.precioCompraUSD * factorPrecio,
        base.alquilerMensualUSD,
        base.vacanciaPct,
        base.gastosOperativosPct
      );
      const rentaAlquiler = calcRentaNeta(
        base.precioCompraUSD,
        base.alquilerMensualUSD * factorAlquiler,
        base.vacanciaPct,
        base.gastosOperativosPct
      );
      const rentaVacancia = calcRentaNeta(
        base.precioCompraUSD,
        base.alquilerMensualUSD,
        vacanciaAbs,
        base.gastosOperativosPct
      );
      const cfTasa = calcCashflowMensual(
        base.precioCompraUSD,
        base.alquilerMensualUSD,
        base.vacanciaPct,
        base.gastosOperativosPct,
        base.financiamientoPct,
        tasaAbs,
        base.plazoAnios
      );

      return {
        variacion: v,
        precioCompra: rentaPrecio,
        alquiler: rentaAlquiler,
        vacancia: rentaVacancia,
        financiamiento: cfTasa,
      };
    });
  }, [base]);

  // Tornado: impact range per variable
  const tornado = useMemo(() => {
    const vars = ["precioCompra", "alquiler", "vacancia", "financiamiento"] as const;
    const labels: Record<string, string> = {
      precioCompra: "Precio de compra",
      alquiler: "Alquiler mensual",
      vacancia: "Vacancia",
      financiamiento: "Tasa financiamiento",
    };
    return vars.map((v) => {
      const vals = rows.map((r) => r[v]);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      return { key: v, label: labels[v], min, max, range: max - min };
    }).sort((a, b) => b.range - a.range);
  }, [rows]);

  const maxRange = useMemo(() => Math.max(...tornado.map((t) => t.range)), [tornado]);

  function getMetricaValue(row: SensibilidadRow, col: keyof Omit<SensibilidadRow, "variacion">): number {
    const rentaVal = row[col];
    if (metrica === "renta_neta") return rentaVal;
    if (metrica === "payback") return calcPayback(rentaVal);
    // cashflow — for financiamiento col use cashflow, others use renta-derived
    return rentaVal;
  }

  function formatMetrica(val: number): string {
    if (metrica === "renta_neta") return fmtPct(val);
    if (metrica === "payback") return fmtAnios(val);
    return fmtPct(val);
  }

  function getBaseForCol(col: keyof Omit<SensibilidadRow, "variacion">): number {
    if (metrica === "renta_neta") return baseRenta;
    if (metrica === "payback") return calcPayback(baseRenta);
    return baseCashflow;
  }

  function isInvertidoForCol(col: keyof Omit<SensibilidadRow, "variacion">): boolean {
    if (metrica === "payback") return true; // menor payback es mejor
    if (col === "vacancia" || col === "financiamiento") return true;
    if (col === "precioCompra") return true;
    return false;
  }

  const inp: React.CSSProperties = {
    background: "#111",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#fff",
    padding: "8px 12px",
    fontSize: 14,
    width: "100%",
    fontFamily: "Inter, sans-serif",
  };

  const colHeaders = [
    { key: "precioCompra" as const, label: "Precio compra" },
    { key: "alquiler" as const, label: "Alquiler" },
    { key: "vacancia" as const, label: "Vacancia" },
    { key: "financiamiento" as const, label: "Tasa financ." },
  ];

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, margin: 0, color: "#fff" }}>
            Análisis de Sensibilidad
          </h1>
          <p style={{ color: "#999", fontSize: 14, margin: "8px 0 0" }}>
            Impacto de variables clave sobre la rentabilidad de la inversión
          </p>
        </div>

        {/* Config + Metric selector */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
          {/* Parámetros base */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 20px", color: "#cc0000" }}>
              Escenario Base
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Precio de compra (USD)", key: "precioCompraUSD", step: 5000, min: 10000 },
                { label: "Alquiler mensual (USD)", key: "alquilerMensualUSD", step: 50, min: 100 },
                { label: "Vacancia (%)", key: "vacanciaPct", step: 1, min: 0, max: 50 },
                { label: "Gastos operativos (%)", key: "gastosOperativosPct", step: 1, min: 0, max: 50 },
                { label: "% Financiado", key: "financiamientoPct", step: 5, min: 0, max: 90 },
                { label: "TNA crédito (%)", key: "tasaAnualPct", step: 0.5, min: 0, max: 30 },
              ].map((f) => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                    {f.label}
                  </div>
                  <input
                    type="number"
                    value={base[f.key as keyof BaseScenario]}
                    step={f.step}
                    min={f.min ?? 0}
                    max={(f as { max?: number }).max}
                    onChange={(e) => setBase((b) => ({ ...b, [f.key]: parseFloat(e.target.value) || 0 }))}
                    style={inp}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* KPIs base + metrica */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 16px", color: "#cc0000" }}>
                Métricas Base
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Renta Neta Anual", value: fmtPct(baseRenta) },
                  { label: "Payback", value: fmtAnios(calcPayback(baseRenta)) },
                  {
                    label: "Renta Bruta Anual",
                    value: fmtPct((base.alquilerMensualUSD * 12 / base.precioCompraUSD) * 100),
                  },
                  { label: "Cashflow mensual", value: fmtUSD(baseCashflow) },
                ].map((k) => (
                  <div key={k.label} style={{ background: "#161616", borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                      {k.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Montserrat, sans-serif", color: "#fff" }}>
                      {k.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 10, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                Mostrar en tabla
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["renta_neta", "payback"] as Metrica[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetrica(m)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 8,
                      border: metrica === m ? "1px solid #cc0000" : "1px solid #333",
                      background: metrica === m ? "rgba(204,0,0,0.15)" : "#161616",
                      color: metrica === m ? "#cc0000" : "#888",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    {m === "renta_neta" ? "Renta Neta %" : "Payback (años)"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sensitivity Matrix */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 20px", color: "#fff" }}>
            Matriz de Sensibilidad
          </h2>
          <p style={{ color: "#666", fontSize: 12, margin: "0 0 16px" }}>
            Cada columna varía una variable ±%; las demás permanecen en el valor base.
            Verde = mejor que base · Rojo = peor que base
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid #222" }}>
                    Variación
                  </th>
                  {colHeaders.map((c) => (
                    <th key={c.key} style={{ textAlign: "center", padding: "8px 12px", color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid #222" }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isBase = row.variacion === 0;
                  return (
                    <tr key={row.variacion} style={{ borderBottom: "1px solid #1a1a1a" }}>
                      <td style={{
                        padding: "8px 12px",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: isBase ? 800 : 600,
                        color: isBase ? "#cc0000" : row.variacion > 0 ? "#4ade80" : "#f87171",
                        fontSize: 13,
                      }}>
                        {isBase ? "Base (0%)" : (row.variacion > 0 ? "+" : "") + row.variacion + "%"}
                      </td>
                      {colHeaders.map((c) => {
                        const val = getMetricaValue(row, c.key);
                        const baseVal = getBaseForCol(c.key);
                        const bg = isBase ? "#1a1a1a" : colorForValue(val, baseVal, isInvertidoForCol(c.key));
                        return (
                          <td key={c.key} style={{
                            padding: "8px 12px",
                            textAlign: "center",
                            background: bg,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: isBase ? 800 : 600,
                            color: isBase ? "#cc0000" : "#fff",
                            fontSize: 13,
                            borderRadius: 4,
                          }}>
                            {formatMetrica(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tornado Chart */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 24, marginBottom: 32 }}>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 8px", color: "#fff" }}>
            Gráfico Tornado
          </h2>
          <p style={{ color: "#666", fontSize: 12, margin: "0 0 24px" }}>
            Rango de variación de la renta neta al aplicar ±20% a cada variable
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {tornado.map((t) => {
              const barWidth = 560;
              const center = barWidth / 2;
              const scale = maxRange > 0 ? (barWidth / 2) / maxRange : 1;

              const baseR = baseRenta;
              const leftWidth = (baseR - t.min) * scale;
              const rightWidth = (t.max - baseR) * scale;

              return (
                <div key={t.key}>
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    {t.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 12, textAlign: "right", fontSize: 11, color: "#f87171", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      {fmtPct(t.min)}
                    </div>
                    <svg width={barWidth + 2} height={32} style={{ overflow: "visible" }}>
                      {/* base line */}
                      <line x1={center} y1={0} x2={center} y2={32} stroke="#333" strokeWidth={1} />
                      {/* left bar (downside) */}
                      <rect
                        x={center - leftWidth}
                        y={6}
                        width={leftWidth}
                        height={20}
                        rx={3}
                        fill="rgba(204,0,0,0.6)"
                      />
                      {/* right bar (upside) */}
                      <rect
                        x={center}
                        y={6}
                        width={rightWidth}
                        height={20}
                        rx={3}
                        fill="rgba(34,197,94,0.6)"
                      />
                      {/* base dot */}
                      <circle cx={center} cy={16} r={4} fill="#cc0000" />
                    </svg>
                    <div style={{ width: 12, textAlign: "left", fontSize: 11, color: "#4ade80", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      {fmtPct(t.max)}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      rango: {fmtPct(t.range)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 12, borderRadius: 2, background: "rgba(204,0,0,0.6)" }} />
              <span style={{ fontSize: 11, color: "#888" }}>Escenario desfavorable</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 12, borderRadius: 2, background: "rgba(34,197,94,0.6)" }} />
              <span style={{ fontSize: 11, color: "#888" }}>Escenario favorable</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#cc0000" }} />
              <span style={{ fontSize: 11, color: "#888" }}>Valor base ({fmtPct(baseRenta)})</span>
            </div>
          </div>
        </div>

        {/* Escenarios extremos */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 20px", color: "#fff" }}>
            Escenarios Extremos
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              {
                label: "Mejor caso",
                desc: "Precio -20%, alquiler +20%, vacancia mín, tasa mín",
                renta: calcRentaNeta(
                  base.precioCompraUSD * 0.8,
                  base.alquilerMensualUSD * 1.2,
                  Math.max(0, base.vacanciaPct - 20),
                  base.gastosOperativosPct
                ),
                color: "#22c55e",
                bg: "rgba(34,197,94,0.08)",
                border: "rgba(34,197,94,0.3)",
              },
              {
                label: "Escenario base",
                desc: "Todas las variables en valor base",
                renta: baseRenta,
                color: "#cc0000",
                bg: "rgba(204,0,0,0.08)",
                border: "rgba(204,0,0,0.3)",
              },
              {
                label: "Peor caso",
                desc: "Precio +20%, alquiler -20%, vacancia máx, tasa máx",
                renta: calcRentaNeta(
                  base.precioCompraUSD * 1.2,
                  base.alquilerMensualUSD * 0.8,
                  Math.min(100, base.vacanciaPct + 20),
                  base.gastosOperativosPct
                ),
                color: "#ef4444",
                bg: "rgba(239,68,68,0.08)",
                border: "rgba(239,68,68,0.3)",
              },
            ].map((s) => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 15, color: s.color, marginBottom: 6 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 32, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                  {fmtPct(s.renta)}
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>{s.desc}</div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#aaa" }}>
                  Payback: <strong style={{ color: "#fff" }}>{fmtAnios(calcPayback(s.renta))}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
