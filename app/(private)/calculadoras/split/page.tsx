"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtARS = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtUSD = (n: number) => "USD " + Math.round(n).toLocaleString("es-AR");
const fmtMon = (n: number, m: string) => m === "USD" ? fmtUSD(n) : fmtARS(n);
const fmtPct = (n: number) => n.toFixed(2).replace(".", ",") + "%";
const num = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

// ── constantes ────────────────────────────────────────────────────────────────
const IIBB_DEFAULT  = 5.5;
const IVA_DEFAULT   = 21;
const SPLIT_DEFAULT = 60; // % que va al corredor

type TipoOp = "venta" | "locacion";
type Moneda = "USD" | "ARS";

export default function CalculadoraSplitPage() {
  // ── operación ─────────────────────────────────────────────────────────────
  const [tipoOp, setTipoOp]   = useState<TipoOp>("venta");
  const [moneda, setMoneda]   = useState<Moneda>("USD");
  const [precio, setPrecio]   = useState("200000");
  const [dolarBlue, setDolarBlue] = useState("1000");

  // ── honorarios compraventa ────────────────────────────────────────────────
  const [honComprador, setHonComprador]   = useState("3");
  const [honVendedor, setHonVendedor]     = useState("3");

  // ── honorarios locación ───────────────────────────────────────────────────
  const [alquiler, setAlquiler]           = useState("200000");
  const [mesesLocatario, setMesesLocatario] = useState("1");
  const [mesesPropietario, setMesesPropietario] = useState("1");

  // ── co-broking ────────────────────────────────────────────────────────────
  const [esCoBroke, setEsCoBroke]         = useState(false);
  const [pctMiOficina, setPctMiOficina]   = useState("50");   // % del total bruto para mi oficina

  // ── splits internos ───────────────────────────────────────────────────────
  const [splitCorredor, setSplitCorredor] = useState(String(SPLIT_DEFAULT)); // % al corredor de mi oficina
  const [hayColega, setHayColega]         = useState(false);
  const [splitColega, setSplitColega]     = useState("50"); // % entre mí y mi colega (mismo split)

  // ── impuestos ─────────────────────────────────────────────────────────────
  const [iibb, setIibb] = useState(String(IIBB_DEFAULT));
  const [iva, setIva]   = useState(String(IVA_DEFAULT));
  const [aplicarImpuestos, setAplicarImpuestos] = useState(true);

  // ── cálculos ──────────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const precioNum   = num(precio);
    const dolarNum    = num(dolarBlue);
    const alqNum      = num(alquiler);
    const iibbRate    = num(iibb) / 100;
    const ivaRate     = num(iva) / 100;
    const pctMiOfi    = Math.min(100, Math.max(0, num(pctMiOficina))) / 100;
    const pctOtraOfi  = 1 - pctMiOfi;
    const splitCorr   = Math.min(100, Math.max(0, num(splitCorredor))) / 100;
    const splitCleg   = Math.min(100, Math.max(0, num(splitColega))) / 100;

    // ── honorario bruto total ──
    let honBruto = 0;
    if (tipoOp === "venta") {
      honBruto = precioNum * (num(honComprador) + num(honVendedor)) / 100;
    } else {
      honBruto = alqNum * (num(mesesLocatario) + num(mesesPropietario));
    }

    // ── lo que recibe mi oficina (bruto, antes de impuestos) ──
    const miOficinaBruto = esCoBroke ? honBruto * pctMiOfi : honBruto;
    const otraOficinaBruto = esCoBroke ? honBruto * pctOtraOfi : 0;

    // ── impuestos sobre mi oficina ──
    let miOficinaIIBB = 0, miOficinaIVA = 0;
    if (aplicarImpuestos) {
      miOficinaIIBB = miOficinaBruto * iibbRate;
      const baseIVA = miOficinaBruto + miOficinaIIBB;
      miOficinaIVA  = baseIVA * ivaRate;
    }
    const miOficinaNeta = miOficinaBruto - miOficinaIIBB - miOficinaIVA;

    // ── split interno ──
    // El corredor recibe splitCorr de miOficinaNeta
    // La oficina retiene (1 - splitCorr) de miOficinaNeta
    let miCorredorNeto = miOficinaNeta * splitCorr;
    let miOficinaRetiene = miOficinaNeta * (1 - splitCorr);

    // Si hay colega en mi oficina, se dividen el monto del corredor
    let coleganeto = 0;
    if (hayColega) {
      coleganeto      = miCorredorNeto * splitCleg;
      miCorredorNeto  = miCorredorNeto * (1 - splitCleg);
    }

    // ── conversión a ARS si es USD ──
    const toARS = (n: number) => moneda === "USD" ? n * dolarNum : n;

    return {
      honBruto,
      miOficinaBruto,
      otraOficinaBruto,
      miOficinaIIBB,
      miOficinaIVA,
      miOficinaNeta,
      miCorredorNeto,
      miOficinaRetiene,
      coleganeto,
      // En ARS
      honBrutoARS:      toARS(honBruto),
      miCorredorNetoARS: toARS(miCorredorNeto),
    };
  }, [tipoOp, moneda, precio, dolarBlue, alquiler, mesesLocatario, mesesPropietario,
      honComprador, honVendedor, esCoBroke, pctMiOficina, splitCorredor,
      hayColega, splitColega, iibb, iva, aplicarImpuestos]);

  const fmtResult = (n: number) => fmtMon(n, moneda);

  const pdfExport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const row = (l: string, v: string, bold = false, color = "#111") =>
      `<tr><td style="padding:6px 10px;color:#555">${l}</td><td style="padding:6px 10px;text-align:right;font-weight:${bold?"700":"400"};color:${color}">${v}</td></tr>`;
    win.document.write(`<!DOCTYPE html><html><head><title>Split de honorarios</title>
    <style>body{font-family:Arial,sans-serif;color:#111;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:12px}td{font-size:13px;border-bottom:1px solid #f0f0f0}</style></head>
    <body><h1>Calculadora de Split de Honorarios</h1>
    <p>Operación: <b>${tipoOp === "venta" ? "Compraventa" : "Locación"}</b> · Moneda: <b>${moneda}</b>${esCoBroke ? ` · Co-broking (mi oficina: ${pctMiOficina}%)` : ""}</p>
    <table><tbody>
      ${row("Honorario bruto total", fmtResult(calc.honBruto), true)}
      ${esCoBroke ? row("Mi oficina recibe (bruto)", fmtResult(calc.miOficinaBruto)) : ""}
      ${esCoBroke ? row("Otra oficina recibe", fmtResult(calc.otraOficinaBruto)) : ""}
      ${aplicarImpuestos ? row(`IIBB (${iibb}%)`, `− ${fmtResult(calc.miOficinaIIBB)}`, false, "#dc2626") : ""}
      ${aplicarImpuestos ? row(`IVA (${iva}%)`, `− ${fmtResult(calc.miOficinaIVA)}`, false, "#dc2626") : ""}
      ${row("Mi oficina neta", fmtResult(calc.miOficinaNeta), true)}
      ${row(`Corredor recibe (${splitCorredor}%)`, fmtResult(calc.miCorredorNeto), true, "#16a34a")}
      ${hayColega ? row("Colega recibe", fmtResult(calc.coleganeto), false, "#d97706") : ""}
      ${row("Oficina retiene", fmtResult(calc.miOficinaRetiene))}
    </tbody></table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const resultRow = (label: string, value: string, color = "#fff", nota?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>{label}</div>
        {nota && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", marginTop: 2 }}>{nota}</div>}
      </div>
      <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 14, color }}>{value}</div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .sp-input { width:100%; padding:9px 11px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:14px; font-family:'Inter',sans-serif; outline:none; box-sizing:border-box; }
        .sp-input:focus { border-color:rgba(204,0,0,0.5); }
        .sp-select { width:100%; padding:9px 11px; background:rgba(14,14,14,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:#fff; font-size:14px; font-family:'Inter',sans-serif; outline:none; }
        .sp-label { display:block; font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:5px; font-family:'Montserrat',sans-serif; }
        .sp-btn { padding:8px 14px; border:none; border-radius:5px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; }
        .sp-card { background:rgba(14,14,14,0.9); border:1px solid rgba(255,255,255,0.07); border-radius:8px; padding:18px; }
        .sp-section { font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.25); font-family:'Montserrat',sans-serif; margin-bottom:14px; }
        .sp-toggle { display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:6px; cursor:pointer; }
        .sp-toggle-dot { width:36px; height:20px; border-radius:10px; transition:background 0.2s; position:relative; flex-shrink:0; }
        .sp-toggle-dot::after { content:''; position:absolute; width:16px; height:16px; background:#fff; border-radius:50%; top:2px; transition:left 0.2s; }
        @media(max-width:700px){.sp-cols{flex-direction:column!important;}}
      `}</style>

      <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Nav ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { href: "/calculadoras",              label: "Índices",         icon: "📊" },
            { href: "/calculadoras/operacion",    label: "Costos de Op.",   icon: "📋" },
            { href: "/calculadoras/rentabilidad", label: "Rentabilidad",    icon: "📈" },
            { href: "/calculadoras/credito",      label: "Crédito Hipot.",  icon: "🏦" },
            { href: "/calculadoras/alquiler",     label: "Ajuste Alquiler", icon: "🏠" },
            { href: "/calculadoras/split",        label: "Split Honorarios",icon: "🤝", active: true },
          ].map(({ href, label, icon, active }) => (
            <Link key={href} href={href} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 6, fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
              letterSpacing: "0.06em", textDecoration: "none", transition: "all 0.15s",
              background: active ? "rgba(204,0,0,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${active ? "rgba(204,0,0,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: active ? "#cc0000" : "rgba(255,255,255,0.5)",
            }}><span>{icon}</span>{label}</Link>
          ))}
        </div>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: "#fff" }}>
              Split de <span style={{ color: "#cc0000" }}>Honorarios</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
              Co-broking, impuestos y net al corredor
            </div>
          </div>
          <button className="sp-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }} onClick={pdfExport}>
            ↓ Exportar PDF
          </button>
        </div>

        {/* ── Layout ── */}
        <div className="sp-cols" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

          {/* ── Inputs ── */}
          <div style={{ flex: "0 0 320px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Operación */}
            <div className="sp-card">
              <div className="sp-section">Tipo de operación</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {(["venta","locacion"] as const).map(t => (
                  <button key={t} className="sp-btn" style={{
                    flex: 1,
                    background: tipoOp === t ? "rgba(204,0,0,0.12)" : "rgba(255,255,255,0.04)",
                    color: tipoOp === t ? "#cc0000" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${tipoOp === t ? "rgba(204,0,0,0.35)" : "rgba(255,255,255,0.08)"}`,
                  }} onClick={() => setTipoOp(t)}>
                    {t === "venta" ? "🏠 Compraventa" : "📋 Locación"}
                  </button>
                ))}
              </div>

              {tipoOp === "venta" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="sp-label">Precio de venta</label>
                      <input className="sp-input" type="text" inputMode="numeric" value={precio} onChange={e => setPrecio(e.target.value.replace(/[^0-9,.]/g,""))} />
                    </div>
                    <div>
                      <label className="sp-label">Moneda</label>
                      <select className="sp-select" value={moneda} onChange={e => setMoneda(e.target.value as Moneda)}>
                        <option value="USD">USD</option>
                        <option value="ARS">ARS</option>
                      </select>
                    </div>
                  </div>
                  {moneda === "USD" && (
                    <div style={{ marginBottom: 12 }}>
                      <label className="sp-label">Dólar blue (ARS)</label>
                      <input className="sp-input" type="text" inputMode="numeric" value={dolarBlue} onChange={e => setDolarBlue(e.target.value.replace(/[^0-9]/g,""))} />
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label className="sp-label">Hon. comprador (%)</label>
                      <input className="sp-input" type="text" inputMode="decimal" value={honComprador} onChange={e => setHonComprador(e.target.value.replace(/[^0-9,.]/g,""))} />
                    </div>
                    <div>
                      <label className="sp-label">Hon. vendedor (%)</label>
                      <input className="sp-input" type="text" inputMode="decimal" value={honVendedor} onChange={e => setHonVendedor(e.target.value.replace(/[^0-9,.]/g,""))} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 4, fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>
                    Total bruto: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{fmtResult(calc.honBruto)}</strong> ({fmtPct(num(honComprador) + num(honVendedor))})
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label className="sp-label">Alquiler mensual (ARS)</label>
                    <input className="sp-input" type="text" inputMode="numeric" value={alquiler} onChange={e => setAlquiler(e.target.value.replace(/[^0-9,.]/g,""))} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label className="sp-label">Meses locatario</label>
                      <input className="sp-input" type="number" step="0.5" min="0" value={mesesLocatario} onChange={e => setMesesLocatario(e.target.value)} />
                    </div>
                    <div>
                      <label className="sp-label">Meses propietario</label>
                      <input className="sp-input" type="number" step="0.5" min="0" value={mesesPropietario} onChange={e => setMesesPropietario(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 4, fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>
                    Total bruto: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{fmtARS(calc.honBruto)}</strong>
                  </div>
                </>
              )}
            </div>

            {/* Co-broking */}
            <div className="sp-card">
              <div className="sp-section">Co-broking</div>
              <div className="sp-toggle" onClick={() => setEsCoBroke(v => !v)}>
                <div className="sp-toggle-dot" style={{
                  background: esCoBroke ? "#cc0000" : "rgba(255,255,255,0.15)",
                }}>
                  <div style={{ position: "absolute", width: 16, height: 16, background: "#fff", borderRadius: "50%", top: 2, left: esCoBroke ? 18 : 2, transition: "left 0.2s" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "#fff", fontFamily: "Inter,sans-serif", fontWeight: 500 }}>Operación compartida</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>Dos inmobiliarias participan</div>
                </div>
              </div>
              {esCoBroke && (
                <div style={{ marginTop: 12 }}>
                  <label className="sp-label">% que recibe mi oficina</label>
                  <input className="sp-input" type="text" inputMode="decimal" value={pctMiOficina} onChange={e => setPctMiOficina(e.target.value.replace(/[^0-9,.]/g,""))} />
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 5, fontFamily: "Inter,sans-serif" }}>
                    Otra oficina recibe: {100 - Math.min(100, num(pctMiOficina))}% · {fmtResult(calc.otraOficinaBruto)}
                  </div>
                </div>
              )}
            </div>

            {/* Split interno */}
            <div className="sp-card">
              <div className="sp-section">Split interno</div>
              <div style={{ marginBottom: 12 }}>
                <label className="sp-label">% al corredor (sobre neto de mi oficina)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min="0" max="100" step="5" value={splitCorredor}
                    onChange={e => setSplitCorredor(e.target.value)}
                    style={{ flex: 1, accentColor: "#cc0000" }} />
                  <input className="sp-input" type="text" inputMode="numeric" value={splitCorredor}
                    onChange={e => setSplitCorredor(e.target.value.replace(/[^0-9]/g,""))}
                    style={{ width: 56, textAlign: "center", padding: "6px 8px" }} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>%</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 5, fontFamily: "Inter,sans-serif" }}>
                  Oficina retiene: {100 - Math.min(100, num(splitCorredor))}%
                </div>
              </div>

              <div className="sp-toggle" style={{ marginTop: 8 }} onClick={() => setHayColega(v => !v)}>
                <div className="sp-toggle-dot" style={{ background: hayColega ? "#f59e0b" : "rgba(255,255,255,0.15)" }}>
                  <div style={{ position: "absolute", width: 16, height: 16, background: "#fff", borderRadius: "50%", top: 2, left: hayColega ? 18 : 2, transition: "left 0.2s" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "#fff", fontFamily: "Inter,sans-serif", fontWeight: 500 }}>Comparto con colega</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>Mismo equipo / misma oficina</div>
                </div>
              </div>
              {hayColega && (
                <div style={{ marginTop: 12 }}>
                  <label className="sp-label">% al colega (sobre mi parte)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="range" min="0" max="100" step="5" value={splitColega}
                      onChange={e => setSplitColega(e.target.value)}
                      style={{ flex: 1, accentColor: "#f59e0b" }} />
                    <input className="sp-input" type="text" inputMode="numeric" value={splitColega}
                      onChange={e => setSplitColega(e.target.value.replace(/[^0-9]/g,""))}
                      style={{ width: 56, textAlign: "center", padding: "6px 8px" }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Impuestos */}
            <div className="sp-card">
              <div className="sp-section">Impuestos sobre honorarios</div>
              <div className="sp-toggle" onClick={() => setAplicarImpuestos(v => !v)}>
                <div className="sp-toggle-dot" style={{ background: aplicarImpuestos ? "#cc0000" : "rgba(255,255,255,0.15)" }}>
                  <div style={{ position: "absolute", width: 16, height: 16, background: "#fff", borderRadius: "50%", top: 2, left: aplicarImpuestos ? 18 : 2, transition: "left 0.2s" }} />
                </div>
                <div style={{ fontSize: 13, color: "#fff", fontFamily: "Inter,sans-serif", fontWeight: 500 }}>Aplicar IIBB + IVA</div>
              </div>
              {aplicarImpuestos && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <div>
                    <label className="sp-label">IIBB (%)</label>
                    <input className="sp-input" type="text" inputMode="decimal" value={iibb} onChange={e => setIibb(e.target.value.replace(/[^0-9,.]/g,""))} />
                  </div>
                  <div>
                    <label className="sp-label">IVA (%)</label>
                    <input className="sp-input" type="text" inputMode="decimal" value={iva} onChange={e => setIva(e.target.value.replace(/[^0-9,.]/g,""))} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Resultados ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* KPIs principales */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="sp-card" style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Honorario bruto</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>{fmtResult(calc.honBruto)}</div>
                {moneda === "USD" && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", marginTop: 4 }}>{fmtARS(calc.honBrutoARS)}</div>
                )}
              </div>
              <div className="sp-card" style={{ textAlign: "center", border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.05)" }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(34,197,94,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Yo cobro neto</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#22c55e" }}>{fmtResult(calc.miCorredorNeto)}</div>
                {moneda === "USD" && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", marginTop: 4 }}>{fmtARS(calc.miCorredorNetoARS)}</div>
                )}
              </div>
            </div>

            {/* Desglose completo */}
            <div className="sp-card">
              <div className="sp-section">Desglose completo</div>

              {resultRow("Honorario bruto total", fmtResult(calc.honBruto), "#fff")}

              {esCoBroke && (
                <>
                  {resultRow(`Mi oficina (${pctMiOficina}% del total)`, fmtResult(calc.miOficinaBruto), "#fff")}
                  {resultRow(`Otra oficina (${100 - Math.min(100, num(pctMiOficina))}%)`, fmtResult(calc.otraOficinaBruto), "rgba(255,255,255,0.4)")}
                </>
              )}

              {aplicarImpuestos && (
                <>
                  <div style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Impuestos de mi oficina</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>IIBB ({iibb}%)</span>
                      <span style={{ fontSize: 12, color: "#ef4444", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>− {fmtResult(calc.miOficinaIIBB)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>IVA ({iva}% s/ base+IIBB)</span>
                      <span style={{ fontSize: 12, color: "#ef4444", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>− {fmtResult(calc.miOficinaIVA)}</span>
                    </div>
                  </div>
                </>
              )}

              {resultRow("Mi oficina neta (post-impuestos)", fmtResult(calc.miOficinaNeta), "#fff")}

              <div style={{ margin: "8px 0", height: 1, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Split interno</div>

              {resultRow(
                `Corredor recibe (${splitCorredor}% de neta)`,
                fmtResult(hayColega ? calc.miCorredorNeto + calc.coleganeto : calc.miCorredorNeto),
                "#22c55e"
              )}

              {hayColega && (
                <>
                  {resultRow(`Yo (${100-num(splitColega)}% de mi parte)`, fmtResult(calc.miCorredorNeto), "#22c55e", "Mi participación neta")}
                  {resultRow(`Colega (${splitColega}%)`, fmtResult(calc.coleganeto), "#f59e0b")}
                </>
              )}

              {resultRow(`Oficina retiene (${100 - num(splitCorredor)}%)`, fmtResult(calc.miOficinaRetiene), "rgba(255,255,255,0.5)")}
            </div>

            {/* Diagrama visual */}
            <div className="sp-card">
              <div className="sp-section">Distribución visual</div>
              {(() => {
                const total = calc.honBruto || 1;
                const bars = [
                  { label: "Yo", value: calc.miCorredorNeto, color: "#22c55e" },
                  ...(hayColega ? [{ label: "Colega", value: calc.coleganeto, color: "#f59e0b" }] : []),
                  { label: "Impuestos", value: calc.miOficinaIIBB + calc.miOficinaIVA, color: "#ef4444" },
                  { label: "Mi oficina", value: calc.miOficinaRetiene, color: "#3b82f6" },
                  ...(esCoBroke ? [{ label: "Otra oficina", value: calc.otraOficinaBruto, color: "#6b7280" }] : []),
                ];
                return (
                  <>
                    {/* Barra apilada */}
                    <div style={{ display: "flex", height: 28, borderRadius: 5, overflow: "hidden", marginBottom: 14 }}>
                      {bars.map(b => {
                        const pct = (b.value / total) * 100;
                        return (
                          <div key={b.label} title={`${b.label}: ${fmtPct(pct)}`}
                            style={{ width: `${pct}%`, background: b.color, transition: "width 0.4s" }} />
                        );
                      })}
                    </div>
                    {/* Leyenda */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                      {bars.map(b => {
                        const pct = total > 0 ? (b.value / total) * 100 : 0;
                        return (
                          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 10, height: 10, background: b.color, borderRadius: 2 }} />
                            <span style={{ fontSize: 11, fontFamily: "Inter,sans-serif", color: "rgba(255,255,255,0.6)" }}>
                              {b.label} <strong style={{ color: b.color }}>{fmtPct(pct)}</strong> ({fmtResult(b.value)})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
