"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Propiedad {
  id: string;
  tipo: string | null;
  operacion: string | null;
  barrio: string | null;
  precio: number | null;
  moneda: string | null;
  superficie_cubierta: number | null;
  ambientes: number | null;
  estado: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  created_at: string;
}

type TabId = "zona" | "tipo" | "precio" | "historico";
type SortKey = "barrio" | "count" | "promedio" | "mediana" | "precioPromedio";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOY = new Date();

function diasEnMercado(p: Propiedad): number {
  const inicio = p.fecha_publicacion ?? p.created_at;
  const fin = p.fecha_cierre ?? HOY.toISOString();
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function promedio(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
}

function mediana(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function velocidadMercado(prom: number): { label: string; color: string } {
  if (prom < 30) return { label: "Mercado rápido", color: "#22c55e" };
  if (prom < 60) return { label: "Normal", color: "#f59e0b" };
  if (prom < 90) return { label: "Lento", color: "#f97316" };
  return { label: "Muy lento", color: "#cc0000" };
}

function rangoLabel(precio: number): string {
  if (precio < 100000) return "0 – 100k";
  if (precio < 200000) return "100k – 200k";
  if (precio < 300000) return "200k – 300k";
  if (precio < 500000) return "300k – 500k";
  return "500k+";
}

function rangoOrden(label: string): number {
  const mapa: Record<string, number> = {
    "0 – 100k": 0,
    "100k – 200k": 1,
    "200k – 300k": 2,
    "300k – 500k": 3,
    "500k+": 4,
  };
  return mapa[label] ?? 99;
}

const fmtNum = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

// ── Estilos reutilizables ─────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 10,
  padding: "16px 18px",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "Montserrat,sans-serif",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)",
};

const selectStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 5,
  color: "rgba(255,255,255,0.55)",
  fontSize: 11,
  padding: "5px 10px",
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  fontFamily: "Montserrat,sans-serif",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.35)",
  padding: "6px 10px",
  textAlign: "left",
  cursor: "pointer",
  userSelect: "none",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.8)",
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

// ── Grupos derivados ──────────────────────────────────────────────────────────

interface GrupoBarrio {
  barrio: string;
  count: number;
  promedio: number;
  mediana: number;
  precioPromedio: number;
  dias: number[];
}

interface GrupoTipo {
  tipo: string;
  count: number;
  promedio: number;
  mediana: number;
  dias: number[];
}

interface GrupoRango {
  rango: string;
  orden: number;
  count: number;
  promedio: number;
  mediana: number;
}

interface GrupoAmbientes {
  ambientes: string;
  count: number;
  promedio: number;
  mediana: number;
}

interface PuntoScatter {
  precio: number;
  dias: number;
  tipo: string;
}

