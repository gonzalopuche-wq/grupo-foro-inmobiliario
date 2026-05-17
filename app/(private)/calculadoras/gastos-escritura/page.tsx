"use client";

import { useState, useMemo } from "react";

// ── Aranceles aproximados (Argentina, pueden variar por provincia/escribano) ──

const PROVINCIAS = [
  { id: "bsas", nombre: "Buenos Aires (CABA)", sellosPct: 2.5, iibbEscrVendedor: 0, iibbEscrComprador: 0 },
  { id: "pba", nombre: "Buenos Aires (Provincia)", sellosPct: 3.6, iibbEscrVendedor: 0, iibbEscrComprador: 0 },
  { id: "cordoba", nombre: "Córdoba", sellosPct: 2.0, iibbEscrVendedor: 0, iibbEscrComprador: 0 },
  { id: "santafe", nombre: "Santa Fe", sellosPct: 2.4, iibbEscrVendedor: 0, iibbEscrComprador: 0 },
  { id: "mendoza", nombre: "Mendoza", sellosPct: 2.0, iibbEscrVendedor: 0, iibbEscrComprador: 0 },
];

interface Concepto {
  id: string;
  label: string;
  quien: "comprador" | "vendedor" | "ambos";
  tipo: "pct_valor" | "pct_honorarios" | "fijo";
  valor: number; // pct o monto fijo USD
  activo: boolean;
  categoria: string;
  descripcion: string;
}

interface Config {
  valorPropUSD: number;
  tipoOperacion: "venta" | "permuta";
  provincia: string;
  hipoteca: boolean;
  montoHipotecaUSD: number;
  honorariosInmobPct: number;
  ivaHonorarios: boolean;
  primerVivienda: boolean;
}

const CONCEPTOS_BASE: Concepto[] = [
  // Comprador
  { id: "escribania_comprador", label: "Honorarios escribano (comprador)", quien: "comprador", tipo: "pct_valor", valor: 2.0, activo: true, categoria: "Escribanía", descripcion: "Honorarios notariales del escribano del comprador" },
  { id: "sellados_comprador", label: "Impuesto de sellos (comprador)", quien: "comprador", tipo: "pct_valor", valor: 1.25, activo: true, categoria: "Impuestos", descripcion: "50% del impuesto de sellos según provincia" },
  { id: "colegio_notarial", label: "Colegio de Escribanos / Registro", quien: "comprador", tipo: "pct_valor", valor: 0.3, activo: true, categoria: "Aranceles", descripcion: "Aranceles registrales y colegiales" },
  { id: "estudio_titulos", label: "Estudio de títulos", quien: "comprador", tipo: "fijo", valor: 150, activo: true, categoria: "Escribanía", descripcion: "Verificación de dominio y antecedentes" },
  { id: "certificados", label: "Certificados (ABL, libre deuda, etc.)", quien: "comprador", tipo: "fijo", valor: 200, activo: true, categoria: "Aranceles", descripcion: "Certificados municipales y deudas" },
  { id: "hipoteca_escribania", label: "Escritura hipoteca (si aplica)", quien: "comprador", tipo: "pct_valor", valor: 1.5, activo: false, categoria: "Escribanía", descripcion: "Honorarios adicionales por escritura de hipoteca" },
  // Vendedor
  { id: "escribania_vendedor", label: "Honorarios escribano (vendedor)", quien: "vendedor", tipo: "pct_valor", valor: 1.5, activo: true, categoria: "Escribanía", descripcion: "Honorarios del escribano designado por el vendedor" },
  { id: "sellados_vendedor", label: "Impuesto de sellos (vendedor)", quien: "vendedor", tipo: "pct_valor", valor: 1.25, activo: true, categoria: "Impuestos", descripcion: "50% del impuesto de sellos" },
  { id: "iti_vendedor", label: "ITI (Impuesto Transferencia Inmuebles)", quien: "vendedor", tipo: "pct_valor", valor: 1.5, activo: true, categoria: "Impuestos", descripcion: "1.5% si no es vivienda única y permanente" },
  { id: "plusvalia", label: "COTI / Operación AFIP", quien: "vendedor", tipo: "fijo", valor: 0, activo: true, categoria: "Impuestos", descripcion: "Obligatorio para operaciones >$1.5M (desde 2022)" },
  { id: "boleto_vendedor", label: "Honorarios sobre boleto (inmobiliaria)", quien: "vendedor", tipo: "pct_honorarios", valor: 100, activo: true, categoria: "Inmobiliaria", descripcion: "Honorarios de la inmobiliaria a cargo del vendedor" },
  { id: "honorarios_comprador_inmob", label: "Honorarios inmobiliaria (comprador)", quien: "comprador", tipo: "pct_honorarios", valor: 100, activo: true, categoria: "Inmobiliaria", descripcion: "Honorarios de la inmobiliaria a cargo del comprador" },
];

