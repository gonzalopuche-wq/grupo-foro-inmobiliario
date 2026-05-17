"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

type TipoLinea = "uva" | "fija" | "mixta";

interface Banco {
  id: string;
  nombre: string;
  tipo: TipoLinea;
  tnaBase: number;       // TNA fija en % (para UVA: spread sobre UVA)
  spreadUVA?: number;    // spread para líneas UVA
  cuotaIngresoMax: number; // max relación cuota/ingreso (%)
  ltv: number;           // loan to value máx (%)
  plazoMaxAnios: number;
  color: string;
  badge?: string;
}

// ── Bancos — tasas actualizadas Mayo 2026 ──────────────────────────────────

const BANCOS: Banco[] = [
  { id: "bna",          nombre: "Banco Nación",        tipo: "uva",   tnaBase: 5.5,  spreadUVA: 5.5,  cuotaIngresoMax: 30, ltv: 80, plazoMaxAnios: 30, color: "#3b82f6",  badge: "Oficial" },
  { id: "ciudad",       nombre: "Banco Ciudad",         tipo: "uva",   tnaBase: 6.0,  spreadUVA: 6.0,  cuotaIngresoMax: 30, ltv: 80, plazoMaxAnios: 20, color: "#8b5cf6",  badge: "GCBA" },
  { id: "hipotecario",  nombre: "Banco Hipotecario",    tipo: "uva",   tnaBase: 5.75, spreadUVA: 5.75, cuotaIngresoMax: 25, ltv: 75, plazoMaxAnios: 30, color: "#22c55e" },
  { id: "bbva",         nombre: "BBVA",                 tipo: "mixta", tnaBase: 10.5, cuotaIngresoMax: 30, ltv: 70, plazoMaxAnios: 20, color: "#0ea5e9" },
  { id: "santander",    nombre: "Santander",            tipo: "uva",   tnaBase: 6.5,  spreadUVA: 6.5,  cuotaIngresoMax: 28, ltv: 75, plazoMaxAnios: 20, color: "#ef4444" },
  { id: "galicia",      nombre: "Galicia",              tipo: "mixta", tnaBase: 11.0, cuotaIngresoMax: 30, ltv: 70, plazoMaxAnios: 20, color: "#f59e0b" },
  { id: "macro",        nombre: "Banco Macro",          tipo: "uva",   tnaBase: 6.25, spreadUVA: 6.25, cuotaIngresoMax: 25, ltv: 75, plazoMaxAnios: 20, color: "#a78bfa" },
  { id: "supervielle",  nombre: "Supervielle",          tipo: "fija",  tnaBase: 48.0, cuotaIngresoMax: 30, ltv: 65, plazoMaxAnios: 10, color: "#f97316", badge: "Pesos" },
];

// UVA actual (Mayo 2026 aprox)
const UVA_ACTUAL = 3120;
const CER_PROYECTADO = 0.03; // 3% mensual proyectado

// ── Helpers ──────────────────────────────────────────────────────────────────

function cuotaFrances(capital: number, tnaMensual: number, meses: number): number {
  if (tnaMensual === 0) return capital / meses;
  const r = tnaMensual / 100;
  return capital * r * Math.pow(1 + r, meses) / (Math.pow(1 + r, meses) - 1);
}