interface MesHistorico {
  mes: string; // "YYYY-MM"
  label: string;
  promedio: number;
  count: number;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TiempoVenta() {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("zona");

  // Configuración
  const [tipoCambio, setTipoCambio] = useState<number>(1300);
  const [filtroOperacion, setFiltroOperacion] = useState<"todos" | "venta" | "alquiler">("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroAño, setFiltroAño] = useState<number>(2026);

  // Tabla detalle sort
  const [sortKey, setSortKey] = useState<"tipo" | "barrio" | "precio" | "dias" | "estado">("dias");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Barrio sort
  const [sortBarrio, setSortBarrio] = useState<SortKey>("promedio");
  const [sortBarrioDir, setSortBarrioDir] = useState<SortDir>("asc");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("cartera_propiedades")
        .select(
          "id,tipo,operacion,barrio,precio,moneda,superficie_cubierta,ambientes,estado,fecha_publicacion,fecha_cierre,created_at"
        )
        .in("estado", ["vendido", "alquilado", "activo"])
        .order("created_at", { ascending: false })
        .limit(500);
      setPropiedades((data ?? []) as Propiedad[]);
      setLoading(false);
    }
    load();
  }, []);

  // ── Tipos únicos para filtro ────────────────────────────────────────────────
  const tiposUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const p of propiedades) {
      if (p.tipo) set.add(p.tipo);
    }
    return Array.from(set).sort();
  }, [propiedades]);

  // ── Año actual disponibles ──────────────────────────────────────────────────
  const añosDisponibles = useMemo(() => {
    const set = new Set<number>();
    for (const p of propiedades) {
      const y = new Date(p.created_at).getFullYear();
      set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [propiedades]);

  // ── Normalizar precio a USD ─────────────────────────────────────────────────
  function precioUSD(p: Propiedad): number {
    if (!p.precio) return 0;
    if (p.moneda === "ARS" || p.moneda === "pesos") return Math.round(p.precio / tipoCambio);
    return p.precio;
  }

  // ── Filtrado base ───────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return propiedades.filter((p) => {
      if (filtroOperacion !== "todos" && p.operacion !== filtroOperacion) return false;
      if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
      const año = new Date(p.created_at).getFullYear();
      if (año !== filtroAño) return false;
      return true;
    });
  }, [propiedades, filtroOperacion, filtroTipo, filtroAño]);

  // Solo cerradas (para estadísticas de tiempo)
  const cerradas = useMemo(
    () => filtradas.filter((p) => p.estado === "vendido" || p.estado === "alquilado"),
    [filtradas]
  );

  const activas = useMemo(() => filtradas.filter((p) => p.estado === "activo"), [filtradas]);

  // ── KPIs globales ───────────────────────────────────────────────────────────
  const { tiempoPromedioGlobal, tiempoMediana, pctMenos30, velocidad } = useMemo(() => {
    const dias = cerradas.map(diasEnMercado);
    const prom = promedio(dias);
    const med = mediana(dias);
    const pct =
      dias.length > 0
        ? Math.round((dias.filter((d) => d < 30).length / dias.length) * 100)
        : 0;
    return {
      tiempoPromedioGlobal: prom,
      tiempoMediana: med,
      pctMenos30: pct,
      velocidad: velocidadMercado(prom),
    };
  }, [cerradas]);

  // ── Por barrio ──────────────────────────────────────────────────────────────
  const porBarrio = useMemo<GrupoBarrio[]>(() => {
    const mapa: Record<string, { dias: number[]; precios: number[] }> = {};
    for (const p of cerradas) {
      const b = p.barrio ?? "Sin barrio";
      if (!mapa[b]) mapa[b] = { dias: [], precios: [] };
      mapa[b].dias.push(diasEnMercado(p));
      const usd = precioUSD(p);
      if (usd > 0) mapa[b].precios.push(usd);
    }
    const grupos: GrupoBarrio[] = Object.entries(mapa).map(([barrio, { dias, precios }]) => ({
      barrio,
      count: dias.length,
      promedio: promedio(dias),
      mediana: mediana(dias),
      precioPromedio: precios.length > 0 ? Math.round(precios.reduce((s, v) => s + v, 0) / precios.length) : 0,
      dias,
    }));
    return grupos.sort((a, b) => {
      const dir = sortBarrioDir === "asc" ? 1 : -1;
      if (sortBarrio === "barrio") return dir * a.barrio.localeCompare(b.barrio);
      if (sortBarrio === "count") return dir * (a.count - b.count);
      if (sortBarrio === "promedio") return dir * (a.promedio - b.promedio);
      if (sortBarrio === "mediana") return dir * (a.mediana - b.mediana);
      if (sortBarrio === "precioPromedio") return dir * (a.precioPromedio - b.precioPromedio);
      return 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerradas, sortBarrio, sortBarrioDir, tipoCambio]);

  // Top 10 barrios por count para chart
  const top10Barrios = useMemo(
    () => [...porBarrio].sort((a, b) => b.count - a.count).slice(0, 10),
    [porBarrio]
  );

  // ── Por tipo ────────────────────────────────────────────────────────────────
  const porTipo = useMemo<GrupoTipo[]>(() => {
    const mapa: Record<string, number[]> = {};
    for (const p of cerradas) {
      const t = p.tipo ?? "Sin tipo";
      if (!mapa[t]) mapa[t] = [];
      mapa[t].push(diasEnMercado(p));
    }
    return Object.entries(mapa)
      .map(([tipo, dias]) => ({ tipo, count: dias.length, promedio: promedio(dias), mediana: mediana(dias), dias }))
      .sort((a, b) => a.promedio - b.promedio);
  }, [cerradas]);

  const maxPromedioTipo = useMemo(() => Math.max(...porTipo.map((g) => g.promedio), 1), [porTipo]);

  // ── Por rango de precio ──────────────────────────────────────────────────────
  const porRango = useMemo<GrupoRango[]>(() => {
    const mapa: Record<string, number[]> = {};
    for (const p of cerradas) {
      const usd = precioUSD(p);
      if (usd === 0) continue;
      const rango = rangoLabel(usd);
      if (!mapa[rango]) mapa[rango] = [];
      mapa[rango].push(diasEnMercado(p));
    }
    return Object.entries(mapa)
      .map(([rango, dias]) => ({
        rango,
        orden: rangoOrden(rango),
        count: dias.length,
        promedio: promedio(dias),
        mediana: mediana(dias),
      }))
      .sort((a, b) => a.orden - b.orden);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerradas, tipoCambio]);

  // Scatter plot data
  const scatterData = useMemo<PuntoScatter[]>(() => {
    return cerradas
      .map((p) => ({ precio: precioUSD(p), dias: diasEnMercado(p), tipo: p.tipo ?? "otro" }))
      .filter((d) => d.precio > 0 && d.dias >= 0)
      .slice(0, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerradas, tipoCambio]);

  // ── Por ambientes ────────────────────────────────────────────────────────────
  const porAmbientes = useMemo<GrupoAmbientes[]>(() => {
    const mapa: Record<string, number[]> = {};
    for (const p of cerradas) {
      const amb = p.ambientes == null ? "?" : p.ambientes >= 5 ? "5+" : String(p.ambientes);
      if (!mapa[amb]) mapa[amb] = [];
      mapa[amb].push(diasEnMercado(p));
    }
    const orden = ["1", "2", "3", "4", "5+", "?"];
    return Object.entries(mapa)
      .map(([ambientes, dias]) => ({ ambientes, count: dias.length, promedio: promedio(dias), mediana: mediana(dias) }))
      .sort((a, b) => orden.indexOf(a.ambientes) - orden.indexOf(b.ambientes));
  }, [cerradas]);

  // ── Histórico mensual ────────────────────────────────────────────────────────
  const historico = useMemo<MesHistorico[]>(() => {
    const mapa: Record<string, number[]> = {};
    for (const p of cerradas) {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(diasEnMercado(p));
    }
    return Object.entries(mapa)
      .map(([mes, dias]) => {
        const [y, m] = mes.split("-");
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return {
          mes,
          label: `${monthNames[parseInt(m) - 1]} ${y}`,
          promedio: promedio(dias),
          count: dias.length,
        };
      })
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-12);
  }, [cerradas]);

  // ── Tabla detalle filtrada y ordenada ────────────────────────────────────────
  const tablaDetalle = useMemo(() => {
    const lista = filtradas.map((p) => ({
      ...p,
      dias: diasEnMercado(p),
      precioUSD: precioUSD(p),
    }));
    return lista.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "tipo") return dir * (a.tipo ?? "").localeCompare(b.tipo ?? "");
      if (sortKey === "barrio") return dir * (a.barrio ?? "").localeCompare(b.barrio ?? "");
      if (sortKey === "precio") return dir * (a.precioUSD - b.precioUSD);
      if (sortKey === "dias") return dir * (a.dias - b.dias);
      if (sortKey === "estado") return dir * (a.estado ?? "").localeCompare(b.estado ?? "");
      return 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, sortKey, sortDir, tipoCambio]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function toggleSortBarrio(key: SortKey) {
    if (sortBarrio === key) setSortBarrioDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBarrio(key); setSortBarrioDir("asc"); }
  }

  function sortArrow(key: string, current: string, dir: SortDir) {
    if (key !== current) return " ↕";
    return dir === "asc" ? " ↑" : " ↓";
  }

  // ── SVG helpers ──────────────────────────────────────────────────────────────

  function barChart(data: { label: string; value: number; color?: string }[], width: number, rowH: number) {
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const leftW = 100;
    const rightW = width - leftW - 60;
    const height = data.length * rowH + 20;
    return (
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        {data.map((d, i) => {
          const barW = Math.max(2, (d.value / maxVal) * rightW);
          const y = i * rowH + 10;
          const col = d.color ?? "#cc0000";
          return (
            <g key={d.label}>
              <text x={leftW - 6} y={y + rowH / 2 + 4} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.6)" fontFamily="Inter,sans-serif">
                {d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}
              </text>
              <rect x={leftW} y={y + 2} width={barW} height={rowH - 6} rx={3} fill={col} opacity={0.75} />
              <text x={leftW + barW + 5} y={y + rowH / 2 + 4} fontSize={10} fill="rgba(255,255,255,0.5)" fontFamily="Montserrat,sans-serif" fontWeight={700}>
                {fmtNum(d.value)}d
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  function lineChart(data: MesHistorico[], width: number, height: number) {
    if (data.length < 2) return null;
    const maxV = Math.max(...data.map((d) => d.promedio), 1);
    const padL = 40;
    const padB = 30;
    const padT = 10;
    const innerW = width - padL;
    const innerH = height - padB - padT;
    const pts = data.map((d, i) => ({
      x: padL + (i / (data.length - 1)) * innerW,
      y: padT + innerH - (d.promedio / maxV) * innerH,
      d,
    }));
    const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;
    return (
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = padT + innerH * (1 - r);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif">
                {Math.round(maxV * r)}
              </text>
            </g>
          );
        })}
        {/* Area */}
        <path d={areaD} fill="rgba(204,0,0,0.12)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#cc0000" strokeWidth={2} />
        {/* Dots + labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="#cc0000" />
            <text x={p.x} y={padT + innerH + 18} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)" fontFamily="Inter,sans-serif" transform={`rotate(-30,${p.x},${padT + innerH + 18})`}>
              {p.d.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  function scatterPlot(data: PuntoScatter[], width: number, height: number) {
    if (data.length === 0) return null;
    const maxPrecio = Math.max(...data.map((d) => d.precio), 1);
    const maxDias = Math.max(...data.map((d) => d.dias), 1);
    const padL = 50;
    const padB = 30;
    const padT = 10;
    const innerW = width - padL - 10;
    const innerH = height - padB - padT;
    return (
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        {/* Y labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = padT + innerH * (1 - r);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif">
                {Math.round(maxDias * r)}d
              </text>
            </g>
          );
        })}
        {/* X labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const x = padL + innerW * r;
          const val = Math.round(maxPrecio * r);
          return (
            <text key={i} x={x} y={padT + innerH + 18} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif">
              {val >= 1000 ? `${Math.round(val / 1000)}k` : val}
            </text>
          );
        })}
        {/* Points */}
        {data.map((d, i) => {
          const cx = padL + (d.precio / maxPrecio) * innerW;
          const cy = padT + innerH - (d.dias / maxDias) * innerH;
          return <circle key={i} cx={cx} cy={cy} r={3} fill="rgba(204,0,0,0.55)" stroke="rgba(204,0,0,0.2)" strokeWidth={0.5} />;
        })}
        {/* Axis labels */}
        <text x={padL + innerW / 2} y={height - 2} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif">Precio USD</text>
        <text x={10} y={padT + innerH / 2} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)" fontFamily="Inter,sans-serif" transform={`rotate(-90,10,${padT + innerH / 2})`}>Días</text>
      </svg>
    );
  }

  // ── Color para fondo de fila por tiempo ─────────────────────────────────────
  function bgPorDias(dias: number): string {
    if (dias > 90) return "rgba(204,0,0,0.12)";
    if (dias > 60) return "rgba(249,115,22,0.08)";
    if (dias > 30) return "rgba(245,158,11,0.06)";
    return "transparent";
  }

  // ── Barra de color para tiempo (verde=rápido, rojo=lento) ──────────────────
  function colorPorDias(dias: number): string {
    if (dias < 30) return "#22c55e";
    if (dias < 60) return "#f59e0b";
    if (dias < 90) return "#f97316";
    return "#cc0000";
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", fontSize: 14 }}>
          Calculando tiempos en mercado…
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px", maxWidth: 1300, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, margin: 0 }}>Tiempo en Mercado</h1>
        <span style={{ background: "#cc0000", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>ANÁLISIS</span>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 22 }}>
        ¿Cuánto tardan las propiedades en venderse o alquilarse? — {filtradas.length} propiedades analizadas
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filtroAño} onChange={(e) => setFiltroAño(Number(e.target.value))} style={selectStyle}>
          {añosDisponibles.length > 0
            ? añosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)
            : <option value={2026}>2026</option>}
        </select>
        <select value={filtroOperacion} onChange={(e) => setFiltroOperacion(e.target.value as typeof filtroOperacion)} style={selectStyle}>
          <option value="todos">Venta y Alquiler</option>
          <option value="venta">Solo Venta</option>
          <option value="alquiler">Solo Alquiler</option>
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={selectStyle}>
          <option value="todos">Todos los tipos</option>
          {tiposUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <span style={{ ...labelStyle, fontSize: 10 }}>TC: $</span>
          <input
            type="number"
            value={tipoCambio}
            onChange={(e) => setTipoCambio(Number(e.target.value))}
            style={{ ...selectStyle, width: 80, textAlign: "right" }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>ARS/USD</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
        {[
          {
            label: "Días promedio",
            val: cerradas.length > 0 ? `${fmtNum(tiempoPromedioGlobal)} días` : "—",
            sub: `${cerradas.length} propiedades cerradas`,
            color: colorPorDias(tiempoPromedioGlobal),
          },
          {
            label: "Mediana de días",
            val: cerradas.length > 0 ? `${fmtNum(tiempoMediana)} días` : "—",
            sub: "Valor central (sin outliers)",
            color: colorPorDias(tiempoMediana),
          },
          {
            label: "Vendidas < 30 días",
            val: cerradas.length > 0 ? `${pctMenos30}%` : "—",
            sub: "Cierres rápidos",
            color: pctMenos30 > 50 ? "#22c55e" : pctMenos30 > 25 ? "#f59e0b" : "#cc0000",
          },
          {
            label: "Activas en mercado",
            val: fmtNum(activas.length),
            sub: "Sin cerrar todavía",
            color: "#3b82f6",
          },
        ].map((k, i) => (
          <div key={i} style={{ ...card, textAlign: "center", padding: "18px 14px" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.val}</div>
            <div style={{ ...labelStyle, marginTop: 8, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Badge de velocidad */}
      {cerradas.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "10px 16px", background: `${velocidad.color}18`, border: `1px solid ${velocidad.color}40`, borderRadius: 8, width: "fit-content" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: velocidad.color }} />
          <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: velocidad.color }}>{velocidad.label}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>— promedio de {fmtNum(tiempoPromedioGlobal)} días en mercado</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 0 }}>
        {([
          { id: "zona" as TabId, label: "Por Zona" },
          { id: "tipo" as TabId, label: "Por Tipo" },
          { id: "precio" as TabId, label: "Por Precio" },
          { id: "historico" as TabId, label: "Histórico" },
        ] as { id: TabId; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: tab === t.id ? "2px solid #cc0000" : "2px solid transparent",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.4)",
              fontFamily: "Montserrat,sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "8px 16px",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Por Zona */}
      {tab === "zona" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, marginBottom: 24 }}>
          {/* Tabla barrios */}
          <div style={card}>
            <div style={{ ...labelStyle, marginBottom: 14 }}>Tiempo por barrio — {porBarrio.length} zonas</div>
            {porBarrio.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin datos</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {[
                        { key: "barrio" as SortKey, label: "Barrio" },
                        { key: "count" as SortKey, label: "Ops." },
                        { key: "promedio" as SortKey, label: "Prom. días" },
                        { key: "mediana" as SortKey, label: "Mediana" },
                        { key: "precioPromedio" as SortKey, label: "Precio prom. USD" },
                      ].map((col) => (
                        <th key={col.key} style={thStyle} onClick={() => toggleSortBarrio(col.key)}>
                          {col.label}{sortArrow(col.key, sortBarrio, sortBarrioDir)}
                        </th>
                      ))}
                      <th style={thStyle}>Velocidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porBarrio.map((g) => {
                      const vel = velocidadMercado(g.promedio);
                      return (
                        <tr key={g.barrio} style={{ background: `${colorPorDias(g.promedio)}08` }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{g.barrio}</td>
                          <td style={{ ...tdStyle, textAlign: "center", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{g.count}</td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
                                <div style={{ height: "100%", width: `${Math.min(100, (g.promedio / 120) * 100)}%`, background: colorPorDias(g.promedio), borderRadius: 3 }} />
                              </div>
                              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: colorPorDias(g.promedio), minWidth: 32 }}>{g.promedio}d</span>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{g.mediana}d</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{g.precioPromedio > 0 ? `USD ${fmtNum(g.precioPromedio)}` : "—"}</td>
                          <td style={{ ...tdStyle }}>
                            <span style={{ background: `${vel.color}20`, color: vel.color, fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>
                              {vel.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bar chart top 10 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={card}>
              <div style={{ ...labelStyle, marginBottom: 14 }}>Top 10 zonas por operaciones</div>
              {top10Barrios.length > 0
                ? barChart(top10Barrios.map((b) => ({ label: b.barrio, value: b.promedio, color: colorPorDias(b.promedio) })), 320, 24)
                : <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Sin datos</div>}
            </div>
            {porAmbientes.length > 0 && (
              <div style={card}>
                <div style={{ ...labelStyle, marginBottom: 14 }}>Por ambientes</div>
                {porAmbientes.map((g) => (
                  <div key={g.ambientes} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 28, textAlign: "center", fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{g.ambientes}</div>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (g.promedio / 120) * 100)}%`, background: colorPorDias(g.promedio), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: colorPorDias(g.promedio), minWidth: 36, textAlign: "right" }}>{g.promedio}d</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", minWidth: 24 }}>({g.count})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Por Tipo */}
      {tab === "tipo" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, marginBottom: 24 }}>
          <div style={card}>
            <div style={{ ...labelStyle, marginBottom: 14 }}>Tiempo por tipo de propiedad</div>
            {porTipo.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin datos</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Tipo</th>
                      <th style={thStyle}>Operaciones</th>
                      <th style={thStyle}>Días promedio</th>
                      <th style={thStyle}>Mediana</th>
                      <th style={thStyle}>Velocidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porTipo.map((g) => {
                      const vel = velocidadMercado(g.promedio);
                      const pct = Math.round((g.promedio / maxPromedioTipo) * 100);
                      return (
                        <tr key={g.tipo}>
                          <td style={{ ...tdStyle, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "capitalize" }}>{g.tipo}</td>
                          <td style={{ ...tdStyle, textAlign: "center", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{g.count}</td>
                          <td style={{ ...tdStyle }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden", minWidth: 80 }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: colorPorDias(g.promedio), borderRadius: 4 }} />
                              </div>
                              <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 800, color: colorPorDias(g.promedio), minWidth: 40 }}>{g.promedio}d</span>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{g.mediana}d</td>
                          <td style={tdStyle}>
                            <span style={{ background: `${vel.color}20`, color: vel.color, fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>
                              {vel.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ ...labelStyle, marginBottom: 14 }}>Comparativa visual (días promedio)</div>
            {porTipo.length > 0
              ? barChart(porTipo.map((g) => ({ label: g.tipo, value: g.promedio, color: colorPorDias(g.promedio) })), 320, 26)
              : <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Sin datos</div>}
          </div>
        </div>
      )}

      {/* Tab: Por Precio */}
      {tab === "precio" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
          <div style={card}>
            <div style={{ ...labelStyle, marginBottom: 14 }}>Tiempo por rango de precio (USD)</div>
            {porRango.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin datos</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Rango USD</th>
                    <th style={thStyle}>Operaciones</th>
                    <th style={thStyle}>Días promedio</th>
                    <th style={thStyle}>Mediana</th>
                  </tr>
                </thead>
                <tbody>
                  {porRango.map((g) => {
                    const vel = velocidadMercado(g.promedio);
                    return (
                      <tr key={g.rango} style={{ background: bgPorDias(g.promedio) }}>
                        <td style={{ ...tdStyle, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{g.rango}</td>
                        <td style={{ ...tdStyle, textAlign: "center", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{g.count}</td>
                        <td style={tdStyle}>
                          <span style={{ color: vel.color, fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13 }}>{g.promedio}d</span>
                          <span style={{ marginLeft: 6, background: `${vel.color}20`, color: vel.color, fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "1px 6px", borderRadius: 3 }}>{vel.label}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{g.mediana}d</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
              Precios normalizados a USD usando TC: ${fmtNum(tipoCambio)}
            </div>
          </div>

          <div style={card}>
            <div style={{ ...labelStyle, marginBottom: 14 }}>Scatter: precio vs. días en mercado</div>
            {scatterData.length > 0
              ? scatterPlot(scatterData, 520, 280)
              : <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", padding: "40px 0" }}>Sin datos suficientes</div>}
            <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
              Cada punto representa una propiedad cerrada. Eje X: precio USD · Eje Y: días en mercado.
            </div>
          </div>
        </div>
      )}

      {/* Tab: Histórico */}
      {tab === "historico" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
          <div style={card}>
            <div style={{ ...labelStyle, marginBottom: 4 }}>Tiempo promedio mensual — últimos 12 meses</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>¿Hay estacionalidad en el mercado?</div>
            {historico.length >= 2
              ? lineChart(historico, 900, 220)
              : (
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
                  Se necesitan al menos 2 meses con datos para mostrar el gráfico.
                </div>
              )}
          </div>

          {historico.length > 0 && (
            <div style={card}>
              <div style={{ ...labelStyle, marginBottom: 14 }}>Detalle mensual</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Mes</th>
                    <th style={thStyle}>Operaciones</th>
                    <th style={thStyle}>Días promedio</th>
                    <th style={thStyle}>Velocidad</th>
                  </tr>
                </thead>
                <tbody>
                  {[...historico].reverse().map((m) => {
                    const vel = velocidadMercado(m.promedio);
                    return (
                      <tr key={m.mes}>
                        <td style={{ ...tdStyle, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{m.label}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>{m.count}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 80, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(100, (m.promedio / 150) * 100)}%`, background: vel.color, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 12, color: vel.color }}>{m.promedio}d</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ background: `${vel.color}20`, color: vel.color, fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>
                            {vel.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tabla detalle */}
      <div style={{ ...card, marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ ...labelStyle }}>Detalle de propiedades — {tablaDetalle.length} registros</div>
          <div style={{ display: "flex", gap: 8, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, background: "rgba(204,0,0,0.3)", borderRadius: 2 }} /> &gt;90 días
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, background: "rgba(249,115,22,0.2)", borderRadius: 2 }} /> 60–90
            </span>
          </div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead style={{ position: "sticky", top: 0, background: "#0d0d0d", zIndex: 1 }}>
              <tr>
                {[
                  { key: "tipo" as const, label: "Tipo" },
                  { key: "barrio" as const, label: "Barrio" },
                  { key: "precio" as const, label: "Precio USD" },
                  { key: "dias" as const, label: "Días en mercado" },
                  { key: "estado" as const, label: "Estado" },
                ].map((col) => (
                  <th key={col.key} style={thStyle} onClick={() => toggleSort(col.key)}>
                    {col.label}{sortArrow(col.key, sortKey, sortDir)}
                  </th>
                ))}
                <th style={thStyle}>Operación</th>
              </tr>
            </thead>
            <tbody>
              {tablaDetalle.slice(0, 200).map((p) => (
                <tr key={p.id} style={{ background: bgPorDias(p.dias) }}>
                  <td style={{ ...tdStyle, textTransform: "capitalize" }}>{p.tipo ?? "—"}</td>
                  <td style={tdStyle}>{p.barrio ?? "—"}</td>
                  <td style={{ ...tdStyle, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                    {p.precioUSD > 0 ? `USD ${fmtNum(p.precioUSD)}` : "—"}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: colorPorDias(p.dias) }}>
                    {p.dias} días
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      background: p.estado === "vendido" || p.estado === "alquilado" ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)",
                      color: p.estado === "vendido" || p.estado === "alquilado" ? "#22c55e" : "#3b82f6",
                      fontSize: 9,
                      fontFamily: "Montserrat,sans-serif",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 3,
                      textTransform: "capitalize",
                    }}>
                      {p.estado ?? "—"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textTransform: "capitalize", color: "rgba(255,255,255,0.5)" }}>{p.operacion ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tablaDetalle.length > 200 && (
          <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
            Mostrando 200 de {tablaDetalle.length} registros
          </div>
        )}
      </div>
    </div>
  );
}
