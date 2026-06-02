"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PropCartera {
  id: string;
  direccion: string;
  zona: string | null;
  tipo: string | null;
  operacion: string | null;
  precio: number | null;
  precio_anterior: number | null;
  moneda: string | null;
  superficie_cubierta: number | null;
  estado: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function diasEnCartera(fechaCreacion: string | null): number {
  if (!fechaCreacion) return 0;
  return Math.floor((Date.now() - new Date(fechaCreacion).getTime()) / 86400000);
}

function variacionPrecio(actual: number | null, original: number | null): number | null {
  if (!actual || !original || original === 0) return null;
  return ((actual - original) / original) * 100;
}

function semaforo(dias: number): { color: string; label: string } {
  if (dias <= 30) return { color: "#3abab6", label: "Reciente" };
  if (dias <= 60) return { color: "#d4960c", label: "Normal" };
  if (dias <= 90) return { color: "#d4960c", label: "Lento" };
  return { color: "#b80000", label: "Estancado" };
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function PerformanceCartera() {
  const [propiedades, setPropiedades] = useState<PropCartera[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("activa");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [orden, setOrden] = useState<"dias" | "reduccion" | "precio">("dias");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("cartera_propiedades")
        .select("id,direccion,zona,tipo,operacion,precio,precio_anterior,moneda,superficie_cubierta,estado,created_at,updated_at")
        .eq("perfil_id", user.id)
        .order("created_at", { ascending: false });
      setPropiedades((data ?? []) as PropCartera[]);
      setLoading(false);
    })();
  }, []);

  const tiposDisponibles = useMemo(() => {
    const set = new Set(propiedades.map(p => p.tipo).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [propiedades]);

  const filtradas = useMemo(() => {
    let f = propiedades;
    if (filtroEstado !== "todos") f = f.filter(p => p.estado === filtroEstado);
    if (filtroTipo !== "todos") f = f.filter(p => p.tipo === filtroTipo);
    return f;
  }, [propiedades, filtroEstado, filtroTipo]);

  const ordenadas = useMemo(() => {
    return [...filtradas].sort((a, b) => {
      if (orden === "dias") return diasEnCartera(b.created_at) - diasEnCartera(a.created_at);
      if (orden === "reduccion") {
        const va = variacionPrecio(a.precio, a.precio_anterior) ?? 0;
        const vb = variacionPrecio(b.precio, b.precio_anterior) ?? 0;
        return va - vb; // más negativo = mayor reducción primero
      }
      return (b.precio ?? 0) - (a.precio ?? 0);
    });
  }, [filtradas, orden]);

  const kpis = useMemo(() => {
    const activas = propiedades.filter(p => p.estado === "activa");
    const dias = activas.map(p => diasEnCartera(p.created_at));
    const promDias = dias.length > 0 ? dias.reduce((s, d) => s + d, 0) / dias.length : 0;
    const mediaDias = dias.length > 0 ? [...dias].sort((a, b) => a - b)[Math.floor(dias.length / 2)] : 0;
    const conReduccion = activas.filter(p => p.precio_anterior && p.precio && p.precio < p.precio_anterior);
    const pctReduccion = activas.length > 0 ? (conReduccion.length / activas.length) * 100 : 0;
    const estancadas = activas.filter(p => diasEnCartera(p.created_at) > 90);
    const reduccionPromedio = conReduccion.length > 0
      ? conReduccion.reduce((s, p) => s + Math.abs(variacionPrecio(p.precio, p.precio_anterior) ?? 0), 0) / conReduccion.length
      : 0;
    return { total: activas.length, promDias, mediaDias, conReduccion: conReduccion.length, pctReduccion, estancadas: estancadas.length, reduccionPromedio };
  }, [propiedades]);

  // Distribución por días en cartera (buckets)
  const buckets = useMemo(() => {
    const b: Record<string, number> = { "0-30d": 0, "31-60d": 0, "61-90d": 0, "+90d": 0 };
    propiedades.filter(p => p.estado === "activa").forEach(p => {
      const d = diasEnCartera(p.created_at);
      if (d <= 30) b["0-30d"]++;
      else if (d <= 60) b["31-60d"]++;
      else if (d <= 90) b["61-90d"]++;
      else b["+90d"]++;
    });
    return b;
  }, [propiedades]);
  const maxBucket = Math.max(...Object.values(buckets), 1);

  const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "var(--gfi-bg-secondary)", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "var(--font-display)", fontWeight: 800 }}>📈 Performance de Cartera</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Días en cartera, reducciones de precio y propiedades estancadas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los estados</option>
            <option value="activa">Activa</option>
            <option value="reservada">Reservada</option>
            <option value="vendida">Vendida</option>
            <option value="pausada">Pausada</option>
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los tipos</option>
            {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={orden} onChange={e => setOrden(e.target.value as typeof orden)} style={inputStyle}>
            <option value="dias">Ordenar: días en cartera</option>
            <option value="reduccion">Ordenar: mayor reducción</option>
            <option value="precio">Ordenar: precio</option>
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { label: "Activas en cartera", val: kpis.total.toString(), color: "#3b82f6" },
            { label: "Prom. días en cartera", val: `${kpis.promDias.toFixed(0)} días`, color: "#a78bfa" },
            { label: "Mediana días", val: `${kpis.mediaDias} días`, color: "#a78bfa" },
            { label: "Con reducción", val: `${kpis.conReduccion} (${kpis.pctReduccion.toFixed(0)}%)`, color: "#d4960c" },
            { label: "Reducción promedio", val: kpis.reduccionPromedio > 0 ? `−${kpis.reduccionPromedio.toFixed(1)}%` : "—", color: "#b80000" },
            { label: "Estancadas (+90d)", val: kpis.estancadas.toString(), color: kpis.estancadas > 0 ? "#b80000" : "#3abab6" },
          ].map((kpi, i) => (
            <div key={i} style={{ background: "var(--gfi-bg-secondary)", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: "#888", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
            </div>
          ))}
        </div>

        {/* Distribución por tiempo en cartera */}
        <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
            Distribución por tiempo en cartera (activas)
          </h2>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 80 }}>
            {Object.entries(buckets).map(([label, count]) => {
              const colors: Record<string, string> = { "0-30d": "#3abab6", "31-60d": "#d4960c", "61-90d": "#d4960c", "+90d": "#b80000" };
              return (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12, color: colors[label], fontWeight: 700 }}>{count}</span>
                  <div style={{ width: "100%", background: colors[label], height: `${(count / maxBucket) * 60}px`, borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                  <span style={{ fontSize: 11, color: "#888" }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 48 }}>Cargando...</div>
        ) : (
          <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  {["Propiedad","Tipo / Zona","Precio actual","Variación","Días","Estado"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: "#666", fontFamily: "var(--font-display)", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenadas.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#555" }}>Sin propiedades</td></tr>
                ) : ordenadas.map((p, i) => {
                  const dias = diasEnCartera(p.created_at);
                  const sem = semaforo(dias);
                  const variacion = variacionPrecio(p.precio, p.precio_anterior);
                  const sym = p.moneda === "ARS" ? "$" : "USD";
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #111", background: i % 2 === 0 ? "var(--gfi-bg-primary)" : "transparent" }}>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontSize: 13, color: "#fff" }}>{p.direccion}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{p.operacion ?? "—"}</div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontSize: 12, color: "#ccc" }}>{p.tipo ?? "—"}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{p.zona ?? "—"}{p.superficie_cubierta ? ` · ${p.superficie_cubierta}m²` : ""}</div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.precio ? `${sym} ${fmt(p.precio)}` : "—"}</div>
                        {p.precio_anterior && p.precio_anterior !== p.precio && (
                          <div style={{ fontSize: 11, color: "#555", textDecoration: "line-through" }}>{sym} {fmt(p.precio_anterior)}</div>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        {variacion !== null ? (
                          <span style={{ fontSize: 13, fontWeight: 700, color: variacion < 0 ? "#b80000" : "#3abab6" }}>
                            {variacion > 0 ? "+" : ""}{variacion.toFixed(1)}%
                          </span>
                        ) : <span style={{ color: "#555" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: sem.color }} />
                          <div>
                            <div style={{ fontSize: 13, color: sem.color, fontWeight: 600 }}>{dias}d</div>
                            <div style={{ fontSize: 10, color: "#555" }}>{sem.label}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{
                          fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, padding: "2px 8px",
                          borderRadius: 4, background: "#1a1a1a", color: "#888",
                        }}>{p.estado ?? "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
