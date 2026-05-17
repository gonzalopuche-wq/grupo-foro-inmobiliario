"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtUSD(n: number) {
  return `USD ${fmt(Math.round(n))}`;
}

function calcCuota(capital: number, tasaAnual: number, anos: number): number {
  if (capital <= 0 || anos <= 0) return 0;
  const tasaMes = tasaAnual / 100 / 12;
  const n = anos * 12;
  if (tasaMes === 0) return capital / n;
  return capital * tasaMes * Math.pow(1 + tasaMes, n) / (Math.pow(1 + tasaMes, n) - 1);
}

interface FilaAnual {
  ano: number;
  rentaBruta: number;
  perdidaVacancia: number;
  rentaEfectiva: number;
  opex: number;
  noi: number;
  servDeuda: number;
  cfPreImp: number;
  impuesto: number;
  cfPostImp: number;
  cfAcum: number;
  saldoDeuda: number;
  valorProp: number;
  equity: number;
}

export default function CashFlowPage() {
  // Propiedad
  const [valorCompra, setValorCompra] = useState(200000);
  const [costosCompra, setCostosCompra] = useState(4); // % del valor
  const [enganche, setEnganche] = useState(30); // % LTV propio
  // Financiamiento
  const [tasaHip, setTasaHip] = useState(8.5); // % anual
  const [plazoHip, setPlazoHip] = useState(20);
  // Renta
  const [alqMensual, setAlqMensual] = useState(1000);
  const [crecRenta, setCrecRenta] = useState(3); // % anual
  const [vacancia, setVacancia] = useState(8); // %
  // Gastos
  const [opexPct, setOpexPct] = useState(25); // % del NOI bruto (antes de vacancia)
  const [crecOpex, setCrecOpex] = useState(4); // % anual
  // Apreciación y venta
  const [apreciacion, setApreciacion] = useState(3); // % anual
  const [horizonte, setHorizonte] = useState(10);
  const [capRateSalida, setCapRateSalida] = useState(5.5); // % para valuar al salir
  const [costoVenta, setCostoVenta] = useState(3); // % del valor de venta
  // Impuesto
  const [impRenta, setImpRenta] = useState(15); // % sobre CF positivo
  const [activeTab, setActiveTab] = useState<"resumen" | "tabla" | "grafico">("resumen");

  const capitalDeuda = useMemo(() => valorCompra * (1 - enganche / 100), [valorCompra, enganche]);
  const capitalPropio = useMemo(() => valorCompra * (enganche / 100) + valorCompra * (costosCompra / 100), [valorCompra, enganche, costosCompra]);
  const cuotaMensual = useMemo(() => calcCuota(capitalDeuda, tasaHip, plazoHip), [capitalDeuda, tasaHip, plazoHip]);

  const proyeccion = useMemo<FilaAnual[]>(() => {
    const filas: FilaAnual[] = [];
    let saldoDeuda = capitalDeuda;
    let cfAcum = -capitalPropio;
    const tasaMes = tasaHip / 100 / 12;

    for (let ano = 1; ano <= horizonte; ano++) {
      const rentaBruta = alqMensual * 12 * Math.pow(1 + crecRenta / 100, ano - 1);
      const perdidaVacancia = rentaBruta * (vacancia / 100);
      const rentaEfectiva = rentaBruta - perdidaVacancia;
      const opexBase = valorCompra * (opexPct / 100) * Math.pow(1 + crecOpex / 100, ano - 1);
      const opex = Math.min(opexBase, rentaEfectiva * 0.9);
      const noi = rentaEfectiva - opex;
      const servDeudaAnual = cuotaMensual * 12;
      const cfPreImp = noi - servDeudaAnual;
      const impuesto = cfPreImp > 0 ? cfPreImp * (impRenta / 100) : 0;
      const cfPostImp = cfPreImp - impuesto;
      cfAcum += cfPostImp;

      // Amortización deuda
      let nuevoSaldo = saldoDeuda;
      for (let m = 0; m < 12; m++) {
        const interes = nuevoSaldo * tasaMes;
        const amort = cuotaMensual - interes;
        nuevoSaldo = Math.max(0, nuevoSaldo - amort);
      }
      saldoDeuda = nuevoSaldo;

      const valorProp = valorCompra * Math.pow(1 + apreciacion / 100, ano);
      const equity = valorProp - saldoDeuda;

      filas.push({ ano, rentaBruta, perdidaVacancia, rentaEfectiva, opex, noi, servDeuda: servDeudaAnual, cfPreImp, impuesto, cfPostImp, cfAcum, saldoDeuda, valorProp, equity });
    }
    return filas;
  }, [valorCompra, enganche, costosCompra, tasaHip, plazoHip, alqMensual, crecRenta, vacancia, opexPct, crecOpex, apreciacion, horizonte, cuotaMensual, capitalDeuda, capitalPropio, impRenta]);

  const ultima = proyeccion[proyeccion.length - 1];
  const valorVentaNeto = ultima ? ultima.valorProp * (1 - costoVenta / 100) - ultima.saldoDeuda : 0;
  const retornoTotal = ultima ? ultima.cfAcum + valorVentaNeto : 0;
  const roi = capitalPropio > 0 ? (retornoTotal / capitalPropio) * 100 : 0;
  const roiAnualizado = capitalPropio > 0 ? (Math.pow(1 + retornoTotal / capitalPropio, 1 / horizonte) - 1) * 100 : 0;
  const dscr = ultima ? ultima.noi / (cuotaMensual * 12) : 0;
  const rentaNeta = valorCompra > 0 && proyeccion.length > 0 ? (proyeccion[0].noi / valorCompra) * 100 : 0;

  // TIR (Newton-Raphson)
  const tir = useMemo(() => {
    const flujos = [-capitalPropio, ...proyeccion.map((f, i) => {
      const esUltimo = i === proyeccion.length - 1;
      return f.cfPostImp + (esUltimo ? valorVentaNeto : 0);
    })];
    let r = 0.1;
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0, dnpv = 0;
      flujos.forEach((cf, t) => {
        npv += cf / Math.pow(1 + r, t);
        dnpv -= t * cf / Math.pow(1 + r, t + 1);
      });
      if (Math.abs(dnpv) < 1e-10) break;
      const nr = r - npv / dnpv;
      if (Math.abs(nr - r) < 1e-7) { r = nr; break; }
      r = nr;
    }
    return isFinite(r) && r > -1 ? r * 100 : null;
  }, [proyeccion, capitalPropio, valorVentaNeto]);

  const maxCF = Math.max(...proyeccion.map(f => Math.abs(f.cfPostImp)), 1);
  const maxVal = Math.max(...proyeccion.map(f => f.valorProp), 1);

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cash Flow Proyectado</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;color:#222;font-size:12px}
    h1{font-size:20px;margin-bottom:4px}h2{font-size:14px;color:#555;margin:16px 0 6px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#f5f5f5;padding:6px;text-align:right;font-size:10px}th:first-child{text-align:left}
    td{padding:5px 6px;border-bottom:1px solid #eee;text-align:right}td:first-child{text-align:left;font-weight:700}
    .kpi{display:inline-block;margin:4px 8px 4px 0;padding:8px 14px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px}
    .kpi-v{font-size:20px;font-weight:700;color:#2563eb}.kpi-l{font-size:10px;color:#888}
    </style></head><body>
    <h1>Proyección Cash Flow — ${horizonte} años</h1>
    <p>Propiedad USD ${fmt(valorCompra)} · Alquiler USD ${fmt(alqMensual)}/mes · Enganche ${enganche}%</p>
    <h2>Resumen</h2>
    <div>
      <div class="kpi"><div class="kpi-v">${fmtUSD(capitalPropio)}</div><div class="kpi-l">Capital invertido</div></div>
      <div class="kpi"><div class="kpi-v">${tir ? tir.toFixed(1) + "%" : "—"}</div><div class="kpi-l">TIR</div></div>
      <div class="kpi"><div class="kpi-v">${roiAnualizado.toFixed(1)}%</div><div class="kpi-l">ROI anualizado</div></div>
      <div class="kpi"><div class="kpi-v">${fmtUSD(retornoTotal)}</div><div class="kpi-l">Retorno total</div></div>
      <div class="kpi"><div class="kpi-v">${rentaNeta.toFixed(1)}%</div><div class="kpi-l">Renta neta año 1</div></div>
      <div class="kpi"><div class="kpi-v">${dscr.toFixed(2)}x</div><div class="kpi-l">DSCR</div></div>
    </div>
    <h2>Flujos anuales</h2>
    <table><thead><tr>
      <th>Año</th><th>Renta bruta</th><th>NOI</th><th>Serv. deuda</th><th>CF pre-imp</th><th>CF post-imp</th><th>CF acum</th><th>Valor prop</th><th>Equity</th>
    </tr></thead><tbody>
    ${proyeccion.map(f => `<tr>
      <td>${f.ano}</td>
      <td>USD ${fmt(f.rentaBruta)}</td>
      <td>USD ${fmt(f.noi)}</td>
      <td>USD ${fmt(f.servDeuda)}</td>
      <td style="color:${f.cfPreImp >= 0 ? "#16a34a" : "#dc2626"}">USD ${fmt(f.cfPreImp)}</td>
      <td style="color:${f.cfPostImp >= 0 ? "#16a34a" : "#dc2626"}">USD ${fmt(f.cfPostImp)}</td>
      <td style="color:${f.cfAcum >= 0 ? "#16a34a" : "#dc2626"}">USD ${fmt(f.cfAcum)}</td>
      <td>USD ${fmt(f.valorProp)}</td>
      <td>USD ${fmt(f.equity)}</td>
    </tr>`).join("")}
    </tbody></table>
    <p style="font-size:10px;color:#999">GFI® Grupo Foro Inmobiliario · TIR calculada post-impuesto incluyendo venta al año ${horizonte}</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  const inputStyle = { background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 14, width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { fontSize: 11, color: "#6b7280", display: "block" as const, marginBottom: 3 };
  const cardStyle = { background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>📊 Proyección Cash Flow</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Modelo DCF a {horizonte} años — flujos anuales post-impuesto e IRR</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
            <button onClick={exportPDF} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#e5e5e5", padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
          {/* Panel de inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Propiedad</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div><label style={labelStyle}>Valor de compra (USD)</label>
                  <input type="number" value={valorCompra} onChange={e => setValorCompra(parseFloat(e.target.value) || 0)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Costos de compra (%)</label>
                  <input type="number" value={costosCompra} onChange={e => setCostosCompra(parseFloat(e.target.value) || 0)} step={0.5} style={inputStyle} /></div>
                <div><label style={labelStyle}>Enganche / equity inicial (%)</label>
                  <input type="number" value={enganche} onChange={e => setEnganche(parseFloat(e.target.value) || 0)} step={5} style={inputStyle} /></div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Financiamiento</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div><label style={labelStyle}>Tasa hipotecaria anual (%)</label>
                  <input type="number" value={tasaHip} onChange={e => setTasaHip(parseFloat(e.target.value) || 0)} step={0.25} style={inputStyle} /></div>
                <div><label style={labelStyle}>Plazo (años)</label>
                  <input type="number" value={plazoHip} onChange={e => setPlazoHip(parseFloat(e.target.value) || 1)} style={inputStyle} /></div>
                <div style={{ padding: "8px 10px", background: "#0a0a0a", borderRadius: 6, fontSize: 12, color: "#6b7280" }}>
                  Deuda: {fmtUSD(capitalDeuda)} · Cuota: USD {fmt(cuotaMensual)}/mes
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Ingresos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div><label style={labelStyle}>Alquiler inicial (USD/mes)</label>
                  <input type="number" value={alqMensual} onChange={e => setAlqMensual(parseFloat(e.target.value) || 0)} style={inputStyle} /></div>
                <div><label style={labelStyle}>Crecimiento anual renta (%)</label>
                  <input type="number" value={crecRenta} onChange={e => setCrecRenta(parseFloat(e.target.value) || 0)} step={0.5} style={inputStyle} /></div>
                <div><label style={labelStyle}>Vacancia (%)</label>
                  <input type="number" value={vacancia} onChange={e => setVacancia(parseFloat(e.target.value) || 0)} step={1} style={inputStyle} /></div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Gastos y salida</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div><label style={labelStyle}>Opex (% del valor/año)</label>
                  <input type="number" value={opexPct} onChange={e => setOpexPct(parseFloat(e.target.value) || 0)} step={0.5} style={inputStyle} /></div>
                <div><label style={labelStyle}>Crecimiento opex anual (%)</label>
                  <input type="number" value={crecOpex} onChange={e => setCrecOpex(parseFloat(e.target.value) || 0)} step={0.5} style={inputStyle} /></div>
                <div><label style={labelStyle}>Apreciación anual (%)</label>
                  <input type="number" value={apreciacion} onChange={e => setApreciacion(parseFloat(e.target.value) || 0)} step={0.5} style={inputStyle} /></div>
                <div><label style={labelStyle}>Horizonte (años)</label>
                  <input type="number" value={horizonte} onChange={e => setHorizonte(Math.min(30, Math.max(1, parseFloat(e.target.value) || 10)))} style={inputStyle} /></div>
                <div><label style={labelStyle}>Cap rate de salida (%)</label>
                  <input type="number" value={capRateSalida} onChange={e => setCapRateSalida(parseFloat(e.target.value) || 0)} step={0.25} style={inputStyle} /></div>
                <div><label style={labelStyle}>Costo de venta (%)</label>
                  <input type="number" value={costoVenta} onChange={e => setCostoVenta(parseFloat(e.target.value) || 0)} step={0.5} style={inputStyle} /></div>
                <div><label style={labelStyle}>Impuesto sobre cash flow (%)</label>
                  <input type="number" value={impRenta} onChange={e => setImpRenta(parseFloat(e.target.value) || 0)} step={1} style={inputStyle} /></div>
              </div>
            </div>
          </div>

          {/* Panel de resultados */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* KPIs principales */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { label: "Capital invertido", value: fmtUSD(capitalPropio), color: "#e5e5e5" },
                { label: "TIR post-impuesto", value: tir ? `${tir.toFixed(1)}%` : "—", color: tir && tir > 8 ? "#22c55e" : tir && tir > 4 ? "#f97316" : "#cc0000" },
                { label: "ROI anualizado", value: `${roiAnualizado.toFixed(1)}%`, color: roiAnualizado > 8 ? "#22c55e" : roiAnualizado > 4 ? "#f97316" : "#cc0000" },
                { label: "Retorno total", value: fmtUSD(retornoTotal), color: retornoTotal > 0 ? "#22c55e" : "#cc0000" },
                { label: "Renta neta año 1", value: `${rentaNeta.toFixed(1)}%`, color: rentaNeta > 5 ? "#22c55e" : rentaNeta > 3 ? "#f97316" : "#cc0000" },
                { label: "DSCR", value: `${dscr.toFixed(2)}x`, color: dscr >= 1.25 ? "#22c55e" : dscr >= 1 ? "#f97316" : "#cc0000" },
                { label: `Valor prop. año ${horizonte}`, value: fmtUSD(ultima?.valorProp ?? 0), color: "#a855f7" },
                { label: `Equity año ${horizonte}`, value: fmtUSD(ultima?.equity ?? 0), color: "#3b82f6" },
                { label: "Venta neta est.", value: fmtUSD(valorVentaNeto), color: "#22c55e" },
              ].map(k => (
                <div key={k.label} style={{ ...cardStyle, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 20, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1f2937" }}>
              {(["resumen", "tabla", "grafico"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  style={{ padding: "8px 18px", background: "none", border: "none", borderBottom: `2px solid ${activeTab === t ? "#cc0000" : "transparent"}`, color: activeTab === t ? "#fff" : "#6b7280", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                  {t === "resumen" ? "Resumen" : t === "tabla" ? "Tabla Anual" : "Gráfico"}
                </button>
              ))}
            </div>

            {/* Resumen */}
            {activeTab === "resumen" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={cardStyle}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Flujo del horizonte</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>CF operativo acum.</div>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: (ultima?.cfAcum ?? 0) + capitalPropio >= 0 ? "#22c55e" : "#cc0000" }}>
                        {fmtUSD((ultima?.cfAcum ?? 0) + capitalPropio)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>Ganancia de capital</div>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: "#22c55e" }}>
                        {fmtUSD(valorVentaNeto)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>Retorno total</div>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: retornoTotal > 0 ? "#22c55e" : "#cc0000" }}>
                        {fmtUSD(retornoTotal)}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={cardStyle}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Año 1 detallado</div>
                  {proyeccion[0] && (() => { const f = proyeccion[0]; return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                      {[
                        ["Renta bruta anual", fmtUSD(f.rentaBruta)],
                        ["Vacancia", `–${fmtUSD(f.perdidaVacancia)}`],
                        ["Renta efectiva", fmtUSD(f.rentaEfectiva)],
                        ["Gastos operativos", `–${fmtUSD(f.opex)}`],
                        ["NOI", fmtUSD(f.noi)],
                        ["Servicio de deuda", `–${fmtUSD(f.servDeuda)}`],
                        ["Cash flow pre-imp", `${f.cfPreImp >= 0 ? "+" : ""}${fmtUSD(f.cfPreImp)}`],
                        ["Impuesto", f.impuesto > 0 ? `–${fmtUSD(f.impuesto)}` : "—"],
                        ["Cash flow post-imp", `${f.cfPostImp >= 0 ? "+" : ""}${fmtUSD(f.cfPostImp)}`],
                      ].map(([lbl, val]) => (
                        <div key={lbl as string} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 5, borderBottom: "1px solid #1a1a1a" }}>
                          <span style={{ color: "#6b7280" }}>{lbl}</span>
                          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  ); })()}
                </div>
              </div>
            )}

            {/* Tabla anual */}
            {activeTab === "tabla" && (
              <div style={cardStyle}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {["Año", "Renta bruta", "NOI", "Serv. deuda", "CF pre-imp", "CF post-imp", "CF acum", "Valor prop", "Equity"].map(h => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {proyeccion.map(f => (
                        <tr key={f.ano} style={{ borderBottom: "1px solid #111" }}>
                          <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>{f.ano}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#9ca3af" }}>{fmtUSD(f.rentaBruta)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#9ca3af" }}>{fmtUSD(f.noi)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#6b7280" }}>{fmtUSD(f.servDeuda)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: f.cfPreImp >= 0 ? "#22c55e" : "#cc0000", fontWeight: 600 }}>{f.cfPreImp >= 0 ? "+" : ""}{fmtUSD(f.cfPreImp)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: f.cfPostImp >= 0 ? "#22c55e" : "#cc0000", fontWeight: 700 }}>{f.cfPostImp >= 0 ? "+" : ""}{fmtUSD(f.cfPostImp)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: f.cfAcum >= 0 ? "#22c55e" : "#cc0000" }}>{f.cfAcum >= 0 ? "+" : ""}{fmtUSD(f.cfAcum)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#a855f7" }}>{fmtUSD(f.valorProp)}</td>
                          <td style={{ padding: "7px 8px", textAlign: "right", color: "#3b82f6" }}>{fmtUSD(f.equity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Gráfico */}
            {activeTab === "grafico" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={cardStyle}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#6b7280", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.1em" }}>Cash Flow Anual (post-impuesto)</div>
                  <svg width="100%" height={160} viewBox={`0 0 ${horizonte * 50 + 20} 160`} preserveAspectRatio="none">
                    {proyeccion.map((f, i) => {
                      const h = Math.abs(f.cfPostImp) / maxCF * 120;
                      const positive = f.cfPostImp >= 0;
                      const x = i * 50 + 10;
                      return (
                        <g key={i}>
                          <rect x={x} y={positive ? 130 - h : 130} width={36} height={h} fill={positive ? "#22c55e88" : "#cc000088"} rx={2} />
                          <line x1={x} x2={x + 36} y1={130} y2={130} stroke="#333" strokeWidth={1} />
                          <text x={x + 18} y={positive ? 130 - h - 4 : 130 + h + 10} textAnchor="middle" fill={positive ? "#22c55e" : "#cc0000"} fontSize={8} fontFamily="Montserrat">
                            {f.cfPostImp >= 0 ? "+" : ""}{Math.round(f.cfPostImp / 1000)}k
                          </text>
                          <text x={x + 18} y={152} textAnchor="middle" fill="#6b7280" fontSize={8} fontFamily="Montserrat">{f.ano}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div style={cardStyle}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#6b7280", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.1em" }}>Evolución Valor Propiedad vs Deuda</div>
                  <svg width="100%" height={160} viewBox={`0 0 ${horizonte * 50 + 20} 160`} preserveAspectRatio="none">
                    <polyline
                      points={proyeccion.map((f, i) => `${i * 50 + 28},${140 - (f.valorProp / maxVal) * 120}`).join(" ")}
                      fill="none" stroke="#a855f7" strokeWidth={2} />
                    <polyline
                      points={proyeccion.map((f, i) => `${i * 50 + 28},${140 - (f.equity / maxVal) * 120}`).join(" ")}
                      fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" />
                    <polyline
                      points={proyeccion.map((f, i) => `${i * 50 + 28},${140 - (f.saldoDeuda / maxVal) * 120}`).join(" ")}
                      fill="none" stroke="#cc000066" strokeWidth={1.5} strokeDasharray="2 2" />
                    {proyeccion.map((f, i) => (
                      <text key={i} x={i * 50 + 28} y={152} textAnchor="middle" fill="#6b7280" fontSize={8} fontFamily="Montserrat">{f.ano}</text>
                    ))}
                  </svg>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, marginTop: 8 }}>
                    <span style={{ color: "#a855f7" }}>— Valor prop</span>
                    <span style={{ color: "#3b82f6" }}>-- Equity</span>
                    <span style={{ color: "#cc0000" }}>-- Deuda</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
