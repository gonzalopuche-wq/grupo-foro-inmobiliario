"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function usd(n: number) { return `USD ${fmt(Math.round(n))}`; }
function pctFmt(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }

interface Activo {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  categoria: string;
  rendAnual: number;     // % anual nominal USD (editable)
  volatilidad: "baja" | "media" | "alta" | "muy alta";
  liquidez: "inmediata" | "días" | "semanas" | "meses";
  descripcion: string;
  nota: string;
  usaApalancamiento?: boolean;
}

const ACTIVOS_DEFAULT: Activo[] = [
  { id: "inmueble", nombre: "Inmueble alquilado", icono: "🏠", color: "#cc0000", categoria: "Real estate", rendAnual: 8, volatilidad: "baja", liquidez: "meses", descripcion: "Renta + apreciación en USD", nota: "Incluye renta neta + apreciación anual estimada. Con apalancamiento el retorno sobre capital propio puede duplicarse.", usaApalancamiento: true },
  { id: "plazo_fijo_usd", nombre: "Plazo fijo USD", icono: "🏦", color: "#22c55e", categoria: "Bancario", rendAnual: 5, volatilidad: "baja", liquidez: "días", descripcion: "Tasa fija en dólares banco local", nota: "Retorno garantizado pero bajo. Sin exposición a apreciación del activo." },
  { id: "on_usd", nombre: "Obligaciones negociables USD", icono: "📄", color: "#3b82f6", categoria: "Renta fija", rendAnual: 8.5, volatilidad: "media", liquidez: "días", descripcion: "ONs de empresas argentinas en USD", nota: "Mayor rendimiento que plazo fijo pero con riesgo crédito corporativo." },
  { id: "cedears", nombre: "CEDEARs / S&P 500", icono: "📈", color: "#a855f7", categoria: "Renta variable", rendAnual: 10, volatilidad: "alta", liquidez: "días", descripcion: "Acciones globales vía CEDEARs", nota: "Histórico S&P 500: ~10% anual en USD. Alta volatilidad en corto plazo." },
  { id: "gold", nombre: "Oro", icono: "🥇", color: "#eab308", categoria: "Commodities", rendAnual: 5.5, volatilidad: "media", liquidez: "días", descripcion: "Reserva de valor histórica", nota: "Cobertura inflacionaria. Rendimiento moderado sin flujo de caja." },
  { id: "btc", nombre: "Bitcoin", icono: "₿", color: "#f97316", categoria: "Cripto", rendAnual: 20, volatilidad: "muy alta", liquidez: "inmediata", descripcion: "Activo digital de mayor capitalización", nota: "Retorno histórico muy alto pero con drawdowns de 70%+. Alto riesgo." },
  { id: "bono_soberano", nombre: "Bonos soberanos USD", icono: "🇦🇷", color: "#06b6d4", categoria: "Renta fija", rendAnual: 12, volatilidad: "alta", liquidez: "días", descripcion: "Bonos en USD del Estado argentino", nota: "Alto rendimiento compensado por riesgo soberano Argentina. GD35, AE38, etc." },
];

