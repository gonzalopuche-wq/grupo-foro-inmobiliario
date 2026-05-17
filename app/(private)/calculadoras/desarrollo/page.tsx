"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function usd(n: number) { return `USD ${fmt(Math.round(n))}`; }
function pct(n: number, d = 1) { return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`; }

interface Unidad {
  id: number;
  tipo: string;
  cantidad: number;
  m2: number;
  precioM2Venta: number;
  costoConstrM2: number;
}

const TIPO_DEFAULTS: Record<string, { m2: number; precioM2Venta: number; costoConstrM2: number }> = {
  "Monoambiente":  { m2: 35,  precioM2Venta: 2800, costoConstrM2: 1200 },
  "1 Dormitorio":  { m2: 50,  precioM2Venta: 2600, costoConstrM2: 1150 },
  "2 Dormitorios": { m2: 70,  precioM2Venta: 2500, costoConstrM2: 1100 },
  "3 Dormitorios": { m2: 95,  precioM2Venta: 2400, costoConstrM2: 1050 },
  "Local comercial": { m2: 60, precioM2Venta: 3200, costoConstrM2: 1300 },
  "Cochera":       { m2: 15,  precioM2Venta: 18000, costoConstrM2: 600 },
};

let nextId = 4;

export default function DesarrolloPage() {
  // Terreno y proyecto
  const [costoTerreno, setCostoTerreno] = useState(500000);
  const [m2Terreno, setM2Terreno] = useState(500);
  const [softCostsPct, setSoftCostsPct] = useState(12); // % sobre costos de construcción (honorarios, permisos, etc.)
  const [financPct, setFinancPct] = useState(8); // % costo financiero anual
  const [plazoMeses, setPlazoMeses] = useState(24);
  const [comercPct, setComercPct] = useState(3); // % honorarios venta
  const [impuestoGan, setImpuestoGan] = useState(15); // % impuesto a la ganancia

  // Unidades
  const [unidades, setUnidades] = useState<Unidad[]>([
    { id: 1, tipo: "1 Dormitorio",  cantidad: 4, m2: 50,  precioM2Venta: 2600, costoConstrM2: 1150 },
    { id: 2, tipo: "2 Dormitorios", cantidad: 6, m2: 70,  precioM2Venta: 2500, costoConstrM2: 1100 },
    { id: 3, tipo: "Cochera",       cantidad: 8, m2: 15,  precioM2Venta: 18000, costoConstrM2: 600 },
  ]);

  const [activeTab, setActiveTab] = useState<"costos" | "ingresos" | "resumen">("resumen");

  const addUnidad = (tipo: string) => {
    const def = TIPO_DEFAULTS[tipo] ?? { m2: 50, precioM2Venta: 2500, costoConstrM2: 1100 };
    setUnidades(prev => [...prev, { id: nextId++, tipo, cantidad: 1, ...def }]);
  };

  const updUnidad = (id: number, key: keyof Unidad, val: number | string) => {
    setUnidades(prev => prev.map(u => u.id === id ? { ...u, [key]: val } : u));
  };

  const delUnidad = (id: number) => setUnidades(prev => prev.filter(u => u.id !== id));

  const calcs = useMemo(() => {
    // Costos construcción
    const unidadesCalc = unidades.map(u => ({
      ...u,
      totalM2: u.cantidad * u.m2,
      costoConstr: u.cantidad * u.m2 * u.costoConstrM2,
      ingresos: u.cantidad * u.m2 * u.precioM2Venta,
    }));

    const totalCostoConstr = unidadesCalc.reduce((s, u) => s + u.costoConstr, 0);
    const softCosts = totalCostoConstr * (softCostsPct / 100);
    const totalM2Construido = unidadesCalc.reduce((s, u) => s + u.totalM2, 0);
    const totalUnidades = unidadesCalc.reduce((s, u) => s + u.cantidad, 0);

    // Costo financiero sobre terreno+construcción durante obra
    const costoFinancieroBase = (costoTerreno + totalCostoConstr) * (financPct / 100) * (plazoMeses / 12);

    const costoTotalSinImp = costoTerreno + totalCostoConstr + softCosts + costoFinancieroBase;

    // Ingresos
    const totalIngresos = unidadesCalc.reduce((s, u) => s + u.ingresos, 0);
    const costoComercializacion = totalIngresos * (comercPct / 100);
    const ingresosNetos = totalIngresos - costoComercializacion;

    // Ganancia bruta
    const ganBruta = ingresosNetos - costoTotalSinImp;
    const impuesto = ganBruta > 0 ? ganBruta * (impuestoGan / 100) : 0;
    const ganNeta = ganBruta - impuesto;

    const roi = costoTotalSinImp > 0 ? (ganNeta / costoTotalSinImp) * 100 : 0;
    const roiAnualizado = plazoMeses > 0 ? (Math.pow(1 + roi / 100, 12 / plazoMeses) - 1) * 100 : roi;
    const margen = ingresosNetos > 0 ? (ganNeta / ingresosNetos) * 100 : 0;
    const costoM2 = totalM2Construido > 0 ? costoTotalSinImp / totalM2Construido : 0;
    const precioM2prom = totalM2Construido > 0 ? totalIngresos / totalM2Construido : 0;

    // Breakeven: precio de venta mínimo
    const breakevenM2 = totalM2Construido > 0 ? costoTotalSinImp / totalM2Construido : 0;

    // FOS (factor ocupación suelo) = m2 construido / m2 terreno
    const fos = m2Terreno > 0 ? totalM2Construido / m2Terreno : 0;

    return {
      unidadesCalc,
      totalCostoConstr,
      softCosts,
      costoFinancieroBase,
      costoComercializacion,
      costoTotalSinImp,
      totalIngresos,
      ingresosNetos,
      ganBruta,
      impuesto,
      ganNeta,
      roi,
      roiAnualizado,
      margen,
      costoM2,
      precioM2prom,
      breakevenM2,
      fos,
      totalM2Construido,
      totalUnidades,
    };
  }, [unidades, costoTerreno, m2Terreno, softCostsPct, financPct, plazoMeses, comercPct, impuestoGan]);

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Desarrollo Inmobiliario</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#222}
    h1{font-size:20px}h2{font-size:14px;margin:20px 0 8px;color:#555}
    table{width:100%;border-collapse:collapse;margin-bottom:14px}
    th{background:#f0f0f0;padding:6px 8px;text-align:left;font-size:10px}
    td{padding:5px 8px;border-bottom:1px solid #eee}
    .kpi{display:inline-block;margin:4px 6px 4px 0;padding:8px 14px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px}
    .kpi-v{font-size:22px;font-weight:700}.kpi-l{font-size:10px;color:#888}
    </style></head><body>
    <h1>Análisis de Desarrollo Inmobiliario</h1>
    <p>Terreno ${usd(costoTerreno)} · ${m2Terreno}m² · Plazo ${plazoMeses} meses</p>
    <h2>Resumen Financiero</h2>
    <div>
      <div class="kpi"><div class="kpi-v">${usd(calcs.ganNeta)}</div><div class="kpi-l">Ganancia neta</div></div>
      <div class="kpi"><div class="kpi-v">${calcs.roi.toFixed(1)}%</div><div class="kpi-l">ROI</div></div>
      <div class="kpi"><div class="kpi-v">${calcs.roiAnualizado.toFixed(1)}%</div><div class="kpi-l">ROI anualizado</div></div>
      <div class="kpi"><div class="kpi-v">${calcs.margen.toFixed(1)}%</div><div class="kpi-l">Margen neto</div></div>
    </div>
    <h2>Costos</h2>
    <table><thead><tr><th>Concepto</th><th>Monto</th><th>%</th></tr></thead><tbody>
      <tr><td>Terreno</td><td>${usd(costoTerreno)}</td><td>${((costoTerreno/calcs.costoTotalSinImp)*100).toFixed(1)}%</td></tr>
      <tr><td>Construcción</td><td>${usd(calcs.totalCostoConstr)}</td><td>${((calcs.totalCostoConstr/calcs.costoTotalSinImp)*100).toFixed(1)}%</td></tr>
      <tr><td>Soft costs (${softCostsPct}%)</td><td>${usd(calcs.softCosts)}</td><td>${((calcs.softCosts/calcs.costoTotalSinImp)*100).toFixed(1)}%</td></tr>
      <tr><td>Costo financiero</td><td>${usd(calcs.costoFinancieroBase)}</td><td>${((calcs.costoFinancieroBase/calcs.costoTotalSinImp)*100).toFixed(1)}%</td></tr>
      <tr><td><strong>Total</strong></td><td><strong>${usd(calcs.costoTotalSinImp)}</strong></td><td>100%</td></tr>
    </tbody></table>
    <h2>Unidades</h2>
    <table><thead><tr><th>Tipo</th><th>Cant.</th><th>m²</th><th>$/m² venta</th><th>Ingresos</th><th>Costo constr.</th></tr></thead><tbody>
    ${calcs.unidadesCalc.map(u => `<tr>
      <td>${u.tipo}</td><td>${u.cantidad}</td><td>${u.totalM2}</td>
      <td>${usd(u.precioM2Venta)}</td><td>${usd(u.ingresos)}</td><td>${usd(u.costoConstr)}</td>
    </tr>`).join("")}
    </tbody></table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const cardStyle = { background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 };
  const inputSm = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const };
  const labelSm = { fontSize: 11, color: "#6b7280", display: "block" as const, marginBottom: 2 };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>🏗️ Desarrollo Inmobiliario</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Análisis de rentabilidad para proyectos de construcción y venta</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
            <button onClick={exportPDF} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#e5e5e5", padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
          </div>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Ganancia neta", value: usd(calcs.ganNeta), color: calcs.ganNeta > 0 ? "#22c55e" : "#cc0000" },
            { label: "ROI", value: pct(calcs.roi), color: calcs.roi > 15 ? "#22c55e" : calcs.roi > 8 ? "#f97316" : "#cc0000" },
            { label: "ROI anualizado", value: pct(calcs.roiAnualizado), color: calcs.roiAnualizado > 12 ? "#22c55e" : calcs.roiAnualizado > 6 ? "#f97316" : "#cc0000" },
            { label: "Margen neto", value: `${calcs.margen.toFixed(1)}%`, color: calcs.margen > 20 ? "#22c55e" : calcs.margen > 10 ? "#f97316" : "#cc0000" },
            { label: "Break-even m²", value: usd(calcs.breakevenM2), color: "#9ca3af" },
          ].map(k => (
            <div key={k.label} style={{ ...cardStyle, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          {/* Inputs izquierda */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Terreno y proyecto</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div><label style={labelSm}>Costo del terreno (USD)</label><input type="number" value={costoTerreno} onChange={e => setCostoTerreno(parseFloat(e.target.value)||0)} style={inputSm} /></div>
                <div><label style={labelSm}>Superficie terreno (m²)</label><input type="number" value={m2Terreno} onChange={e => setM2Terreno(parseFloat(e.target.value)||1)} style={inputSm} /></div>
                <div><label style={labelSm}>Plazo de obra (meses)</label><input type="number" value={plazoMeses} onChange={e => setPlazoMeses(parseFloat(e.target.value)||1)} style={inputSm} /></div>
                <div><label style={labelSm}>Soft costs (% sobre constr.)</label><input type="number" value={softCostsPct} onChange={e => setSoftCostsPct(parseFloat(e.target.value)||0)} step={0.5} style={inputSm} /></div>
                <div><label style={labelSm}>Costo financiero anual (%)</label><input type="number" value={financPct} onChange={e => setFinancPct(parseFloat(e.target.value)||0)} step={0.5} style={inputSm} /></div>
                <div><label style={labelSm}>Honorarios comercialización (%)</label><input type="number" value={comercPct} onChange={e => setComercPct(parseFloat(e.target.value)||0)} step={0.25} style={inputSm} /></div>
                <div><label style={labelSm}>Impuesto a la ganancia (%)</label><input type="number" value={impuestoGan} onChange={e => setImpuestoGan(parseFloat(e.target.value)||0)} step={1} style={inputSm} /></div>
              </div>
              <div style={{ marginTop: 10, padding: "8px 10px", background: "#0a0a0a", borderRadius: 6, fontSize: 11, color: "#6b7280" }}>
                FOS: {calcs.fos.toFixed(2)}x · {calcs.totalM2Construido}m² · {calcs.totalUnidades} unidades
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Agregar tipo de unidad</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.keys(TIPO_DEFAULTS).map(tipo => (
                  <button key={tipo} onClick={() => addUnidad(tipo)}
                    style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif" }}>
                    + {tipo}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Panel derecho */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Tabla de unidades */}
            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>Unidades del proyecto</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Tipo", "Cant.", "m²/u", "USD/m² venta", "USD/m² constr.", "Total m²", "Ingresos", "Costo constr.", ""].map(h => (
                        <th key={h} style={{ padding: "5px 8px", textAlign: h === "Tipo" ? "left" : "right", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unidades.map(u => {
                      const c = calcs.unidadesCalc.find(x => x.id === u.id);
                      return (
                        <tr key={u.id} style={{ borderBottom: "1px solid #111" }}>
                          <td style={{ padding: "6px 8px", fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#fff", whiteSpace: "nowrap" }}>{u.tipo}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>
                            <input type="number" min={1} value={u.cantidad} onChange={e => updUnidad(u.id, "cantidad", parseInt(e.target.value)||1)}
                              style={{ ...inputSm, width: 50, textAlign: "right" }} />
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>
                            <input type="number" min={1} value={u.m2} onChange={e => updUnidad(u.id, "m2", parseFloat(e.target.value)||1)}
                              style={{ ...inputSm, width: 60, textAlign: "right" }} />
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>
                            <input type="number" min={0} value={u.precioM2Venta} onChange={e => updUnidad(u.id, "precioM2Venta", parseFloat(e.target.value)||0)}
                              style={{ ...inputSm, width: 80, textAlign: "right" }} />
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>
                            <input type="number" min={0} value={u.costoConstrM2} onChange={e => updUnidad(u.id, "costoConstrM2", parseFloat(e.target.value)||0)}
                              style={{ ...inputSm, width: 80, textAlign: "right" }} />
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "#9ca3af" }}>{c?.totalM2}m²</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "#22c55e", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>{usd(c?.ingresos ?? 0)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "#cc0000" }}>{usd(c?.costoConstr ?? 0)}</td>
                          <td style={{ padding: "6px 8px" }}>
                            <button onClick={() => delUnidad(u.id)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: "2px solid #1f2937" }}>
                      <td colSpan={5} style={{ padding: "8px", fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 12, color: "#fff" }}>TOTAL</td>
                      <td style={{ padding: "8px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{calcs.totalM2Construido}m²</td>
                      <td style={{ padding: "8px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#22c55e" }}>{usd(calcs.totalIngresos)}</td>
                      <td style={{ padding: "8px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>{usd(calcs.totalCostoConstr)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabs análisis */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1f2937" }}>
              {(["resumen", "costos", "ingresos"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  style={{ padding: "8px 18px", background: "none", border: "none", borderBottom: `2px solid ${activeTab === t ? "#cc0000" : "transparent"}`, color: activeTab === t ? "#fff" : "#6b7280", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                  {t}
                </button>
              ))}
            </div>

            {activeTab === "resumen" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={cardStyle}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#6b7280", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Waterfall financiero</div>
                  {[
                    { label: "Ingresos totales venta", value: calcs.totalIngresos, color: "#22c55e", positive: true },
                    { label: `Comercialización (${comercPct}%)`, value: -calcs.costoComercializacion, color: "#cc0000", positive: false },
                    { label: "Ingresos netos", value: calcs.ingresosNetos, color: "#22c55e", positive: true, bold: true },
                    { label: "Terreno", value: -costoTerreno, color: "#f97316", positive: false },
                    { label: "Construcción", value: -calcs.totalCostoConstr, color: "#f97316", positive: false },
                    { label: `Soft costs (${softCostsPct}%)`, value: -calcs.softCosts, color: "#f97316", positive: false },
                    { label: "Costo financiero", value: -calcs.costoFinancieroBase, color: "#f97316", positive: false },
                    { label: "Ganancia bruta", value: calcs.ganBruta, color: calcs.ganBruta > 0 ? "#22c55e" : "#cc0000", positive: calcs.ganBruta > 0, bold: true },
                    { label: `Impuesto ganancias (${impuestoGan}%)`, value: -calcs.impuesto, color: "#cc0000", positive: false },
                    { label: "GANANCIA NETA", value: calcs.ganNeta, color: calcs.ganNeta > 0 ? "#22c55e" : "#cc0000", positive: calcs.ganNeta > 0, bold: true, big: true },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #111", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: row.bold ? "#e5e5e5" : "#9ca3af", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: row.big ? 18 : 13, color: row.color }}>
                        {row.positive ? "+" : ""}{usd(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Precio m² promedio", value: usd(calcs.precioM2prom), color: "#22c55e" },
                    { label: "Costo m² total", value: usd(calcs.costoM2), color: "#f97316" },
                    { label: "Spread m²", value: usd(calcs.precioM2prom - calcs.costoM2), color: calcs.precioM2prom > calcs.costoM2 ? "#22c55e" : "#cc0000" },
                  ].map(k => (
                    <div key={k.label} style={{ ...cardStyle, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{k.label}</div>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: k.color, marginTop: 4 }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "costos" && (
              <div style={cardStyle}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#6b7280", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Estructura de costos</div>
                {[
                  { label: "Terreno", value: costoTerreno },
                  { label: "Construcción", value: calcs.totalCostoConstr },
                  { label: `Soft costs (${softCostsPct}%)`, value: calcs.softCosts },
                  { label: "Costo financiero", value: calcs.costoFinancieroBase },
                ].map(c => {
                  const pctVal = calcs.costoTotalSinImp > 0 ? (c.value / calcs.costoTotalSinImp) * 100 : 0;
                  return (
                    <div key={c.label} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#9ca3af" }}>{c.label}</span>
                        <span style={{ color: "#e5e5e5", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{usd(c.value)} <span style={{ color: "#6b7280", fontSize: 10 }}>({pctVal.toFixed(1)}%)</span></span>
                      </div>
                      <div style={{ background: "#0a0a0a", borderRadius: 4, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${pctVal}%`, height: "100%", background: "#cc0000" }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #1f2937", display: "flex", justifyContent: "space-between", fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
                  <span style={{ color: "#e5e5e5" }}>TOTAL COSTOS</span>
                  <span style={{ color: "#cc0000" }}>{usd(calcs.costoTotalSinImp)}</span>
                </div>
              </div>
            )}

            {activeTab === "ingresos" && (
              <div style={cardStyle}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#6b7280", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Ingresos por tipo de unidad</div>
                {calcs.unidadesCalc.map(u => {
                  const pctVal = calcs.totalIngresos > 0 ? (u.ingresos / calcs.totalIngresos) * 100 : 0;
                  const margenU = u.ingresos > 0 ? ((u.ingresos - u.costoConstr) / u.ingresos) * 100 : 0;
                  return (
                    <div key={u.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#9ca3af" }}>{u.tipo} ×{u.cantidad}</span>
                        <span style={{ color: "#22c55e", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{usd(u.ingresos)} <span style={{ color: margenU > 0 ? "#22c55e" : "#cc0000", fontSize: 10 }}>({margenU.toFixed(0)}% margen)</span></span>
                      </div>
                      <div style={{ background: "#0a0a0a", borderRadius: 4, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${pctVal}%`, height: "100%", background: "#22c55e" }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #1f2937", display: "flex", justifyContent: "space-between", fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
                  <span style={{ color: "#e5e5e5" }}>TOTAL INGRESOS</span>
                  <span style={{ color: "#22c55e" }}>{usd(calcs.totalIngresos)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
