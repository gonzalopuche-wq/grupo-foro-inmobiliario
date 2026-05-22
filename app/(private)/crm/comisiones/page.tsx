"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  valor_operacion: number | null;
  honorarios_pct: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  created_at: string | null;
  tipo_operacion: string | null;
  contacto_id: string | null;
}

interface ComisionRow {
  id: string;
  titulo: string;
  etapa: string;
  valor: number;
  pct: number;
  comision: number;
  moneda: string;
  fecha: string | null;
  tipo: string | null;
  realizada: boolean;
  mesAnio: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mesAnioStr(fecha: string | null, fallback: string): string {
  if (!fecha) return fallback;
  const [y, m] = fecha.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${meses[parseInt(m) - 1]} ${y}`;
}

function mesAnioKey(fecha: string | null): string {
  if (!fecha) return "Sin fecha";
  return fecha.substring(0, 7);
}

const ETAPAS_CERRADAS = ["cerrado", "escriturado", "escritura", "firmado"];
const ETAPAS_PIPELINE = ["prospecto","contactado","visita_coordinada","visita_realizada","oferta_enviada","negociacion","reserva"];

const COLORES_ETAPA: Record<string, string> = {
  prospecto: "#6b7280", contactado: "#3b82f6", visita_coordinada: "#8b5cf6",
  visita_realizada: "#a78bfa", oferta_enviada: "#f59e0b", negociacion: "#f97316",
  reserva: "#22c55e", cerrado: "#22c55e", escriturado: "#22c55e", firmado: "#22c55e",
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function PanelComisiones() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [vistaMode, setVistaMode] = useState<"tabla" | "mensual">("mensual");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "realizadas" | "pipeline">("todos");
  const [anioFiltro, setAnioFiltro] = useState<string>("todos");

  useEffect(() => {
    supabase
      .from("crm_negocios")
      .select("id,titulo,etapa,valor_operacion,honorarios_pct,moneda,fecha_cierre,created_at,tipo_operacion,contacto_id")
      .order("fecha_cierre", { ascending: false })
      .then(({ data }) => {
        setNegocios((data ?? []) as Negocio[]);
        setLoading(false);
      });
  }, []);

  const hoy = new Date().toISOString().substring(0, 7);

  const filas = useMemo<ComisionRow[]>(() => {
    return negocios
      .filter(n => (n.valor_operacion ?? 0) > 0)
      .map(n => {
        const valor = n.valor_operacion ?? 0;
        const pct = n.honorarios_pct ?? 3;
        const comision = valor * pct / 100;
        const realizada = ETAPAS_CERRADAS.includes(n.etapa);
        const fecha = realizada ? n.fecha_cierre : null;
        return {
          id: n.id,
          titulo: n.titulo,
          etapa: n.etapa,
          valor,
          pct,
          comision,
          moneda: n.moneda ?? "USD",
          fecha,
          tipo: n.tipo_operacion,
          realizada,
          mesAnio: mesAnioKey(fecha ?? n.created_at),
        };
      });
  }, [negocios]);

  const filasFiltradas = useMemo(() => {
    let f = filas;
    if (filtroEstado === "realizadas") f = f.filter(x => x.realizada);
    if (filtroEstado === "pipeline") f = f.filter(x => !x.realizada);
    if (anioFiltro !== "todos") f = f.filter(x => x.mesAnio.startsWith(anioFiltro));
    return f;
  }, [filas, filtroEstado, anioFiltro]);

  const kpis = useMemo(() => {
    const realizadas = filas.filter(f => f.realizada);
    const pipeline = filas.filter(f => !f.realizada);
    const totalRealizado = realizadas.reduce((s, f) => s + f.comision, 0);
    const totalPipeline = pipeline.reduce((s, f) => s + f.comision, 0);
    const promedio = realizadas.length > 0 ? totalRealizado / realizadas.length : 0;
    const ytd = realizadas.filter(f => f.fecha && f.fecha.startsWith(new Date().getFullYear().toString()))
      .reduce((s, f) => s + f.comision, 0);
    return { totalRealizado, totalPipeline, promedio, ytd, countRealizado: realizadas.length, countPipeline: pipeline.length };
  }, [filas]);

  // Agrupar por mes para vista mensual
  const porMes = useMemo(() => {
    const mapa: Record<string, { realizadas: number; pipeline: number; count: number; key: string; label: string }> = {};
    filasFiltradas.forEach(f => {
      const key = f.mesAnio;
      if (!mapa[key]) mapa[key] = { realizadas: 0, pipeline: 0, count: 0, key, label: mesAnioStr(f.fecha, key) };
      if (f.realizada) mapa[key].realizadas += f.comision;
      else mapa[key].pipeline += f.comision;
      mapa[key].count++;
    });
    return Object.values(mapa).sort((a, b) => b.key.localeCompare(a.key)).slice(0, 18);
  }, [filasFiltradas]);

  const maxBarMes = Math.max(...porMes.map(m => m.realizadas + m.pipeline), 1);

  const aniosDisponibles = useMemo(() => {
    const set = new Set(filas.map(f => f.mesAnio.substring(0, 4)));
    return Array.from(set).sort().reverse();
  }, [filas]);

  const fmt = (n: number) => `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>💰 Panel de Comisiones</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Honorarios realizados y proyectados del pipeline</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={anioFiltro} onChange={e => setAnioFiltro(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los años</option>
            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)} style={inputStyle}>
            <option value="todos">Todos</option>
            <option value="realizadas">Realizadas</option>
            <option value="pipeline">Pipeline</option>
          </select>
          {(["tabla","mensual"] as const).map(v => (
            <button key={v} onClick={() => setVistaMode(v)} style={{
              background: vistaMode === v ? "#cc0000" : "#1a1a1a", border: "1px solid #333",
              borderRadius: 6, color: "#fff", padding: "6px 12px", fontSize: 12, cursor: "pointer",
              fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "capitalize",
            }}>{v === "tabla" ? "📋 Tabla" : "📊 Mensual"}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {[
            { label: "Realizadas (total)", val: fmt(kpis.totalRealizado), sub: `${kpis.countRealizado} operaciones`, color: "#22c55e" },
            { label: "YTD (este año)", val: fmt(kpis.ytd), sub: `${new Date().getFullYear()}`, color: "#22c55e" },
            { label: "Pipeline (proyectado)", val: fmt(kpis.totalPipeline), sub: `${kpis.countPipeline} negocios`, color: "#3b82f6" },
            { label: "Promedio por op.", val: fmt(kpis.promedio), sub: "Solo realizadas", color: "#a78bfa" },
            { label: "Total proyectado", val: fmt(kpis.totalRealizado + kpis.totalPipeline), sub: "Realizado + pipeline", color: "#f59e0b" },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: "#111", border: `1px solid ${kpi.color}33`, borderRadius: 10, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, marginTop: 4 }}>{kpi.val}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 48 }}>Cargando...</div>
        ) : vistaMode === "mensual" ? (
          /* Vista mensual con barras */
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 14, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
              Comisiones por mes
            </h2>
            {porMes.length === 0 ? (
              <div style={{ color: "#666", textAlign: "center", padding: 24 }}>Sin datos para los filtros seleccionados</div>
            ) : porMes.map(mes => (
              <div key={mes.key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#ccc", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>{mes.label}</span>
                  <span style={{ fontSize: 12, color: "#888" }}>
                    {mes.realizadas > 0 && <span style={{ color: "#22c55e" }}>{fmt(mes.realizadas)}</span>}
                    {mes.realizadas > 0 && mes.pipeline > 0 && <span style={{ color: "#555" }}> + </span>}
                    {mes.pipeline > 0 && <span style={{ color: "#3b82f6" }}>{fmt(mes.pipeline)}</span>}
                    <span style={{ color: "#555" }}> — {mes.count} neg.</span>
                  </span>
                </div>
                <div style={{ height: 20, background: "#1a1a1a", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                  {mes.realizadas > 0 && (
                    <div style={{
                      width: `${(mes.realizadas / maxBarMes) * 100}%`, background: "#22c55e",
                      minWidth: 2, borderRadius: "4px 0 0 4px",
                    }} />
                  )}
                  {mes.pipeline > 0 && (
                    <div style={{
                      width: `${(mes.pipeline / maxBarMes) * 100}%`, background: "#3b82f680",
                      borderRadius: mes.realizadas > 0 ? "0 4px 4px 0" : 4,
                    }} />
                  )}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
              {[{ color: "#22c55e", label: "Realizadas" }, { color: "#3b82f680", label: "Pipeline" }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#888" }}>
                  <div style={{ width: 12, height: 12, background: l.color, borderRadius: 2 }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Vista tabla */
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #222" }}>
                  {["Negocio","Tipo","Etapa","Valor op.","Hon. %","Comisión","Mes"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#555" }}>Sin negocios con valor definido</td></tr>
                ) : filasFiltradas.map((f, i) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #1a1a1a", background: i % 2 === 0 ? "#0d0d0d" : "transparent" }}>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ fontSize: 13, color: "#fff" }}>{f.titulo}</div>
                      {!f.realizada && <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>Pipeline</div>}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: "#888" }}>{f.tipo ?? "—"}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{
                        fontSize: 11, fontFamily: "Montserrat, sans-serif", fontWeight: 700, padding: "2px 8px",
                        borderRadius: 4, background: `${COLORES_ETAPA[f.etapa] ?? "#333"}20`,
                        color: COLORES_ETAPA[f.etapa] ?? "#888",
                      }}>{f.etapa}</span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#ccc" }}>
                      {f.moneda === "ARS" ? "$ " : "USD "}{f.valor.toLocaleString("es-AR")}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#888" }}>{fmtPct(f.pct)}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: f.realizada ? "#22c55e" : "#3b82f6" }}>
                      {fmt(f.comision)}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: "#666" }}>
                      {f.fecha ? mesAnioStr(f.fecha, f.mesAnio) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filasFiltradas.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid #222", background: "#0d0d0d" }}>
                    <td colSpan={5} style={{ padding: "10px 16px", fontSize: 12, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      TOTAL ({filasFiltradas.length} negocios)
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      {fmt(filasFiltradas.reduce((s, f) => s + f.comision, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Ranking por tipo */}
        {!loading && (() => {
          const porTipo: Record<string, { total: number; count: number }> = {};
          filas.filter(f => f.realizada).forEach(f => {
            const k = f.tipo ?? "Sin tipo";
            if (!porTipo[k]) porTipo[k] = { total: 0, count: 0 };
            porTipo[k].total += f.comision;
            porTipo[k].count++;
          });
          const ranking = Object.entries(porTipo).sort((a, b) => b[1].total - a[1].total);
          if (ranking.length === 0) return null;
          const maxTipo = Math.max(...ranking.map(r => r[1].total), 1);
          return (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 14, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                Ranking por tipo de operación
              </h2>
              {ranking.map(([tipo, { total, count }]) => (
                <div key={tipo} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#ccc" }}>{tipo}</span>
                    <span style={{ fontSize: 12, color: "#888" }}>{fmt(total)} <span style={{ color: "#555" }}>({count} op.)</span></span>
                  </div>
                  <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(total / maxTipo) * 100}%`, background: "#cc0000", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
