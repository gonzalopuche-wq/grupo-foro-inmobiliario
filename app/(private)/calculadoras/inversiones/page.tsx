"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Datos históricos de referencia ────────────────────────────────────────────
// Rentabilidades anuales aproximadas en Argentina (en USD y ARS)
// Fuente: estimaciones del mercado, BCRA, Rava, Merval

interface Activo {
  id: string;
  label: string;
  icon: string;
  color: string;
  moneda: "USD" | "ARS";
  rendAnual: number;       // % anual base
  volatilidad: "baja" | "media" | "alta" | "muy_alta";
  liquidez: "diaria" | "semanal" | "mensual" | "anual" | "iliquidez";
  descripcion: string;
  ventajas: string[];
  desventajas: string[];
  editable: boolean;
}

const ACTIVOS: Activo[] = [
  {
    id: "ladrillo_renta",
    label: "Ladrillo (alquiler)",
    icon: "🏠",
    color: "#cc0000",
    moneda: "USD",
    rendAnual: 5.5,
    volatilidad: "baja",
    liquidez: "iliquidez",
    descripcion: "Propiedad para alquilar. Renta neta anual sobre valor de compra.",
    ventajas: ["Activo real, protege de inflación", "Ingreso mensual recurrente", "Apreciación histórica"],
    desventajas: ["Ilíquido", "Requiere gestión activa", "Vacancia y gastos fijos"],
    editable: true,
  },
  {
    id: "ladrillo_pozo",
    label: "Ladrillo (en pozo)",
    icon: "🏗️",
    color: "#f97316",
    moneda: "USD",
    rendAnual: 18,
    volatilidad: "media",
    liquidez: "iliquidez",
    descripcion: "Compra en pozo. Apreciación estimada al finalizar obra vs precio entrada.",
    ventajas: ["Alta apreciación potencial", "Entrada a precio de costo", "Sin impuestos sobre ganancia (persona física)"],
    desventajas: ["Inmovilización 2-3 años", "Riesgo constructora", "Ajuste CAC en cuotas"],
    editable: true,
  },
  {
    id: "dolar_blue",
    label: "Dólar billete",
    icon: "💵",
    color: "#22c55e",
    moneda: "USD",
    rendAnual: 0,
    volatilidad: "alta",
    liquidez: "diaria",
    descripcion: "Conservar ahorro en dólares billetes. Sin rendimiento nominal pero protege contra devaluación ARS.",
    ventajas: ["Máxima liquidez", "Sin riesgo contraparte", "Protección devaluación"],
    desventajas: ["Sin rendimiento", "Riesgo físico (robo)", "Queda fuera del sistema financiero"],
    editable: false,
  },
  {
    id: "plazo_fijo_usd",
    label: "Plazo fijo USD",
    icon: "🏦",
    color: "#3b82f6",
    moneda: "USD",
    rendAnual: 3.5,
    volatilidad: "baja",
    liquidez: "mensual",
    descripcion: "Depósito a plazo en dólares en banco local. Tasa en torno al 3-5% anual.",
    ventajas: ["Garantía FGD hasta USD 50k", "Sin gestión", "Tasa conocida"],
    desventajas: ["Baja rentabilidad", "Riesgo banco local", "Liquidez restringida"],
    editable: true,
  },
  {
    id: "on_usd",
    label: "Obligaciones Neg. (ON)",
    icon: "📊",
    color: "#8b5cf6",
    moneda: "USD",
    rendAnual: 7.5,
    volatilidad: "media",
    liquidez: "semanal",
    descripcion: "Deuda corporativa en dólares de empresas argentinas. Rinde 6-10% anual en USD.",
    ventajas: ["Renta en dólares", "Diversificación", "Liquidez en mercado secundario"],
    desventajas: ["Riesgo corporativo", "Requiere cuenta comitente", "Volatilidad de precio"],
    editable: true,
  },
  {
    id: "cedears",
    label: "CEDEARs (acciones USA)",
    icon: "📈",
    color: "#f59e0b",
    moneda: "USD",
    rendAnual: 12,
    volatilidad: "muy_alta",
    liquidez: "diaria",
    descripcion: "Certificados de depósito de acciones extranjeras. Exposición a S&P500 o empresas USA.",
    ventajas: ["Alta rentabilidad histórica", "Liquidez diaria", "Dolarizado"],
    desventajas: ["Alta volatilidad", "Pérdidas posibles", "Requiere conocimiento financiero"],
    editable: true,
  },
  {
    id: "merval",
    label: "Acciones locales",
    icon: "🇦🇷",
    color: "#eab308",
    moneda: "USD",
    rendAnual: 15,
    volatilidad: "muy_alta",
    liquidez: "diaria",
    descripcion: "Acciones de empresas argentinas (Merval). Alta volatilidad y potencial.",
    ventajas: ["Altísimo potencial", "Dolarizado en términos reales", "Liquidez"],
    desventajas: ["Riesgo político alto", "Volatilidad extrema", "Requiere seguimiento"],
    editable: true,
  },
  {
    id: "plazo_fijo_ars",
    label: "Plazo fijo ARS",
    icon: "💰",
    color: "#6b7280",
    moneda: "ARS",
    rendAnual: 32,
    volatilidad: "baja",
    liquidez: "mensual",
    descripcion: "Plazo fijo tradicional en pesos. Rinde por encima de inflación solo si TNA > IPC.",
    ventajas: ["Sin riesgo capital nominal", "Garantía FGD", "Simple"],
    desventajas: ["Pierde valor real si inflación > TNA", "Tasa variable", "En moneda depreciada"],
    editable: true,
  },
];

