"use client";

import { useState, useMemo, useId } from "react";
import Link from "next/link";

interface Comparable {
  id: number;
  direccion: string;
  zona: string;
  tipo: string;
  precio: number;
  moneda: string;
  m2cubiertos: number;
  m2totales: number;
  ambientes: number;
  antiguedad: number;
  estado: string; // excelente/muy_bueno/bueno/regular/malo
  piso: number;
  cochera: boolean;
  piscina: boolean;
  amenities: boolean;
  mesesVenta: number; // hace cuántos meses se vendió
  ajManual: number;   // ajuste manual adicional %
}

// Ajuste por diferencia de atributo (% sobre el precio)
const AJ_ESTADO: Record<string, number> = {
  excelente: 10, muy_bueno: 5, bueno: 0, regular: -8, malo: -18,
};

function precioUSD(c: Comparable, tc: number) {
  return c.moneda === "ARS" ? c.precio / tc : c.precio;
}

function pxm2(c: Comparable, tc: number) {
  const m = c.m2cubiertos > 0 ? c.m2cubiertos : 1;
  return precioUSD(c, tc) / m;
}

function ajusteTotal(comp: Comparable, suj: typeof SUJETO_DEFAULT, tc: number): number {
  let aj = 0;
  // Estado
  aj += (AJ_ESTADO[suj.estado] - AJ_ESTADO[comp.estado]);
  // Antigüedad: cada 10 años = -3%
  aj += (comp.antiguedad - suj.antiguedad) * 0.3;
  // Piso: cada piso = +0.5%
  aj += (suj.piso - comp.piso) * 0.5;
  // Cochera: ±3%
  if (suj.cochera && !comp.cochera) aj += 3;
  if (!suj.cochera && comp.cochera) aj -= 3;
  // Piscina: ±5%
  if (suj.piscina && !comp.piscina) aj += 5;
  if (!suj.piscina && comp.piscina) aj -= 5;
  // Amenities: ±2%
  if (suj.amenities && !comp.amenities) aj += 2;
  if (!suj.amenities && comp.amenities) aj -= 2;
  // Tiempo: propiedades viejas pueden reflejar valor más bajo (deflact)
  aj -= comp.mesesVenta * 0.3;
  // Manual
  aj += comp.ajManual;
  return aj;
}

function precioAjustado(comp: Comparable, suj: typeof SUJETO_DEFAULT, tc: number): number {
  const base = precioUSD(comp, tc);
  const aj = ajusteTotal(comp, suj, tc);
  return base * (1 + aj / 100);
}

const SUJETO_DEFAULT = {
  direccion: "", tipo: "Departamento", zona: "", m2cubiertos: 60, m2totales: 60,
  ambientes: 2, antiguedad: 10, estado: "bueno", piso: 3, cochera: false, piscina: false, amenities: false,
};

const TIPOS = ["Departamento", "Casa", "PH", "Local", "Oficina", "Terreno"];
const ESTADOS = ["excelente", "muy_bueno", "bueno", "regular", "malo"];
const ESTADO_LABEL: Record<string, string> = { excelente: "Excelente", muy_bueno: "Muy bueno", bueno: "Bueno", regular: "Regular", malo: "Malo" };

let nextId = 1;

