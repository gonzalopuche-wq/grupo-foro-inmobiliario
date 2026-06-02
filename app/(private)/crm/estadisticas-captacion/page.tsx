"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PropiedadRaw {
  id: string;
  created_at: string;
  operacion: string | null;
  tipo: string | null;
  zona: string | null;
  precio: number | null;
  moneda: string | null;
  estado: string | null;
}

interface MesData {
  key: string;   // "YYYY-MM"
  label: string; // "Ene 25"
  count: number;
}

interface BarrioRow {
  zona: string;
  cantidad: number;
  precioPromedio: number | null;
  diasPromedio: number;
}

interface EstadoRow {
  estado: string;
  cantidad: number;
  porcentaje: number;
  precioPromedio: number | null;
}

interface DonutSlice {
  label: string;
  count: number;
  color: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const MESES_ABREV = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

const TIPO_PROP_COLORES: Record<string, string> = {
  departamento: "#990000",
  casa:         "#e63333",
  local:        "#ff6666",
  oficina:      "#ff9999",
  terreno:      "#ffcccc",
  otro:         "#555555",
};

const TIPO_OP_COLORES: Record<string, string> = {
  venta:             "#990000",
  alquiler:          "#e63333",
  alquiler_temporal: "#ff6666",
  otro:              "#555555",
};

const ESTADO_COLORES: Record<string, string> = {
  disponible: "#3abab6",
  vendido:    "#4ab8d8",
  alquilado:  "#a78bfa",
  retirado:   "#6b7280",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function mesLabel(key: string): string {
  const [y, m] = key.split("-");
  const mes = MESES_ABREV[parseInt(m) - 1];
  return `${mes} ${y.slice(2)}`;
}

function getLast12Months(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(mesKey(d));
  }
  return keys;
}

function getLast6MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(mesKey(d));
  }
  return keys;
}

function diasDesde(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatPrecio(n: number | null, moneda?: string): string {
  if (n === null || n === 0) return "—";
  const cur = moneda ?? "USD";
  if (n >= 1_000_000) return `${cur} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${cur} ${Math.round(n / 1_000)}K`;
  return `${cur} ${Math.round(n)}`;
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          background: "#111111",
          border: "1px solid #222222",
          borderRadius: 12,
          padding: 24,
          animation: "blink 1.4s ease-in-out infinite",
          animationDelay: `${i * 0.15}s`,
          height: 100,
        }} />
      ))}
      <style>{`@keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.35 } }`}</style>
    </div>
  );
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────

function Donut({ slices, title }: { slices: DonutSlice[]; title: string }) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  if (total === 0) {
    return (
      <div style={{ textAlign: "center", padding: 24, color: "#555" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 8, color: "#e0e0e0", fontSize: 14 }}>{title}</div>
        Sin datos
      </div>
    );
  }

  const cx = 90, cy = 90, r = 65, strokeW = 26;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "#e0e0e0", textAlign: "center", marginBottom: 12 }}>{title}</div>
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ display: "block", margin: "0 auto" }}>
        {slices.map((s, i) => {
          const pct = s.count / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeW}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#e0e0e0" fontSize="22" fontWeight="800" fontFamily="Montserrat, sans-serif">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#888" fontSize="11" fontFamily="Inter, sans-serif">total</text>
      </svg>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#e0e0e0", fontFamily: "Inter, sans-serif" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            {s.label} ({s.count})
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bar Chart SVG ─────────────────────────────────────────────────────────────

function BarChart({ data }: { data: MesData[] }) {
  const W = 700, H = 280, padL = 40, padR = 16, padT = 30, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const barW = Math.floor(innerW / data.length) - 4;

  const yTicks = 4;
  const yStep = Math.ceil(maxVal / yTicks);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, display: "block", margin: "0 auto" }}
      aria-label="Captaciones por mes"
    >
      {/* Y gridlines */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = i * yStep;
        const y = padT + innerH - (val / (yStep * yTicks)) * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#222222" strokeWidth={1} />
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="#555" fontSize="11" fontFamily="Inter, sans-serif">{val}</text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = maxVal > 0 ? (d.count / maxVal) * innerH : 0;
        const x = padL + (i / data.length) * innerW + 2;
        const y = padT + innerH - barH;
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barW} height={barH} fill="#990000" rx={3} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="#e0e0e0" fontSize="11" fontFamily="Inter, sans-serif">{d.count}</text>
            )}
            <text x={x + barW / 2} y={H - padB + 16} textAnchor="middle" fill="#888" fontSize="10" fontFamily="Inter, sans-serif">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Line Chart SVG ────────────────────────────────────────────────────────────

