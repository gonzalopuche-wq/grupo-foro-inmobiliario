"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Datos de referencia ───────────────────────────────────────────────────────

interface Reforma {
  id: string;
  nombre: string;
  categoria: string;
  costoMin: number; // USD/m² o por unidad según `unidad`
  costoMax: number;
  unidad: "m2" | "ud" | "global";
  valorAgregadoPct: number; // % de incremento de valor por cada peso/USD invertido
  roi: number; // % ROI típico
  descripcion: string;
}

const REFORMAS: Reforma[] = [
  // Cocina
  { id: "cocina_integral", nombre: "Cocina integral completa", categoria: "Cocina", costoMin: 3500, costoMax: 8000, unidad: "global", valorAgregadoPct: 120, roi: 68, descripcion: "Mobiliario, mesada, equipamiento básico incluido" },
  { id: "cocina_muebles", nombre: "Muebles de cocina (sin equipam.)", categoria: "Cocina", costoMin: 1500, costoMax: 4000, unidad: "global", valorAgregadoPct: 90, roi: 55, descripcion: "Bajo mesada + alacenas, sin electrodomésticos" },
  { id: "mesada_granito", nombre: "Mesada de granito/mármol", categoria: "Cocina", costoMin: 200, costoMax: 450, unidad: "m2", valorAgregadoPct: 110, roi: 60, descripcion: "Terminación premium, mejora estética y valor" },

  // Baño
  { id: "bano_completo", nombre: "Baño completo (reforma total)", categoria: "Baño", costoMin: 2500, costoMax: 6000, unidad: "global", valorAgregadoPct: 130, roi: 72, descripcion: "Sanitarios, revestimientos, griferías, vanitory" },
  { id: "bano_sanitarios", nombre: "Sanitarios (WC + bidet + lavatorio)", categoria: "Baño", costoMin: 600, costoMax: 1400, unidad: "global", valorAgregadoPct: 80, roi: 50, descripcion: "Reemplazo de sanitarios, sin revestimientos" },
  { id: "ducha_mampar", nombre: "Ducha + mampara", categoria: "Baño", costoMin: 400, costoMax: 900, unidad: "global", valorAgregadoPct: 85, roi: 55, descripcion: "Conversión bañera → ducha con mampara de vidrio" },

  // Pisos
  { id: "piso_porcellanato", nombre: "Porcellanato rectificado", categoria: "Pisos", costoMin: 45, costoMax: 90, unidad: "m2", valorAgregadoPct: 95, roi: 58, descripcion: "Material + colocación, formato 60x60 o 80x80" },
  { id: "piso_madera", nombre: "Piso de madera (parquet/flotante)", categoria: "Pisos", costoMin: 35, costoMax: 80, unidad: "m2", valorAgregadoPct: 100, roi: 62, descripcion: "Flotante o parquet semisólido, incluye colocación" },
  { id: "piso_microcemento", nombre: "Microcemento continuo", categoria: "Pisos", costoMin: 60, costoMax: 120, unidad: "m2", valorAgregadoPct: 105, roi: 63, descripcion: "Tendencia alta demanda, sin juntas, aspecto premium" },

  // Pintura y terminaciones
  { id: "pintura_interior", nombre: "Pintura interior completa", categoria: "Terminaciones", costoMin: 8, costoMax: 18, unidad: "m2", valorAgregadoPct: 110, roi: 75, descripcion: "Mano de obra + materiales, látex premium" },
  { id: "carpinteria_puertas", nombre: "Puertas y herrajes", categoria: "Terminaciones", costoMin: 250, costoMax: 600, unidad: "ud", valorAgregadoPct: 75, roi: 48, descripcion: "Precio por puerta incluye marcos y herrajes" },
  { id: "ventanas_dvh", nombre: "Ventanas DVH/termopanel", categoria: "Terminaciones", costoMin: 300, costoMax: 700, unidad: "m2", valorAgregadoPct: 120, roi: 65, descripcion: "Doble vidriado hermético, mejora aislación y valor" },

  // Instalaciones
  { id: "elect_completa", nombre: "Instalación eléctrica (reemplazo)", categoria: "Instalaciones", costoMin: 25, costoMax: 55, unidad: "m2", valorAgregadoPct: 80, roi: 50, descripcion: "Tablero, circuitos, boca a norma ENRE" },
  { id: "gas_calefaccion", nombre: "Gas + calefacción central", categoria: "Instalaciones", costoMin: 3000, costoMax: 7000, unidad: "global", valorAgregadoPct: 100, roi: 60, descripcion: "Caldera, radiadores o piso radiante" },
  { id: "aire_split", nombre: "Splits de A/C (x unidad)", categoria: "Instalaciones", costoMin: 600, costoMax: 1200, unidad: "ud", valorAgregadoPct: 90, roi: 55, descripcion: "Equipo + instalación, 2250W frigorías" },

  // Exteriores
  { id: "fachada_pintura", nombre: "Pintura de fachada", categoria: "Exteriores", costoMin: 20, costoMax: 45, unidad: "m2", valorAgregadoPct: 100, roi: 65, descripcion: "Alta visibilidad, mejora curb appeal" },
  { id: "jardin_paisajismo", nombre: "Jardín / paisajismo", categoria: "Exteriores", costoMin: 1000, costoMax: 4000, unidad: "global", valorAgregadoPct: 80, roi: 45, descripcion: "Diseño, plantas, riego automático básico" },
  { id: "pileta_piscina", nombre: "Piscina (fibra de vidrio)", categoria: "Exteriores", costoMin: 12000, costoMax: 25000, unidad: "global", valorAgregadoPct: 70, roi: 35, descripcion: "Incluye excavación, sistema filtrado, terminación" },
];

