"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function usd(n: number) { return `USD ${fmt(Math.round(n))}`; }
function pct(n: number, d = 1) { return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`; }

export default function AirbnbPage() {
  // Propiedad
  const [valorProp, setValorProp] = useState(120000);
  const [m2, setM2] = useState(55);

  // Temporario (Airbnb/Booking)
  const [tarifaDiaria, setTarifaDiaria] = useState(80); // USD/noche
  const [ocupacion, setOcupacion] = useState(65); // % noches/año ocupadas
  const [limpiezaPorEstadia, setLimpiezaPorEstadia] = useState(20); // USD
  const [estadiaPromedioNoches, setEstadiaPromedioNoches] = useState(3);
  const [comisionPlat, setComisionPlat] = useState(15); // % Airbnb/Booking
  const [administracion, setAdministracion] = useState(20); // % del ingreso bruto (property manager)
  const [suministros, setSuministros] = useState(100); // USD/mes (internet, luz, reposición)
  const [mantenimiento, setMantenimiento] = useState(0.5); // % del valor prop/año

  // Alquiler tradicional
  const [alqMensual, setAlqMensual] = useState(600); // USD/mes
  const [vacanciaTrad, setVacanciaTrad] = useState(8); // %
  const [gastosTrad, setGastosTrad] = useState(15); // % del alquiler anual (admin, vacancia extra, reparaciones)

  const calcs = useMemo(() => {
    const nochesAnio = 365 * (ocupacion / 100);
    const estaciasAnio = nochesAnio / estadiaPromedioNoches;

    // Ingresos brutos temporario
    const ingBrutoTarifas = nochesAnio * tarifaDiaria;
    const ingBrutoLimpieza = estaciasAnio * limpiezaPorEstadia;
    const ingBrutoTotal = ingBrutoTarifas + ingBrutoLimpieza;

    // Costos temporario
    const costoPlataforma = ingBrutoTarifas * (comisionPlat / 100);
    const costoAdmin = ingBrutoTotal * (administracion / 100);
    const costoSuministros = suministros * 12;
    const costoMantenimiento = valorProp * (mantenimiento / 100);
    const costoTotalTemp = costoPlataforma + costoAdmin + costoSuministros + costoMantenimiento;

    const noiTemp = ingBrutoTotal - costoTotalTemp;
    const rentaNeta = valorProp > 0 ? (noiTemp / valorProp) * 100 : 0;
    const ingDiarioNeto = nochesAnio > 0 ? noiTemp / nochesAnio : 0;

    // Alquiler tradicional
    const ingBrutoTrad = alqMensual * 12;
    const costosTrad = ingBrutoTrad * (gastosTrad / 100);
    const vacanciaCosto = ingBrutoTrad * (vacanciaTrad / 100);
    const noiTrad = ingBrutoTrad - costosTrad - vacanciaCosto;
    const rentaNetaTrad = valorProp > 0 ? (noiTrad / valorProp) * 100 : 0;

    // Diferencia
    const ventajaTemp = noiTemp - noiTrad;
    const multiplicador = noiTrad > 0 ? noiTemp / noiTrad : 0;

    // Break-even: ocupación mínima para empatar con alquiler tradicional
    // noiTemp(x) = x * 365 * (tarifaDiaria + limpiezaPorEstadia/estadiaPromedioNoches) * (1 - comisionPlat/100 - administracion/100) - costoSuministros - costoMantenimiento
    const ingresoNocheNeta = (tarifaDiaria + limpiezaPorEstadia / estadiaPromedioNoches) * (1 - (comisionPlat + administracion) / 100);
    const breakEvenNoches = ingresoNocheNeta > 0 ? (noiTrad + costoSuministros + costoMantenimiento) / ingresoNocheNeta : 0;
    const breakEvenOcupacion = (breakEvenNoches / 365) * 100;

    // Curva por ocupación
    const curva = Array.from({ length: 11 }, (_, i) => {
      const occ = i * 10;
      const n = 365 * (occ / 100);
      const est = n / estadiaPromedioNoches;
      const ibt = n * tarifaDiaria + est * limpiezaPorEstadia;
      const cost = ibt * ((comisionPlat + administracion) / 100) + costoSuministros + costoMantenimiento;
      return { occ, noiTemp: ibt - cost, noiTrad };
    });

    return { nochesAnio, estaciasAnio, ingBrutoTotal, costoPlataforma, costoAdmin, costoSuministros, costoMantenimiento, costoTotalTemp, noiTemp, rentaNeta, ingDiarioNeto, ingBrutoTrad, costosTrad, vacanciaCosto, noiTrad, rentaNetaTrad, ventajaTemp, multiplicador, breakEvenNoches, breakEvenOcupacion, curva };
  }, [valorProp, tarifaDiaria, ocupacion, limpiezaPorEstadia, estadiaPromedioNoches, comisionPlat, administracion, suministros, mantenimiento, alqMensual, vacanciaTrad, gastosTrad]);

  const maxNOI = Math.max(...calcs.curva.map(c => Math.max(Math.abs(c.noiTemp), Math.abs(c.noiTrad))), 1);
  const inputSm = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const };
  const labelSm = { fontSize: 11, color: "#6b7280", display: "block" as const, marginBottom: 2 };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Airbnb vs Alquiler Tradicional</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;color:#222}
    h1{font-size:20px}h2{font-size:13px;margin:14px 0 6px;color:#555}
    table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:5px 8px;text-align:left;font-size:10px}
    td{padding:5px 8px;border-bottom:1px solid #eee}
    .kpi{display:inline-block;margin:4px 6px 4px 0;padding:8px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px}
    .kpi-v{font-size:20px;font-weight:700}.kpi-l{font-size:9px;color:#888}
    </style></head><body>
    <h1>Airbnb vs Alquiler Tradicional</h1>
    <p>Propiedad ${usd(valorProp)} · ${m2}m² · Tarifa USD ${tarifaDiaria}/noche · Ocupación ${ocupacion}%</p>
    <h2>Comparativa</h2>
    <div>
      <div class="kpi"><div class="kpi-v">${usd(calcs.noiTemp)}</div><div class="kpi-l">NOI Temporario</div></div>
      <div class="kpi"><div class="kpi-v">${usd(calcs.noiTrad)}</div><div class="kpi-l">NOI Tradicional</div></div>
      <div class="kpi"><div class="kpi-v">${calcs.rentaNeta.toFixed(1)}%</div><div class="kpi-l">Renta neta Temporario</div></div>
      <div class="kpi"><div class="kpi-v">${calcs.rentaNetaTrad.toFixed(1)}%</div><div class="kpi-l">Renta neta Tradicional</div></div>
      <div class="kpi"><div class="kpi-v">${calcs.breakEvenOcupacion.toFixed(0)}%</div><div class="kpi-l">Ocupación break-even</div></div>
    </div>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>🏡 Temporario vs Alquiler Tradicional</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Comparativa de rentabilidad: Airbnb/Booking vs alquiler convencional</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
            <button onClick={exportPDF} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#e5e5e5", padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
          </div>
        </div>

        {/* KPIs comparativos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "#111", border: "1px solid #f9731633", borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 12, color: "#f97316", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>🏠 Alquiler Temporario (Airbnb)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "NOI anual", value: usd(calcs.noiTemp), color: calcs.noiTemp > 0 ? "#22c55e" : "#cc0000" },
                { label: "Renta neta", value: `${calcs.rentaNeta.toFixed(1)}%`, color: calcs.rentaNeta > 6 ? "#22c55e" : "#f97316" },
                { label: "Noches/año", value: Math.round(calcs.nochesAnio).toString(), color: "#9ca3af" },
                { label: "Ingreso bruto", value: usd(calcs.ingBrutoTotal), color: "#9ca3af" },
              ].map(k => (
                <div key={k.label} style={{ background: "#0a0a0a", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{k.label}</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#111", border: "1px solid #3b82f633", borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 12, color: "#3b82f6", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>🏢 Alquiler Tradicional</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "NOI anual", value: usd(calcs.noiTrad), color: calcs.noiTrad > 0 ? "#22c55e" : "#cc0000" },
                { label: "Renta neta", value: `${calcs.rentaNetaTrad.toFixed(1)}%`, color: calcs.rentaNetaTrad > 4 ? "#22c55e" : "#f97316" },
                { label: "Ingreso bruto", value: usd(calcs.ingBrutoTrad), color: "#9ca3af" },
                { label: "Costos totales", value: usd(calcs.costosTrad + calcs.vacanciaCosto), color: "#cc0000" },
              ].map(k => (
                <div key={k.label} style={{ background: "#0a0a0a", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{k.label}</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ventaja y break-even */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Ventaja Temporario", value: usd(calcs.ventajaTemp), color: calcs.ventajaTemp > 0 ? "#22c55e" : "#cc0000", sub: calcs.ventajaTemp > 0 ? `${calcs.multiplicador.toFixed(1)}× vs tradicional` : "Tradicional más rentable" },
            { label: "Break-even ocupación", value: `${calcs.breakEvenOcupacion.toFixed(0)}%`, color: calcs.breakEvenOcupacion <= 50 ? "#22c55e" : calcs.breakEvenOcupacion <= 70 ? "#f97316" : "#cc0000", sub: `${Math.round(calcs.breakEvenNoches)} noches/año mínimo` },
            { label: "Ingreso diario neto", value: usd(calcs.ingDiarioNeto), color: "#9ca3af", sub: "por noche ocupada (post-costos)" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#f97316", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Propiedad</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><label style={labelSm}>Valor (USD)</label><input type="number" value={valorProp} onChange={e => setValorProp(parseFloat(e.target.value)||0)} style={inputSm} /></div>
                <div><label style={labelSm}>Superficie (m²)</label><input type="number" value={m2} onChange={e => setM2(parseFloat(e.target.value)||1)} style={inputSm} /></div>
              </div>
            </div>
            <div style={{ background: "#111", border: "1px solid #f9731633", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#f97316", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>🏠 Temporario</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><label style={labelSm}>Tarifa diaria (USD/noche)</label><input type="number" value={tarifaDiaria} onChange={e => setTarifaDiaria(parseFloat(e.target.value)||0)} style={inputSm} /></div>
                <div><label style={labelSm}>Ocupación anual (%)</label><input type="number" value={ocupacion} onChange={e => setOcupacion(parseFloat(e.target.value)||0)} step={5} style={inputSm} /></div>
                <div><label style={labelSm}>Estadía promedio (noches)</label><input type="number" value={estadiaPromedioNoches} onChange={e => setEstadiaPromedioNoches(parseFloat(e.target.value)||1)} style={inputSm} /></div>
                <div><label style={labelSm}>Limpieza por estadía (USD)</label><input type="number" value={limpiezaPorEstadia} onChange={e => setLimpiezaPorEstadia(parseFloat(e.target.value)||0)} style={inputSm} /></div>
                <div><label style={labelSm}>Comisión plataforma (%)</label><input type="number" value={comisionPlat} onChange={e => setComisionPlat(parseFloat(e.target.value)||0)} step={0.5} style={inputSm} /></div>
                <div><label style={labelSm}>Administración/gestoría (%)</label><input type="number" value={administracion} onChange={e => setAdministracion(parseFloat(e.target.value)||0)} step={5} style={inputSm} /></div>
                <div><label style={labelSm}>Suministros/mes (USD)</label><input type="number" value={suministros} onChange={e => setSuministros(parseFloat(e.target.value)||0)} step={10} style={inputSm} /></div>
                <div><label style={labelSm}>Mantenimiento (% del valor/año)</label><input type="number" value={mantenimiento} onChange={e => setMantenimiento(parseFloat(e.target.value)||0)} step={0.1} style={inputSm} /></div>
              </div>
            </div>
            <div style={{ background: "#111", border: "1px solid #3b82f633", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#3b82f6", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>🏢 Tradicional</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div><label style={labelSm}>Alquiler mensual (USD)</label><input type="number" value={alqMensual} onChange={e => setAlqMensual(parseFloat(e.target.value)||0)} style={inputSm} /></div>
                <div><label style={labelSm}>Vacancia (%)</label><input type="number" value={vacanciaTrad} onChange={e => setVacanciaTrad(parseFloat(e.target.value)||0)} step={1} style={inputSm} /></div>
                <div><label style={labelSm}>Gastos totales (% del ing. bruto)</label><input type="number" value={gastosTrad} onChange={e => setGastosTrad(parseFloat(e.target.value)||0)} step={1} style={inputSm} /></div>
              </div>
            </div>
          </div>

          {/* Análisis */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Waterfall costos */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>Desglose de costos temporario</div>
              {[
                { label: "Comisión plataforma", value: calcs.costoPlataforma, color: "#cc0000" },
                { label: "Administración/gestoría", value: calcs.costoAdmin, color: "#f97316" },
                { label: "Suministros anuales", value: calcs.costoSuministros, color: "#eab308" },
                { label: "Mantenimiento", value: calcs.costoMantenimiento, color: "#6b7280" },
              ].map(c => {
                const p = calcs.costoTotalTemp > 0 ? (c.value / calcs.costoTotalTemp) * 100 : 0;
                return (
                  <div key={c.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "#9ca3af" }}>{c.label}</span>
                      <span style={{ color: "#e5e5e5" }}>{usd(c.value)} <span style={{ color: "#4b5563", fontSize: 10 }}>({p.toFixed(0)}%)</span></span>
                    </div>
                    <div style={{ background: "#0a0a0a", borderRadius: 3, height: 6, overflow: "hidden" }}>
                      <div style={{ width: `${p}%`, height: "100%", background: c.color }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13 }}>
                <span>Total costos</span>
                <span style={{ color: "#cc0000" }}>{usd(calcs.costoTotalTemp)}</span>
              </div>
            </div>

            {/* Gráfico NOI por ocupación */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>NOI según ocupación (temporario vs tradicional)</div>
              <svg width="100%" height={160} viewBox="0 0 520 160" preserveAspectRatio="none">
                <line x1={20} x2={510} y1={110} y2={110} stroke="#1f2937" strokeWidth={1} />
                {calcs.curva.map((c, i) => {
                  const x = 20 + i * 49;
                  const hTemp = Math.abs(c.noiTemp) / maxNOI * 100;
                  const positive = c.noiTemp >= 0;
                  return (
                    <g key={i}>
                      <rect x={x} y={positive ? 110 - hTemp : 110} width={22} height={hTemp}
                        fill={c.noiTemp >= c.noiTrad ? "#f9731666" : "#f9731633"} rx={2} />
                      <text x={x + 11} y={148} textAnchor="middle" fill="#4b5563" fontSize={8} fontFamily="Montserrat">{c.occ}%</text>
                    </g>
                  );
                })}
                {/* Línea tradicional */}
                <line x1={20} x2={510} y1={110 - (calcs.noiTrad / maxNOI) * 100} y2={110 - (calcs.noiTrad / maxNOI) * 100} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" />
                <polyline points={calcs.curva.map((c, i) => `${20 + i * 49 + 11},${110 - (c.noiTrad / maxNOI) * 100}`).join(" ")} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
                {/* Punto break-even */}
                <text x={20 + (calcs.breakEvenOcupacion / 10) * 49} y={105} textAnchor="middle" fill="#22c55e" fontSize={8} fontFamily="Montserrat">↓ BE</text>
              </svg>
              <div style={{ display: "flex", gap: 16, fontSize: 11, marginTop: 4 }}>
                <span style={{ color: "#f97316" }}>■ NOI Temporario</span>
                <span style={{ color: "#3b82f6" }}>-- NOI Tradicional</span>
                <span style={{ color: "#22c55e" }}>↓ Break-even ({calcs.breakEvenOcupacion.toFixed(0)}%)</span>
              </div>
            </div>

            {/* Tabla comparativa */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Resumen comparativo</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Concepto", "Temporario", "Tradicional", "Diferencia"].map(h => (
                      <th key={h} style={{ padding: "5px 8px", textAlign: h === "Concepto" ? "left" : "right", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #1f2937" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Ingreso bruto anual", calcs.ingBrutoTotal, calcs.ingBrutoTrad],
                    ["Costos totales", calcs.costoTotalTemp, calcs.costosTrad + calcs.vacanciaCosto],
                    ["NOI anual", calcs.noiTemp, calcs.noiTrad],
                    ["Renta neta %", calcs.rentaNeta, calcs.rentaNetaTrad],
                  ].map(([label, temp, trad]) => {
                    const diff = (temp as number) - (trad as number);
                    const isRate = label === "Renta neta %";
                    const fmtVal = (v: number) => isRate ? `${v.toFixed(1)}%` : usd(v);
                    return (
                      <tr key={label as string} style={{ borderBottom: "1px solid #111" }}>
                        <td style={{ padding: "7px 8px", color: "#9ca3af" }}>{label}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#f97316", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>{fmtVal(temp as number)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#3b82f6", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>{fmtVal(trad as number)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: diff >= 0 ? "#22c55e" : "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          {diff >= 0 ? "+" : ""}{fmtVal(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
