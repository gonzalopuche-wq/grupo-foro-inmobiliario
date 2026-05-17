"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Tasas de capitalización por tipo de propiedad ─────────────────────────────

const CAP_RATES: Record<string, { min: number; max: number; tipica: number; descripcion: string }> = {
  "Departamento urbano": { min: 3.5, max: 6.5, tipica: 5.0, descripcion: "CABA y GBA central" },
  "Casa en barrio residencial": { min: 3.0, max: 5.5, tipica: 4.5, descripcion: "Zonas residenciales consolidadas" },
  "Local comercial A": { min: 5.0, max: 9.0, tipica: 7.0, descripcion: "Calle principal, baja vacancia" },
  "Local comercial B": { min: 6.0, max: 12.0, tipica: 8.5, descripcion: "Zona B, mayor riesgo vacancia" },
  "Oficina premium": { min: 6.0, max: 10.0, tipica: 7.5, descripcion: "Edificio de categoría, CBD" },
  "Galpón / logística": { min: 7.0, max: 12.0, tipica: 9.0, descripcion: "Industrial, zona estratégica" },
  "Complejo de departamentos": { min: 5.0, max: 8.0, tipica: 6.5, descripcion: "+4 unidades, economías de escala" },
  "Inmueble hotelero": { min: 7.0, max: 15.0, tipica: 10.0, descripcion: "Mayor volatilidad, gestión activa" },
};

// ── Componente ────────────────────────────────────────────────────────────────

