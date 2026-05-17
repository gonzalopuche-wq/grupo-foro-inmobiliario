"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

type Sistema = "frances" | "aleman" | "americano";

interface CuotaRow {
  mes: number;
  cuota: number;
  capital: number;
  interes: number;
  saldo: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tablaFrances(capital: number, tnaMensual: number, meses: number): CuotaRow[] {
  const r = tnaMensual / 100;
  const cuota = r === 0 ? capital / meses : capital * r * Math.pow(1 + r, meses) / (Math.pow(1 + r, meses) - 1);
  const rows: CuotaRow[] = [];
  let saldo = capital;
  for (let i = 1; i <= meses; i++) {
    const interes = saldo * r;
    const cap = cuota - interes;
    saldo = Math.max(saldo - cap, 0);
    rows.push({ mes: i, cuota, capital: cap, interes, saldo });
  }
  return rows;
}

function tablaAleman(capital: number, tnaMensual: number, meses: number): CuotaRow[] {
  const r = tnaMensual / 100;
  const capFijo = capital / meses;
  const rows: CuotaRow[] = [];
  let saldo = capital;
  for (let i = 1; i <= meses; i++) {
    const interes = saldo * r;
    const cuota = capFijo + interes;
    saldo = Math.max(saldo - capFijo, 0);
    rows.push({ mes: i, cuota, capital: capFijo, interes, saldo });
  }
  return rows;
}

function tablaAmericano(capital: number, tnaMensual: number, meses: number): CuotaRow[] {
  const r = tnaMensual / 100;
  const rows: CuotaRow[] = [];
  for (let i = 1; i <= meses; i++) {
    const esFinal = i === meses;
    const cap = esFinal ? capital : 0;
    const interes = capital * r;
    const cuota = interes + cap;
    rows.push({ mes: i, cuota, capital: cap, interes, saldo: esFinal ? 0 : capital });
  }
  return rows;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function CalculadoraAmortizacion() {
  const [capital, setCapital] = useState(100000);
  const [tna, setTna] = useState(8.0);
  const [plazoAnios, setPlazoAnios] = useState(10);
  const [moneda, setMoneda] = useState<"USD" | "ARS">("USD");
  const [sistemaActivo, setSistemaActivo] = useState<Sistema>("frances");
  const [mostrarTabla, setMostrarTabla] = useState(false);

  const meses = plazoAnios * 12;
  const tnaMensual = tna / 12;

  const sistemas = useMemo(() => {
    const f = tablaFrances(capital, tnaMensual, meses);
    const a = tablaAleman(capital, tnaMensual, meses);
    const am = tablaAmericano(capital, tnaMensual, meses);
    return {
      frances: { tabla: f, cuotaInicial: f[0]?.cuota ?? 0, cuotaFinal: f[meses - 1]?.cuota ?? 0, totalPagado: f.reduce((s, r) => s + r.cuota, 0), totalIntereses: f.reduce((s, r) => s + r.interes, 0) },
      aleman: { tabla: a, cuotaInicial: a[0]?.cuota ?? 0, cuotaFinal: a[meses - 1]?.cuota ?? 0, totalPagado: a.reduce((s, r) => s + r.cuota, 0), totalIntereses: a.reduce((s, r) => s + r.interes, 0) },
      americano: { tabla: am, cuotaInicial: am[0]?.cuota ?? 0, cuotaFinal: am[meses - 1]?.cuota ?? 0, totalPagado: am.reduce((s, r) => s + r.cuota, 0), totalIntereses: am.reduce((s, r) => s + r.interes, 0) },
    };
  }, [capital, tnaMensual, meses]);

  const tablaActiva = sistemas[sistemaActivo].tabla;
  const totalMasBaratoIntereses = Math.min(sistemas.frances.totalIntereses, sistemas.aleman.totalIntereses, sistemas.americano.totalIntereses);

  const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtM = (n: number) => `${moneda === "USD" ? "USD " : "$ "}${fmt(n)}`;

  const SISTEMAS_INFO: { id: Sistema; label: string; icon: string; desc: string; ventaja: string }[] = [
    { id: "frances", label: "Sistema Francés", icon: "🇫🇷", desc: "Cuota fija durante todo el préstamo. Capital crece y los intereses bajan.", ventaja: "Cuota constante y predecible" },
    { id: "aleman",  label: "Sistema Alemán",  icon: "🇩🇪", desc: "Capital amortizado fijo. Cuota decrece mes a mes.", ventaja: "Menos intereses totales" },
    { id: "americano", label: "Sistema Americano", icon: "🇺🇸", desc: "Solo intereses durante el plazo. Capital íntegro al final (bullet).", ventaja: "Cuota mensual mínima" },
  ];

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Inter, sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4, display: "block",
  };

  // Datos para gráfico de saldo (cada 12 meses)
  const graficoPuntos = [0, 1, 2, 3].map(s => {
    const idx = Math.min(s * Math.floor(meses / 3), meses - 1);
    return {
      mes: idx,
      frances: sistemas.frances.tabla[idx]?.saldo ?? 0,
      aleman: sistemas.aleman.tabla[idx]?.saldo ?? 0,
      americano: sistemas.americano.tabla[idx]?.saldo ?? capital,
    };
  }).concat([{ mes: meses, frances: 0, aleman: 0, americano: 0 }]);

  // SVG comparativa de saldo
  const svgW = 500, svgH = 120;
  function saldoPath(key: "frances" | "aleman" | "americano"): string {
    const points = (key === "americano"
      ? [{ mes: 0, saldo: capital }, { mes: meses - 1, saldo: capital }, { mes: meses, saldo: 0 }]
      : Array.from({ length: Math.min(meses, 60) + 1 }, (_, i) => {
          const idx = Math.round(i * meses / Math.min(meses, 60));
          return { mes: idx, saldo: sistemas[key].tabla[Math.min(idx, meses - 1)]?.saldo ?? 0 };
        })
    );
    return points.map((p, i) => {
      const x = (p.mes / meses) * svgW;
      const y = svgH - (p.saldo / capital) * svgH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  const COLORES: Record<Sistema, string> = { frances: "#3b82f6", aleman: "#22c55e", americano: "#f59e0b" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/calculadoras" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>📊 Sistemas de Amortización</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Francés vs Alemán vs Americano (bullet) — comparativa completa</p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Inputs */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            <div>
              <label style={labelStyle}>Capital a financiar</label>
              <input type="number" value={capital} onChange={e => setCapital(+e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            </div>
            <div>
              <label style={labelStyle}>Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value as "USD" | "ARS")} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>TNA (%)</label>
              <input type="number" step={0.1} value={tna} onChange={e => setTna(+e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            </div>
            <div>
              <label style={labelStyle}>Plazo (años)</label>
              <input type="number" min={1} max={30} value={plazoAnios} onChange={e => setPlazoAnios(+e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
            </div>
          </div>
        </div>

        {/* Cards de sistemas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {SISTEMAS_INFO.map(s => {
            const data = sistemas[s.id];
            const esMejorIntereses = data.totalIntereses === totalMasBaratoIntereses;
            return (
              <div
                key={s.id}
                onClick={() => setSistemaActivo(s.id)}
                style={{
                  background: "#111", borderRadius: 10, padding: "20px",
                  border: `2px solid ${sistemaActivo === s.id ? COLORES[s.id] : "#222"}`,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: sistemaActivo === s.id ? COLORES[s.id] : "#fff" }}>{s.label}</div>
                    {esMejorIntereses && <span style={{ fontSize: 10, background: "#22c55e20", color: "#22c55e", padding: "1px 6px", borderRadius: 4 }}>MENOR COSTO</span>}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>{s.desc}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#888" }}>Cuota inicial</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORES[s.id] }}>{fmtM(data.cuotaInicial)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#888" }}>Cuota final</span>
                    <span style={{ fontSize: 13, color: "#ccc" }}>{fmtM(data.cuotaFinal)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#888" }}>Total intereses</span>
                    <span style={{ fontSize: 13, color: "#ef4444" }}>{fmtM(data.totalIntereses)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#888" }}>Total pagado</span>
                    <span style={{ fontSize: 13, color: "#fff" }}>{fmtM(data.totalPagado)}</span>
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: "6px 10px", background: COLORES[s.id] + "15", borderRadius: 6, fontSize: 11, color: COLORES[s.id] }}>
                  ✓ {s.ventaja}
                </div>
              </div>
            );
          })}
        </div>

        {/* Gráfico evolución saldo */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
            Evolución del saldo
          </h2>
          <svg width="100%" viewBox={`0 0 ${svgW} ${svgH + 20}`} style={{ overflow: "visible" }}>
            {/* Eje X */}
            <line x1="0" y1={svgH} x2={svgW} y2={svgH} stroke="#222" strokeWidth={1} />
            {/* Líneas por sistema */}
            {(["frances", "aleman", "americano"] as Sistema[]).map(key => (
              <path key={key} d={saldoPath(key)} fill="none" stroke={COLORES[key]} strokeWidth={2} />
            ))}
            {/* Etiquetas eje X */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => (
              <text key={pct} x={pct * svgW} y={svgH + 16} fill="#555" fontSize={10} textAnchor="middle">
                {`${Math.round(pct * plazoAnios)}a`}
              </text>
            ))}
          </svg>
          <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
            {SISTEMAS_INFO.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 3, background: COLORES[s.id], borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "#888" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla de amortización */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
          <div
            onClick={() => setMostrarTabla(!mostrarTabla)}
            style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: mostrarTabla ? "1px solid #222" : "none" }}
          >
            <h2 style={{ margin: 0, fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
              Tabla — {SISTEMAS_INFO.find(s => s.id === sistemaActivo)?.label} ({meses} cuotas)
            </h2>
            <span style={{ color: "#666" }}>{mostrarTabla ? "▲ Ocultar" : "▼ Ver tabla"}</span>
          </div>
          {mostrarTabla && (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, background: "#111", zIndex: 1 }}>
                  <tr>
                    {["Mes","Cuota","Capital","Interés","Saldo"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tablaActiva.map((row, i) => (
                    <tr key={row.mes} style={{ borderBottom: "1px solid #0d0d0d", background: i % 2 === 0 ? "#0d0d0d" : "transparent" }}>
                      <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#666" }}>{row.mes}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: COLORES[sistemaActivo], fontWeight: 600 }}>{fmtM(row.cuota)}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#22c55e" }}>{fmtM(row.capital)}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#ef4444" }}>{fmtM(row.interes)}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 12, color: "#ccc" }}>{fmtM(row.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
