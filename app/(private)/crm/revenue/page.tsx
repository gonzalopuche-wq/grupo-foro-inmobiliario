"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Operacion {
  id: string;
  tipo_operacion: string | null;
  etapa: string | null;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  split_pct: number | null;
  fecha_cierre: string | null;
  colega_id: string | null;
}

type Tab = "mensual" | "por_tipo" | "proyeccion";

// ── constantes ────────────────────────────────────────────────────────────────
const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const AÑOS_DISPONIBLES = [2023, 2024, 2025, 2026];

const TIPO_LABEL: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alq. Temporal",
};

const TIPO_COLOR: Record<string, string> = {
  venta: "#cc0000",
  alquiler: "#3b82f6",
  alquiler_temporal: "#f59e0b",
};

const TIPO_COLOR_FILL: Record<string, string> = {
  venta: "rgba(204,0,0,0.85)",
  alquiler: "rgba(59,130,246,0.85)",
  alquiler_temporal: "rgba(245,158,11,0.85)",
};

// ── helpers ───────────────────────────────────────────────────────────────────
function honorariosBrutoUSD(op: Operacion, tc: number): number {
  const precio = op.valor_operacion ?? 0;
  const pct = op.honorarios_pct ?? 0;
  const raw = precio * (pct / 100);
  return op.moneda === "ARS" ? raw / tc : raw;
}

function honorariosNetaUSD(op: Operacion, tc: number): number {
  const bruto = honorariosBrutoUSD(op, tc);
  const split = op.split_pct ?? 0;
  return bruto * (1 - split / 100);
}