function LineChart({ data }: { data: MesData[] }) {
  const W = 700, H = 250, padL = 40, padR = 16, padT = 20, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxVal = Math.max(...data.map(d => d.count), 1);

  const points = data.map((d, i) => {
    const x = padL + (i / (data.length - 1 || 1)) * innerW;
    const y = padT + innerH - (d.count / maxVal) * innerH;
    return { x, y, d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, display: "block", margin: "0 auto" }}
      aria-label="Stock activo por mes"
    >
      {/* Y gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
        const val = Math.round(frac * maxVal);
        const y = padT + innerH - frac * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#222222" strokeWidth={1} />
            <text x={padL - 6} y={y + 4} textAnchor="end" fill="#555" fontSize="11" fontFamily="Inter, sans-serif">{val}</text>
          </g>
        );
      })}

      {/* Area fill */}
      {points.length > 1 && (
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${padT + innerH} L ${points[0].x} ${padT + innerH} Z`}
          fill="#990000"
          fillOpacity={0.15}
        />
      )}

      {/* Line */}
      {points.length > 1 && (
        <path d={pathD} fill="none" stroke="#990000" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#990000" stroke="#0a0a0a" strokeWidth={2} />
          <text x={p.x} y={H - padB + 16} textAnchor="middle" fill="#888" fontSize="10" fontFamily="Inter, sans-serif">{p.d.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "#111111",
      border: "1px solid #222222",
      borderRadius: 12,
      padding: "20px 24px",
    }}>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#888", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: "#990000" }}>{value}</div>
      {sub && <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#555", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", color: "#555" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏠</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "#e0e0e0", marginBottom: 12 }}>Sin propiedades en cartera</div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#666", maxWidth: 380, margin: "0 auto" }}>
        Aún no cargaste propiedades. Comenzá a registrar captaciones para ver tus estadísticas aquí.
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = "resumen" | "tipos" | "rendimiento";

export default function EstadisticasCaptacionPage() {
  const [propiedades, setPropiedades] = useState<PropiedadRaw[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<Tab>("resumen");

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) { window.location.href = "/login"; return; }

      const { data } = await supabase
        .from("cartera_propiedades")
        .select("id, created_at, operacion, tipo, zona, precio, moneda, estado")
        .eq("perfil_id", uid);

      setPropiedades((data as PropiedadRaw[]) ?? []);
      setLoading(false);
    };
    init();
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────

  const last12Keys = useMemo(() => getLast12Months(), []);
  const last6Keys  = useMemo(() => getLast6MonthKeys(), []);
  const hoyKey     = useMemo(() => mesKey(new Date()), []);

  const porMes = useMemo<Record<string, number>>(() => {
    const acc: Record<string, number> = {};
    for (const p of propiedades) {
      const k = p.created_at ? p.created_at.substring(0, 7) : "sin-fecha";
      acc[k] = (acc[k] ?? 0) + 1;
    }
    return acc;
  }, [propiedades]);

  const barData = useMemo<MesData[]>(() =>
    last12Keys.map(k => ({ key: k, label: mesLabel(k), count: porMes[k] ?? 0 }))
  , [last12Keys, porMes]);

  // KPIs
  const captacionesMes    = porMes[hoyKey] ?? 0;
  const promedioUlt6      = last6Keys.reduce((s, k) => s + (porMes[k] ?? 0), 0) / 6;
  const totalCaptadas      = propiedades.length;
  const convertidas        = propiedades.filter(p => p.estado === "vendida" || p.estado === "retirada").length;
  const tasaConversion     = totalCaptadas > 0 ? (convertidas / totalCaptadas) * 100 : 0;
  const activas            = propiedades.filter(p => p.estado === "activa");
  const diasPromedioCartera = activas.length > 0
    ? activas.reduce((s, p) => s + diasDesde(p.created_at), 0) / activas.length
    : 0;

  // Tipos donut
  const tiposPropSlices = useMemo<DonutSlice[]>(() => {
    const acc: Record<string, number> = {};
    for (const p of propiedades) {
      const t = (p.tipo ?? "otro").toLowerCase();
      acc[t] = (acc[t] ?? 0) + 1;
    }
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        color: TIPO_PROP_COLORES[label] ?? TIPO_PROP_COLORES.otro,
      }));
  }, [propiedades]);

  const tiposOpSlices = useMemo<DonutSlice[]>(() => {
    const acc: Record<string, number> = {};
    for (const p of propiedades) {
      const t = (p.operacion ?? "otro").toLowerCase();
      acc[t] = (acc[t] ?? 0) + 1;
    }
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        color: TIPO_OP_COLORES[label] ?? TIPO_OP_COLORES.otro,
      }));
  }, [propiedades]);

  // Barrios
  const barrioRows = useMemo<BarrioRow[]>(() => {
    const acc: Record<string, { count: number; precioSum: number; precioN: number; diasSum: number }> = {};
    for (const p of propiedades) {
      const b = p.zona ?? "Sin especificar";
      if (!acc[b]) acc[b] = { count: 0, precioSum: 0, precioN: 0, diasSum: 0 };
      acc[b].count++;
      if (p.precio !== null && p.precio > 0) {
        acc[b].precioSum += p.precio;
        acc[b].precioN++;
      }
      acc[b].diasSum += diasDesde(p.created_at);
    }
    return Object.entries(acc)
      .map(([zona, v]) => ({
        zona,
        cantidad: v.count,
        precioPromedio: v.precioN > 0 ? v.precioSum / v.precioN : null,
        diasPromedio: Math.round(v.diasSum / v.count),
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [propiedades]);

  // Estados
  const estadoRows = useMemo<EstadoRow[]>(() => {
    const acc: Record<string, { count: number; precioSum: number; precioN: number }> = {};
    for (const p of propiedades) {
      const e = p.estado ?? "sin_estado";
      if (!acc[e]) acc[e] = { count: 0, precioSum: 0, precioN: 0 };
      acc[e].count++;
      if (p.precio !== null && p.precio > 0) {
        acc[e].precioSum += p.precio;
        acc[e].precioN++;
      }
    }
    const total = propiedades.length;
    return Object.entries(acc)
      .map(([estado, v]) => ({
        estado,
        cantidad: v.count,
        porcentaje: total > 0 ? (v.count / total) * 100 : 0,
        precioPromedio: v.precioN > 0 ? v.precioSum / v.precioN : null,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [propiedades]);

  // Stock activo por mes (propiedades disponibles captadas hasta ese mes)
  const stockActivoData = useMemo<MesData[]>(() => {
    return last12Keys.map(k => {
      const count = propiedades.filter(p => {
        if (!p.created_at) return false;
        const captadaEn = p.created_at.substring(0, 7);
        // Captada en o antes de este mes
        if (captadaEn > k) return false;
        // Aún disponible (no tiene estado final)
        return p.estado === "activa" || p.estado === null;
      }).length;
      return { key: k, label: mesLabel(k), count };
    });
  }, [last12Keys, propiedades]);

  // Alerta captación
  const captacionBaja = captacionesMes < promedioUlt6 && promedioUlt6 > 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#e0e0e0",
    padding: "32px 24px",
    fontFamily: "Inter, sans-serif",
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: 28,
    color: "#e0e0e0",
    marginBottom: 8,
  };

  const subtitleStyle: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    color: "#555",
    marginBottom: 32,
  };

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid #222222",
    marginBottom: 32,
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid #990000" : "2px solid transparent",
    color: active ? "#e0e0e0" : "#666",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 13,
    padding: "10px 18px",
    cursor: "pointer",
    transition: "color 0.15s",
    marginBottom: -1,
  });

  const sectionTitle: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 16,
    color: "#e0e0e0",
    marginBottom: 16,
  };

  const cardStyle: React.CSSProperties = {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 16px",
    textAlign: "left",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 12,
    color: "#666",
    borderBottom: "1px solid #222222",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 16px",
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    color: "#e0e0e0",
    borderBottom: "1px solid #1a1a1a",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={titleStyle}>Estadísticas de Captación</div>
        <div style={subtitleStyle}>Cargando métricas...</div>
        <SkeletonCards />
        <SkeletonCards />
      </div>
    );
  }

  if (propiedades.length === 0) {
    return (
      <div style={pageStyle}>
        <div style={titleStyle}>Estadísticas de Captación</div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={titleStyle}>Estadísticas de Captación</div>
      <div style={subtitleStyle}>Análisis de tu cartera de propiedades captadas</div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {(["resumen", "tipos", "rendimiento"] as Tab[]).map(t => (
          <button key={t} style={tabBtnStyle(tab === t)} onClick={() => setTab(t)}>
            {t === "resumen" ? "Resumen mensual" : t === "tipos" ? "Por tipo y zona" : "Rendimiento"}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Resumen mensual ─────────────────────────────────────────── */}
      {tab === "resumen" && (
        <div>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
            <KpiCard
              label="Captaciones este mes"
              value={String(captacionesMes)}
              sub={`Total en cartera: ${totalCaptadas}`}
            />
            <KpiCard
              label="Promedio mensual (últ. 6 m)"
              value={promedioUlt6.toFixed(1)}
              sub="captaciones por mes"
            />
            <KpiCard
              label="Tasa de conversión"
              value={`${tasaConversion.toFixed(0)}%`}
              sub={`${convertidas} vendidas / retiradas`}
            />
            <KpiCard
              label="Días promedio en cartera"
              value={diasPromedioCartera > 0 ? `${Math.round(diasPromedioCartera)} d` : "—"}
              sub="propiedades activas"
            />
          </div>

          {/* Bar chart */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Captaciones por mes — últimos 12 meses</div>
            <BarChart data={barData} />
          </div>
        </div>
      )}

      {/* ── Tab 2: Por tipo y zona ─────────────────────────────────────────── */}
      {tab === "tipos" && (
        <div>
          {/* Donuts */}
          <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", gap: 32, justifyContent: "center" }}>
            <Donut slices={tiposPropSlices} title="Por tipo de propiedad" />
            <Donut slices={tiposOpSlices}   title="Por tipo de operación" />
          </div>

          {/* Tabla barrios */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Captaciones por barrio</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Barrio</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Cantidad</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Precio promedio</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Días promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {barrioRows.map((row, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{row.zona}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#990000" }}>{row.cantidad}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{formatPrecio(row.precioPromedio)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.diasPromedio} d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Rendimiento ─────────────────────────────────────────────── */}
      {tab === "rendimiento" && (
        <div>
          {/* Alerta */}
          {captacionBaja && (
            <div style={{
              background: "rgba(251, 146, 60, 0.12)",
              border: "1px solid #d4960c",
              borderRadius: 10,
              padding: "14px 20px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              color: "#fb923c",
            }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <span>
                <strong>Captación por debajo del promedio</strong> — Este mes captaste {captacionesMes} propiedad{captacionesMes !== 1 ? "es" : ""}, por debajo del promedio de los últimos 6 meses ({promedioUlt6.toFixed(1)}/mes).
              </span>
            </div>
          )}

          {/* Tabla estados */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Propiedades por estado</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Estado</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Cantidad</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>% del total</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Precio promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {estadoRows.map((row, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block",
                          width: 8, height: 8, borderRadius: "50%",
                          background: ESTADO_COLORES[row.estado] ?? "#555",
                          marginRight: 8,
                          verticalAlign: "middle",
                        }} />
                        {row.estado.replace(/_/g, " ")}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{row.cantidad}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: "#990000" }}>{row.porcentaje.toFixed(1)}%</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{formatPrecio(row.precioPromedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Line chart stock activo */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Evolución del stock activo — últimos 12 meses</div>
            <LineChart data={stockActivoData} />
          </div>
        </div>
      )}
    </div>
  );
}
