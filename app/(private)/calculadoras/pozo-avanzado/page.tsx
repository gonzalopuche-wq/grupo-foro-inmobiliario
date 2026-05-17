"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

type Moneda = "USD" | "ARS" | "UVA";
type TipoPago = "cuotas_iguales" | "cuotas_crecientes" | "anticipo_cuotas" | "canje";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function PozoAvanzado() {
  // Proyecto
  const [nombreProyecto, setNombreProyecto] = useState("Proyecto en Pozo");
  const [precioTotal, setPrecioTotal] = useState(100000);
  const [monedaPrecio, setMonedaPrecio] = useState<Moneda>("USD");
  const [superficieM2, setSuperficieM2] = useState(50);
  const [plazoObra, setPlazoObra] = useState(30); // meses hasta entrega
  const [apreciacionEsperada, setApreciacionEsperada] = useState(25); // % sobre precio pozo al terminar

  // Estructura de pago
  const [tipoPago, setTipoPago] = useState<TipoPago>("anticipo_cuotas");
  const [anticipoPct, setAnticioPct] = useState(30);
  const [cuotasPct, setCuotasPct] = useState(50); // del total, en cuotas
  const [escrituraPct, setEscrituraPct] = useState(20);
  const [cantidadCuotas, setCantidadCuotas] = useState(24);
  const [ajusteCuotasPct, setAjusteCuotasPct] = useState(5); // % ajuste mensual si es creciente

  // Financiero
  const [tcDolar, setTcDolar] = useState(1200);
  const [valorUVA, setValorUVA] = useState(1200); // ARS por UVA
  const [inflacionMensual, setInflacionMensual] = useState(3.5); // % para proyectar ARS
  const [rentaAlquilerPct, setRentaAlquilerPct] = useState(5); // % anual sobre valor final
  const [gastosEntrega, setGastosEntrega] = useState(3); // % gastos escritura + inscripcion al recibir
  const [costosMenstualesUSD, setCostosMenstualesUSD] = useState(80); // expensas + ABL en etapa de pozo

  const resultado = useMemo(() => {
    const precioUSD = monedaPrecio === "ARS" ? precioTotal / tcDolar
      : monedaPrecio === "UVA" ? (precioTotal * valorUVA) / tcDolar
      : precioTotal;

    const pricePorM2 = superficieM2 > 0 ? precioUSD / superficieM2 : 0;

    // Estructura de pago
    const anticipo = precioUSD * anticipoPct / 100;
    const cuotasTotal = precioUSD * cuotasPct / 100;
    const escritura = precioUSD * escrituraPct / 100;
    const cuotaMensual = cantidadCuotas > 0 ? cuotasTotal / cantidadCuotas : 0;

    // Cuotas crecientes: cuota mes N = cuotaBase * (1 + ajuste%)^N
    const cuotasDetalle: { mes: number; cuota: number; acumulado: number }[] = [];
    let acum = anticipo;
    for (let i = 1; i <= cantidadCuotas; i++) {
      let cuota: number;
      if (tipoPago === "cuotas_crecientes") {
        cuota = cuotaMensual * Math.pow(1 + ajusteCuotasPct / 100, i - 1);
      } else {
        cuota = cuotaMensual;
      }
      acum += cuota;
      cuotasDetalle.push({ mes: i, cuota, acumulado: acum });
    }

    // Valor final al terminar obra
    const valorFinalUSD = precioUSD * (1 + apreciacionEsperada / 100);
    const gastos = valorFinalUSD * gastosEntrega / 100;
    const valorNeto = valorFinalUSD - gastos;

    // Ganancia capital
    const gananciaCapital = valorNeto - precioUSD;
    const roiCapital = (gananciaCapital / precioUSD) * 100;
    const roiAnualizado = (Math.pow(1 + roiCapital / 100, 12 / plazoObra) - 1) * 100;

    // Renta estimada post-entrega (anual)
    const rentaAnualUSD = valorFinalUSD * rentaAlquilerPct / 100;
    const rentaMensualUSD = rentaAnualUSD / 12;

    // Flujo mensual negativo durante obra (cuotas)
    const egresoMedio = cuotaMensual + costosMenstualesUSD;

    // TIR aproximada: inversión inicial = anticipo,
    // flujos negativos de cuotas, flujo final = valor neto - escritura
    const flujos: number[] = [-anticipo];
    for (let i = 1; i <= plazoObra; i++) {
      if (i <= cantidadCuotas) {
        flujos.push(-(cuotasDetalle[i - 1]?.cuota ?? 0) - costosMenstualesUSD);
      } else if (i === plazoObra) {
        flujos.push(valorNeto - escritura);
      } else {
        flujos.push(-costosMenstualesUSD);
      }
    }

    // Newton-Raphson TIR mensual
    function npv(rate: number, flows: number[]) {
      return flows.reduce((acc, f, t) => acc + f / Math.pow(1 + rate, t), 0);
    }
    let tir = 0.005;
    for (let iter = 0; iter < 100; iter++) {
      const f = npv(tir, flujos);
      const fp = flujos.reduce((acc, fl, t) => acc - t * fl / Math.pow(1 + tir, t + 1), 0);
      if (Math.abs(fp) < 1e-10) break;
      const newTir = tir - f / fp;
      if (Math.abs(newTir - tir) < 1e-8) { tir = newTir; break; }
      tir = newTir;
    }
    const tirAnual = (Math.pow(1 + tir, 12) - 1) * 100;

    return {
      precioUSD, pricePorM2, anticipo, cuotasTotal, escritura,
      cuotaMensual, cuotasDetalle, valorFinalUSD, valorNeto, gastos,
      gananciaCapital, roiCapital, roiAnualizado, rentaAnualUSD, rentaMensualUSD,
      egresoMedio, tirAnual, flujos,
    };
  }, [precioTotal, monedaPrecio, superficieM2, plazoObra, apreciacionEsperada, tipoPago, anticipoPct, cuotasPct, escrituraPct, cantidadCuotas, ajusteCuotasPct, tcDolar, valorUVA, rentaAlquilerPct, gastosEntrega, costosMenstualesUSD]);

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${nombreProyecto}</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:700px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#f0f0f0;padding:6px;font-size:10px;text-align:left}td{padding:6px;border-bottom:1px solid #eee;font-size:11px}.total{font-weight:bold;background:#f9f9f9}.kpi{display:inline-block;margin:8px;padding:10px 16px;background:#f5f5f5;border-radius:6px;text-align:center}</style>
    </head><body>
    <h1>${nombreProyecto}</h1>
    <p>Superficie: ${superficieM2} m² · Precio: USD ${fmt(resultado.precioUSD)} · Plazo: ${plazoObra} meses</p>
    <div>
      <span class="kpi"><b>USD ${fmt(resultado.gananciaCapital)}</b><br><small>Ganancia capital</small></span>
      <span class="kpi"><b>${resultado.roiCapital.toFixed(1)}%</b><br><small>ROI total</small></span>
      <span class="kpi"><b>${resultado.roiAnualizado.toFixed(1)}%</b><br><small>ROI anualizado</small></span>
      <span class="kpi"><b>${resultado.tirAnual.toFixed(1)}%</b><br><small>TIR anual</small></span>
    </div>
    <h3>Estructura de pago</h3>
    <table>
      <tr><th>Concepto</th><th>% del total</th><th>Monto USD</th></tr>
      <tr><td>Anticipo</td><td>${anticipoPct}%</td><td>USD ${fmt(resultado.anticipo)}</td></tr>
      <tr><td>Cuotas (${cantidadCuotas} meses)</td><td>${cuotasPct}%</td><td>USD ${fmt(resultado.cuotasTotal)}</td></tr>
      <tr><td>Escritura / entrega</td><td>${escrituraPct}%</td><td>USD ${fmt(resultado.escritura)}</td></tr>
      <tr class="total"><td>Total</td><td>100%</td><td>USD ${fmt(resultado.precioUSD)}</td></tr>
    </table>
    <h3>Cuotas (primeras 12)</h3>
    <table>
      <tr><th>Mes</th><th>Cuota USD</th><th>Acumulado</th></tr>
      ${resultado.cuotasDetalle.slice(0, 12).map(c => `<tr><td>${c.mes}</td><td>USD ${fmt(c.cuota, 0)}</td><td>USD ${fmt(c.acumulado, 0)}</td></tr>`).join("")}
    </table>
    <p style="font-size:10px;color:#999">Generado ${new Date().toLocaleDateString("es-AR")}. Estimaciones orientativas.</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 };
  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "7px 10px", fontFamily: "'Inter',sans-serif", fontSize: 12, boxSizing: "border-box" };
  const sectionStyle: React.CSSProperties = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 18, marginBottom: 12 };

  const maxCuota = Math.max(...resultado.cuotasDetalle.map(c => c.cuota), 1);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← Calculadoras</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Inversión en Pozo — Análisis Avanzado
        </h1>
      </div>

      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>
        {/* Panel inputs */}
        <div>
          <div style={sectionStyle}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Proyecto</p>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Nombre</label>
              <input type="text" value={nombreProyecto} onChange={e => setNombreProyecto(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Precio total</label>
                <input type="number" value={precioTotal} onChange={e => setPrecioTotal(+e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Moneda</label>
                <select value={monedaPrecio} onChange={e => setMonedaPrecio(e.target.value as Moneda)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                  <option value="UVA">UVA</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={labelStyle}>Superficie (m²)</label>
                <input type="number" value={superficieM2} onChange={e => setSuperficieM2(+e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Plazo obra (meses)</label>
                <input type="number" value={plazoObra} onChange={e => setPlazoObra(+e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Estructura de Pago</p>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Tipo</label>
              <select value={tipoPago} onChange={e => setTipoPago(e.target.value as TipoPago)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="anticipo_cuotas">Anticipo + cuotas + escritura</option>
                <option value="cuotas_iguales">Cuotas iguales</option>
                <option value="cuotas_crecientes">Cuotas crecientes</option>
                <option value="canje">Canje (inmueble/auto)</option>
              </select>
            </div>
            {[
              { label: `Anticipo (%)`, val: anticipoPct, set: setAnticioPct },
              { label: `Cuotas (%)`, val: cuotasPct, set: setCuotasPct },
              { label: `Escritura (%)`, val: escrituraPct, set: setEscrituraPct },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>{row.label}</label>
                <input type="number" value={row.val} onChange={e => row.set(+e.target.value)} style={{ ...inputStyle, width: 70 }} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label style={labelStyle}>Cant. cuotas</label>
                <input type="number" value={cantidadCuotas} onChange={e => setCantidadCuotas(+e.target.value)} style={inputStyle} />
              </div>
              {tipoPago === "cuotas_crecientes" && (
                <div>
                  <label style={labelStyle}>Ajuste mens. (%)</label>
                  <input type="number" step="0.5" value={ajusteCuotasPct} onChange={e => setAjusteCuotasPct(+e.target.value)} style={inputStyle} />
                </div>
              )}
            </div>
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Parámetros Financieros</p>
            {[
              { label: "T.C. ARS/USD", val: tcDolar, set: setTcDolar },
              { label: "Valor UVA (ARS)", val: valorUVA, set: setValorUVA },
              { label: "Apreciación esperada (%)", val: apreciacionEsperada, set: setApreciacionEsperada },
              { label: "Inflación mensual (%)", val: inflacionMensual, set: setInflacionMensual, step: 0.5 },
              { label: "Renta alquiler post-entrega (%/año)", val: rentaAlquilerPct, set: setRentaAlquilerPct, step: 0.5 },
              { label: "Gastos escritura entrega (%)", val: gastosEntrega, set: setGastosEntrega, step: 0.5 },
              { label: "Expensas/ABL mensual (USD)", val: costosMenstualesUSD, set: setCostosMenstualesUSD },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 0, flex: 1, fontSize: 9 }}>{row.label}</label>
                <input type="number" step={row.step ?? 1} value={row.val} onChange={e => row.set(+e.target.value)} style={{ ...inputStyle, width: 80 }} />
              </div>
            ))}
          </div>

          <button onClick={exportarPDF} style={{ width: "100%", padding: "10px", borderRadius: 8, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
            EXPORTAR PDF
          </button>
        </div>

        {/* Panel resultados */}
        <div>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Precio USD (pozo)", val: `USD ${fmt(resultado.precioUSD)}`, sub: `USD ${fmt(resultado.pricePorM2, 0)}/m²`, color: "#fff" },
              { label: "Valor final estimado", val: `USD ${fmt(resultado.valorFinalUSD)}`, sub: `+${apreciacionEsperada}% apreciación`, color: "#22c55e" },
              { label: "Ganancia de capital", val: `USD ${fmt(resultado.gananciaCapital)}`, sub: `${resultado.roiCapital.toFixed(1)}% ROI total`, color: "#f97316" },
              { label: "TIR anual", val: `${resultado.tirAnual.toFixed(1)}%`, sub: `ROI anualizado ${resultado.roiAnualizado.toFixed(1)}%`, color: "#cc0000" },
              { label: "Cuota mensual base", val: `USD ${fmt(resultado.cuotaMensual, 0)}`, sub: `${cantidadCuotas} cuotas`, color: "#3b82f6" },
              { label: "Renta mensual estimada", val: `USD ${fmt(resultado.rentaMensualUSD, 0)}`, sub: `${rentaAlquilerPct}%/año sobre valor final`, color: "#a78bfa" },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 18px" }}>
                <p style={{ margin: "0 0 6px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{kpi.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
                <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Estructura de pago visual */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Estructura de Pago</p>
            <div style={{ display: "flex", height: 20, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
              {[
                { pct: anticipoPct, color: "#cc0000", label: `Anticipo ${anticipoPct}%` },
                { pct: cuotasPct, color: "#3b82f6", label: `Cuotas ${cuotasPct}%` },
                { pct: escrituraPct, color: "#22c55e", label: `Escritura ${escrituraPct}%` },
              ].map(seg => (
                <div key={seg.label} style={{ flex: seg.pct, background: seg.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {seg.pct >= 10 && <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{seg.pct}%</span>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[
                { label: `Anticipo: USD ${fmt(resultado.anticipo)}`, color: "#cc0000" },
                { label: `Cuotas: USD ${fmt(resultado.cuotasTotal)}`, color: "#3b82f6" },
                { label: `Escritura: USD ${fmt(resultado.escritura)}`, color: "#22c55e" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico cuotas */}
          {resultado.cuotasDetalle.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Evolución de Cuotas (USD)</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, overflowX: "auto" }}>
                {resultado.cuotasDetalle.map(c => {
                  const h = Math.max(4, (c.cuota / maxCuota) * 70);
                  return (
                    <div key={c.mes} style={{ flex: 1, minWidth: 8, height: h, background: "rgba(59,130,246,0.5)", borderRadius: "2px 2px 0 0", border: "1px solid rgba(59,130,246,0.3)", position: "relative" }} title={`Mes ${c.mes}: USD ${fmt(c.cuota, 0)}`} />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Mes 1: USD {fmt(resultado.cuotasDetalle[0]?.cuota ?? 0, 0)}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Mes {cantidadCuotas}: USD {fmt(resultado.cuotasDetalle[resultado.cuotasDetalle.length - 1]?.cuota ?? 0, 0)}</span>
              </div>
            </div>
          )}

          {/* Tabla detalle cuotas (primeras 12) */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <p style={{ margin: 0, padding: "12px 18px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              Detalle de Cuotas {resultado.cuotasDetalle.length > 12 ? "(primeras 12)" : ""}
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Mes", "Cuota USD", "% del total", "Acumulado", "% pagado"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: h === "Mes" ? "center" : "right", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultado.cuotasDetalle.slice(0, 12).map((c, idx) => (
                  <tr key={c.mes} style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "7px 14px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{c.mes}</td>
                    <td style={{ padding: "7px 14px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>USD {fmt(c.cuota, 0)}</td>
                    <td style={{ padding: "7px 14px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{(c.cuota / resultado.precioUSD * 100).toFixed(1)}%</td>
                    <td style={{ padding: "7px 14px", textAlign: "right", fontSize: 12 }}>USD {fmt(c.acumulado, 0)}</td>
                    <td style={{ padding: "7px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, c.acumulado / resultado.precioUSD * 100)}%`, background: "#3b82f6", borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{(c.acumulado / resultado.precioUSD * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
