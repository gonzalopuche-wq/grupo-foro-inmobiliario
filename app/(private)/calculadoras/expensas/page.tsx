"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface Rubro {
  id: string;
  label: string;
  icono: string;
  monto: number;
  categoria: "personal" | "servicios" | "mantenimiento" | "admin";
}

const RUBROS_DEFAULT: Rubro[] = [
  { id: "portero", label: "Portero / encargado", icono: "👷", monto: 250000, categoria: "personal" },
  { id: "limpieza", label: "Limpieza adicional", icono: "🧹", monto: 80000, categoria: "personal" },
  { id: "seguridad", label: "Servicio de seguridad", icono: "🔒", monto: 150000, categoria: "personal" },
  { id: "luz_comun", label: "Electricidad partes comunes", icono: "💡", monto: 60000, categoria: "servicios" },
  { id: "agua", label: "Agua / AySA", icono: "💧", monto: 45000, categoria: "servicios" },
  { id: "gas", label: "Gas central", icono: "🔥", monto: 35000, categoria: "servicios" },
  { id: "ascensor", label: "Mantenimiento ascensor", icono: "🛗", monto: 90000, categoria: "mantenimiento" },
  { id: "jardines", label: "Jardines / áreas verdes", icono: "🌿", monto: 40000, categoria: "mantenimiento" },
  { id: "pileta", label: "Pileta / SPA", icono: "🏊", monto: 70000, categoria: "mantenimiento" },
  { id: "gimnasio", label: "Equipamiento gimnasio", icono: "🏋️", monto: 25000, categoria: "mantenimiento" },
  { id: "seguros", label: "Seguros del edificio", icono: "🛡️", monto: 55000, categoria: "admin" },
  { id: "administracion", label: "Honorarios administración", icono: "📋", monto: 85000, categoria: "admin" },
  { id: "fondo_reserva", label: "Fondo de reserva", icono: "🏦", monto: 100000, categoria: "admin" },
];

const CAT_COLORS: Record<string, string> = {
  personal: "#cc0000",
  servicios: "#3b82f6",
  mantenimiento: "#22c55e",
  admin: "#a855f7",
};

const CAT_LABELS: Record<string, string> = {
  personal: "Personal",
  servicios: "Servicios",
  mantenimiento: "Mantenimiento",
  admin: "Admin.",
};