const CATEGORIAS = Array.from(new Set(REFORMAS.map(r => r.categoria)));

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Componente ────────────────────────────────────────────────────────────────

interface ItemSeleccionado {
  reforma: Reforma;
  cantidad: number;   // m² o unidades
  costoElegido: "min" | "mid" | "max";
}

export default function Reformas() {
  const [valorActual, setValorActual] = useState(100000);
  const [superficieM2, setSuperficieM2] = useState(60);
  const [items, setItems] = useState<ItemSeleccionado[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("Todos");
  const [agregar, setAgregar] = useState<Reforma | null>(null);
  const [cantidadTemp, setCantidadTemp] = useState(1);
  const [costoTemp, setCostoTemp] = useState<"min"|"mid"|"max">("mid");

  const resumen = useMemo(() => {
    let costoTotal = 0;
    let valorAgregadoTotal = 0;
    items.forEach(item => {
      const r = item.reforma;
      const costo = item.costoElegido === "min" ? r.costoMin : item.costoElegido === "max" ? r.costoMax : (r.costoMin + r.costoMax) / 2;
      const costoItem = r.unidad === "global" ? costo : costo * item.cantidad;
      const valorAgregado = costoItem * (r.roi / 100);
      costoTotal += costoItem;
      valorAgregadoTotal += valorAgregado;
    });
    const valorFinal = valorActual + valorAgregadoTotal;
    const roiTotal = costoTotal > 0 ? (valorAgregadoTotal / costoTotal) * 100 : 0;
    const incrementoPct = (valorAgregadoTotal / valorActual) * 100;
    return { costoTotal, valorAgregadoTotal, valorFinal, roiTotal, incrementoPct };
  }, [items, valorActual]);

  const reformasFiltradas = categoriaFiltro === "Todos" ? REFORMAS : REFORMAS.filter(r => r.categoria === categoriaFiltro);

  function agregarItem() {
    if (!agregar) return;
    setItems(prev => [...prev, { reforma: agregar, cantidad: cantidadTemp, costoElegido: costoTemp }]);
    setAgregar(null);
    setCantidadTemp(1);
    setCostoTemp("mid");
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function costoItem(item: ItemSeleccionado) {
    const r = item.reforma;
    const base = item.costoElegido === "min" ? r.costoMin : item.costoElegido === "max" ? r.costoMax : (r.costoMin + r.costoMax) / 2;
    return r.unidad === "global" ? base : base * item.cantidad;
  }

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plan de Reformas</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:700px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f0f0f0;padding:8px;font-size:11px;text-align:left}td{padding:8px;border-bottom:1px solid #eee;font-size:12px}.total{font-weight:bold;background:#f9f9f9}</style>
    </head><body>
    <h1>Plan de Reformas</h1>
    <p>Valor actual: USD ${fmt(valorActual)} · Superficie: ${superficieM2} m²</p>
    <table><tr><th>Reforma</th><th>Cantidad</th><th>Costo USD</th><th>ROI típico</th><th>Valor agregado</th></tr>
    ${items.map(item => `<tr><td>${item.reforma.nombre}</td><td>${item.reforma.unidad === "global" ? "—" : item.cantidad + " " + item.reforma.unidad}</td><td>USD ${fmt(costoItem(item))}</td><td>${item.reforma.roi}%</td><td>USD ${fmt(costoItem(item) * item.reforma.roi / 100)}</td></tr>`).join("")}
    <tr class="total"><td colspan="2">TOTALES</td><td>USD ${fmt(resumen.costoTotal)}</td><td>${resumen.roiTotal.toFixed(1)}%</td><td>USD ${fmt(resumen.valorAgregadoTotal)}</td></tr>
    </table>
    <p><b>Valor actual:</b> USD ${fmt(valorActual)}</p>
    <p><b>Valor estimado post-reforma:</b> USD ${fmt(resumen.valorFinal)}</p>
    <p><b>Incremento:</b> +${resumen.incrementoPct.toFixed(1)}%</p>
    <p style="font-size:10px;color:#999;margin-top:20px">Estimaciones orientativas. Costos pueden variar según calidad, zona y momento del mercado.</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 };
  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "8px 12px", fontFamily: "'Inter',sans-serif", fontSize: 13, boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← Calculadoras</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Reformas y Mejoras — ROI
        </h1>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
          {/* Panel izquierdo */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Propiedades base */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Propiedad Base</p>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Valor actual (USD)</label>
                <input type="number" value={valorActual} onChange={e => setValorActual(+e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Superficie (m²)</label>
                <input type="number" value={superficieM2} onChange={e => setSuperficieM2(+e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Resumen */}
            <div style={{ background: resumen.costoTotal > 0 ? "rgba(204,0,0,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${resumen.costoTotal > 0 ? "rgba(204,0,0,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Resumen</p>
              {[
                { label: "Inversión total", val: `USD ${fmt(resumen.costoTotal)}`, color: "#f97316" },
                { label: "Valor agregado est.", val: `USD ${fmt(resumen.valorAgregadoTotal)}`, color: "#22c55e" },
                { label: "Valor post-reforma", val: `USD ${fmt(resumen.valorFinal)}`, color: "#fff" },
                { label: "ROI promedio", val: `${resumen.roiTotal.toFixed(1)}%`, color: "#cc0000" },
                { label: "Incremento valor", val: `+${resumen.incrementoPct.toFixed(1)}%`, color: "#3b82f6" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: row.color, fontFamily: "'Montserrat',sans-serif" }}>{row.val}</span>
                </div>
              ))}
            </div>

            {items.length > 0 && (
              <button onClick={exportarPDF} style={{ padding: "10px", borderRadius: 8, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
                EXPORTAR PDF
              </button>
            )}
          </div>

          {/* Panel derecho */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Lista de ítems agregados */}
            {items.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
                <p style={{ margin: 0, padding: "14px 20px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Plan de Reformas</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Reforma", "Cant.", "Costo", "ROI", "Valor +", ""].map(h => (
                        <th key={h} style={{ padding: "7px 14px", textAlign: h === "Reforma" ? "left" : "right", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const c = costoItem(item);
                      const va = c * item.reforma.roi / 100;
                      return (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                          <td style={{ padding: "8px 14px", fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{item.reforma.nombre}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{item.reforma.categoria} · {item.costoElegido}</div>
                          </td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{item.reforma.unidad === "global" ? "—" : `${item.cantidad} ${item.reforma.unidad}`}</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 12, fontWeight: 700 }}>USD {fmt(c)}</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 12, color: "#f97316", fontWeight: 700 }}>{item.reforma.roi}%</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 12, color: "#22c55e", fontWeight: 700 }}>+USD {fmt(va)}</td>
                          <td style={{ padding: "8px 14px", textAlign: "right" }}>
                            <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14 }}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Catálogo */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {["Todos", ...CATEGORIAS].map(cat => (
                  <button key={cat} onClick={() => setCategoriaFiltro(cat)} style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${categoriaFiltro === cat ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: categoriaFiltro === cat ? "rgba(204,0,0,0.12)" : "transparent", color: categoriaFiltro === cat ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
                    {cat}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {reformasFiltradas.map(r => (
                  <div key={r.id} onClick={() => { setAgregar(r); setCantidadTemp(r.unidad === "m2" ? superficieM2 : 1); }} style={{ padding: 14, borderRadius: 10, background: agregar?.id === r.id ? "rgba(204,0,0,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${agregar?.id === r.id ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{r.nombre}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{r.descripcion}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>USD {fmt(r.costoMin)}–{fmt(r.costoMax)} /{r.unidad}</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: r.roi >= 65 ? "rgba(34,197,94,0.12)" : r.roi >= 50 ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.06)", color: r.roi >= 65 ? "#22c55e" : r.roi >= 50 ? "#f97316" : "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>ROI {r.roi}%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal agregar */}
              {agregar && (
                <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: "rgba(204,0,0,0.06)", border: "1px solid rgba(204,0,0,0.2)" }}>
                  <p style={{ margin: "0 0 10px 0", fontSize: 12, fontWeight: 700 }}>Agregar: {agregar.nombre}</p>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                    {agregar.unidad !== "global" && (
                      <div style={{ flex: 1 }}>
                        <label style={{ ...labelStyle, fontSize: 9 }}>{agregar.unidad === "m2" ? "M²" : "Unidades"}</label>
                        <input type="number" value={cantidadTemp} onChange={e => setCantidadTemp(+e.target.value)} style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <label style={{ ...labelStyle, fontSize: 9 }}>Calidad</label>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["min","mid","max"] as const).map(c => (
                          <button key={c} onClick={() => setCostoTemp(c)} style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${costoTemp === c ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: costoTemp === c ? "rgba(204,0,0,0.12)" : "transparent", color: costoTemp === c ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
                            {c === "min" ? "Eco" : c === "mid" ? "Std" : "Premium"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={agregarItem} style={{ padding: "6px 16px", borderRadius: 8, background: "#cc0000", border: "none", color: "#fff", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
                      + Agregar
                    </button>
                    <button onClick={() => setAgregar(null)} style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                  <p style={{ margin: "8px 0 0 0", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                    Costo estimado: USD {fmt(
                      (costoTemp === "min" ? agregar.costoMin : costoTemp === "max" ? agregar.costoMax : (agregar.costoMin + agregar.costoMax) / 2)
                      * (agregar.unidad === "global" ? 1 : cantidadTemp)
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
