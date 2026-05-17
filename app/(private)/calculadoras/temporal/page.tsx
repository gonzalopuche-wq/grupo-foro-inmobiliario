"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const fmt = (n: number, d = 0) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = (n: number) => `USD ${fmt(n, 0)}`;
const fmtARS = (n: number) => `$${fmt(n, 0)}`;
const fmtPct = (n: number) => `${fmt(n, 2)}%`;

interface ScenarioResult {
  ingresoMensual: number;
  gastosMensual: number;
  flujoNeto: number;
  rentAnual: number;
  paybackAnios: number;
  ingresoAnual: number;
}

export default function CalculadoraTemporal() {
  // Propiedad
  const [precioUSD, setPrecioUSD] = useState<string>("120000");
  const [tc, setTc] = useState<string>("1200");
  const [expensas, setExpensas] = useState<string>("80000");
  const [impuestos, setImpuestos] = useState<string>("30000");
  const [mantenimiento, setMantenimiento] = useState<string>("40000");
  const [seguro, setSeguro] = useState<string>("20000");

  // Temporal
  const [tarifaNoche, setTarifaNoche] = useState<string>("80");
  const [ocupacion, setOcupacion] = useState<string>("65");
  const [platformFee, setPlatformFee] = useState<string>("15");
  const [gastosHuesped, setGastosHuesped] = useState<string>("15");
  const [limpieza, setLimpieza] = useState<string>("8");
  const [monedaTemporal, setMonedaTemporal] = useState<"USD" | "ARS">("USD");

  // Tradicional
  const [alquilerMensual, setAlquilerMensual] = useState<string>("500");
  const [monedaAlquiler, setMonedaAlquiler] = useState<"USD" | "ARS">("USD");
  const [ajusteAnual, setAjusteAnual] = useState<string>("60");
  const [diasVacancia, setDiasVacancia] = useState<string>("15");

  const r = useMemo(() => {
    const precio = parseFloat(precioUSD) || 0;
    const cambio = parseFloat(tc) || 1;
    const precioARS = precio * cambio;

    const gastosFijosARS = (parseFloat(expensas) || 0) + (parseFloat(impuestos) || 0) +
      (parseFloat(mantenimiento) || 0) + (parseFloat(seguro) || 0);

    // ── TEMPORAL ──
    const noche = parseFloat(tarifaNoche) || 0;
    const nocheARS = monedaTemporal === "USD" ? noche * cambio : noche;
    const nocheUSD = monedaTemporal === "USD" ? noche : noche / cambio;
    const ocupPct = (parseFloat(ocupacion) || 0) / 100;
    const plat = (parseFloat(platformFee) || 0) / 100;
    const huespedPct = (parseFloat(gastosHuesped) || 0) / 100;
    const limpiezaPct = (parseFloat(limpieza) || 0) / 100;

    const nochesOcupadasMes = 30 * ocupPct;
    const ingresoBrutoTemporalARS = nocheARS * nochesOcupadasMes;
    const ingresoBrutoTemporalUSD = nocheUSD * nochesOcupadasMes;
    const comisionPlat = ingresoBrutoTemporalARS * plat;
    const gastosHuespedMes = ingresoBrutoTemporalARS * huespedPct;
    const gastoLimpiezaMes = ingresoBrutoTemporalARS * limpiezaPct;
    const ingresoNetoTemporalARS = ingresoBrutoTemporalARS - comisionPlat - gastosHuespedMes - gastoLimpiezaMes;

    const temporalResult: ScenarioResult = {
      ingresoMensual: ingresoNetoTemporalARS,
      gastosMensual: gastosFijosARS,
      flujoNeto: ingresoNetoTemporalARS - gastosFijosARS,
      rentAnual: precioARS > 0 ? ((ingresoNetoTemporalARS - gastosFijosARS) * 12 / precioARS) * 100 : 0,
      paybackAnios: (ingresoNetoTemporalARS - gastosFijosARS) > 0 ? precioARS / ((ingresoNetoTemporalARS - gastosFijosARS) * 12) : Infinity,
      ingresoAnual: (ingresoNetoTemporalARS - gastosFijosARS) * 12,
    };

    // ── TRADICIONAL ──
    const alq = parseFloat(alquilerMensual) || 0;
    const alqARS = monedaAlquiler === "USD" ? alq * cambio : alq;
    const vacPct = 1 - (parseFloat(diasVacancia) || 0) / 30;
    const ingresoTradARS = alqARS * vacPct;

    const tradicionalResult: ScenarioResult = {
      ingresoMensual: ingresoTradARS,
      gastosMensual: gastosFijosARS,
      flujoNeto: ingresoTradARS - gastosFijosARS,
      rentAnual: precioARS > 0 ? ((ingresoTradARS - gastosFijosARS) * 12 / precioARS) * 100 : 0,
      paybackAnios: (ingresoTradARS - gastosFijosARS) > 0 ? precioARS / ((ingresoTradARS - gastosFijosARS) * 12) : Infinity,
      ingresoAnual: (ingresoTradARS - gastosFijosARS) * 12,
    };

    const ventajaTemporal = temporalResult.flujoNeto - tradicionalResult.flujoNeto;
    const rentUSD_temp = precio > 0 ? (temporalResult.ingresoAnual / cambio / precio) * 100 : 0;
    const rentUSD_trad = precio > 0 ? (tradicionalResult.ingresoAnual / cambio / precio) * 100 : 0;

    return {
      temporal: temporalResult,
      tradicional: tradicionalResult,
      ventajaTemporal,
      ingresoBrutoTemporalARS,
      ingresoBrutoTemporalUSD,
      nochesOcupadasMes,
      comisionPlat,
      gastosHuespedMes,
      gastoLimpiezaMes,
      gastosFijosARS,
      precio,
      precioARS,
      cambio,
      rentUSD_temp,
      rentUSD_trad,
      ajusteAnualPct: parseFloat(ajusteAnual) || 0,
    };
  }, [precioUSD, tc, expensas, impuestos, mantenimiento, seguro, tarifaNoche, ocupacion,
    platformFee, gastosHuesped, limpieza, monedaTemporal, alquilerMensual, monedaAlquiler,
    ajusteAnual, diasVacancia]);

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, padding: "7px 10px", width: "100%",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4, display: "block",
  };
  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "18px 20px",
  };

  const winnerColor = r.temporal.rentAnual >= r.tradicional.rentAnual ? "#f59e0b" : "#3b82f6";
  const maxFlujo = Math.max(Math.abs(r.temporal.flujoNeto), Math.abs(r.tradicional.flujoNeto), 1);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Alquiler Temporal vs Tradicional</h1>
        <span style={{ background: "#f59e0b", color: "#000", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>INVERSIÓN</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {/* Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Propiedad */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Propiedad</div>
            {[
              { label: "Precio (USD)", val: precioUSD, set: setPrecioUSD, type: "number" },
              { label: "Tipo cambio ARS/USD", val: tc, set: setTc, type: "number" },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type={f.type} value={f.val} onChange={e => f.set(e.target.value)} />
              </div>
            ))}
          </div>

          {/* Gastos fijos */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Gastos fijos mensuales (ARS)</div>
            {[
              { label: "Expensas", val: expensas, set: setExpensas },
              { label: "ABL / Municipales", val: impuestos, set: setImpuestos },
              { label: "Mantenimiento", val: mantenimiento, set: setMantenimiento },
              { label: "Seguro", val: seguro, set: setSeguro },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="number" value={f.val} onChange={e => f.set(e.target.value)} />
              </div>
            ))}
            <div style={{ marginTop: 8, padding: "8px 10px", background: "#111", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Total gastos fijos</span>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "#cc0000" }}>{fmtARS(r.gastosFijosARS)}/mes</span>
            </div>
          </div>

          {/* Temporal */}
          <div style={{ ...cardStyle, borderColor: "rgba(245,158,11,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f59e0b" }}>Alquiler Temporal</div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Tarifa por noche</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} type="number" value={tarifaNoche} onChange={e => setTarifaNoche(e.target.value)} />
                <select style={{ ...inputStyle, width: 70 }} value={monedaTemporal} onChange={e => setMonedaTemporal(e.target.value as "USD" | "ARS")}>
                  <option value="USD">USD</option><option value="ARS">ARS</option>
                </select>
              </div>
            </div>
            {[
              { label: "Ocupación esperada (%)", val: ocupacion, set: setOcupacion },
              { label: "Comisión plataforma (%)", val: platformFee, set: setPlatformFee },
              { label: "Gastos por huésped (%)", val: gastosHuesped, set: setGastosHuesped },
              { label: "Limpieza / rotación (%)", val: limpieza, set: setLimpieza },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="number" step="1" value={f.val} onChange={e => f.set(e.target.value)} />
              </div>
            ))}
          </div>

          {/* Tradicional */}
          <div style={{ ...cardStyle, borderColor: "rgba(59,130,246,0.2)" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 14 }}>Alquiler Tradicional</div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Alquiler mensual</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inputStyle, flex: 1 }} type="number" value={alquilerMensual} onChange={e => setAlquilerMensual(e.target.value)} />
                <select style={{ ...inputStyle, width: 70 }} value={monedaAlquiler} onChange={e => setMonedaAlquiler(e.target.value as "USD" | "ARS")}>
                  <option value="USD">USD</option><option value="ARS">ARS</option>
                </select>
              </div>
            </div>
            {[
              { label: "Ajuste anual estimado (%)", val: ajusteAnual, set: setAjusteAnual },
              { label: "Días vacancia / mes", val: diasVacancia, set: setDiasVacancia },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{f.label}</label>
                <input style={inputStyle} type="number" value={f.val} onChange={e => f.set(e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Resultados */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPI comparativo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Temporal */}
            <div style={{ ...cardStyle, borderColor: "rgba(245,158,11,0.25)", position: "relative" }}>
              {r.temporal.rentAnual >= r.tradicional.rentAnual && (
                <div style={{ position: "absolute", top: 10, right: 12, background: "#f59e0b", color: "#000", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 7px", borderRadius: 4 }}>MEJOR OPCIÓN</div>
              )}
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f59e0b", marginBottom: 16 }}>🏖 Temporal</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Flujo neto / mes", val: fmtARS(r.temporal.flujoNeto), color: r.temporal.flujoNeto >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "Rentabilidad ARS", val: fmtPct(r.temporal.rentAnual), color: "#f59e0b" },
                  { label: "Rentabilidad USD", val: fmtPct(r.rentUSD_temp), color: "#f59e0b" },
                  { label: "Payback", val: isFinite(r.temporal.paybackAnios) ? `${fmt(r.temporal.paybackAnios, 1)} años` : "∞", color: "rgba(255,255,255,0.6)" },
                ].map((k, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: 6, padding: "10px 12px" }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: k.color }}>{k.val}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Montserrat,sans-serif" }}>{k.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Desglose mensual</div>
                {[
                  { label: "Ingreso bruto", val: fmtARS(r.ingresoBrutoTemporalARS), color: "#f59e0b" },
                  { label: `Comisión plataforma (${platformFee}%)`, val: `-${fmtARS(r.comisionPlat)}`, color: "#ef4444" },
                  { label: "Gastos huésped + limpieza", val: `-${fmtARS(r.gastosHuespedMes + r.gastoLimpiezaMes)}`, color: "#ef4444" },
                  { label: "Ingreso neto operativo", val: fmtARS(r.temporal.ingresoMensual), color: "#22c55e" },
                  { label: "Gastos fijos", val: `-${fmtARS(r.gastosFijosARS)}`, color: "#cc0000" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{l.label}</span>
                    <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: l.color }}>{l.val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>FLUJO NETO</span>
                  <span style={{ fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: r.temporal.flujoNeto >= 0 ? "#22c55e" : "#ef4444" }}>{fmtARS(r.temporal.flujoNeto)}</span>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                {fmt(r.nochesOcupadasMes, 1)} noches/mes · {fmtUSD(r.ingresoBrutoTemporalUSD)} bruto
              </div>
            </div>

            {/* Tradicional */}
            <div style={{ ...cardStyle, borderColor: "rgba(59,130,246,0.25)", position: "relative" }}>
              {r.tradicional.rentAnual > r.temporal.rentAnual && (
                <div style={{ position: "absolute", top: 10, right: 12, background: "#3b82f6", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 7px", borderRadius: 4 }}>MEJOR OPCIÓN</div>
              )}
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 16 }}>🏠 Tradicional</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Flujo neto / mes", val: fmtARS(r.tradicional.flujoNeto), color: r.tradicional.flujoNeto >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "Rentabilidad ARS", val: fmtPct(r.tradicional.rentAnual), color: "#3b82f6" },
                  { label: "Rentabilidad USD", val: fmtPct(r.rentUSD_trad), color: "#3b82f6" },
                  { label: "Payback", val: isFinite(r.tradicional.paybackAnios) ? `${fmt(r.tradicional.paybackAnios, 1)} años` : "∞", color: "rgba(255,255,255,0.6)" },
                ].map((k, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: 6, padding: "10px 12px" }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: k.color }}>{k.val}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Montserrat,sans-serif" }}>{k.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Desglose mensual</div>
                {[
                  { label: "Alquiler bruto", val: fmtARS(r.tradicional.ingresoMensual + r.gastosFijosARS), color: "#3b82f6" },
                  { label: "Gastos fijos", val: `-${fmtARS(r.gastosFijosARS)}`, color: "#cc0000" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{l.label}</span>
                    <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: l.color }}>{l.val}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>FLUJO NETO</span>
                  <span style={{ fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: r.tradicional.flujoNeto >= 0 ? "#22c55e" : "#ef4444" }}>{fmtARS(r.tradicional.flujoNeto)}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Ajuste anual estimado: {ajusteAnual}% (ICL/acuerdo)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparación visual */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Flujo neto mensual comparativo</div>
            {[
              { label: "🏖 Temporal", val: r.temporal.flujoNeto, color: "#f59e0b" },
              { label: "🏠 Tradicional", val: r.tradicional.flujoNeto, color: "#3b82f6" },
            ].map(b => (
              <div key={b.label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{b.label}</span>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: b.val >= 0 ? b.color : "#ef4444" }}>{fmtARS(b.val)}</span>
                </div>
                <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(0, (b.val / maxFlujo) * 100)}%`, background: b.val >= 0 ? b.color : "#ef4444", borderRadius: 5 }} />
                </div>
              </div>
            ))}
            {r.ventajaTemporal !== 0 && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#111", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {r.ventajaTemporal > 0 ? "El temporal genera más por mes:" : "El tradicional genera más por mes:"}
                </span>
                <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 800, color: winnerColor }}>
                  {fmtARS(Math.abs(r.ventajaTemporal))}
                </span>
              </div>
            )}
          </div>

          {/* Proyección 5 años */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Proyección acumulada 5 años</div>
            <svg width="100%" height={100} style={{ overflow: "visible" }}>
              {[1, 2, 3, 4, 5].map((año, i) => {
                const wPct = 100 / 6;
                const tempAcum = r.temporal.flujoNeto * 12 * año;
                const tradAcum = r.tradicional.flujoNeto * 12 * año;
                const maxAcum = Math.max(Math.abs(tempAcum), Math.abs(tradAcum), 1);
                const tempH = Math.abs(tempAcum / maxAcum) * 80;
                const tradH = Math.abs(tradAcum / maxAcum) * 80;
                const x = i * wPct + 2;
                return (
                  <g key={año}>
                    <rect x={`${x}%`} y={100 - tempH} width={`${wPct * 0.45}%`} height={tempH} rx={2} fill={tempAcum >= 0 ? "#f59e0b" : "#ef4444"} opacity={0.9} />
                    <rect x={`${x + wPct * 0.48}%`} y={100 - tradH} width={`${wPct * 0.45}%`} height={tradH} rx={2} fill={tradAcum >= 0 ? "#3b82f6" : "#ef4444"} opacity={0.9} />
                    <text x={`${x + wPct * 0.45}%`} y={98} fontSize={8} fill="rgba(255,255,255,0.3)" textAnchor="middle">{año}a</text>
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, background: "#f59e0b", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Temporal · {fmtARS(r.temporal.flujoNeto * 12 * 5)} en 5 años</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, background: "#3b82f6", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Tradicional · {fmtARS(r.tradicional.flujoNeto * 12 * 5)} en 5 años</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div style={{ ...cardStyle, borderColor: "rgba(255,165,0,0.15)" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f59e0b", marginBottom: 10 }}>Consideraciones clave</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { icon: "⏱", text: "Temporal requiere gestión activa: check-in, limpieza, comunicación con huéspedes" },
                { icon: "📋", text: "Verificar habilitación municipal para alquiler temporal en la zona" },
                { icon: "💱", text: "En dólares, el temporal puede ser más rentable si el TC se mueve" },
                { icon: "🔧", text: "Considerar mayor desgaste y amortización de mobiliario en temporal" },
              ].map((t, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 6, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