export default function ExpensasPage() {
  const [rubros, setRubros] = useState<Rubro[]>(RUBROS_DEFAULT);
  const [unidades, setUnidades] = useState(24);
  const [m2Total, setM2Total] = useState(1800); // m² totales privativos
  const [m2Unidad, setM2Unidad] = useState(75); // m² unidad de referencia
  const [inflacionAnual, setInflacionAnual] = useState(50); // % proyección
  const [tc, setTc] = useState(1300);

  const updRubro = (id: string, monto: number) => {
    setRubros(prev => prev.map(r => r.id === id ? { ...r, monto } : r));
  };

  const calcs = useMemo(() => {
    const total = rubros.reduce((s, r) => s + r.monto, 0);
    const porUnidad = unidades > 0 ? total / unidades : 0;
    const porM2 = m2Total > 0 ? total / m2Total : 0;
    const expUnidadRef = porM2 * m2Unidad;
    const totalUSD = tc > 0 ? total / tc : 0;
    const porUnidadUSD = tc > 0 ? porUnidad / tc : 0;

    const porCategoria: Record<string, number> = {};
    rubros.forEach(r => {
      porCategoria[r.categoria] = (porCategoria[r.categoria] ?? 0) + r.monto;
    });

    // Proyección 3 años
    const proyeccion = [0, 1, 2, 3].map(y => ({
      ano: y,
      total: total * Math.pow(1 + inflacionAnual / 100, y),
      porUnidad: porUnidad * Math.pow(1 + inflacionAnual / 100, y),
    }));

    return { total, porUnidad, porM2, expUnidadRef, totalUSD, porUnidadUSD, porCategoria, proyeccion };
  }, [rubros, unidades, m2Total, m2Unidad, inflacionAnual, tc]);

  const maxCat = Math.max(...Object.values(calcs.porCategoria));

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>🏢 Calculadora de Expensas</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Desglose, proyección y análisis de expensas por unidad</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total edificio/mes", value: `ARS ${fmt(Math.round(calcs.total / 1000))}k`, color: "#e5e5e5" },
            { label: "Por unidad prom.", value: `ARS ${fmt(Math.round(calcs.porUnidad / 1000))}k`, color: "#f97316" },
            { label: `Unidad ${m2Unidad}m²`, value: `ARS ${fmt(Math.round(calcs.expUnidadRef / 1000))}k`, color: "#22c55e" },
            { label: "Por m²/mes", value: `ARS ${fmt(Math.round(calcs.porM2))}`, color: "#9ca3af" },
            { label: "Total en USD", value: `USD ${fmt(Math.round(calcs.totalUSD))}`, color: "#3b82f6" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 17, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* Config */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Edificio</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Unidades totales", value: unidades, set: setUnidades },
                  { label: "m² privativos totales", value: m2Total, set: setM2Total, step: 100 },
                  { label: "m² unidad de referencia", value: m2Unidad, set: setM2Unidad, step: 5 },
                  { label: "Inflación anual proyectada (%)", value: inflacionAnual, set: setInflacionAnual },
                  { label: "TC ARS/USD", value: tc, set: setTc, step: 50 },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 2 }}>{f.label}</label>
                    <input type="number" value={f.value} step={f.step ?? 1}
                      onChange={e => f.set(parseFloat(e.target.value)||0)}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Por categoría */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>Por categoría</div>
              {Object.entries(calcs.porCategoria).map(([cat, val]) => (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: CAT_COLORS[cat] }}>{CAT_LABELS[cat]}</span>
                    <span style={{ color: "#9ca3af" }}>ARS {fmt(Math.round(val / 1000))}k ({calcs.total > 0 ? Math.round(val / calcs.total * 100) : 0}%)</span>
                  </div>
                  <div style={{ background: "#0a0a0a", borderRadius: 3, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${maxCat > 0 ? (val / maxCat) * 100 : 0}%`, height: "100%", background: CAT_COLORS[cat] }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Proyección */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 10, textTransform: "uppercase" }}>Proyección ({inflacionAnual}%/año)</div>
              {calcs.proyeccion.map(p => (
                <div key={p.ano} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #111", fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>{p.ano === 0 ? "Hoy" : `Año ${p.ano}`}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: p.ano === 0 ? "#22c55e" : "#f97316" }}>
                      ARS {fmt(Math.round(p.porUnidad / 1000))}k/u
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rubros */}
          <div>
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>Rubros del presupuesto mensual</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rubros.map(r => {
                  const pct = calcs.total > 0 ? (r.monto / calcs.total) * 100 : 0;
                  return (
                    <div key={r.id} style={{ background: "#0a0a0a", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>{r.icono}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: "#e5e5e5", fontWeight: 500 }}>{r.label}</div>
                          <div style={{ fontSize: 10, color: CAT_COLORS[r.categoria] }}>{CAT_LABELS[r.categoria]}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <input type="number" value={r.monto} step={5000}
                            onChange={e => updRubro(r.id, parseFloat(e.target.value)||0)}
                            style={{ background: "#111", border: "1px solid #333", borderRadius: 4, color: "#e5e5e5", padding: "3px 8px", fontSize: 13, width: 110, textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }} />
                          <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>{pct.toFixed(1)}% del total</div>
                        </div>
                      </div>
                      <div style={{ background: "#1a1a1a", borderRadius: 3, height: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: CAT_COLORS[r.categoria], transition: "width 0.3s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1f2937", display: "flex", justifyContent: "space-between", fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
                <span style={{ color: "#e5e5e5" }}>TOTAL MENSUAL</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#f97316", fontSize: 20 }}>ARS {fmt(Math.round(calcs.total / 1000))}k</div>
                  <div style={{ color: "#3b82f6", fontSize: 13 }}>USD {fmt(Math.round(calcs.totalUSD))}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
