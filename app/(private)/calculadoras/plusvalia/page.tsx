"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface Factor {
  id: string;
  label: string;
  descripcion: string;
  icono: string;
  impacto: number; // % de plusvalía adicional (editable)
  activo: boolean;
}

interface Mejora {
  id: string;
  label: string;
  costoUSD: number;
  plusvaliaPct: number;
  activa: boolean;
}

const FACTORES_DEFAULT: Factor[] = [
  { id: "metro", label: "Nueva línea de subte/tren", descripcion: "Estación a menos de 500m", icono: "🚇", impacto: 15, activo: false },
  { id: "shopping", label: "Shopping / centro comercial", descripcion: "A menos de 1km", icono: "🏬", impacto: 8, activo: false },
  { id: "universidad", label: "Universidad / polo educativo", descripcion: "Campus en la zona", icono: "🎓", impacto: 6, activo: false },
  { id: "parque", label: "Parque / espacio verde grande", descripcion: "+2ha a menos de 300m", icono: "🌳", impacto: 5, activo: false },
  { id: "hospital", label: "Hospital / clínica de referencia", descripcion: "Infraestructura de salud nueva", icono: "🏥", impacto: 4, activo: false },
  { id: "autopista", label: "Acceso a autopista/ruta", descripcion: "Nuevo acceso vial rápido", icono: "🛣️", impacto: 7, activo: false },
  { id: "amenities", label: "Edificio con amenities completos", descripcion: "SUM, gym, pileta, coworking", icono: "🏊", impacto: 10, activo: false },
  { id: "zona_premium", label: "Corredor premium / gentrificación", descripcion: "Revalorización de la zona", icono: "⭐", impacto: 12, activo: false },
  { id: "seguridad", label: "Barrio privado / seguridad", descripcion: "Cerco, guardia 24h", icono: "🔒", impacto: 9, activo: false },
  { id: "mar_lago", label: "Vista al mar / lago / río", descripcion: "Frente o vista directa", icono: "🌊", impacto: 20, activo: false },
  { id: "coworking_zona", label: "Hub tecnológico / coworking zona", descripcion: "Polo de innovación cercano", icono: "💻", impacto: 6, activo: false },
  { id: "gastronomia", label: "Polo gastronómico / nightlife", descripcion: "Zona con vida urbana activa", icono: "🍽️", impacto: 5, activo: false },
];

const MEJORAS_DEFAULT: Mejora[] = [
  { id: "cocina", label: "Remodelación cocina completa", costoUSD: 8000, plusvaliaPct: 12, activa: false },
  { id: "bano", label: "Baño principal premium", costoUSD: 4000, plusvaliaPct: 7, activa: false },
  { id: "pisos", label: "Cambio de pisos (toda la unidad)", costoUSD: 5000, plusvaliaPct: 6, activa: false },
  { id: "fachada", label: "Reciclaje de fachada", costoUSD: 6000, plusvaliaPct: 8, activa: false },
  { id: "pintura", label: "Pintura y terminaciones", costoUSD: 1500, plusvaliaPct: 3, activa: false },
  { id: "cochera", label: "Cochera / garaje", costoUSD: 15000, plusvaliaPct: 10, activa: false },
  { id: "terraza", label: "Terraza/balcón acondicionado", costoUSD: 5000, plusvaliaPct: 8, activa: false },
  { id: "domotica", label: "Domótica / smart home", costoUSD: 3000, plusvaliaPct: 4, activa: false },
  { id: "expansion", label: "Expansión / ampliación m²", costoUSD: 20000, plusvaliaPct: 20, activa: false },
  { id: "hvac", label: "Climatización central", costoUSD: 4000, plusvaliaPct: 5, activa: false },
];

const APRECIACION_ZONA: Record<string, { pct: number; descripcion: string; color: string }> = {
  "Negativa (crisis / deterioro)": { pct: -3, descripcion: "Zona en decadencia, alta inseguridad o abandono", color: "#cc0000" },
  "Estancada (0-1% anual)": { pct: 0.5, descripcion: "Sin crecimiento notable, demanda plana", color: "#6b7280" },
  "Normal (2-4% anual)": { pct: 3, descripcion: "Apreciación moderada, zona consolidada", color: "#f97316" },
  "Buena (5-8% anual)": { pct: 6, descripcion: "Zona en crecimiento, demanda sostenida", color: "#eab308" },
  "Muy buena (8-12% anual)": { pct: 10, descripcion: "Corredor premium, revalorización acelerada", color: "#22c55e" },
  "Excepcional (+12% anual)": { pct: 14, descripcion: "Zona emergente o proyectos ancla muy significativos", color: "#a855f7" },
};

