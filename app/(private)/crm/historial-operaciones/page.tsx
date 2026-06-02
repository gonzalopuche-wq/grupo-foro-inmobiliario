"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Negocio {
  id: string;
  created_at: string;
  tipo_operacion: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  perfil_id: string;
  descripcion: string | null;
  crm_contactos: { nombre: string; apellido: string }[] | null;
}

type Tab = "timeline" | "resumen" | "historico";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function fmtNum(n: number, mon: string): string {
  return `${mon} ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function anioDeIso(iso: string): number {
  return new Date(iso).getFullYear();
}

function mesDeIso(iso: string): number {
  return new Date(iso).getMonth(); // 0-based
}

function aniosDisponibles(negocios: Negocio[]): number[] {
  const set = new Set(negocios.map(n => anioDeIso(n.created_at)));
  return Array.from(set).sort((a, b) => b - a);
}

function ultimosCincoAnios(): number[] {
  const hoy = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => hoy - i);
}

function palabrasClave(descripcion: string | null): string[] {
  if (!descripcion) return [];
  return descripcion.toLowerCase().split(/\s+/).filter(w => w.length > 4);
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      <style>{`
        @keyframes ho-blink {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.35; }
        }
        .ho-skel { animation: ho-blink 1.4s ease-in-out infinite; background: #222; border-radius: 6px; }
      `}</style>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", paddingLeft: 12, paddingBottom: 20 }}>
          <div className="ho-skel" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="ho-skel" style={{ height: 14, width: `${55 + i * 7}%` }} />
            <div className="ho-skel" style={{ height: 11, width: `${35 + i * 5}%` }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Donut SVG ────────────────────────────────────────────────────────────────

interface DonutProps {
  ventas: number;
  alquileres: number;
}

function DonutSVG({ ventas, alquileres }: DonutProps) {
  const total = ventas + alquileres;
  if (total === 0) return <div style={{ color: "var(--gfi-text-dim)", fontSize: 13 }}>Sin datos</div>;

  const r = 60;
  const cx = 80;
  const cy = 80;
  const circum = 2 * Math.PI * r;
  const pctVentas = ventas / total;
  const dashVentas = pctVentas * circum;
  const dashAlquileres = (1 - pctVentas) * circum;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={160} height={160} viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#222" strokeWidth={22} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#990000" strokeWidth={22}
          strokeDasharray={`${dashVentas} ${dashAlquileres}`}
          strokeDashoffset={circum / 4}
          style={{ transition: "stroke-dasharray 0.6s" }}
        />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#3b82f6" strokeWidth={22}
          strokeDasharray={`${dashAlquileres} ${dashVentas}`}
          strokeDashoffset={circum / 4 - dashVentas}
          style={{ transition: "stroke-dasharray 0.6s" }}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#fff" fontSize={18} fontWeight={800} fontFamily="Montserrat,sans-serif">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--gfi-text-muted)" fontSize={10} fontFamily="Montserrat,sans-serif">TOTAL</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "#990000", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--gfi-text-primary)", fontFamily: "Inter,sans-serif" }}>Ventas</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginLeft: "auto", paddingLeft: 16 }}>{ventas}</span>
          <span style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>({Math.round((ventas / total) * 100)}%)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: "#3b82f6", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--gfi-text-primary)", fontFamily: "Inter,sans-serif" }}>Alquileres</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginLeft: "auto", paddingLeft: 16 }}>{alquileres}</span>
          <span style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>({Math.round((alquileres / total) * 100)}%)</span>
        </div>
      </div>
    </div>
  );
}

// ─── Gráfico de barras SVG (mensual) ─────────────────────────────────────────

interface BarChartProps {
  data: { mes: number; ventas: number; alquileres: number }[];
}

function BarChart({ data }: BarChartProps) {
  const W = 700;
  const H = 280;
  const PAD = { top: 30, right: 16, bottom: 36, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const barW = Math.floor(innerW / 12);
  const halfBar = Math.floor(barW / 2) - 2;

  const maxVal = Math.max(...data.map(d => d.ventas + d.alquileres), 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, height: "auto", display: "block" }}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = PAD.top + innerH * (1 - pct);
        const val = Math.round(maxVal * pct);
        return (
          <g key={pct}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#1a1a1a" strokeWidth={1} />
            {pct > 0 && (
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fill="var(--gfi-text-dim)" fontSize={9} fontFamily="Inter,sans-serif">{val}</text>
            )}
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD.left + i * barW + barW / 2;
        const totalH = ((d.ventas + d.alquileres) / maxVal) * innerH;
        const ventasH = (d.ventas / maxVal) * innerH;
        const alqH = (d.alquileres / maxVal) * innerH;
        const total = d.ventas + d.alquileres;

        return (
          <g key={i}>
            {/* Alquileres (abajo) */}
            {d.alquileres > 0 && (
              <rect
                x={x - halfBar}
                y={PAD.top + innerH - alqH}
                width={halfBar * 2}
                height={alqH}
                fill="#3b82f6"
                opacity={0.75}
                rx={2}
              />
            )}
            {/* Ventas (arriba) */}
            {d.ventas > 0 && (
              <rect
                x={x - halfBar}
                y={PAD.top + innerH - totalH}
                width={halfBar * 2}
                height={ventasH}
                fill="#990000"
                opacity={0.85}
                rx={2}
              />
            )}
            {/* Número total encima */}
            {total > 0 && (
              <text
                x={x} y={PAD.top + innerH - totalH - 6}
                textAnchor="middle"
                fill="var(--gfi-text-secondary)"
                fontSize={10}
                fontFamily="Montserrat,sans-serif"
                fontWeight={700}
              >
                {total}
              </text>
            )}
            {/* Label mes */}
            <text
              x={x} y={H - PAD.bottom + 16}
              textAnchor="middle"
              fill="var(--gfi-text-muted)"
              fontSize={9}
              fontFamily="Inter,sans-serif"
            >
              {MESES[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Gráfico de líneas SVG (honorarios por año) ───────────────────────────────

interface LineChartProps {
  data: { anio: number; honorarios: number }[];
}

function LineChart({ data }: LineChartProps) {
  const W = 700;
  const H = 260;
  const PAD = { top: 30, right: 24, bottom: 36, left: 64 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map(d => d.honorarios), 1);

  const pts = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * innerW,
    y: PAD.top + innerH - (d.honorarios / maxVal) * innerH,
    ...d,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, height: "auto", display: "block" }}
    >
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = PAD.top + innerH * (1 - pct);
        const val = Math.round(maxVal * pct);
        return (
          <g key={pct}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#1a1a1a" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="var(--gfi-text-dim)" fontSize={9} fontFamily="Inter,sans-serif">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}
            </text>
          </g>
        );
      })}

      {/* Área bajo la curva */}
      {pts.length > 1 && (
        <path
          d={`${pathD} L ${pts[pts.length - 1].x} ${PAD.top + innerH} L ${pts[0].x} ${PAD.top + innerH} Z`}
          fill="rgba(153,0,0,0.08)"
        />
      )}

      {/* Línea */}
      {pts.length > 1 && (
        <path d={pathD} fill="none" stroke="#990000" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Puntos */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill="#990000" stroke="#0a0a0a" strokeWidth={2} />
          <text x={p.x} y={p.y - 12} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={10} fontFamily="Montserrat,sans-serif" fontWeight={700}>
            {p.honorarios >= 1000 ? `${(p.honorarios / 1000).toFixed(1)}K` : p.honorarios}
          </text>
          <text x={p.x} y={H - PAD.bottom + 16} textAnchor="middle" fill="var(--gfi-text-muted)" fontSize={10} fontFamily="Inter,sans-serif">
            {p.anio}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Tab 1: Línea de tiempo ───────────────────────────────────────────────────

interface TimelineTabProps {
  negocios: Negocio[];
  loading: boolean;
}

function TimelineTab({ negocios, loading }: TimelineTabProps) {
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDelay, setBusquedaDelay] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroAnio, setFiltroAnio] = useState("todos");
  const [filtroMoneda, setFiltroMoneda] = useState("todas");

  // Debounce 400ms
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDelay(busqueda), 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  const anios = useMemo(() => aniosDisponibles(negocios), [negocios]);

  const filtrados = useMemo(() => {
    return negocios.filter(n => {
      if (filtroTipo !== "todos" && n.tipo_operacion !== filtroTipo) return false;
      if (filtroAnio !== "todos" && anioDeIso(n.created_at) !== Number(filtroAnio)) return false;
      if (filtroMoneda !== "todas" && n.moneda !== filtroMoneda) return false;
      if (busquedaDelay) {
        const q = busquedaDelay.toLowerCase();
        const desc = (n.descripcion ?? "").toLowerCase();
        const cont = (n.crm_contactos?.[0]?.nombre ?? "").toLowerCase();
        if (!desc.includes(q) && !cont.includes(q)) return false;
      }
      return true;
    });
  }, [negocios, filtroTipo, filtroAnio, filtroMoneda, busquedaDelay]);

  if (loading) {
    return (
      <div style={{ padding: "24px 0" }}>
        <SkeletonRows />
      </div>
    );
  }

  if (negocios.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--gfi-text-dim)" }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>🏁</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          Aún no tenés operaciones cerradas
        </div>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13 }}>
          Cuando cerrés una venta o alquiler, aparecerá acá.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por descripción o contacto..."
          style={{
            flex: 1, minWidth: 200, padding: "8px 12px",
            background: "var(--gfi-bg-secondary)", border: "1px solid #222",
            borderRadius: 5, color: "#e0e0e0", fontSize: 13,
            fontFamily: "Inter,sans-serif", outline: "none",
            boxSizing: "border-box",
          }}
        />
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          style={{ padding: "8px 10px", background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 5, color: "#e0e0e0", fontSize: 13, fontFamily: "Inter,sans-serif", outline: "none" }}
        >
          <option value="todos">Todos los tipos</option>
          <option value="venta">Venta</option>
          <option value="alquiler">Alquiler</option>
        </select>
        <select
          value={filtroAnio}
          onChange={e => setFiltroAnio(e.target.value)}
          style={{ padding: "8px 10px", background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 5, color: "#e0e0e0", fontSize: 13, fontFamily: "Inter,sans-serif", outline: "none" }}
        >
          <option value="todos">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filtroMoneda}
          onChange={e => setFiltroMoneda(e.target.value)}
          style={{ padding: "8px 10px", background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 5, color: "#e0e0e0", fontSize: 13, fontFamily: "Inter,sans-serif", outline: "none" }}
        >
          <option value="todas">Todas las monedas</option>
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--gfi-text-dim)", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600 }}>
          No hay operaciones que coincidan con los filtros.
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Línea vertical */}
          <div style={{ position: "absolute", left: 17, top: 0, bottom: 0, width: 2, background: "#1a1a1a", zIndex: 0 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {filtrados.map((n, idx) => {
              const anio = anioDeIso(n.created_at);
              const prevAnio = idx > 0 ? anioDeIso(filtrados[idx - 1].created_at) : null;
              const showAnio = prevAnio !== anio;
              const esVenta = n.tipo_operacion === "venta";

              return (
                <div key={n.id}>
                  {showAnio && (
                    <div style={{ paddingLeft: 48, paddingTop: idx > 0 ? 20 : 0, paddingBottom: 8 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "var(--gfi-text-dim)", textTransform: "uppercase" }}>
                        {anio}
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 16, paddingBottom: 12, alignItems: "flex-start" }}>
                    {/* Círculo año */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "#990000", border: "2px solid #0a0a0a",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, zIndex: 1,
                      fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 800,
                      color: "#fff", letterSpacing: "0.06em",
                    }}>
                      {anio}
                    </div>

                    {/* Card */}
                    <HoverCard>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 10,
                          fontSize: 10, fontWeight: 700, fontFamily: "var(--font-display)",
                          background: esVenta ? "rgba(153,0,0,0.18)" : "rgba(59,130,246,0.18)",
                          color: esVenta ? "#990000" : "#3b82f6",
                          border: `1px solid ${esVenta ? "rgba(153,0,0,0.4)" : "rgba(59,130,246,0.4)"}`,
                          textTransform: "uppercase", letterSpacing: "0.08em",
                        }}>
                          {n.tipo_operacion}
                        </span>
                        <span style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "#e0e0e0", fontWeight: 500 }}>
                          {n.descripcion ?? "Sin descripción"}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {n.crm_contactos?.[0]?.nombre && (
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>
                            👤 {n.crm_contactos?.[0]?.nombre}
                          </span>
                        )}
                        {n.valor_operacion != null && n.moneda && (
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>
                            💰 {fmtNum(n.valor_operacion, n.moneda)}
                          </span>
                        )}
                        {((n.valor_operacion ?? 0) * (n.honorarios_pct ?? 3) / 100) != null && n.moneda && (
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>
                            📊 Hon. {fmtNum(((n.valor_operacion ?? 0) * (n.honorarios_pct ?? 3) / 100), n.moneda)}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginLeft: "auto" }}>
                          {fmtFecha(n.created_at)}
                        </span>
                      </div>
                    </HoverCard>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HoverCard helper ─────────────────────────────────────────────────────────

function HoverCard({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        background: "#111111",
        border: `1px solid ${hovered ? "#990000" : "#222222"}`,
        borderRadius: 8,
        padding: "12px 16px",
        transition: "border-color 0.15s",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

// ─── Tab 2: Resumen y métricas ────────────────────────────────────────────────

interface ResumenTabProps {
  negocios: Negocio[];
  loading: boolean;
}

function ResumenTab({ negocios, loading }: ResumenTabProps) {
  const anioActual = new Date().getFullYear();
  const [anioSel, setAnioSel] = useState<number>(anioActual);

  const anios = useMemo(() => aniosDisponibles(negocios), [negocios]);

  const delAnio = useMemo(() => negocios.filter(n => anioDeIso(n.created_at) === anioSel), [negocios, anioSel]);

  const kpis = useMemo<{
    totalOps: number;
    porMoneda: Record<string, { volumen: number; honorarios: number; count: number }>;
    masGrande: Negocio | null;
    promedio: Record<string, number>;
  }>(() => {
    const totalOps = delAnio.length;
    const porMoneda: Record<string, { volumen: number; honorarios: number; count: number }> = {};

    delAnio.forEach(n => {
      const mon = n.moneda ?? "USD";
      if (!porMoneda[mon]) porMoneda[mon] = { volumen: 0, honorarios: 0, count: 0 };
      porMoneda[mon].volumen += n.valor_operacion ?? 0;
      porMoneda[mon].honorarios += (n.valor_operacion ?? 0) * (n.honorarios_pct ?? 3) / 100;
      porMoneda[mon].count++;
    });

    const masGrande: Negocio | null = delAnio.reduce<Negocio | null>((best, n) => {
      if (!best || (n.valor_operacion ?? 0) > (best.valor_operacion ?? 0)) return n;
      return best;
    }, null);

    const promedio: Record<string, number> = {};
    Object.entries(porMoneda).forEach(([mon, data]) => {
      promedio[mon] = data.count > 0 ? data.volumen / data.count : 0;
    });

    return { totalOps, porMoneda, masGrande, promedio };
  }, [delAnio]);

  // Datos para gráfico de barras: 12 meses
  const barData = useMemo(() => {
    return Array.from({ length: 12 }, (_, mes) => {
      const delMes = delAnio.filter(n => mesDeIso(n.created_at) === mes);
      return {
        mes,
        ventas: delMes.filter(n => n.tipo_operacion === "venta").length,
        alquileres: delMes.filter(n => n.tipo_operacion === "alquiler").length,
      };
    });
  }, [delAnio]);

  // Tabla mensual
  const tablaMensual = useMemo(() => {
    return Array.from({ length: 12 }, (_, mes) => {
      const delMes = delAnio.filter(n => mesDeIso(n.created_at) === mes);
      const ventas = delMes.filter(n => n.tipo_operacion === "venta").length;
      const alquileres = delMes.filter(n => n.tipo_operacion === "alquiler").length;
      const honorarios = delMes.reduce((s, n) => s + (n.valor_operacion ?? 0) * (n.honorarios_pct ?? 3) / 100, 0);
      const moneda = delMes[0]?.moneda ?? "USD";
      return { mes, ventas, alquileres, total: ventas + alquileres, honorarios, moneda };
    });
  }, [delAnio]);

  if (loading) {
    return (
      <div style={{ padding: "24px 0" }}>
        <SkeletonRows />
      </div>
    );
  }

  if (negocios.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--gfi-text-dim)" }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>📊</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          No hay operaciones cerradas.
        </div>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13 }}>
          Cuando cerrés una venta o alquiler, aparecerá acá.
        </div>
      </div>
    );
  }

  const masGrande = kpis.masGrande;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Selector de año */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)" }}>
          Año
        </span>
        <select
          value={anioSel}
          onChange={e => setAnioSel(Number(e.target.value))}
          style={{ padding: "7px 10px", background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 5, color: "#e0e0e0", fontSize: 13, fontFamily: "Inter,sans-serif", outline: "none" }}
        >
          {(anios.length > 0 ? anios : [anioActual]).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {/* Total operaciones */}
        <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: "16px 18px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>
            Operaciones
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "#fff" }}>{kpis.totalOps}</div>
          <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginTop: 4 }}>cerradas en {anioSel}</div>
        </div>

        {/* Volumen por moneda */}
        {Object.entries(kpis.porMoneda).map(([mon, data]) => (
          <div key={`vol-${mon}`} style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>
              Volumen {mon}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: data.volumen >= 1_000_000 ? 18 : 22, fontWeight: 800, color: "#3abab6" }}>
              {data.volumen >= 1_000_000
                ? `${mon} ${(data.volumen / 1_000_000).toFixed(1)}M`
                : fmtNum(data.volumen, mon)}
            </div>
            <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginTop: 4 }}>{data.count} op.</div>
          </div>
        ))}

        {/* Honorarios por moneda */}
        {Object.entries(kpis.porMoneda).map(([mon, data]) => (
          <div key={`hon-${mon}`} style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>
              Honorarios {mon}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: data.honorarios >= 1_000_000 ? 18 : 22, fontWeight: 800, color: "#990000" }}>
              {data.honorarios >= 1_000_000
                ? `${mon} ${(data.honorarios / 1_000_000).toFixed(1)}M`
                : fmtNum(data.honorarios, mon)}
            </div>
          </div>
        ))}

        {/* Promedio por operación */}
        {Object.entries(kpis.promedio).map(([mon, prom]) => (
          <div key={`prom-${mon}`} style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>
              Promedio {mon}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: prom >= 1_000_000 ? 16 : 20, fontWeight: 800, color: "#d4960c" }}>
              {prom >= 1_000_000
                ? `${mon} ${(prom / 1_000_000).toFixed(1)}M`
                : fmtNum(Math.round(prom), mon)}
            </div>
            <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", marginTop: 4 }}>por operación</div>
          </div>
        ))}

        {/* Operación más grande */}
        {masGrande && (
          <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222222", borderRadius: 8, padding: "16px 18px", gridColumn: "span 2" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 8 }}>
              Mayor operación del año
            </div>
            <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "#e0e0e0" }}>
              {masGrande.descripcion ?? "Sin descripción"}
            </div>
            {masGrande.valor_operacion != null && masGrande.moneda && (
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 6 }}>
                {fmtNum(masGrande.valor_operacion, masGrande.moneda)}
              </div>
            )}
            {masGrande.crm_contactos?.[0]?.nombre && (
              <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", marginTop: 4, fontFamily: "Inter,sans-serif" }}>
                👤 {masGrande.crm_contactos?.[0]?.nombre}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gráfico de barras */}
      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: "20px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 16 }}>
          Operaciones por mes — {anioSel}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, background: "#990000", borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>Ventas</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, background: "#3b82f6", borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif" }}>Alquileres</span>
          </div>
        </div>
        <BarChart data={barData} />
      </div>

      {/* Tabla mensual */}
      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", padding: "16px 20px 8px" }}>
          Detalle mensual
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                {["Mes", "Ventas", "Alquileres", "Total", "Honorarios"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tablaMensual.filter(r => r.total > 0).map(r => (
                <tr key={r.mes} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>{MESES_FULL[r.mes]}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "Inter,sans-serif", fontSize: 13, color: r.ventas > 0 ? "#990000" : "var(--gfi-text-dim)" }}>{r.ventas}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "Inter,sans-serif", fontSize: 13, color: r.alquileres > 0 ? "#3b82f6" : "var(--gfi-text-dim)" }}>{r.alquileres}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "#fff" }}>{r.total}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "Inter,sans-serif", fontSize: 13, color: r.honorarios > 0 ? "#3abab6" : "var(--gfi-text-dim)" }}>
                    {r.honorarios > 0 ? fmtNum(r.honorarios, r.moneda) : "—"}
                  </td>
                </tr>
              ))}
              {tablaMensual.every(r => r.total === 0) && (
                <tr>
                  <td colSpan={5} style={{ padding: "20px 16px", textAlign: "center", color: "var(--gfi-text-dim)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>
                    Sin operaciones en {anioSel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Análisis histórico ────────────────────────────────────────────────

interface HistoricoTabProps {
  negocios: Negocio[];
  loading: boolean;
}

function HistoricoTab({ negocios, loading }: HistoricoTabProps) {
  const cinco = ultimosCincoAnios();

  const porAnio = useMemo(() => {
    return cinco.map((anio, idx) => {
      const del = negocios.filter(n => anioDeIso(n.created_at) === anio);
      const ops = del.length;
      const honorarios = del.reduce((s, n) => s + (n.valor_operacion ?? 0) * (n.honorarios_pct ?? 3) / 100, 0);
      const volumen = del.reduce((s, n) => s + (n.valor_operacion ?? 0), 0);

      // Crecimiento vs. año anterior
      const anioAnt = cinco[idx + 1];
      const delAnt = anioAnt
        ? negocios.filter(n => anioDeIso(n.created_at) === anioAnt)
        : null;
      const honorariosAnt = delAnt
        ? delAnt.reduce((s, n) => s + (n.valor_operacion ?? 0) * (n.honorarios_pct ?? 3) / 100, 0)
        : null;
      let crecimiento: number | null = null;
      if (honorariosAnt !== null && honorariosAnt > 0) {
        crecimiento = ((honorarios - honorariosAnt) / honorariosAnt) * 100;
      } else if (honorariosAnt === 0 && honorarios > 0) {
        crecimiento = 100;
      }

      const moneda = del[0]?.moneda ?? "USD";
      return { anio, ops, honorarios, volumen, crecimiento, moneda };
    });
  }, [negocios, cinco]);

  // Datos para gráfico de líneas (honorarios por año, últimos 5 años)
  const lineData = useMemo(() => {
    return [...porAnio].reverse().map(d => ({ anio: d.anio, honorarios: d.honorarios }));
  }, [porAnio]);

  // Donut: total ventas vs alquileres
  const totales = useMemo(() => ({
    ventas: negocios.filter(n => n.tipo_operacion === "venta").length,
    alquileres: negocios.filter(n => n.tipo_operacion === "alquiler").length,
  }), [negocios]);

  // Top zonas / palabras clave
  const topZonas = useMemo(() => {
    const freq: Record<string, number> = {};
    negocios.forEach(n => {
      palabrasClave(n.descripcion).forEach(p => {
        freq[p] = (freq[p] ?? 0) + 1;
      });
    });
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([kw, count]) => ({ kw, count }));
  }, [negocios]);

  if (loading) {
    return (
      <div style={{ padding: "24px 0" }}>
        <SkeletonRows />
      </div>
    );
  }

  if (negocios.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--gfi-text-dim)" }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>📈</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          No hay operaciones cerradas.
        </div>
        <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13 }}>
          Cuando cerrés una venta o alquiler, aparecerá acá.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Gráfico de líneas */}
      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 16 }}>
          Honorarios por año — últimos 5 años
        </div>
        <LineChart data={lineData} />
      </div>

      {/* Tabla resumen por año */}
      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", padding: "16px 20px 8px" }}>
          Resumen por año
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                {["Año", "Operaciones", "Volumen", "Honorarios", "Crecimiento"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porAnio.map(r => (
                <tr key={r.anio} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "#fff" }}>{r.anio}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "Inter,sans-serif", fontSize: 13, color: r.ops > 0 ? "#e0e0e0" : "var(--gfi-text-dim)" }}>{r.ops}</td>
                  <td style={{ padding: "10px 16px", fontFamily: "Inter,sans-serif", fontSize: 13, color: r.volumen > 0 ? "#3abab6" : "var(--gfi-text-dim)" }}>
                    {r.volumen > 0
                      ? (r.volumen >= 1_000_000 ? `${r.moneda} ${(r.volumen / 1_000_000).toFixed(1)}M` : fmtNum(r.volumen, r.moneda))
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 16px", fontFamily: "Inter,sans-serif", fontSize: 13, color: r.honorarios > 0 ? "#990000" : "var(--gfi-text-dim)" }}>
                    {r.honorarios > 0 ? fmtNum(r.honorarios, r.moneda) : "—"}
                  </td>
                  <td style={{ padding: "10px 16px", fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700 }}>
                    {r.crecimiento === null ? (
                      <span style={{ color: "var(--gfi-text-dim)" }}>—</span>
                    ) : r.crecimiento >= 0 ? (
                      <span style={{ color: "#3abab6" }}>↑ {r.crecimiento.toFixed(1)}%</span>
                    ) : (
                      <span style={{ color: "#b80000" }}>↓ {Math.abs(r.crecimiento).toFixed(1)}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribución donut */}
      <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 16 }}>
          Distribución global — ventas vs. alquileres
        </div>
        <DonutSVG ventas={totales.ventas} alquileres={totales.alquileres} />
      </div>

      {/* Top zonas */}
      {topZonas.length > 0 && (
        <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 8, padding: 20 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gfi-text-muted)", marginBottom: 16 }}>
            Palabras clave más frecuentes en descripciones
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topZonas.map(({ kw, count }, i) => {
              const max = topZonas[0].count;
              const pct = (count / max) * 100;
              return (
                <div key={kw}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "#e0e0e0" }}>
                      #{i + 1} <span style={{ fontWeight: 600 }}>{kw}</span>
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, color: "#990000" }}>
                      {count} {count === 1 ? "vez" : "veces"}
                    </span>
                  </div>
                  <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#990000", borderRadius: 2, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HistorialOperacionesPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("timeline");

  const cargar = useCallback(async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_negocios")
      .select("id, created_at, tipo_operacion, etapa, valor_operacion, moneda, honorarios_pct, perfil_id, descripcion, crm_contactos(nombre, apellido)")
      .eq("etapa", "cerrado")
      .eq("perfil_id", userId)
      .order("created_at", { ascending: false });
    setNegocios((data as unknown as Negocio[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, [cargar]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "timeline", label: "Línea de tiempo" },
    { id: "resumen", label: "Resumen y métricas" },
    { id: "historico", label: "Análisis histórico" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .ho-tab-btn { background: none; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
        .ho-tab-btn:hover { color: #fff !important; }
      `}</style>

      <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#e0e0e0", padding: "24px 20px", maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
            Historial de <span style={{ color: "#990000" }}>Operaciones</span>
          </div>
          <div style={{ fontFamily: "Inter,sans-serif", fontSize: 13, color: "var(--gfi-text-muted)", marginTop: 5 }}>
            Registro completo de ventas y alquileres cerrados
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222", marginBottom: 28 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              className="ho-tab-btn"
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 18px",
                fontFamily: "var(--font-display)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                border: "none",
                borderBottom: tab === t.id ? "2px solid #990000" : "2px solid transparent",
                color: tab === t.id ? "#990000" : "var(--gfi-text-muted)",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido de cada tab */}
        {tab === "timeline" && (
          <TimelineTab negocios={negocios} loading={loading} />
        )}
        {tab === "resumen" && (
          <ResumenTab negocios={negocios} loading={loading} />
        )}
        {tab === "historico" && (
          <HistoricoTab negocios={negocios} loading={loading} />
        )}

        {/* Footer info cuando hay UID pero no hay datos */}
        {!loading && uid === null && (
          <div style={{ textAlign: "center", color: "var(--gfi-text-dim)", padding: 40, fontFamily: "Inter,sans-serif" }}>
            Iniciá sesión para ver tu historial.
          </div>
        )}
      </div>
    </>
  );
}
