"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Propiedad {
  id: number;
  nombre: string;
  tipo: string;
  zona: string;
  operacion: string;
  precio: number;
  moneda: string;
  m2cubiertos: number;
  m2totales: number;
  ambientes: number;
  antiguedad: number;
  expensas: number;
  alquilerEstimado: number;
  gastosMant: number;
  apreciacion: number;
  notasExtra: string;
}

const TIPOS = ["Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Cochera"];
const MONEDAS = ["USD", "ARS"];

const EMPTY_PROP = (id: number): Propiedad => ({
  id,
  nombre: `Propiedad ${id}`,
  tipo: "Departamento",
  zona: "",
  operacion: "venta",
  precio: 0,
  moneda: "USD",
  m2cubiertos: 0,
  m2totales: 0,
  ambientes: 2,
  antiguedad: 10,
  expensas: 0,
  alquilerEstimado: 0,
  gastosMant: 0,
  apreciacion: 3,
  notasExtra: "",
});

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function scorePropiedad(p: Propiedad, tc: number): number {
  if (!p.precio || !p.m2cubiertos) return 0;
  const precioUSD = p.moneda === "ARS" ? p.precio / tc : p.precio;
  const pxm2 = precioUSD / p.m2cubiertos;

  // Score inversamente proporcional al $/m²: más barato → mejor score
  const scorePrecio = Math.max(0, 100 - pxm2 / 30);

  // Rentabilidad
  const alqUSD = p.moneda === "ARS" ? p.alquilerEstimado / tc : p.alquilerEstimado;
  const renta = alqUSD > 0 ? (alqUSD * 12 / precioUSD) * 100 : 0;
  const scoreRenta = Math.min(50, renta * 6);

  // Antigüedad (más nuevo = mejor)
  const scoreAntig = Math.max(0, 25 - p.antiguedad * 0.5);

  // Apreciación
  const scoreAprec = Math.min(25, p.apreciacion * 5);

  return Math.min(100, scorePrecio * 0.4 + scoreRenta * 0.35 + scoreAntig * 0.15 + scoreAprec * 0.1);
}

const LABEL_FIELDS: { key: keyof Propiedad; label: string; type: string; options?: string[] }[] = [
  { key: "nombre", label: "Nombre", type: "text" },
  { key: "tipo", label: "Tipo", type: "select", options: TIPOS },
  { key: "zona", label: "Zona / Barrio", type: "text" },
  { key: "operacion", label: "Operación", type: "select", options: ["venta", "alquiler"] },
  { key: "precio", label: "Precio", type: "number" },
  { key: "moneda", label: "Moneda", type: "select", options: MONEDAS },
  { key: "m2cubiertos", label: "M² cubiertos", type: "number" },
  { key: "m2totales", label: "M² totales", type: "number" },
  { key: "ambientes", label: "Ambientes", type: "number" },
  { key: "antiguedad", label: "Antigüedad (años)", type: "number" },
  { key: "expensas", label: "Expensas / mes ($)", type: "number" },
  { key: "alquilerEstimado", label: "Alquiler estimado / mes", type: "number" },
  { key: "gastosMant", label: "Gastos mant. / mes", type: "number" },
  { key: "apreciacion", label: "Apreciación estimada (%/año)", type: "number" },
  { key: "notasExtra", label: "Notas", type: "text" },
];