export default function RendimientoComparadoPage() {
  const [capital, setCapital] = useState(100000); // USD
  const [horizonte, setHorizonte] = useState(10);
  const [enganch, setEnganch] = useState(30); // % equity en inmueble
  const [rendInmueble, setRendInmueble] = useState(8); // % total (renta + apreciacion)
  const [activos, setActivos] = useState<Activo[]>(ACTIVOS_DEFAULT);
  const [mostrarApal, setMostrarApal] = useState(true);

  const updRend = (id: string, val: number) => {
    setActivos(prev => prev.map(a => a.id === id ? { ...a, rendAnual: val } : a));
  };

  const resultados = useMemo(() => {
    return activos.map(a => {
      let rendEfectivo = a.id === "inmueble" ? rendInmueble : a.rendAnual;
      let notaApal = "";
      let rendSobreCapital = rendEfectivo;

      if (a.id === "inmueble" && mostrarApal && enganch < 100) {
        // Con apalancamiento: la apreciación del activo completo sobre el capital propio
        const palanca = 100 / enganch;
        // Asumimos que la renta cubre el costo de la deuda (simplificación)
        rendSobreCapital = rendEfectivo * palanca;
        notaApal = `(×${palanca.toFixed(1)} apalancamiento con ${enganch}% enganche)`;
      }

      const valorFinal = capital * Math.pow(1 + rendSobreCapital / 100, horizonte);
      const ganancia = valorFinal - capital;
      const cagr = (Math.pow(valorFinal / capital, 1 / horizonte) - 1) * 100;

      const puntosPorAno: number[] = [];
      for (let y = 0; y <= horizonte; y++) {
        puntosPorAno.push(capital * Math.pow(1 + rendSobreCapital / 100, y));
      }

      return { ...a, rendEfectivo, rendSobreCapital, valorFinal, ganancia, cagr, puntosPorAno, notaApal };
    }).sort((a, b) => b.valorFinal - a.valorFinal);
  }, [activos, capital, horizonte, enganch, rendInmueble, mostrarApal]);

  const maxValorFinal = Math.max(...resultados.map(r => r.valorFinal));
  const maxValorSinApal = Math.max(...resultados.filter(r => r.id !== "inmueble" || !mostrarApal).map(r => r.valorFinal));

  const volatilidad_label: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta", "muy alta": "Muy alta" };
  const volatilidad_color: Record<string, string> = { baja: "#22c55e", media: "#eab308", alta: "#f97316", "muy alta": "#cc0000" };
  const liquidez_color: Record<string, string> = { inmediata: "#22c55e", días: "#22c55e", semanas: "#eab308", meses: "#f97316" };

  // SVG chart — evolución temporal
  const SVG_W = 560;
  const SVG_H = 200;
  const maxY = Math.max(...resultados.flatMap(r => r.puntosPorAno));
  const toX = (y: number) => (y / horizonte) * (SVG_W - 40) + 20;
  const toY = (v: number) => SVG_H - 20 - ((v - capital * 0.8) / (maxY - capital * 0.8 + 1)) * (SVG_H - 30);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>📊 Rendimiento Comparado de Activos</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Inmueble vs renta fija, acciones, oro y cripto — proyección USD a {horizonte} años</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Parámetros</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Capital inicial (USD)", value: capital, set: setCapital, step: 10000 },
                  { label: "Horizonte (años)", value: horizonte, set: setHorizonte, step: 1 },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>{f.label}</label>
                    <input type="number" value={f.value} step={f.step} onChange={e => f.set(parseFloat(e.target.value)||1)}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #cc000033", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#cc0000", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>🏠 Inmueble</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>Rend. anual total % (renta + aprec.)</label>
                  <input type="number" value={rendInmueble} step={0.5} onChange={e => setRendInmueble(parseFloat(e.target.value)||0)}
                    style={{ background: "#0a0a0a", border: "1px solid #cc000033", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>Enganche / equity (%)</label>
                  <input type="number" value={enganch} step={5} min={10} max={100} onChange={e => setEnganch(parseFloat(e.target.value)||30)}
                    style={{ background: "#0a0a0a", border: "1px solid #cc000033", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}>
                  <input type="checkbox" checked={mostrarApal} onChange={e => setMostrarApal(e.target.checked)} />
                  Mostrar con apalancamiento
                </label>
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Tasas editables</div>
              {activos.filter(a => a.id !== "inmueble").map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{a.icono}</span>
                  <span style={{ fontSize: 11, color: "#6b7280", flex: 1 }}>{a.nombre}</span>
                  <input type="number" value={a.rendAnual} step={0.5} onChange={e => updRend(a.id, parseFloat(e.target.value)||0)}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 4, color: "#e5e5e5", padding: "3px 6px", fontSize: 12, width: 60, textAlign: "right" }} />
                  <span style={{ fontSize: 11, color: "#4b5563" }}>%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resultados */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Ranking */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>Ranking — {usd(capital)} a {horizonte} años</div>
              {resultados.map((r, idx) => (
                <div key={r.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: "#4b5563", width: 20 }}>#{idx + 1}</span>
                      <span style={{ fontSize: 18 }}>{r.icono}</span>
                      <div>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#fff" }}>{r.nombre}</span>
                        {r.notaApal && <span style={{ fontSize: 10, color: "#cc0000", marginLeft: 6 }}>{r.notaApal}</span>}
                        <div style={{ fontSize: 10, color: "#4b5563" }}>{r.categoria} · Volatilidad: <span style={{ color: volatilidad_color[r.volatilidad] }}>{volatilidad_label[r.volatilidad]}</span> · Liquidez: <span style={{ color: liquidez_color[r.liquidez] }}>{r.liquidez}</span></div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: r.color }}>{usd(r.valorFinal)}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>CAGR {pctFmt(r.cagr)} · Ganancia {usd(r.ganancia)}</div>
                    </div>
                  </div>
                  <div style={{ background: "#0a0a0a", borderRadius: 4, height: 10, overflow: "hidden" }}>
                    <div style={{ width: `${(r.valorFinal / maxValorFinal) * 100}%`, height: "100%", background: r.color, borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Gráfico evolución */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Evolución del capital</div>
              <svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
                {/* Grid horizontal */}
                {[0.25, 0.5, 0.75, 1].map(pct => {
                  const y = SVG_H - 20 - pct * (SVG_H - 30);
                  return <line key={pct} x1={20} x2={SVG_W - 10} y1={y} y2={y} stroke="#1f2937" strokeWidth={1} />;
                })}
                {/* Líneas de activos */}
                {resultados.map(r => (
                  <polyline key={r.id}
                    points={r.puntosPorAno.map((v, i) => `${toX(i)},${toY(v)}`).join(" ")}
                    fill="none" stroke={r.color} strokeWidth={r.id === "inmueble" ? 2.5 : 1.5}
                    strokeDasharray={r.id === "inmueble" ? undefined : "none"}
                    opacity={r.id === "inmueble" ? 1 : 0.7}
                  />
                ))}
                {/* Etiquetas eje X */}
                {[0, Math.floor(horizonte / 2), horizonte].map(y => (
                  <text key={y} x={toX(y)} y={SVG_H - 4} textAnchor="middle" fill="#6b7280" fontSize={9} fontFamily="Montserrat">Año {y}</text>
                ))}
              </svg>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                {resultados.map(r => (
                  <span key={r.id} style={{ fontSize: 10, color: r.color, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ display: "inline-block", width: 16, height: 2, background: r.color }} /> {r.nombre}
                  </span>
                ))}
              </div>
            </div>

            {/* Tabla comparativa */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Comparativa detallada</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Activo", "Rend./año", "Valor final", "Ganancia", "CAGR", "Volatilidad", "Liquidez"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: h === "Activo" ? "left" : "right", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #1f2937", fontFamily: "Montserrat, sans-serif", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map(r => (
                      <tr key={r.id} style={{ borderBottom: "1px solid #111", background: r.id === "inmueble" ? "rgba(204,0,0,0.04)" : undefined }}>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: r.color }}>{r.icono} {r.nombre}</span>
                          {r.notaApal && <div style={{ fontSize: 9, color: "#cc0000" }}>{r.notaApal}</div>}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>{pctFmt(r.rendSobreCapital)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: r.color }}>{usd(r.valorFinal)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: r.ganancia > 0 ? "#22c55e" : "#cc0000" }}>{usd(r.ganancia)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>{pctFmt(r.cagr)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>
                          <span style={{ color: volatilidad_color[r.volatilidad], fontSize: 11 }}>{volatilidad_label[r.volatilidad]}</span>
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>
                          <span style={{ color: liquidez_color[r.liquidez], fontSize: 11 }}>{r.liquidez}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
              <strong style={{ color: "#9ca3af" }}>⚠️ Advertencia:</strong> Los rendimientos históricos no garantizan resultados futuros. El apalancamiento amplifica tanto ganancias como pérdidas. Esta herramienta es solo informativa.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
