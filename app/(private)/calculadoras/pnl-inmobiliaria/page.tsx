"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Tipos ────────────────────────────────────────────────────────────────────

interface LineaItem {
  id: string;
  categoria: string;
  nombre: string;
  tipo: "ingreso" | "egreso";
  montoMensual: number;
  moneda: "USD" | "ARS";
  notas: string;
}

const ITEMS_DEFAULT: LineaItem[] = [
  // Ingresos
  { id: "i1", categoria: "Operaciones", nombre: "Honorarios ventas", tipo: "ingreso", montoMensual: 3000, moneda: "USD", notas: "" },
  { id: "i2", categoria: "Operaciones", nombre: "Honorarios alquileres", tipo: "ingreso", montoMensual: 800, moneda: "USD", notas: "" },
  { id: "i3", categoria: "Operaciones", nombre: "Administración de alquileres", tipo: "ingreso", montoMensual: 400, moneda: "USD", notas: "Comisión de gestión mensual" },
  { id: "i4", categoria: "Servicios extra", nombre: "Tasaciones pagas", tipo: "ingreso", montoMensual: 200, moneda: "USD", notas: "" },
  { id: "i5", categoria: "Servicios extra", nombre: "Otros ingresos", tipo: "ingreso", montoMensual: 0, moneda: "USD", notas: "" },
  // Egresos Fijos
  { id: "e1", categoria: "Personal", nombre: "Sueldos netos (total plantilla)", tipo: "egreso", montoMensual: 1500, moneda: "USD", notas: "" },
  { id: "e2", categoria: "Personal", nombre: "Cargas sociales (~27% bruto)", tipo: "egreso", montoMensual: 400, moneda: "USD", notas: "" },
  { id: "e3", categoria: "Personal", nombre: "Monotributo / comisiones asesores", tipo: "egreso", montoMensual: 500, moneda: "USD", notas: "Asesores independientes" },
  { id: "e4", categoria: "Oficina", nombre: "Alquiler oficina", tipo: "egreso", montoMensual: 600, moneda: "USD", notas: "" },
  { id: "e5", categoria: "Oficina", nombre: "Servicios (luz, gas, internet)", tipo: "egreso", montoMensual: 80, moneda: "USD", notas: "" },
  { id: "e6", categoria: "Oficina", nombre: "Limpieza y mantenimiento", tipo: "egreso", montoMensual: 60, moneda: "USD", notas: "" },
  { id: "e7", categoria: "Marketing", nombre: "Portales inmobiliarios", tipo: "egreso", montoMensual: 150, moneda: "USD", notas: "ZonaProp, Argenprop, ML" },
  { id: "e8", categoria: "Marketing", nombre: "Redes sociales / pauta", tipo: "egreso", montoMensual: 100, moneda: "USD", notas: "" },
  { id: "e9", categoria: "Marketing", nombre: "Materiales / carteles", tipo: "egreso", montoMensual: 40, moneda: "USD", notas: "" },
  { id: "e10", categoria: "Tecnología", nombre: "CRM / Software", tipo: "egreso", montoMensual: 50, moneda: "USD", notas: "" },
  { id: "e11", categoria: "Tecnología", nombre: "Web hosting / dominio", tipo: "egreso", montoMensual: 15, moneda: "USD", notas: "" },
  { id: "e12", categoria: "Impuestos", nombre: "IIBB mensual", tipo: "egreso", montoMensual: 300, moneda: "USD", notas: "" },
  { id: "e13", categoria: "Impuestos", nombre: "Contador (honorarios)", tipo: "egreso", montoMensual: 120, moneda: "USD", notas: "" },
  { id: "e14", categoria: "Varios", nombre: "Combustible / transporte", tipo: "egreso", montoMensual: 80, moneda: "USD", notas: "" },
  { id: "e15", categoria: "Varios", nombre: "Capacitación / cursos", tipo: "egreso", montoMensual: 30, moneda: "USD", notas: "" },
  { id: "e16", categoria: "Varios", nombre: "Imprevistos / varios", tipo: "egreso", montoMensual: 100, moneda: "USD", notas: "" },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function PnLInmobiliaria() {
  const [items, setItems] = useState<LineaItem[]>(ITEMS_DEFAULT);
  const [tcDolar, setTcDolar] = useState(1200);
  const [mesVista, setMesVista] = useState(new Date().getMonth());
  const [escenario, setEscenario] = useState<"base"|"optimista"|"pesimista">("base");

  const factorEscenario = escenario === "optimista" ? 1.3 : escenario === "pesimista" ? 0.7 : 1.0;

  function actualizarItem(id: string, campo: keyof LineaItem, valor: string | number) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [campo]: valor } : item));
  }

  const pnl = useMemo(() => {
    const ingresos = items.filter(i => i.tipo === "ingreso");
    const egresos = items.filter(i => i.tipo === "egreso");

    const totalIngresosUSD = ingresos.reduce((acc, i) => {
      const usd = i.moneda === "ARS" ? i.montoMensual / tcDolar : i.montoMensual;
      return acc + usd * (i.categoria === "Operaciones" ? factorEscenario : 1);
    }, 0);

    const totalEgresosUSD = egresos.reduce((acc, i) => {
      const usd = i.moneda === "ARS" ? i.montoMensual / tcDolar : i.montoMensual;
      return acc + usd;
    }, 0);

    const resultado = totalIngresosUSD - totalEgresosUSD;
    const margen = totalIngresosUSD > 0 ? (resultado / totalIngresosUSD) * 100 : 0;

    // Por categoría
    const porCategoria = new Map<string, { ingresos: number; egresos: number }>();
    items.forEach(i => {
      const usd = i.moneda === "ARS" ? i.montoMensual / tcDolar : i.montoMensual;
      if (!porCategoria.has(i.categoria)) porCategoria.set(i.categoria, { ingresos: 0, egresos: 0 });
      const cat = porCategoria.get(i.categoria)!;
      if (i.tipo === "ingreso") cat.ingresos += usd * (i.categoria === "Operaciones" ? factorEscenario : 1);
      else cat.egresos += usd;
    });

    // Proyección anual
    const anual = resultado * 12;
    const breakEvenVentas = totalEgresosUSD / (items.find(i => i.id === "i1")?.montoMensual ?? 1);

    return { totalIngresosUSD, totalEgresosUSD, resultado, margen, porCategoria, anual, breakEvenVentas };
  }, [items, tcDolar, factorEscenario]);

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>P&L Inmobiliaria</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:750px}h1{font-size:20px}h3{font-size:13px;margin:14px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin:10px 0}th{background:#f0f0f0;padding:6px;font-size:10px;text-align:right}th:first-child{text-align:left}td{padding:6px;border-bottom:1px solid #f5f5f5;font-size:11px;text-align:right}td:first-child{text-align:left}.total{font-weight:bold;font-size:12px;background:#f9f9f9}.verde{color:#16a34a}.rojo{color:#dc2626}</style>
    </head><body>
    <h1>P&L Inmobiliaria — ${MESES[mesVista]} · Escenario ${escenario}</h1>
    <p>TC: $${fmt(tcDolar)} ARS/USD</p>
    <h3>Ingresos</h3>
    <table><tr><th>Concepto</th><th>USD/mes</th></tr>
    ${items.filter(i => i.tipo === "ingreso").map(i => `<tr><td>${i.nombre}</td><td>USD ${fmt(i.moneda === "ARS" ? i.montoMensual / tcDolar : i.montoMensual)}</td></tr>`).join("")}
    <tr class="total"><td>TOTAL INGRESOS</td><td class="verde">USD ${fmt(pnl.totalIngresosUSD)}</td></tr>
    </table>
    <h3>Egresos</h3>
    <table><tr><th>Concepto</th><th>USD/mes</th></tr>
    ${items.filter(i => i.tipo === "egreso").map(i => `<tr><td>${i.nombre}</td><td>USD ${fmt(i.moneda === "ARS" ? i.montoMensual / tcDolar : i.montoMensual)}</td></tr>`).join("")}
    <tr class="total"><td>TOTAL EGRESOS</td><td class="rojo">USD ${fmt(pnl.totalEgresosUSD)}</td></tr>
    </table>
    <h3>Resultado</h3>
    <p><b>Resultado mensual:</b> <span class="${pnl.resultado >= 0 ? "verde" : "rojo"}">USD ${fmt(pnl.resultado)}</span></p>
    <p><b>Margen:</b> ${pnl.margen.toFixed(1)}%</p>
    <p><b>Proyección anual:</b> USD ${fmt(pnl.anual)}</p>
    <p style="font-size:10px;color:#999;margin-top:20px">Generado ${new Date().toLocaleDateString("es-AR")}. Estimaciones orientativas.</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  const categorias = Array.from(new Set(items.map(i => i.categoria)));

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← Calculadoras</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          P&amp;L Inmobiliaria
        </h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select value={mesVista} onChange={e => setMesVista(+e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "5px 8px", fontSize: 11 }}>
            {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>TC:</span>
          <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={{ width: 90, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "5px 8px", fontSize: 11 }} />
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Escenario */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["pesimista","base","optimista"] as const).map(e => (
            <button key={e} onClick={() => setEscenario(e)} style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${escenario === e ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: escenario === e ? "rgba(204,0,0,0.12)" : "transparent", color: escenario === e ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
              {e === "pesimista" ? "🔴 Pesimista (×0.7)" : e === "optimista" ? "🟢 Optimista (×1.3)" : "🟡 Base"}
            </button>
          ))}
          <button onClick={exportarPDF} style={{ marginLeft: "auto", padding: "6px 16px", borderRadius: 20, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>PDF</button>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Ingresos totales", val: `USD ${fmt(pnl.totalIngresosUSD)}`, color: "#22c55e" },
            { label: "Egresos totales", val: `USD ${fmt(pnl.totalEgresosUSD)}`, color: "#cc0000" },
            { label: `Resultado ${MESES[mesVista]}`, val: `USD ${fmt(pnl.resultado)}`, color: pnl.resultado >= 0 ? "#22c55e" : "#cc0000" },
            { label: "Margen neto", val: `${pnl.margen.toFixed(1)}%`, color: pnl.margen >= 20 ? "#22c55e" : pnl.margen >= 0 ? "#f97316" : "#cc0000" },
            { label: "Proyección anual", val: `USD ${fmt(pnl.anual)}`, color: "#a78bfa" },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 6px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{kpi.label}</p>
              <p style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          {/* Tabla editable */}
          <div>
            {categorias.map(cat => {
              const itemsCat = items.filter(i => i.categoria === cat);
              const esIngreso = itemsCat[0]?.tipo === "ingreso";
              return (
                <div key={cat} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: "10px 16px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: esIngreso ? "#22c55e" : "#cc0000", letterSpacing: "0.08em", textTransform: "uppercase" }}>{cat}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: esIngreso ? "#22c55e" : "#cc0000" }}>
                      {esIngreso ? "+" : "−"}USD {fmt(itemsCat.reduce((a, i) => a + (i.moneda === "ARS" ? i.montoMensual / tcDolar : i.montoMensual), 0))}
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {itemsCat.map((item, idx) => {
                        const usd = item.moneda === "ARS" ? item.montoMensual / tcDolar : item.montoMensual;
                        return (
                          <tr key={item.id} style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                            <td style={{ padding: "8px 16px", fontSize: 12, width: "40%" }}>{item.nombre}</td>
                            <td style={{ padding: "8px 8px", width: 120 }}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <input
                                  type="number"
                                  value={item.montoMensual}
                                  onChange={e => actualizarItem(item.id, "montoMensual", +e.target.value)}
                                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "#fff", padding: "3px 6px", fontSize: 11 }}
                                />
                                <select value={item.moneda} onChange={e => actualizarItem(item.id, "moneda", e.target.value)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: "rgba(255,255,255,0.6)", fontSize: 10, padding: "3px 2px" }}>
                                  <option value="USD">USD</option>
                                  <option value="ARS">ARS</option>
                                </select>
                              </div>
                            </td>
                            <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: esIngreso ? "#22c55e" : "#cc0000" }}>
                              USD {fmt(usd, 0)}
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "right" }}>
                              <div style={{ width: 50, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", display: "inline-block" }}>
                                <div style={{ height: "100%", width: `${Math.min(100, (usd / Math.max(pnl.totalIngresosUSD, pnl.totalEgresosUSD)) * 100 * 5)}%`, background: esIngreso ? "#22c55e" : "#cc0000", borderRadius: 2 }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Panel lateral resumen */}
          <div>
            {/* Resultado visual */}
            <div style={{ background: pnl.resultado >= 0 ? "rgba(34,197,94,0.06)" : "rgba(204,0,0,0.06)", border: `1px solid ${pnl.resultado >= 0 ? "rgba(34,197,94,0.2)" : "rgba(204,0,0,0.2)"}`, borderRadius: 12, padding: 20, marginBottom: 14 }}>
              <p style={{ margin: "0 0 4px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Resultado {MESES[mesVista]}</p>
              <p style={{ margin: 0, fontSize: 36, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: pnl.resultado >= 0 ? "#22c55e" : "#cc0000" }}>
                {pnl.resultado >= 0 ? "+" : ""}USD {fmt(pnl.resultado)}
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Margen: {pnl.margen.toFixed(1)}%</p>
            </div>

            {/* Donut-like breakdown */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 18, marginBottom: 14 }}>
              <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Por Categoría</p>
              {Array.from(pnl.porCategoria.entries()).map(([cat, data]) => {
                const esI = data.ingresos > 0;
                const monto = esI ? data.ingresos : data.egresos;
                const total = esI ? pnl.totalIngresosUSD : pnl.totalEgresosUSD;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{cat}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: esI ? "#22c55e" : "#cc0000" }}>{esI ? "+" : "−"}USD {fmt(monto)}</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${total > 0 ? (monto / total) * 100 : 0}%`, background: esI ? "#22c55e" : "#cc0000", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Break-even */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: "0 0 10px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Punto de Equilibrio</p>
              <p style={{ margin: "0 0 4px 0", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Para cubrir egresos con honorarios de venta:</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "'Montserrat',sans-serif", color: "#f97316" }}>{pnl.breakEvenVentas.toFixed(1)}× la comisión base mensual</p>
              <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                = USD {fmt(pnl.totalEgresosUSD / 1)} en egresos ÷ tarifa hon. ventas
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
