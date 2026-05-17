"use client";

import { useState, useMemo } from "react";

interface Inversion {
  id: number;
  nombre: string;
  precioUSD: number;
  m2: number;
  alquilerMensualUSD: number;
  vacanciaPct: number;
  gastosAnualesPct: number;
  apreciacionAnualPct: number;
  financiamientoPct: number;
  tasaHipotecaPct: number;
  plazoHipotecaAnios: number;
  gastosCierreUSD: number;
  color: string;
}

const COLORES = ["#cc0000", "#3b82f6", "#22c55e", "#f59e0b"];
const DEFAULT_INVERSION = (id: number, color: string): Inversion => ({
  id,
  nombre: `Inversión ${id}`,
  precioUSD: 80000 + id * 20000,
  m2: 40 + id * 10,
  alquilerMensualUSD: 500 + id * 100,
  vacanciaPct: 8,
  gastosAnualesPct: 20,
  apreciacionAnualPct: 5,
  financiamientoPct: 0,
  tasaHipotecaPct: 8,
  plazoHipotecaAnios: 20,
  gastosCierreUSD: 3000 + id * 500,
  color,
});

function cuotaMensual(capital: number, tna: number, plazoAnios: number): number {
  const r = tna / 100 / 12;
  const n = plazoAnios * 12;
  if (r === 0 || n === 0) return 0;
  return (capital * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

interface Metricas {
  costoTotal: number;
  rentaBrutaAnual: number;
  rentaBrutaPct: number;
  rentaNetaAnual: number;
  rentaNetaPct: number;
  cuotaHipotecaMensual: number;
  cashflowMensual: number;
  cashflowAnual: number;
  valorAnio5: number;
  valorAnio10: number;
  tirAnio10: number;
  paybackAnios: number | null;
  precioM2: number;
  rentaM2: number;
}

function calcularMetricas(inv: Inversion): Metricas {
  const capitalFinanciado = inv.precioUSD * (inv.financiamientoPct / 100);
  const costoTotal = inv.precioUSD + inv.gastosCierreUSD;

  const rentaBrutaAnual = inv.alquilerMensualUSD * 12 * (1 - inv.vacanciaPct / 100);
  const gastosAnuales = rentaBrutaAnual * (inv.gastosAnualesPct / 100);
  const rentaNetaAnual = rentaBrutaAnual - gastosAnuales;

  const rentaBrutaPct = (rentaBrutaAnual / costoTotal) * 100;
  const rentaNetaPct = (rentaNetaAnual / costoTotal) * 100;

  const cuota = cuotaMensual(capitalFinanciado, inv.tasaHipotecaPct, inv.plazoHipotecaAnios);
  const cashflowMensual = rentaNetaAnual / 12 - cuota;
  const cashflowAnual = cashflowMensual * 12;

  // Valorización a 5 y 10 años
  const valorAnio5 = inv.precioUSD * Math.pow(1 + inv.apreciacionAnualPct / 100, 5);
  const valorAnio10 = inv.precioUSD * Math.pow(1 + inv.apreciacionAnualPct / 100, 10);

  // TIR simplificada a 10 años (CF anual + venta)
  const flujos: number[] = [-costoTotal];
  for (let i = 1; i <= 10; i++) {
    flujos.push(cashflowAnual);
  }
  flujos[10] += valorAnio10;

  // Newton-Raphson TIR
  let r = 0.08;
  for (let it = 0; it < 100; it++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < flujos.length; t++) {
      npv += flujos[t] / Math.pow(1 + r, t);
      dnpv -= t * flujos[t] / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const rn = r - npv / dnpv;
    if (Math.abs(rn - r) < 1e-8) { r = rn; break; }
    r = rn;
  }
  const tirAnio10 = r * 100;

  // Payback: año en que CF acumulado >= inversión propia
  const inversionPropia = costoTotal - capitalFinanciado;
  let acum = 0;
  let payback: number | null = null;
  for (let i = 1; i <= 30; i++) {
    acum += cashflowAnual;
    if (acum >= inversionPropia) { payback = i; break; }
  }

  const precioM2 = inv.m2 > 0 ? inv.precioUSD / inv.m2 : 0;
  const rentaM2 = inv.m2 > 0 ? rentaNetaAnual / inv.m2 : 0;

  return {
    costoTotal,
    rentaBrutaAnual,
    rentaBrutaPct,
    rentaNetaAnual,
    rentaNetaPct,
    cuotaHipotecaMensual: cuota,
    cashflowMensual,
    cashflowAnual,
    valorAnio5,
    valorAnio10,
    tirAnio10,
    paybackAnios: payback,
    precioM2,
    rentaM2,
  };
}

function fmtUSD(v: number, d = 0): string {
  if (Math.abs(v) >= 1000000) return `USD ${(v / 1000000).toFixed(2)}M`;
  if (Math.abs(v) >= 1000) return `USD ${(v / 1000).toFixed(1)}k`;
  return `USD ${v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
function fmtPct(v: number): string { return v.toFixed(2) + "%"; }

function colorMetrica(val: number, vals: number[], higher = true): string {
  const sorted = [...vals].sort((a, b) => b - a);
  const best = higher ? sorted[0] : sorted[sorted.length - 1];
  const worst = higher ? sorted[sorted.length - 1] : sorted[0];
  if (val === best) return "#22c55e";
  if (val === worst && vals.length > 1) return "#ef4444";
  return "#f59e0b";
}

export default function CompararInversionesPage() {
  const [inversiones, setInversiones] = useState<Inversion[]>([
    DEFAULT_INVERSION(1, COLORES[0]),
    DEFAULT_INVERSION(2, COLORES[1]),
  ]);
  const [editandoIdx, setEditandoIdx] = useState(0);

  const metricas = useMemo(() =>
    inversiones.map((inv) => calcularMetricas(inv)),
    [inversiones]
  );

  function addInversion() {
    if (inversiones.length >= 4) return;
    const id = inversiones.length + 1;
    setInversiones((prev) => [...prev, DEFAULT_INVERSION(id, COLORES[prev.length])]);
    setEditandoIdx(inversiones.length);
  }

  function removeInversion(idx: number) {
    if (inversiones.length <= 1) return;
    setInversiones((prev) => prev.filter((_, i) => i !== idx));
    setEditandoIdx(Math.min(editandoIdx, inversiones.length - 2));
  }

  function updateField<K extends keyof Inversion>(idx: number, key: K, value: Inversion[K]) {
    setInversiones((prev) => prev.map((inv, i) => i === idx ? { ...inv, [key]: value } : inv));
  }

  const inp: React.CSSProperties = {
    background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 6,
    color: "#fff", padding: "7px 10px", fontSize: 13, width: "100%",
    fontFamily: "Inter, sans-serif",
  };

  const FILAS_COMPARACION: Array<{
    label: string;
    key: keyof Metricas;
    fmt: (v: number) => string;
    higher?: boolean;
    section?: string;
  }> = [
    { label: "Costo total (+ cierre)", key: "costoTotal", fmt: fmtUSD, higher: false, section: "Inversión" },
    { label: "Precio m²", key: "precioM2", fmt: (v) => `USD ${Math.round(v).toLocaleString("es-AR")}/m²`, higher: false },
    { label: "Renta bruta anual", key: "rentaBrutaPct", fmt: fmtPct, higher: true, section: "Renta" },
    { label: "Renta neta anual", key: "rentaNetaPct", fmt: fmtPct, higher: true },
    { label: "Renta neta / m²", key: "rentaM2", fmt: (v) => `USD ${v.toFixed(0)}/m²/año`, higher: true },
    { label: "Cuota hipoteca/mes", key: "cuotaHipotecaMensual", fmt: fmtUSD, higher: false, section: "Cashflow" },
    { label: "Cashflow mensual", key: "cashflowMensual", fmt: fmtUSD, higher: true },
    { label: "Cashflow anual", key: "cashflowAnual", fmt: fmtUSD, higher: true },
    { label: "Valor año 5", key: "valorAnio5", fmt: fmtUSD, higher: true, section: "Valorización" },
    { label: "Valor año 10", key: "valorAnio10", fmt: fmtUSD, higher: true },
    { label: "TIR 10 años", key: "tirAnio10", fmt: fmtPct, higher: true, section: "Rentabilidad total" },
    { label: "Payback (años)", key: "paybackAnios", fmt: (v) => v === null ? "No alcanzado" : `${v} años`, higher: false },
  ];

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>
              Comparador de Inversiones
            </h1>
            <p style={{ color: "#999", fontSize: 14, margin: "8px 0 0" }}>
              Comparación lado a lado de hasta 4 opciones de inversión
            </p>
          </div>
          <button
            onClick={addInversion}
            disabled={inversiones.length >= 4}
            style={{
              padding: "10px 20px", borderRadius: 8,
              border: "1px solid #cc0000", background: "rgba(204,0,0,0.15)",
              color: inversiones.length >= 4 ? "#555" : "#cc0000",
              fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12,
              cursor: inversiones.length >= 4 ? "not-allowed" : "pointer",
              textTransform: "uppercase",
            }}
          >
            + Agregar opción
          </button>
        </div>

        {/* Editor tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {inversiones.map((inv, idx) => (
            <button
              key={inv.id}
              onClick={() => setEditandoIdx(idx)}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: `1px solid ${editandoIdx === idx ? inv.color : "#333"}`,
                background: editandoIdx === idx ? `${inv.color}22` : "#111",
                color: editandoIdx === idx ? inv.color : "#888",
                fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12,
                cursor: "pointer",
              }}
            >
              {inv.nombre}
            </button>
          ))}
        </div>

        {/* Editor panel */}
        <div style={{ background: "#111", border: `1px solid ${inversiones[editandoIdx]?.color ?? "#222"}44`, borderRadius: 12, padding: 20, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: inversiones[editandoIdx]?.color }}>
              Editar: {inversiones[editandoIdx]?.nombre}
            </div>
            {inversiones.length > 1 && (
              <button
                onClick={() => removeInversion(editandoIdx)}
                style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "#ef4444", padding: "4px 12px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}
              >
                Eliminar
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {/* Nombre */}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>Nombre</div>
              <input type="text" value={inversiones[editandoIdx]?.nombre} onChange={(e) => updateField(editandoIdx, "nombre", e.target.value)} style={{ ...inp, maxWidth: 300 }} />
            </div>

            {[
              { label: "Precio (USD)", key: "precioUSD" as const, step: 5000 },
              { label: "Superficie (m²)", key: "m2" as const, step: 5 },
              { label: "Alquiler/mes (USD)", key: "alquilerMensualUSD" as const, step: 50 },
              { label: "Vacancia (%)", key: "vacanciaPct" as const, step: 1, max: 50 },
              { label: "Gastos anuales (%)", key: "gastosAnualesPct" as const, step: 1, max: 50 },
              { label: "Apreciación anual (%)", key: "apreciacionAnualPct" as const, step: 0.5 },
              { label: "% Financiado", key: "financiamientoPct" as const, step: 5, max: 90 },
              { label: "TNA hipoteca (%)", key: "tasaHipotecaPct" as const, step: 0.5 },
              { label: "Plazo hipoteca (años)", key: "plazoHipotecaAnios" as const, step: 5, min: 5, max: 30 },
              { label: "Gastos cierre (USD)", key: "gastosCierreUSD" as const, step: 500 },
            ].map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                  {f.label}
                </div>
                <input
                  type="number"
                  value={(inversiones[editandoIdx] as unknown as Record<string, number>)?.[f.key] ?? 0}
                  step={f.step}
                  min={f.min ?? 0}
                  max={(f as { max?: number }).max}
                  onChange={(e) => updateField(editandoIdx, f.key, parseFloat(e.target.value) || 0)}
                  style={inp}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tabla comparación */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 20px", color: "#fff" }}>
            Comparación
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 14px", color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid #222", minWidth: 180 }}>
                    Métrica
                  </th>
                  {inversiones.map((inv) => (
                    <th key={inv.id} style={{ textAlign: "center", padding: "10px 14px", fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: inv.color, borderBottom: `2px solid ${inv.color}`, minWidth: 160 }}>
                      {inv.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FILAS_COMPARACION.map((fila, fi) => {
                  const vals = metricas.map((m) => {
                    const v = m[fila.key];
                    return typeof v === "number" ? v : 0;
                  });
                  const isSection = fi === 0 || fila.section !== FILAS_COMPARACION[fi - 1].section;
                  return (
                    <>
                      {isSection && fila.section && (
                        <tr key={`section-${fila.section}`}>
                          <td colSpan={inversiones.length + 1} style={{ padding: "10px 14px 4px", fontSize: 10, color: "#444", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            {fila.section}
                          </td>
                        </tr>
                      )}
                      <tr key={fila.key} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ padding: "9px 14px", fontSize: 13, color: "#aaa" }}>{fila.label}</td>
                        {metricas.map((m, mi) => {
                          const rawVal = m[fila.key];
                          const numVal = typeof rawVal === "number" ? rawVal : 0;
                          const color = inversiones.length > 1
                            ? colorMetrica(numVal, vals, fila.higher !== false)
                            : "#fff";
                          return (
                            <td key={mi} style={{ padding: "9px 14px", textAlign: "center", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color }}>
                              {rawVal === null ? "—" : fila.fmt(numVal)}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 11, color: "#888" }}>Mejor</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
              <span style={{ fontSize: 11, color: "#888" }}>Intermedio</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
              <span style={{ fontSize: 11, color: "#888" }}>Peor</span>
            </div>
          </div>
        </div>

        {/* Spider chart - radar visual */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 20px", color: "#fff" }}>
            Resumen Visual
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${inversiones.length}, 1fr)`, gap: 16 }}>
            {inversiones.map((inv, idx) => {
              const m = metricas[idx];
              const score = Math.round(
                (Math.min(10, Math.max(0, m.rentaNetaPct)) / 10) * 25 +
                (Math.min(20, Math.max(0, m.tirAnio10)) / 20) * 35 +
                (m.cashflowMensual > 0 ? 20 : 0) +
                (m.paybackAnios != null && m.paybackAnios <= 15 ? 20 : 0)
              );
              return (
                <div key={inv.id} style={{ background: "#161616", border: `1px solid ${inv.color}44`, borderRadius: 12, padding: 20, textAlign: "center" }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 15, color: inv.color, marginBottom: 12 }}>
                    {inv.nombre}
                  </div>
                  <div style={{ fontSize: 42, fontFamily: "Montserrat, sans-serif", fontWeight: 900, color: "#fff", marginBottom: 4 }}>
                    {score}
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 16 }}>score /100</div>
                  {[
                    { label: "Renta neta", value: fmtPct(m.rentaNetaPct) },
                    { label: "TIR 10a", value: fmtPct(m.tirAnio10) },
                    { label: "CF mensual", value: fmtUSD(m.cashflowMensual) },
                    { label: "Payback", value: m.paybackAnios != null ? `${m.paybackAnios}a` : "—" },
                  ].map((r) => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #222" }}>
                      <span style={{ fontSize: 12, color: "#888" }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
