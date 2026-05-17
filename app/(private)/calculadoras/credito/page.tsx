"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtMon = (n: number, mon: string) => (mon === "USD" ? fmtUSD(n) : fmtARS(n));

const fmtPct = (n: number) => `${n.toFixed(2)}%`;

const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

// ── Tipos ────────────────────────────────────────────────────────────────────

interface CuotaRow {
  n: number;
  cuota: number;
  interes: number;
  amortizacion: number;
  saldo: number;
}

// ── Sistemas de amortización ─────────────────────────────────────────────────

function calcFrances(capital: number, tasaMensual: number, plazoMeses: number): CuotaRow[] {
  if (capital <= 0 || plazoMeses <= 0) return [];
  const r = tasaMensual;
  const cuota = r === 0 ? capital / plazoMeses : capital * r * Math.pow(1 + r, plazoMeses) / (Math.pow(1 + r, plazoMeses) - 1);
  const rows: CuotaRow[] = [];
  let saldo = capital;
  for (let n = 1; n <= plazoMeses; n++) {
    const interes = saldo * r;
    const amortizacion = cuota - interes;
    saldo = Math.max(saldo - amortizacion, 0);
    rows.push({ n, cuota, interes, amortizacion, saldo });
  }
  return rows;
}

function calcAleman(capital: number, tasaMensual: number, plazoMeses: number): CuotaRow[] {
  if (capital <= 0 || plazoMeses <= 0) return [];
  const amortizacion = capital / plazoMeses;
  const rows: CuotaRow[] = [];
  let saldo = capital;
  for (let n = 1; n <= plazoMeses; n++) {
    const interes = saldo * tasaMensual;
    const cuota = amortizacion + interes;
    saldo = Math.max(saldo - amortizacion, 0);
    rows.push({ n, cuota, interes, amortizacion, saldo });
  }
  return rows;
}

// ── Líneas de crédito predefinidas ───────────────────────────────────────────

