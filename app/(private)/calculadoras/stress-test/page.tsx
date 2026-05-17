"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface Escenario {
  nombre: string;
  color: string;
  varRenta: number;    // % cambio renta vs base
  varVacancia: number; // puntos porcentuales adicionales
  varOpex: number;     // puntos porcentuales adicionales
  varCapRate: number;  // puntos porcentuales (impacta valuación)
  varApreciacion: number; // puntos porcentuales
}

const ESCENARIOS: Escenario[] = [
  { nombre: "Base",       color: "#22c55e", varRenta: 0,   varVacancia: 0,  varOpex: 0,  varCapRate: 0,    varApreciacion: 0 },
  { nombre: "Moderado",   color: "#f97316", varRenta: -10, varVacancia: 5,  varOpex: 5,  varCapRate: 0.5,  varApreciacion: -2 },
  { nombre: "Severo",     color: "#a855f7", varRenta: -20, varVacancia: 10, varOpex: 10, varCapRate: 1,    varApreciacion: -5 },
  { nombre: "Extremo",    color: "#cc0000", varRenta: -35, varVacancia: 20, varOpex: 15, varCapRate: 2,    varApreciacion: -10 },
];

export default function StressTestPage() {
  const [valorProp, setValorProp] = useState(300000);
  const [alqMensual, setAlqMensual] = useState(1500);
  const [vacancia, setVacancia] = useState(8);
  const [opexPct, setOpexPct] = useState(15);
  const [deuda, setDeuda] = useState(180000);
  const [tasaDeuda, setTasaDeuda] = useState(9);
  const [plazoDeuda, setPlazoDeuda] = useState(240);
  const [capRate, setCapRate] = useState(5);
  const [apreciacion, setApreciacion] = useState(5);
  const [horizonte, setHorizonte] = useState(5);

  const tem = tasaDeuda / 100 / 12;
  const cuotaMensual = deuda > 0 && tem > 0
    ? deuda * tem * Math.pow(1 + tem, plazoDeuda) / (Math.pow(1 + tem, plazoDeuda) - 1)
    : deuda / plazoDeuda;
  const servDeudaAnual = cuotaMensual * 12;

  const analisis = useMemo(() => ESCENARIOS.map(esc => {
    const rentaAdj = alqMensual * (1 + esc.varRenta / 100);
    const vacanciAdj = Math.min(100, vacancia + esc.varVacancia);
    const opexAdj = Math.min(100, opexPct + esc.varOpex);
    const capRateAdj = capRate + esc.varCapRate;
    const aprecAdj = apreciacion + esc.varApreciacion;

    const ingBruto = rentaAdj * 12 * (1 - vacanciAdj / 100);
    const opexAbs = ingBruto * opexAdj / 100;
    const noi = ingBruto - opexAbs;
    const cashFlow = noi - servDeudaAnual;
    const dscr = servDeudaAnual > 0 ? noi / servDeudaAnual : null; // Debt Service Coverage Ratio

    // Valuación ajustada por cap rate
    const valorAdj = capRateAdj > 0 ? (noi / capRateAdj) * 100 : valorProp;
    const perdidaValor = valorProp - valorAdj;

    // ROI a horizonte
    const valorFuturo = valorAdj * Math.pow(1 + aprecAdj / 100, horizonte);
    const noiAcum = noi * horizonte;
    const retorno = noiAcum + valorFuturo - valorProp - servDeudaAnual * horizonte;
    const roi = valorProp > 0 ? (retorno / (valorProp - deuda)) * 100 : 0;

    // Rentabilidad neta
    const rentaNeta = valorProp > 0 ? (noi / valorProp) * 100 : 0;

    // Break-even rent (renta mínima para cubrir deuda)
    const breakEvenNOI = servDeudaAnual;
    const breakEvenRent = opexAdj < 100
      ? (breakEvenNOI / (1 - opexAdj / 100)) / 12 / (1 - vacanciAdj / 100)
      : 0;

    const semaforo = cashFlow >= 0 ? "verde" : cashFlow >= -noi * 0.3 ? "amarillo" : "rojo";

    return { esc, rentaAdj, vacanciAdj, opexAdj, capRateAdj, aprecAdj, ingBruto, opexAbs, noi, cashFlow, dscr, valorAdj, perdidaValor, valorFuturo, retorno, roi, rentaNeta, breakEvenRent, semaforo };
  }), [alqMensual, vacancia, opexPct, capRate, apreciacion, valorProp, deuda, servDeudaAnual, horizonte]);

  const colSemaforo: Record<string, string> = { verde: "#22c55e", amarillo: "#f97316", rojo: "#cc0000" };

  // Breakeven general
  const baseA = analisis[0];
  const breakEvenVacancia = useMemo(() => {
    // máxima vacancia antes de cashflow negativo
    for (let v = vacancia; v <= 100; v++) {
      const ing = alqMensual * 12 * (1 - v / 100);
      const op = ing * opexPct / 100;
      const n = ing - op;
      if (n < servDeudaAnual) return v;
    }
    return 100;
  }, [alqMensual, vacancia, opexPct, servDeudaAnual]);

  const breakEvenRenta = useMemo(() => {
    for (let pct = 0; pct >= -100; pct--) {
      const r = alqMensual * (1 + pct / 100);
      const ing = r * 12 * (1 - vacancia / 100);
      const op = ing * opexPct / 100;
      if (ing - op < servDeudaAnual) return pct;
    }
    return -100;
  }, [alqMensual, vacancia, opexPct, servDeudaAnual]);

  const exportarPDF = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const filas = analisis.map(a => `<tr>
      <td><b>${a.esc.nombre}</b></td>
      <td>USD ${fmt(a.rentaAdj)}/mes</td>
      <td>${a.vacanciAdj.toFixed(0)}%</td>
      <td>USD ${fmt(a.noi)}</td>
      <td style="color:${a.cashFlow >= 0 ? "green" : "red"}">USD ${fmt(a.cashFlow)}</td>
      <td>${a.dscr ? a.dscr.toFixed(2) + "x" : "—"}</td>
      <td>USD ${fmt(a.valorAdj)}</td>
    </tr>`).join("");
    win.document.write(`<html><body style="font-family:sans-serif;padding:24px;font-size:12px">
      <h2>Stress Test — USD ${fmt(valorProp)}</h2>
      <table border="1" cellpadding="4" style="width:100%;border-collapse:collapse">
        <thead><tr><th>Escenario</th><th>Renta</th><th>Vacancia</th><th>NOI anual</th><th>Cash flow</th><th>DSCR</th><th>Valor ajustado</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🔬 Stress Test de Inversión
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
              Simulá qué pasa ante caída de rentas, vacancia alta y suba de tasas
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/calculadoras" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
            <button onClick={exportarPDF} style={{ background: "#cc000022", color: "#cc0000", border: "1px solid #cc000044", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
          </div>
        </div>

        {/* Inputs */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 16 }}>
            {[
              { label: "Valor propiedad (USD)", val: valorProp, set: setValorProp },
              { label: "Alquiler mensual (USD)", val: alqMensual, set: setAlqMensual },
              { label: "Vacancia base (%)", val: vacancia, set: setVacancia, step: 0.5 },
              { label: "OpEx base (%)", val: opexPct, set: setOpexPct, step: 0.5 },
              { label: "Deuda hipoteca (USD)", val: deuda, set: setDeuda },
              { label: "Tasa deuda TNA (%)", val: tasaDeuda, set: setTasaDeuda, step: 0.5 },
              { label: "Plazo restante (meses)", val: plazoDeuda, set: setPlazoDeuda },
              { label: "Cap rate base (%)", val: capRate, set: setCapRate, step: 0.5 },
              { label: "Apreciación base (%/año)", val: apreciacion, set: setApreciacion, step: 1 },
              { label: "Horizonte (años)", val: horizonte, set: setHorizonte },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type="number" value={f.val} step={f.step ?? 1}
                  onChange={e => f.set(parseFloat(e.target.value) || 0)}
                  style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#0f0f0f", borderRadius: 8, fontSize: 12, color: "#6b7280" }}>
            Cuota mensual hipoteca: <strong style={{ color: "#e5e5e5" }}>USD {fmt(cuotaMensual)}</strong> · Servicio anual: <strong style={{ color: "#e5e5e5" }}>USD {fmt(servDeudaAnual)}</strong>
          </div>
        </div>

        {/* Break-even */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 12 }}>📉 Puntos de Quiebre</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f0f0f", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Vacancia máxima sostenible</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: breakEvenVacancia >= 25 ? "#22c55e" : breakEvenVacancia >= 15 ? "#f97316" : "#cc0000" }}>
                  {breakEvenVacancia.toFixed(0)}%
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f0f0f", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Caída máxima de renta</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: breakEvenRenta <= -20 ? "#22c55e" : breakEvenRenta <= -10 ? "#f97316" : "#cc0000" }}>
                  {breakEvenRenta.toFixed(0)}%
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f0f0f", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Renta mínima break-even</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#e5e5e5" }}>
                  USD {fmt(baseA?.breakEvenRent ?? 0)}/mes
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f0f0f", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>DSCR actual (base)</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: (baseA?.dscr ?? 0) >= 1.25 ? "#22c55e" : (baseA?.dscr ?? 0) >= 1 ? "#f97316" : "#cc0000" }}>
                  {baseA?.dscr ? `${baseA.dscr.toFixed(2)}x` : "N/A"}
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 12 }}>🔴 Escenarios — Cash Flow Visual</div>
            {analisis.map(a => {
              const maxAbs = Math.max(...analisis.map(x => Math.abs(x.cashFlow)), 1);
              const barW = Math.abs(a.cashFlow) / maxAbs * 100;
              const positivo = a.cashFlow >= 0;
              return (
                <div key={a.esc.nombre} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 70, fontSize: 11, color: a.esc.color, fontWeight: 700 }}>{a.esc.nombre}</div>
                  <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 4, height: 22, overflow: "hidden" }}>
                    <div style={{ width: `${barW}%`, height: "100%", background: positivo ? `${a.esc.color}88` : "#cc000066" }} />
                  </div>
                  <div style={{ width: 100, textAlign: "right", fontSize: 12, fontWeight: 700, color: positivo ? a.esc.color : "#cc0000" }}>
                    {positivo ? "+" : ""}USD {fmt(a.cashFlow)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabla escenarios */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Análisis por Escenario</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#161616" }}>
                  {["Escenario","Renta/mes","Vacancia","NOI anual","Cash flow anual","DSCR","Valor prop.","Δ Valor","ROI","Semáforo"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #1f2937", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analisis.map((a, i) => (
                  <tr key={a.esc.nombre} style={{ background: i % 2 === 0 ? "#0f0f0f" : "#111", borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "8px 10px", color: a.esc.color, fontWeight: 700 }}>{a.esc.nombre}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e5e5" }}>USD {fmt(a.rentaAdj)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: a.vacanciAdj > 15 ? "#cc0000" : "#9ca3af" }}>{a.vacanciAdj.toFixed(0)}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#e5e5e5" }}>USD {fmt(a.noi)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: a.cashFlow >= 0 ? "#22c55e" : "#cc0000", fontWeight: 700 }}>
                      {a.cashFlow >= 0 ? "+" : ""}USD {fmt(a.cashFlow)}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: (a.dscr ?? 0) >= 1.25 ? "#22c55e" : (a.dscr ?? 0) >= 1 ? "#f97316" : "#cc0000", fontWeight: 700 }}>
                      {a.dscr ? `${a.dscr.toFixed(2)}x` : "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>USD {fmt(a.valorAdj)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: a.perdidaValor > 0 ? "#cc0000" : "#22c55e" }}>
                      {a.perdidaValor > 0 ? `-USD ${fmt(a.perdidaValor)}` : "+USD " + fmt(-a.perdidaValor)}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: a.roi > 0 ? "#22c55e" : "#cc0000", fontWeight: 700 }}>{a.roi.toFixed(1)}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: `${colSemaforo[a.semaforo]}22`, color: colSemaforo[a.semaforo], padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {a.semaforo === "verde" ? "✅" : a.semaforo === "amarillo" ? "⚠️" : "🔴"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>
          DSCR = NOI / Servicio deuda anual (≥1.25x recomendado por bancos) · Valor ajustado = NOI / Cap rate ajustado · ROI sobre equidad (valor − deuda)
        </div>
      </div>
    </div>
  );
}