const VOL_COLOR = { baja: "#22c55e", media: "#f59e0b", alta: "#f97316", muy_alta: "#ef4444" };
const LIQ_LABEL: Record<string, string> = { diaria: "Diaria", semanal: "Semanal", mensual: "Mensual", anual: "Anual", iliquidez: "Ilíquido" };

const fmt = (n: number, d = 0) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = (n: number) => `USD ${fmt(n, 0)}`;
const fmtPct = (n: number) => `${fmt(n, 2)}%`;

export default function CalculadoraInversiones() {
  const [capital, setCapital] = useState<string>("50000");
  const [plazo, setPlazo] = useState<number>(5);
  const [rendimientos, setRendimientos] = useState<Record<string, number>>(
    Object.fromEntries(ACTIVOS.map(a => [a.id, a.rendAnual]))
  );
  const [activos, setActivos] = useState<Set<string>>(new Set(["ladrillo_renta", "dolar_blue", "plazo_fijo_usd", "on_usd", "cedears"]));

  const cap = parseFloat(capital) || 0;

  const resultados = useMemo(() => {
    return ACTIVOS.filter(a => activos.has(a.id)).map(a => {
      const tasa = (rendimientos[a.id] ?? a.rendAnual) / 100;
      const valorFinal = cap * Math.pow(1 + tasa, plazo);
      const ganancia = valorFinal - cap;
      const roiTotal = cap > 0 ? (ganancia / cap) * 100 : 0;
      const roiAnual = (Math.pow(1 + roiTotal / 100, 1 / plazo) - 1) * 100;
      return { ...a, tasa: tasa * 100, valorFinal, ganancia, roiTotal, roiAnual };
    }).sort((a, b) => b.valorFinal - a.valorFinal);
  }, [cap, plazo, rendimientos, activos]);

  const maxValor = Math.max(...resultados.map(r => r.valorFinal), cap, 1);
  const ganador = resultados[0];

  const inputStyle: React.CSSProperties = {
    background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
    color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, padding: "7px 10px", width: "100%", boxSizing: "border-box",
  };
  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "18px 20px",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4, display: "block",
  };

  function toggleActivo(id: string) {
    setActivos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Comparativa de Inversiones</h1>
        <span style={{ background: "#f59e0b", color: "#000", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>LADRILLO VS TODO</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
        {/* Panel izquierdo */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Parámetros</div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Capital inicial (USD)</label>
              <input style={inputStyle} type="number" value={capital} onChange={e => setCapital(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Horizonte: {plazo} años</label>
              <input type="range" min={1} max={20} value={plazo} onChange={e => setPlazo(Number(e.target.value))} style={{ width: "100%", accentColor: "#cc0000" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                <span>1 año</span><span>10</span><span>20 años</span>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Activos a comparar</div>
            {ACTIVOS.map(a => (
              <div key={a.id} style={{ marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 6 }}>
                  <input type="checkbox" checked={activos.has(a.id)} onChange={() => toggleActivo(a.id)} style={{ accentColor: a.color }} />
                  <span style={{ fontSize: 12, color: activos.has(a.id) ? "#fff" : "rgba(255,255,255,0.4)" }}>{a.icon} {a.label}</span>
                </label>
                {activos.has(a.id) && a.editable && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 20 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>TNA:</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rendimientos[a.id] ?? a.rendAnual}
                      onChange={e => setRendimientos(prev => ({ ...prev, [a.id]: parseFloat(e.target.value) || 0 }))}
                      style={{ ...inputStyle, width: 70, padding: "4px 8px", fontSize: 12 }}
                    />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>%/año</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, borderColor: "rgba(255,165,0,0.15)" }}>
            <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", marginBottom: 6 }}>AVISO</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              Rentabilidades estimadas con fines ilustrativos. Rendimientos pasados no garantizan resultados futuros. Consultar con asesor financiero.
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Ganador */}
          {ganador && (
            <div style={{ ...cardStyle, borderColor: `${ganador.color}40`, background: `${ganador.color}08` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Mayor rendimiento en {plazo} años</div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: ganador.color }}>{ganador.icon} {ganador.label}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{ganador.descripcion}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 28, fontWeight: 800, color: ganador.color }}>{fmtUSD(ganador.valorFinal)}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>+{fmtUSD(ganador.ganancia)} · +{fmtPct(ganador.roiTotal)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Barras comparativas */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
              Valor final de {fmtUSD(cap)} en {plazo} años
            </div>
            {resultados.map((r, i) => (
              <div key={r.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {i === 0 && <span style={{ fontSize: 9, background: r.color, color: "#000", fontFamily: "Montserrat,sans-serif", fontWeight: 800, padding: "1px 6px", borderRadius: 3 }}>1°</span>}
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{r.icon} {r.label}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmtPct(r.tasa)}/año</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: r.color }}>{fmtUSD(r.valorFinal)}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: 6 }}>+{fmtPct(r.roiTotal)}</span>
                  </div>
                </div>
                <div style={{ height: 10, background: "rgba(255,255,255,0.05)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(r.valorFinal / maxValor) * 100}%`, background: r.color, borderRadius: 5, opacity: 0.85 }} />
                </div>
              </div>
            ))}
            {/* Línea capital inicial */}
            <div style={{ marginTop: 6, padding: "8px 10px", background: "#111", borderRadius: 6, display: "flex", justifyContent: "space-between", fontSize: 10 }}>
              <span style={{ color: "rgba(255,255,255,0.3)" }}>Capital inicial</span>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{fmtUSD(cap)}</span>
            </div>
          </div>

          {/* Tabla comparativa */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Tabla comparativa</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    {["Activo","TNA","Valor Final","Ganancia","ROI Total","Volatilidad","Liquidez"].map(h => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i === 0 ? `${r.color}08` : undefined }}>
                      <td style={{ padding: "7px 8px", color: r.color, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{r.icon} {r.label}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "rgba(255,255,255,0.6)" }}>{fmtPct(r.tasa)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: r.color }}>{fmtUSD(r.valorFinal)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#22c55e" }}>+{fmtUSD(r.ganancia)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: "#22c55e" }}>+{fmtPct(r.roiTotal)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right" }}>
                        <span style={{ color: VOL_COLOR[r.volatilidad], fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{r.volatilidad.replace("_", " ")}</span>
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{LIQ_LABEL[r.liquidez]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ventajas y desventajas del ladrillo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {resultados.filter(r => r.id.startsWith("ladrillo")).map(r => (
              <div key={r.id} style={{ ...cardStyle, borderColor: `${r.color}25` }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: r.color, marginBottom: 10 }}>{r.icon} {r.label}</div>
                <div style={{ marginBottom: 8 }}>
                  {r.ventajas.map((v, i) => <div key={i} style={{ fontSize: 10, color: "#22c55e", marginBottom: 3 }}>✓ {v}</div>)}
                </div>
                {r.desventajas.map((d, i) => <div key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>✗ {d}</div>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