function totalPagado(cuota: number, meses: number): number {
  return cuota * meses;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function ComparativaCreditoHipotecario() {
  const [valorPropiedad, setValorPropiedad] = useState(120000);
  const [enganche, setEnganche] = useState(20);
  const [plazoAnios, setPlazoAnios] = useState(20);
  const [ingresosMensuales, setIngresosMensuales] = useState(3000);
  const [tcDolar, setTcDolar] = useState(1200);
  const [cerMensual, setCerMensual] = useState(CER_PROYECTADO * 100);
  const [bancosVisibles, setBancosVisibles] = useState<Set<string>>(new Set(BANCOS.map(b => b.id)));

  const resultado = useMemo(() => {
    const monto = valorPropiedad * (1 - enganche / 100);
    const meses = plazoAnios * 12;

    return BANCOS.filter(b => bancosVisibles.has(b.id)).map(banco => {
      const ltvOk = (1 - enganche / 100) <= banco.ltv / 100;
      const plazoOk = plazoAnios <= banco.plazoMaxAnios;

      if (!ltvOk || !plazoOk) {
        return { ...banco, monto: 0, cuotaInicial: 0, cuotaActual: 0, totalPagado: 0, intereses: 0, cftea: 0, montoMaxPorIngreso: 0, ingresosNecesarios: 0, cuotaIngresoPct: 0, viable: false, motivoNoViable: !ltvOk ? `LTV máx ${banco.ltv}% (requerís ${(1 - enganche/100)*100}%)` : `Plazo máx ${banco.plazoMaxAnios} años` };
      }

      let cuotaInicialUSD: number;
      let cuotaActualUSD: number;
      let cuotaInicialARS: number;
      let montoMaxPorIngreso: number;

      if (banco.tipo === "uva") {
        // En líneas UVA: el préstamo es en UVAs, la cuota sube con CER
        const montoUSD = monto;
        const montoARS = montoUSD * tcDolar;
        const montoUVAs = montoARS / UVA_ACTUAL;
        // Tasa mensual en UVAs
        const tnaMensualUVA = banco.tnaBase / 12;
        const cuotaUVAs = cuotaFrances(montoUVAs, tnaMensualUVA, meses);
        cuotaInicialUSD = (cuotaUVAs * UVA_ACTUAL) / tcDolar;
        // Cuota actual ajustada por CER (cuotaUVAs crece con UVA, que sigue al CER)
        const uvaHoy = UVA_ACTUAL * Math.pow(1 + cerMensual / 100, 24); // proyectado 2 años
        cuotaActualUSD = (cuotaUVAs * uvaHoy) / tcDolar;
        cuotaInicialARS = cuotaUVAs * UVA_ACTUAL;
        // Monto financiable por ingresos
        const cuotaMaxUSD = ingresosMensuales * banco.cuotaIngresoMax / 100;
        montoMaxPorIngreso = cuotaMaxUSD > 0 ? cuotaMaxUSD / cuotaFrances(1, tnaMensualUVA, meses) * tcDolar / UVA_ACTUAL * UVA_ACTUAL / tcDolar : 0;
      } else {
        // Fija o mixta: en pesos o USD
        const tnaMensual = banco.tnaBase / 12;
        const montoARS = monto * tcDolar;
        cuotaInicialARS = cuotaFrances(montoARS, tnaMensual, meses);
        cuotaInicialUSD = cuotaInicialARS / tcDolar;
        cuotaActualUSD = cuotaInicialUSD; // fija no cambia nominalmente
        const cuotaMaxARS = ingresosMensuales * tcDolar * banco.cuotaIngresoMax / 100;
        montoMaxPorIngreso = cuotaMaxARS > 0 ? cuotaMaxARS / cuotaFrances(1, tnaMensual, meses) / tcDolar : 0;
      }

      const totalPagadoUSD = cuotaInicialUSD * meses; // simplificado (UVA en realidad crece)
      const intereses = totalPagadoUSD - monto;
      const cftea = Math.pow(1 + banco.tnaBase / 12 / 100, 12) - 1;

      const ingresosNecesarios = cuotaInicialUSD / (banco.cuotaIngresoMax / 100);
      const viable = ingresosMensuales >= ingresosNecesarios && monto <= montoMaxPorIngreso * (banco.ltv / 100) + monto;
      const cuotaIngresoPct = ingresosMensuales > 0 ? (cuotaInicialUSD / ingresosMensuales) * 100 : 0;

      return {
        ...banco,
        monto,
        cuotaInicial: cuotaInicialUSD,
        cuotaActual: cuotaActualUSD,
        totalPagado: totalPagadoUSD,
        intereses,
        cftea: cftea * 100,
        montoMaxPorIngreso,
        ingresosNecesarios,
        cuotaIngresoPct,
        viable: cuotaIngresoPct <= banco.cuotaIngresoMax,
        motivoNoViable: cuotaIngresoPct > banco.cuotaIngresoMax ? `Cuota ${cuotaIngresoPct.toFixed(0)}% ingresos (máx ${banco.cuotaIngresoMax}%)` : undefined,
      };
    }).sort((a, b) => a.cuotaInicial - b.cuotaInicial);
  }, [valorPropiedad, enganche, plazoAnios, ingresosMensuales, tcDolar, cerMensual, bancosVisibles]);

  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => `USD ${fmt(n)}`;

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 13, width: "100%",
    fontFamily: "Inter, sans-serif", boxSizing: "border-box" as const,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4, display: "block",
  };

  const montoFinanciado = valorPropiedad * (1 - enganche / 100);
  const mejorViable = resultado.find(r => r.viable);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>🏦 Comparativa de Créditos Hipotecarios</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>UVA, fija y mixta — 8 bancos — Mayo 2026</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", display: "flex", gap: 20 }}>

        {/* Panel izquierdo: inputs */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000", textTransform: "uppercase" }}>Parámetros</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Valor propiedad (USD)</label>
                <input type="number" value={valorPropiedad} onChange={e => setValorPropiedad(+e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Enganche / Anticipo (%)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min={10} max={60} value={enganche} onChange={e => setEnganche(+e.target.value)} style={{ flex: 1, accentColor: "#cc0000" }} />
                  <span style={{ minWidth: 35, fontSize: 13, color: "#fff" }}>{enganche}%</span>
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Financia: {fmtUSD(montoFinanciado)}</div>
              </div>
              <div>
                <label style={labelStyle}>Plazo (años)</label>
                <input type="number" min={5} max={30} value={plazoAnios} onChange={e => setPlazoAnios(+e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ingresos mensuales declarados (USD)</label>
                <input type="number" value={ingresosMensuales} onChange={e => setIngresosMensuales(+e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TC (ARS/USD)</label>
                <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>CER proyectado (% mensual)</label>
                <input type="number" step={0.1} value={cerMensual} onChange={e => setCerMensual(+e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Filtro bancos */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>Bancos</h2>
            {BANCOS.map(b => (
              <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={bancosVisibles.has(b.id)}
                  onChange={e => {
                    const s = new Set(bancosVisibles);
                    e.target.checked ? s.add(b.id) : s.delete(b.id);
                    setBancosVisibles(s);
                  }}
                  style={{ accentColor: b.color, width: 14, height: 14 }}
                />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#ccc" }}>{b.nombre}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Panel derecho: resultados */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Summary pill */}
          {mejorViable && (
            <div style={{
              background: "#22c55e10", border: "1px solid #22c55e", borderRadius: 10, padding: "14px 20px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>🏆</span>
              <div>
                <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#22c55e" }}>
                  Mejor opción viable: {mejorViable.nombre} — {mejorViable.tipo.toUpperCase()}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  Cuota inicial {fmtUSD(mejorViable.cuotaInicial)}/mes · CFTEA {mejorViable.cftea.toFixed(2)}% · {mejorViable.cuotaIngresoPct.toFixed(0)}% ingresos
                </div>
              </div>
            </div>
          )}

          {/* Cards por banco */}
          {resultado.map((banco, i) => (
            <div key={banco.id} style={{
              background: "#111", border: `1px solid ${banco.viable ? banco.color + "44" : "#333"}`,
              borderRadius: 10, padding: "16px 20px",
              opacity: banco.viable ? 1 : 0.55,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: banco.color }} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff" }}>{banco.nombre}</span>
                      {banco.badge && (
                        <span style={{ fontSize: 10, background: banco.color + "30", color: banco.color, padding: "1px 6px", borderRadius: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{banco.badge}</span>
                      )}
                      {i === 0 && banco.viable && (
                        <span style={{ fontSize: 10, background: "#22c55e30", color: "#22c55e", padding: "1px 6px", borderRadius: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>MENOR CUOTA</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      {banco.tipo.toUpperCase()} · TNA {banco.tnaBase}% {banco.tipo === "uva" ? "+ CER" : ""} · LTV {banco.ltv}% · {banco.plazoMaxAnios}a máx
                    </div>
                  </div>
                </div>
                {!banco.viable && (
                  <span style={{ fontSize: 11, color: "#ef4444", background: "#ef444415", padding: "2px 8px", borderRadius: 4 }}>
                    {banco.motivoNoViable ?? "No viable"}
                  </span>
                )}
              </div>

              {banco.viable ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Cuota inicial", val: fmtUSD(banco.cuotaInicial) + "/mes", color: banco.color },
                    { label: "Cuota proyect. (2a)", val: fmtUSD(banco.cuotaActual) + "/mes", color: banco.tipo === "uva" ? "#f59e0b" : "#888" },
                    { label: "Cuota / Ingresos", val: `${banco.cuotaIngresoPct.toFixed(1)}%`, color: banco.cuotaIngresoPct <= 25 ? "#22c55e" : banco.cuotaIngresoPct <= 35 ? "#f59e0b" : "#ef4444" },
                    { label: "Total pagado (est.)", val: fmtUSD(banco.totalPagado), color: "#888" },
                    { label: "Intereses totales", val: fmtUSD(banco.intereses), color: "#ef4444" },
                    { label: "CFTEA", val: `${banco.cftea.toFixed(2)}%`, color: "#a78bfa" },
                  ].map((kpi, j) => (
                    <div key={j}>
                      <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: kpi.color, marginTop: 2 }}>{kpi.val}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#555" }}>Esta línea no es compatible con los parámetros seleccionados.</div>
              )}
            </div>
          ))}

          {/* Tabla resumen */}
          {resultado.filter(r => r.viable).length > 1 && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #222" }}>
                    {["Banco","Tipo","TNA","Cuota inicial","Cuota 2a","% Ingresos","Total pagado","CFTEA"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.filter(r => r.viable).map((b, i) => (
                    <tr key={b.id} style={{ borderBottom: "1px solid #1a1a1a", background: i % 2 === 0 ? "#0d0d0d" : "transparent" }}>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: b.color }} />
                          <span style={{ fontSize: 12, color: "#fff" }}>{b.nombre}</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px", fontSize: 11, color: "#888" }}>{b.tipo.toUpperCase()}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: "#ccc" }}>{b.tnaBase}%</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: i === 0 ? "#22c55e" : "#ccc" }}>{fmtUSD(b.cuotaInicial)}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: b.tipo === "uva" ? "#f59e0b" : "#666" }}>{fmtUSD(b.cuotaActual)}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: b.cuotaIngresoPct <= 25 ? "#22c55e" : "#f59e0b" }}>{b.cuotaIngresoPct.toFixed(1)}%</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: "#888" }}>{fmtUSD(b.totalPagado)}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: "#a78bfa" }}>{b.cftea.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Aviso UVA */}
          <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#666" }}>
            ⚠️ <strong style={{ color: "#888" }}>Nota:</strong> Las cuotas UVA se ajustan mensualmente con el CER (inflación). La "cuota proyectada" asume una inflación del {cerMensual}% mensual durante 2 años. El total pagado es estimativo. Consultá con cada banco las condiciones vigentes antes de operar.
          </div>

        </div>
      </div>
    </div>
  );
}
