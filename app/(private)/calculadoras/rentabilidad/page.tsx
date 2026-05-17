"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface Resultado {
  rentBruta: number;
  rentNeta: number;
  flujoAnualNeto: number;
  recuperoPeriodo: number; // años
  valorFuturo: number;     // a N años
  gananciaCapital: number;
  retornoTotal: number;    // renta + capital sobre inversión inicial
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtMon = (n: number, mon: string) => (mon === "USD" ? fmtUSD(n) : fmtARS(n));

const fmtPct = (n: number, dec = 2) => `${n.toFixed(dec)}%`;

const num = (s: string) => parseFloat(s.replace(/[.,]/g, m => m === "," ? "." : "")) || 0;

// ── Component ────────────────────────────────────────────────────────────────

export default function RentabilidadPage() {
  // ── Compra ──
  const [moneda, setMoneda] = useState<"USD" | "ARS">("USD");
  const [precioPropStr, setPrecioPropStr] = useState("200000");
  const [gastosCompraStr, setGastosCompraStr] = useState("7");  // % del precio
  const [capitalPropioStr, setCapitalPropioStr] = useState("100"); // % de financiación propia

  // ── Ingresos ──
  const [alquilerBrutoStr, setAlquilerBrutoStr] = useState("1200"); // mensual
  const [ocupacionStr, setOcupacionStr] = useState("92");  // % anual

  // ── Gastos mensuales ──
  const [expensasStr, setExpensasStr] = useState("0");
  const [impuestosStr, setImpuestosStr] = useState("0");
  const [mantenimientoStr, setMantenimientoStr] = useState("0");
  const [administracionStr, setAdministracionStr] = useState("5"); // % del alquiler
  const [seguroStr, setSeguroStr] = useState("0");

  // ── Horizonte ──
  const [anosStr, setAnosStr] = useState("10");
  const [aprecAnualStr, setAprecAnualStr] = useState("3"); // % anual en USD real

  // ── PDF ──
  const exportarPDF = useCallback(() => {
    const win = window.open("", "_blank");
    if (!win) return;
    const r = resultados;
    if (!r) return;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Rentabilidad — Grupo Foro Inmobiliario</title>
<style>
  body{font-family:'Inter',Arial,sans-serif;color:#111;background:#fff;padding:32px;max-width:680px;margin:0 auto}
  h1{font-family:'Montserrat',Arial,sans-serif;font-size:20px;font-weight:900;color:#cc0000;margin-bottom:4px}
  h2{font-family:'Montserrat',Arial,sans-serif;font-size:13px;font-weight:800;color:#333;text-transform:uppercase;letter-spacing:.1em;margin:24px 0 8px;border-bottom:1px solid #eee;padding-bottom:6px}
  .logo{font-size:10px;color:#999;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th{background:#f5f5f5;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666}
  td{padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px}
  .val{text-align:right;font-weight:600}
  .big{font-size:28px;font-weight:900;color:#cc0000}
  .green{color:#16a34a}
  .row{display:flex;gap:24px;flex-wrap:wrap;margin:16px 0}
  .kpi{flex:1;min-width:120px;border:1px solid #eee;border-radius:8px;padding:14px}
  .kpi-l{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:4px}
  .kpi-v{font-size:22px;font-weight:900;color:#cc0000}
  footer{margin-top:32px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}
</style></head><body>
<h1>Calculadora de Rentabilidad Inmobiliaria</h1>
<p class="logo">Grupo Foro Inmobiliario® · ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</p>

<h2>Parámetros de la inversión</h2>
<table>
<thead><tr><th>Concepto</th><th class="val">Valor</th></tr></thead>
<tbody>
<tr><td>Precio de compra</td><td class="val">${fmtMon(num(precioPropStr), moneda)}</td></tr>
<tr><td>Gastos de compra (${gastosCompraStr}%)</td><td class="val">${fmtMon(num(precioPropStr) * num(gastosCompraStr) / 100, moneda)}</td></tr>
<tr><td>Inversión total</td><td class="val">${fmtMon(num(precioPropStr) * (1 + num(gastosCompraStr) / 100), moneda)}</td></tr>
<tr><td>Capital propio utilizado (${capitalPropioStr}%)</td><td class="val">${fmtMon(num(precioPropStr) * num(capitalPropioStr) / 100, moneda)}</td></tr>
<tr><td>Alquiler bruto mensual</td><td class="val">${fmtMon(num(alquilerBrutoStr), moneda)}</td></tr>
<tr><td>Ocupación estimada</td><td class="val">${ocupacionStr}%</td></tr>
<tr><td>Gastos mensuales (exp + imp + mant + adm + seg)</td><td class="val">${fmtMon(
  (num(expensasStr) + num(impuestosStr) + num(mantenimientoStr) + num(alquilerBrutoStr) * num(administracionStr) / 100 + num(seguroStr)),
  moneda
)}</td></tr>
<tr><td>Apreciación anual estimada</td><td class="val">${aprecAnualStr}%</td></tr>
<tr><td>Horizonte de inversión</td><td class="val">${anosStr} años</td></tr>
</tbody>
</table>

<h2>Resultados</h2>
<div class="row">
  <div class="kpi"><div class="kpi-l">Rent. Bruta</div><div class="kpi-v">${fmtPct(r.rentBruta)}</div></div>
  <div class="kpi"><div class="kpi-l">Rent. Neta</div><div class="kpi-v">${fmtPct(r.rentNeta)}</div></div>
  <div class="kpi"><div class="kpi-l">Recupero</div><div class="kpi-v">${r.recuperoPeriodo > 0 ? r.recuperoPeriodo.toFixed(1) + " años" : "N/A"}</div></div>
  <div class="kpi"><div class="kpi-l">Ret. Total (${anosStr}a)</div><div class="kpi-v class="green"">${fmtPct(r.retornoTotal, 1)}</div></div>
</div>

<table>
<thead><tr><th>Concepto</th><th class="val">Monto</th></tr></thead>
<tbody>
<tr><td>Flujo anual neto</td><td class="val">${fmtMon(r.flujoAnualNeto, moneda)}</td></tr>
<tr><td>Valor futuro estimado (${anosStr} años)</td><td class="val">${fmtMon(r.valorFuturo, moneda)}</td></tr>
<tr><td>Ganancia de capital</td><td class="val">${fmtMon(r.gananciaCapital, moneda)}</td></tr>
<tr><td>Retorno total sobre capital propio</td><td class="val"><strong>${fmtPct(r.retornoTotal, 1)}</strong></td></tr>
</tbody>
</table>

<footer>Calculado con GFI® Grupo Foro Inmobiliario · Los valores son estimativos y no constituyen asesoramiento financiero.</footer>
</body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }, [precioPropStr, gastosCompraStr, capitalPropioStr, alquilerBrutoStr, ocupacionStr, expensasStr, impuestosStr, mantenimientoStr, administracionStr, seguroStr, anosStr, aprecAnualStr, moneda]);

  // ── Cálculos ─────────────────────────────────────────────────────────────

  const resultados: Resultado | null = useMemo(() => {
    const precio = num(precioPropStr);
    if (precio <= 0) return null;

    const gastosCompra = precio * num(gastosCompraStr) / 100;
    const inversionTotal = precio + gastosCompra;
    const capitalPropio = precio * num(capitalPropioStr) / 100 + gastosCompra;

    const alqBruto = num(alquilerBrutoStr);
    const ocupacion = num(ocupacionStr) / 100;
    const ingresosAnuales = alqBruto * 12 * ocupacion;

    const expensas = num(expensasStr);
    const impuestos = num(impuestosStr);
    const mantenimiento = num(mantenimientoStr);
    const administracion = alqBruto * num(administracionStr) / 100;
    const seguro = num(seguroStr);
    const gastosMensuales = expensas + impuestos + mantenimiento + administracion + seguro;
    const gastosAnuales = gastosMensuales * 12;

    const flujoAnualNeto = ingresosAnuales - gastosAnuales;
    const rentBruta = inversionTotal > 0 ? (ingresosAnuales / inversionTotal) * 100 : 0;
    const rentNeta = inversionTotal > 0 ? (flujoAnualNeto / inversionTotal) * 100 : 0;
    const recuperoPeriodo = flujoAnualNeto > 0 ? capitalPropio / flujoAnualNeto : 0;

    const anos = num(anosStr);
    const aprecAnual = num(aprecAnualStr) / 100;
    const valorFuturo = precio * Math.pow(1 + aprecAnual, anos);
    const gananciaCapital = valorFuturo - precio;

    const totalRentaAcumulada = flujoAnualNeto * anos;
    const retornoTotal = capitalPropio > 0 ? ((totalRentaAcumulada + gananciaCapital) / capitalPropio) * 100 : 0;

    return { rentBruta, rentNeta, flujoAnualNeto, recuperoPeriodo, valorFuturo, gananciaCapital, retornoTotal };
  }, [precioPropStr, gastosCompraStr, capitalPropioStr, alquilerBrutoStr, ocupacionStr, expensasStr, impuestosStr, mantenimientoStr, administracionStr, seguroStr, anosStr, aprecAnualStr]);

  // ── Proyección año a año ──────────────────────────────────────────────────

  const proyeccion = useMemo(() => {
    if (!resultados) return [];
    const precio = num(precioPropStr);
    const gastosCompra = precio * num(gastosCompraStr) / 100;
    const capitalPropio = precio * num(capitalPropioStr) / 100 + gastosCompra;
    const anos = Math.min(Math.round(num(anosStr)), 30);
    const aprecAnual = num(aprecAnualStr) / 100;
    const flujoNeto = resultados.flujoAnualNeto;

    return Array.from({ length: anos }, (_, i) => {
      const ano = i + 1;
      const valorProp = precio * Math.pow(1 + aprecAnual, ano);
      const rentaAcum = flujoNeto * ano;
      const patrimonioTotal = valorProp - precio + rentaAcum; // ganancia total
      const retAccum = capitalPropio > 0 ? ((rentaAcum + valorProp - precio) / capitalPropio) * 100 : 0;
      return { ano, valorProp, rentaAcum, patrimonioTotal, retAccum };
    });
  }, [resultados, precioPropStr, gastosCompraStr, capitalPropioStr, anosStr, aprecAnualStr]);

  // ── Render ────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#fff",
    fontFamily: "Inter,sans-serif",
    fontSize: 14,
    padding: "8px 10px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: "'Montserrat',sans-serif",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
    marginBottom: 5,
    display: "block",
  };

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "18px 20px",
    marginBottom: 16,
  };

  const kpiCard = (label: string, value: string, color = "#cc0000", sub?: string) => (
    <div style={{ ...cardStyle, flex: 1, minWidth: 130, marginBottom: 0, textAlign: "center" }}>
      <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4, fontFamily: "Inter,sans-serif" }}>{sub}</div>}
    </div>
  );

  // ── Sparkline proyección ──
  const sparW = 100; const sparH = 36;
  const proyPts = proyeccion.map((p, i) => ({
    x: proyeccion.length <= 1 ? sparW / 2 : (i / (proyeccion.length - 1)) * sparW,
    y: sparH - Math.min((p.retAccum / (proyeccion[proyeccion.length - 1]?.retAccum || 1)) * sparH, sparH - 2) - 2,
  }));
  const sparPath = proyPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');
        input:focus { border-color: rgba(204,0,0,0.5) !important; box-shadow: 0 0 0 2px rgba(204,0,0,0.1); }
        select { appearance: none; }
        .seg-btn { background: none; border: none; padding: 5px 14px; border-radius: 20px; cursor: pointer; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; transition: all 0.15s; }
        .seg-btn.on { background: rgba(204,0,0,0.2); color: #cc0000; }
        .seg-btn:not(.on) { color: rgba(255,255,255,0.25); }
        .seg-btn:not(.on):hover { color: rgba(255,255,255,0.5); }
        .proj-row:hover { background: rgba(255,255,255,0.04) !important; }
        @media print { body { background: #fff !important; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 900, margin: "0 auto" }}>
        <div>
          <Link href="/calculadoras" style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
            ← CALCULADORAS
          </Link>
          <div style={{ marginTop: 6, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: "0.04em" }}>
            Calculadora de <span style={{ color: "#cc0000" }}>Rentabilidad</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            Rentabilidad bruta, neta, recupero y proyección de retorno total
          </div>
        </div>
        <button
          onClick={exportarPDF}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 14px", cursor: "pointer" }}
        >
          ↓ PDF
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px", display: "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>

        {/* ── Panel izquierdo: inputs ── */}
        <div>
          {/* Datos de compra */}
          <div style={cardStyle}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
              Datos de compra
            </div>

            {/* Moneda */}
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Moneda</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["USD", "ARS"] as const).map(m => (
                  <button key={m} className={`seg-btn${moneda === m ? " on" : ""}`} onClick={() => setMoneda(m)}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Precio de la propiedad</span>
              <input style={inputStyle} value={precioPropStr} onChange={e => setPrecioPropStr(e.target.value)} placeholder="200000" inputMode="decimal" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <span style={labelStyle}>Gastos de compra (%)</span>
                <input style={inputStyle} value={gastosCompraStr} onChange={e => setGastosCompraStr(e.target.value)} placeholder="7" inputMode="decimal" />
              </div>
              <div>
                <span style={labelStyle}>Capital propio (%)</span>
                <input style={inputStyle} value={capitalPropioStr} onChange={e => setCapitalPropioStr(e.target.value)} placeholder="100" inputMode="decimal" />
              </div>
            </div>
          </div>

          {/* Ingresos */}
          <div style={cardStyle}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
              Ingresos por alquiler
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={labelStyle}>Alquiler mensual bruto</span>
              <input style={inputStyle} value={alquilerBrutoStr} onChange={e => setAlquilerBrutoStr(e.target.value)} placeholder="1200" inputMode="decimal" />
            </div>
            <div>
              <span style={labelStyle}>Ocupación anual estimada (%)</span>
              <input style={inputStyle} value={ocupacionStr} onChange={e => setOcupacionStr(e.target.value)} placeholder="92" inputMode="decimal" />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                {100 - num(ocupacionStr)} días vacíos al año aprox.
              </div>
            </div>
          </div>

          {/* Gastos */}
          <div style={cardStyle}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
              Gastos mensuales
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Expensas", val: expensasStr, set: setExpensasStr },
                { label: "Impuestos (ABL/mun.)", val: impuestosStr, set: setImpuestosStr },
                { label: "Mantenimiento", val: mantenimientoStr, set: setMantenimientoStr },
                { label: "Seguro", val: seguroStr, set: setSeguroStr },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <span style={labelStyle}>{label}</span>
                  <input style={inputStyle} value={val} onChange={e => set(e.target.value)} placeholder="0" inputMode="decimal" />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={labelStyle}>Administración (% del alquiler)</span>
              <input style={inputStyle} value={administracionStr} onChange={e => setAdministracionStr(e.target.value)} placeholder="5" inputMode="decimal" />
            </div>
          </div>

          {/* Horizonte */}
          <div style={cardStyle}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
              Horizonte de inversión
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={labelStyle}>Años</span>
                <input style={inputStyle} value={anosStr} onChange={e => setAnosStr(e.target.value)} placeholder="10" inputMode="decimal" />
              </div>
              <div>
                <span style={labelStyle}>Apreciación anual (%)</span>
                <input style={inputStyle} value={aprecAnualStr} onChange={e => setAprecAnualStr(e.target.value)} placeholder="3" inputMode="decimal" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Panel derecho: resultados ── */}
        <div>
          {!resultados ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
              Ingresá el precio de la propiedad para ver resultados
            </div>
          ) : (
            <>
              {/* KPIs principales */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                {kpiCard("Rent. Bruta", fmtPct(resultados.rentBruta), "#cc0000")}
                {kpiCard("Rent. Neta", fmtPct(resultados.rentNeta), "#f97316")}
                {kpiCard("Recupero", resultados.recuperoPeriodo > 0 ? `${resultados.recuperoPeriodo.toFixed(1)}a` : "N/A", "#a78bfa", "período")}
                {kpiCard(`Ret. Total (${anosStr}a)`, fmtPct(resultados.retornoTotal, 1), "#22c55e")}
              </div>

              {/* Desglose */}
              <div style={cardStyle}>
                <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
                  Desglose anual
                </div>
                {[
                  { label: "Ingresos brutos anuales", val: fmtMon(num(alquilerBrutoStr) * 12 * (num(ocupacionStr) / 100), moneda), color: "#22c55e" },
                  { label: "Gastos anuales totales", val: fmtMon((num(expensasStr) + num(impuestosStr) + num(mantenimientoStr) + num(alquilerBrutoStr) * num(administracionStr) / 100 + num(seguroStr)) * 12, moneda), color: "#ef4444" },
                  { label: "Flujo neto anual", val: fmtMon(resultados.flujoAnualNeto, moneda), color: resultados.flujoAnualNeto >= 0 ? "#22c55e" : "#ef4444" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "Inter,sans-serif" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Inversión vs retorno */}
              <div style={cardStyle}>
                <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
                  Inversión y retorno a {anosStr} años
                </div>
                {[
                  { label: "Precio de compra", val: fmtMon(num(precioPropStr), moneda) },
                  { label: `Gastos de compra (${gastosCompraStr}%)`, val: fmtMon(num(precioPropStr) * num(gastosCompraStr) / 100, moneda) },
                  { label: "Inversión total", val: fmtMon(num(precioPropStr) * (1 + num(gastosCompraStr) / 100), moneda), bold: true },
                  { label: `Renta acumulada (${anosStr} años)`, val: fmtMon(resultados.flujoAnualNeto * num(anosStr), moneda), color: "#22c55e" },
                  { label: `Valor futuro estimado`, val: fmtMon(resultados.valorFuturo, moneda), color: "#60a5fa" },
                  { label: "Ganancia de capital", val: fmtMon(resultados.gananciaCapital, moneda), color: "#a78bfa" },
                ].map(({ label, val, color, bold }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "Inter,sans-serif" }}>{label}</span>
                    <span style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 900 : 600, fontFamily: "'Montserrat',sans-serif", color: color ?? "rgba(255,255,255,0.8)" }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Comparativa */}
              <div style={cardStyle}>
                <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>
                  Comparativa de rentabilidad
                </div>
                {[
                  { label: "Esta propiedad (neta)", pct: resultados.rentNeta, color: "#cc0000" },
                  { label: "Plazo fijo ARS (ref. ~3.5%)", pct: 3.5, color: "#6b7280" },
                  { label: "Bono USD (ref. ~5.5%)", pct: 5.5, color: "#6b7280" },
                  { label: "S&P 500 histórico (~7% USD)", pct: 7, color: "#6b7280" },
                ].map(({ label, pct, color }) => {
                  const maxPct = Math.max(resultados.rentNeta, 7) * 1.1;
                  return (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color }}>{fmtPct(pct)}</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min((pct / maxPct) * 100, 100)}%`, background: color, borderRadius: 3, opacity: color === "#cc0000" ? 0.9 : 0.4, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Proyección año a año */}
              {proyeccion.length > 0 && (
                <div style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>
                      Proyección año a año
                    </div>
                    {proyeccion.length > 1 && (
                      <svg width={sparW} height={sparH} style={{ overflow: "visible" }}>
                        <path d={sparPath + ` L ${sparW} ${sparH} L 0 ${sparH} Z`} fill="rgba(34,197,94,0.1)" />
                        <path d={sparPath} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                      </svg>
                    )}
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {["Año", "Valor propiedad", "Renta acum.", "Ret. total"].map(h => (
                            <th key={h} style={{ padding: "5px 8px", textAlign: "right", fontFamily: "'Montserrat',sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {proyeccion.map(p => (
                          <tr key={p.ano} className="proj-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Año {p.ano}</td>
                            <td style={{ padding: "7px 8px", textAlign: "right", color: "#60a5fa", fontFamily: "Inter,sans-serif" }}>{fmtMon(p.valorProp, moneda)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "right", color: "#22c55e", fontFamily: "Inter,sans-serif" }}>{fmtMon(p.rentaAcum, moneda)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: p.retAccum > 0 ? "#22c55e" : "#ef4444", fontSize: 13 }}>{fmtPct(p.retAccum, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", marginTop: 10, fontFamily: "Inter,sans-serif" }}>
                    * Proyección estimativa. No incluye inflación ni impuestos sobre ganancia.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
