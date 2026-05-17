"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PropCartera {
  id: string;
  barrio: string | null;
  tipo: string | null;
  operacion: string | null;
  precio: number | null;
  moneda: string | null;
  superficie_cubierta: number | null;
  ambientes: number | null;
  estado: string | null;
}

interface ZonaStats {
  barrio: string;
  count: number;
  pm2Promedio: number;
  pm2Min: number;
  pm2Max: number;
  pm2Mediana: number;
  precioPromedio: number;
  supPromedio: number;
  tipoMasFrecuente: string;
  distribTipo: Record<string, number>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function precioM2USD(p: PropCartera, tc: number): number | null {
  if (!p.precio || !p.superficie_cubierta || p.superficie_cubierta <= 0) return null;
  const usd = p.moneda === "ARS" ? p.precio / tc : p.precio;
  return usd / p.superficie_cubierta;
}

function mediana(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function AnalisisZona() {
  const [propiedades, setPropiedades] = useState<PropCartera[]>([]);
  const [loading, setLoading] = useState(true);
  const [tcDolar, setTcDolar] = useState(1200);
  const [filtroOperacion, setFiltroOperacion] = useState("venta");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [zonaSeleccionada, setZonaSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("crm_cartera")
      .select("id,barrio,tipo,operacion,precio,moneda,superficie_cubierta,ambientes,estado")
      .eq("estado", "activa")
      .then(({ data }) => {
        setPropiedades((data ?? []) as PropCartera[]);
        setLoading(false);
      });
  }, []);

  const tiposDisponibles = useMemo(() => {
    const set = new Set(propiedades.map(p => p.tipo).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [propiedades]);

  const propFiltradas = useMemo(() => {
    return propiedades.filter(p => {
      if (filtroOperacion !== "todos" && p.operacion !== filtroOperacion) return false;
      if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
      return precioM2USD(p, tcDolar) !== null;
    });
  }, [propiedades, filtroOperacion, filtroTipo, tcDolar]);

  const zonaStats = useMemo<ZonaStats[]>(() => {
    const mapa: Record<string, PropCartera[]> = {};
    propFiltradas.forEach(p => {
      const barrio = p.barrio?.trim() || "Sin barrio";
      if (!mapa[barrio]) mapa[barrio] = [];
      mapa[barrio].push(p);
    });

    return Object.entries(mapa)
      .filter(([, props]) => props.length >= 1)
      .map(([barrio, props]) => {
        const pm2s = props.map(p => precioM2USD(p, tcDolar)!).filter(Boolean);
        const precios = props.map(p => (p.moneda === "ARS" ? (p.precio ?? 0) / tcDolar : p.precio ?? 0));
        const sups = props.map(p => p.superficie_cubierta ?? 0).filter(Boolean);

        const distribTipo: Record<string, number> = {};
        props.forEach(p => {
          const t = p.tipo ?? "otros";
          distribTipo[t] = (distribTipo[t] ?? 0) + 1;
        });
        const tipoMasFrecuente = Object.entries(distribTipo).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

        return {
          barrio,
          count: props.length,
          pm2Promedio: pm2s.reduce((s, v) => s + v, 0) / pm2s.length,
          pm2Min: Math.min(...pm2s),
          pm2Max: Math.max(...pm2s),
          pm2Mediana: mediana(pm2s),
          precioPromedio: precios.reduce((s, v) => s + v, 0) / precios.length,
          supPromedio: sups.length > 0 ? sups.reduce((s, v) => s + v, 0) / sups.length : 0,
          tipoMasFrecuente,
          distribTipo,
        };
      })
      .sort((a, b) => b.pm2Mediana - a.pm2Mediana);
  }, [propFiltradas, tcDolar]);

  const globalStats = useMemo(() => {
    const pm2s = propFiltradas.map(p => precioM2USD(p, tcDolar)!).filter(Boolean);
    if (pm2s.length === 0) return null;
    return {
      pm2Promedio: pm2s.reduce((s, v) => s + v, 0) / pm2s.length,
      pm2Mediana: mediana(pm2s),
      pm2Min: Math.min(...pm2s),
      pm2Max: Math.max(...pm2s),
      total: propFiltradas.length,
      zonas: zonaStats.length,
    };
  }, [propFiltradas, zonaStats, tcDolar]);

  const maxPm2 = Math.max(...zonaStats.map(z => z.pm2Mediana), 1);
  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => `USD ${fmt(n)}`;

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter, sans-serif",
  };

  const zonaDetalle = zonaSeleccionada ? zonaStats.find(z => z.barrio === zonaSeleccionada) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>📍 Análisis por Zona</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Precio por m² y estadísticas de mercado por barrio — cartera activa</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filtroOperacion} onChange={e => setFiltroOperacion(e.target.value)} style={inputStyle}>
            <option value="todos">Todas las operaciones</option>
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
            <option value="alquiler_temporal">Alquiler temporal</option>
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los tipos</option>
            {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} placeholder="TC ARS/USD" style={{ ...inputStyle, width: 120 }} />
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 48 }}>Cargando...</div>
        ) : (
          <>
            {/* Global KPIs */}
            {globalStats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                {[
                  { label: "Propiedades analizadas", val: globalStats.total.toString(), color: "#3b82f6" },
                  { label: "Zonas / Barrios", val: globalStats.zonas.toString(), color: "#a78bfa" },
                  { label: "Precio/m² promedio", val: fmtUSD(globalStats.pm2Promedio) + "/m²", color: "#22c55e" },
                  { label: "Precio/m² mediana", val: fmtUSD(globalStats.pm2Mediana) + "/m²", color: "#f59e0b" },
                  { label: "Rango (mín)", val: fmtUSD(globalStats.pm2Min) + "/m²", color: "#888" },
                  { label: "Rango (máx)", val: fmtUSD(globalStats.pm2Max) + "/m²", color: "#cc0000" },
                ].map((kpi, i) => (
                  <div key={i} style={{ background: "#111", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
                  </div>
                ))}
              </div>
            )}

            {zonaStats.length === 0 ? (
              <div style={{ background: "#111", border: "1px solid #333", borderRadius: 10, padding: 32, textAlign: "center", color: "#666" }}>
                Sin propiedades con precio y superficie definidos para los filtros seleccionados.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: zonaDetalle ? "1fr 320px" : "1fr", gap: 16 }}>
                {/* Ranking de zonas */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
                  <h2 style={{ margin: "0 0 20px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                    Ranking por precio mediano/m² ({zonaStats.length} zonas)
                  </h2>
                  {zonaStats.map((zona, i) => {
                    const pct = (zona.pm2Mediana / maxPm2) * 100;
                    const isSelected = zonaSeleccionada === zona.barrio;
                    return (
                      <div
                        key={zona.barrio}
                        onClick={() => setZonaSeleccionada(isSelected ? null : zona.barrio)}
                        style={{
                          marginBottom: 10, cursor: "pointer", padding: "8px 10px", borderRadius: 6,
                          background: isSelected ? "#cc000015" : "transparent",
                          border: `1px solid ${isSelected ? "#cc0000" : "transparent"}`,
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "#555", minWidth: 20 }}>#{i + 1}</span>
                            <span style={{ fontSize: 13, color: isSelected ? "#fff" : "#ccc", fontWeight: isSelected ? 700 : 400 }}>{zona.barrio}</span>
                            <span style={{ fontSize: 10, color: "#555" }}>({zona.count} prop.)</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: i < 3 ? "#f59e0b" : "#22c55e" }}>
                              {fmtUSD(zona.pm2Mediana)}/m²
                            </span>
                          </div>
                        </div>
                        <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden", display: "flex", gap: 1 }}>
                          {/* Barra de mediana */}
                          <div style={{ width: `${pct}%`, background: i < 3 ? "#f59e0b" : "#cc0000", borderRadius: 4, position: "relative" }}>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                          <span style={{ fontSize: 10, color: "#555" }}>mín {fmtUSD(zona.pm2Min)}/m²</span>
                          <span style={{ fontSize: 10, color: "#555" }}>máx {fmtUSD(zona.pm2Max)}/m²</span>
                          <span style={{ fontSize: 10, color: "#555" }}>prom. {fmtUSD(zona.precioPromedio)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Panel detalle zona */}
                {zonaDetalle && (
                  <div style={{ background: "#111", border: "1px solid #cc0000", borderRadius: 10, padding: "20px", alignSelf: "start", position: "sticky", top: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h2 style={{ margin: 0, fontSize: 14, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>
                        📍 {zonaDetalle.barrio}
                      </h2>
                      <button onClick={() => setZonaSeleccionada(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>

                    {[
                      { label: "Propiedades", val: zonaDetalle.count.toString() },
                      { label: "Precio mediano/m²", val: fmtUSD(zonaDetalle.pm2Mediana) + "/m²", color: "#f59e0b" },
                      { label: "Precio promedio/m²", val: fmtUSD(zonaDetalle.pm2Promedio) + "/m²", color: "#22c55e" },
                      { label: "Rango m²", val: `${fmtUSD(zonaDetalle.pm2Min)} — ${fmtUSD(zonaDetalle.pm2Max)}` },
                      { label: "Precio promedio", val: fmtUSD(zonaDetalle.precioPromedio) },
                      { label: "Sup. promedio", val: `${zonaDetalle.supPromedio.toFixed(0)} m²` },
                      { label: "Tipo más frecuente", val: zonaDetalle.tipoMasFrecuente },
                    ].map((row, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
                        <span style={{ fontSize: 12, color: "#888" }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: ("color" in row ? row.color : "#fff") as string }}>{row.val}</span>
                      </div>
                    ))}

                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>
                        Distribución por tipo
                      </div>
                      {Object.entries(zonaDetalle.distribTipo).sort((a, b) => b[1] - a[1]).map(([tipo, count]) => (
                        <div key={tipo} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#ccc" }}>{tipo}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ height: 6, width: 60, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(count / zonaDetalle.count) * 100}%`, background: "#cc0000", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: "#666", minWidth: 20 }}>{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