export default function PlusvaliaPage() {
  const [valorActual, setValorActual] = useState(150000);
  const [m2, setM2] = useState(60);
  const [horizonte, setHorizonte] = useState(5);
  const [aprecZona, setAprecZona] = useState("Normal (2-4% anual)");
  const [factores, setFactores] = useState<Factor[]>(FACTORES_DEFAULT);
  const [mejoras, setMejoras] = useState<Mejora[]>(MEJORAS_DEFAULT);

  const toggleFactor = (id: string) => setFactores(prev => prev.map(f => f.id === id ? { ...f, activo: !f.activo } : f));
  const updFactorImpacto = (id: string, v: number) => setFactores(prev => prev.map(f => f.id === id ? { ...f, impacto: v } : f));
  const toggleMejora = (id: string) => setMejoras(prev => prev.map(m => m.id === id ? { ...m, activa: !m.activa } : m));

  const calcs = useMemo(() => {
    const aprecAnual = APRECIACION_ZONA[aprecZona]?.pct ?? 3;
    const factoresActivos = factores.filter(f => f.activo);
    const plusvaliaFactores = factoresActivos.reduce((s, f) => s + f.impacto, 0);
    const mejorasActivas = mejoras.filter(m => m.activa);
    const costoMejoras = mejorasActivas.reduce((s, m) => s + m.costoUSD, 0);
    const plusvaliaMejoras = mejorasActivas.reduce((s, m) => s + m.plusvaliaPct, 0);
    const plusvaliaTotal = plusvaliaFactores + plusvaliaMejoras;
    const valorConPlusv = valorActual * (1 + plusvaliaTotal / 100);
    const valorM2Actual = m2 > 0 ? valorActual / m2 : 0;
    const valorM2Post = m2 > 0 ? valorConPlusv / m2 : 0;

    // Proyección por año
    const proyeccion = Array.from({ length: horizonte + 1 }, (_, y) => {
      const valBase = valorActual * Math.pow(1 + aprecAnual / 100, y);
      const valConPlusv = valorConPlusv * Math.pow(1 + aprecAnual / 100, y);
      return { ano: y, sinPlusv: valBase, conPlusv: valConPlusv };
    });

    const valFinalSin = proyeccion[horizonte].sinPlusv;
    const valFinalCon = proyeccion[horizonte].conPlusv;
    const gananciaExtra = valFinalCon - valFinalSin;
    const roi_mejoras = costoMejoras > 0 ? ((gananciaExtra - costoMejoras) / costoMejoras) * 100 : 0;

    return { aprecAnual, plusvaliaFactores, plusvaliaMejoras, plusvaliaTotal, valorConPlusv, valorM2Actual, valorM2Post, proyeccion, valFinalSin, valFinalCon, costoMejoras, gananciaExtra, roi_mejoras, factoresActivos, mejorasActivas };
  }, [factores, mejoras, valorActual, m2, horizonte, aprecZona]);

  const maxProyVal = Math.max(...calcs.proyeccion.map(p => p.conPlusv));

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>📈 Análisis de Plusvalía</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Factores de revalorización y impacto de mejoras en el valor de la propiedad</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Plusvalía total", value: `+${calcs.plusvaliaTotal.toFixed(1)}%`, color: calcs.plusvaliaTotal > 20 ? "#22c55e" : calcs.plusvaliaTotal > 10 ? "#f97316" : "#9ca3af" },
            { label: "Valor post-plusvalía", value: `USD ${fmt(Math.round(calcs.valorConPlusv))}`, color: "#22c55e" },
            { label: `Valor año ${horizonte}`, value: `USD ${fmt(Math.round(calcs.valFinalCon))}`, color: "#a855f7" },
            { label: "Ganancia extra vs sin plusvalía", value: `USD ${fmt(Math.round(calcs.gananciaExtra))}`, color: "#eab308" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 20, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
          {/* Inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Propiedad base</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Valor actual (USD)", value: valorActual, set: setValorActual, step: 5000 },
                  { label: "Superficie (m²)", value: m2, set: setM2, step: 5 },
                  { label: "Horizonte (años)", value: horizonte, set: setHorizonte, step: 1 },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>{f.label}</label>
                    <input type="number" value={f.value} step={f.step} onChange={e => f.set(parseFloat(e.target.value)||1)}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>Apreciación de zona</label>
                  <select value={aprecZona} onChange={e => setAprecZona(e.target.value)}
                    style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 12, width: "100%", boxSizing: "border-box" }}>
                    {Object.keys(APRECIACION_ZONA).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div style={{ padding: "8px 10px", background: "#0a0a0a", borderRadius: 6, fontSize: 11, color: "#6b7280" }}>
                  USD/m² actual: <strong style={{ color: "#fff" }}>{fmt(Math.round(calcs.valorM2Actual))}</strong> → post: <strong style={{ color: "#22c55e" }}>{fmt(Math.round(calcs.valorM2Post))}</strong>
                </div>
              </div>
            </div>

            {/* Resumen activos */}
            {calcs.factoresActivos.length > 0 || calcs.mejorasActivas.length > 0 ? (
              <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Impacto seleccionado</div>
                {calcs.factoresActivos.length > 0 && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                    Factores de zona: <span style={{ color: "#22c55e", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>+{calcs.plusvaliaFactores.toFixed(0)}%</span>
                  </div>
                )}
                {calcs.mejorasActivas.length > 0 && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                    Mejoras: <span style={{ color: "#22c55e", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>+{calcs.plusvaliaMejoras.toFixed(0)}%</span>
                    {" — "}Costo: <span style={{ color: "#cc0000" }}>USD {fmt(calcs.costoMejoras)}</span>
                  </div>
                )}
                {calcs.costoMejoras > 0 && (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    ROI de mejoras: <span style={{ color: calcs.roi_mejoras > 0 ? "#22c55e" : "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{calcs.roi_mejoras.toFixed(0)}%</span>
                    {" a "}USD {fmt(Math.round(calcs.gananciaExtra))} de ganancia extra
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Panel derecho */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Factores de zona */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Factores de plusvalía de zona</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {factores.map(f => (
                  <div key={f.id}
                    onClick={() => toggleFactor(f.id)}
                    style={{ background: f.activo ? "#1a1a1a" : "#0a0a0a", border: `1px solid ${f.activo ? "#22c55e44" : "#1f2937"}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 18 }}>{f.icono}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: f.activo ? 700 : 400, color: f.activo ? "#fff" : "#9ca3af" }}>{f.label}</div>
                      <div style={{ fontSize: 10, color: "#4b5563", marginTop: 1 }}>{f.descripcion}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {f.activo ? (
                        <input type="number" value={f.impacto} step={1}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); updFactorImpacto(f.id, parseFloat(e.target.value)||0); }}
                          style={{ background: "#0a0a0a", border: "1px solid #22c55e44", borderRadius: 4, color: "#22c55e", padding: "2px 4px", fontSize: 12, width: 46, textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }} />
                      ) : (
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#4b5563" }}>+{f.impacto}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mejoras edilicias */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Mejoras y reformas</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {mejoras.map(m => (
                  <div key={m.id}
                    onClick={() => toggleMejora(m.id)}
                    style={{ background: m.activa ? "#1a1a1a" : "#0a0a0a", border: `1px solid ${m.activa ? "#a855f744" : "#1f2937"}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: 12, fontWeight: m.activa ? 700 : 400, color: m.activa ? "#fff" : "#9ca3af", flex: 1 }}>{m.label}</div>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: m.activa ? "#22c55e" : "#4b5563" }}>+{m.plusvaliaPct}%</span>
                    </div>
                    <div style={{ fontSize: 10, color: m.activa ? "#a855f7" : "#4b5563", marginTop: 4 }}>Costo: USD {fmt(m.costoUSD)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico proyección */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Proyección de valor</div>
              <svg width="100%" height={140} viewBox={`0 0 ${horizonte * 60 + 40} 140`} preserveAspectRatio="none">
                <polyline
                  points={calcs.proyeccion.map((p, i) => `${i * 60 + 20},${120 - ((p.sinPlusv - valorActual * 0.9) / (maxProyVal - valorActual * 0.9 + 1)) * 100}`).join(" ")}
                  fill="none" stroke="#374151" strokeWidth={1.5} strokeDasharray="4 2" />
                <polyline
                  points={calcs.proyeccion.map((p, i) => `${i * 60 + 20},${120 - ((p.conPlusv - valorActual * 0.9) / (maxProyVal - valorActual * 0.9 + 1)) * 100}`).join(" ")}
                  fill="none" stroke="#22c55e" strokeWidth={2} />
                {calcs.proyeccion.map((p, i) => (
                  <g key={i}>
                    <text x={i * 60 + 20} y={134} textAnchor="middle" fill="#6b7280" fontSize={9} fontFamily="Montserrat">Año {p.ano}</text>
                    <text x={i * 60 + 20} y={115 - ((p.conPlusv - valorActual * 0.9) / (maxProyVal - valorActual * 0.9 + 1)) * 100}
                      textAnchor="middle" fill="#22c55e" fontSize={7} fontFamily="Montserrat">
                      {fmt(Math.round(p.conPlusv / 1000))}k
                    </text>
                  </g>
                ))}
              </svg>
              <div style={{ display: "flex", gap: 16, fontSize: 11, marginTop: 4 }}>
                <span style={{ color: "#374151" }}>-- Sin plusvalía</span>
                <span style={{ color: "#22c55e" }}>— Con plusvalía</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
