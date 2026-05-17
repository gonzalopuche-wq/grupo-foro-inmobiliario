"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Datos por provincia ───────────────────────────────────────────────────────

interface Provincia {
  id: string;
  nombre: string;
  sellosComprador: number;     // % sobre valor escritura
  sellosVendedor: number;
  iibbAlicuota: number;        // % sobre honorarios inmobiliaria
  abl: number | null;          // USD/año estimado si aplica
  itibGravado: boolean;        // ITIB o similar
  itibAlicuota: number;
  notas: string;
}

const PROVINCIAS: Provincia[] = [
  { id: "caba", nombre: "CABA", sellosComprador: 0, sellosVendedor: 1.25, iibbAlicuota: 4.5, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Ley 1346 — exento para primera vivienda única y permanente hasta UF 30. IIBB: alícuota general 4.5% sobre honorarios" },
  { id: "bsas", nombre: "Buenos Aires", sellosComprador: 1.0, sellosVendedor: 1.0, iibbAlicuota: 4.0, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Ley 10707 — 1% c/parte. Exención primera vivienda hasta 600 UVA. Sellador: 2% total sobre precio" },
  { id: "cordoba", nombre: "Córdoba", sellosComprador: 1.5, sellosVendedor: 1.5, iibbAlicuota: 3.5, abl: null, itibGravado: true, itibAlicuota: 1.0, notas: "Ingresos Brutos: 3.5%. ITIB 1% para inmuebles > $500k ARS. Exención vivienda única y familiar" },
  { id: "santafe", nombre: "Santa Fe", sellosComprador: 1.0, sellosVendedor: 1.0, iibbAlicuota: 3.5, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Código Fiscal SF. Sellos 1% c/parte. IIBB 3.5% base general" },
  { id: "mendoza", nombre: "Mendoza", sellosComprador: 1.5, sellosVendedor: 1.5, iibbAlicuota: 3.5, abl: null, itibGravado: true, itibAlicuota: 0.5, notas: "ITIB 0.5%. Exención vivienda única familiar. Sellador: 3% total" },
  { id: "tucuman", nombre: "Tucumán", sellosComprador: 1.0, sellosVendedor: 1.0, iibbAlicuota: 4.0, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Sellos 2% total. IIBB 4% actividad inmobiliaria" },
  { id: "salta", nombre: "Salta", sellosComprador: 2.0, sellosVendedor: 0.0, iibbAlicuota: 3.5, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Sellos 2% sólo comprador. Exención vendedor vivienda única" },
  { id: "entre_rios", nombre: "Entre Ríos", sellosComprador: 1.0, sellosVendedor: 1.0, iibbAlicuota: 4.0, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Código Fiscal ER. Sellos 2% total. IIBB 4%" },
  { id: "neuquen", nombre: "Neuquén", sellosComprador: 1.0, sellosVendedor: 1.0, iibbAlicuota: 3.0, abl: null, itibGravado: true, itibAlicuota: 0.5, notas: "IIBB 3%. ITIB 0.5% adicional. Patagónico — menor presión fiscal" },
  { id: "chubut", nombre: "Chubut", sellosComprador: 0.5, sellosVendedor: 0.5, iibbAlicuota: 3.0, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Patagónico. Sellos 1% total — menor alícuota del país" },
  { id: "misiones", nombre: "Misiones", sellosComprador: 1.5, sellosVendedor: 1.5, iibbAlicuota: 4.5, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Sellos 3% total. IIBB 4.5%" },
  { id: "corrientes", nombre: "Corrientes", sellosComprador: 1.0, sellosVendedor: 1.0, iibbAlicuota: 4.0, abl: null, itibGravado: false, itibAlicuota: 0, notas: "Código Fiscal Corrientes. Sellos 2% total" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ImpuestosProvinciales() {
  const [provinciaId, setProvinciaId] = useState("bsas");
  const [valorUSD, setValorUSD] = useState(120000);
  const [tcDolar, setTcDolar] = useState(1200);
  const [honorariosPct, setHonorariosPct] = useState(3.0); // % sobre venta (c/parte)
  const [modoCalculo, setModoCalculo] = useState<"comprador"|"vendedor"|"ambas">("ambas");

  const prov = useMemo(() => PROVINCIAS.find(p => p.id === provinciaId)!, [provinciaId]);

  const calc = useMemo(() => {
    const valorARS = valorUSD * tcDolar;
    const honorariosUSD = valorUSD * honorariosPct / 100;
    const honorariosARS = honorariosUSD * tcDolar;

    // Sellos
    const sellosComprador = valorARS * prov.sellosComprador / 100;
    const sellosVendedor = valorARS * prov.sellosVendedor / 100;

    // IIBB sobre honorarios
    const iibbComprador = modoCalculo !== "vendedor" ? honorariosARS * prov.iibbAlicuota / 100 : 0;
    const iibbVendedor = modoCalculo !== "comprador" ? honorariosARS * prov.iibbAlicuota / 100 : 0;

    // ITIB (lo paga el vendedor generalmente)
    const itib = prov.itibGravado ? valorARS * prov.itibAlicuota / 100 : 0;

    // IVA sobre honorarios (21%)
    const ivaHonorariosComprador = modoCalculo !== "vendedor" ? honorariosARS * 0.21 : 0;
    const ivaHonorariosVendedor = modoCalculo !== "comprador" ? honorariosARS * 0.21 : 0;

    // Gastos notariales estimados (escritura, copias, folio, anotación — aprox 0.8-1.2%)
    const notarial = valorARS * 0.01;

    // Totales
    const totalComprador = sellosComprador + honorariosARS + iibbComprador + ivaHonorariosComprador + notarial;
    const totalVendedor = sellosVendedor + honorariosARS + iibbVendedor + ivaHonorariosVendedor + itib;

    const pctComprador = (totalComprador / valorARS) * 100;
    const pctVendedor = (totalVendedor / valorARS) * 100;

    return {
      valorARS, honorariosARS, honorariosUSD,
      sellosComprador, sellosVendedor,
      iibbComprador, iibbVendedor,
      ivaHonorariosComprador, ivaHonorariosVendedor,
      itib, notarial,
      totalComprador, totalVendedor,
      pctComprador, pctVendedor,
    };
  }, [prov, valorUSD, tcDolar, honorariosPct, modoCalculo]);

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Impuestos Provinciales — ${prov.nombre}</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:700px;margin:0 auto}h1{font-size:20px;margin-bottom:4px}p{font-size:11px;color:#666}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f0f0f0;padding:8px;text-align:left;font-size:11px}td{padding:8px;border-bottom:1px solid #eee;font-size:12px}.total{font-weight:bold;font-size:13px;background:#f9f9f9}.pct{color:#666}</style>
    </head><body>
    <h1>Impuestos Provinciales — ${prov.nombre}</h1>
    <p>Valor: USD ${fmt(valorUSD)} · T.C. $${fmt(tcDolar)} · Honorarios: ${honorariosPct}%</p>
    <h3>Comprador</h3>
    <table><tr><th>Concepto</th><th>ARS</th><th>USD</th></tr>
    <tr><td>Sellos (${prov.sellosComprador}%)</td><td>$${fmt(calc.sellosComprador)}</td><td>USD ${fmt(calc.sellosComprador / tcDolar, 0)}</td></tr>
    <tr><td>Honorarios inmobiliaria</td><td>$${fmt(calc.honorariosARS)}</td><td>USD ${fmt(calc.honorariosUSD, 0)}</td></tr>
    <tr><td>IVA honorarios</td><td>$${fmt(calc.ivaHonorariosComprador)}</td><td>USD ${fmt(calc.ivaHonorariosComprador / tcDolar, 0)}</td></tr>
    <tr><td>IIBB (${prov.iibbAlicuota}%)</td><td>$${fmt(calc.iibbComprador)}</td><td>USD ${fmt(calc.iibbComprador / tcDolar, 0)}</td></tr>
    <tr><td>Gastos notariales (est.)</td><td>$${fmt(calc.notarial)}</td><td>USD ${fmt(calc.notarial / tcDolar, 0)}</td></tr>
    <tr class="total"><td>TOTAL COMPRADOR (${calc.pctComprador.toFixed(1)}%)</td><td>$${fmt(calc.totalComprador)}</td><td>USD ${fmt(calc.totalComprador / tcDolar, 0)}</td></tr>
    </table>
    <h3>Vendedor</h3>
    <table><tr><th>Concepto</th><th>ARS</th><th>USD</th></tr>
    <tr><td>Sellos (${prov.sellosVendedor}%)</td><td>$${fmt(calc.sellosVendedor)}</td><td>USD ${fmt(calc.sellosVendedor / tcDolar, 0)}</td></tr>
    <tr><td>Honorarios inmobiliaria</td><td>$${fmt(calc.honorariosARS)}</td><td>USD ${fmt(calc.honorariosUSD, 0)}</td></tr>
    <tr><td>IVA honorarios</td><td>$${fmt(calc.ivaHonorariosVendedor)}</td><td>USD ${fmt(calc.ivaHonorariosVendedor / tcDolar, 0)}</td></tr>
    <tr><td>IIBB (${prov.iibbAlicuota}%)</td><td>$${fmt(calc.iibbVendedor)}</td><td>USD ${fmt(calc.iibbVendedor / tcDolar, 0)}</td></tr>
    ${prov.itibGravado ? `<tr><td>ITIB (${prov.itibAlicuota}%)</td><td>$${fmt(calc.itib)}</td><td>USD ${fmt(calc.itib / tcDolar, 0)}</td></tr>` : ""}
    <tr class="total"><td>TOTAL VENDEDOR (${calc.pctVendedor.toFixed(1)}%)</td><td>$${fmt(calc.totalVendedor)}</td><td>USD ${fmt(calc.totalVendedor / tcDolar, 0)}</td></tr>
    </table>
    <p style="font-size:10px;color:#999;margin-top:20px">Valores estimados. Consultar escribano habilitado. Tasas actualizadas a May 2026.</p>
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
          Impuestos y Sellos Provinciales
        </h1>
      </div>

      <div style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          {/* Panel inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 16px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Parámetros</p>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Provincia</label>
                <select value={provinciaId} onChange={e => setProvinciaId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {PROVINCIAS.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Valor Propiedad (USD)</label>
                <input type="number" value={valorUSD} onChange={e => setValorUSD(+e.target.value)} style={inputStyle} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Tipo de Cambio (ARS/USD)</label>
                <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={inputStyle} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Honorarios Inmobiliaria (% c/parte)</label>
                <input type="number" step="0.5" value={honorariosPct} onChange={e => setHonorariosPct(+e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Vista</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["comprador","vendedor","ambas"] as const).map(m => (
                    <button key={m} onClick={() => setModoCalculo(m)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: `1px solid ${modoCalculo === m ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: modoCalculo === m ? "rgba(204,0,0,0.12)" : "transparent", color: modoCalculo === m ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notas provincia */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: "0 0 8px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Marco Legal</p>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{prov.notas}</p>
              {prov.itibGravado && (
                <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <span style={{ fontSize: 10, color: "#f97316", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>⚠ Esta provincia aplica ITIB ({prov.itibAlicuota}%)</span>
                </div>
              )}
            </div>

            <button onClick={exportarPDF} style={{ padding: "10px", borderRadius: 8, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
              EXPORTAR PDF
            </button>
          </div>

          {/* Panel resultados */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Resumen top */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Total Comprador", usd: calc.totalComprador / tcDolar, pct: calc.pctComprador, color: "#3b82f6" },
                { label: "Total Vendedor", usd: calc.totalVendedor / tcDolar, pct: calc.pctVendedor, color: "#cc0000" },
              ].map(item => (
                <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${item.color}22`, borderRadius: 12, padding: 20 }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 28, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: item.color }}>USD {fmt(item.usd)}</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{item.pct.toFixed(2)}% del valor</p>
                </div>
              ))}
            </div>

            {/* Desglose comprador */}
            {modoCalculo !== "vendedor" && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 12, padding: 20 }}>
                <p style={{ margin: "0 0 14px 0", fontSize: 11, color: "#3b82f6", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Desglose Comprador</p>
                {[
                  { label: `Impuesto de Sellos (${prov.sellosComprador}%)`, val: calc.sellosComprador },
                  { label: `Honorarios inmobiliaria (${honorariosPct}%)`, val: calc.honorariosARS },
                  { label: "IVA sobre honorarios (21%)", val: calc.ivaHonorariosComprador },
                  { label: `IIBB sobre honorarios (${prov.iibbAlicuota}%)`, val: calc.iibbComprador },
                  { label: "Gastos notariales estimados (~1%)", val: calc.notarial },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{row.label}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>USD {fmt(row.val / tcDolar)}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>ARS ${fmt(row.val)}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0 0" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>TOTAL</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#3b82f6" }}>USD {fmt(calc.totalComprador / tcDolar)}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{calc.pctComprador.toFixed(2)}% del precio</div>
                  </div>
                </div>
              </div>
            )}

            {/* Desglose vendedor */}
            {modoCalculo !== "comprador" && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(204,0,0,0.15)", borderRadius: 12, padding: 20 }}>
                <p style={{ margin: "0 0 14px 0", fontSize: 11, color: "#cc0000", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Desglose Vendedor</p>
                {[
                  { label: `Impuesto de Sellos (${prov.sellosVendedor}%)`, val: calc.sellosVendedor },
                  { label: `Honorarios inmobiliaria (${honorariosPct}%)`, val: calc.honorariosARS },
                  { label: "IVA sobre honorarios (21%)", val: calc.ivaHonorariosVendedor },
                  { label: `IIBB sobre honorarios (${prov.iibbAlicuota}%)`, val: calc.iibbVendedor },
                  ...(prov.itibGravado ? [{ label: `ITIB (${prov.itibAlicuota}%)`, val: calc.itib }] : []),
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{row.label}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>USD {fmt(row.val / tcDolar)}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>ARS ${fmt(row.val)}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0 0" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>TOTAL</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#cc0000" }}>USD {fmt(calc.totalVendedor / tcDolar)}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{calc.pctVendedor.toFixed(2)}% del precio</div>
                  </div>
                </div>
              </div>
            )}

            {/* Comparativa sellos entre provincias */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
              <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Comparativa Sellos (comprador + vendedor)</p>
              {PROVINCIAS.sort((a, b) => (a.sellosComprador + a.sellosVendedor) - (b.sellosComprador + b.sellosVendedor)).map(p => {
                const total = p.sellosComprador + p.sellosVendedor;
                const maxTotal = 4;
                return (
                  <div key={p.id} onClick={() => setProvinciaId(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", cursor: "pointer" }}>
                    <span style={{ fontSize: 11, width: 100, color: p.id === provinciaId ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: p.id === provinciaId ? 700 : 400 }}>{p.nombre}</span>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(total / maxTotal) * 100}%`, background: p.id === provinciaId ? "#cc0000" : "rgba(255,255,255,0.2)", borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 40, textAlign: "right" }}>{total}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
