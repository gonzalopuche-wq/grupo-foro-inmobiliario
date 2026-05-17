"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface Deduccion {
  id: string;
  label: string;
  tipo: "pct_renta" | "fijo_mensual" | "pct_valor";
  valor: number;
  activo: boolean;
  categoria: "impuesto" | "operativo" | "financiero";
  descripcion: string;
}

const DEDUCCIONES_DEFAULT: Deduccion[] = [
  { id: "ib",       label: "Ingresos Brutos",         tipo: "pct_renta",    valor: 3.5,  activo: true,  categoria: "impuesto",   descripcion: "Varía según provincia (CABA 3.5%, BA 3%)" },
  { id: "ganancias",label: "Impuesto a las Ganancias", tipo: "pct_renta",    valor: 7.0,  activo: true,  categoria: "impuesto",   descripcion: "Tasa efectiva sobre renta (escalonado)" },
  { id: "bp",       label: "Bienes Personales",        tipo: "pct_valor",    valor: 0.25, activo: true,  categoria: "impuesto",   descripcion: "0.25% sobre valor del inmueble/año" },
  { id: "vacancia",  label: "Vacancia estimada",        tipo: "pct_renta",    valor: 5.0,  activo: true,  categoria: "operativo",  descripcion: "% del ingreso anual perdido por vacancia" },
  { id: "expensas", label: "Expensas a cargo propietario", tipo: "fijo_mensual", valor: 30000, activo: true, categoria: "operativo", descripcion: "ARS/mes de expensas ordinarias" },
  { id: "admin",    label: "Administración / inmobiliaria", tipo: "pct_renta", valor: 5.0, activo: true, categoria: "operativo",  descripcion: "% del alquiler como honorario de gestión" },
  { id: "mantenimiento", label: "Mantenimiento / reparaciones", tipo: "pct_valor", valor: 0.5, activo: true, categoria: "operativo", descripcion: "0.5% del valor anual (refacciones, pintura)" },
  { id: "seguro",   label: "Seguro de incendio / RC",  tipo: "pct_valor",    valor: 0.12, activo: true,  categoria: "operativo",  descripcion: "Prima anual aprox. (ver calc. seguro hogar)" },
  { id: "impuesto_inmueble", label: "Impuesto inmobiliario", tipo: "pct_valor", valor: 0.20, activo: true, categoria: "impuesto", descripcion: "ABL / impuesto inmobiliario provincial" },
  { id: "servicios",label: "Servicios a cargo",        tipo: "fijo_mensual", valor: 0,    activo: false, categoria: "operativo",  descripcion: "Si incluís servicios en el precio" },
  { id: "amortizacion", label: "Amortización fiscal",   tipo: "pct_valor",    valor: 0.20, activo: true,  categoria: "financiero", descripcion: "Deducción fiscal: 2% x 10 años del 80% del valor edificio" },
];

