"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Escenarios ────────────────────────────────────────────────────────────────

interface Escenario {
  id: string;
  nombre: string;
  inflacionAnual: number; // %
  color: string;
  descripcion: string;
}

const ESCENARIOS: Escenario[] = [
  { id: "deflacion", nombre: "Desinflación", inflacionAnual: 30, color: "#22c55e", descripcion: "Convergencia a 30% anual en 2-3 años" },
  { id: "moderado", nombre: "Moderado", inflacionAnual: 60, color: "#f97316", descripcion: "Inflación estabilizada en 60% anual" },
  { id: "base", nombre: "Base", inflacionAnual: 80, color: "#3b82f6", descripcion: "Escenario tendencia actual 2026" },
  { id: "pesimista", nombre: "Pesimista", inflacionAnual: 120, color: "#cc0000", descripcion: "Reaceleración inflacionaria" },
  { id: "hiperinflacion", nombre: "Hiper", inflacionAnual: 200, color: "#7c3aed", descripcion: "Escenario de estrés extremo" },
];

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ProyeccionUVA() {
  // Préstamo
  const [capitalUSD, setCapitalUSD] = useState(50000);
  const [tnaUVA, setTnaUVA] = useState(8.5); // TNA sobre UVA (spread banco)
  const [plazoAnios, setPlazoAnios] = useState(20);
  const [tcDolarActual, setTcDolarActual] = useState(1200);
  const [valorUVAActual, setValorUVAActual] = useState(1250); // ARS por UVA a hoy
  const [aprecDolarAnual, setAprecDolarAnual] = useState(20); // % apreciación dólar/año (crawling peg o libre)

  // Selección de escenarios a mostrar
  const [escenariosActivos, setEscenariosActivos] = useState<string[]>(["deflacion", "base", "pesimista"]);

  function toggleEscenario(id: string) {
    setEscenariosActivos(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  }

  const proyecciones = useMemo(() => {
    const capitalARS = capitalUSD * tcDolarActual;
    const capitalUVA = capitalARS / valorUVAActual;
    const plazoMeses = plazoAnios * 12;
    const tnaDecimal = tnaUVA / 100;
    const tmDecimal = Math.pow(1 + tnaDecimal, 1 / 12) - 1; // TEM

    // Cuota en UVAs (sistema francés, capital en UVAs es constante al inicio)
    const cuotaUVAs = capitalUVA * (tmDecimal * Math.pow(1 + tmDecimal, plazoMeses)) / (Math.pow(1 + tmDecimal, plazoMeses) - 1);

    return ESCENARIOS.map(esc => {
      const inflMensual = Math.pow(1 + esc.inflacionAnual / 100, 1 / 12) - 1;
      const dolarMensual = Math.pow(1 + aprecDolarAnual / 100, 1 / 12) - 1;

      const puntos: { anio: number; mes: number; cuotaARS: number; cuotaUSD: number; uvaValor: number; ingresosNecesarios: number }[] = [];

      let uvaValor = valorUVAActual;
      let tcDolar = tcDolarActual;
      let saldoUVA = capitalUVA;

      for (let mes = 1; mes <= Math.min(plazoMeses, 360); mes++) {
        uvaValor *= (1 + inflMensual);
        tcDolar *= (1 + dolarMensual);

        const cuotaARS = cuotaUVAs * uvaValor;
        const cuotaUSD = cuotaARS / tcDolar;

        // Descontar capital de la cuota (aprox)
        const interesMes = saldoUVA * tmDecimal;
        const capitalMes = cuotaUVAs - interesMes;
        saldoUVA = Math.max(0, saldoUVA - capitalMes);

        if (mes % 12 === 0 || mes === 1 || mes === 6) {
          puntos.push({
            anio: Math.floor(mes / 12),
            mes,
            cuotaARS,
            cuotaUSD,
            uvaValor,
            ingresosNecesarios: cuotaARS / 0.25 / tcDolar, // regla 25% ingresos en USD
          });
        }
      }

      const cuotaInicial = cuotaUVAs * valorUVAActual;
      const cuotaAnio5 = puntos.find(p => p.anio === 5)?.cuotaARS ?? 0;
      const cuotaAnio10 = puntos.find(p => p.anio === 10)?.cuotaARS ?? 0;
      const uvaAnio5 = puntos.find(p => p.anio === 5)?.uvaValor ?? 0;
      const uvaAnio10 = puntos.find(p => p.anio === 10)?.uvaValor ?? 0;
      const cuotaInicialUSD = cuotaInicial / tcDolarActual;
      const cuotaAnio5USD = puntos.find(p => p.anio === 5)?.cuotaUSD ?? 0;
      const cuotaAnio10USD = puntos.find(p => p.anio === 10)?.cuotaUSD ?? 0;

      return { ...esc, capitalUVA, cuotaUVAs, cuotaInicial, cuotaInicialUSD, cuotaAnio5, cuotaAnio10, uvaAnio5, uvaAnio10, cuotaAnio5USD, cuotaAnio10USD, puntos };
    });
  }, [capitalUSD, tnaUVA, plazoAnios, tcDolarActual, valorUVAActual, aprecDolarAnual]);

  const activasFiltradas = proyecciones.filter(p => escenariosActivos.includes(p.id));

  const maxCuotaUSD = useMemo(() => Math.max(...activasFiltradas.flatMap(p => p.puntos.map(pt => pt.cuotaUSD)), 1), [activasFiltradas]);

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proyección UVA</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;max-width:800px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#f0f0f0;padding:7px;font-size:10px}td{padding:7px;border-bottom:1px solid #eee;font-size:11px;text-align:right}td:first-child{text-align:left}</style>
    </head><body>
    <h1>Proyección Cuota UVA</h1>
    <p>Capital: USD ${fmt(capitalUSD)} · TNA: ${tnaUVA}% · Plazo: ${plazoAnios} años · TC hoy: $${fmt(tcDolarActual)}</p>
    <table>
      <tr><th>Escenario</th><th>Inflación/año</th><th>Cuota inicial (ARS)</th><th>Cuota año 5 (ARS)</th><th>Cuota año 10 (ARS)</th><th>Cuota inicial (USD)</th><th>Cuota año 5 (USD)</th></tr>
      ${proyecciones.map(p => `<tr><td>${p.nombre}</td><td>${p.inflacionAnual}%</td><td>$${fmt(p.cuotaInicial)}</td><td>$${fmt(p.cuotaAnio5)}</td><td>$${fmt(p.cuotaAnio10)}</td><td>USD ${fmt(p.cuotaInicialUSD, 0)}</td><td>USD ${fmt(p.cuotaAnio5USD, 0)}</td></tr>`).join("")}
    </table>
    <p style="font-size:10px;color:#999">Estimaciones orientativas. La UVA se ajusta diariamente por CER (IPC). Valores proyectados al ${new Date().toLocaleDateString("es-AR")}.</p>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  }

  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "7px 10px", fontFamily: "'Inter',sans-serif", fontSize: 12, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← Calculadoras</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Proyección de Cuota UVA
        </h1>
      </div>

      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "290px 1fr", gap: 20 }}>
        {/* Panel inputs */}
        <div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 18, marginBottom: 12 }}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Crédito UVA</p>
            {[
              { label: "Capital (USD)", val: capitalUSD, set: setCapitalUSD },
              { label: "TNA sobre UVA (%)", val: tnaUVA, set: setTnaUVA, step: 0.5 },
              { label: "Plazo (años)", val: plazoAnios, set: setPlazoAnios },
              { label: "TC ARS/USD hoy", val: tcDolarActual, set: setTcDolarActual },
              { label: "Valor UVA hoy (ARS)", val: valorUVAActual, set: setValorUVAActual },
              { label: "Apreciación dólar/año (%)", val: aprecDolarAnual, set: setAprecDolarAnual, step: 5 },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{r.label}</label>
                <input type="number" step={r.step ?? 1000} value={r.val} onChange={e => r.set(+e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 18, marginBottom: 12 }}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Escenarios</p>
            {ESCENARIOS.map(e => (
              <div key={e.id} onClick={() => toggleEscenario(e.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${e.color}`, background: escenariosActivos.includes(e.id) ? e.color : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {escenariosActivos.includes(e.id) && <span style={{ color: "#000", fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: e.color }}>{e.nombre} — {e.inflacionAnual}%</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{e.descripcion}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={exportarPDF} style={{ width: "100%", padding: "9px", borderRadius: 8, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.3)", color: "#cc0000", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
            EXPORTAR PDF
          </button>
        </div>

        {/* Panel resultados */}
        <div>
          {/* Cuota inicial (en UVAs) */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <p style={{ margin: "0 0 12px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Cuota Inicial (invariante por escenario)</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {(() => {
                const base = proyecciones[0];
                return [
                  { label: "Capital en UVAs", val: `${fmt(base.capitalUVA)} UVAs` },
                  { label: "Cuota en UVAs", val: `${fmt(base.cuotaUVAs, 2)} UVAs/mes` },
                  { label: "Cuota inicial (ARS)", val: `$${fmt(base.cuotaInicial)}` },
                ].map(kpi => (
                  <div key={kpi.label} style={{ textAlign: "center", padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                    <p style={{ margin: "0 0 4px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kpi.label}</p>
                    <p style={{ margin: 0, fontSize: 16, fontFamily: "'Montserrat',sans-serif", fontWeight: 800 }}>{kpi.val}</p>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Comparativa escenarios */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <p style={{ margin: 0, padding: "14px 20px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              Comparativa por Escenario
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Escenario", "Inflación", "Cuota Mes 1 ARS", "Cuota Año 5 ARS", "Cuota Año 10 ARS", "Cuota Año 5 USD", "UVA Año 5"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: h === "Escenario" ? "left" : "right", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proyecciones.filter(p => escenariosActivos.includes(p.id)).map((p, idx) => (
                  <tr key={p.id} style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "9px 14px", fontSize: 12, fontWeight: 700, color: p.color }}>{p.nombre}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{p.inflacionAnual}%/año</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12 }}>${fmt(p.cuotaInicial)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: p.color }}>${fmt(p.cuotaAnio5)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: p.color }}>${fmt(p.cuotaAnio10)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12, color: p.cuotaAnio5USD > p.cuotaInicialUSD * 1.5 ? "#cc0000" : "#22c55e", fontWeight: 700 }}>
                      USD {fmt(p.cuotaAnio5USD, 0)}
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>${fmt(p.uvaAnio5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Gráfico evolución cuota USD */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
            <p style={{ margin: "0 0 16px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Evolución Cuota en USD por Escenario
            </p>
            <div style={{ position: "relative", height: 160 }}>
              <svg width="100%" height={160} viewBox={`0 0 800 160`} preserveAspectRatio="none">
                {activasFiltradas.map(p => {
                  if (p.puntos.length < 2) return null;
                  const pts = p.puntos.filter(pt => pt.anio <= plazoAnios);
                  const points = pts.map((pt, i) => {
                    const x = (i / (pts.length - 1)) * 780 + 10;
                    const y = 150 - (pt.cuotaUSD / maxCuotaUSD) * 140;
                    return `${x},${y}`;
                  }).join(" ");
                  return (
                    <polyline key={p.id} points={points} fill="none" stroke={p.color} strokeWidth={1.5} opacity={0.8} />
                  );
                })}
                {/* Línea cuota inicial */}
                <line x1={10} y1={150 - (activasFiltradas[0]?.cuotaInicialUSD / maxCuotaUSD) * 140} x2={790} y2={150 - (activasFiltradas[0]?.cuotaInicialUSD / maxCuotaUSD) * 140} stroke="rgba(255,255,255,0.1)" strokeDasharray="4,4" strokeWidth={1} />
              </svg>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
              {activasFiltradas.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 3, background: p.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{p.nombre}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Cuota inicial</span>
              </div>
            </div>

            {/* Advertencia */}
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#f97316", lineHeight: 1.5 }}>
                ⚠ <strong>La cuota UVA en ARS siempre sube con la inflación</strong>, pero en USD puede bajar si el dólar sube más rápido que el IPC. La relación cuota/salario es el riesgo real a monitorear.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
