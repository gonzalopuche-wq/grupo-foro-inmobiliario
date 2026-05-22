"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PropComp {
  id: string;
  direccion: string;
  zona: string | null;
  tipo: string | null;
  operacion: string | null;
  precio: number | null;
  moneda: string | null;
  superficie_cubierta: number | null;
  superficie_total: number | null;
  ambientes: number | null;
  dormitorios: number | null;
  estado: string | null;
  created_at: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function precioM2USD(p: PropComp, tcDolar: number): number | null {
  if (!p.precio || !p.superficie_cubierta) return null;
  const precioUSD = p.moneda === "ARS" ? p.precio / tcDolar : p.precio;
  return precioUSD / p.superficie_cubierta;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function TasacionRapida() {
  const [comps, setComps] = useState<PropComp[]>([]);
  const [loading, setLoading] = useState(true);
  const [tcDolar, setTcDolar] = useState(1200);

  // Propiedad a tasar
  const [zona, setZona] = useState("");
  const [tipo, setTipo] = useState("departamento");
  const [supCubierta, setSupCubierta] = useState(60);
  const [supTotal, setSupTotal] = useState(70);
  const [ambientes, setAmbientes] = useState(2);
  const [dormitorios, setDormitorios] = useState(1);
  const [antiguedad, setAntiguedad] = useState(10);
  const [estado, setEstado] = useState<"excelente" | "bueno" | "regular" | "a_reciclar">("bueno");
  const [cochera, setCochera] = useState(false);
  const [pileta, setPileta] = useState(false);

  // Ajustes manuales
  const [ajusteManual, setAjusteManual] = useState(0);

  useEffect(() => {
    supabase
      .from("cartera_propiedades")
      .select("id,direccion,zona,tipo,operacion,precio,moneda,superficie_cubierta,superficie_total,ambientes,dormitorios,estado,created_at")
      .eq("estado", "activa")
      .then(({ data }) => {
        setComps((data ?? []) as PropComp[]);
        setLoading(false);
      });
  }, []);

  // Score de similitud para cada comparable
  const comparables = useMemo(() => {
    return comps
      .filter(p => precioM2USD(p, tcDolar) !== null)
      .map(p => {
        const pm2 = precioM2USD(p, tcDolar)!;
        let score = 100;

        // Penalizar diferencia de tipo
        if (p.tipo?.toLowerCase() !== tipo.toLowerCase()) score -= 30;

        // Penalizar diferencia de zona (si hay zona definida)
        if (zona && p.zona) {
          const zonaLow = zona.toLowerCase();
          const barrioLow = p.zona.toLowerCase();
          if (!barrioLow.includes(zonaLow) && !zonaLow.includes(barrioLow)) score -= 25;
        }

        // Penalizar diferencia de superficie (hasta 30%)
        if (p.superficie_cubierta) {
          const diff = Math.abs(p.superficie_cubierta - supCubierta) / supCubierta;
          score -= Math.min(diff * 40, 20);
        }

        // Penalizar diferencia de ambientes
        if (p.ambientes !== null) {
          const diffAmb = Math.abs((p.ambientes ?? 0) - ambientes);
          score -= diffAmb * 5;
        }

        return { ...p, pm2, score: Math.max(0, score) };
      })
      .filter(p => p.score >= 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [comps, tipo, zona, supCubierta, ambientes, tcDolar]);

  const tasacion = useMemo(() => {
    if (comparables.length === 0) return null;

    // Promedio ponderado por score
    const totalScore = comparables.reduce((s, c) => s + c.score, 0);
    const pm2Ponderado = comparables.reduce((s, c) => s + c.pm2 * c.score, 0) / totalScore;

    // Factores de ajuste
    let factor = 1.0;

    // Antigüedad: -0.5% por año hasta 30 años
    factor -= Math.min(antiguedad * 0.005, 0.15);

    // Estado
    const estadoFactors: Record<string, number> = { excelente: 1.08, bueno: 1.0, regular: 0.90, a_reciclar: 0.75 };
    factor *= estadoFactors[estado] ?? 1.0;

    // Cochera +8%
    if (cochera) factor *= 1.08;

    // Pileta +5%
    if (pileta) factor *= 1.05;

    const pm2Ajustado = pm2Ponderado * factor * (1 + ajusteManual / 100);
    const valorEstimado = pm2Ajustado * supCubierta;

    // Rango ±10%
    const min = valorEstimado * 0.90;
    const max = valorEstimado * 1.10;

    const pm2s = comparables.map(c => c.pm2);
    const pm2Min = Math.min(...pm2s);
    const pm2Max = Math.max(...pm2s);
    const pm2Mediana = pm2s.sort((a, b) => a - b)[Math.floor(pm2s.length / 2)];

    return { pm2Ponderado, pm2Ajustado, valorEstimado, min, max, pm2Min, pm2Max, pm2Mediana, factor };
  }, [comparables, antiguedad, estado, cochera, pileta, ajusteManual, supCubierta]);

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
  const sectionStyle: React.CSSProperties = { background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" };

  const exportPDF = () => {
    if (!tasacion) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Tasación Rápida</title>
      <style>body{font-family:Arial,sans-serif;font-size:13px;max-width:700px;margin:40px auto}h1{color:#cc0000}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.val{font-size:18px;font-weight:bold;color:#cc0000}</style>
      </head><body>
      <h1>🏠 Tasación Rápida</h1>
      <h2>Propiedad tasada</h2>
      <p><b>Tipo:</b> ${tipo} | <b>Zona/Barrio:</b> ${zona || "—"} | <b>Sup. cubierta:</b> ${supCubierta} m² | <b>Total:</b> ${supTotal} m²</p>
      <p><b>Ambientes:</b> ${ambientes} | <b>Dormitorios:</b> ${dormitorios} | <b>Antigüedad:</b> ${antiguedad} años | <b>Estado:</b> ${estado}</p>
      <p><b>Cochera:</b> ${cochera ? "Sí" : "No"} | <b>Pileta:</b> ${pileta ? "Sí" : "No"}</p>
      <h2>Resultado</h2>
      <p>Precio/m² promedio comps: <b>${fmtUSD(tasacion.pm2Ponderado)}/m²</b></p>
      <p>Precio/m² ajustado: <b>${fmtUSD(tasacion.pm2Ajustado)}/m²</b></p>
      <p class="val">Valor estimado: ${fmtUSD(tasacion.valorEstimado)}</p>
      <p>Rango: ${fmtUSD(tasacion.min)} — ${fmtUSD(tasacion.max)}</p>
      <h2>Comparables utilizados (${comparables.length})</h2>
      <table>
        <tr><th>Dirección</th><th>Tipo</th><th>Sup.</th><th>Precio/m²</th><th>Score</th></tr>
        ${comparables.map(c => `<tr><td>${c.direccion}</td><td>${c.tipo ?? "—"}</td><td>${c.superficie_cubierta ?? "—"} m²</td><td>${fmtUSD(c.pm2)}/m²</td><td>${c.score.toFixed(0)}</td></tr>`).join("")}
      </table>
      <p style="color:#888;font-size:11px">Generado: ${new Date().toLocaleDateString("es-AR")} — Tasación orientativa basada en comparables de cartera interna</p>
      </body></html>
    `);
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>🏠 Tasación Rápida</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Estimación de valor basada en comparables de la cartera activa</p>
        </div>
        <button onClick={exportPDF} disabled={!tasacion} style={{
          background: tasacion ? "#cc0000" : "#333", color: "#fff", border: "none", borderRadius: 8,
          padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: tasacion ? "pointer" : "not-allowed",
          fontFamily: "Montserrat, sans-serif",
        }}>📄 Informe PDF</button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Inputs propiedad */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000", textTransform: "uppercase" }}>Propiedad a tasar</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle}>
                  {["departamento","casa","ph","local","oficina","terreno","galpon"].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zona / Barrio</label>
                <input value={zona} onChange={e => setZona(e.target.value)} placeholder="Ej: Palermo, Belgrano..." style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Sup. cubierta (m²)</label>
                  <input type="number" value={supCubierta} onChange={e => setSupCubierta(+e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sup. total (m²)</label>
                  <input type="number" value={supTotal} onChange={e => setSupTotal(+e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Ambientes</label>
                  <input type="number" min={1} max={20} value={ambientes} onChange={e => setAmbientes(+e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Dormitorios</label>
                  <input type="number" min={0} max={10} value={dormitorios} onChange={e => setDormitorios(+e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase" }}>Atributos de ajuste</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Antigüedad (años)</label>
                  <input type="number" min={0} max={100} value={antiguedad} onChange={e => setAntiguedad(+e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>TC (ARS/USD)</label>
                  <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Estado de conservación</label>
                <select value={estado} onChange={e => setEstado(e.target.value as typeof estado)} style={inputStyle}>
                  <option value="excelente">Excelente (+8%)</option>
                  <option value="bueno">Bueno (base)</option>
                  <option value="regular">Regular (−10%)</option>
                  <option value="a_reciclar">A reciclar (−25%)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                {[{ id: "cochera", label: "Cochera (+8%)", val: cochera, set: setCochera }, { id: "pileta", label: "Pileta (+5%)", val: pileta, set: setPileta }].map(item => (
                  <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#ccc", cursor: "pointer" }}>
                    <input type="checkbox" checked={item.val} onChange={e => item.set(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#cc0000" }} />
                    {item.label}
                  </label>
                ))}
              </div>
              <div>
                <label style={labelStyle}>Ajuste manual (%)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min={-30} max={30} value={ajusteManual} onChange={e => setAjusteManual(+e.target.value)}
                    style={{ flex: 1, accentColor: "#cc0000" }} />
                  <span style={{ minWidth: 40, textAlign: "right", fontSize: 13, color: ajusteManual > 0 ? "#22c55e" : ajusteManual < 0 ? "#ef4444" : "#888" }}>
                    {ajusteManual > 0 ? "+" : ""}{ajusteManual}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resultado tasación */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 32 }}>Cargando comparables...</div>
        ) : tasacion ? (
          <>
            {/* KPIs principales */}
            <div style={{
              background: "#111", border: "2px solid #cc0000", borderRadius: 12, padding: "24px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
              <div style={{ fontSize: 12, color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                Valor estimado (basado en {comparables.length} comparable{comparables.length !== 1 ? "s" : ""})
              </div>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#fff", fontFamily: "Montserrat, sans-serif" }}>
                {fmtUSD(tasacion.valorEstimado)}
              </div>
              <div style={{ fontSize: 16, color: "#888" }}>
                Rango: <span style={{ color: "#22c55e" }}>{fmtUSD(tasacion.min)}</span> — <span style={{ color: "#f59e0b" }}>{fmtUSD(tasacion.max)}</span>
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                {fmtUSD(tasacion.pm2Ajustado)}/m² · Factor ajuste ×{tasacion.factor.toFixed(3)}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Precio/m² promedio comps", val: fmtUSD(tasacion.pm2Ponderado) + "/m²", color: "#3b82f6" },
                { label: "Precio/m² ajustado", val: fmtUSD(tasacion.pm2Ajustado) + "/m²", color: "#cc0000" },
                { label: "Mediana mercado", val: fmtUSD(tasacion.pm2Mediana) + "/m²", color: "#a78bfa" },
                { label: "Rango comps (mín)", val: fmtUSD(tasacion.pm2Min) + "/m²", color: "#22c55e" },
                { label: "Rango comps (máx)", val: fmtUSD(tasacion.pm2Max) + "/m²", color: "#f59e0b" },
              ].map((kpi, i) => (
                <div key={i} style={{ background: "#111", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
                </div>
              ))}
            </div>

            {/* Comparables */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #222" }}>
                <h2 style={{ margin: 0, fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                  Comparables ({comparables.length})
                </h2>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {["Dirección / Barrio","Tipo","Sup.","Precio/m²","Score similitud"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #111", background: i % 2 === 0 ? "#0d0d0d" : "transparent" }}>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontSize: 13, color: "#fff" }}>{c.direccion}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{c.zona ?? "—"}</div>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#888" }}>{c.tipo ?? "—"}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#ccc" }}>{c.superficie_cubierta ? `${c.superficie_cubierta} m²` : "—"}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#22c55e" }}>
                        {fmtUSD(c.pm2)}/m²
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ height: 6, width: 80, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${c.score}%`, background: c.score >= 70 ? "#22c55e" : c.score >= 40 ? "#f59e0b" : "#888", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#666" }}>{c.score.toFixed(0)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ background: "#111", border: "1px solid #333", borderRadius: 10, padding: 32, textAlign: "center", color: "#666" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <p>No hay comparables suficientes en la cartera activa para los filtros seleccionados.</p>
            <p style={{ fontSize: 12 }}>Probá cambiando el tipo de propiedad o dejando la zona en blanco.</p>
          </div>
        )}

      </div>
    </div>
  );
}
