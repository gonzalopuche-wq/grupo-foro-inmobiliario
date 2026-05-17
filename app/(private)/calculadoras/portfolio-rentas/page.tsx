"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface PropAlq {
  id: number;
  nombre: string;
  tipo: string;
  zona: string;
  valorUSD: number;
  alqMensualUSD: number;
  vacancia: number;   // %
  opexPct: number;    // % del ingreso bruto
  apreciacion: number; // %/año
  deudaUSD: number;   // hipoteca pendiente
  cuotaMensualUSD: number; // cuota hipoteca
}

let nid = 1;

function emptyProp(): PropAlq {
  return { id: nid++, nombre: "", tipo: "Departamento", zona: "", valorUSD: 0, alqMensualUSD: 0, vacancia: 8, opexPct: 15, apreciacion: 5, deudaUSD: 0, cuotaMensualUSD: 0 };
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const TIPOS = ["Departamento", "Casa", "PH", "Local", "Oficina", "Cochera", "Terreno"];

export default function PortfolioRentasPage() {
  const [props, setProps] = useState<PropAlq[]>([emptyProp(), emptyProp()]);
  const [horizonte, setHorizonte] = useState(5);

  const add = () => setProps(p => [...p, emptyProp()]);
  const remove = (id: number) => setProps(p => p.filter(x => x.id !== id));
  const upd = (id: number, key: keyof PropAlq, val: string | number) =>
    setProps(p => p.map(x => x.id === id ? { ...x, [key]: val } : x));

  const analisis = useMemo(() => props.map(p => {
    const ingresosBrutos = p.alqMensualUSD * 12 * (1 - p.vacancia / 100);
    const opex = ingresosBrutos * p.opexPct / 100;
    const noi = ingresosBrutos - opex;
    const servDeuda = p.cuotaMensualUSD * 12;
    const cashFlow = noi - servDeuda;
    const rentaBruta = p.valorUSD > 0 ? (p.alqMensualUSD * 12 / p.valorUSD) * 100 : 0;
    const rentaNeta = p.valorUSD > 0 ? (noi / p.valorUSD) * 100 : 0;
    const capRate = rentaNeta;
    const equidad = p.valorUSD - p.deudaUSD;
    const cashOnCash = equidad > 0 ? (cashFlow / equidad) * 100 : 0;
    const payback = noi > 0 ? p.valorUSD / noi : null;
    // Valor futuro simple
    const valorFuturo = p.valorUSD * Math.pow(1 + p.apreciacion / 100, horizonte);
    const plusvalia = valorFuturo - p.valorUSD;
    const distribAcum = noi * horizonte;
    const retornoTotal = distribAcum + plusvalia;
    const roiTotal = p.valorUSD > 0 ? (retornoTotal / p.valorUSD) * 100 : 0;
    return { p, ingresosBrutos, opex, noi, servDeuda, cashFlow, rentaBruta, rentaNeta, capRate, equidad, cashOnCash, payback, valorFuturo, plusvalia, retornoTotal, roiTotal };
  }), [props, horizonte]);

  const totales = useMemo(() => ({
    valor: analisis.reduce((s, a) => s + a.p.valorUSD, 0),
    deuda: analisis.reduce((s, a) => s + a.p.deudaUSD, 0),
    noi: analisis.reduce((s, a) => s + a.noi, 0),
    cashFlow: analisis.reduce((s, a) => s + a.cashFlow, 0),
    equidad: analisis.reduce((s, a) => s + a.equidad, 0),
    valorFuturo: analisis.reduce((s, a) => s + a.valorFuturo, 0),
    retornoTotal: analisis.reduce((s, a) => s + a.retornoTotal, 0),
  }), [analisis]);

  const rentaNetaPortfolio = totales.valor > 0 ? (totales.noi / totales.valor) * 100 : 0;
  const ltvPortfolio = totales.valor > 0 ? (totales.deuda / totales.valor) * 100 : 0;

  const porTipo = useMemo(() => {
    const m: Record<string, { count: number; valor: number; noi: number }> = {};
    analisis.forEach(a => {
      const t = a.p.tipo;
      if (!m[t]) m[t] = { count: 0, valor: 0, noi: 0 };
      m[t].count++;
      m[t].valor += a.p.valorUSD;
      m[t].noi += a.noi;
    });
    return m;
  }, [analisis]);

  // SVG cashflow bar chart
  const GWID = 500;
  const GHEI = 80;
  const maxCF = Math.max(1, ...analisis.map(a => Math.abs(a.cashFlow)));

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const filas = analisis.map(a => `<tr>
      <td>${a.p.nombre || a.p.tipo}</td>
      <td>USD ${fmt(a.p.valorUSD)}</td>
      <td>${a.rentaBruta.toFixed(1)}%</td>
      <td>${a.rentaNeta.toFixed(2)}%</td>
      <td>USD ${fmt(a.cashFlow)}</td>
      <td>${a.cashOnCash.toFixed(1)}%</td>
      <td>USD ${fmt(a.retornoTotal)}</td>
    </tr>`).join("");
    win.document.write(`<html><body style="font-family:sans-serif;padding:24px;font-size:12px">
      <h2>Portfolio de Rentas — ${props.length} propiedades</h2>
      <p>Valor total: USD ${fmt(totales.valor)} · NOI total: USD ${fmt(totales.noi)} · Cash flow: USD ${fmt(totales.cashFlow)}</p>
      <p>Renta neta portafolio: ${rentaNetaPortfolio.toFixed(2)}% · LTV: ${ltvPortfolio.toFixed(1)}%</p>
      <table border="1" cellpadding="4" style="width:100%;border-collapse:collapse">
        <thead><tr><th>Propiedad</th><th>Valor</th><th>Renta bruta</th><th>Renta neta</th><th>Cash flow/año</th><th>Cash-on-cash</th><th>Retorno ${horizonte}a</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const inpStyle = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 7px", fontSize: 12, width: "100%", boxSizing: "border-box" as const };
  const lblStyle = { fontSize: 10, color: "#6b7280", fontWeight: 600 as const, display: "block" as const, marginBottom: 2 };
  const COLORES = ["#cc0000","#3b82f6","#22c55e","#f97316","#a855f7","#eab308","#06b6d4","#ec4899"];

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🏘️ Portfolio de Rentas
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>Análisis unificado de múltiples propiedades en alquiler</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/calculadoras" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
            <button onClick={exportarPDF} style={{ background: "#cc000022", color: "#cc0000", border: "1px solid #cc000044", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
          </div>
        </div>

        {/* Config */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
          <div>
            <label style={lblStyle}>Horizonte (años)</label>
            <select value={horizonte} onChange={e => setHorizonte(Number(e.target.value))}
              style={{ ...inpStyle, width: 120 }}>
              {[1,2,3,5,7,10].map(y => <option key={y} value={y}>{y} años</option>)}
            </select>
          </div>
          <button onClick={add} style={{ background: "#cc000022", color: "#cc0000", border: "1px solid #cc000044", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", marginLeft: "auto" }}>
            + Agregar propiedad
          </button>
        </div>

        {/* KPIs portafolio */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Valor Total", val: `USD ${fmt(totales.valor)}`, color: "#3b82f6" },
            { label: "Equidad Neta", val: `USD ${fmt(totales.equidad)}`, color: "#22c55e" },
            { label: "NOI Anual", val: `USD ${fmt(totales.noi)}`, color: "#a855f7" },
            { label: "Cash Flow Anual", val: `USD ${fmt(totales.cashFlow)}`, color: totales.cashFlow >= 0 ? "#22c55e" : "#cc0000" },
            { label: "Renta Neta Portf.", val: `${rentaNetaPortfolio.toFixed(2)}%`, color: "#f97316" },
            { label: `Retorno ${horizonte}a`, val: `USD ${fmt(totales.retornoTotal)}`, color: "#eab308" },
            { label: "LTV", val: `${ltvPortfolio.toFixed(0)}%`, color: ltvPortfolio > 70 ? "#cc0000" : "#6b7280" },
            { label: "Propiedades", val: props.length, color: "#9ca3af" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: `1px solid ${k.color}33`, borderRadius: 10, padding: "10px 13px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* Formularios propiedades */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
          {props.map((p, idx) => (
            <div key={p.id} style={{ background: "#111", border: `1px solid ${COLORES[idx % COLORES.length]}44`, borderTop: `3px solid ${COLORES[idx % COLORES.length]}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: COLORES[idx % COLORES.length] }}>
                  {p.nombre || `Propiedad ${idx + 1}`}
                </span>
                {props.length > 1 && (
                  <button onClick={() => remove(p.id)} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer" }}>✕</button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                {[
                  { label: "Nombre", key: "nombre" as const, type: "text" },
                  { label: "Tipo", key: "tipo" as const, type: "select" },
                  { label: "Zona", key: "zona" as const, type: "text" },
                  { label: "Valor USD", key: "valorUSD" as const, type: "number" },
                  { label: "Alquiler/mes USD", key: "alqMensualUSD" as const, type: "number" },
                  { label: "Vacancia %", key: "vacancia" as const, type: "number", step: 0.5 },
                  { label: "OpEx %", key: "opexPct" as const, type: "number", step: 0.5 },
                  { label: "Apreciación %/a", key: "apreciacion" as const, type: "number", step: 0.5 },
                  { label: "Deuda USD", key: "deudaUSD" as const, type: "number" },
                  { label: "Cuota/mes USD", key: "cuotaMensualUSD" as const, type: "number" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={lblStyle}>{f.label}</label>
                    {f.type === "select"
                      ? <select value={p[f.key] as string} onChange={e => upd(p.id, f.key, e.target.value)} style={inpStyle}>
                          {TIPOS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      : <input type={f.type} value={p[f.key] as number | string} step={(f as { step?: number }).step ?? 1}
                          onChange={e => upd(p.id, f.key, f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                          style={inpStyle} />
                    }
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tabla comparativa */}
        {analisis.some(a => a.p.valorUSD > 0) && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Análisis Comparativo</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#161616" }}>
                    {["Propiedad", "Valor", "NOI/año", "Renta bruta", "Cap Rate", "Cash flow", "Cash-on-cash", `ROI ${horizonte}a`].map(h => (
                      <th key={h} style={{ padding: "7px 12px", textAlign: "right", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #1f2937", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analisis.map((a, i) => (
                    <tr key={a.p.id} style={{ background: i % 2 === 0 ? "#0f0f0f" : "#111", borderBottom: "1px solid #111" }}>
                      <td style={{ padding: "7px 12px", color: COLORES[i % COLORES.length], fontWeight: 600 }}>{a.p.nombre || `Prop ${i+1}`}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: "#9ca3af" }}>{a.p.valorUSD > 0 ? `USD ${fmt(a.p.valorUSD)}` : "—"}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: "#e5e5e5" }}>{a.noi > 0 ? `USD ${fmt(a.noi)}` : "—"}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: a.rentaBruta > 6 ? "#22c55e" : "#f97316" }}>{a.rentaBruta > 0 ? `${a.rentaBruta.toFixed(1)}%` : "—"}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: a.capRate > 5 ? "#22c55e" : "#f97316" }}>{a.capRate > 0 ? `${a.capRate.toFixed(2)}%` : "—"}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: a.cashFlow >= 0 ? "#22c55e" : "#cc0000", fontWeight: 700 }}>{`USD ${fmt(a.cashFlow)}`}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: a.cashOnCash > 8 ? "#22c55e" : a.cashOnCash > 4 ? "#f97316" : "#cc0000" }}>{a.cashOnCash !== 0 ? `${a.cashOnCash.toFixed(1)}%` : "—"}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: "#a855f7", fontWeight: 700 }}>{a.retornoTotal > 0 ? `USD ${fmt(a.retornoTotal)}` : "—"}</td>
                    </tr>
                  ))}
                  {/* Fila total */}
                  <tr style={{ background: "#1a1a1a", borderTop: "2px solid #374151", fontWeight: 700 }}>
                    <td style={{ padding: "7px 12px", color: "#fff" }}>TOTAL PORTAFOLIO</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", color: "#3b82f6", fontWeight: 800 }}>USD {fmt(totales.valor)}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", color: "#a855f7", fontWeight: 800 }}>USD {fmt(totales.noi)}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", color: "#9ca3af" }}>—</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", color: "#f97316", fontWeight: 800 }}>{rentaNetaPortfolio.toFixed(2)}%</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", color: totales.cashFlow >= 0 ? "#22c55e" : "#cc0000", fontWeight: 800 }}>USD {fmt(totales.cashFlow)}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right" }}>—</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", color: "#eab308", fontWeight: 800 }}>USD {fmt(totales.retornoTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Diversificación por tipo */}
        {Object.keys(porTipo).length > 0 && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 14 }}>Diversificación por Tipo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(porTipo).map(([tipo, d]) => {
                const pct = totales.valor > 0 ? (d.valor / totales.valor) * 100 : 0;
                const renta = d.valor > 0 ? (d.noi / d.valor) * 100 : 0;
                return (
                  <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 100, fontSize: 12, color: "#9ca3af", textAlign: "right" }}>{tipo}</div>
                    <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 4, height: 24, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#3b82f644", display: "flex", alignItems: "center", paddingLeft: 8 }}>
                        <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>{pct.toFixed(0)}% · {d.count} prop.</span>
                      </div>
                    </div>
                    <div style={{ width: 80, fontSize: 12, color: "#22c55e", textAlign: "right" }}>{renta.toFixed(2)}% renta</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>
          Cap Rate = NOI / Valor · Cash-on-cash = Cash flow / Equidad · Cash flow = NOI − servicio deuda
        </div>
      </div>
    </div>
  );
}
