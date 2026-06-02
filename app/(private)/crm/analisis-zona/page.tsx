"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Propiedad {
  id: string;
  tipo: string | null;
  operacion: string | null;
  zona: string | null;
  precio: number | null;
  moneda: string | null;
  superficie_cubierta: number | null;
  superficie_total: number | null;
  ambientes: number | null;
  estado: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Negocio {
  id: string;
  tipo_operacion: string | null;
  valor_operacion: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  updated_at: string | null;
  honorarios_pct: number | null;
}

interface EstadisticasZona {
  barrio: string;
  cantPropiedades: number;
  precioPromM2: number | null;
  precioMinM2: number | null;
  precioMaxM2: number | null;
  tiempoPromedioVenta: number | null;
  operacionesCerradas: number;
  stockActivo: number;
}

type TabId = "barrios" | "propiedades" | "tendencias";

type SortCol =
  | "barrio"
  | "stockActivo"
  | "precioPromM2"
  | "precioMinM2"
  | "precioMaxM2"
  | "operacionesCerradas"
  | "tiempoPromedioVenta";

interface TendenciaMes {
  key: string;
  label: string;
  cantidad: number;
  precioPromedio: number | null;
  honorariosEst: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function mesKey(fecha: string | null): string {
  if (!fecha) return "0000-00";
  return fecha.substring(0, 7);
}

function mesLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function diasEntre(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null;
  const d = new Date(desde).getTime();
  const h = new Date(hasta).getTime();
  const diff = (h - d) / 86400000;
  return diff >= 0 ? diff : null;
}

function fmtUSD(n: number): string {
  return `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function calcPrecioM2USD(p: Propiedad, tc: number): number | null {
  if (!p.precio || !p.superficie_cubierta || p.superficie_cubierta <= 0) return null;
  const usd = p.moneda === "ARS" ? p.precio / tc : p.precio;
  return usd / p.superficie_cubierta;
}

function calcPrecioUSD(precio: number | null, moneda: string | null, tc: number): number | null {
  if (precio === null) return null;
  return moneda === "ARS" ? precio / tc : precio;
}

// ── Histograma bins ───────────────────────────────────────────────────────────

function buildHistogram(values: number[], bins: number): { lo: number; hi: number; count: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ lo: min, hi: max, count: values.length }];
  const step = (max - min) / bins;
  const result = Array.from({ length: bins }, (_, i) => ({
    lo: min + i * step,
    hi: min + (i + 1) * step,
    count: 0,
  }));
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    result[idx].count++;
  });
  return result;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AnalisisZona() {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [tab, setTab] = useState<TabId>("barrios");

  // Tab 1 state
  const [barrioSeleccionado, setBarrioSeleccionado] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("stockActivo");
  const [sortAsc, setSortAsc] = useState(false);

  // Tab 2 state
  const [filtroBarrio, setFiltroBarrio] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroOperacion, setFiltroOperacion] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: props }, { data: negs }] = await Promise.all([
        supabase
          .from("cartera_propiedades")
          .select("id, tipo, operacion, zona, precio, moneda, superficie_cubierta, superficie_total, ambientes, estado, created_at, updated_at")
          .eq("perfil_id", user.id),
        supabase
          .from("crm_negocios")
          .select("id, tipo_operacion, valor_operacion, moneda, fecha_cierre, updated_at, honorarios_pct")
          .eq("perfil_id", user.id)
          .eq("etapa", "cerrado"),
      ]);

      setPropiedades((props ?? []) as Propiedad[]);
      setNegocios((negs ?? []) as Negocio[]);
      setLoading(false);
    }
    load();
  }, []);

  // ── Barrios únicos ─────────────────────────────────────────────────────────

  const barriosUnicos = useMemo(() => {
    const set = new Set(propiedades.map((p) => p.zona?.trim() || "Sin barrio"));
    return Array.from(set).sort();
  }, [propiedades]);

  const tiposUnicos = useMemo(() => {
    const set = new Set(propiedades.map((p) => p.tipo).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [propiedades]);

  // ── Estadísticas por zona ──────────────────────────────────────────────────

  const estadisticasPorZona = useMemo<EstadisticasZona[]>(() => {
    const mapa: Record<string, Propiedad[]> = {};
    propiedades.forEach((p) => {
      const b = p.zona?.trim() || "Sin barrio";
      if (!mapa[b]) mapa[b] = [];
      mapa[b].push(p);
    });

    return Object.entries(mapa).map(([barrio, props]) => {
      const activas = props.filter((p) => p.estado === "activo" || p.estado === "activa");
      const pm2s = activas
        .map((p) => calcPrecioM2USD(p, tipoCambio))
        .filter((v): v is number => v !== null);

      const vendidas = props.filter(
        (p) => p.estado === "vendido" || p.estado === "alquilado"
      );
      const tiempos = vendidas
        .map((p) => diasEntre(p.created_at, p.updated_at))
        .filter((d): d is number => d !== null);

      return {
        barrio,
        cantPropiedades: props.length,
        precioPromM2: pm2s.length > 0 ? pm2s.reduce((s, v) => s + v, 0) / pm2s.length : null,
        precioMinM2: pm2s.length > 0 ? Math.min(...pm2s) : null,
        precioMaxM2: pm2s.length > 0 ? Math.max(...pm2s) : null,
        tiempoPromedioVenta:
          tiempos.length > 0 ? tiempos.reduce((s, d) => s + d, 0) / tiempos.length : null,
        operacionesCerradas: 0,
        stockActivo: activas.length,
      };
    });
  }, [propiedades, tipoCambio]);

  // ── Tabla ordenada ─────────────────────────────────────────────────────────

  const tablaOrdenada = useMemo(() => {
    return [...estadisticasPorZona].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "string" && typeof vb === "string") {
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      const na = va as number;
      const nb = vb as number;
      return sortAsc ? na - nb : nb - na;
    });
  }, [estadisticasPorZona, sortCol, sortAsc]);

  const handleSort = useCallback(
    (col: SortCol) => {
      if (sortCol === col) setSortAsc((a) => !a);
      else { setSortCol(col); setSortAsc(false); }
    },
    [sortCol]
  );

  // ── Scatter plot data ──────────────────────────────────────────────────────

  const scatterData = useMemo(() => {
    return estadisticasPorZona.filter(
      (z) => z.precioPromM2 !== null && z.tiempoPromedioVenta !== null
    );
  }, [estadisticasPorZona]);

  const scatterXMax = Math.max(...scatterData.map((z) => z.precioPromM2 ?? 0), 1);
  const scatterYMax = Math.max(...scatterData.map((z) => z.tiempoPromedioVenta ?? 0), 1);
  const scatterStockMax = Math.max(...scatterData.map((z) => z.stockActivo), 1);

  // ── Tab 2: propiedades filtradas ───────────────────────────────────────────

  const propFiltradas = useMemo(() => {
    return propiedades.filter((p) => {
      if (filtroBarrio !== "todos" && (p.zona?.trim() || "Sin barrio") !== filtroBarrio)
        return false;
      if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
      if (filtroOperacion !== "todos" && p.operacion !== filtroOperacion) return false;
      if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
      return true;
    });
  }, [propiedades, filtroBarrio, filtroTipo, filtroOperacion, filtroEstado]);

  const kpiTab2 = useMemo(() => {
    const activas = propFiltradas.filter((p) => p.estado === "activo" || p.estado === "activa");
    const precios = propFiltradas
      .map((p) => calcPrecioUSD(p.precio, p.moneda, tipoCambio))
      .filter((v): v is number => v !== null);
    const pm2s = propFiltradas
      .map((p) => calcPrecioM2USD(p, tipoCambio))
      .filter((v): v is number => v !== null);
    return {
      stockActivo: activas.length,
      precioPromedio: precios.length > 0 ? precios.reduce((s, v) => s + v, 0) / precios.length : null,
      pm2Promedio: pm2s.length > 0 ? pm2s.reduce((s, v) => s + v, 0) / pm2s.length : null,
    };
  }, [propFiltradas, tipoCambio]);

  const histogramData = useMemo(() => {
    const vals = propFiltradas
      .map((p) => calcPrecioM2USD(p, tipoCambio))
      .filter((v): v is number => v !== null);
    return buildHistogram(vals, 8);
  }, [propFiltradas, tipoCambio]);

  const histMax = Math.max(...histogramData.map((b) => b.count), 1);

  // ── Tab 3: tendencias ──────────────────────────────────────────────────────

  const tendencias = useMemo<TendenciaMes[]>(() => {
    const hoy = new Date();
    const meses: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    return meses.map((key) => {
      const delMes = negocios.filter(
        (n) => mesKey(n.fecha_cierre || n.updated_at) === key
      );
      const precios = delMes
        .map((n) => calcPrecioUSD(n.valor_operacion, n.moneda, tipoCambio))
        .filter((v): v is number => v !== null);
      const honorarios = delMes.reduce((sum, n) => {
        const p = calcPrecioUSD(n.valor_operacion, n.moneda, tipoCambio);
        if (!p || !n.honorarios_pct) return sum;
        return sum + p * (n.honorarios_pct / 100);
      }, 0);
      return {
        key,
        label: mesLabel(key),
        cantidad: delMes.length,
        precioPromedio: precios.length > 0 ? precios.reduce((s, v) => s + v, 0) / precios.length : null,
        honorariosEst: honorarios,
      };
    });
  }, [negocios, tipoCambio]);

  const tendMaxCant = Math.max(...tendencias.map((t) => t.cantidad), 1);
  const tendMaxPrecio = Math.max(...tendencias.map((t) => t.precioPromedio ?? 0), 1);

  const kpiTend = useMemo(() => {
    const mejor = tendencias.reduce(
      (acc, t) => (t.cantidad > acc.cantidad ? t : acc),
      tendencias[0] ?? { label: "—", cantidad: 0 }
    );
    const totalOps = tendencias.reduce((s, t) => s + t.cantidad, 0);
    const totalHonorarios = tendencias.reduce((s, t) => s + t.honorariosEst, 0);
    const promMensual = totalOps / 12;
    return { mejor, totalOps, totalHonorarios, promMensual };
  }, [tendencias]);

  // ── Styles compartidos ─────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#fff",
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "Inter, sans-serif",
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    textAlign: "left",
    fontSize: 10,
    color: "#888",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
    borderBottom: "1px solid #222",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 12,
    color: "#ccc",
    borderBottom: "1px solid #111",
    whiteSpace: "nowrap",
  };

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span style={{ color: "#444", marginLeft: 3 }}>⇅</span>;
    return <span style={{ color: "#990000", marginLeft: 3 }}>{sortAsc ? "↑" : "↓"}</span>;
  }

  function Th({ col, label }: { col: SortCol; label: string }) {
    return (
      <th style={thStyle} onClick={() => handleSort(col)}>
        {label}
        <SortIcon col={col} />
      </th>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div
        style={{
          background: "var(--gfi-bg-secondary)",
          borderBottom: "1px solid #222",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>
          ← CRM
        </Link>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 28,
              color: "#fff",
            }}
          >
            Análisis de Zona
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Mercado inmobiliario local — basado en tu cartera y operaciones registradas
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#666" }}>TC ARS/USD:</span>
          <input
            type="number"
            value={tipoCambio}
            onChange={(e) => setTipoCambio(Math.max(1, +e.target.value))}
            style={{ ...inputStyle, width: 100 }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: "var(--gfi-bg-primary)",
          borderBottom: "1px solid #1a1a1a",
          padding: "12px 24px",
          display: "flex",
          gap: 8,
        }}
      >
        {(
          [
            { id: "barrios" as TabId, label: "Por Barrio" },
            { id: "propiedades" as TabId, label: "Propiedades de la zona" },
            { id: "tendencias" as TabId, label: "Tendencias" },
          ] as { id: TabId; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 18px",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 12,
              background: tab === t.id ? "#990000" : "#1a1a1a",
              color: tab === t.id ? "#fff" : "#888",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 64, fontSize: 14 }}>
            Cargando datos...
          </div>
        ) : (
          <>
            {/* ── TAB 1: POR BARRIO ─────────────────────────────────────────── */}
            {tab === "barrios" && (
              <>
                {/* Tabla barrios */}
                <div
                  style={{
                    background: "var(--gfi-bg-secondary)",
                    border: "1px solid #222",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #222" }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        color: "#fff",
                        textTransform: "uppercase",
                      }}
                    >
                      Estadísticas por barrio ({tablaOrdenada.length} zonas)
                    </h2>
                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "var(--gfi-text-muted)",
                        fontSize: 12,
                        fontStyle: "italic",
                      }}
                    >
                      Los datos se basan en tu cartera y operaciones registradas en el CRM. Para mayor precisión, cargá tus propiedades en Cartera.
                    </p>
                  </div>
                  {tablaOrdenada.length === 0 ? (
                    <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 13 }}>
                      Sin datos suficientes. Cargá propiedades en Cartera.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <Th col="barrio" label="Barrio" />
                            <Th col="stockActivo" label="Stock activo" />
                            <Th col="precioPromM2" label="Precio/m² prom" />
                            <Th col="precioMinM2" label="Precio/m² mín" />
                            <Th col="precioMaxM2" label="Precio/m² máx" />
                            <Th col="operacionesCerradas" label="Ops. cerradas" />
                            <Th col="tiempoPromedioVenta" label="Días prom. venta" />
                          </tr>
                        </thead>
                        <tbody>
                          {tablaOrdenada.map((z) => {
                            const isSelected = barrioSeleccionado === z.barrio;
                            return (
                              <tr
                                key={z.barrio}
                                onClick={() =>
                                  setBarrioSeleccionado(isSelected ? null : z.barrio)
                                }
                                style={{
                                  cursor: "pointer",
                                  background: isSelected ? "rgba(153,0,0,0.08)" : "transparent",
                                  transition: "background 0.1s",
                                }}
                              >
                                <td
                                  style={{
                                    ...tdStyle,
                                    fontWeight: isSelected ? 700 : 400,
                                    color: isSelected ? "#fff" : "#ccc",
                                    borderLeft: isSelected
                                      ? "3px solid #990000"
                                      : "3px solid transparent",
                                  }}
                                >
                                  {z.barrio}
                                </td>
                                <td style={tdStyle}>{z.stockActivo}</td>
                                <td style={{ ...tdStyle, color: z.precioPromM2 !== null ? "#3abab6" : "#555" }}>
                                  {z.precioPromM2 !== null
                                    ? `${fmtUSD(z.precioPromM2)}/m²`
                                    : "—"}
                                </td>
                                <td style={{ ...tdStyle, color: "#888" }}>
                                  {z.precioMinM2 !== null
                                    ? `${fmtUSD(z.precioMinM2)}/m²`
                                    : "—"}
                                </td>
                                <td style={{ ...tdStyle, color: "#888" }}>
                                  {z.precioMaxM2 !== null
                                    ? `${fmtUSD(z.precioMaxM2)}/m²`
                                    : "—"}
                                </td>
                                <td style={{ ...tdStyle, color: z.operacionesCerradas > 0 ? "#d4960c" : "#555" }}>
                                  {z.operacionesCerradas}
                                </td>
                                <td style={{ ...tdStyle, color: z.tiempoPromedioVenta !== null ? "#a78bfa" : "#555" }}>
                                  {z.tiempoPromedioVenta !== null
                                    ? `${z.tiempoPromedioVenta.toFixed(0)}d`
                                    : "Sin datos suficientes"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Scatter plot */}
                {scatterData.length > 0 && (
                  <div
                    style={{
                      background: "var(--gfi-bg-secondary)",
                      border: "1px solid #222",
                      borderRadius: 10,
                      padding: "20px 24px",
                    }}
                  >
                    <h2
                      style={{
                        margin: "0 0 4px",
                        fontSize: 13,
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        color: "#fff",
                        textTransform: "uppercase",
                      }}
                    >
                      Precio/m² vs. Tiempo de venta por barrio
                    </h2>
                    <p style={{ margin: "0 0 16px", fontSize: 11, color: "#555" }}>
                      Tamaño del punto = stock activo. Solo barrios con datos completos.
                    </p>
                    <div style={{ overflowX: "auto" }}>
                      <svg
                        width={620}
                        height={340}
                        style={{ display: "block", maxWidth: "100%" }}
                      >
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                          <g key={f}>
                            <line
                              x1={60}
                              x2={590}
                              y1={20 + (1 - f) * 280}
                              y2={20 + (1 - f) * 280}
                              stroke="#1a1a1a"
                              strokeWidth={1}
                            />
                            <text
                              x={55}
                              y={24 + (1 - f) * 280}
                              textAnchor="end"
                              fill="#555"
                              fontSize={9}
                            >
                              {fmtNum(f * scatterYMax)}d
                            </text>
                          </g>
                        ))}
                        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                          <g key={f}>
                            <line
                              x1={60 + f * 530}
                              x2={60 + f * 530}
                              y1={20}
                              y2={300}
                              stroke="#1a1a1a"
                              strokeWidth={1}
                            />
                            <text
                              x={60 + f * 530}
                              y={315}
                              textAnchor="middle"
                              fill="#555"
                              fontSize={9}
                            >
                              {fmtNum(f * scatterXMax)}
                            </text>
                          </g>
                        ))}
                        {/* Axis labels */}
                        <text x={325} y={332} textAnchor="middle" fill="#666" fontSize={10}>
                          Precio/m² promedio (USD)
                        </text>
                        <text
                          x={12}
                          y={160}
                          textAnchor="middle"
                          fill="#666"
                          fontSize={10}
                          transform="rotate(-90, 12, 160)"
                        >
                          Días prom. venta
                        </text>
                        {/* Points */}
                        {scatterData.map((z) => {
                          const cx = 60 + ((z.precioPromM2 ?? 0) / scatterXMax) * 530;
                          const cy =
                            20 + (1 - (z.tiempoPromedioVenta ?? 0) / scatterYMax) * 280;
                          const r = 5 + (z.stockActivo / scatterStockMax) * 16;
                          const isSelected = barrioSeleccionado === z.barrio;
                          return (
                            <g
                              key={z.barrio}
                              onClick={() =>
                                setBarrioSeleccionado(isSelected ? null : z.barrio)
                              }
                              style={{ cursor: "pointer" }}
                            >
                              <circle
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill={isSelected ? "#990000" : "rgba(153,0,0,0.35)"}
                                stroke={isSelected ? "#ff4444" : "#990000"}
                                strokeWidth={isSelected ? 2 : 1}
                              />
                              <text
                                x={cx + r + 4}
                                y={cy + 4}
                                fill={isSelected ? "#fff" : "#aaa"}
                                fontSize={isSelected ? 11 : 10}
                                fontWeight={isSelected ? 700 : 400}
                              >
                                {z.barrio}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    {scatterData.length === 0 && (
                      <p style={{ color: "#555", fontSize: 12, textAlign: "center" }}>
                        Sin datos suficientes para el gráfico. Se requiere precio/m² y tiempo de venta por barrio.
                      </p>
                    )}
                  </div>
                )}

                {scatterData.length === 0 && estadisticasPorZona.length > 0 && (
                  <div
                    style={{
                      background: "var(--gfi-bg-secondary)",
                      border: "1px solid #222",
                      borderRadius: 10,
                      padding: "20px 24px",
                      color: "#555",
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    El scatter plot requiere barrios con precio/m² Y tiempo de venta registrado (propiedades vendidas/alquiladas con fechas completas).
                  </div>
                )}
              </>
            )}

            {/* ── TAB 2: PROPIEDADES DE LA ZONA ─────────────────────────────── */}
            {tab === "propiedades" && (
              <>
                {/* Filtros */}
                <div
                  style={{
                    background: "var(--gfi-bg-secondary)",
                    border: "1px solid #222",
                    borderRadius: 10,
                    padding: "16px 20px",
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={filtroBarrio}
                    onChange={(e) => setFiltroBarrio(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="todos">Todos los barrios</option>
                    {barriosUnicos.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="todos">Todos los tipos</option>
                    {tiposUnicos.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroOperacion}
                    onChange={(e) => setFiltroOperacion(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="todos">Venta y alquiler</option>
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                    <option value="alquiler_temporal">Alquiler temporal</option>
                  </select>
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="activo">Activo</option>
                    <option value="activa">Activa</option>
                    <option value="vendido">Vendido</option>
                    <option value="alquilado">Alquilado</option>
                    <option value="reservado">Reservado</option>
                    <option value="pausado">Pausado</option>
                  </select>
                  <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>
                    {propFiltradas.length} propiedad{propFiltradas.length !== 1 ? "es" : ""}
                  </span>
                </div>

                {/* KPIs */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  {[
                    {
                      label: "Stock activo",
                      val: kpiTab2.stockActivo.toString(),
                      color: "#3abab6",
                    },
                    {
                      label: "Precio promedio",
                      val: kpiTab2.precioPromedio !== null ? fmtUSD(kpiTab2.precioPromedio) : "—",
                      color: "#3b82f6",
                    },
                    {
                      label: "Precio/m² promedio",
                      val:
                        kpiTab2.pm2Promedio !== null
                          ? `${fmtUSD(kpiTab2.pm2Promedio)}/m²`
                          : "—",
                      color: "#d4960c",
                    },
                  ].map((kpi, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--gfi-bg-secondary)",
                        border: `1px solid ${kpi.color}33`,
                        borderRadius: 10,
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "#888",
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}
                      >
                        {kpi.label}
                      </div>
                      <div
                        style={{ fontSize: 20, fontWeight: 700, color: kpi.color, marginTop: 4 }}
                      >
                        {kpi.val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Histograma precio/m² */}
                {histogramData.length > 0 && (
                  <div
                    style={{
                      background: "var(--gfi-bg-secondary)",
                      border: "1px solid #222",
                      borderRadius: 10,
                      padding: "20px 24px",
                    }}
                  >
                    <h2
                      style={{
                        margin: "0 0 16px",
                        fontSize: 13,
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        color: "#fff",
                        textTransform: "uppercase",
                      }}
                    >
                      Distribución de precio/m² (USD)
                    </h2>
                    <svg
                      width={860}
                      height={180}
                      style={{ display: "block", maxWidth: "100%" }}
                    >
                      {histogramData.map((bin, i) => {
                        const barW = 860 / histogramData.length - 4;
                        const barH = (bin.count / histMax) * 130;
                        const x = i * (860 / histogramData.length) + 2;
                        const y = 140 - barH;
                        return (
                          <g key={i}>
                            <rect
                              x={x}
                              y={y}
                              width={barW}
                              height={barH}
                              fill="#99000099"
                              rx={3}
                            />
                            {bin.count > 0 && (
                              <text
                                x={x + barW / 2}
                                y={y - 4}
                                textAnchor="middle"
                                fill="#ccc"
                                fontSize={10}
                              >
                                {bin.count}
                              </text>
                            )}
                            <text
                              x={x + barW / 2}
                              y={158}
                              textAnchor="middle"
                              fill="#555"
                              fontSize={9}
                            >
                              {fmtNum(bin.lo)}
                            </text>
                          </g>
                        );
                      })}
                      <line x1={0} x2={860} y1={141} y2={141} stroke="#222" strokeWidth={1} />
                      <text x={430} y={175} textAnchor="middle" fill="#555" fontSize={10}>
                        USD/m²
                      </text>
                    </svg>
                  </div>
                )}

                {/* Tabla propiedades */}
                <div
                  style={{
                    background: "var(--gfi-bg-secondary)",
                    border: "1px solid #222",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #222" }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        color: "#fff",
                        textTransform: "uppercase",
                      }}
                    >
                      Propiedades ({propFiltradas.length})
                    </h2>
                  </div>
                  {propFiltradas.length === 0 ? (
                    <div style={{ padding: 32, textAlign: "center", color: "#555", fontSize: 13 }}>
                      Sin propiedades para los filtros seleccionados.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {[
                              "ID / Referencia",
                              "Tipo",
                              "Operación",
                              "Precio",
                              "m²",
                              "$/m²",
                              "Estado",
                              "Días en cartera",
                            ].map((h) => (
                              <th key={h} style={{ ...thStyle, cursor: "default" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {propFiltradas.map((p) => {
                            const pm2 = calcPrecioM2USD(p, tipoCambio);
                            const diasCartera = diasEntre(p.created_at, new Date().toISOString());
                            const precioUSD = calcPrecioUSD(p.precio, p.moneda, tipoCambio);
                            return (
                              <tr key={p.id}>
                                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "#666" }}>
                                  {p.id.substring(0, 8)}…
                                </td>
                                <td style={tdStyle}>{p.tipo ?? "—"}</td>
                                <td style={tdStyle}>{p.operacion ?? "—"}</td>
                                <td style={{ ...tdStyle, color: "#fff" }}>
                                  {precioUSD !== null ? fmtUSD(precioUSD) : "—"}
                                </td>
                                <td style={tdStyle}>
                                  {p.superficie_cubierta !== null
                                    ? `${fmtNum(p.superficie_cubierta)} m²`
                                    : "—"}
                                </td>
                                <td style={{ ...tdStyle, color: pm2 !== null ? "#3abab6" : "#555" }}>
                                  {pm2 !== null ? `${fmtUSD(pm2)}/m²` : "—"}
                                </td>
                                <td style={tdStyle}>
                                  <span
                                    style={{
                                      background:
                                        p.estado === "activo" || p.estado === "activa"
                                          ? "rgba(34,197,94,0.15)"
                                          : p.estado === "vendido" || p.estado === "alquilado"
                                          ? "rgba(153,0,0,0.15)"
                                          : "var(--gfi-border-subtle)",
                                      color:
                                        p.estado === "activo" || p.estado === "activa"
                                          ? "#3abab6"
                                          : p.estado === "vendido" || p.estado === "alquilado"
                                          ? "#990000"
                                          : "#888",
                                      padding: "2px 8px",
                                      borderRadius: 10,
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {p.estado ?? "—"}
                                  </span>
                                </td>
                                <td style={{ ...tdStyle, color: "#a78bfa" }}>
                                  {diasCartera !== null ? `${diasCartera.toFixed(0)}d` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── TAB 3: TENDENCIAS ─────────────────────────────────────────── */}
            {tab === "tendencias" && (
              <>
                {/* KPIs */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                    gap: 12,
                  }}
                >
                  {[
                    {
                      label: "Mejor mes",
                      val: kpiTend.mejor?.label ?? "—",
                      sub: `${kpiTend.mejor?.cantidad ?? 0} operaciones`,
                      color: "#d4960c",
                    },
                    {
                      label: "Promedio mensual",
                      val: kpiTend.promMensual.toFixed(1),
                      sub: "Cierres / mes",
                      color: "#3b82f6",
                    },
                    {
                      label: "Total operaciones",
                      val: kpiTend.totalOps.toString(),
                      sub: "Últimos 12 meses",
                      color: "#3abab6",
                    },
                    {
                      label: "Honorarios estimados",
                      val: fmtUSD(kpiTend.totalHonorarios),
                      sub: "Total acumulado",
                      color: "#990000",
                    },
                  ].map((kpi, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--gfi-bg-secondary)",
                        border: `1px solid ${kpi.color}33`,
                        borderRadius: 10,
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "#888",
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}
                      >
                        {kpi.label}
                      </div>
                      <div
                        style={{ fontSize: 20, fontWeight: 700, color: kpi.color, marginTop: 4 }}
                      >
                        {kpi.val}
                      </div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{kpi.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Line chart */}
                <div
                  style={{
                    background: "var(--gfi-bg-secondary)",
                    border: "1px solid #222",
                    borderRadius: 10,
                    padding: "20px 24px",
                  }}
                >
                  <h2
                    style={{
                      margin: "0 0 8px",
                      fontSize: 13,
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      color: "#fff",
                      textTransform: "uppercase",
                    }}
                  >
                    Cierres por mes — últimos 12 meses
                  </h2>
                  <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 20, height: 2, background: "#990000" }} />
                      <span style={{ fontSize: 11, color: "#888" }}>Cantidad cierres</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 20, height: 2, background: "#d4960c", borderTop: "1px dashed #d4960c" }} />
                      <span style={{ fontSize: 11, color: "#888" }}>Precio prom. (USD, eje der.)</span>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <svg
                      width={880}
                      height={220}
                      style={{ display: "block", maxWidth: "100%" }}
                    >
                      {/* Grid */}
                      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                        <g key={f}>
                          <line
                            x1={50}
                            x2={860}
                            y1={20 + (1 - f) * 160}
                            y2={20 + (1 - f) * 160}
                            stroke="#1a1a1a"
                            strokeWidth={1}
                          />
                          <text
                            x={45}
                            y={24 + (1 - f) * 160}
                            textAnchor="end"
                            fill="#555"
                            fontSize={9}
                          >
                            {fmtNum(f * tendMaxCant)}
                          </text>
                          <text
                            x={865}
                            y={24 + (1 - f) * 160}
                            textAnchor="start"
                            fill="#d4960c55"
                            fontSize={9}
                          >
                            {fmtNum(f * tendMaxPrecio)}
                          </text>
                        </g>
                      ))}

                      {/* Lines */}
                      {tendencias.length > 1 && (
                        <>
                          {/* Cantidad line */}
                          <polyline
                            fill="none"
                            stroke="#990000"
                            strokeWidth={2}
                            points={tendencias
                              .map((t, i) => {
                                const x = 50 + (i / (tendencias.length - 1)) * 810;
                                const y = 20 + (1 - t.cantidad / tendMaxCant) * 160;
                                return `${x},${y}`;
                              })
                              .join(" ")}
                          />
                          {/* Precio line */}
                          <polyline
                            fill="none"
                            stroke="#d4960c"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            points={tendencias
                              .map((t, i) => {
                                const x = 50 + (i / (tendencias.length - 1)) * 810;
                                const y =
                                  t.precioPromedio !== null
                                    ? 20 + (1 - t.precioPromedio / tendMaxPrecio) * 160
                                    : -1;
                                return `${x},${y}`;
                              })
                              .filter((_, i) => tendencias[i].precioPromedio !== null)
                              .join(" ")}
                          />
                        </>
                      )}

                      {/* Points & labels */}
                      {tendencias.map((t, i) => {
                        const x = 50 + (i / Math.max(tendencias.length - 1, 1)) * 810;
                        const y = 20 + (1 - t.cantidad / tendMaxCant) * 160;
                        return (
                          <g key={t.key}>
                            {t.cantidad > 0 && (
                              <>
                                <circle cx={x} cy={y} r={4} fill="#990000" />
                                <text
                                  x={x}
                                  y={y - 8}
                                  textAnchor="middle"
                                  fill="#ccc"
                                  fontSize={10}
                                  fontWeight={700}
                                >
                                  {t.cantidad}
                                </text>
                              </>
                            )}
                            <text
                              x={x}
                              y={200}
                              textAnchor="middle"
                              fill="#555"
                              fontSize={9}
                            >
                              {t.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Tabla tendencias */}
                <div
                  style={{
                    background: "var(--gfi-bg-secondary)",
                    border: "1px solid #222",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #222" }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        color: "#fff",
                        textTransform: "uppercase",
                      }}
                    >
                      Operaciones cerradas por mes
                    </h2>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Mes", "Cantidad", "Precio promedio", "Honorarios est."].map((h) => (
                            <th key={h} style={{ ...thStyle, cursor: "default" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...tendencias].reverse().map((t) => (
                          <tr
                            key={t.key}
                            style={{
                              background:
                                t.key === kpiTend.mejor?.key && t.cantidad > 0
                                  ? "rgba(245,158,11,0.06)"
                                  : "transparent",
                            }}
                          >
                            <td
                              style={{
                                ...tdStyle,
                                fontWeight:
                                  t.key === kpiTend.mejor?.key && t.cantidad > 0 ? 700 : 400,
                                color:
                                  t.key === kpiTend.mejor?.key && t.cantidad > 0 ? "#d4960c" : "#ccc",
                              }}
                            >
                              {t.label}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                color: t.cantidad > 0 ? "#3abab6" : "#555",
                                fontWeight: t.cantidad > 0 ? 600 : 400,
                              }}
                            >
                              {t.cantidad}
                            </td>
                            <td style={{ ...tdStyle, color: t.precioPromedio !== null ? "#fff" : "#555" }}>
                              {t.precioPromedio !== null ? fmtUSD(t.precioPromedio) : "—"}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                color: t.honorariosEst > 0 ? "#990000" : "#555",
                              }}
                            >
                              {t.honorariosEst > 0 ? fmtUSD(t.honorariosEst) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #222" }}>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--gfi-text-muted)",
                        fontSize: 12,
                        fontStyle: "italic",
                      }}
                    >
                      Los datos se basan en tu cartera y operaciones registradas en el CRM.
                      Para mayor precisión, cargá tus propiedades en Cartera.
                    </p>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
