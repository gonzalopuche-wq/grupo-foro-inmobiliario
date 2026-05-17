"use client";

import { useState, useMemo } from "react";

interface ItemObra {
  id: number;
  categoria: string;
  descripcion: string;
  costo: number;
  moneda: "USD" | "ARS";
  impactoValorPct: number; // % de aumento sobre valor post-obra
  impactoRentaPct: number; // % de aumento sobre renta mensual
}

interface Config {
  valorActualUSD: number;
  rentaActualUSD: number;
  vacanciaPct: number;
  gastosOperativosPct: number;
  tipoChangio: number;
  apreciacionBaseAnualPct: number;
}

const CATEGORIAS = [
  { key: "cocina", label: "Cocina", color: "#f97316" },
  { key: "bano", label: "Baño(s)", color: "#3b82f6" },
  { key: "pisos", label: "Pisos", color: "#8b5cf6" },
  { key: "pintura", label: "Pintura", color: "#22c55e" },
  { key: "fachada", label: "Fachada exterior", color: "#f59e0b" },
  { key: "instalaciones", label: "Instalaciones", color: "#06b6d4" },
  { key: "ampliacion", label: "Ampliación m²", color: "#cc0000" },
  { key: "paisajismo", label: "Paisajismo", color: "#84cc16" },
  { key: "otro", label: "Otro", color: "#6b7280" },
];

const ITEMS_DEFAULT: ItemObra[] = [
  { id: 1, categoria: "cocina", descripcion: "Renovación cocina completa", costo: 8000, moneda: "USD", impactoValorPct: 5, impactoRentaPct: 8 },
  { id: 2, categoria: "bano", descripcion: "Renovación baño principal", costo: 4000, moneda: "USD", impactoValorPct: 3, impactoRentaPct: 5 },
  { id: 3, categoria: "pisos", descripcion: "Cambio de pisos", costo: 3500, moneda: "USD", impactoValorPct: 4, impactoRentaPct: 6 },
  { id: 4, categoria: "pintura", descripcion: "Pintura interior completa", costo: 1500, moneda: "USD", impactoValorPct: 2, impactoRentaPct: 3 },
];

let nextId = 5;

function fmtUSD(v: number): string {
  if (Math.abs(v) >= 1000000) return `USD ${(v / 1000000).toFixed(2)}M`;
  if (Math.abs(v) >= 1000) return `USD ${(v / 1000).toFixed(1)}k`;
  return `USD ${Math.round(v).toLocaleString("es-AR")}`;
}
function fmtPct(v: number): string { return v.toFixed(2) + "%"; }