function fmtUSD(n: number): string {
  if (n >= 1000) return `USD ${(n / 1000).toFixed(1)}K`;
  return `USD ${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtUSDFull(n: number): string {
  return `USD ${Math.round(n).toLocaleString("es-AR")}`;
}

function mesAnioKey(fecha: string): { mes: number; anio: number } {
  const d = new Date(fecha + "T12:00");
  return { mes: d.getMonth(), anio: d.getFullYear() };
}

// ── componente principal ──────────────────────────────────────────────────────
export default function RevenuePage() {
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mensual");
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [tcInput, setTcInput] = useState("1300");
  const [anio, setAnio] = useState(2026);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; label: string; valor: string } | null>(null);

  // ── carga de datos ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: sbError } = await supabase
          .from("crm_negocios")
          .select("id,tipo_operacion,etapa,valor_operacion,moneda,honorarios_pct,split_pct,fecha_cierre,colega_id")
          .eq("etapa", "cerrado");

        if (sbError) throw sbError;
        setOperaciones((data ?? []) as Operacion[]);
      } catch {
        setError("No se pudieron cargar los datos. Verificá tu conexión.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const tc = tipoCambio;

  // ── métricas globales ──────────────────────────────────────────────────────
  const metricas = useMemo(() => {
    const opsAnio = operaciones.filter(op => {
      if (!op.fecha_cierre) return false;
      return mesAnioKey(op.fecha_cierre).anio === anio;
    });

    const totalYTD = opsAnio.reduce((s, op) => s + honorariosNetaUSD(op, tc), 0);

    // Honorarios netos por mes para el año seleccionado
    const porMes: number[] = Array(12).fill(0);
    opsAnio.forEach(op => {
      if (!op.fecha_cierre) return;
      const { mes } = mesAnioKey(op.fecha_cierre);
      porMes[mes] += honorariosNetaUSD(op, tc);
    });

    let mejorMesIdx = 0;
    let mejorMesValor = 0;
    porMes.forEach((v, i) => {
      if (v > mejorMesValor) { mejorMesValor = v; mejorMesIdx = i; }
    });

    const opsCerradas = opsAnio.length;
    const ticketPromedio = opsCerradas > 0 ? totalYTD / opsCerradas : 0;

    return { totalYTD, porMes, mejorMesIdx, mejorMesValor, opsCerradas, ticketPromedio };
  }, [operaciones, anio, tc]);

  // ── datos por tipo (para el año seleccionado) ──────────────────────────────
  const datosPorTipo = useMemo(() => {
    const opsAnio = operaciones.filter(op => {
      if (!op.fecha_cierre) return false;
      return mesAnioKey(op.fecha_cierre).anio === anio;
    });

    const mapa: Record<string, { count: number; total: number }> = {};
    opsAnio.forEach(op => {
      const tipo = op.tipo_operacion ?? "otro";
      if (!mapa[tipo]) mapa[tipo] = { count: 0, total: 0 };
      mapa[tipo].count++;
      mapa[tipo].total += honorariosNetaUSD(op, tc);
    });

    return Object.entries(mapa).sort((a, b) => b[1].total - a[1].total);
  }, [operaciones, anio, tc]);

  // ── datos de proyección (últimos 3 meses → próximos 3) ────────────────────
  const datosProyeccion = useMemo(() => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    // Reales: últimos 12 meses + mes actual
    const historico: { label: string; valor: number; esProyeccion: boolean }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(anioActual, mesActual - i, 1);
      const m = d.getMonth();
      const a = d.getFullYear();
      const valor = operaciones
        .filter(op => {
          if (!op.fecha_cierre) return false;
          const k = mesAnioKey(op.fecha_cierre);
          return k.mes === m && k.anio === a;
        })
        .reduce((s, op) => s + honorariosNetaUSD(op, tc), 0);
      historico.push({ label: `${MESES_CORTOS[m]} ${a}`, valor, esProyeccion: false });
    }

    // Promedio de los últimos 3 meses reales
    const ultimos3 = historico.slice(-3).map(h => h.valor);
    const promedio = ultimos3.reduce((s, v) => s + v, 0) / 3;

    // Proyección: próximos 3 meses
    for (let i = 1; i <= 3; i++) {
      const d = new Date(anioActual, mesActual + i, 1);
      const m = d.getMonth();
      const a = d.getFullYear();
      historico.push({ label: `${MESES_CORTOS[m]} ${a}`, valor: promedio, esProyeccion: true });
    }

    return historico;
  }, [operaciones, tc]);

  // ── helper para pie SVG ────────────────────────────────────────────────────
  const calcPieSegments = useCallback(() => {
    const total = datosPorTipo.reduce((s, [, d]) => s + d.total, 0);
    if (total === 0) return [];

    const cx = 110; const cy = 110; const r = 90;
    let startAngle = -Math.PI / 2;
    return datosPorTipo.map(([tipo, d]) => {
      const pct = d.total / total;
      const angle = pct * 2 * Math.PI;
      const endAngle = startAngle + angle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      const midAngle = startAngle + angle / 2;
      const lx = cx + (r + 18) * Math.cos(midAngle);
      const ly = cy + (r + 18) * Math.sin(midAngle);

      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const prev = startAngle;
      startAngle = endAngle;

      return { tipo, path, pct, lx, ly, midAngle, startAngle: prev };
    });
  }, [datosPorTipo]);

  const pieSegments = useMemo(() => calcPieSegments(), [calcPieSegments]);

  // ── max valor para charts ──────────────────────────────────────────────────
  const maxMensual = useMemo(() =>
    Math.max(...metricas.porMes, 1),
  [metricas.porMes]);

  const maxProyeccion = useMemo(() =>
    Math.max(...datosProyeccion.map(d => d.valor), 1),
  [datosProyeccion]);

  // ── evento tipo de cambio ──────────────────────────────────────────────────
  const handleTcBlur = () => {
    const parsed = parseInt(tcInput.replace(/\D/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      setTipoCambio(parsed);
    } else {
      setTcInput(String(tipoCambio));
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 0 80px", fontFamily: "Inter, sans-serif", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        .rev-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 7px; color: #fff; padding: 8px 12px; font-size: 13px; font-family: Inter,sans-serif; outline: none; }
        .rev-input:focus { border-color: rgba(204,0,0,0.45); }
        .rev-select { background: #111; border: 1px solid rgba(255,255,255,0.12); border-radius: 7px; color: #fff; padding: 8px 12px; font-size: 13px; font-family: Inter,sans-serif; outline: none; cursor: pointer; }
        .rev-tab { padding: 8px 18px; border-radius: 7px; font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; border: 1px solid transparent; transition: background 0.15s, color 0.15s; }
        .rev-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; }
        .rev-bar-rect { transition: opacity 0.15s; }
        .rev-bar-rect:hover { opacity: 0.8; }
        @keyframes revFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .rev-fadein { animation: revFadeIn 0.3s ease both; }
        @keyframes revSkeleton { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        .rev-skeleton { animation: revSkeleton 1.2s ease-in-out infinite; background: rgba(255,255,255,0.07); border-radius: 8px; }
        @media (max-width: 620px) {
          .rev-cards-grid { grid-template-columns: repeat(2,1fr) !important; }
          .rev-tipo-layout { flex-direction: column !important; }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: 6 }}>
            CRM — Ingresos
          </div>
          <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.1 }}>
            Revenue <span style={{ color: "#cc0000" }}>Dashboard</span>
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", marginTop: 5, marginBottom: 0 }}>
            Honorarios netos de operaciones cerradas
          </p>
        </div>

        {/* controles globales */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              USD/ARS
            </span>
            <input
              className="rev-input"
              style={{ width: 90 }}
              type="text"
              inputMode="numeric"
              value={tcInput}
              onChange={e => setTcInput(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={handleTcBlur}
              onKeyDown={e => { if (e.key === "Enter") handleTcBlur(); }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              Año
            </span>
            <select
              className="rev-select"
              value={anio}
              onChange={e => setAnio(parseInt(e.target.value, 10))}
            >
              {AÑOS_DISPONIBLES.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Summary Cards (siempre visibles) ─────────────────────────────── */}
      {loading ? (
        <div className="rev-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
          {[0,1,2,3].map(i => (
            <div key={i} className="rev-skeleton" style={{ height: 86 }} />
          ))}
        </div>
      ) : (
        <div className="rev-cards-grid rev-fadein" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
          {[
            {
              label: "Total YTD",
              valor: fmtUSDFull(metricas.totalYTD),
              sub: `Año ${anio}`,
              color: "#fff",
            },
            {
              label: "Mejor mes",
              valor: metricas.mejorMesValor > 0 ? fmtUSD(metricas.mejorMesValor) : "—",
              sub: metricas.mejorMesValor > 0 ? MESES_CORTOS[metricas.mejorMesIdx] : "Sin datos",
              color: "#cc0000",
            },
            {
              label: "Ticket promedio",
              valor: metricas.opsCerradas > 0 ? fmtUSD(metricas.ticketPromedio) : "—",
              sub: "por operación",
              color: "#3b82f6",
            },
            {
              label: "Ops. cerradas",
              valor: String(metricas.opsCerradas),
              sub: `en ${anio}`,
              color: "#f59e0b",
            },
          ].map(card => (
            <div key={card.label} className="rev-card">
              <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                {card.label}
              </div>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: card.color, lineHeight: 1, marginBottom: 5 }}>
                {card.valor}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
                {card.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {([
          { key: "mensual", label: "Mensual" },
          { key: "por_tipo", label: "Por Tipo" },
          { key: "proyeccion", label: "Proyección" },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            className="rev-tab"
            style={{
              background: tab === t.key ? "#cc0000" : "rgba(255,255,255,0.05)",
              color: tab === t.key ? "#fff" : "rgba(255,255,255,0.4)",
              border: tab === t.key ? "1px solid #cc0000" : "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="rev-skeleton" style={{ height: 260 }} />
          <div className="rev-skeleton" style={{ height: 160 }} />
        </div>
      ) : error ? (
        <div className="rev-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>!</div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 15, color: "#cc0000", marginBottom: 6 }}>
            Error al cargar datos
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{error}</div>
        </div>
      ) : operaciones.length === 0 ? (
        <div className="rev-card" style={{ textAlign: "center", padding: "64px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>$</div>
          <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 16, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
            Sin operaciones cerradas
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", maxWidth: 320, margin: "0 auto", lineHeight: 1.6 }}>
            Cuando existan negocios con estado <strong style={{ color: "rgba(255,255,255,0.4)" }}>cerrado</strong> en el CRM,
            los ingresos aparecerán aquí.
          </div>
        </div>
      ) : (
        <div className="rev-fadein">

          {/* ══ TAB: MENSUAL ════════════════════════════════════════════════ */}
          {tab === "mensual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Bar chart SVG */}
              <div className="rev-card" style={{ position: "relative" }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 18 }}>
                  Honorarios netos USD · {anio}
                </div>

                <div style={{ overflowX: "auto" }}>
                  <svg
                    width="100%"
                    height={220}
                    viewBox="0 0 800 220"
                    preserveAspectRatio="none"
                    style={{ display: "block", minWidth: 400 }}
                  >
                    {/* Líneas guía Y */}
                    {[0.25, 0.5, 0.75, 1].map(frac => {
                      const y = 180 - frac * 150;
                      const val = maxMensual * frac;
                      return (
                        <g key={frac}>
                          <line x1={40} y1={y} x2={790} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                          <text x={35} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize={9} fontFamily="Montserrat,sans-serif">
                            {val >= 1000 ? `${(val/1000).toFixed(0)}K` : Math.round(val).toString()}
                          </text>
                        </g>
                      );
                    })}

                    {/* Eje X base */}
                    <line x1={40} y1={180} x2={790} y2={180} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

                    {/* Barras */}
                    {metricas.porMes.map((valor, i) => {
                      const barWidth = 48;
                      const slotWidth = (750) / 12;
                      const x = 40 + i * slotWidth + (slotWidth - barWidth) / 2;
                      const barH = Math.max(valor > 0 ? 3 : 0, (valor / maxMensual) * 150);
                      const y = 180 - barH;

                      return (
                        <g key={i}>
                          {valor > 0 && (
                            <rect
                              className="rev-bar-rect"
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barH}
                              fill="#cc0000"
                              rx={4}
                              onMouseEnter={(e) => {
                                const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
                                if (!svg) return;
                                const rect = svg.getBoundingClientRect();
                                const svgW = rect.width;
                                // map viewBox x to screen x
                                const screenX = rect.left + (x + barWidth / 2) / 800 * svgW;
                                const screenY = rect.top + (y) / 220 * rect.height;
                                setTooltip({
                                  visible: true,
                                  x: screenX,
                                  y: screenY,
                                  label: MESES_CORTOS[i],
                                  valor: fmtUSDFull(valor),
                                });
                              }}
                              onMouseLeave={() => setTooltip(null)}
                              style={{ cursor: "crosshair" }}
                            />
                          )}
                          {/* Valor encima de la barra */}
                          {valor > 0 && (
                            <text
                              x={x + barWidth / 2}
                              y={y - 5}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.55)"
                              fontSize={8}
                              fontFamily="Montserrat,sans-serif"
                            >
                              {valor >= 1000 ? `${(valor/1000).toFixed(1)}K` : Math.round(valor).toString()}
                            </text>
                          )}
                          {/* Label mes */}
                          <text
                            x={x + barWidth / 2}
                            y={196}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.3)"
                            fontSize={9}
                            fontFamily="Montserrat,sans-serif"
                          >
                            {MESES_CORTOS[i]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Tooltip flotante */}
                {tooltip?.visible && (
                  <div
                    style={{
                      position: "fixed",
                      left: tooltip.x,
                      top: tooltip.y - 48,
                      transform: "translateX(-50%)",
                      background: "#1a1a1a",
                      border: "1px solid rgba(204,0,0,0.4)",
                      borderRadius: 8,
                      padding: "7px 12px",
                      pointerEvents: "none",
                      zIndex: 9000,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                      {tooltip.label} {anio}
                    </div>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 13, color: "#cc0000" }}>
                      {tooltip.valor}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabla mensual */}
              <div className="rev-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
                  Detalle por mes
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter,sans-serif" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {["Mes", "Ops.", "Hon. Bruto USD", "Hon. Neto USD", "% del año"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: h === "Mes" ? "left" : "right", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metricas.porMes.map((neto, i) => {
                        const opsDelMes = operaciones.filter(op => {
                          if (!op.fecha_cierre) return false;
                          const k = mesAnioKey(op.fecha_cierre);
                          return k.mes === i && k.anio === anio;
                        });
                        const bruto = opsDelMes.reduce((s, op) => s + honorariosBrutoUSD(op, tc), 0);
                        const pct = metricas.totalYTD > 0 ? (neto / metricas.totalYTD) * 100 : 0;
                        const esMejor = i === metricas.mejorMesIdx && metricas.mejorMesValor > 0;

                        return (
                          <tr
                            key={i}
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: esMejor ? "rgba(204,0,0,0.04)" : "transparent" }}
                          >
                            <td style={{ padding: "9px 12px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: esMejor ? "#cc0000" : "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                              {MESES_CORTOS[i]}
                              {esMejor && <span style={{ fontSize: 8, background: "rgba(204,0,0,0.15)", border: "1px solid rgba(204,0,0,0.3)", borderRadius: 4, padding: "1px 5px", color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.06em" }}>TOP</span>}
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: opsDelMes.length > 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }}>
                              {opsDelMes.length}
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>
                              {bruto > 0 ? fmtUSDFull(bruto) : "—"}
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: neto > 0 ? "#fff" : "rgba(255,255,255,0.2)" }}>
                              {neto > 0 ? fmtUSDFull(neto) : "—"}
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                              {pct > 0 ? `${pct.toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                        <td colSpan={2} style={{ padding: "10px 12px", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Total {anio}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "rgba(255,255,255,0.6)" }}>
                          {fmtUSDFull(operaciones.filter(op => op.fecha_cierre && mesAnioKey(op.fecha_cierre).anio === anio).reduce((s, op) => s + honorariosBrutoUSD(op, tc), 0))}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#cc0000" }}>
                          {fmtUSDFull(metricas.totalYTD)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
                          100%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: POR TIPO ════════════════════════════════════════════════ */}
          {tab === "por_tipo" && (
            <div>
              {datosPorTipo.length === 0 ? (
                <div className="rev-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                    Sin datos para {anio}
                  </div>
                </div>
              ) : (
                <div className="rev-tipo-layout" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

                  {/* Pie SVG */}
                  <div className="rev-card" style={{ flex: "0 0 auto", minWidth: 260 }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
                      Distribución por tipo
                    </div>

                    <svg width={220} height={220} viewBox="0 0 220 220" style={{ display: "block", margin: "0 auto" }}>
                      {/* Fondo de donut */}
                      <circle cx={110} cy={110} r={90} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

                      {pieSegments.map(seg => (
                        <path
                          key={seg.tipo}
                          d={seg.path}
                          fill={TIPO_COLOR_FILL[seg.tipo] ?? "rgba(150,150,150,0.7)"}
                          stroke="#0a0a0a"
                          strokeWidth={2}
                          style={{ cursor: "default" }}
                        />
                      ))}

                      {/* Círculo interior (donut effect) */}
                      <circle cx={110} cy={110} r={52} fill="#0a0a0a" />

                      {/* Texto central */}
                      <text x={110} y={105} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="Montserrat,sans-serif" fontWeight={700} letterSpacing="0.08em">
                        TOTAL
                      </text>
                      <text x={110} y={120} textAnchor="middle" fill="#fff" fontSize={11} fontFamily="Montserrat,sans-serif" fontWeight={800}>
                        {fmtUSD(datosPorTipo.reduce((s, [, d]) => s + d.total, 0))}
                      </text>

                      {/* Etiquetas de porcentaje */}
                      {pieSegments.map(seg => {
                        const show = seg.pct > 0.08;
                        if (!show) return null;
                        return (
                          <text
                            key={`lbl-${seg.tipo}`}
                            x={seg.lx}
                            y={seg.ly}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize={8}
                            fontFamily="Montserrat,sans-serif"
                            fontWeight={700}
                          >
                            {(seg.pct * 100).toFixed(0)}%
                          </text>
                        );
                      })}
                    </svg>

                    {/* Leyenda */}
                    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
                      {datosPorTipo.map(([tipo]) => (
                        <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: TIPO_COLOR_FILL[tipo] ?? "#888", flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter,sans-serif" }}>
                            {TIPO_LABEL[tipo] ?? tipo}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tabla por tipo */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="rev-card">
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
                        Honorarios netos por tipo · {anio}
                      </div>

                      {datosPorTipo.map(([tipo, datos]) => {
                        const totalTodos = datosPorTipo.reduce((s, [, d]) => s + d.total, 0);
                        const pct = totalTodos > 0 ? (datos.total / totalTodos) * 100 : 0;
                        const color = TIPO_COLOR[tipo] ?? "#888";

                        return (
                          <div key={tipo} style={{ marginBottom: 18 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, color: "#fff" }}>
                                  {TIPO_LABEL[tipo] ?? tipo}
                                </span>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
                                  {datos.count} op{datos.count !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                                <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 15, color }}>
                                  {fmtUSDFull(datos.total)}
                                </span>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                                  {pct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            {/* Barra de progreso */}
                            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
                            </div>
                            {/* Ticket promedio */}
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
                              Promedio por op.: {datos.count > 0 ? fmtUSD(datos.total / datos.count) : "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tabla detalle */}
                    <div className="rev-card">
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
                        Resumen tabla
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                            {["Tipo", "Ops.", "Neto USD", "Promedio", "% Total"].map(h => (
                              <th key={h} style={{ padding: "7px 10px", textAlign: h === "Tipo" ? "left" : "right", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {datosPorTipo.map(([tipo, datos]) => {
                            const totalTodos = datosPorTipo.reduce((s, [, d]) => s + d.total, 0);
                            const pct = totalTodos > 0 ? (datos.total / totalTodos) * 100 : 0;
                            const color = TIPO_COLOR[tipo] ?? "#888";
                            return (
                              <tr key={tipo} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "9px 10px", display: "flex", alignItems: "center", gap: 7 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                                  <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: "#fff" }}>
                                    {TIPO_LABEL[tipo] ?? tipo}
                                  </span>
                                </td>
                                <td style={{ padding: "9px 10px", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>{datos.count}</td>
                                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color }}>{fmtUSDFull(datos.total)}</td>
                                <td style={{ padding: "9px 10px", textAlign: "right", color: "rgba(255,255,255,0.45)" }}>{datos.count > 0 ? fmtUSD(datos.total / datos.count) : "—"}</td>
                                <td style={{ padding: "9px 10px", textAlign: "right", color: "rgba(255,255,255,0.35)" }}>{pct.toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB: PROYECCIÓN ═════════════════════════════════════════════ */}
          {tab === "proyeccion" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Info card */}
              <div style={{ background: "rgba(204,0,0,0.06)", border: "1px solid rgba(204,0,0,0.15)", borderRadius: 10, padding: "12px 18px", fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "Inter,sans-serif", lineHeight: 1.6 }}>
                Proyección calculada sobre el promedio de honorarios netos de los <strong style={{ color: "rgba(255,255,255,0.7)" }}>últimos 3 meses</strong> con datos reales.
                Las barras punteadas muestran la proyección de los próximos 3 meses.
              </div>

              {/* SVG combinado real + proyección */}
              <div className="rev-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <span>Histórico + Proyección (15 meses)</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 12, height: 8, background: "#cc0000", borderRadius: 2 }} />
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Real</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 12, height: 8, background: "rgba(100,160,255,0.5)", borderRadius: 2, border: "1px dashed rgba(100,160,255,0.8)" }} />
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Proyectado</span>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <svg
                    width="100%"
                    height={220}
                    viewBox="0 0 800 220"
                    preserveAspectRatio="none"
                    style={{ display: "block", minWidth: 500 }}
                  >
                    {/* Líneas guía Y */}
                    {[0.25, 0.5, 0.75, 1].map(frac => {
                      const y = 180 - frac * 150;
                      const val = maxProyeccion * frac;
                      return (
                        <g key={frac}>
                          <line x1={45} y1={y} x2={795} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                          <text x={40} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={8} fontFamily="Montserrat,sans-serif">
                            {val >= 1000 ? `${(val/1000).toFixed(0)}K` : Math.round(val).toString()}
                          </text>
                        </g>
                      );
                    })}

                    {/* Eje base */}
                    <line x1={45} y1={180} x2={795} y2={180} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

                    {/* Línea divisoria real/proyección */}
                    {(() => {
                      const primeraProyIdx = datosProyeccion.findIndex(d => d.esProyeccion);
                      if (primeraProyIdx < 0) return null;
                      const slotWidth = 750 / datosProyeccion.length;
                      const xDiv = 45 + primeraProyIdx * slotWidth;
                      return (
                        <line
                          x1={xDiv}
                          y1={15}
                          x2={xDiv}
                          y2={185}
                          stroke="rgba(100,160,255,0.2)"
                          strokeWidth={1}
                          strokeDasharray="4,4"
                        />
                      );
                    })()}

                    {/* Barras */}
                    {datosProyeccion.map((d, i) => {
                      const n = datosProyeccion.length;
                      const slotWidth = 750 / n;
                      const barWidth = Math.max(12, slotWidth - 8);
                      const x = 45 + i * slotWidth + (slotWidth - barWidth) / 2;
                      const barH = Math.max(d.valor > 0 ? 3 : 0, (d.valor / maxProyeccion) * 150);
                      const y = 180 - barH;

                      if (d.esProyeccion) {
                        // Barra de proyección: azul punteada
                        return (
                          <g key={i}>
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barH}
                              fill="rgba(100,160,255,0.18)"
                              stroke="rgba(100,160,255,0.7)"
                              strokeWidth={1.5}
                              strokeDasharray="4,3"
                              rx={3}
                            />
                            {d.valor > 0 && (
                              <text
                                x={x + barWidth / 2}
                                y={y - 5}
                                textAnchor="middle"
                                fill="rgba(100,160,255,0.7)"
                                fontSize={8}
                                fontFamily="Montserrat,sans-serif"
                              >
                                {d.valor >= 1000 ? `${(d.valor/1000).toFixed(1)}K` : Math.round(d.valor).toString()}
                              </text>
                            )}
                            <text
                              x={x + barWidth / 2}
                              y={196}
                              textAnchor="middle"
                              fill="rgba(100,160,255,0.45)"
                              fontSize={8}
                              fontFamily="Montserrat,sans-serif"
                            >
                              {d.label}
                            </text>
                          </g>
                        );
                      }

                      return (
                        <g key={i}>
                          {d.valor > 0 && (
                            <rect
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barH}
                              fill="#cc0000"
                              fillOpacity={0.8}
                              rx={3}
                            />
                          )}
                          {d.valor > 0 && (
                            <text
                              x={x + barWidth / 2}
                              y={y - 5}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.45)"
                              fontSize={8}
                              fontFamily="Montserrat,sans-serif"
                            >
                              {d.valor >= 1000 ? `${(d.valor/1000).toFixed(1)}K` : Math.round(d.valor).toString()}
                            </text>
                          )}
                          <text
                            x={x + barWidth / 2}
                            y={196}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.25)"
                            fontSize={8}
                            fontFamily="Montserrat,sans-serif"
                          >
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Cards proyección */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
                {(() => {
                  const ultimos3Reales = datosProyeccion.filter(d => !d.esProyeccion).slice(-3);
                  const promedio = ultimos3Reales.length > 0
                    ? ultimos3Reales.reduce((s, d) => s + d.valor, 0) / ultimos3Reales.length
                    : 0;
                  const proyeccionTotal = promedio * 3;
                  const tendencia = (() => {
                    if (ultimos3Reales.length < 2) return 0;
                    const primero = ultimos3Reales[0].valor;
                    const ultimo = ultimos3Reales[ultimos3Reales.length - 1].valor;
                    return primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;
                  })();

                  return [
                    {
                      label: "Promedio últimos 3 meses",
                      valor: promedio > 0 ? fmtUSDFull(promedio) : "Sin datos",
                      sub: "base de proyección",
                      color: "#fff",
                    },
                    {
                      label: "Proyección próximos 3 meses",
                      valor: proyeccionTotal > 0 ? fmtUSDFull(proyeccionTotal) : "—",
                      sub: "asumiendo tendencia constante",
                      color: "rgba(100,160,255,0.9)",
                    },
                    {
                      label: "Tendencia reciente",
                      valor: tendencia > 0 ? `+${tendencia.toFixed(1)}%` : tendencia < 0 ? `${tendencia.toFixed(1)}%` : "—",
                      sub: "vs. 3 meses anteriores",
                      color: tendencia > 0 ? "#22c55e" : tendencia < 0 ? "#ef4444" : "rgba(255,255,255,0.4)",
                    },
                  ].map(card => (
                    <div key={card.label} className="rev-card">
                      <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                        {card.label}
                      </div>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: card.color, lineHeight: 1, marginBottom: 5 }}>
                        {card.valor}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                        {card.sub}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Tabla detalle proyección */}
              <div className="rev-card">
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
                  Detalle 15 meses
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        {["Período", "Tipo", "Honorario Neto USD"].map(h => (
                          <th key={h} style={{ padding: "7px 12px", textAlign: h === "Honorario Neto USD" ? "right" : "left", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {datosProyeccion.map((d, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: d.esProyeccion ? "rgba(100,160,255,0.03)" : "transparent" }}>
                          <td style={{ padding: "8px 12px", fontFamily: "Montserrat,sans-serif", fontWeight: 600, color: d.esProyeccion ? "rgba(100,160,255,0.8)" : "#fff" }}>
                            {d.label}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {d.esProyeccion ? (
                              <span style={{ fontSize: 10, background: "rgba(100,160,255,0.1)", border: "1px solid rgba(100,160,255,0.25)", borderRadius: 4, padding: "2px 7px", color: "rgba(100,160,255,0.8)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                                PROYECTADO
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 4, padding: "2px 7px", color: "rgba(204,0,0,0.8)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                                REAL
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: d.esProyeccion ? "rgba(100,160,255,0.8)" : (d.valor > 0 ? "#fff" : "rgba(255,255,255,0.2)") }}>
                            {d.valor > 0 ? fmtUSDFull(d.valor) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