export default function ValuacionIngresos() {
  const [tipoInmueble, setTipoInmueble] = useState("Departamento urbano");
  const [metodo, setMetodo] = useState<"directa"|"flujo">("directa");

  // Ingreso bruto anual
  const [alquilerMensual, setAlquilerMensual] = useState(600);
  const [unidades, setUnidades] = useState(1);
  const [vacanciaAnual, setVacanciaAnual] = useState(5); // %
  const [otrosIngresos, setOtrosIngresos] = useState(0); // USD/año (estacionamiento, cochera, etc.)

  // Gastos operativos
  const [impuestosAnuales, setImpuestosAnuales] = useState(300);
  const [expensas, setExpensas] = useState(80); // USD/mes propietario
  const [mantenimientoAnual, setMantenimientoAnual] = useState(400);
  const [seguros, setSeguros] = useState(200);
  const [administracion, setAdministracion] = useState(5); // % de IGN

  // Tasa de capitalización
  const [capRateManual, setCapRateManual] = useState(5.0);
  const [usarCapRateManual, setUsarCapRateManual] = useState(false);

  // Flujo de caja descontado (DCF)
  const [tir, setTir] = useState(8.0); // tasa de descuento
  const [crecimientoRenta, setCrecimientoRenta] = useState(3.0); // % anual real
  const [horizonte, setHorizonte] = useState(10);
  const [valorResidualMultiplo, setValorResidualMultiplo] = useState(18); // múltiplo de NOI año N

  const capInfo = CAP_RATES[tipoInmueble];

  const resultado = useMemo(() => {
    // Ingreso Bruto Potencial (PGI)
    const pgi = alquilerMensual * 12 * unidades + otrosIngresos;

    // Vacancia y crédito incobrable
    const vacanciaUSD = pgi * vacanciaAnual / 100;
    const ingresoEfectivo = pgi - vacanciaUSD; // EGI

    // Gastos operativos totales (OpEx)
    const adminUSD = ingresoEfectivo * administracion / 100;
    const opEx = impuestosAnuales + expensas * 12 + mantenimientoAnual + seguros + adminUSD;

    // Ingreso Operativo Neto
    const noi = ingresoEfectivo - opEx;
    const margenNOI = ingresoEfectivo > 0 ? (noi / ingresoEfectivo) * 100 : 0;

    // Capitalización directa
    const capRate = usarCapRateManual ? capRateManual : capInfo.tipica;
    const valorCapDirecta = capRate > 0 ? (noi / (capRate / 100)) : 0;

    // DCF
    const tasaDescuento = tir / 100;
    const g = crecimientoRenta / 100;
    let vpFlujos = 0;
    let noiAno = noi;
    for (let t = 1; t <= horizonte; t++) {
      noiAno *= (1 + g);
      vpFlujos += noiAno / Math.pow(1 + tasaDescuento, t);
    }
    const valorResidual = noiAno * valorResidualMultiplo / Math.pow(1 + tasaDescuento, horizonte);
    const valorDCF = vpFlujos + valorResidual;

    // Sensibilidad cap rate
    const sensitividadCap = [capInfo.min, (capInfo.min + capInfo.tipica) / 2, capInfo.tipica, (capInfo.tipica + capInfo.max) / 2, capInfo.max].map(cr => ({
      capRate: cr,
      valor: noi / (cr / 100),
    }));

    return { pgi, vacanciaUSD, ingresoEfectivo, adminUSD, opEx, noi, margenNOI, capRate, valorCapDirecta, vpFlujos, valorResidual, valorDCF, sensitividadCap };
  }, [tipoInmueble, alquilerMensual, unidades, vacanciaAnual, otrosIngresos, impuestosAnuales, expensas, mantenimientoAnual, seguros, administracion, capRateManual, usarCapRateManual, tir, crecimientoRenta, horizonte, valorResidualMultiplo, capInfo]);

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Valuación por Ingresos</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:750px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:10px 0}th{background:#f0f0f0;padding:6px;font-size:10px;text-align:left}td{padding:6px;border-bottom:1px solid #eee;font-size:11px}.total{font-weight:bold;background:#f9f9f9}.valor{font-size:18px;font-weight:bold;color:#cc0000}</style>
    </head><body>
    <h1>Valuación por Ingresos — ${tipoInmueble}</h1>
    <table>
      <tr><th>Concepto</th><th>Anual USD</th></tr>
      <tr><td>Ingreso bruto potencial (PGI)</td><td>USD ${fmt(resultado.pgi)}</td></tr>
      <tr><td>Vacancia (${vacanciaAnual}%)</td><td>−USD ${fmt(resultado.vacanciaUSD)}</td></tr>
      <tr><td>Ingreso efectivo (EGI)</td><td>USD ${fmt(resultado.ingresoEfectivo)}</td></tr>
      <tr><td>Gastos operativos (OpEx)</td><td>−USD ${fmt(resultado.opEx)}</td></tr>
      <tr class="total"><td>NOI</td><td>USD ${fmt(resultado.noi)}</td></tr>
    </table>
    <h3>Valuación</h3>
    <p><b>Capitalización directa (cap rate ${resultado.capRate}%):</b> <span class="valor">USD ${fmt(resultado.valorCapDirecta)}</span></p>
    <p><b>DCF (${horizonte} años, TIR ${tir}%):</b> <span class="valor">USD ${fmt(resultado.valorDCF)}</span></p>
    <h3>Sensibilidad Cap Rate</h3>
    <table><tr><th>Cap Rate</th><th>Valor estimado</th></tr>
    ${resultado.sensitividadCap.map(s => `<tr><td>${s.capRate.toFixed(1)}%</td><td>USD ${fmt(s.valor)}</td></tr>`).join("")}
    </table>
    <p style="font-size:10px;color:#999;margin-top:20px">Income Approach. Valores estimados. Verificar con tasador matriculado.</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "7px 10px", fontFamily: "'Inter',sans-serif", fontSize: 12, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 };
  const sectionStyle: React.CSSProperties = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 18, marginBottom: 12 };

  const maxValSens = Math.max(...resultado.sensitividadCap.map(s => s.valor));

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← Calculadoras</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Valuación por Ingresos — Income Approach
        </h1>
      </div>

      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "310px 1fr", gap: 20 }}>
        {/* Inputs */}
        <div>
          <div style={sectionStyle}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Tipo de Inmueble</p>
            <select value={tipoInmueble} onChange={e => setTipoInmueble(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
              {Object.keys(CAP_RATES).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)", fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
              Cap rate típico: <strong style={{ color: "#cc0000" }}>{capInfo.tipica}%</strong> (rango {capInfo.min}–{capInfo.max}%)<br />
              {capInfo.descripcion}
            </div>
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Ingresos</p>
            {[
              { label: "Alquiler/mes por unidad (USD)", val: alquilerMensual, set: setAlquilerMensual },
              { label: "Unidades / locales", val: unidades, set: setUnidades },
              { label: "Vacancia anual (%)", val: vacanciaAnual, set: setVacanciaAnual, step: 0.5 },
              { label: "Otros ingresos anuales (USD)", val: otrosIngresos, set: setOtrosIngresos },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{r.label}</label>
                <input type="number" step={r.step ?? 1} value={r.val} onChange={e => r.set(+e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Gastos Operativos</p>
            {[
              { label: "Impuestos anuales (USD)", val: impuestosAnuales, set: setImpuestosAnuales },
              { label: "Expensas propietario/mes (USD)", val: expensas, set: setExpensas },
              { label: "Mantenimiento anual (USD)", val: mantenimientoAnual, set: setMantenimientoAnual },
              { label: "Seguros anuales (USD)", val: seguros, set: setSeguros },
              { label: "Administración (% EGI)", val: administracion, set: setAdministracion, step: 0.5 },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 8 }}>
                <label style={labelStyle}>{r.label}</label>
                <input type="number" step={r.step ?? 1} value={r.val} onChange={e => r.set(+e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Tasa Cap Rate</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input type="checkbox" checked={usarCapRateManual} onChange={e => setUsarCapRateManual(e.target.checked)} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Usar cap rate manual</span>
            </div>
            {usarCapRateManual && (
              <div>
                <label style={labelStyle}>Cap Rate manual (%)</label>
                <input type="number" step={0.25} value={capRateManual} onChange={e => setCapRateManual(+e.target.value)} style={inputStyle} />
              </div>
            )}
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Parámetros DCF</p>
            {[
              { label: "Tasa de descuento (TIR objetivo %)", val: tir, set: setTir, step: 0.5 },
              { label: "Crecimiento renta real (%/año)", val: crecimientoRenta, set: setCrecimientoRenta, step: 0.5 },
              { label: "Horizonte análisis (años)", val: horizonte, set: setHorizonte },
              { label: "Múltiplo valor residual (× NOI)", val: valorResidualMultiplo, set: setValorResidualMultiplo },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 8 }}>
                <label style={labelStyle}>{r.label}</label>
                <input type="number" step={r.step ?? 1} value={r.val} onChange={e => r.set(+e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>

          <button onClick={exportarPDF} style={{ width: "100%", padding: "9px", borderRadius: 8, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
            EXPORTAR PDF
          </button>
        </div>

        {/* Resultados */}
        <div>
          {/* NOI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Ingreso Bruto Potencial (PGI)", val: `USD ${fmt(resultado.pgi)}`, color: "#22c55e", sub: `${unidades} unid × $${alquilerMensual}/mes × 12` },
              { label: "Ingreso Efectivo (EGI)", val: `USD ${fmt(resultado.ingresoEfectivo)}`, color: "#3b82f6", sub: `Vacancia: −USD ${fmt(resultado.vacanciaUSD)}` },
              { label: "NOI (Ingreso Operativo Neto)", val: `USD ${fmt(resultado.noi)}`, color: "#cc0000", sub: `Margen: ${resultado.margenNOI.toFixed(1)}%` },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px" }}>
                <p style={{ margin: "0 0 6px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kpi.label}</p>
                <p style={{ margin: 0, fontSize: 24, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Valuaciones */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "rgba(204,0,0,0.04)", border: "1px solid rgba(204,0,0,0.15)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 4px 0", fontSize: 10, color: "#cc0000", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Capitalización Directa</p>
              <p style={{ margin: 0, fontSize: 34, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#cc0000" }}>USD {fmt(resultado.valorCapDirecta)}</p>
              <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                NOI / cap rate = USD {fmt(resultado.noi)} ÷ {resultado.capRate}%
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Método simple · Sin flujo temporal</p>
            </div>
            <div style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 4px 0", fontSize: 10, color: "#3b82f6", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>DCF — Flujo de Caja Descontado</p>
              <p style={{ margin: 0, fontSize: 34, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#3b82f6" }}>USD {fmt(resultado.valorDCF)}</p>
              <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                VP flujos + VP residual = USD {fmt(resultado.vpFlujos)} + USD {fmt(resultado.valorResidual)}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>TIR {tir}% · {horizonte} años · Crec. {crecimientoRenta}%/año</p>
            </div>
          </div>

          {/* Cuenta detallada */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Estado de Ingresos y Gastos</p>
            {[
              { label: "Ingreso Bruto Potencial (PGI)", val: resultado.pgi, color: "#22c55e", signo: "+" },
              { label: `Pérd. vacancia/incobrable (${vacanciaAnual}%)`, val: resultado.vacanciaUSD, color: "#cc0000", signo: "−" },
              { label: "= Ingreso Efectivo Bruto (EGI)", val: resultado.ingresoEfectivo, color: "#3b82f6", signo: "", bold: true },
              { label: `Impuestos (anual)`, val: impuestosAnuales, color: "rgba(255,255,255,0.4)", signo: "−" },
              { label: `Expensas propietario (${expensas}/mes)`, val: expensas * 12, color: "rgba(255,255,255,0.4)", signo: "−" },
              { label: "Mantenimiento", val: mantenimientoAnual, color: "rgba(255,255,255,0.4)", signo: "−" },
              { label: "Seguros", val: seguros, color: "rgba(255,255,255,0.4)", signo: "−" },
              { label: `Administración (${administracion}% EGI)`, val: resultado.adminUSD, color: "rgba(255,255,255,0.4)", signo: "−" },
              { label: "= NOI (Ingreso Operativo Neto)", val: resultado.noi, color: "#cc0000", signo: "", bold: true },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: row.bold ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: row.color, fontFamily: row.bold ? "'Montserrat',sans-serif" : undefined }}>
                  {row.signo}{row.signo ? " " : ""}USD {fmt(row.val)}
                </span>
              </div>
            ))}
          </div>

          {/* Sensibilidad cap rate */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Sensibilidad al Cap Rate — {tipoInmueble}
            </p>
            {resultado.sensitividadCap.map((s, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, width: 60, color: s.capRate === resultado.capRate ? "#cc0000" : "rgba(255,255,255,0.5)", fontWeight: s.capRate === resultado.capRate ? 800 : 400 }}>
                  {s.capRate.toFixed(1)}%
                </span>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(s.valor / maxValSens) * 100}%`, background: s.capRate === resultado.capRate ? "#cc0000" : "rgba(255,255,255,0.2)", borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: s.capRate === resultado.capRate ? 800 : 400, color: s.capRate === resultado.capRate ? "#cc0000" : "rgba(255,255,255,0.6)", width: 110, textAlign: "right" }}>
                  USD {fmt(s.valor)}
                </span>
                {idx === 0 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", width: 30 }}>min</span>}
                {idx === resultado.sensitividadCap.length - 1 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", width: 30 }}>max</span>}
                {idx > 0 && idx < resultado.sensitividadCap.length - 1 && <span style={{ width: 30 }} />}
              </div>
            ))}
            <p style={{ margin: "10px 0 0 0", fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
              Un cap rate mayor implica menor valor (más riesgo percibido o menor liquidez). El rango {capInfo.min}–{capInfo.max}% es típico para {tipoInmueble.toLowerCase()} en Argentina.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
