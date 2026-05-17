"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const fmt = (n: number, d = 0) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = (n: number) => `USD ${fmt(Math.abs(n), 0)}`;
const fmtPct = (n: number) => `${fmt(n, 2)}%`;

export default function CalculadoraFlipping() {
  // Compra
  const [precioCompra, setPrecioCompra] = useState<string>("80000");
  const [gastosCompra, setGastosCompra] = useState<string>("4");      // % del precio
  const [comisionCompra, setComisionCompra] = useState<string>("3");  // % comisión corredor compra

  // Reforma
  const [costoReforma, setCostoReforma] = useState<string>("20000");
  const [mesesObra, setMesesObra] = useState<string>("6");
  const [gastosObra, setGastosObra] = useState<string>("300");        // USD/mes servicios, impuestos

  // Financiamiento
  const [capitalPropio, setCapitalPropio] = useState<string>("70");   // % del total
  const [tasaFinanc, setTasaFinanc] = useState<string>("12");         // TNA USD / ARS
  const [mesesFinanc, setMesesFinanc] = useState<string>("12");

  // Venta
  const [precioVenta, setPrecioVenta] = useState<string>("130000");
  const [mesesComercializ, setMesesComercializ] = useState<string>("3");
  const [comisionVenta, setComisionVenta] = useState<string>("3");    // % comisión corredor venta
  const [gastosVenta, setGastosVenta] = useState<string>("2");        // % escritura vendedor

  // Alternativa
  const [tasaAlternativa, setTasaAlternativa] = useState<string>("8"); // % anual (plazo fijo en USD, ONs, etc.)

  const r = useMemo(() => {
    const pc = parseFloat(precioCompra) || 0;
    const pv = parseFloat(precioVenta) || 0;
    const reforma = parseFloat(costoReforma) || 0;
    const mObra = parseFloat(mesesObra) || 0;
    const mComercial = parseFloat(mesesComercializ) || 0;
    const gObraUSD = (parseFloat(gastosObra) || 0) * (mObra + mComercial);
    const pctGastosCompra = (parseFloat(gastosCompra) || 0) / 100;
    const pctComisionCompra = (parseFloat(comisionCompra) || 0) / 100;
    const pctComisionVenta = (parseFloat(comisionVenta) || 0) / 100;
    const pctGastosVenta = (parseFloat(gastosVenta) || 0) / 100;
    const pctCapPropio = Math.min((parseFloat(capitalPropio) || 100) / 100, 1);
    const tnaFinanc = (parseFloat(tasaFinanc) || 0) / 100;
    const mFinanc = parseFloat(mesesFinanc) || 0;
    const tasaAlt = (parseFloat(tasaAlternativa) || 0) / 100;

    // Inversión total
    const gastosCompraUSD = pc * pctGastosCompra;
    const comisionCompraUSD = pc * pctComisionCompra;
    const inversionTotal = pc + gastosCompraUSD + comisionCompraUSD + reforma + gObraUSD;

    // Capital propio vs financiado
    const capitalPropioUSD = inversionTotal * pctCapPropio;
    const montoFinanciado = inversionTotal * (1 - pctCapPropio);
    const interesesFinanc = montoFinanciado * (tnaFinanc / 12) * mFinanc;

    // Gastos de venta
    const comisionVentaUSD = pv * pctComisionVenta;
    const gastosVentaUSD = pv * pctGastosVenta;
    const totalGastosVenta = comisionVentaUSD + gastosVentaUSD;

    // Resultados
    const costoTotal = inversionTotal + interesesFinanc + totalGastosVenta;
    const utilidadBruta = pv - pc;
    const utilidadNeta = pv - costoTotal;
    const roiCapitalPropio = capitalPropioUSD > 0 ? (utilidadNeta / capitalPropioUSD) * 100 : 0;
    const mesesTotal = mObra + mComercial;
    const roiAnualizado = mesesTotal > 0 ? (Math.pow(1 + roiCapitalPropio / 100, 12 / mesesTotal) - 1) * 100 : 0;
    const precioMinVenta = costoTotal; // punto de equilibrio

    // Alternativa: si el capital propio estuviera invertido al X% anual
    const rendimientoAlternativa = capitalPropioUSD * tasaAlt * (mesesTotal / 12);
    const ventajaVsAlternativa = utilidadNeta - rendimientoAlternativa;

    // Desglose de costos (para gráfico)
    const costosPie = [
      { label: "Precio compra", val: pc, color: "#cc0000" },
      { label: "Gastos compra + comisión", val: gastosCompraUSD + comisionCompraUSD, color: "#ef4444" },
      { label: "Reforma", val: reforma, color: "#f97316" },
      { label: "Gastos obra/mantenim.", val: gObraUSD, color: "#f59e0b" },
      { label: "Intereses financiamiento", val: interesesFinanc, color: "#a78bfa" },
      { label: "Gastos venta + comisión", val: totalGastosVenta, color: "#3b82f6" },
    ].filter(c => c.val > 0);

    return {
      inversionTotal, costoTotal, utilidadBruta, utilidadNeta,
      roiCapitalPropio, roiAnualizado, precioMinVenta,
      capitalPropioUSD, montoFinanciado, interesesFinanc,
      comisionVentaUSD, gastosVentaUSD, totalGastosVenta,
      gastosCompraUSD, comisionCompraUSD, gObraUSD,
      mesesTotal, rendimientoAlternativa, ventajaVsAlternativa,
      costosPie, pv, pc, reforma,
    };
  }, [precioCompra, precioVenta, costoReforma, mesesObra, mesesComercializ,
    gastosCompra, comisionCompra, comisionVenta, gastosVenta, gastosObra,
    capitalPropio, tasaFinanc, mesesFinanc, tasaAlternativa]);

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, padding: "7px 10px", width: "100%",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4, display: "block",
  };
  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "18px 20px",
  };

  const isProfit = r.utilidadNeta > 0;
  const maxCostBar = Math.max(...r.costosPie.map(c => c.val), 1);

  function InputGroup({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>{label}{suffix ? ` (${suffix})` : ""}</label>
        <input style={inputStyle} type="number" step="any" value={value} onChange={e => onChange(e.target.value)} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Flipping / Renovación</h1>
        <span style={{ background: "#f97316", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>DESARROLLO</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "310px 1fr", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {/* Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Compra */}
          <div style={{ ...cardStyle, borderColor: "rgba(204,0,0,0.2)" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#cc0000", marginBottom: 14 }}>📥 Compra</div>
            <InputGroup label="Precio de compra" value={precioCompra} onChange={setPrecioCompra} suffix="USD" />
            <InputGroup label="Gastos escritura comprador" value={gastosCompra} onChange={setGastosCompra} suffix="% del precio" />
            <InputGroup label="Comisión corredor compra" value={comisionCompra} onChange={setComisionCompra} suffix="%" />
          </div>

          {/* Reforma */}
          <div style={{ ...cardStyle, borderColor: "rgba(249,115,22,0.2)" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f97316", marginBottom: 14 }}>🔨 Reforma</div>
            <InputGroup label="Presupuesto total reforma" value={costoReforma} onChange={setCostoReforma} suffix="USD" />
            <InputGroup label="Duración de la obra" value={mesesObra} onChange={setMesesObra} suffix="meses" />
            <InputGroup label="Gastos mensuales en obra" value={gastosObra} onChange={setGastosObra} suffix="USD/mes" />
          </div>

          {/* Financiamiento */}
          <div style={{ ...cardStyle, borderColor: "rgba(167,139,250,0.2)" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 14 }}>🏦 Financiamiento</div>
            <InputGroup label="Capital propio" value={capitalPropio} onChange={setCapitalPropio} suffix="% de la inversión" />
            <InputGroup label="Tasa financiamiento" value={tasaFinanc} onChange={setTasaFinanc} suffix="TNA %" />
            <InputGroup label="Plazo financiamiento" value={mesesFinanc} onChange={setMesesFinanc} suffix="meses" />
          </div>

          {/* Venta */}
          <div style={{ ...cardStyle, borderColor: "rgba(34,197,94,0.2)" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#22c55e", marginBottom: 14 }}>📤 Venta</div>
            <InputGroup label="Precio de venta estimado" value={precioVenta} onChange={setPrecioVenta} suffix="USD" />
            <InputGroup label="Tiempo de comercialización" value={mesesComercializ} onChange={setMesesComercializ} suffix="meses" />
            <InputGroup label="Comisión corredor venta" value={comisionVenta} onChange={setComisionVenta} suffix="%" />
            <InputGroup label="Gastos escritura vendedor" value={gastosVenta} onChange={setGastosVenta} suffix="%" />
          </div>

          {/* Alternativa */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>📊 Inversión alternativa</div>
            <InputGroup label="Rendimiento anual alternativo" value={tasaAlternativa} onChange={setTasaAlternativa} suffix="% anual" />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>ONs, plazo fijo USD, bono, etc. comparar vs. flipping</div>
          </div>
        </div>

        {/* Resultados */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs principales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {[
              { label: "Utilidad neta", val: (isProfit ? "+" : "") + fmtUSD(r.utilidadNeta), color: isProfit ? "#22c55e" : "#ef4444", big: true },
              { label: "ROI capital propio", val: fmtPct(r.roiCapitalPropio), color: isProfit ? "#22c55e" : "#ef4444", big: false },
              { label: "ROI anualizado", val: fmtPct(r.roiAnualizado), color: isProfit ? "#f59e0b" : "#ef4444", big: false },
              { label: "Duración total", val: `${r.mesesTotal} meses`, color: "rgba(255,255,255,0.6)", big: false },
            ].map((k, i) => (
              <div key={i} style={{ ...cardStyle, textAlign: "center", padding: "16px 12px", borderColor: k.big ? (isProfit ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)") : undefined }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: k.big ? 20 : 18, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.val}</div>
                <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 5 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Punto de equilibrio */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Análisis precio de venta</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Precio mín. (punto equilibrio)", val: fmtUSD(r.precioMinVenta), color: "#f59e0b" },
                { label: "Precio de venta objetivo", val: fmtUSD(r.pv), color: "#22c55e" },
                { label: "Margen sobre punto eq.", val: fmtPct(r.pv > 0 ? ((r.pv - r.precioMinVenta) / r.precioMinVenta) * 100 : 0), color: r.pv >= r.precioMinVenta ? "#22c55e" : "#ef4444" },
              ].map((k, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Montserrat,sans-serif" }}>{k.label}</div>
                </div>
              ))}
            </div>
            {/* Barra precio */}
            <div style={{ position: "relative", height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "visible" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, (r.precioMinVenta / (r.pv * 1.2)) * 100)}%`, background: "#f59e0b", borderRadius: "6px 0 0 6px" }} />
              <div style={{ position: "absolute", left: `${Math.min(100, (r.precioMinVenta / (r.pv * 1.2)) * 100)}%`, top: -4, width: 2, height: 20, background: "#fff" }} />
              <div style={{ position: "absolute", left: `${Math.min(100, (r.pv / (r.pv * 1.2)) * 100)}%`, top: -4, width: 2, height: 20, background: "#22c55e" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
              <span>USD 0</span>
              <span style={{ color: "#f59e0b" }}>PE: {fmtUSD(r.precioMinVenta)}</span>
              <span style={{ color: "#22c55e" }}>Objetivo: {fmtUSD(r.pv)}</span>
            </div>
          </div>

          {/* Desglose de costos */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Desglose de costos totales · {fmtUSD(r.costoTotal)}</div>
            {r.costosPie.map(c => (
              <div key={c.label} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{c.label}</span>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: c.color }}>{fmtUSD(c.val)}</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(c.val / maxCostBar) * 100}%`, background: c.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Flujo de capital */}
            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Flujo de capital</div>
              {[
                { label: "Capital propio invertido", val: fmtUSD(r.capitalPropioUSD), color: "#a78bfa", sign: "-" },
                { label: "Monto financiado", val: fmtUSD(r.montoFinanciado), color: "#a78bfa", sign: "-" },
                { label: "Intereses financiamiento", val: fmtUSD(r.interesesFinanc), color: "#cc0000", sign: "-" },
                { label: "Precio de venta", val: fmtUSD(r.pv), color: "#22c55e", sign: "+" },
                { label: "Gastos venta + comisión", val: fmtUSD(r.totalGastosVenta), color: "#cc0000", sign: "-" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{l.sign} {l.label}</span>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: l.color }}>{l.val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>UTILIDAD NETA</span>
                <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: isProfit ? "#22c55e" : "#ef4444" }}>
                  {isProfit ? "+" : ""}{fmtUSD(r.utilidadNeta)}
                </span>
              </div>
            </div>

            {/* vs Alternativa */}
            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Flipping vs. Inversión alternativa</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Capital propio {fmtUSD(r.capitalPropioUSD)} al {tasaAlternativa}% anual por {r.mesesTotal} meses</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 700, color: "#3b82f6" }}>{fmtUSD(r.rendimientoAlternativa)}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>rendimiento alternativo</div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 12 }} />
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Utilidad neta del flipping</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 700, color: isProfit ? "#22c55e" : "#ef4444" }}>{fmtUSD(r.utilidadNeta)}</div>
              </div>
              <div style={{ background: "#111", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                  {r.ventajaVsAlternativa >= 0 ? "Ventaja del flipping" : "El flipping pierde contra alternativa"}
                </div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: r.ventajaVsAlternativa >= 0 ? "#22c55e" : "#ef4444" }}>
                  {r.ventajaVsAlternativa >= 0 ? "+" : ""}{fmtUSD(r.ventajaVsAlternativa)}
                </div>
              </div>

              {/* Timeline visual */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Timeline del proyecto</div>
                <div style={{ display: "flex", height: 24, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ flex: parseFloat(mesesObra) || 1, background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", fontFamily: "Montserrat,sans-serif" }}>Obra</span>
                  </div>
                  <div style={{ flex: parseFloat(mesesComercializ) || 1, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", fontFamily: "Montserrat,sans-serif" }}>Venta</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                  <span>0</span>
                  <span>{mesesObra}m</span>
                  <span>{r.mesesTotal}m</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
