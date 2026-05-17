"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Mes {
  nombre: string;
  ocupacion: number; // % por defecto
  multiplicadorTarifa: number; // vs tarifa base
}

// ── Datos ─────────────────────────────────────────────────────────────────────

const MESES_BASE: Mes[] = [
  { nombre: "Ene", ocupacion: 85, multiplicadorTarifa: 1.4 },
  { nombre: "Feb", ocupacion: 90, multiplicadorTarifa: 1.5 },
  { nombre: "Mar", ocupacion: 70, multiplicadorTarifa: 1.1 },
  { nombre: "Abr", ocupacion: 65, multiplicadorTarifa: 1.0 },
  { nombre: "May", ocupacion: 60, multiplicadorTarifa: 0.9 },
  { nombre: "Jun", ocupacion: 55, multiplicadorTarifa: 0.85 },
  { nombre: "Jul", ocupacion: 80, multiplicadorTarifa: 1.3 },
  { nombre: "Ago", ocupacion: 75, multiplicadorTarifa: 1.2 },
  { nombre: "Sep", ocupacion: 65, multiplicadorTarifa: 1.0 },
  { nombre: "Oct", ocupacion: 70, multiplicadorTarifa: 1.05 },
  { nombre: "Nov", ocupacion: 65, multiplicadorTarifa: 1.0 },
  { nombre: "Dic", ocupacion: 80, multiplicadorTarifa: 1.35 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function Temporario() {
  // Propiedad
  const [valorPropiedad, setValorPropiedad] = useState(120000);
  const [superficieM2, setSuperficieM2] = useState(45);

  // Temporario
  const [tarifaNocheProm, setTarifaNocheProm] = useState(80); // USD/noche base
  const [diasMinEstadia, setDiasMinEstadia] = useState(2);
  const [comisionPlataforma, setComisionPlataforma] = useState(15); // % Airbnb etc.
  const [costoLimpieza, setCostoLimpieza] = useState(25); // USD por reserva
  const [estanciasPromMes, setEstanciasPromMes] = useState(6); // reservas/mes
  const [gastosOperativosMes, setGastosOperativosMes] = useState(150); // USD/mes (expensas, servicios, mantenimiento)
  const [impuestoGanancias, setImpuestoGanancias] = useState(15); // %

  // Largo plazo
  const [alquilerMensual, setAlquilerMensual] = useState(600); // USD/mes
  const [vacanciaLpPct, setVacanciaLpPct] = useState(5); // % meses sin inquilino
  const [gastosLpMes, setGastosLpMes] = useState(80); // expensas, etc. USD/mes

  // Meses personalizados
  const [meses, setMeses] = useState<Mes[]>(MESES_BASE);

  const resultado = useMemo(() => {
    // TEMPORARIO — por mes
    const resultadosMes = meses.map(m => {
      const diasOcupados = Math.round(30 * m.ocupacion / 100);
      const nochesEfectivas = diasOcupados;
      const tarifaEfectiva = tarifaNocheProm * m.multiplicadorTarifa;
      const ingresosBrutos = nochesEfectivas * tarifaEfectiva;
      const comision = ingresosBrutos * comisionPlataforma / 100;
      const limpieza = costoLimpieza * estanciasPromMes;
      const ingresosNetos = ingresosBrutos - comision - limpieza - gastosOperativosMes;
      const impuesto = Math.max(0, ingresosNetos * impuestoGanancias / 100);
      const ingresosNetosImpuesto = ingresosNetos - impuesto;
      return { ...m, diasOcupados, tarifaEfectiva, ingresosBrutos, comision, limpieza, ingresosNetos, impuesto, ingresosNetosImpuesto };
    });

    const totalBrutoAnual = resultadosMes.reduce((a, m) => a + m.ingresosBrutos, 0);
    const totalNetoAnual = resultadosMes.reduce((a, m) => a + m.ingresosNetosImpuesto, 0);
    const rentaNetaAnualTemp = (totalNetoAnual / valorPropiedad) * 100;
    const ocupacionPromedio = meses.reduce((a, m) => a + m.ocupacion, 0) / 12;

    // LARGO PLAZO
    const ingresosBrutosLpAnual = alquilerMensual * 12;
    const vacanciaUSD = ingresosBrutosLpAnual * vacanciaLpPct / 100;
    const gastosLpAnual = gastosLpMes * 12;
    const ingresosNetosLpAnual = ingresosBrutosLpAnual - vacanciaUSD - gastosLpAnual;
    const impuestoLp = Math.max(0, ingresosNetosLpAnual * impuestoGanancias / 100);
    const ingresosNetosLpFinal = ingresosNetosLpAnual - impuestoLp;
    const rentaNetaAnualLp = (ingresosNetosLpFinal / valorPropiedad) * 100;

    // Diferencia anual
    const ventajaTemporario = totalNetoAnual - ingresosNetosLpFinal;
    const ventajaPct = ((totalNetoAnual / Math.max(ingresosNetosLpFinal, 1)) - 1) * 100;

    // Cuántos días extra de trabajo implica temporario vs LP
    const esfuerzoExtra = estanciasPromMes * 12; // rotaciones/año

    return {
      resultadosMes, totalBrutoAnual, totalNetoAnual, rentaNetaAnualTemp,
      ocupacionPromedio, ingresosBrutosLpAnual, ingresosNetosLpFinal,
      rentaNetaAnualLp, ventajaTemporario, ventajaPct, esfuerzoExtra,
    };
  }, [meses, tarifaNocheProm, comisionPlataforma, costoLimpieza, estanciasPromMes, gastosOperativosMes, impuestoGanancias, alquilerMensual, vacanciaLpPct, gastosLpMes, valorPropiedad]);

  function actualizarMes(idx: number, campo: keyof Mes, valor: number) {
    setMeses(prev => prev.map((m, i) => i === idx ? { ...m, [campo]: valor } : m));
  }

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Temporario vs Largo Plazo</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:800px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#f0f0f0;padding:7px;font-size:10px;text-align:right}th:first-child{text-align:left}td{padding:7px;border-bottom:1px solid #eee;font-size:11px;text-align:right}td:first-child{text-align:left}.total{font-weight:bold;background:#f9f9f9}.kpi{display:inline-block;margin:6px;padding:10px 14px;background:#f5f5f5;border-radius:6px;text-align:center}</style>
    </head><body>
    <h1>Análisis Temporario vs Largo Plazo</h1>
    <p>Valor propiedad: USD ${fmt(valorPropiedad)} · Sup: ${superficieM2}m² · Tarifa base: USD ${tarifaNocheProm}/noche</p>
    <div>
      <span class="kpi"><b>USD ${fmt(resultado.totalNetoAnual)}</b><br><small>Renta neta temporal/año</small></span>
      <span class="kpi"><b>${resultado.rentaNetaAnualTemp.toFixed(1)}%</b><br><small>Yield temporario</small></span>
      <span class="kpi"><b>USD ${fmt(resultado.ingresosNetosLpFinal)}</b><br><small>Renta neta LP/año</small></span>
      <span class="kpi"><b>${resultado.rentaNetaAnualLp.toFixed(1)}%</b><br><small>Yield largo plazo</small></span>
      <span class="kpi"><b>USD ${fmt(resultado.ventajaTemporario)}</b><br><small>Ventaja temporario/año</small></span>
    </div>
    <h3>Detalle mensual</h3>
    <table><tr><th>Mes</th><th>Ocup.%</th><th>Tarifa/n</th><th>Bruto</th><th>Neto imp.</th></tr>
    ${resultado.resultadosMes.map(m => `<tr><td>${m.nombre}</td><td>${m.ocupacion}%</td><td>USD ${fmt(m.tarifaEfectiva, 0)}</td><td>USD ${fmt(m.ingresosBrutos, 0)}</td><td>USD ${fmt(m.ingresosNetosImpuesto, 0)}</td></tr>`).join("")}
    <tr class="total"><td>TOTAL AÑO</td><td>${resultado.ocupacionPromedio.toFixed(0)}%</td><td>—</td><td>USD ${fmt(resultado.totalBrutoAnual, 0)}</td><td>USD ${fmt(resultado.totalNetoAnual, 0)}</td></tr>
    </table>
    <p style="font-size:10px;color:#999">Estimaciones orientativas. Mercado Airbnb/Booking puede variar por zona y temporada.</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "7px 10px", fontFamily: "'Inter',sans-serif", fontSize: 12, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 };
  const sectionStyle: React.CSSProperties = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 18, marginBottom: 12 };

  const maxIngreso = Math.max(...resultado.resultadosMes.map(m => m.ingresosBrutos), 1);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← Calculadoras</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Alquiler Temporario vs Largo Plazo
        </h1>
      </div>

      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Panel inputs */}
        <div>
          <div style={sectionStyle}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Propiedad</p>
            {[
              { label: "Valor (USD)", val: valorPropiedad, set: setValorPropiedad },
              { label: "Superficie (m²)", val: superficieM2, set: setSuperficieM2 },
            ].map(r => <div key={r.label} style={{ marginBottom: 10 }}><label style={labelStyle}>{r.label}</label><input type="number" value={r.val} onChange={e => r.set(+e.target.value)} style={inputStyle} /></div>)}
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Temporario (Airbnb / Booking)</p>
            {[
              { label: "Tarifa noche base (USD)", val: tarifaNocheProm, set: setTarifaNocheProm },
              { label: "Comisión plataforma (%)", val: comisionPlataforma, set: setComisionPlataforma },
              { label: "Costo limpieza por reserva (USD)", val: costoLimpieza, set: setCostoLimpieza },
              { label: "Reservas promedio/mes", val: estanciasPromMes, set: setEstanciasPromMes },
              { label: "Gastos operativos/mes (USD)", val: gastosOperativosMes, set: setGastosOperativosMes },
            ].map(r => <div key={r.label} style={{ marginBottom: 8 }}><label style={labelStyle}>{r.label}</label><input type="number" value={r.val} onChange={e => r.set(+e.target.value)} style={inputStyle} /></div>)}
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Largo Plazo</p>
            {[
              { label: "Alquiler mensual (USD)", val: alquilerMensual, set: setAlquilerMensual },
              { label: "Vacancia (%/año)", val: vacanciaLpPct, set: setVacanciaLpPct },
              { label: "Gastos propietario/mes (USD)", val: gastosLpMes, set: setGastosLpMes },
            ].map(r => <div key={r.label} style={{ marginBottom: 8 }}><label style={labelStyle}>{r.label}</label><input type="number" value={r.val} onChange={e => r.set(+e.target.value)} style={inputStyle} /></div>)}
          </div>

          <div style={sectionStyle}>
            <p style={{ margin: "0 0 10px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Impuestos</p>
            <label style={labelStyle}>Imp. a las Ganancias (%)</label>
            <input type="number" value={impuestoGanancias} onChange={e => setImpuestoGanancias(+e.target.value)} style={inputStyle} />
          </div>

          <button onClick={exportarPDF} style={{ width: "100%", padding: "10px", borderRadius: 8, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
            EXPORTAR PDF
          </button>
        </div>

        {/* Panel resultados */}
        <div>
          {/* Veredicto */}
          <div style={{ background: resultado.ventajaTemporario > 0 ? "rgba(34,197,94,0.06)" : "rgba(59,130,246,0.06)", border: `1px solid ${resultado.ventajaTemporario > 0 ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)"}`, borderRadius: 12, padding: 20, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Conviene más</p>
              <p style={{ margin: 0, fontSize: 26, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: resultado.ventajaTemporario > 0 ? "#22c55e" : "#3b82f6" }}>
                {resultado.ventajaTemporario > 0 ? "🏖️ TEMPORARIO" : "📋 LARGO PLAZO"}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {resultado.ventajaTemporario > 0
                  ? `+USD ${fmt(resultado.ventajaTemporario)}/año (+${resultado.ventajaPct.toFixed(0)}%) sobre largo plazo`
                  : `Largo plazo más estable sin gestión activa`}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Esfuerzo extra/año</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f97316" }}>{resultado.esfuerzoExtra} rotaciones</div>
            </div>
          </div>

          {/* KPIs comparativos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Temporario — Bruto anual", val: `USD ${fmt(resultado.totalBrutoAnual)}`, color: "#22c55e" },
              { label: "Largo Plazo — Bruto anual", val: `USD ${fmt(resultado.ingresosBrutosLpAnual)}`, color: "#3b82f6" },
              { label: "Temporario — Neto anual", val: `USD ${fmt(resultado.totalNetoAnual)}`, color: "#22c55e" },
              { label: "Largo Plazo — Neto anual", val: `USD ${fmt(resultado.ingresosNetosLpFinal)}`, color: "#3b82f6" },
              { label: "Yield temporario", val: `${resultado.rentaNetaAnualTemp.toFixed(1)}%`, color: "#22c55e" },
              { label: "Yield largo plazo", val: `${resultado.rentaNetaAnualLp.toFixed(1)}%`, color: "#3b82f6" },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kpi.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
              </div>
            ))}
          </div>

          {/* Gráfico barras mensual */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Ingresos Temporario por Mes (USD bruto)</p>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Ocupación prom. {resultado.ocupacionPromedio.toFixed(0)}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
              {resultado.resultadosMes.map((m, idx) => {
                const h = Math.max(6, (m.ingresosBrutos / maxIngreso) * 90);
                const hNeto = Math.max(3, (m.ingresosNetosImpuesto / maxIngreso) * 90);
                return (
                  <div key={m.nombre} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "100%", position: "relative", height: h }}>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: h, background: "rgba(34,197,94,0.15)", borderRadius: "3px 3px 0 0", border: "1px solid rgba(34,197,94,0.2)" }} />
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: hNeto, background: "rgba(34,197,94,0.45)", borderRadius: "3px 3px 0 0" }} />
                    </div>
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginTop: 4, fontFamily: "'Montserrat',sans-serif" }}>{m.nombre}</span>
                    <span style={{ fontSize: 7, color: "rgba(255,255,255,0.2)" }}>{m.ocupacion}%</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 2 }} /><span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Bruto</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, background: "rgba(34,197,94,0.45)", borderRadius: 2 }} /><span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Neto (c/ impuesto)</span></div>
            </div>
          </div>

          {/* Tabla mensual editable */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <p style={{ margin: 0, padding: "12px 18px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              Detalle Mensual — Ajustá ocupación y multiplicador de tarifa
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Mes", "Ocup. %", "Mult. tarifa", "Tarifa/noche", "Bruto", "Comisión+limp.", "Gastos", "Neto imp."].map(h => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: h === "Mes" ? "left" : "center", fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultado.resultadosMes.map((m, idx) => (
                  <tr key={m.nombre} style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "6px 10px", fontSize: 12, fontWeight: 600 }}>{m.nombre}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                      <input type="number" min={0} max={100} value={m.ocupacion} onChange={e => actualizarMes(idx, "ocupacion", +e.target.value)} style={{ width: 50, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", padding: "3px 6px", fontSize: 11, textAlign: "center" }} />
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                      <input type="number" step={0.05} min={0.5} max={3} value={m.multiplicadorTarifa} onChange={e => actualizarMes(idx, "multiplicadorTarifa", parseFloat(e.target.value))} style={{ width: 55, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", padding: "3px 6px", fontSize: 11, textAlign: "center" }} />
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>USD {fmt(m.tarifaEfectiva, 0)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 12, fontWeight: 700 }}>USD {fmt(m.ingresosBrutos, 0)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 11, color: "#cc0000" }}>−USD {fmt(m.comision + m.limpieza, 0)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>−USD {fmt(gastosOperativosMes, 0)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 12, fontWeight: 700, color: m.ingresosNetosImpuesto > alquilerMensual ? "#22c55e" : "rgba(255,255,255,0.6)" }}>
                      USD {fmt(m.ingresosNetosImpuesto, 0)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "rgba(255,255,255,0.04)", fontWeight: 700 }}>
                  <td style={{ padding: "9px 10px", fontSize: 12 }}>TOTAL AÑO</td>
                  <td style={{ padding: "9px 10px", textAlign: "center", fontSize: 11 }}>{resultado.ocupacionPromedio.toFixed(0)}%</td>
                  <td colSpan={2} />
                  <td style={{ padding: "9px 10px", textAlign: "center", fontSize: 13, fontWeight: 800 }}>USD {fmt(resultado.totalBrutoAnual, 0)}</td>
                  <td colSpan={2} />
                  <td style={{ padding: "9px 10px", textAlign: "center", fontSize: 13, fontWeight: 800, color: "#22c55e" }}>USD {fmt(resultado.totalNetoAnual, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