function fmtUSD(v: number, d = 0): string {
  if (Math.abs(v) >= 1000000) return `USD ${(v / 1000000).toFixed(2)}M`;
  if (Math.abs(v) >= 1000) return `USD ${(v / 1000).toFixed(1)}k`;
  return `USD ${v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
function fmtPct(v: number): string { return v.toFixed(2) + "%"; }

export default function GastosEscrituraPage() {
  const [cfg, setCfg] = useState<Config>({
    valorPropUSD: 100000,
    tipoOperacion: "venta",
    provincia: "bsas",
    hipoteca: false,
    montoHipotecaUSD: 50000,
    honorariosInmobPct: 3,
    ivaHonorarios: true,
    primerVivienda: false,
  });

  const [conceptos, setConceptos] = useState<Concepto[]>(CONCEPTOS_BASE);

  const provincia = PROVINCIAS.find((p) => p.id === cfg.provincia) ?? PROVINCIAS[0];

  // Ajustar sellos por provincia
  const conceptosAjustados = useMemo((): Concepto[] => {
    return conceptos.map((c) => {
      if (c.id === "sellados_comprador" || c.id === "sellados_vendedor") {
        return { ...c, valor: provincia.sellosPct / 2 };
      }
      if (c.id === "iti_vendedor") {
        return { ...c, activo: !cfg.primerVivienda };
      }
      if (c.id === "hipoteca_escribania") {
        return { ...c, activo: cfg.hipoteca };
      }
      return c;
    });
  }, [conceptos, provincia, cfg.primerVivienda, cfg.hipoteca]);

  // Calcular montos
  const honInmobBase = cfg.valorPropUSD * (cfg.honorariosInmobPct / 100);
  const honInmobConIVA = cfg.ivaHonorarios ? honInmobBase * 1.21 : honInmobBase;

  function calcMonto(c: Concepto): number {
    if (!c.activo) return 0;
    if (c.tipo === "pct_valor") return cfg.valorPropUSD * (c.valor / 100);
    if (c.tipo === "pct_honorarios") return honInmobConIVA * (c.valor / 100);
    return c.valor;
  }

  const totales = useMemo(() => {
    let comprador = 0, vendedor = 0;
    const detalle: Array<{ concepto: Concepto; monto: number }> = [];
    for (const c of conceptosAjustados) {
      const monto = calcMonto(c);
      if (monto === 0 || !c.activo) continue;
      detalle.push({ concepto: c, monto });
      if (c.quien === "comprador") comprador += monto;
      else if (c.quien === "vendedor") vendedor += monto;
      else { comprador += monto / 2; vendedor += monto / 2; }
    }
    const total = comprador + vendedor;
    return { comprador, vendedor, total, detalle };
  }, [conceptosAjustados, cfg]);

  const compradorPct = (totales.comprador / cfg.valorPropUSD) * 100;
  const vendedorPct = (totales.vendedor / cfg.valorPropUSD) * 100;
  const totalPct = (totales.total / cfg.valorPropUSD) * 100;

  function toggleConcepto(id: string) {
    setConceptos((prev) => prev.map((c) => c.id === id ? { ...c, activo: !c.activo } : c));
  }

  function setPct(id: string, val: number) {
    setConceptos((prev) => prev.map((c) => c.id === id ? { ...c, valor: val } : c));
  }

  const inp: React.CSSProperties = {
    background: "#111", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 14, fontFamily: "Inter, sans-serif",
  };

  const categorias = [...new Set(conceptosAjustados.map((c) => c.categoria))];

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = totales.detalle.map(({ concepto, monto }) =>
      `<tr><td style="padding:6px 10px">${concepto.label}</td><td style="padding:6px 10px;text-align:center;color:${concepto.quien === "comprador" ? "#3b82f6" : "#cc0000"}">${concepto.quien}</td><td style="padding:6px 10px;text-align:right;font-weight:700">${fmtUSD(monto)}</td><td style="padding:6px 10px;text-align:right;color:#888">${fmtPct((monto / cfg.valorPropUSD) * 100)}</td></tr>`
    ).join("");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gastos Escritura</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{color:#cc0000;font-size:22px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f3f4f6;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280}td{border-bottom:1px solid #f0f0f0}.total{font-weight:800;background:#f9fafb}</style></head><body>
    <h1>Gastos de Escritura</h1>
    <p style="color:#888;margin-bottom:24px">Propiedad: ${fmtUSD(cfg.valorPropUSD)} · ${provincia.nombre} · Honorarios inmobiliaria: ${cfg.honorariosInmobPct}%${cfg.ivaHonorarios ? " + IVA" : ""}</p>
    <table><thead><tr><th>Concepto</th><th>Quién paga</th><th style="text-align:right">Monto</th><th style="text-align:right">% valor</th></tr></thead><tbody>
    ${rows}
    <tr class="total"><td><strong>Comprador</strong></td><td></td><td style="text-align:right"><strong>${fmtUSD(totales.comprador)}</strong></td><td style="text-align:right">${fmtPct(compradorPct)}</td></tr>
    <tr class="total"><td><strong>Vendedor</strong></td><td></td><td style="text-align:right"><strong>${fmtUSD(totales.vendedor)}</strong></td><td style="text-align:right">${fmtPct(vendedorPct)}</td></tr>
    <tr class="total" style="background:#fef2f2"><td><strong>TOTAL</strong></td><td></td><td style="text-align:right;color:#cc0000"><strong>${fmtUSD(totales.total)}</strong></td><td style="text-align:right;color:#cc0000">${fmtPct(totalPct)}</td></tr>
    </tbody></table>
    <p style="margin-top:20px;font-size:11px;color:#9ca3af">Estimación aproximada. Los valores reales pueden variar según escribano, deudas, estado registral y acuerdos entre partes. Generado por Grupo Foro Inmobiliario.</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>
              Gastos de Escritura
            </h1>
            <p style={{ color: "#999", fontSize: 14, margin: "8px 0 0" }}>
              Estimación completa de costos para comprador y vendedor
            </p>
          </div>
          <button onClick={exportarPDF} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #cc0000", background: "rgba(204,0,0,0.15)", color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}>
            Exportar PDF
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
          {/* Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#cc0000", marginBottom: 14, textTransform: "uppercase" }}>
                Operación
              </div>
              {[
                { label: "Valor de la propiedad (USD)", key: "valorPropUSD" as const, type: "number", step: 5000 },
                { label: "Honorarios inmobiliaria (%)", key: "honorariosInmobPct" as const, type: "number", step: 0.5, max: 10 },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{f.label}</div>
                  <input
                    type="number"
                    value={cfg[f.key] as number}
                    step={f.step}
                    min={0}
                    max={(f as { max?: number }).max}
                    onChange={(e) => setCfg((c) => ({ ...c, [f.key]: parseFloat(e.target.value) || 0 }))}
                    style={{ ...inp, width: "100%" }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>Provincia</div>
                <select value={cfg.provincia} onChange={(e) => setCfg((c) => ({ ...c, provincia: e.target.value }))} style={{ ...inp, width: "100%" }}>
                  {PROVINCIAS.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              {/* Toggles */}
              {[
                { label: "IVA en honorarios inmobiliaria", key: "ivaHonorarios" as const },
                { label: "Primera vivienda (exento ITI)", key: "primerVivienda" as const },
                { label: "Con hipoteca", key: "hipoteca" as const },
              ].map((t) => (
                <div key={t.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "#aaa" }}>{t.label}</span>
                  <button
                    onClick={() => setCfg((c) => ({ ...c, [t.key]: !c[t.key] }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: "none",
                      background: cfg[t.key] ? "#cc0000" : "#333",
                      cursor: "pointer", position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: cfg[t.key] ? 23 : 3, transition: "left 0.2s" }} />
                  </button>
                </div>
              ))}

              {cfg.hipoteca && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>Monto hipoteca (USD)</div>
                  <input type="number" value={cfg.montoHipotecaUSD} step={5000} min={0} onChange={(e) => setCfg((c) => ({ ...c, montoHipotecaUSD: parseFloat(e.target.value) || 0 }))} style={{ ...inp, width: "100%" }} />
                </div>
              )}
            </div>

            {/* Resumen */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#666", textTransform: "uppercase", marginBottom: 12 }}>Resumen</div>
              {[
                { label: "Comprador paga", value: fmtUSD(totales.comprador), pct: compradorPct, color: "#3b82f6" },
                { label: "Vendedor paga", value: fmtUSD(totales.vendedor), pct: vendedorPct, color: "#cc0000" },
                { label: "Total gastos", value: fmtUSD(totales.total), pct: totalPct, color: "#fff", bold: true },
              ].map((k) => (
                <div key={k.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #1a1a1a" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#aaa" }}>{k.label}</div>
                    <div style={{ fontSize: 10, color: "#555" }}>{fmtPct(k.pct)} del valor</div>
                  </div>
                  <div style={{ fontSize: k.bold ? 18 : 15, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: k.color }}>
                    {k.value}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 4 }}>
                <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${totales.total > 0 ? (totales.comprador / totales.total) * 100 : 50}%`, background: "#3b82f6", transition: "width 0.3s" }} />
                  <div style={{ flex: 1, background: "#cc0000" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#3b82f6" }}>Comprador {fmtPct(totales.total > 0 ? (totales.comprador / totales.total) * 100 : 50)}</span>
                  <span style={{ fontSize: 10, color: "#cc0000" }}>Vendedor {fmtPct(totales.total > 0 ? (totales.vendedor / totales.total) * 100 : 50)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conceptos + tabla */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {[
                { label: "Valor propiedad", value: fmtUSD(cfg.valorPropUSD) },
                { label: "Hon. inmobiliaria", value: fmtUSD(honInmobConIVA), sub: cfg.ivaHonorarios ? "(+IVA)" : "(sin IVA)" },
                { label: "Total comprador", value: fmtUSD(totales.comprador), color: "#3b82f6" },
                { label: "Total vendedor", value: fmtUSD(totales.vendedor), color: "#cc0000" },
              ].map((k) => (
                <div key={k.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "16px 14px" }}>
                  <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: (k as { color?: string }).color ?? "#fff" }}>{k.value}</div>
                  {(k as { sub?: string }).sub && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{(k as { sub?: string }).sub}</div>}
                </div>
              ))}
            </div>

            {/* Detalle por categoría */}
            {categorias.map((cat) => {
              const catItems = conceptosAjustados.filter((c) => c.categoria === cat);
              return (
                <div key={cat} style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 12 }}>{cat}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {catItems.map((c) => {
                      const monto = calcMonto(c);
                      return (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#161616", borderRadius: 8, padding: "10px 14px", opacity: c.activo ? 1 : 0.4 }}>
                          <button
                            onClick={() => toggleConcepto(c.id)}
                            style={{
                              width: 18, height: 18, borderRadius: 4, border: `1px solid ${c.activo ? "#cc0000" : "#333"}`,
                              background: c.activo ? "#cc0000" : "transparent", cursor: "pointer", flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {c.activo && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: "#fff", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>{c.label}</div>
                            <div style={{ fontSize: 11, color: "#666" }}>{c.descripcion}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            {c.tipo === "pct_valor" && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                  type="number"
                                  value={c.valor}
                                  step={0.1}
                                  min={0}
                                  max={10}
                                  onChange={(e) => setPct(c.id, parseFloat(e.target.value) || 0)}
                                  style={{ width: 60, background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4, color: "#fff", padding: "4px 8px", fontSize: 12, fontFamily: "Inter, sans-serif" }}
                                />
                                <span style={{ fontSize: 11, color: "#666" }}>%</span>
                              </div>
                            )}
                            <div style={{ textAlign: "right", minWidth: 80 }}>
                              <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: c.activo ? "#fff" : "#444" }}>
                                {c.activo ? fmtUSD(monto) : "—"}
                              </div>
                              <div style={{ fontSize: 10, color: c.quien === "comprador" ? "#3b82f6" : "#cc0000" }}>
                                {c.quien}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Advertencia */}
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: "#f59e0b", fontFamily: "Montserrat, sans-serif", fontWeight: 700, marginBottom: 4 }}>
                ⚠ Estimación orientativa
              </div>
              <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>
                Los valores son aproximados. Los aranceles reales varían según escribano, estado de deudas del inmueble, acuerdos entre partes y actualizaciones del Colegio de Escribanos. Siempre verificar con el escribano interviniente.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
