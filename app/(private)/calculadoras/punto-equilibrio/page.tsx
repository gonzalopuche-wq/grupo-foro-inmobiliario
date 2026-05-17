"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface Costo {
  id: string;
  label: string;
  monto: number;
  categoria: "personal" | "infraestructura" | "marketing" | "admin" | "tecnologia";
}

interface TipoOp {
  id: string;
  label: string;
  ticketPromUSD: number;
  honPct: number;
  splitInmob: number; // % que queda en la inmobiliaria
  frecuenciaMes: number; // operaciones/mes promedio de este tipo
}

const COSTOS_DEFAULT: Costo[] = [
  { id: "sueldos",    label: "Sueldos / cargas sociales",   monto: 800000,  categoria: "personal" },
  { id: "alquiler",   label: "Alquiler oficina",             monto: 350000,  categoria: "infraestructura" },
  { id: "expensas",   label: "Expensas / servicios",         monto: 80000,   categoria: "infraestructura" },
  { id: "telefono",   label: "Telefonía / internet",         monto: 40000,   categoria: "infraestructura" },
  { id: "portal1",    label: "Portal inmobiliario 1",        monto: 120000,  categoria: "marketing" },
  { id: "portal2",    label: "Portal inmobiliario 2",        monto: 90000,   categoria: "marketing" },
  { id: "rrss",       label: "Redes sociales / ads",         monto: 150000,  categoria: "marketing" },
  { id: "contador",   label: "Contaduría / estudio",         monto: 100000,  categoria: "admin" },
  { id: "seguros",    label: "Seguros varios",               monto: 60000,   categoria: "admin" },
  { id: "crm_sw",     label: "Software CRM / herramientas",  monto: 50000,   categoria: "tecnologia" },
  { id: "otros",      label: "Otros gastos fijos",           monto: 80000,   categoria: "admin" },
];

const TIPOS_DEFAULT: TipoOp[] = [
  { id: "venta",     label: "Ventas",          ticketPromUSD: 120000, honPct: 3.0, splitInmob: 50, frecuenciaMes: 1.5 },
  { id: "alquiler",  label: "Alquileres",       ticketPromUSD: 1200,   honPct: 5.0, splitInmob: 60, frecuenciaMes: 4 },
  { id: "temporal",  label: "Temporarios",      ticketPromUSD: 800,    honPct: 10.0, splitInmob: 70, frecuenciaMes: 3 },
];

const CAT_COLORS: Record<string, string> = {
  personal:       "#cc0000",
  infraestructura:"#3b82f6",
  marketing:      "#f97316",
  admin:          "#a855f7",
  tecnologia:     "#22c55e",
};

const CAT_LABELS: Record<string, string> = {
  personal: "Personal",
  infraestructura: "Infraestructura",
  marketing: "Marketing",
  admin: "Admin",
  tecnologia: "Tecnología",
};

