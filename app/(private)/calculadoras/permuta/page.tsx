"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const fmt = (n: number, d = 0) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = (n: number) => `USD ${fmt(Math.abs(n), 0)}`;
const fmtPct = (n: number) => `${fmt(n, 2)}%`;

export default function CalculadoraPermuta() {
  // Propiedad A (la que aporta el permutante A)
  const [precioA, setPrecioA] = useState<string>("200000");
  const [tituloA, setTituloA] = useState<string>("Propiedad A");
  const [hipotecaA, setHipotecaA] = useState<string>("0");

  // Propiedad B
  const [precioB, setPrecioB] = useState<string>("150000");
  const [tituloB, setTituloB] = useState<string>("Propiedad B");
  const [hipotecaB, setHipotecaB] = useState<string>("0");

  // Gastos y honorarios
  const [pctSellosA, setPctSellosA] = useState<string>("2.5"); // % del valor A
  const [pctSellosB, setPctSellosB] = useState<string>("2.5"); // % del valor B
  const [pctEscribA, setPctEscribA] = useState<string>("1.5");
  const [pctEscribB, setPctEscribB] = useState<string>("1.5");
  const [pctITI_A, setPctITI_A] = useState<string>("0");      // ITI si aplica
  const [pctITI_B, setPctITI_B] = useState<string>("0");
  const [honorariosAgente, setHonorariosAgente] = useState<string>("3");  // % sobre valor menor
  const [quienPagaHonorarios, setQuienPagaHonorarios] = useState<"ambos" | "A" | "B">("ambos");

  const r = useMemo(() => {
    const vA = parseFloat(precioA) || 0;
    const vB = parseFloat(precioB) || 0;
    const hipA = parseFloat(hipotecaA) || 0;
    const hipB = parseFloat(hipotecaB) || 0;

    // Valores netos (equity)
    const equityA = vA - hipA;
    const equityB = vB - hipB;
    const diferencia = equityA - equityB; // positivo = A entrega más valor, recibe compensación o B paga diferencia
    const quienRecibeDif = diferencia > 0 ? "A recibe" : diferencia < 0 ? "B recibe" : "Equilibrado";
    const montoDiferencia = Math.abs(diferencia);

    // Gastos por operación
    const sellosA = vA * (parseFloat(pctSellosA) || 0) / 100;
    const sellosB = vB * (parseFloat(pctSellosB) || 0) / 100;
    const escribA = vA * (parseFloat(pctEscribA) || 0) / 100;
    const escribB = vB * (parseFloat(pctEscribB) || 0) / 100;
    const itiA = vA * (parseFloat(pctITI_A) || 0) / 100;
    const itiB = vB * (parseFloat(pctITI_B) || 0) / 100;

    // Honorarios del agente sobre valor menor (por la intermediación)
    const valorMenor = Math.min(vA, vB);
    const totalHonorarios = valorMenor * (parseFloat(honorariosAgente) || 0) / 100;
    const honorA = quienPagaHonorarios === "ambos" ? totalHonorarios / 2 : quienPagaHonorarios === "A" ? totalHonorarios : 0;
    const honorB = quienPagaHonorarios === "ambos" ? totalHonorarios / 2 : quienPagaHonorarios === "B" ? totalHonorarios : 0;

    // Total gastos por parte
    const gastosA = sellosA / 2 + escribA + itiA + honorA; // sellos: 50% cada parte sobre prop propia
    const gastosB = sellosB / 2 + escribB + itiB + honorB;

    // Situación financiera final de cada parte
    // A entrega prop A (valor vA, deuda hipA) → recibe prop B (valor vB) + diferencia (si +) o paga diferencia (si -)
    // Flujo neto A: recibe vB - paga diferencia (si diferencia < 0) o recibe diferencia (si diferencia > 0) - gastosA
    const flujoNetoA = equityB + Math.max(0, diferencia) - Math.max(0, -diferencia) - gastosA;
    const flujoNetoB = equityA + Math.max(0, -diferencia) - Math.max(0, diferencia) - gastosB;

    // Análisis de conveniencia
    const valorNominalOpA = vA;
    const costoEfectivoA = gastosA + Math.max(0, -diferencia); // cuánto paga A en efectivo
    const costoEfectivoB = gastosB + Math.max(0, diferencia);  // cuánto paga B en efectivo

    return {
      vA, vB, hipA, hipB, equityA, equityB, diferencia, quienRecibeDif, montoDiferencia,
      sellosA, sellosB, escribA, escribB, itiA, itiB,
      totalHonorarios, honorA, honorB,
      gastosA, gastosB, flujoNetoA, flujoNetoB,
      costoEfectivoA, costoEfectivoB,
      valorMenor, totalGastos: gastosA + gastosB,
    };
  }, [precioA, precioB, hipotecaA, hipotecaB, pctSellosA, pctSellosB, pctEscribA, pctEscribB,
    pctITI_A, pctITI_B, honorariosAgente, quienPagaHonorarios]);

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, padding: "7px 10px", width: "100%", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4, display: "block",
  };
  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "18px 20px",
  };

  const colorA = "#3b82f6";
  const colorB = "#f97316";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Permuta de Propiedades</h1>
        <span style={{ background: "#a78bfa", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>SWAP</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {/* Panel Propiedad A */}
        <div style={{ ...cardStyle, borderColor: `${colorA}30` }}>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: colorA, marginBottom: 16 }}>🏠 Propiedad A (Permutante A)</div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Denominación</label>
            <input style={inputStyle} value={tituloA} onChange={e => setTituloA(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Valor de mercado (USD)</label>
            <input style={inputStyle} type="number" value={precioA} onChange={e => setPrecioA(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Hipoteca / deuda sobre la propiedad (USD)</label>
            <input style={inputStyle} type="number" value={hipotecaA} onChange={e => setHipotecaA(e.target.value)} />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Equity neto: <span style={{ color: colorA, fontWeight: 700 }}>{fmtUSD(r.equityA)}</span></div>
          </div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>Gastos de A</div>
          {[
            { label: "Sellos comprador (% sobre prop. B)", v: pctSellosA, s: setPctSellosA },
            { label: "Escribanía / honorarios escribano (%)", v: pctEscribA, s: setPctEscribA },
            { label: "ITI (% sobre prop. A vendida)", v: pctITI_A, s: setPctITI_A },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 10 }}>
              <label style={labelStyle}>{f.label}</label>
              <input style={inputStyle} type="number" step="0.1" value={f.v} onChange={e => f.s(e.target.value)} />
            </div>
          ))}
          <div style={{ background: "#111", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Resumen gastos A</div>
            {[
              { label: "Sellos", val: r.sellosA / 2 },
              { label: "Escribanía", val: r.escribA },
              { label: "ITI", val: r.itiA },
              { label: "Honorarios agente", val: r.honorA },
            ].filter(l => l.val > 0).map(l => (
              <div key={l.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{l.label}</span>
                <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: "#ef4444" }}>{fmtUSD(l.val)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>TOTAL GASTOS A</span>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: colorA }}>{fmtUSD(r.gastosA)}</span>
            </div>
          </div>
        </div>

        {/* Panel Propiedad B */}
        <div style={{ ...cardStyle, borderColor: `${colorB}30` }}>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: colorB, marginBottom: 16 }}>🏢 Propiedad B (Permutante B)</div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Denominación</label>
            <input style={inputStyle} value={tituloB} onChange={e => setTituloB(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Valor de mercado (USD)</label>
            <input style={inputStyle} type="number" value={precioB} onChange={e => setPrecioB(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Hipoteca / deuda sobre la propiedad (USD)</label>
            <input style={inputStyle} type="number" value={hipotecaB} onChange={e => setHipotecaB(e.target.value)} />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Equity neto: <span style={{ color: colorB, fontWeight: 700 }}>{fmtUSD(r.equityB)}</span></div>
          </div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>Gastos de B</div>
          {[
            { label: "Sellos comprador (% sobre prop. A)", v: pctSellosB, s: setPctSellosB },
            { label: "Escribanía / honorarios escribano (%)", v: pctEscribB, s: setPctEscribB },
            { label: "ITI (% sobre prop. B vendida)", v: pctITI_B, s: setPctITI_B },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 10 }}>
              <label style={labelStyle}>{f.label}</label>
              <input style={inputStyle} type="number" step="0.1" value={f.v} onChange={e => f.s(e.target.value)} />
            </div>
          ))}
          <div style={{ background: "#111", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Resumen gastos B</div>
            {[
              { label: "Sellos", val: r.sellosB / 2 },
              { label: "Escribanía", val: r.escribB },
              { label: "ITI", val: r.itiB },
              { label: "Honorarios agente", val: r.honorB },
            ].filter(l => l.val > 0).map(l => (
              <div key={l.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{l.label}</span>
                <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: "#ef4444" }}>{fmtUSD(l.val)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>TOTAL GASTOS B</span>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: colorB }}>{fmtUSD(r.gastosB)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Honorarios agente */}
      <div style={{ ...cardStyle, marginTop: 16, maxWidth: 1100, margin: "16px auto 0" }}>
        <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Honorarios del agente inmobiliario</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>% sobre valor menor de ambas propiedades</label>
            <input style={inputStyle} type="number" step="0.5" value={honorariosAgente} onChange={e => setHonorariosAgente(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>¿Quién paga los honorarios?</label>
            <select style={inputStyle} value={quienPagaHonorarios} onChange={e => setQuienPagaHonorarios(e.target.value as "ambos" | "A" | "B")}>
              <option value="ambos">Ambas partes (50/50)</option>
              <option value="A">Solo Permutante A</option>
              <option value="B">Solo Permutante B</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ background: "#111", borderRadius: 8, padding: "12px 14px", width: "100%" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Total honorarios</div>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#22c55e" }}>{fmtUSD(r.totalHonorarios)}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Base: valor menor {fmtUSD(r.valorMenor)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen de la operación */}
      <div style={{ ...cardStyle, marginTop: 16, maxWidth: 1100, margin: "16px auto 0", borderColor: "rgba(167,139,250,0.2)" }}>
        <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 16 }}>Resumen de la Permuta</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Equity A", val: fmtUSD(r.equityA), color: colorA },
            { label: "Equity B", val: fmtUSD(r.equityB), color: colorB },
            {
              label: r.diferencia >= 0 ? "Compensación en efectivo (B → A)" : "Compensación en efectivo (A → B)",
              val: fmtUSD(r.montoDiferencia),
              color: "#f59e0b"
            },
            { label: "Total gastos operación", val: fmtUSD(r.totalGastos), color: "#ef4444" },
          ].map((k, i) => (
            <div key={i} style={{ background: "#111", borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Diagrama de flujos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 12, alignItems: "center" }}>
          {/* A */}
          <div style={{ background: `${colorA}12`, border: `1px solid ${colorA}30`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: colorA, marginBottom: 8 }}>Permutante A — {tituloA}</div>
            {[
              { label: "Entrega prop. A (equity)", val: -r.equityA, sign: "−" },
              { label: "Recibe prop. B (equity)", val: r.equityB, sign: "+" },
              r.diferencia > 0
                ? { label: "Recibe compensación", val: r.diferencia, sign: "+" }
                : { label: "Paga compensación", val: -Math.abs(r.diferencia), sign: "−" },
              { label: "Gastos (escritura + hon.)", val: -r.gastosA, sign: "−" },
            ].map((l, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{l.sign} {l.label}</span>
                <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: l.val >= 0 ? "#22c55e" : "#ef4444" }}>{fmtUSD(l.val)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>DESEMBOLSO NETO</span>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: colorA }}>{fmtUSD(r.gastosA + Math.max(0, -r.diferencia))}</span>
            </div>
          </div>

          {/* Centro — flecha */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28 }}>⇄</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, marginTop: 4 }}>PERMUTA</div>
            {r.montoDiferencia > 0 && (
              <div style={{ marginTop: 8, background: "#f59e0b22", border: "1px solid #f59e0b40", borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ fontSize: 9, color: "#f59e0b", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>DIFERENCIA</div>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 800, color: "#f59e0b" }}>{fmtUSD(r.montoDiferencia)}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{r.quienRecibeDif}</div>
              </div>
            )}
          </div>

          {/* B */}
          <div style={{ background: `${colorB}12`, border: `1px solid ${colorB}30`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: colorB, marginBottom: 8 }}>Permutante B — {tituloB}</div>
            {[
              { label: "Entrega prop. B (equity)", val: -r.equityB, sign: "−" },
              { label: "Recibe prop. A (equity)", val: r.equityA, sign: "+" },
              r.diferencia < 0
                ? { label: "Recibe compensación", val: Math.abs(r.diferencia), sign: "+" }
                : { label: "Paga compensación", val: -r.diferencia, sign: "−" },
              { label: "Gastos (escritura + hon.)", val: -r.gastosB, sign: "−" },
            ].map((l, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{l.sign} {l.label}</span>
                <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: l.val >= 0 ? "#22c55e" : "#ef4444" }}>{fmtUSD(l.val)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>DESEMBOLSO NETO</span>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: colorB }}>{fmtUSD(r.gastosB + Math.max(0, r.diferencia))}</span>
            </div>
          </div>
        </div>

        {/* Nota legal */}
        <div style={{ marginTop: 16, padding: "10px 14px", background: "#111", borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>CONSIDERACIONES LEGALES</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
            En la permuta, cada parte es simultáneamente vendedor y comprador. Ambas propiedades se escrituran en el mismo acto. El ITI aplica si el vendedor no está exento (vivienda única). Los sellos se calculan sobre el valor de cada propiedad según escritura. Consultar con escribano habilitado.
          </div>
        </div>
      </div>
    </div>
  );
}
