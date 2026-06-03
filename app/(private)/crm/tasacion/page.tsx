"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos AVM ─────────────────────────────────────────────────────────────────

interface AVMValuacion {
  precio_estimado: number;
  rango_min: number;
  rango_max: number;
  precio_m2_estimado: number;
  confianza: "alta" | "media" | "baja";
  resumen: string;
  comparables_usados: number;
}

interface AVMComparable {
  fuente: string;
  titulo: string;
  precio: number;
  moneda: string;
  barrio: string;
  ciudad: string;
  superficie_cubierta: number;
  precio_m2: number;
  dormitorios: number | null;
}

interface AVMResult {
  ok: boolean;
  valuacion: AVMValuacion;
  stats: {
    precio_mediana: number;
    precio_promedio: number;
    precio_m2_mediana: number;
    precio_m2_promedio: number;
    rango_min: number;
    rango_max: number;
    total: number;
  };
  comparables: AVMComparable[];
}

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

  // AVM state
  const [avmCiudad, setAvmCiudad] = useState("Rosario");
  const [avmOperacion, setAvmOperacion] = useState("venta");
  const [avmMoneda, setAvmMoneda] = useState("USD");
  const [avmLoading, setAvmLoading] = useState(false);
  const [avmResult, setAvmResult] = useState<AVMResult | null>(null);
  const [avmError, setAvmError] = useState<string | null>(null);

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
    fontSize: 11, color: "#888", fontFamily: "var(--font-display)", fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4, display: "block",
  };
  const sectionStyle: React.CSSProperties = { background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" };

  const valuarConAVM = async () => {
    setAvmLoading(true);
    setAvmError(null);
    setAvmResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setAvmError("No autenticado. Recargá la página."); return; }

      const res = await fetch("/api/crm/avm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tipo_operacion: avmOperacion,
          tipo_inmueble: tipo,
          barrio: zona || undefined,
          ciudad: avmCiudad,
          superficie_cubierta: supCubierta,
          dormitorios: dormitorios || undefined,
          moneda: avmMoneda,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setAvmError(data.error ?? "Error al obtener valuación"); return; }
      setAvmResult(data as AVMResult);
    } catch (e: any) {
      setAvmError(e?.message ?? "Error de conexión");
    } finally {
      setAvmLoading(false);
    }
  };

  const exportPDF = () => {
    if (!tasacion) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Tasación Rápida</title>
      <style>body{font-family:Arial,sans-serif;font-size:13px;max-width:700px;margin:40px auto}h1{color:#990000}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.val{font-size:18px;font-weight:bold;color:#990000}</style>
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
      <div style={{ background: "var(--gfi-bg-secondary)", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "var(--font-display)", fontWeight: 800 }}>🏠 Tasación Rápida</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Estimación de valor basada en comparables de la cartera activa</p>
        </div>
        <button onClick={exportPDF} disabled={!tasacion} style={{
          background: tasacion ? "#990000" : "#333", color: "#fff", border: "none", borderRadius: 8,
          padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: tasacion ? "pointer" : "not-allowed",
          fontFamily: "var(--font-display)",
        }}>📄 Informe PDF</button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Inputs propiedad */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={sectionStyle}>
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 800, color: "#990000", textTransform: "uppercase" }}>Propiedad a tasar</h2>
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
            <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 800, color: "#3b82f6", textTransform: "uppercase" }}>Atributos de ajuste</h2>
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
                    <input type="checkbox" checked={item.val} onChange={e => item.set(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#990000" }} />
                    {item.label}
                  </label>
                ))}
              </div>
              <div>
                <label style={labelStyle}>Ajuste manual (%)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min={-30} max={30} value={ajusteManual} onChange={e => setAjusteManual(+e.target.value)}
                    style={{ flex: 1, accentColor: "#990000" }} />
                  <span style={{ minWidth: 40, textAlign: "right", fontSize: 13, color: ajusteManual > 0 ? "#3abab6" : ajusteManual < 0 ? "#b80000" : "#888" }}>
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
              background: "var(--gfi-bg-secondary)", border: "2px solid #990000", borderRadius: 12, padding: "24px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
              <div style={{ fontSize: 12, color: "#990000", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" }}>
                Valor estimado (basado en {comparables.length} comparable{comparables.length !== 1 ? "s" : ""})
              </div>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#fff", fontFamily: "var(--font-display)" }}>
                {fmtUSD(tasacion.valorEstimado)}
              </div>
              <div style={{ fontSize: 16, color: "#888" }}>
                Rango: <span style={{ color: "#3abab6" }}>{fmtUSD(tasacion.min)}</span> — <span style={{ color: "#d4960c" }}>{fmtUSD(tasacion.max)}</span>
              </div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                {fmtUSD(tasacion.pm2Ajustado)}/m² · Factor ajuste ×{tasacion.factor.toFixed(3)}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Precio/m² promedio comps", val: fmtUSD(tasacion.pm2Ponderado) + "/m²", color: "#3b82f6" },
                { label: "Precio/m² ajustado", val: fmtUSD(tasacion.pm2Ajustado) + "/m²", color: "#990000" },
                { label: "Mediana mercado", val: fmtUSD(tasacion.pm2Mediana) + "/m²", color: "#a78bfa" },
                { label: "Rango comps (mín)", val: fmtUSD(tasacion.pm2Min) + "/m²", color: "#3abab6" },
                { label: "Rango comps (máx)", val: fmtUSD(tasacion.pm2Max) + "/m²", color: "#d4960c" },
              ].map((kpi, i) => (
                <div key={i} style={{ background: "var(--gfi-bg-secondary)", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#888", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
                </div>
              ))}
            </div>

            {/* Comparables */}
            <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #222" }}>
                <h2 style={{ margin: 0, fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                  Comparables ({comparables.length})
                </h2>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                    {["Dirección / Barrio","Tipo","Sup.","Precio/m²","Score similitud"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "#666", fontFamily: "var(--font-display)", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #111", background: i % 2 === 0 ? "var(--gfi-bg-primary)" : "transparent" }}>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontSize: 13, color: "#fff" }}>{c.direccion}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{c.zona ?? "—"}</div>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#888" }}>{c.tipo ?? "—"}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: "#ccc" }}>{c.superficie_cubierta ? `${c.superficie_cubierta} m²` : "—"}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#3abab6" }}>
                        {fmtUSD(c.pm2)}/m²
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ height: 6, width: 80, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${c.score}%`, background: c.score >= 70 ? "#3abab6" : c.score >= 40 ? "#d4960c" : "#888", borderRadius: 3 }} />
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
          <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #333", borderRadius: 10, padding: 32, textAlign: "center", color: "#666" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <p>No hay comparables suficientes en la cartera activa para los filtros seleccionados.</p>
            <p style={{ fontSize: 12 }}>Probá cambiando el tipo de propiedad o dejando la zona en blanco.</p>
          </div>
        )}

        {/* ── AVM Panel ─────────────────────────────────────────────────── */}
        <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #2a1a1a", borderRadius: 12, overflow: "hidden" }}>
          {/* AVM Header */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #222", background: "linear-gradient(135deg,#1a0808,#0a0a0a)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 800, color: "#cc3333", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Valuacion con IA (AVM)
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Comparables de cartera y portales externos · powered by Claude Haiku</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Ciudad</label>
                <input
                  value={avmCiudad}
                  onChange={e => setAvmCiudad(e.target.value)}
                  placeholder="Ej: Rosario"
                  style={{ ...inputStyle, width: 120 }}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Operacion</label>
                <select value={avmOperacion} onChange={e => setAvmOperacion(e.target.value)} style={{ ...inputStyle, width: 110 }}>
                  <option value="venta">Venta</option>
                  <option value="alquiler">Alquiler</option>
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Moneda</label>
                <select value={avmMoneda} onChange={e => setAvmMoneda(e.target.value)} style={{ ...inputStyle, width: 90 }}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <button
                onClick={valuarConAVM}
                disabled={avmLoading || !avmCiudad || !supCubierta}
                style={{
                  background: avmLoading ? "#333" : "linear-gradient(135deg,#990000,#cc2200)",
                  color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px",
                  fontSize: 13, fontWeight: 700, cursor: (avmLoading || !avmCiudad) ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: 8,
                  marginTop: 16, whiteSpace: "nowrap" as const,
                }}
              >
                {avmLoading ? (
                  <>
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #ffffff40", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Valuando...
                  </>
                ) : "Valuar con AVM"}
              </button>
            </div>
          </div>

          {/* AVM Error */}
          {avmError && (
            <div style={{ padding: "12px 24px", background: "#1a0505", color: "#ff6666", fontSize: 13, borderBottom: "1px solid #330000" }}>
              Error: {avmError}
            </div>
          )}

          {/* AVM Result */}
          {avmResult && (
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Precio estimado grande */}
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                background: "#0d0505", border: "2px solid #cc2200", borderRadius: 12, padding: "24px",
              }}>
                <div style={{ fontSize: 11, color: "#cc2200", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Precio Estimado AVM · {avmResult.valuacion.comparables_usados} comparable{avmResult.valuacion.comparables_usados !== 1 ? "s" : ""} usados
                </div>
                <div style={{ fontSize: 44, fontWeight: 800, color: "#fff", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                  {avmMoneda} {avmResult.valuacion.precio_estimado.toLocaleString("es-AR")}
                </div>
                {/* Barra rango min-max */}
                <div style={{ width: "100%", maxWidth: 480, marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", marginBottom: 6 }}>
                    <span style={{ color: "#3abab6" }}>{avmMoneda} {avmResult.valuacion.rango_min.toLocaleString("es-AR")}</span>
                    <span style={{ color: "#d4960c" }}>{avmMoneda} {avmResult.valuacion.rango_max.toLocaleString("es-AR")}</span>
                  </div>
                  <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, position: "relative" as const, overflow: "hidden" }}>
                    {(() => {
                      const total = avmResult.valuacion.rango_max - avmResult.valuacion.rango_min;
                      const pos = total > 0 ? ((avmResult.valuacion.precio_estimado - avmResult.valuacion.rango_min) / total) * 100 : 50;
                      return (
                        <>
                          <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, background: "linear-gradient(90deg,#3abab640,#cc220040,#d4960c40)" }} />
                          <div style={{ position: "absolute", left: `${Math.max(0, Math.min(95, pos))}%`, top: 0, bottom: 0, width: 3, background: "#fff", borderRadius: 2 }} />
                        </>
                      );
                    })()}
                  </div>
                  <div style={{ textAlign: "center", fontSize: 11, color: "#666", marginTop: 4 }}>Rango de valuación</div>
                </div>
                {/* Confianza badge */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
                  background: avmResult.valuacion.confianza === "alta" ? "#0d2a1a" : avmResult.valuacion.confianza === "media" ? "#1a1a0d" : "#1a0d0d",
                  color: avmResult.valuacion.confianza === "alta" ? "#3abab6" : avmResult.valuacion.confianza === "media" ? "#d4960c" : "#cc3333",
                  border: `1px solid ${avmResult.valuacion.confianza === "alta" ? "#3abab640" : avmResult.valuacion.confianza === "media" ? "#d4960c40" : "#cc333340"}`,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                  Confianza {avmResult.valuacion.confianza}
                </div>
              </div>

              {/* KPIs secundarios */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {[
                  { label: "Precio/m² est.", val: `${avmMoneda} ${avmResult.valuacion.precio_m2_estimado.toLocaleString("es-AR")}/m²`, color: "#cc2200" },
                  { label: "Mediana comps", val: `${avmMoneda} ${avmResult.stats.precio_mediana.toLocaleString("es-AR")}`, color: "#a78bfa" },
                  { label: "Precio/m² med.", val: `${avmMoneda} ${avmResult.stats.precio_m2_mediana.toLocaleString("es-AR")}/m²`, color: "#3b82f6" },
                  { label: "Total comps", val: `${avmResult.stats.total}`, color: "#3abab6" },
                ].map((kpi, i) => (
                  <div key={i} style={{ background: "#0d0d0d", border: `1px solid ${kpi.color}30`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "#666", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
                  </div>
                ))}
              </div>

              {/* Resumen IA */}
              <div style={{ background: "#0d0d0d", border: "1px solid #222", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, color: "#666", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Analisis IA</div>
                <p style={{ margin: 0, fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{avmResult.valuacion.resumen}</p>
              </div>

              {/* Comparables AVM */}
              {avmResult.comparables.length > 0 && (
                <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #1a1a1a", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid #1a1a1a", fontSize: 12, color: "#888", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" }}>
                    Comparables usados ({avmResult.comparables.length})
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                        {["Propiedad","Fuente","Barrio / Ciudad","Sup.","Precio","Precio/m²"].map(h => (
                          <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, color: "#555", fontFamily: "var(--font-display)", fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {avmResult.comparables.map((c, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #111", background: i % 2 === 0 ? "#090909" : "transparent" }}>
                          <td style={{ padding: "9px 14px" }}>
                            <div style={{ fontSize: 12, color: "#ddd", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.titulo}</div>
                            {c.dormitorios && <div style={{ fontSize: 10, color: "#555" }}>{c.dormitorios} dorm.</div>}
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span style={{ fontSize: 10, background: c.fuente.includes("GFI") ? "#1a0808" : "#0a0a1a", color: c.fuente.includes("GFI") ? "#cc3333" : "#3b82f6", padding: "2px 7px", borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 700 }}>
                              {c.fuente.includes("GFI") ? "GFI" : "Portal"}
                            </span>
                          </td>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: "#777" }}>{[c.barrio, c.ciudad].filter(Boolean).join(", ") || "—"}</td>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: "#aaa" }}>{c.superficie_cubierta} m²</td>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: "#ccc" }}>{c.moneda} {c.precio.toLocaleString("es-AR")}</td>
                          <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#3abab6" }}>{c.moneda} {c.precio_m2.toLocaleString("es-AR")}/m²</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Empty state before first valuation */}
          {!avmResult && !avmLoading && !avmError && (
            <div style={{ padding: "32px 24px", textAlign: "center", color: "#444" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
              <p style={{ margin: 0, fontSize: 13 }}>Completá los datos de la propiedad arriba y presioná <b style={{ color: "#cc3333" }}>Valuar con AVM</b> para obtener una valuación asistida por IA con comparables del mercado.</p>
            </div>
          )}
        </div>

        {/* Spinner keyframe */}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      </div>
    </div>
  );
}