export default function RoiRenovacionPage() {
  const [cfg, setCfg] = useState<Config>({
    valorActualUSD: 80000,
    rentaActualUSD: 500,
    vacanciaPct: 8,
    gastosOperativosPct: 20,
    tipoChangio: 1000,
    apreciacionBaseAnualPct: 5,
  });
  const [items, setItems] = useState<ItemObra[]>(ITEMS_DEFAULT);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("cocina");

  // Cálculos
  const costoTotalUSD = useMemo(() =>
    items.reduce((s, i) => s + (i.moneda === "USD" ? i.costo : i.costo / cfg.tipoChangio), 0),
    [items, cfg.tipoChangio]
  );

  const impactoValorPct = useMemo(() => {
    // Impactos son aditivos sobre el valor post-obra
    return items.reduce((s, i) => s + i.impactoValorPct, 0);
  }, [items]);

  const impactoRentaPct = useMemo(() =>
    items.reduce((s, i) => s + i.impactoRentaPct, 0),
    [items]
  );

  const valorPostObraUSD = cfg.valorActualUSD + costoTotalUSD;
  const valorConApreciacionUSD = valorPostObraUSD * (1 + impactoValorPct / 100);

  const rentaPostObraUSD = cfg.rentaActualUSD * (1 + impactoRentaPct / 100);

  // Renta neta anual antes y después
  const rentaNetaActual = cfg.rentaActualUSD * 12 * (1 - cfg.vacanciaPct / 100) * (1 - cfg.gastosOperativosPct / 100);
  const rentaNetaPost = rentaPostObraUSD * 12 * (1 - cfg.vacanciaPct / 100) * (1 - cfg.gastosOperativosPct / 100);

  // Aumento renta anual por la obra
  const deltaRentaAnual = rentaNetaPost - rentaNetaActual;

  // ROI simple
  const gananciaCapital = valorConApreciacionUSD - valorPostObraUSD;
  const roiCapital = costoTotalUSD > 0 ? (gananciaCapital / costoTotalUSD) * 100 : 0;
  const roiRenta = costoTotalUSD > 0 ? (deltaRentaAnual / costoTotalUSD) * 100 : 0;

  // Payback por incremento de renta
  const paybackMeses = deltaRentaAnual > 0
    ? Math.ceil(costoTotalUSD / (deltaRentaAnual / 12))
    : null;

  // Renta neta % antes y después
  const rentaNetaPctAntes = (rentaNetaActual / cfg.valorActualUSD) * 100;
  const rentaNetaPctPost = (rentaNetaPost / valorConApreciacionUSD) * 100;

  // Por categoría
  const porCategoria = useMemo(() => {
    const map: Record<string, { costo: number; impactoValor: number; impactoRenta: number; count: number }> = {};
    for (const item of items) {
      if (!map[item.categoria]) map[item.categoria] = { costo: 0, impactoValor: 0, impactoRenta: 0, count: 0 };
      map[item.categoria].costo += item.moneda === "USD" ? item.costo : item.costo / cfg.tipoChangio;
      map[item.categoria].impactoValor += item.impactoValorPct;
      map[item.categoria].impactoRenta += item.impactoRentaPct;
      map[item.categoria].count++;
    }
    return map;
  }, [items, cfg.tipoChangio]);

  function addItem() {
    const id = nextId++;
    const cat = CATEGORIAS.find((c) => c.key === nuevaCategoria);
    setItems((prev) => [...prev, {
      id,
      categoria: nuevaCategoria,
      descripcion: cat?.label ?? "Nuevo ítem",
      costo: 1000,
      moneda: "USD",
      impactoValorPct: 2,
      impactoRentaPct: 3,
    }]);
    setEditandoId(id);
  }

  function updateItem<K extends keyof ItemObra>(id: number, key: K, value: ItemObra[K]) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [key]: value } : i));
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const inp: React.CSSProperties = {
    background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>
            ROI de Renovación
          </h1>
          <p style={{ color: "#999", fontSize: 14, margin: "8px 0 0" }}>
            Retorno sobre inversión en obras de mejora y refuncionalización
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
          {/* Config propiedad */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#cc0000", marginBottom: 14, textTransform: "uppercase" }}>
                Propiedad actual
              </div>
              {[
                { label: "Valor actual (USD)", key: "valorActualUSD" as const, step: 5000 },
                { label: "Alquiler actual (USD/mes)", key: "rentaActualUSD" as const, step: 50 },
                { label: "Vacancia (%)", key: "vacanciaPct" as const, step: 1, max: 50 },
                { label: "Gastos operativos (%)", key: "gastosOperativosPct" as const, step: 1, max: 50 },
                { label: "Tipo de cambio (ARS/USD)", key: "tipoChangio" as const, step: 50 },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{f.label}</div>
                  <input
                    type="number"
                    value={cfg[f.key]}
                    step={f.step}
                    min={0}
                    max={(f as { max?: number }).max}
                    onChange={(e) => setCfg((c) => ({ ...c, [f.key]: parseFloat(e.target.value) || 0 }))}
                    style={{ ...inp, width: "100%" }}
                  />
                </div>
              ))}
            </div>

            {/* KPIs antes */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 10 }}>Estado actual</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#888" }}>Renta neta anual</span>
                <span style={{ fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>{fmtUSD(rentaNetaActual)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#888" }}>Renta neta %</span>
                <span style={{ fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>{fmtPct(rentaNetaPctAntes)}</span>
              </div>
            </div>
          </div>

          {/* Obra + resultados */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPIs ROI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {[
                { label: "Costo total obra", value: fmtUSD(costoTotalUSD), sub: `${items.length} ítems`, color: "#fff" },
                { label: "Ganancia capital est.", value: fmtUSD(gananciaCapital), sub: `+${fmtPct(impactoValorPct)} valor`, color: gananciaCapital > 0 ? "#22c55e" : "#ef4444" },
                { label: "ROI por renta", value: fmtPct(roiRenta) + "/año", sub: `+${fmtUSD(deltaRentaAnual)}/año`, color: "#cc0000" },
                { label: "Payback por renta", value: paybackMeses != null ? `${paybackMeses} meses` : "Sin recupero", sub: paybackMeses ? `${(paybackMeses / 12).toFixed(1)} años` : "—", color: paybackMeses && paybackMeses <= 36 ? "#22c55e" : "#f97316" },
              ].map((k) => (
                <div key={k.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "16px 14px" }}>
                  <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: k.color, marginBottom: 4 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Antes vs después */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: "0 0 16px", color: "#fff" }}>
                Antes vs Después de la Obra
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  {
                    label: "Antes",
                    color: "#6b7280",
                    rows: [
                      ["Valor propiedad", fmtUSD(cfg.valorActualUSD)],
                      ["Alquiler mensual", fmtUSD(cfg.rentaActualUSD)],
                      ["Renta neta anual", fmtUSD(rentaNetaActual)],
                      ["Renta neta %", fmtPct(rentaNetaPctAntes)],
                    ],
                  },
                  {
                    label: "Después",
                    color: "#22c55e",
                    rows: [
                      ["Valor propiedad", fmtUSD(valorConApreciacionUSD)],
                      ["Alquiler mensual", fmtUSD(rentaPostObraUSD)],
                      ["Renta neta anual", fmtUSD(rentaNetaPost)],
                      ["Renta neta %", fmtPct(rentaNetaPctPost)],
                    ],
                  },
                ].map((col) => (
                  <div key={col.label} style={{ background: "#161616", borderRadius: 10, padding: 16 }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: col.color, marginBottom: 12 }}>
                      {col.label}
                    </div>
                    {col.rows.map(([l, v]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "#888" }}>{l}</span>
                        <span style={{ fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: "12px 16px", background: "#161616", borderRadius: 8, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                {[
                  { label: "Δ Valor propiedad", value: `+${fmtUSD(valorConApreciacionUSD - cfg.valorActualUSD)}`, color: "#22c55e" },
                  { label: "Δ Alquiler mensual", value: `+${fmtUSD(rentaPostObraUSD - cfg.rentaActualUSD)}`, color: "#22c55e" },
                  { label: "Δ Renta neta anual", value: `+${fmtUSD(deltaRentaAnual)}`, color: "#22c55e" },
                  { label: "Δ Renta %", value: `${(rentaNetaPctPost - rentaNetaPctAntes) >= 0 ? "+" : ""}${fmtPct(rentaNetaPctPost - rentaNetaPctAntes)}`, color: "#22c55e" },
                ].map((k) => (
                  <div key={k.label}>
                    <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>{k.label}</div>
                    <div style={{ fontSize: 15, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lista de ítems de obra */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: 0, color: "#fff" }}>
                  Ítems de Obra
                </h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    style={{ ...inp, padding: "6px 10px" }}
                  >
                    {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <button
                    onClick={addItem}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #cc0000", background: "rgba(204,0,0,0.15)", color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => {
                  const cat = CATEGORIAS.find((c) => c.key === item.categoria);
                  const isEdit = editandoId === item.id;
                  const costoUSD = item.moneda === "USD" ? item.costo : item.costo / cfg.tipoChangio;
                  return (
                    <div key={item.id} style={{ background: "#161616", border: `1px solid ${isEdit ? (cat?.color ?? "#cc0000") : "#1a1a1a"}`, borderRadius: 10, padding: "12px 14px" }}>
                      {isEdit ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 80px 80px", gap: 10, alignItems: "end" }}>
                          <div>
                            <div style={{ fontSize: 9, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Descripción</div>
                            <input type="text" value={item.descripcion} onChange={(e) => updateItem(item.id, "descripcion", e.target.value)} style={{ ...inp, width: "100%" }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Costo</div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <input type="number" value={item.costo} step={100} min={0} onChange={(e) => updateItem(item.id, "costo", parseFloat(e.target.value) || 0)} style={{ ...inp, flex: 1 }} />
                              <select value={item.moneda} onChange={(e) => updateItem(item.id, "moneda", e.target.value as "USD" | "ARS")} style={{ ...inp, width: 60 }}>
                                <option value="USD">USD</option>
                                <option value="ARS">ARS</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Categoría</div>
                            <select value={item.categoria} onChange={(e) => updateItem(item.id, "categoria", e.target.value)} style={{ ...inp, width: "100%" }}>
                              {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>+Valor%</div>
                            <input type="number" value={item.impactoValorPct} step={0.5} min={0} max={30} onChange={(e) => updateItem(item.id, "impactoValorPct", parseFloat(e.target.value) || 0)} style={{ ...inp, width: "100%" }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>+Renta%</div>
                            <input type="number" value={item.impactoRentaPct} step={0.5} min={0} max={50} onChange={(e) => updateItem(item.id, "impactoRentaPct", parseFloat(e.target.value) || 0)} style={{ ...inp, width: "100%" }} />
                          </div>
                          <div style={{ display: "flex", gap: 4, paddingTop: 16 }}>
                            <button onClick={() => setEditandoId(null)} style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#888", fontSize: 11, cursor: "pointer" }}>✓</button>
                            <button onClick={() => removeItem(item.id)} style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setEditandoId(item.id)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat?.color ?? "#888", flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 600, color: "#fff" }}>{item.descripcion}</div>
                              <div style={{ fontSize: 11, color: "#666" }}>{cat?.label} · {item.moneda === "USD" ? `USD ${item.costo.toLocaleString("es-AR")}` : `$ ${item.costo.toLocaleString("es-AR")}`}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", display: "flex", gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 11, color: "#666" }}>+valor</div>
                              <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#22c55e" }}>+{item.impactoValorPct}%</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#666" }}>+renta</div>
                              <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#22c55e" }}>+{item.impactoRentaPct}%</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: "#666" }}>USD</div>
                              <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>{fmtUSD(costoUSD)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total por categoría */}
              {Object.keys(porCategoria).length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #222" }}>
                  <div style={{ fontSize: 11, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Por categoría</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {Object.entries(porCategoria).map(([cat, data]) => {
                      const catConf = CATEGORIAS.find((c) => c.key === cat);
                      return (
                        <div key={cat} style={{ background: `${catConf?.color ?? "#888"}15`, border: `1px solid ${catConf?.color ?? "#888"}44`, borderRadius: 8, padding: "8px 12px" }}>
                          <div style={{ fontSize: 11, color: catConf?.color ?? "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{catConf?.label ?? cat}</div>
                          <div style={{ fontSize: 12, color: "#fff", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{fmtUSD(data.costo)}</div>
                          <div style={{ fontSize: 10, color: "#888" }}>+{data.impactoValor.toFixed(1)}% valor · +{data.impactoRenta.toFixed(1)}% renta</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