export default function RentaNetaPage() {
  const [valorPropUSD, setValorPropUSD] = useState(80000);
  const [alquilerMensualARS, setAlquilerMensualARS] = useState(400000);
  const [tc, setTc] = useState(1300);
  const [deducciones, setDeducciones] = useState<Deduccion[]>(DEDUCCIONES_DEFAULT);

  const updDed = (id: string, cambios: Partial<Deduccion>) =>
    setDeducciones(prev => prev.map(d => d.id === id ? { ...d, ...cambios } : d));

  const calcs = useMemo(() => {
    const valorPropARS = valorPropUSD * tc;
    const rentaBrutaAnualARS = alquilerMensualARS * 12;
    const rentaBrutaPct = valorPropARS > 0 ? (rentaBrutaAnualARS / valorPropARS) * 100 : 0;

    // Calcular cada deducción en ARS/año
    const detallesDed = deducciones
      .filter(d => d.activo)
      .map(d => {
        let montoARS = 0;
        if (d.tipo === "pct_renta")    montoARS = rentaBrutaAnualARS * (d.valor / 100);
        else if (d.tipo === "fijo_mensual") montoARS = d.valor * 12;
        else if (d.tipo === "pct_valor")    montoARS = valorPropARS * (d.valor / 100);
        return { ...d, montoARS };
      });

    const totalDedARS = detallesDed.reduce((s, d) => s + d.montoARS, 0);
    const rentaNetaAnualARS = rentaBrutaAnualARS - totalDedARS;
    const rentaNetaPct = valorPropARS > 0 ? (rentaNetaAnualARS / valorPropARS) * 100 : 0;
    const rentaNetaMensualARS = rentaNetaAnualARS / 12;
    const rentaNetaUSD = rentaNetaAnualARS / tc;

    // Por categoría
    const porCategoria: Record<string, number> = {};
    detallesDed.forEach(d => {
      porCategoria[d.categoria] = (porCategoria[d.categoria] ?? 0) + d.montoARS;
    });

    // Payback (años para recuperar la inversión a renta neta)
    const payback = rentaNetaAnualARS > 0 ? valorPropARS / rentaNetaAnualARS : 0;

    return {
      valorPropARS, rentaBrutaAnualARS, rentaBrutaPct,
      detallesDed, totalDedARS, rentaNetaAnualARS, rentaNetaPct,
      rentaNetaMensualARS, rentaNetaUSD, porCategoria, payback,
    };
  }, [valorPropUSD, alquilerMensualARS, tc, deducciones]);

  const CAT_COLORS: Record<string, string> = {
    impuesto:   "#cc0000",
    operativo:  "#f97316",
    financiero: "#3b82f6",
  };

  const CAT_LABELS: Record<string, string> = {
    impuesto:   "Impuestos",
    operativo:  "Costos operativos",
    financiero: "Financiero / fiscal",
  };

  const maxDed = Math.max(...calcs.detallesDed.map(d => d.montoARS), 1);

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Análisis Renta Neta</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:700px;margin:0 auto}
    h1{font-size:20px;font-weight:800}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:12px 0}
    .kpi{background:#f5f5f5;border-radius:6px;padding:10px}
    .kpi-l{font-size:10px;color:#666}
    .kpi-v{font-size:18px;font-weight:800}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
    th{background:#111;color:#fff;padding:7px 10px;text-align:left}
    td{padding:7px 10px;border-bottom:1px solid #eee}
    </style></head><body>
    <h1>Análisis de Renta Neta</h1>
    <p>Propiedad USD ${fmt(valorPropUSD)} · Alquiler ARS ${fmt(Math.round(alquilerMensualARS / 1000))}k/mes · ${new Date().toLocaleDateString("es-AR")}</p>
    <div class="grid">
      <div class="kpi"><div class="kpi-l">Renta bruta</div><div class="kpi-v">${calcs.rentaBrutaPct.toFixed(2)}%</div></div>
      <div class="kpi"><div class="kpi-l">Renta neta</div><div class="kpi-v" style="color:#cc0000">${calcs.rentaNetaPct.toFixed(2)}%</div></div>
      <div class="kpi"><div class="kpi-l">Payback</div><div class="kpi-v">${calcs.payback.toFixed(1)} años</div></div>
    </div>
    <table>
      <thead><tr><th>Deducción</th><th>Tipo</th><th>ARS/año</th><th>% de renta</th></tr></thead>
      <tbody>
        ${calcs.detallesDed.map(d => `<tr><td>${d.label}</td><td>${d.categoria}</td><td>ARS ${fmt(Math.round(d.montoARS / 1000))}k</td><td>${calcs.rentaBrutaAnualARS > 0 ? ((d.montoARS / calcs.rentaBrutaAnualARS) * 100).toFixed(1) : 0}%</td></tr>`).join("")}
        <tr style="font-weight:800"><td colspan="2">TOTAL DEDUCCIONES</td><td>ARS ${fmt(Math.round(calcs.totalDedARS / 1000))}k</td><td>${calcs.rentaBrutaAnualARS > 0 ? ((calcs.totalDedARS / calcs.rentaBrutaAnualARS) * 100).toFixed(1) : 0}%</td></tr>
        <tr style="font-weight:800;background:#f0fff0"><td colspan="2">RENTA NETA ANUAL</td><td>ARS ${fmt(Math.round(calcs.rentaNetaAnualARS / 1000))}k</td><td>${calcs.rentaNetaPct.toFixed(2)}%</td></tr>
      </tbody>
    </table>
    <p style="font-size:10px;color:#999;margin-top:16px">Calculado con GFI® Grupo Foro Inmobiliario</p>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>📊 Renta Bruta → Neta</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Rendimiento real después de impuestos, gastos y vacancia</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={exportarPDF}
              style={{ background: "#cc0000", border: "none", borderRadius: 7, color: "#fff", padding: "7px 14px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
              🖨️ PDF
            </button>
            <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center" }}>← Calculadoras</Link>
          </div>
        </div>

        {/* KPIs principales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Renta bruta anual", value: `${calcs.rentaBrutaPct.toFixed(2)}%`, color: "#e5e5e5" },
            { label: "Total deducciones", value: `ARS ${fmt(Math.round(calcs.totalDedARS / 1000))}k/año`, color: "#cc0000" },
            { label: "Renta neta anual", value: `${calcs.rentaNetaPct.toFixed(2)}%`, color: calcs.rentaNetaPct >= 4 ? "#22c55e" : calcs.rentaNetaPct >= 2 ? "#f97316" : "#cc0000" },
            { label: "Ingreso neto/mes", value: `ARS ${fmt(Math.round(calcs.rentaNetaMensualARS / 1000))}k`, color: "#3b82f6" },
            { label: "Payback", value: `${calcs.payback.toFixed(1)} años`, color: "#9ca3af" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 17, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Datos base</div>
              {[
                { label: "Valor propiedad (USD)", value: valorPropUSD, set: setValorPropUSD, step: 5000 },
                { label: "Alquiler mensual (ARS)", value: alquilerMensualARS, set: setAlquilerMensualARS, step: 20000 },
                { label: "TC ARS/USD", value: tc, set: setTc, step: 50 },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>{f.label}</label>
                  <input type="number" value={f.value} step={f.step}
                    onChange={e => f.set(parseFloat(e.target.value) || 0)}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>

            {/* Resumen por categoría */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Por categoría</div>
              {Object.entries(calcs.porCategoria).map(([cat, val]) => (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: CAT_COLORS[cat] }}>{CAT_LABELS[cat]}</span>
                    <span style={{ color: "#6b7280" }}>ARS {fmt(Math.round(val / 1000))}k/año</span>
                  </div>
                  <div style={{ background: "#0a0a0a", borderRadius: 3, height: 5, overflow: "hidden" }}>
                    <div style={{ width: `${calcs.totalDedARS > 0 ? (val / calcs.totalDedARS) * 100 : 0}%`, height: "100%", background: CAT_COLORS[cat] }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Waterfall visual */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Cascada</div>
              {[
                { label: "Renta bruta", monto: calcs.rentaBrutaAnualARS, color: "#e5e5e5" },
                { label: "Impuestos", monto: -(calcs.porCategoria["impuesto"] ?? 0), color: "#cc0000" },
                { label: "Operativo", monto: -(calcs.porCategoria["operativo"] ?? 0), color: "#f97316" },
                { label: "Financiero", monto: -(calcs.porCategoria["financiero"] ?? 0), color: "#3b82f6" },
                { label: "Renta neta", monto: calcs.rentaNetaAnualARS, color: calcs.rentaNetaAnualARS >= 0 ? "#22c55e" : "#cc0000" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1a1a", fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>{row.label}</span>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: row.color }}>
                    {row.monto >= 0 ? "" : "−"} ARS {fmt(Math.abs(Math.round(row.monto / 1000)))}k
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Deducciones detalle */}
          <div>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Deducciones detalladas</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deducciones.map(d => {
                  const det = calcs.detallesDed.find(x => x.id === d.id);
                  const montoARS = det?.montoARS ?? 0;
                  const pctRenta = calcs.rentaBrutaAnualARS > 0 ? (montoARS / calcs.rentaBrutaAnualARS) * 100 : 0;
                  return (
                    <div key={d.id} style={{ background: "#0a0a0a", borderRadius: 8, padding: "10px 14px", opacity: d.activo ? 1 : 0.45 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <button onClick={() => updDed(d.id, { activo: !d.activo })}
                          style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${d.activo ? CAT_COLORS[d.categoria] : "#333"}`, background: d.activo ? CAT_COLORS[d.categoria] : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
                          {d.activo && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#e5e5e5", fontWeight: 500 }}>{d.label}</div>
                          <div style={{ fontSize: 10, color: "#4b5563" }}>{d.descripcion}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input type="number" value={d.valor} step={d.tipo === "fijo_mensual" ? 5000 : 0.1} min={0}
                            onChange={e => updDed(d.id, { valor: parseFloat(e.target.value) || 0 })}
                            style={{ background: "#111", border: "1px solid #333", borderRadius: 4, color: "#e5e5e5", padding: "3px 7px", fontSize: 12, width: 80, textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }} />
                          <span style={{ fontSize: 10, color: "#6b7280", minWidth: 30 }}>
                            {d.tipo === "fijo_mensual" ? "ARS" : "%"}
                          </span>
                          {d.activo && (
                            <div style={{ textAlign: "right", minWidth: 70 }}>
                              <div style={{ fontSize: 11, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: CAT_COLORS[d.categoria] }}>
                                ARS {fmt(Math.round(montoARS / 1000))}k
                              </div>
                              <div style={{ fontSize: 9, color: "#4b5563" }}>{pctRenta.toFixed(1)}% renta</div>
                            </div>
                          )}
                        </div>
                      </div>
                      {d.activo && montoARS > 0 && (
                        <div style={{ background: "#111", borderRadius: 2, height: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min((montoARS / maxDed) * 100, 100)}%`, height: "100%", background: CAT_COLORS[d.categoria] }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1f2937", display: "flex", justifyContent: "space-between", fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>TOTAL DEDUCCIONES</div>
                  <div style={{ fontSize: 19, color: "#cc0000" }}>ARS {fmt(Math.round(calcs.totalDedARS / 1000))}k/año</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>RENTA NETA</div>
                  <div style={{ fontSize: 19, color: calcs.rentaNetaAnualARS >= 0 ? "#22c55e" : "#cc0000" }}>
                    {calcs.rentaNetaPct.toFixed(2)}% · ARS {fmt(Math.round(calcs.rentaNetaAnualARS / 1000))}k/año
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
