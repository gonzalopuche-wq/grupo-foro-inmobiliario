"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Negocio {
  id: string;
  operacion: string | null;
  precio_anterior: number | null;
  precio: number | null;
  moneda: string | null;
  zona: string | null;
  tipo: string | null;
  updated_at: string | null;
  estado: string | null;
  ambientes: number | null;
}

interface Estadisticas {
  promedio: number;
  mediana: number;
  min: number;
  max: number;
  desviacion: number;
  count: number;
}

type Tab = "distribucion" | "por_zona" | "por_tipo";
type SortDir = "asc" | "desc";
type SortCol =
  | "tipo"
  | "zona"
  | "precio_publicado_usd"
  | "precio_cierre_usd"
  | "descuento_pct"
  | "updated_at";

// ── Helpers ───────────────────────────────────────────────────────────────────

function descuentoPct(n: Negocio): number {
  const pub = n.precio_anterior ?? 0;
  const cierre = n.precio ?? 0;
  if (pub === 0) return 0;
  return (1 - cierre / pub) * 100;
}

function toUSD(precio: number | null, moneda: string | null, tc: number): number {
  if (precio === null) return 0;
  return moneda === "ARS" ? precio / tc : precio;
}

function estadisticas(lista: number[]): Estadisticas {
  if (lista.length === 0) {
    return { promedio: 0, mediana: 0, min: 0, max: 0, desviacion: 0, count: 0 };
  }
  const sorted = [...lista].sort((a, b) => a - b);
  const count = lista.length;
  const promedio = lista.reduce((s, v) => s + v, 0) / count;
  const mid = Math.floor(sorted.length / 2);
  const mediana =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance =
    lista.reduce((s, v) => s + Math.pow(v - promedio, 2), 0) / count;
  const desviacion = Math.sqrt(variance);
  return { promedio, mediana, min, max, desviacion, count };
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "" : "+"}${(-n).toFixed(1)}%`;
}

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `USD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `USD ${(n / 1_000).toFixed(0)}K`;
  return `USD ${n.toFixed(0)}`;
}