export default function ComparadorPage() {
  const [props, setProps] = useState<Propiedad[]>([EMPTY_PROP(1), EMPTY_PROP(2)]);
  const [tc, setTc] = useState(1300);

  const updateProp = (id: number, key: keyof Propiedad, value: string | number) => {
    setProps(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
  };

  const addProp = () => {
    if (props.length >= 3) return;
    setProps(prev => [...prev, EMPTY_PROP(prev.length + 1)]);
  };

  const removeProp = (id: number) => {
    setProps(prev => prev.filter(p => p.id !== id));
  };

  const analisis = useMemo(() => props.map(p => {
    const precioUSD = p.moneda === "ARS" ? p.precio / tc : p.precio;
    const precioARS = p.moneda === "USD" ? p.precio * tc : p.precio;
    const pxm2 = p.m2cubiertos > 0 ? precioUSD / p.m2cubiertos : 0;
    const pxm2Total = p.m2totales > 0 ? precioUSD / p.m2totales : 0;
    const alqUSD = p.moneda === "ARS" ? p.alquilerEstimado / tc : p.alquilerEstimado;
    const alqUSDNeto = alqUSD - (p.expensas + p.gastosMant) / tc;
    const rentaBruta = precioUSD > 0 && alqUSD > 0 ? (alqUSD * 12 / precioUSD) * 100 : 0;
    const rentaNeta = precioUSD > 0 && alqUSDNeto > 0 ? (alqUSDNeto * 12 / precioUSD) * 100 : 0;
    const payback = rentaNeta > 0 ? 100 / rentaNeta : null;
    const score = scorePropiedad(p, tc);
    // Valor futuro con apreciación en 5 años
    const valor5y = precioUSD * Math.pow(1 + p.apreciacion / 100, 5);
    return { p, precioUSD, precioARS, pxm2, pxm2Total, alqUSD, alqUSDNeto, rentaBruta, rentaNeta, payback, score, valor5y };
  }), [props, tc]);

  const mejor = useMemo(() => {
    if (analisis.length === 0) return null;
    return analisis.reduce((a, b) => a.score > b.score ? a : b).p.id;
  }, [analisis]);

  const colores = ["#990000", "#3b82f6", "#3abab6"];

  const input = (p: Propiedad, field: typeof LABEL_FIELDS[number]) => {
    const val = p[field.key];
    const style = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const };
    if (field.type === "select") {
      return (
        <select value={val as string} onChange={e => updateProp(p.id, field.key, e.target.value)} style={style}>
          {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input
        type={field.type}
        value={val as string | number}
        onChange={e => updateProp(p.id, field.key, field.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
        style={style}
      />
    );
  };

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const filas = analisis.map((a, i) => `
      <td style="padding:8px;border:1px solid #ddd;text-align:center">
        <strong>${a.p.nombre}</strong><br/>
        ${a.p.tipo} · ${a.p.zona}<br/>
        USD ${fmt(a.precioUSD)} · ${a.p.m2cubiertos}m²<br/>
        USD ${fmt(a.pxm2, 0)}/m² | ${a.rentaBruta.toFixed(1)}% bruta<br/>
        Score: <strong>${a.score.toFixed(0)}/100</strong>${a.p.id === mejor ? " ★" : ""}
      </td>`).join("");
    win.document.write(`<html><body style="font-family:sans-serif;padding:24px">
      <h2>Comparador de Propiedades</h2>
      <table style="width:100%;border-collapse:collapse"><tr>${filas}</tr></table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🏘️ Comparador de Propiedades
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Compará hasta 3 propiedades lado a lado</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* Config TC */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: "#9ca3af" }}>TC USD/ARS:</label>
          <input type="number" value={tc} onChange={e => setTc(parseFloat(e.target.value) || 1)}
            style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: 100 }} />
          {props.length < 3 && (
            <button onClick={addProp}
              style={{ background: "#99000022", color: "#990000", border: "1px solid #99000044", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>
              + Agregar propiedad
            </button>
          )}
          <button onClick={exportarPDF}
            style={{ background: "#1f2937", color: "#e5e5e5", border: "1px solid #374151", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", marginLeft: "auto" }}>
            📄 Exportar PDF
          </button>
        </div>

        {/* Formularios en columnas */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${props.length}, 1fr)`, gap: 16, marginBottom: 28 }}>
          {props.map((p, i) => (
            <div key={p.id} style={{ background: "#111", border: `1px solid ${colores[i]}44`, borderTop: `3px solid ${colores[i]}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: colores[i] }}>{p.nombre}</span>
                {props.length > 2 && (
                  <button onClick={() => removeProp(p.id)}
                    style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16 }}>✕</button>
                )}
              </div>
              {LABEL_FIELDS.map(f => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3, fontWeight: 600 }}>{f.label}</div>
                  {input(p, f)}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Tabla comparativa de resultados */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>📊 Análisis Comparativo</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#161616" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #1f2937" }}>Indicador</th>
                  {analisis.map((a, i) => (
                    <th key={a.p.id} style={{ padding: "10px 16px", textAlign: "right", color: colores[i], fontWeight: 700, borderBottom: "1px solid #1f2937", borderLeft: "1px solid #1f2937" }}>
                      {a.p.nombre}
                      {a.p.id === mejor && <span style={{ marginLeft: 6, color: "#d4960c" }}>★</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Precio USD", render: (a: typeof analisis[number]) => `USD ${fmt(a.precioUSD)}` },
                  { label: "Precio ARS", render: (a: typeof analisis[number]) => `$ ${fmt(a.precioARS)}` },
                  { label: "USD/m² cubierto", render: (a: typeof analisis[number]) => a.pxm2 > 0 ? `USD ${fmt(a.pxm2, 0)}` : "—" },
                  { label: "USD/m² total", render: (a: typeof analisis[number]) => a.pxm2Total > 0 ? `USD ${fmt(a.pxm2Total, 0)}` : "—" },
                  { label: "Renta bruta anual", render: (a: typeof analisis[number]) => a.rentaBruta > 0 ? `${a.rentaBruta.toFixed(2)}%` : "—" },
                  { label: "Renta neta anual", render: (a: typeof analisis[number]) => a.rentaNeta > 0 ? `${a.rentaNeta.toFixed(2)}%` : "—" },
                  { label: "Payback", render: (a: typeof analisis[number]) => a.payback ? `${a.payback.toFixed(1)} años` : "—" },
                  { label: "Valor estimado 5 años", render: (a: typeof analisis[number]) => `USD ${fmt(a.valor5y)}` },
                  { label: "Score inversión", render: (a: typeof analisis[number]) => `${a.score.toFixed(0)}/100` },
                ].map((row, ri) => (
                  <tr key={row.label} style={{ background: ri % 2 === 0 ? "#0f0f0f" : "#111" }}>
                    <td style={{ padding: "9px 16px", color: "#9ca3af", borderBottom: "1px solid #1f2937" }}>{row.label}</td>
                    {analisis.map((a, ci) => {
                      const val = row.render(a);
                      const isScore = row.label === "Score inversión";
                      const isBest = isScore && a.p.id === mejor;
                      return (
                        <td key={a.p.id} style={{ padding: "9px 16px", textAlign: "right", color: isBest ? "#3abab6" : "#e5e5e5", fontWeight: isBest ? 700 : 400, borderBottom: "1px solid #1f2937", borderLeft: "1px solid #1f2937" }}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Score visual */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${props.length}, 1fr)`, gap: 16, marginBottom: 24 }}>
          {analisis.map((a, i) => {
            const sc = a.score;
            const label = sc >= 70 ? "Muy buena" : sc >= 50 ? "Buena" : sc >= 30 ? "Regular" : "Baja";
            const col = sc >= 70 ? "#3abab6" : sc >= 50 ? "#3b82f6" : sc >= 30 ? "#d4960c" : "#990000";
            return (
              <div key={a.p.id} style={{ background: "#111", border: `1px solid ${colores[i]}33`, borderRadius: 12, padding: 20, textAlign: "center" }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: colores[i], marginBottom: 8 }}>{a.p.nombre}</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: col }}>{sc.toFixed(0)}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>/ 100 pts · {label}</div>
                <div style={{ background: "#1a1a1a", borderRadius: 8, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${sc}%`, height: "100%", background: col, transition: "width 0.5s" }} />
                </div>
                {a.p.id === mejor && (
                  <div style={{ marginTop: 10, color: "#d4960c", fontWeight: 700, fontSize: 12 }}>★ Mejor opción</div>
                )}
                {a.rentaBruta > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
                    Renta: <span style={{ color: "#3abab6", fontWeight: 600 }}>{a.rentaBruta.toFixed(1)}%</span> bruta / <span style={{ color: "#3b82f6", fontWeight: 600 }}>{a.rentaNeta.toFixed(1)}%</span> neta
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Nota metodología */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
          <strong style={{ color: "#9ca3af" }}>Score:</strong> Precio/m² relativo (40%) + Rentabilidad neta (35%) + Antigüedad (15%) + Apreciación proyectada (10%).
          La "Mejor opción" (★) maximiza el puntaje ponderado. No constituye asesoramiento de inversión.
        </div>
      </div>
    </div>
  );
}
