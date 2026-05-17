"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Tasas base anuales sobre suma asegurada ──────────────────────────────────
// Fuente: rangos aproximados mercado argentino (Federación Patronal, Mapfre, etc.)
const TASA_INCENDIO_BASE = 0.0018; // 0.18‰ anual sobre valor de reconstrucción
const TASA_RC_BASE = 0.0004;       // 0.04‰ sobre valor prop para RC
const TASA_ROBO_BASE = 0.003;      // 0.30% sobre contenido asegurado

const TIPO_USO: Record<string, { label: string; factorIncendio: number; factorRC: number }> = {
  vivienda_propia:   { label: "Vivienda propia",        factorIncendio: 1.00, factorRC: 1.00 },
  alquiler:          { label: "Inmueble en alquiler",   factorIncendio: 1.15, factorRC: 1.25 },
  oficina:           { label: "Oficina / comercio",     factorIncendio: 1.20, factorRC: 1.30 },
  alquiler_temporal: { label: "Alquiler temporario",    factorIncendio: 1.30, factorRC: 1.50 },
  deposito:          { label: "Depósito / galpón",      factorIncendio: 1.40, factorRC: 1.10 },
};

const CONSTRUCCION: Record<string, { label: string; factor: number; costoM2: number }> = {
  hormigon:   { label: "Hormigón / ladrillo",  factor: 0.90, costoM2: 850 },
  mamposteria:{ label: "Mampostería mixta",     factor: 1.00, costoM2: 950 },
  madera:     { label: "Madera / durlock",      factor: 1.40, costoM2: 1100 },
  metalica:   { label: "Estructura metálica",   factor: 1.20, costoM2: 1050 },
  prefabricada:{ label: "Prefabricada",         factor: 1.50, costoM2: 700 },
};

const ANTIGUEDAD: Record<string, { label: string; factor: number }> = {
  nueva:    { label: "0–5 años",    factor: 0.90 },
  reciente: { label: "6–15 años",   factor: 1.00 },
  media:    { label: "16–30 años",  factor: 1.10 },
  vieja:    { label: "31–50 años",  factor: 1.20 },
  muy_vieja:{ label: ">50 años",    factor: 1.35 },
};

const ZONA_RIESGO: Record<string, { label: string; factor: number }> = {
  bajo:   { label: "Bajo (zona segura)",  factor: 0.90 },
  normal: { label: "Normal",             factor: 1.00 },
  alto:   { label: "Alto (zona inundable / lindero)", factor: 1.25 },
  muy_alto:{ label: "Muy alto (zona de riesgo)", factor: 1.50 },
};

const COBERTURAS_ADICIONALES = [
  { id: "granizo",        label: "Granizo",                  tasaExtra: 0.0004 },
  { id: "inundacion",     label: "Inundación / anegamiento",  tasaExtra: 0.0008 },
  { id: "cristales",      label: "Rotura de cristales",       tasaExtra: 0.0002 },
  { id: "caños",          label: "Daños por caños / filtr.",  tasaExtra: 0.0003 },
  { id: "electrodomest",  label: "Electrónicos / equipos",   tasaExtra: 0.0005 },
  { id: "lucro_cesante",  label: "Lucro cesante (alquileres)",tasaExtra: 0.0006 },
];

type TipoUso = keyof typeof TIPO_USO;
type Construccion = keyof typeof CONSTRUCCION;
type Antiguedad = keyof typeof ANTIGUEDAD;
type ZonaRiesgo = keyof typeof ZONA_RIESGO;