function fmtFecha(f: string | null): string {
  if (!f) return "—";
  const [y, m, d] = f.substring(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// ── Rangos de distribución ────────────────────────────────────────────────────

interface Rango {
  label: string;
  min: number;
  max: number;
}

const RANGOS: Rango[] = [
  { label: "0–2%", min: 0, max: 2 },
  { label: "2–5%", min: 2, max: 5 },
  { label: "5–8%", min: 5, max: 8 },
  { label: "8–12%", min: 8, max: 12 },
  { label: "12–20%", min: 12, max: 20 },
  { label: ">20%", min: 20, max: Infinity },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function DescuentosPage() {
  const [data, setData] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroAnio, setFiltroAnio] = useState<string>("todos");
  const [tipoCambio, setTipoCambio] = useState<number>(1300);
  const [tcInput, setTcInput] = useState<string>("1300");

  // Tabs
  const [tab, setTab] = useState<Tab>("distribucion");

  // Tabla detalle
  const [sortCol, setSortCol] = useState<SortCol>("descuento_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: rows, error: err } = await supabase
        .from("cartera_propiedades")
        .select("id,operacion,precio_anterior,precio,moneda,zona,tipo,updated_at,estado,ambientes")
        .eq("perfil_id", user.id)
        .in("estado", ["vendida", "alquilada"])
        .not("precio_anterior", "is", null)
        .not("precio", "is", null);
      if (err) {
        setError(err.message);
      } else {
        setData((rows ?? []) as Negocio[]);
      }
      setLoading(false);
    })();
  }, []);

  // ── Años disponibles ───────────────────────────────────────────────────────

  const aniosDisponibles = useMemo(() => {
    const set = new Set<string>();
    data.forEach((n) => {
      if (n.updated_at) set.add(n.updated_at.substring(0, 4));
    });
    return Array.from(set).sort().reverse();
  }, [data]);

  // ── Datos filtrados ────────────────────────────────────────────────────────

  const filtrados = useMemo(() => {
    return data.filter((n) => {
      if (filtroTipo !== "todos" && n.tipo !== filtroTipo) return false;
      if (filtroAnio !== "todos") {
        if (!n.updated_at || !n.updated_at.startsWith(filtroAnio)) return false;
      }
      return true;
    });
  }, [data, filtroTipo, filtroAnio]);

  // ── Descuentos calculados ──────────────────────────────────────────────────

  const descuentos = useMemo(() => filtrados.map(descuentoPct), [filtrados]);

  const stats = useMemo(() => estadisticas(descuentos), [descuentos]);

  const sinDescuento = useMemo(
    () => filtrados.filter((n) => descuentoPct(n) <= 0).length,
    [filtrados]
  );

  const mayorDescuentoNegocio = useMemo(() => {
    if (filtrados.length === 0) return null;
    return filtrados.reduce<Negocio | null>((best, n) => {
      if (!best) return n;
      return descuentoPct(n) > descuentoPct(best) ? n : best;
    }, null);
  }, [filtrados]);

  // ── Distribución histograma ────────────────────────────────────────────────

  const distribucion = useMemo(() => {
    return RANGOS.map((rango) => {
      const count = filtrados.filter((n) => {
        const d = descuentoPct(n);
        return d >= rango.min && d < rango.max;
      }).length;
      return { ...rango, count };
    });
  }, [filtrados]);

  const maxDistCount = useMemo(
    () => Math.max(...distribucion.map((r) => r.count), 1),
    [distribucion]
  );

  // ── Por zona ───────────────────────────────────────────────────────────────

  const porZona = useMemo(() => {
    const mapa = new Map<
      string,
      { descuentos: number[]; pubUSDs: number[]; cierreUSDs: number[] }
    >();
    filtrados.forEach((n) => {
      const key = n.zona ?? "Sin barrio";
      if (!mapa.has(key)) mapa.set(key, { descuentos: [], pubUSDs: [], cierreUSDs: [] });
      const entry = mapa.get(key)!;
      entry.descuentos.push(descuentoPct(n));
      entry.pubUSDs.push(toUSD(n.precio_anterior, n.moneda, tipoCambio));
      entry.cierreUSDs.push(toUSD(n.precio, n.moneda, tipoCambio));
    });
    return Array.from(mapa.entries())
      .map(([barrio, v]) => {
        const st = estadisticas(v.descuentos);
        const promPub =
          v.pubUSDs.reduce((s, x) => s + x, 0) / v.pubUSDs.length;
        const promCierre =
          v.cierreUSDs.reduce((s, x) => s + x, 0) / v.cierreUSDs.length;
        return {
          barrio,
          count: st.count,
          descuento_promedio: st.promedio,
          descuento_mediana: st.mediana,
          precio_promedio_publicado_USD: promPub,
          precio_promedio_cierre_USD: promCierre,
        };
      })
      .sort((a, b) => b.descuento_promedio - a.descuento_promedio);
  }, [filtrados, tipoCambio]);

  const maxZonaDesc = useMemo(
    () => Math.max(...porZona.map((z) => z.descuento_promedio), 1),
    [porZona]
  );

  // ── Por tipo ───────────────────────────────────────────────────────────────

  const porTipo = useMemo(() => {
    const mapa = new Map<
      string,
      { descuentos: number[]; pubUSDs: number[]; cierreUSDs: number[] }
    >();
    filtrados.forEach((n) => {
      const key = n.tipo ?? "Sin tipo";
      if (!mapa.has(key)) mapa.set(key, { descuentos: [], pubUSDs: [], cierreUSDs: [] });
      const entry = mapa.get(key)!;
      entry.descuentos.push(descuentoPct(n));
      entry.pubUSDs.push(toUSD(n.precio_anterior, n.moneda, tipoCambio));
      entry.cierreUSDs.push(toUSD(n.precio, n.moneda, tipoCambio));
    });
    return Array.from(mapa.entries())
      .map(([tipo, v]) => {
        const st = estadisticas(v.descuentos);
        const promPub =
          v.pubUSDs.reduce((s, x) => s + x, 0) / v.pubUSDs.length;
        const promCierre =
          v.cierreUSDs.reduce((s, x) => s + x, 0) / v.cierreUSDs.length;
        return {
          tipo,
          count: st.count,
          descuento_promedio: st.promedio,
          descuento_mediana: st.mediana,
          precio_promedio_publicado_USD: promPub,
          precio_promedio_cierre_USD: promCierre,
        };
      })
      .sort((a, b) => b.descuento_promedio - a.descuento_promedio);
  }, [filtrados, tipoCambio]);

  const maxTipoDesc = useMemo(
    () => Math.max(...porTipo.map((t) => t.descuento_promedio), 1),
    [porTipo]
  );

  // ── Tabla detalle ──────────────────────────────────────────────────────────

  const handleSort = useCallback(
    (col: SortCol) => {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir("desc");
      }
    },
    [sortCol]
  );

  const tablaDetalle = useMemo(() => {
    const rows = filtrados.map((n) => ({
      id: n.id,
      tipo: n.tipo ?? "—",
      zona: n.zona ?? "—",
      precio_publicado_usd: toUSD(n.precio_anterior, n.moneda, tipoCambio),
      precio_cierre_usd: toUSD(n.precio, n.moneda, tipoCambio),
      descuento_pct: descuentoPct(n),
      updated_at: n.updated_at ?? "",
    }));

    return [...rows].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtrados, sortCol, sortDir, tipoCambio]);

  // ── Tipos disponibles ──────────────────────────────────────────────────────

  const tiposDisponibles = useMemo(() => {
    const set = new Set(data.map((n) => n.tipo).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [data]);

  // ── Estilos base ───────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#fff",
    padding: "6px 10px",
    fontSize: 12,
    fontFamily: "Inter, sans-serif",
    outline: "none",
  };

  const cardStyle: React.CSSProperties = {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 10,
    padding: "20px 24px",
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    textAlign: "left",
    fontSize: 10,
    color: "#666",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    textTransform: "uppercase",
    borderBottom: "1px solid #222",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 12,
    color: "#ccc",
    borderBottom: "1px solid #1a1a1a",
    whiteSpace: "nowrap",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  function SortIndicator({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span style={{ color: "#444", marginLeft: 4 }}>↕</span>;
    return (
      <span style={{ color: "#cc0000", marginLeft: 4 }}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  function TabGroupRow({
    rows,
    keyField,
    maxDesc,
  }: {
    rows: {
      [k: string]: string | number;
      count: number;
      descuento_promedio: number;
      descuento_mediana: number;
      precio_promedio_publicado_USD: number;
      precio_promedio_cierre_USD: number;
    }[];
    keyField: string;
    maxDesc: number;
  }) {
    if (rows.length === 0) {
      return (
        <div style={{ color: "#555", textAlign: "center", padding: 32, fontSize: 13 }}>
          Sin datos suficientes
        </div>
      );
    }
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Nombre", "Ops.", "Desc. Prom.", "Desc. Mediana", "Pub. Prom. USD", "Cierre Prom. USD"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      ...thStyle,
                      cursor: "default",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pct = maxDesc > 0 ? (row.descuento_promedio / maxDesc) * 100 : 0;
              return (
                <tr key={String(row[keyField])}>
                  <td style={{ ...tdStyle, position: "relative", minWidth: 140 }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `rgba(204,0,0,${Math.max(0, Math.min(0.25, pct / 100 * 0.25))}`,
                        borderRadius: 0,
                        width: `${pct}%`,
                      }}
                    />
                    <span style={{ position: "relative", zIndex: 1 }}>
                      {String(row[keyField])}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{row.count}</td>
                  <td
                    style={{
                      ...tdStyle,
                      color:
                        row.descuento_promedio > 10
                          ? "#cc0000"
                          : row.descuento_promedio > 5
                          ? "#f59e0b"
                          : "#22c55e",
                      fontWeight: 700,
                    }}
                  >
                    {row.descuento_promedio.toFixed(1)}%
                  </td>
                  <td style={{ ...tdStyle, color: "#aaa" }}>
                    {row.descuento_mediana.toFixed(1)}%
                  </td>
                  <td style={{ ...tdStyle, color: "#888" }}>
                    {fmtUSD(row.precio_promedio_publicado_USD)}
                  </td>
                  <td style={{ ...tdStyle, color: "#888" }}>
                    {fmtUSD(row.precio_promedio_cierre_USD)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: "#111",
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
              fontSize: 20,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
            }}
          >
            Análisis de Descuentos
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Precio pedido vs. precio de cierre en operaciones cerradas
          </p>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={inputStyle}
          >
            <option value="todos">Todos los tipos</option>
            {tiposDisponibles.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(e.target.value)}
            style={inputStyle}
          >
            <option value="todos">Todos los años</option>
            {aniosDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#666" }}>TC ARS/USD</span>
            <input
              type="number"
              value={tcInput}
              onChange={(e) => {
                setTcInput(e.target.value);
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) setTipoCambio(v);
              }}
              style={{ ...inputStyle, width: 80, textAlign: "right" }}
              min={1}
            />
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {loading ? (
          <div
            style={{
              textAlign: "center",
              color: "#666",
              padding: 64,
              fontSize: 14,
            }}
          >
            Cargando datos...
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: "center",
              color: "#cc0000",
              padding: 64,
              fontSize: 14,
            }}
          >
            Error al cargar: {error}
          </div>
        ) : filtrados.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#555",
              padding: 64,
              fontSize: 14,
            }}
          >
            No hay operaciones cerradas con precios registrados para el filtro seleccionado.
          </div>
        ) : (
          <>
            {/* ── KPI Cards ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {/* Descuento promedio */}
              <div
                style={{
                  ...cardStyle,
                  border: "1px solid rgba(204,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#888",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Descuento promedio
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    fontFamily: "Montserrat, sans-serif",
                    color: "#cc0000",
                    lineHeight: 1,
                  }}
                >
                  {stats.promedio.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                  σ = {stats.desviacion.toFixed(1)}% · {stats.count} ops.
                </div>
              </div>

              {/* Mediana */}
              <div
                style={{
                  ...cardStyle,
                  border: "1px solid rgba(204,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#888",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Mediana
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    fontFamily: "Montserrat, sans-serif",
                    color: "#cc0000",
                    lineHeight: 1,
                  }}
                >
                  {stats.mediana.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                  Rango: {stats.min.toFixed(1)}% – {stats.max.toFixed(1)}%
                </div>
              </div>

              {/* Mayor descuento */}
              <div
                style={{
                  ...cardStyle,
                  border: "1px solid rgba(204,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#888",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Mayor descuento
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    fontFamily: "Montserrat, sans-serif",
                    color: "#cc0000",
                    lineHeight: 1,
                  }}
                >
                  {stats.max.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                  {mayorDescuentoNegocio
                    ? `${fmtUSD(toUSD(mayorDescuentoNegocio.precio_anterior, mayorDescuentoNegocio.moneda, tipoCambio))} → ${fmtUSD(toUSD(mayorDescuentoNegocio.precio, mayorDescuentoNegocio.moneda, tipoCambio))}`
                    : "—"}
                </div>
              </div>

              {/* Sin descuento / con premio */}
              <div
                style={{
                  ...cardStyle,
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#888",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Sin descuento / con premio
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    fontFamily: "Montserrat, sans-serif",
                    color: "#22c55e",
                    lineHeight: 1,
                  }}
                >
                  {sinDescuento}
                </div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                  {stats.count > 0
                    ? `${((sinDescuento / stats.count) * 100).toFixed(0)}% cerraron al precio o más`
                    : "—"}
                </div>
              </div>
            </div>

            {/* ── Tabs ── */}
            <div style={cardStyle}>
              {/* Tab buttons */}
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  marginBottom: 24,
                  borderBottom: "1px solid #222",
                }}
              >
                {(
                  [
                    { key: "distribucion", label: "Distribución" },
                    { key: "por_zona", label: "Por Zona" },
                    { key: "por_tipo", label: "Por Tipo" },
                  ] as { key: Tab; label: string }[]
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom: tab === t.key ? "2px solid #cc0000" : "2px solid transparent",
                      color: tab === t.key ? "#fff" : "#666",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 12,
                      padding: "10px 18px",
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      transition: "color 0.15s",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab: Distribución */}
              {tab === "distribucion" && (
                <div>
                  <h2
                    style={{
                      margin: "0 0 20px",
                      fontSize: 13,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: "#fff",
                    }}
                  >
                    Histograma de descuentos
                  </h2>
                  <svg
                    viewBox="0 0 600 300"
                    style={{ width: "100%", maxWidth: 600, display: "block" }}
                    aria-label="Histograma de distribución de descuentos"
                  >
                    {/* Grid lines verticales */}
                    {[0, 25, 50, 75, 100].map((pct) => {
                      const x = 80 + (pct / 100) * 460;
                      return (
                        <g key={pct}>
                          <line
                            x1={x}
                            y1={10}
                            x2={x}
                            y2={270}
                            stroke="#1e1e1e"
                            strokeWidth={1}
                          />
                          <text
                            x={x}
                            y={285}
                            textAnchor="middle"
                            fill="#444"
                            fontSize={9}
                            fontFamily="Inter, sans-serif"
                          >
                            {Math.round((pct / 100) * maxDistCount)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Barras */}
                    {distribucion.map((rango, i) => {
                      const barH = 30;
                      const gap = 12;
                      const y = 20 + i * (barH + gap);
                      const barW =
                        maxDistCount > 0
                          ? (rango.count / maxDistCount) * 460
                          : 0;
                      const pctTotal =
                        stats.count > 0
                          ? ((rango.count / stats.count) * 100).toFixed(0)
                          : "0";

                      return (
                        <g key={rango.label}>
                          {/* Label */}
                          <text
                            x={75}
                            y={y + barH / 2 + 4}
                            textAnchor="end"
                            fill="#888"
                            fontSize={11}
                            fontFamily="Inter, sans-serif"
                          >
                            {rango.label}
                          </text>

                          {/* Fondo barra */}
                          <rect
                            x={80}
                            y={y}
                            width={460}
                            height={barH}
                            fill="#1a1a1a"
                            rx={4}
                          />

                          {/* Barra roja */}
                          {rango.count > 0 && (
                            <rect
                              x={80}
                              y={y}
                              width={barW}
                              height={barH}
                              fill="#cc0000"
                              rx={4}
                            />
                          )}

                          {/* Count + % */}
                          <text
                            x={80 + barW + 8}
                            y={y + barH / 2 + 4}
                            fill={rango.count === 0 ? "#444" : "#ccc"}
                            fontSize={11}
                            fontFamily="Inter, sans-serif"
                            fontWeight={rango.count > 0 ? "600" : "400"}
                          >
                            {rango.count > 0
                              ? `${rango.count} (${pctTotal}%)`
                              : "0"}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {/* Tab: Por Zona */}
              {tab === "por_zona" && (
                <div>
                  <h2
                    style={{
                      margin: "0 0 16px",
                      fontSize: 13,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Descuentos por barrio
                  </h2>
                  <TabGroupRow
                    rows={porZona}
                    keyField="zona"
                    maxDesc={maxZonaDesc}
                  />
                </div>
              )}

              {/* Tab: Por Tipo */}
              {tab === "por_tipo" && (
                <div>
                  <h2
                    style={{
                      margin: "0 0 16px",
                      fontSize: 13,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Descuentos por tipo de propiedad
                  </h2>
                  <TabGroupRow
                    rows={porTipo}
                    keyField="tipo"
                    maxDesc={maxTipoDesc}
                  />
                </div>
              )}
            </div>

            {/* ── Tabla detalle ── */}
            <div style={cardStyle}>
              <h2
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                Detalle de operaciones ({tablaDetalle.length})
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th
                        style={thStyle}
                        onClick={() => handleSort("tipo")}
                      >
                        Tipo <SortIndicator col="tipo" />
                      </th>
                      <th style={thStyle} onClick={() => handleSort("zona")}>
                        Zona <SortIndicator col="zona" />
                      </th>
                      <th
                        style={{ ...thStyle, textAlign: "right" }}
                        onClick={() => handleSort("precio_publicado_usd")}
                      >
                        Publicado USD <SortIndicator col="precio_publicado_usd" />
                      </th>
                      <th
                        style={{ ...thStyle, textAlign: "right" }}
                        onClick={() => handleSort("precio_cierre_usd")}
                      >
                        Cierre USD <SortIndicator col="precio_cierre_usd" />
                      </th>
                      <th
                        style={{ ...thStyle, textAlign: "right" }}
                        onClick={() => handleSort("descuento_pct")}
                      >
                        Descuento % <SortIndicator col="descuento_pct" />
                      </th>
                      <th
                        style={thStyle}
                        onClick={() => handleSort("updated_at")}
                      >
                        Fecha <SortIndicator col="updated_at" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tablaDetalle.map((row) => {
                      const esGranDesc = row.descuento_pct > 10;
                      const esPremio = row.descuento_pct < 0;
                      return (
                        <tr
                          key={row.id}
                          style={{
                            background: esGranDesc
                              ? "rgba(204,0,0,0.07)"
                              : esPremio
                              ? "rgba(34,197,94,0.05)"
                              : "transparent",
                          }}
                        >
                          <td style={tdStyle}>{row.tipo}</td>
                          <td style={tdStyle}>{row.zona}</td>
                          <td style={{ ...tdStyle, textAlign: "right", color: "#888" }}>
                            {fmtUSD(row.precio_publicado_usd)}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", color: "#888" }}>
                            {fmtUSD(row.precio_cierre_usd)}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "right",
                              fontWeight: 700,
                              color:
                                row.descuento_pct > 10
                                  ? "#cc0000"
                                  : row.descuento_pct > 5
                                  ? "#f59e0b"
                                  : row.descuento_pct < 0
                                  ? "#22c55e"
                                  : "#aaa",
                            }}
                          >
                            {row.descuento_pct <= 0
                              ? `+${Math.abs(row.descuento_pct).toFixed(1)}% premio`
                              : `${row.descuento_pct.toFixed(1)}%`}
                          </td>
                          <td style={{ ...tdStyle, color: "#666" }}>
                            {fmtFecha(row.updated_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