function emptyComp(): Comparable {
  return {
    id: nextId++,
    direccion: "", zona: "", tipo: "Departamento",
    precio: 0, moneda: "USD", m2cubiertos: 0, m2totales: 0,
    ambientes: 2, antiguedad: 10, estado: "bueno", piso: 1,
    cochera: false, piscina: false, amenities: false,
    mesesVenta: 0, ajManual: 0,
  };
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function ValuacionComparablesPage() {
  const [sujeto, setSujeto] = useState({ ...SUJETO_DEFAULT });
  const [comps, setComps] = useState<Comparable[]>([emptyComp(), emptyComp()]);
  const [tc, setTc] = useState(1300);
  const [ponderacion, setPonderacion] = useState<"igual" | "prox_m2">("prox_m2");

  const updateSujeto = <K extends keyof typeof SUJETO_DEFAULT>(k: K, v: typeof SUJETO_DEFAULT[K]) =>
    setSujeto(s => ({ ...s, [k]: v }));

  const updateComp = (id: number, key: keyof Comparable, value: string | number | boolean) =>
    setComps(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c));

  const addComp = () => setComps(prev => [...prev, emptyComp()]);
  const removeComp = (id: number) => setComps(prev => prev.filter(c => c.id !== id));

  const analisis = useMemo(() => {
    return comps.map(c => {
      const pUSD = precioUSD(c, tc);
      const pm2 = pxm2(c, tc);
      const aj = ajusteTotal(c, sujeto, tc);
      const pAj = precioAjustado(c, sujeto, tc);
      const pm2Aj = sujeto.m2cubiertos > 0 ? pAj / sujeto.m2cubiertos : 0;
      return { c, pUSD, pm2, aj, pAj, pm2Aj };
    }).filter(a => a.pUSD > 0);
  }, [comps, sujeto, tc]);

  const valuacion = useMemo(() => {
    if (analisis.length === 0) return null;
    const pm2s = analisis.map(a => a.pm2Aj);
    const precios = analisis.map(a => a.pAj);

    let valorPonderado: number;
    if (ponderacion === "igual") {
      valorPonderado = precios.reduce((s, p) => s + p, 0) / precios.length;
    } else {
      // Ponderar por similitud de m²
      const difM2 = analisis.map(a => Math.abs(a.c.m2cubiertos - sujeto.m2cubiertos) + 1);
      const pesos = difM2.map(d => 1 / d);
      const pesoTotal = pesos.reduce((s, p) => s + p, 0);
      valorPonderado = precios.reduce((s, p, i) => s + p * (pesos[i] / pesoTotal), 0);
    }

    const pm2Ponderado = sujeto.m2cubiertos > 0 ? valorPonderado / sujeto.m2cubiertos : 0;
    const minVal = Math.min(...precios);
    const maxVal = Math.max(...precios);
    const minPm2 = Math.min(...pm2s);
    const maxPm2 = Math.max(...pm2s);
    const mediana = [...precios].sort((a, b) => a - b)[Math.floor(precios.length / 2)];

    return { valorPonderado, pm2Ponderado, minVal, maxVal, minPm2, maxPm2, mediana, n: analisis.length };
  }, [analisis, sujeto, ponderacion]);

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const filas = analisis.map(a => `<tr>
      <td>${a.c.direccion || "Comparable"}</td>
      <td>USD ${fmt(a.pUSD)}</td>
      <td>USD ${fmt(a.pm2, 0)}/m²</td>
      <td>${a.aj.toFixed(1)}%</td>
      <td><strong>USD ${fmt(a.pAj)}</strong></td>
      <td>USD ${fmt(a.pm2Aj, 0)}/m²</td>
    </tr>`).join("");
    win.document.write(`<html><body style="font-family:sans-serif;padding:24px;font-size:12px">
      <h2>Valuación por Comparables — ${sujeto.direccion || "Propiedad Sujeto"}</h2>
      <p>${sujeto.tipo} · ${sujeto.m2cubiertos}m² · ${sujeto.ambientes} amb. · Antigüedad: ${sujeto.antiguedad} años</p>
      ${valuacion ? `<p><strong>Valor estimado: USD ${fmt(valuacion.valorPonderado)}</strong> (USD ${fmt(valuacion.pm2Ponderado, 0)}/m²)</p>
      <p>Rango: USD ${fmt(valuacion.minVal)} – USD ${fmt(valuacion.maxVal)}</p>` : ""}
      <table border="1" cellpadding="4" style="width:100%;border-collapse:collapse">
        <thead><tr><th>Comparable</th><th>Precio</th><th>$/m² orig.</th><th>Ajuste</th><th>Precio Aj.</th><th>$/m² Aj.</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const inputStyle = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 12, width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { fontSize: 10, color: "#6b7280", fontWeight: 600 as const, display: "block" as const, marginBottom: 2 };
  const selectStyle = { ...inputStyle };

  const sujAttr = (label: string, node: React.ReactNode) => (
    <div>
      <label style={labelStyle}>{label}</label>
      {node}
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🏘️ Valuación por Comparables
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
              Método de mercado — ajuste por características frente a ventas recientes
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/calculadoras" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
            <button onClick={exportarPDF}
              style={{ background: "#cc000022", color: "#cc0000", border: "1px solid #cc000044", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
              📄 PDF
            </button>
          </div>
        </div>

        {/* Config */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14, marginBottom: 24, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>TC USD/ARS</label>
            <input type="number" value={tc} onChange={e => setTc(parseFloat(e.target.value) || 1)}
              style={{ ...inputStyle, width: 100 }} />
          </div>
          <div>
            <label style={labelStyle}>Ponderación</label>
            <select value={ponderacion} onChange={e => setPonderacion(e.target.value as "igual" | "prox_m2")} style={{ ...selectStyle, width: 200 }}>
              <option value="prox_m2">Por similitud de superficie</option>
              <option value="igual">Pesos iguales</option>
            </select>
          </div>
        </div>

        {/* Propiedad sujeto */}
        <div style={{ background: "#111", border: "1px solid #cc000044", borderTop: "3px solid #cc0000", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#cc0000", marginBottom: 14 }}>
            🏠 Propiedad Sujeto (a valuar)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {sujAttr("Dirección", <input value={sujeto.direccion} onChange={e => updateSujeto("direccion", e.target.value)} style={inputStyle} placeholder="Ej: Av. Corrientes 1234" />)}
            {sujAttr("Tipo", <select value={sujeto.tipo} onChange={e => updateSujeto("tipo", e.target.value)} style={selectStyle}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>)}
            {sujAttr("Zona", <input value={sujeto.zona} onChange={e => updateSujeto("zona", e.target.value)} style={inputStyle} />)}
            {sujAttr("M² cubiertos", <input type="number" value={sujeto.m2cubiertos} onChange={e => updateSujeto("m2cubiertos", parseFloat(e.target.value) || 0)} style={inputStyle} />)}
            {sujAttr("M² totales", <input type="number" value={sujeto.m2totales} onChange={e => updateSujeto("m2totales", parseFloat(e.target.value) || 0)} style={inputStyle} />)}
            {sujAttr("Ambientes", <input type="number" value={sujeto.ambientes} onChange={e => updateSujeto("ambientes", parseInt(e.target.value) || 1)} style={inputStyle} />)}
            {sujAttr("Antigüedad (años)", <input type="number" value={sujeto.antiguedad} onChange={e => updateSujeto("antiguedad", parseInt(e.target.value) || 0)} style={inputStyle} />)}
            {sujAttr("Estado", <select value={sujeto.estado} onChange={e => updateSujeto("estado", e.target.value)} style={selectStyle}>{ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}</select>)}
            {sujAttr("Piso", <input type="number" value={sujeto.piso} onChange={e => updateSujeto("piso", parseInt(e.target.value) || 0)} style={inputStyle} />)}
            {sujAttr("Cochera", <select value={sujeto.cochera ? "si" : "no"} onChange={e => updateSujeto("cochera", e.target.value === "si")} style={selectStyle}><option value="si">Sí</option><option value="no">No</option></select>)}
            {sujAttr("Piscina", <select value={sujeto.piscina ? "si" : "no"} onChange={e => updateSujeto("piscina", e.target.value === "si")} style={selectStyle}><option value="si">Sí</option><option value="no">No</option></select>)}
            {sujAttr("Amenities", <select value={sujeto.amenities ? "si" : "no"} onChange={e => updateSujeto("amenities", e.target.value === "si")} style={selectStyle}><option value="si">Sí</option><option value="no">No</option></select>)}
          </div>
        </div>

        {/* Comparables */}
        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 12 }}>
          Ventas Comparables ({comps.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          {comps.map((c, idx) => (
            <div key={c.id} style={{ background: "#111", border: "1px solid #1f2937", borderTop: `3px solid ${["#3b82f6","#22c55e","#a855f7","#f97316","#eab308"][idx % 5]}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: ["#3b82f6","#22c55e","#a855f7","#f97316","#eab308"][idx % 5] }}>Comparable {idx + 1}</span>
                {comps.length > 1 && (
                  <button onClick={() => removeComp(c.id)}
                    style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer" }}>✕</button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                <div><label style={labelStyle}>Dirección</label><input value={c.direccion} onChange={e => updateComp(c.id, "direccion", e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Zona</label><input value={c.zona} onChange={e => updateComp(c.id, "zona", e.target.value)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Precio</label><input type="number" value={c.precio} onChange={e => updateComp(c.id, "precio", parseFloat(e.target.value) || 0)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Moneda</label><select value={c.moneda} onChange={e => updateComp(c.id, "moneda", e.target.value)} style={selectStyle}><option>USD</option><option>ARS</option></select></div>
                <div><label style={labelStyle}>M² cubiertos</label><input type="number" value={c.m2cubiertos} onChange={e => updateComp(c.id, "m2cubiertos", parseFloat(e.target.value) || 0)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Ambientes</label><input type="number" value={c.ambientes} onChange={e => updateComp(c.id, "ambientes", parseInt(e.target.value) || 1)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Antigüedad (años)</label><input type="number" value={c.antiguedad} onChange={e => updateComp(c.id, "antiguedad", parseInt(e.target.value) || 0)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Estado</label><select value={c.estado} onChange={e => updateComp(c.id, "estado", e.target.value)} style={selectStyle}>{ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}</select></div>
                <div><label style={labelStyle}>Piso</label><input type="number" value={c.piso} onChange={e => updateComp(c.id, "piso", parseInt(e.target.value) || 0)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Cochera</label><select value={c.cochera ? "si" : "no"} onChange={e => updateComp(c.id, "cochera", e.target.value === "si")} style={selectStyle}><option value="si">Sí</option><option value="no">No</option></select></div>
                <div><label style={labelStyle}>Meses desde venta</label><input type="number" value={c.mesesVenta} onChange={e => updateComp(c.id, "mesesVenta", parseInt(e.target.value) || 0)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Ajuste manual (%)</label><input type="number" value={c.ajManual} onChange={e => updateComp(c.id, "ajManual", parseFloat(e.target.value) || 0)} style={inputStyle} step={0.5} /></div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={addComp}
          style={{ background: "#111", border: "1px solid #333", borderRadius: 8, color: "#9ca3af", padding: "8px 18px", fontSize: 13, cursor: "pointer", marginBottom: 28 }}>
          + Agregar comparable
        </button>

        {/* Tabla de ajustes */}
        {analisis.length > 0 && (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Cuadrícula de Ajustes</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#161616" }}>
                    {["Comparable", "Precio orig.", "USD/m² orig.", "Ajuste total", "Precio ajustado", "USD/m² aj."].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #1f2937", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analisis.map((a, i) => (
                    <tr key={a.c.id} style={{ background: i % 2 === 0 ? "#0f0f0f" : "#111", borderBottom: "1px solid #111" }}>
                      <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{a.c.direccion || `Comp ${i + 1}`}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#e5e5e5" }}>USD {fmt(a.pUSD)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af" }}>USD {fmt(a.pm2, 0)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: a.aj >= 0 ? "#22c55e" : "#cc0000", fontWeight: 600 }}>
                        {a.aj >= 0 ? "+" : ""}{a.aj.toFixed(1)}%
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#fff", fontWeight: 700 }}>USD {fmt(a.pAj)}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#3b82f6" }}>USD {fmt(a.pm2Aj, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Valuación final */}
        {valuacion && (
          <div style={{ background: "#111", border: "2px solid #cc000066", borderRadius: 14, padding: 28, marginBottom: 24 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#cc0000", marginBottom: 20 }}>
              Valuación Final — {sujeto.direccion || "Propiedad Sujeto"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Valor Estimado (ponderado)</div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#cc0000" }}>USD {fmt(valuacion.valorPonderado)}</div>
                <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>USD {fmt(valuacion.pm2Ponderado, 0)}/m²</div>
              </div>
              <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Rango de Mercado</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e5e5e5" }}>USD {fmt(valuacion.minVal)}</div>
                <div style={{ fontSize: 12, color: "#4b5563" }}>—</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e5e5e5" }}>USD {fmt(valuacion.maxVal)}</div>
              </div>
              <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Mediana</div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 22, color: "#3b82f6" }}>USD {fmt(valuacion.mediana)}</div>
              </div>
              <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Rango USD/m²</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5" }}>USD {fmt(valuacion.minPm2, 0)} – {fmt(valuacion.maxPm2, 0)}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>basado en {valuacion.n} comparable{valuacion.n !== 1 ? "s" : ""}</div>
              </div>
            </div>
          </div>
        )}

        {/* Nota */}
        <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>
          Ajustes aplicados: estado (+/-10%), antigüedad (0.3%/año), piso (0.5%/piso), cochera (±3%), piscina (±5%), amenities (±2%), tiempo de venta (-0.3%/mes).
          Los valores son referenciales. Complementar con tasación profesional certificada.
        </div>
      </div>
    </div>
  );
}