export default function SeguroHogarPage() {
  const [m2, setM2] = useState(80);
  const [tipoUso, setTipoUso] = useState<TipoUso>("vivienda_propia");
  const [construccion, setConstruccion] = useState<Construccion>("mamposteria");
  const [antiguedad, setAntiguedad] = useState<Antiguedad>("reciente");
  const [zonaRiesgo, setZonaRiesgo] = useState<ZonaRiesgo>("normal");
  const [valorContenido, setValorContenido] = useState(2000000);
  const [sumaRC, setSumaRC] = useState(5000000);
  const [cobAdic, setCobAdic] = useState<string[]>([]);
  const [incluirRC, setIncluirRC] = useState(true);
  const [incluirRobo, setIncluirRobo] = useState(true);
  const [tc, setTc] = useState(1300);

  const toggleCob = (id: string) =>
    setCobAdic(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const calcs = useMemo(() => {
    const cM2 = CONSTRUCCION[construccion].costoM2;
    const valorReconstruccion = m2 * cM2 * 1000; // en ARS (costoM2 en miles)

    const factorBase = CONSTRUCCION[construccion].factor
      * ANTIGUEDAD[antiguedad].factor
      * ZONA_RIESGO[zonaRiesgo].factor;

    // Prima incendio
    const tasaIncendio = TASA_INCENDIO_BASE * factorBase * TIPO_USO[tipoUso].factorIncendio;
    const primaIncendioAnual = valorReconstruccion * tasaIncendio;

    // RC
    const primaRCAnual = incluirRC
      ? sumaRC * TASA_RC_BASE * factorBase * TIPO_USO[tipoUso].factorRC
      : 0;

    // Robo / contenido
    const primaRoboAnual = incluirRobo ? valorContenido * TASA_ROBO_BASE * factorBase : 0;

    // Coberturas adicionales
    const primaAdicAnual = cobAdic.reduce((s, id) => {
      const cob = COBERTURAS_ADICIONALES.find(c => c.id === id);
      return s + (cob ? valorReconstruccion * cob.tasaExtra * factorBase : 0);
    }, 0);

    const totalAnual = primaIncendioAnual + primaRCAnual + primaRoboAnual + primaAdicAnual;
    const totalMensual = totalAnual / 12;
    const totalUSD = totalAnual / tc;

    // Desglose
    const desglose = [
      { label: "Incendio / daños estructurales", monto: primaIncendioAnual, pct: totalAnual > 0 ? primaIncendioAnual / totalAnual : 0, color: "#cc0000" },
      ...(incluirRC ? [{ label: "Responsabilidad civil", monto: primaRCAnual, pct: totalAnual > 0 ? primaRCAnual / totalAnual : 0, color: "#3b82f6" }] : []),
      ...(incluirRobo ? [{ label: "Robo / contenido", monto: primaRoboAnual, pct: totalAnual > 0 ? primaRoboAnual / totalAnual : 0, color: "#f97316" }] : []),
      ...cobAdic.map(id => {
        const cob = COBERTURAS_ADICIONALES.find(c => c.id === id)!;
        const monto = valorReconstruccion * cob.tasaExtra * factorBase;
        return { label: cob.label, monto, pct: totalAnual > 0 ? monto / totalAnual : 0, color: "#a855f7" };
      }),
    ];

    const tasaEfectiva = valorReconstruccion > 0 ? (totalAnual / valorReconstruccion) * 100 : 0;

    return {
      valorReconstruccion, tasaIncendio, primaIncendioAnual, primaRCAnual, primaRoboAnual,
      primaAdicAnual, totalAnual, totalMensual, totalUSD, desglose, tasaEfectiva,
    };
  }, [m2, tipoUso, construccion, antiguedad, zonaRiesgo, valorContenido, sumaRC, cobAdic, incluirRC, incluirRobo, tc]);

  const secciones: { key: string; label: string; options: Record<string, { label: string }> }[] = [
    { key: "tipoUso", label: "Uso del inmueble", options: TIPO_USO },
    { key: "construccion", label: "Tipo de construcción", options: CONSTRUCCION },
    { key: "antiguedad", label: "Antigüedad", options: ANTIGUEDAD },
    { key: "zonaRiesgo", label: "Zona de riesgo", options: ZONA_RIESGO },
  ];

  const vals: Record<string, string> = { tipoUso, construccion, antiguedad, zonaRiesgo };
  const setters: Record<string, (v: string) => void> = {
    tipoUso: v => setTipoUso(v as TipoUso),
    construccion: v => setConstruccion(v as Construccion),
    antiguedad: v => setAntiguedad(v as Antiguedad),
    zonaRiesgo: v => setZonaRiesgo(v as ZonaRiesgo),
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>🛡️ Calculadora de Seguro de Hogar</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Estimación de prima anual por incendio, RC, robo y coberturas adicionales</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Prima mensual", value: `ARS ${fmt(Math.round(calcs.totalMensual / 1000))}k`, color: "#cc0000" },
            { label: "Prima anual", value: `ARS ${fmt(Math.round(calcs.totalAnual / 1000))}k`, color: "#f97316" },
            { label: "Prima en USD/año", value: `USD ${fmt(Math.round(calcs.totalUSD))}`, color: "#3b82f6" },
            { label: "Valor reconstrucción", value: `ARS ${fmt(Math.round(calcs.valorReconstruccion / 1000000), 1)}M`, color: "#e5e5e5" },
            { label: "Tasa efectiva", value: `${calcs.tasaEfectiva.toFixed(3)}%`, color: "#22c55e" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 17, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
          {/* Izquierda: config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Datos del inmueble */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Datos del inmueble</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "Superficie (m²)", value: m2, set: (v: number) => setM2(v), step: 5 },
                  { label: "Valor contenido (ARS)", value: valorContenido, set: (v: number) => setValorContenido(v), step: 100000 },
                  { label: "Suma RC (ARS)", value: sumaRC, set: (v: number) => setSumaRC(v), step: 500000 },
                  { label: "TC ARS/USD", value: tc, set: (v: number) => setTc(v), step: 50 },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>{f.label}</label>
                    <input type="number" value={f.value} step={f.step}
                      onChange={e => f.set(parseFloat(e.target.value) || 0)}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Selectores */}
            {secciones.map(sec => (
              <div key={sec.key} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{sec.label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(sec.options).map(([key, opt]) => (
                    <button key={key} onClick={() => setters[sec.key](key)}
                      style={{ background: vals[sec.key] === key ? "#1f2937" : "transparent", border: `1px solid ${vals[sec.key] === key ? "#374151" : "#222"}`, borderRadius: 6, color: vals[sec.key] === key ? "#e5e5e5" : "#6b7280", padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Coberturas opcionales */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Coberturas incluidas</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {[
                  { id: "rc", label: "Responsabilidad Civil", active: incluirRC, toggle: () => setIncluirRC(v => !v) },
                  { id: "robo", label: "Robo / Contenido", active: incluirRobo, toggle: () => setIncluirRobo(v => !v) },
                ].map(c => (
                  <button key={c.id} onClick={c.toggle}
                    style={{ background: c.active ? "rgba(34,197,94,0.12)" : "transparent", border: `1px solid ${c.active ? "rgba(34,197,94,0.4)" : "#222"}`, borderRadius: 6, color: c.active ? "#22c55e" : "#6b7280", padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    {c.active ? "✓ " : ""}{c.label}
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Adicionales:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {COBERTURAS_ADICIONALES.map(c => {
                  const active = cobAdic.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggleCob(c.id)}
                      style={{ background: active ? "rgba(168,85,247,0.12)" : "transparent", border: `1px solid ${active ? "rgba(168,85,247,0.4)" : "#222"}`, borderRadius: 6, color: active ? "#a855f7" : "#6b7280", padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      {active ? "✓ " : ""}{c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Derecha: desglose */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Desglose visual */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Desglose de prima anual</div>
              {calcs.desglose.map(d => (
                <div key={d.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: d.color }}>{d.label}</span>
                    <span style={{ color: "#9ca3af" }}>ARS {fmt(Math.round(d.monto / 1000))}k ({Math.round(d.pct * 100)}%)</span>
                  </div>
                  <div style={{ background: "#0a0a0a", borderRadius: 3, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${d.pct * 100}%`, height: "100%", background: d.color, transition: "width 0.3s" }} />
                  </div>
                </div>
              ))}
              <div style={{ paddingTop: 12, borderTop: "1px solid #1f2937", marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
                  <span style={{ color: "#e5e5e5" }}>TOTAL ANUAL</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#cc0000", fontSize: 20 }}>ARS {fmt(Math.round(calcs.totalAnual / 1000))}k</div>
                    <div style={{ color: "#3b82f6", fontSize: 12 }}>USD {fmt(Math.round(calcs.totalUSD))}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de factores */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Factores de riesgo aplicados</div>
              {[
                { label: "Construcción", value: CONSTRUCCION[construccion].label, factor: CONSTRUCCION[construccion].factor },
                { label: "Antigüedad", value: ANTIGUEDAD[antiguedad].label, factor: ANTIGUEDAD[antiguedad].factor },
                { label: "Zona de riesgo", value: ZONA_RIESGO[zonaRiesgo].label, factor: ZONA_RIESGO[zonaRiesgo].factor },
                { label: "Uso del inmueble", value: TIPO_USO[tipoUso].label, factor: TIPO_USO[tipoUso].factorIncendio },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a1a1a", fontSize: 12 }}>
                  <div>
                    <div style={{ color: "#6b7280" }}>{f.label}</div>
                    <div style={{ color: "#9ca3af", fontSize: 11 }}>{f.value}</div>
                  </div>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: f.factor > 1 ? "#f97316" : f.factor < 1 ? "#22c55e" : "#9ca3af", fontSize: 14 }}>
                    ×{f.factor.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Nota legal */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 14px", fontSize: 11, color: "#4b5563" }}>
              <strong style={{ color: "#6b7280" }}>📌 Estimación orientativa.</strong> Los valores reales varían según aseguradora, condiciones de la póliza y suma asegurada acordada. Consultá con tu productor de seguros para una cotización oficial.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