export default function PuntoEquilibrioPage() {
  const [costos, setCostos] = useState<Costo[]>(COSTOS_DEFAULT);
  const [tipos, setTipos] = useState<TipoOp[]>(TIPOS_DEFAULT);
  const [tc, setTc] = useState(1300);
  const [metaGanancia, setMetaGanancia] = useState(500000); // ARS netos por mes

  const updCosto = (id: string, monto: number) =>
    setCostos(prev => prev.map(c => c.id === id ? { ...c, monto } : c));

  const updTipo = (id: string, cambios: Partial<TipoOp>) =>
    setTipos(prev => prev.map(t => t.id === id ? { ...t, ...cambios } : t));

  const calcs = useMemo(() => {
    const costoFijoMensualARS = costos.reduce((s, c) => s + c.monto, 0);
    const costoFijoMensualUSD = costoFijoMensualARS / tc;

    // Ingreso neto por operación de cada tipo (lo que queda en la inmobiliaria)
    const ingresosPorTipo = tipos.map(t => {
      const honBrutoUSD = t.ticketPromUSD * (t.honPct / 100);
      const ingresoNetaInmobUSD = honBrutoUSD * (t.splitInmob / 100);
      const ingresoNetaInmobARS = ingresoNetaInmobUSD * tc;
      return { ...t, honBrutoUSD, ingresoNetaInmobUSD, ingresoNetaInmobARS };
    });

    // Ingreso mensual proyectado con frecuencia actual
    const ingresoMensualProyARS = ingresosPorTipo.reduce((s, t) => s + t.ingresoNetaInmobARS * t.frecuenciaMes, 0);
    const ingresoMensualProyUSD = ingresoMensualProyARS / tc;

    // Break-even: cuántas operaciones de cada tipo para cubrir costos
    // Usamos la mezcla proporcional actual
    const totalFrecuencia = tipos.reduce((s, t) => s + t.frecuenciaMes, 0);
    const ingresoPromPonderadoARS = totalFrecuencia > 0
      ? ingresosPorTipo.reduce((s, t) => s + t.ingresoNetaInmobARS * (t.frecuenciaMes / totalFrecuencia), 0)
      : 0;

    const opsBE = ingresoPromPonderadoARS > 0 ? costoFijoMensualARS / ingresoPromPonderadoARS : 0;
    const opsMeta = ingresoPromPonderadoARS > 0 ? (costoFijoMensualARS + metaGanancia) / ingresoPromPonderadoARS : 0;

    // Ganancia neta con frecuencia actual
    const gananciaNeta = ingresoMensualProyARS - costoFijoMensualARS;
    const margenNeto = ingresoMensualProyARS > 0 ? (gananciaNeta / ingresoMensualProyARS) * 100 : 0;

    // Por categoría de costos
    const porCategoria: Record<string, number> = {};
    costos.forEach(c => {
      porCategoria[c.categoria] = (porCategoria[c.categoria] ?? 0) + c.monto;
    });

    // Proyección 12 meses (asume inflación 3%/mes en costos fijos)
    const proyeccion = Array.from({ length: 12 }, (_, i) => {
      const costoProyARS = costoFijoMensualARS * Math.pow(1.03, i);
      const ingresoProyARS = ingresoMensualProyARS * Math.pow(1.025, i); // 2.5%/mes en ingresos
      return { mes: i + 1, costo: costoProyARS, ingreso: ingresoProyARS, ganancia: ingresoProyARS - costoProyARS };
    });

    return {
      costoFijoMensualARS, costoFijoMensualUSD,
      ingresosPorTipo, ingresoMensualProyARS, ingresoMensualProyUSD,
      opsBE, opsMeta, gananciaNeta, margenNeto, porCategoria, proyeccion,
    };
  }, [costos, tipos, tc, metaGanancia]);

  const maxProyInv = Math.max(...calcs.proyeccion.map(p => p.costo), ...calcs.proyeccion.map(p => p.ingreso), 1);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>⚖️ Punto de Equilibrio — Inmobiliaria</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Cuántas operaciones necesitás cerrar para cubrir costos y alcanzar tu meta</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Costo fijo mensual", value: `ARS ${fmt(Math.round(calcs.costoFijoMensualARS / 1000))}k`, color: "#cc0000" },
            { label: "Ingreso proy. mensual", value: `ARS ${fmt(Math.round(calcs.ingresoMensualProyARS / 1000))}k`, color: "#e5e5e5" },
            { label: "Ops. para break-even", value: calcs.opsBE.toFixed(1), color: calcs.gananciaNeta >= 0 ? "#22c55e" : "#cc0000" },
            { label: "Ops. para meta", value: calcs.opsMeta.toFixed(1), color: "#f97316" },
            { label: "Ganancia neta", value: `ARS ${fmt(Math.round(calcs.gananciaNeta / 1000))}k`, color: calcs.gananciaNeta >= 0 ? "#22c55e" : "#cc0000" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 17, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          {/* Izquierda */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Tipos de operación */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Tipos de operación</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {calcs.ingresosPorTipo.map(t => (
                  <div key={t.id} style={{ background: "#0a0a0a", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#e5e5e5", minWidth: 90 }}>{t.label}</span>
                      <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
                        {[
                          { label: "Ticket prom. USD", key: "ticketPromUSD" as const, step: 1000, min: 0 },
                          { label: "Hon. %", key: "honPct" as const, step: 0.5, min: 0 },
                          { label: "Split inmob. %", key: "splitInmob" as const, step: 5, min: 0 },
                          { label: "Ops/mes", key: "frecuenciaMes" as const, step: 0.5, min: 0 },
                        ].map(f => (
                          <div key={f.key} style={{ display: "flex", flexDirection: "column", minWidth: 90 }}>
                            <label style={{ fontSize: 9, color: "#6b7280", marginBottom: 2 }}>{f.label}</label>
                            <input type="number" value={t[f.key]} step={f.step} min={f.min}
                              onChange={e => updTipo(t.id, { [f.key]: parseFloat(e.target.value) || 0 })}
                              style={{ background: "#111", border: "1px solid #333", borderRadius: 5, color: "#e5e5e5", padding: "4px 7px", fontSize: 12, width: "100%", boxSizing: "border-box" }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#9ca3af" }}>
                      <span>Hon. bruto/op: <strong style={{ color: "#e5e5e5" }}>USD {fmt(Math.round(t.honBrutoUSD))}</strong></span>
                      <span>Ingreso neto/op: <strong style={{ color: "#22c55e" }}>USD {fmt(Math.round(t.ingresoNetaInmobUSD))}</strong></span>
                      <span>Ingreso mensual: <strong style={{ color: "#3b82f6" }}>ARS {fmt(Math.round(t.ingresoNetaInmobARS * t.frecuenciaMes / 1000))}k</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Costos fijos */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Costos fijos mensuales (ARS)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {costos.map(c => {
                  const pct = calcs.costoFijoMensualARS > 0 ? c.monto / calcs.costoFijoMensualARS : 0;
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: CAT_COLORS[c.categoria], display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#9ca3af", flex: 1, minWidth: 180 }}>{c.label}</span>
                      <div style={{ flex: 1, background: "#0a0a0a", borderRadius: 3, height: 5, overflow: "hidden" }}>
                        <div style={{ width: `${pct * 100}%`, height: "100%", background: CAT_COLORS[c.categoria] }} />
                      </div>
                      <input type="number" value={c.monto} step={10000}
                        onChange={e => updCosto(c.id, parseFloat(e.target.value) || 0)}
                        style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 5, color: "#e5e5e5", padding: "3px 7px", fontSize: 12, width: 100, textAlign: "right", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1f2937", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 11, color: "#9ca3af" }}>TOTAL MENSUAL</span>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: "#cc0000" }}>
                  ARS {fmt(Math.round(calcs.costoFijoMensualARS / 1000))}k
                </span>
              </div>
            </div>
          </div>

          {/* Derecha */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Meta + margen */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Meta de ganancia</div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Ganancia neta mensual deseada (ARS)</label>
              <input type="number" value={metaGanancia} step={50000}
                onChange={e => setMetaGanancia(parseFloat(e.target.value) || 0)}
                style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
              <div style={{ background: `${calcs.gananciaNeta >= 0 ? "#22c55e" : "#cc0000"}11`, border: `1px solid ${calcs.gananciaNeta >= 0 ? "#22c55e" : "#cc0000"}33`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>Ganancia neta actual</div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: calcs.gananciaNeta >= 0 ? "#22c55e" : "#cc0000" }}>
                  ARS {fmt(Math.round(calcs.gananciaNeta / 1000))}k
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  Margen neto: <strong style={{ color: calcs.margenNeto >= 20 ? "#22c55e" : calcs.margenNeto >= 0 ? "#f97316" : "#cc0000" }}>{calcs.margenNeto.toFixed(1)}%</strong>
                </div>
              </div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginTop: 10, marginBottom: 3 }}>TC ARS/USD</label>
              <input type="number" value={tc} step={50}
                onChange={e => setTc(parseFloat(e.target.value) || 1)}
                style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
            </div>

            {/* Por categoría */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Costos por categoría</div>
              {Object.entries(calcs.porCategoria).map(([cat, val]) => (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: CAT_COLORS[cat] }}>{CAT_LABELS[cat]}</span>
                    <span style={{ color: "#6b7280" }}>ARS {fmt(Math.round(val / 1000))}k · {calcs.costoFijoMensualARS > 0 ? Math.round(val / calcs.costoFijoMensualARS * 100) : 0}%</span>
                  </div>
                  <div style={{ background: "#0a0a0a", borderRadius: 3, height: 5, overflow: "hidden" }}>
                    <div style={{ width: `${calcs.costoFijoMensualARS > 0 ? (val / calcs.costoFijoMensualARS) * 100 : 0}%`, height: "100%", background: CAT_COLORS[cat] }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Proyección 12m SVG */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Proyección 12 meses</div>
              <svg viewBox="0 0 280 80" style={{ width: "100%", overflow: "visible" }}>
                {/* línea break-even */}
                {calcs.proyeccion.map((p, i) => {
                  const x = 10 + i * (260 / 11);
                  const yC = 75 - (p.costo / maxProyInv) * 65;
                  const yI = 75 - (p.ingreso / maxProyInv) * 65;
                  const nextP = calcs.proyeccion[i + 1];
                  if (!nextP) return null;
                  const xN = 10 + (i + 1) * (260 / 11);
                  const yCN = 75 - (nextP.costo / maxProyInv) * 65;
                  const yIN = 75 - (nextP.ingreso / maxProyInv) * 65;
                  return (
                    <g key={i}>
                      <line x1={x} y1={yC} x2={xN} y2={yCN} stroke="#cc0000" strokeWidth="1.5" />
                      <line x1={x} y1={yI} x2={xN} y2={yIN} stroke="#22c55e" strokeWidth="1.5" />
                    </g>
                  );
                })}
                {calcs.proyeccion.map((p, i) => {
                  const x = 10 + i * (260 / 11);
                  const yC = 75 - (p.costo / maxProyInv) * 65;
                  const yI = 75 - (p.ingreso / maxProyInv) * 65;
                  return (
                    <g key={`pt-${i}`}>
                      <circle cx={x} cy={yC} r="2" fill="#cc0000" />
                      <circle cx={x} cy={yI} r="2" fill="#22c55e" />
                    </g>
                  );
                })}
              </svg>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 10, color: "#6b7280" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 2, background: "#cc0000", display: "inline-block" }} /> Costos</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 2, background: "#22c55e", display: "inline-block" }} /> Ingresos</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#4b5563", textAlign: "center" }}>
                Inflación costos: +3%/mes · Crecimiento ingresos: +2.5%/mes
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