const LINEAS = [
  { id: "uva", label: "UVA (ajustable)", tasaAnual: 8, moneda: "ARS", nota: "Tasa fija sobre saldo ajustado por UVA. Referencia BNA 2025." },
  { id: "fijo_usd", label: "Fijo USD", tasaAnual: 8, moneda: "USD", nota: "Crédito hipotecario en dólares. Tasa referencial bancaria 2025." },
  { id: "fijo_ars", label: "Fijo ARS", tasaAnual: 78, moneda: "ARS", nota: "Crédito tasa fija en pesos. Alta tasa por inflación esperada." },
  { id: "custom", label: "Personalizada", tasaAnual: 10, moneda: "USD", nota: "Ingresá tu propia tasa y condiciones." },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function CreditoPage() {
  const [moneda, setMoneda] = useState<"USD" | "ARS">("USD");
  const [sistema, setSistema] = useState<"frances" | "aleman">("frances");
  const [lineaId, setLineaId] = useState("fijo_usd");

  // Inputs
  const [valorPropStr, setValorPropStr] = useState("200000");
  const [ltvStr, setLtvStr] = useState("70"); // Loan-to-value %
  const [tasaAnualStr, setTasaAnualStr] = useState("8");
  const [plazoAnosStr, setPlazoAnosStr] = useState("20");
  const [ingresosStr, setIngresosStr] = useState("5000"); // ingresos mensuales para análisis cuota/ingreso

  const [mostrarTabla, setMostrarTabla] = useState(false);
  const [tablaAnual, setTablaAnual] = useState(true);

  // Aplicar línea predefinida
  const aplicarLinea = (id: string) => {
    const l = LINEAS.find(l => l.id === id);
    if (!l) return;
    setLineaId(id);
    setTasaAnualStr(String(l.tasaAnual));
    setMoneda(l.moneda as "USD" | "ARS");
  };

  // ── Cálculos ─────────────────────────────────────────────────────────────

  const { capital, plazoMeses, tasaMensual, cuotas, resumen } = useMemo(() => {
    const valorProp = num(valorPropStr);
    const ltv = num(ltvStr) / 100;
    const capital = valorProp * ltv;
    const plazoMeses = Math.round(num(plazoAnosStr) * 12);
    const tasaAnual = num(tasaAnualStr) / 100;
    const tasaMensual = Math.pow(1 + tasaAnual, 1 / 12) - 1;

    const cuotas = sistema === "frances"
      ? calcFrances(capital, tasaMensual, plazoMeses)
      : calcAlemen(capital, tasaMensual, plazoMeses);

    const totalPagado = cuotas.reduce((s, c) => s + c.cuota, 0);
    const totalIntereses = totalPagado - capital;
    const primaCuota = cuotas[0]?.cuota ?? 0;
    const ingresos = num(ingresosStr);
    const relacionCuotaIngreso = ingresos > 0 ? (primaCuota / ingresos) * 100 : 0;

    return {
      capital,
      plazoMeses,
      tasaMensual,
      cuotas,
      resumen: {
        totalPagado,
        totalIntereses,
        primaCuota,
        relacionCuotaIngreso,
        cuotaInicial: valorProp * (1 - ltv),
      },
    };
  }, [valorPropStr, ltvStr, tasaAnualStr, plazoAnosStr, sistema, ingresosStr]);

  // ── Tabla anual resumida ──────────────────────────────────────────────────

  const tablaResumen = useMemo(() => {
    if (cuotas.length === 0) return [];
    const anos = Math.ceil(cuotas.length / 12);
    return Array.from({ length: anos }, (_, i) => {
      const desde = i * 12;
      const hasta = Math.min(desde + 12, cuotas.length);
      const slice = cuotas.slice(desde, hasta);
      const totalCuotas = slice.reduce((s, c) => s + c.cuota, 0);
      const totalIntereses = slice.reduce((s, c) => s + c.interes, 0);
      const totalAmort = slice.reduce((s, c) => s + c.amortizacion, 0);
      const saldoFinal = slice[slice.length - 1]?.saldo ?? 0;
      return { ano: i + 1, totalCuotas, totalIntereses, totalAmort, saldoFinal };
    });
  }, [cuotas]);

  // ── PDF ──────────────────────────────────────────────────────────────────

  const exportarPDF = useCallback(() => {
    const win = window.open("", "_blank");
    if (!win || !resumen) return;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Crédito Hipotecario — Grupo Foro Inmobiliario</title>
<style>
  body{font-family:'Inter',Arial,sans-serif;color:#111;background:#fff;padding:32px;max-width:700px;margin:0 auto}
  h1{font-family:'Montserrat',Arial,sans-serif;font-size:20px;font-weight:900;color:#cc0000;margin-bottom:4px}
  h2{font-family:'Montserrat',Arial,sans-serif;font-size:12px;font-weight:800;color:#333;text-transform:uppercase;letter-spacing:.1em;margin:24px 0 8px;border-bottom:1px solid #eee;padding-bottom:6px}
  .logo{font-size:10px;color:#999;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th{background:#f5f5f5;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#666}
  th.r,td.r{text-align:right}
  td{padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:12px}
  .row{display:flex;gap:20px;margin:14px 0;flex-wrap:wrap}
  .kpi{flex:1;min-width:120px;border:1px solid #eee;border-radius:6px;padding:12px}
  .kpi-l{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-bottom:4px}
  .kpi-v{font-size:20px;font-weight:900;color:#cc0000;font-family:'Montserrat',Arial,sans-serif}
  footer{margin-top:32px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}
</style></head><body>
<h1>Simulación de Crédito Hipotecario</h1>
<p class="logo">Grupo Foro Inmobiliario® · ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</p>
<h2>Parámetros</h2>
<table>
<thead><tr><th>Concepto</th><th class="r">Valor</th></tr></thead>
<tbody>
<tr><td>Valor de la propiedad</td><td class="r">${fmtMon(num(valorPropStr), moneda)}</td></tr>
<tr><td>Financiación (${ltvStr}%)</td><td class="r">${fmtMon(capital, moneda)}</td></tr>
<tr><td>Cuota inicial (${100 - num(ltvStr)}%)</td><td class="r">${fmtMon(resumen.cuotaInicial, moneda)}</td></tr>
<tr><td>Tasa anual</td><td class="r">${tasaAnualStr}%</td></tr>
<tr><td>Plazo</td><td class="r">${plazoAnosStr} años (${plazoMeses} cuotas)</td></tr>
<tr><td>Sistema de amortización</td><td class="r">${sistema === "frances" ? "Francés (cuota fija)" : "Alemán (cuota decreciente)"}</td></tr>
</tbody></table>
<h2>Resultados</h2>
<div class="row">
  <div class="kpi"><div class="kpi-l">1ª Cuota</div><div class="kpi-v">${fmtMon(resumen.primaCuota, moneda)}</div></div>
  <div class="kpi"><div class="kpi-l">Total a pagar</div><div class="kpi-v">${fmtMon(resumen.totalPagado, moneda)}</div></div>
  <div class="kpi"><div class="kpi-l">Total intereses</div><div class="kpi-v">${fmtMon(resumen.totalIntereses, moneda)}</div></div>
  <div class="kpi"><div class="kpi-l">Cuota/Ingreso</div><div class="kpi-v">${fmtPct(resumen.relacionCuotaIngreso)}</div></div>
</div>
<h2>Cuadro de amortización anual</h2>
<table>
<thead><tr><th>Año</th><th class="r">Cuotas</th><th class="r">Intereses</th><th class="r">Capital</th><th class="r">Saldo</th></tr></thead>
<tbody>${tablaResumen.map(r => `<tr><td>${r.ano}</td><td class="r">${fmtMon(r.totalCuotas, moneda)}</td><td class="r">${fmtMon(r.totalIntereses, moneda)}</td><td class="r">${fmtMon(r.totalAmort, moneda)}</td><td class="r">${fmtMon(r.saldoFinal, moneda)}</td></tr>`).join("")}</tbody>
</table>
<footer>Calculado con GFI® Grupo Foro Inmobiliario · Simulación orientativa. No constituye oferta crediticia.</footer>
</body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }, [valorPropStr, ltvStr, tasaAnualStr, plazoAnosStr, sistema, moneda, capital, plazoMeses, resumen, tablaResumen]);

  // ── Styles ────────────────────────────────────────────────────────────────

  const inputSt: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6, color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 14,
    padding: "8px 10px", width: "100%", boxSizing: "border-box", outline: "none",
  };
  const labelSt: React.CSSProperties = {
    fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700,
    letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)",
    marginBottom: 5, display: "block",
  };
  const cardSt: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, padding: "18px 20px", marginBottom: 14,
  };

  // ── Barra de composición (intereses vs capital) ───────────────────────────

  const pctCapital = resumen.totalPagado > 0 ? (capital / resumen.totalPagado) * 100 : 0;
  const pctIntereses = 100 - pctCapital;

  // ── Cuota/ingreso semáforo ────────────────────────────────────────────────

  const rel = resumen.relacionCuotaIngreso;
  const semColor = rel <= 30 ? "#22c55e" : rel <= 40 ? "#f59e0b" : "#ef4444";
  const semLabel = rel <= 30 ? "Saludable" : rel <= 40 ? "Límite" : "Alto";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');
        input:focus, select:focus { border-color: rgba(204,0,0,0.5) !important; box-shadow: 0 0 0 2px rgba(204,0,0,0.1); }
        select { appearance: none; }
        .seg { background: none; border: none; padding: 5px 14px; border-radius: 20px; cursor: pointer; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; transition: all 0.15s; }
        .seg.on { background: rgba(204,0,0,0.2); color: #cc0000; }
        .seg:not(.on) { color: rgba(255,255,255,0.25); }
        .seg:not(.on):hover { color: rgba(255,255,255,0.5); }
        .linea-btn { padding: 8px 12px; border-radius: 8px; cursor: pointer; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.35); }
        .linea-btn.on { background: rgba(204,0,0,0.12); border-color: rgba(204,0,0,0.3); color: #cc0000; }
        .linea-btn:hover:not(.on) { border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.6); }
        .tabla-row:hover { background: rgba(255,255,255,0.03) !important; }
        @media (max-width: 700px) { .two-col { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 940, margin: "0 auto" }}>
        <div>
          <Link href="/calculadoras" style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
            ← CALCULADORAS
          </Link>
          <div style={{ marginTop: 6, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 18 }}>
            Calculadora de <span style={{ color: "#cc0000" }}>Crédito Hipotecario</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            Sistema francés o alemán · Cuadro de amortización · Análisis cuota/ingreso
          </div>
        </div>
        <button onClick={exportarPDF} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 14px", cursor: "pointer" }}>
          ↓ PDF
        </button>
      </div>

      <div style={{ maxWidth: 940, margin: "22px auto", padding: "0 16px", display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }} className="two-col">

        {/* ── Panel izquierdo ── */}
        <div>
          {/* Líneas predefinidas */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>
              Tipo de crédito
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {LINEAS.map(l => (
                <button key={l.id} className={`linea-btn${lineaId === l.id ? " on" : ""}`} onClick={() => aplicarLinea(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            {lineaId && (
              <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", lineHeight: 1.5 }}>
                {LINEAS.find(l => l.id === lineaId)?.nota}
              </div>
            )}
          </div>

          {/* Datos de la operación */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>
              Operación
            </div>

            <div style={{ marginBottom: 10 }}>
              <span style={labelSt}>Moneda</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["USD", "ARS"] as const).map(m => (
                  <button key={m} className={`seg${moneda === m ? " on" : ""}`} onClick={() => setMoneda(m)}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <span style={labelSt}>Valor de la propiedad</span>
              <input style={inputSt} value={valorPropStr} onChange={e => setValorPropStr(e.target.value)} inputMode="decimal" placeholder="200000" />
            </div>

            <div style={{ marginBottom: 10 }}>
              <span style={labelSt}>Financiación (LTV %)</span>
              <input style={inputSt} value={ltvStr} onChange={e => setLtvStr(e.target.value)} inputMode="decimal" placeholder="70" />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 3 }}>
                Cuota inicial: {fmtMon(num(valorPropStr) * (1 - num(ltvStr) / 100), moneda)}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <span style={labelSt}>Tasa anual (%)</span>
                <input style={inputSt} value={tasaAnualStr} onChange={e => setTasaAnualStr(e.target.value)} inputMode="decimal" placeholder="8" />
              </div>
              <div>
                <span style={labelSt}>Plazo (años)</span>
                <input style={inputSt} value={plazoAnosStr} onChange={e => setPlazoAnosStr(e.target.value)} inputMode="decimal" placeholder="20" />
              </div>
            </div>
          </div>

          {/* Sistema amortización */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>
              Sistema de amortización
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ v: "frances", l: "Francés" }, { v: "aleman", l: "Alemán" }].map(({ v, l }) => (
                <button key={v} className={`seg${sistema === v ? " on" : ""}`} onClick={() => setSistema(v as "frances" | "aleman")}>{l}</button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif", lineHeight: 1.5 }}>
              {sistema === "frances"
                ? "Cuota fija. Mayor proporción de interés al inicio."
                : "Capital fijo. Cuota decreciente. Menor costo total."}
            </div>
          </div>

          {/* Ingresos para análisis */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>
              Análisis cuota/ingreso
            </div>
            <span style={labelSt}>Ingreso mensual neto</span>
            <input style={inputSt} value={ingresosStr} onChange={e => setIngresosStr(e.target.value)} inputMode="decimal" placeholder="5000" />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
              Los bancos suelen requerir que la cuota no supere el 30–35% del ingreso.
            </div>
          </div>
        </div>

        {/* ── Panel derecho: resultados ── */}
        <div>
          {cuotas.length === 0 ? (
            <div style={{ ...cardSt, textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
              Ingresá los datos para simular el crédito
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "1ª Cuota", val: fmtMon(resumen.primaCuota, moneda), color: "#cc0000" },
                  { label: "Total a pagar", val: fmtMon(resumen.totalPagado, moneda), color: "#f97316" },
                  { label: "Total intereses", val: fmtMon(resumen.totalIntereses, moneda), color: "#a78bfa" },
                  { label: "Capital financiado", val: fmtMon(capital, moneda), color: "#60a5fa" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ ...cardSt, marginBottom: 0, textAlign: "center" }}>
                    <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 22, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Cuota/Ingreso */}
              <div style={{ ...cardSt, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>
                    Cuota / Ingreso
                  </div>
                  <div style={{ background: `${semColor}20`, border: `1px solid ${semColor}40`, borderRadius: 20, padding: "2px 10px", fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: semColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {semLabel}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontSize: 32, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color: semColor }}>
                    {fmtPct(rel)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(rel, 100)}%`, background: `linear-gradient(90deg, #22c55e, ${rel > 30 ? "#f59e0b" : "#22c55e"} ${Math.min(rel / 0.4, 100)}%, ${rel > 40 ? "#ef4444" : "transparent"})`, borderRadius: 4, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif" }}>
                      <span>0%</span><span>30%</span><span>40%</span><span>100%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Composición del pago */}
              <div style={{ ...cardSt, marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>
                  Composición del total pagado
                </div>
                <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${pctCapital}%`, background: "#3b82f6", transition: "width 0.5s" }} title={`Capital: ${fmtMon(capital, moneda)}`} />
                  <div style={{ width: `${pctIntereses}%`, background: "#cc0000", opacity: 0.7, transition: "width 0.5s" }} title={`Intereses: ${fmtMon(resumen.totalIntereses, moneda)}`} />
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  {[
                    { color: "#3b82f6", label: "Capital", val: fmtMon(capital, moneda), pct: pctCapital },
                    { color: "#cc0000", label: "Intereses", val: fmtMon(resumen.totalIntereses, moneda), pct: pctIntereses },
                  ].map(({ color, label, val, pct }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.8 }} />
                      <div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label} ({pct.toFixed(0)}%)</div>
                        <div style={{ fontSize: 13, fontFamily: "Inter,sans-serif", color: "rgba(255,255,255,0.7)" }}>{val}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabla amortización */}
              <div style={cardSt}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>
                    Cuadro de amortización
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className={`seg${tablaAnual ? " on" : ""}`} onClick={() => setTablaAnual(true)}>Anual</button>
                    <button className={`seg${!tablaAnual ? " on" : ""}`} onClick={() => setTablaAnual(false)}>Mensual</button>
                    <button onClick={() => setMostrarTabla(p => !p)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer" }}>
                      {mostrarTabla ? "Ocultar" : "Ver tabla"}
                    </button>
                  </div>
                </div>

                {mostrarTabla && (
                  <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {[tablaAnual ? "Año" : "Cuota", "Cuota", "Intereses", "Capital", "Saldo"].map(h => (
                            <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'Montserrat',sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "#0f0f0f" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tablaAnual
                          ? tablaResumen.map(r => (
                            <tr key={r.ano} className="tabla-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Año {r.ano}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: "rgba(255,255,255,0.65)" }}>{fmtMon(r.totalCuotas, moneda)}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: "#cc0000", opacity: 0.8 }}>{fmtMon(r.totalIntereses, moneda)}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: "#3b82f6" }}>{fmtMon(r.totalAmort, moneda)}</td>
                              <td style={{ padding: "7px 8px", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>{fmtMon(r.saldoFinal, moneda)}</td>
                            </tr>
                          ))
                          : cuotas.map(c => (
                            <tr key={c.n} className="tabla-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{c.n}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{fmtMon(c.cuota, moneda)}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", color: "#cc0000", opacity: 0.7, fontSize: 11 }}>{fmtMon(c.interes, moneda)}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", color: "#3b82f6", fontSize: 11 }}>{fmtMon(c.amortizacion, moneda)}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{fmtMon(c.saldo, moneda)}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                )}

                {!mostrarTabla && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", padding: "12px 0" }}>
                    {tablaAnual ? `${tablaResumen.length} años` : `${cuotas.length} cuotas`} · Hacé click en "Ver tabla" para expandir
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Fix typo used above
function calcAlemen(capital: number, tasaMensual: number, plazoMeses: number): CuotaRow[] {
  return calcAleman(capital, tasaMensual, plazoMeses);
}
