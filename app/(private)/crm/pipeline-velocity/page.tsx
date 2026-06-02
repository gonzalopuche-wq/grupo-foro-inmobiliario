"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string;
  contacto_id: string | null;
  honorarios_pct: number | null;
  created_at: string;
  updated_at: string;
  fecha_cierre: string | null;
}

interface Interaccion {
  negocio_id: string | null;
  created_at: string;
}

// ── Config de etapas ─────────────────────────────────────────────────────────

const ETAPAS = [
  { value: "prospecto",           label: "Prospecto",          color: "#6b7280", maxDias: 14, orden: 1 },
  { value: "contactado",          label: "Contactado",          color: "#3b82f6", maxDias: 10, orden: 2 },
  { value: "visita_coordinada",   label: "Visita Coord.",       color: "#8b5cf6", maxDias: 7,  orden: 3 },
  { value: "visita_realizada",    label: "Visita Realizada",    color: "#a78bfa", maxDias: 14, orden: 4 },
  { value: "oferta_enviada",      label: "Oferta Enviada",      color: "#d4960c", maxDias: 10, orden: 5 },
  { value: "negociacion",         label: "Negociación",         color: "#d4960c", maxDias: 21, orden: 6 },
  { value: "reserva",             label: "Reserva",             color: "#d4960c", maxDias: 30, orden: 7 },
  { value: "escritura",           label: "Escritura",           color: "#3abab6", maxDias: 45, orden: 8 },
];

const ETAPA_MAP = Object.fromEntries(ETAPAS.map(e => [e.value, e]));

function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
}

function diasLabel(d: number): string {
  if (d < 1) return "Hoy";
  if (d === 1) return "1 día";
  return `${d} días`;
}

const fmtUSD = (n: number) => `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

// ── Componente ───────────────────────────────────────────────────────────────

export default function PipelineVelocity() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"estancado" | "valor" | "etapa" | "edad">("estancado");
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todas");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const uid = data.user.id;
      const [{ data: n }, { data: i }] = await Promise.all([
        supabase.from("crm_negocios").select("id,titulo,etapa,tipo_operacion,valor_operacion,moneda,contacto_id,honorarios_pct,created_at,updated_at,fecha_cierre")
          .eq("perfil_id", uid).not("etapa", "in", '("cerrado","perdido")'),
        supabase.from("crm_interacciones").select("negocio_id,created_at").eq("perfil_id", uid).not("negocio_id", "is", null),
      ]);
      setNegocios((n ?? []) as Negocio[]);
      setInteracciones((i ?? []) as Interaccion[]);
      setLoading(false);
    });
  }, []);

  // Última interacción por negocio
  const ultimaInteraccion = useMemo(() => {
    const map: Record<string, string> = {};
    for (const i of interacciones) {
      if (!i.negocio_id) continue;
      const prev = map[i.negocio_id];
      if (!prev || i.created_at > prev) map[i.negocio_id] = i.created_at;
    }
    return map;
  }, [interacciones]);

  interface NegocioEnriquecido extends Negocio {
    diasEnPipeline: number;
    diasSinActividad: number;
    maxDias: number;
    estancado: boolean;
    criticidad: "ok" | "atencion" | "critico";
    velocidadScore: number;
  }

  const negociosEnriquecidos = useMemo<NegocioEnriquecido[]>(() => {
    return negocios.map(n => {
      const diasEnPipeline = diasDesde(n.created_at);
      const ultimaAct = ultimaInteraccion[n.id] ?? n.updated_at;
      const diasSinActividad = diasDesde(ultimaAct);
      const etapaConfig = ETAPA_MAP[n.etapa];
      const maxDias = etapaConfig?.maxDias ?? 14;
      const estancado = diasSinActividad > maxDias;
      const ratio = diasSinActividad / maxDias;
      const criticidad: "ok" | "atencion" | "critico" = ratio > 2 ? "critico" : ratio > 1 ? "atencion" : "ok";
      const velocidadScore = Math.max(0, 100 - Math.round((diasSinActividad / maxDias) * 50));
      return { ...n, diasEnPipeline, diasSinActividad, maxDias, estancado, criticidad, velocidadScore };
    });
  }, [negocios, ultimaInteraccion]);

  const filtrados = useMemo(() => {
    let lista = filtroEtapa === "todas" ? negociosEnriquecidos : negociosEnriquecidos.filter(n => n.etapa === filtroEtapa);
    if (sortBy === "estancado") lista = [...lista].sort((a, b) => b.diasSinActividad - a.diasSinActividad);
    if (sortBy === "valor") lista = [...lista].sort((a, b) => (b.valor_operacion ?? 0) - (a.valor_operacion ?? 0));
    if (sortBy === "etapa") lista = [...lista].sort((a, b) => (ETAPA_MAP[b.etapa]?.orden ?? 0) - (ETAPA_MAP[a.etapa]?.orden ?? 0));
    if (sortBy === "edad") lista = [...lista].sort((a, b) => b.diasEnPipeline - a.diasEnPipeline);
    return lista;
  }, [negociosEnriquecidos, filtroEtapa, sortBy]);

  // Stats por etapa
  const statsPorEtapa = useMemo(() => {
    return ETAPAS.map(e => {
      const ns = negociosEnriquecidos.filter(n => n.etapa === e.value);
      const estancados = ns.filter(n => n.estancado).length;
      const avgDias = ns.length > 0 ? Math.round(ns.reduce((s, n) => s + n.diasSinActividad, 0) / ns.length) : 0;
      const valorPipeline = ns.reduce((s, n) => s + (n.valor_operacion ?? 0), 0);
      return { ...e, count: ns.length, estancados, avgDias, valorPipeline };
    }).filter(e => e.count > 0 || e.orden <= 4);
  }, [negociosEnriquecidos]);

  const criticos = negociosEnriquecidos.filter(n => n.criticidad === "critico");
  const atencion = negociosEnriquecidos.filter(n => n.criticidad === "atencion");
  const ok = negociosEnriquecidos.filter(n => n.criticidad === "ok");
  const totalValor = negociosEnriquecidos.reduce((s, n) => s + (n.valor_operacion ?? 0), 0);
  const maxValorEtapa = Math.max(...statsPorEtapa.map(e => e.valorPipeline), 1);

  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "16px 18px",
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Analizando pipeline…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Pipeline Velocity</h1>
        <span style={{ background: "#d4960c", color: "#fff", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.1em" }}>ANÁLISIS</span>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>Velocidad y salud de {negocios.length} negocios activos</div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Activos", val: negocios.length, color: "#3b82f6" },
          { label: "Críticos (>2× límite)", val: criticos.length, color: criticos.length > 0 ? "#b80000" : "#3abab6" },
          { label: "En atención", val: atencion.length, color: atencion.length > 0 ? "#d4960c" : "#3abab6" },
          { label: "En buen ritmo", val: ok.length, color: "#3abab6" },
          { label: "Valor pipeline", val: totalValor > 0 ? fmtUSD(totalValor) : "—", color: "#a78bfa" },
        ].map((k, i) => (
          <div key={i} style={{ ...cardStyle, textAlign: "center", padding: "14px 12px" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Izquierda */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Funnel por etapa */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Estado por etapa</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {statsPorEtapa.map(e => (
                <div key={e.value} style={{ display: "grid", gridTemplateColumns: "140px 40px 1fr 100px 80px", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{e.label}</span>
                  </div>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: e.color, textAlign: "right" }}>{e.count}</span>
                  <div style={{ position: "relative" }}>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(e.valorPipeline / maxValorEtapa) * 100}%`, background: e.color, opacity: 0.8, borderRadius: 4 }} />
                    </div>
                    {e.estancados > 0 && (
                      <div style={{ position: "absolute", right: 0, top: -2, width: 12, height: 12, borderRadius: "50%", background: "#b80000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 8, color: "#fff", fontWeight: 800 }}>{e.estancados}</span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "right" }}>
                    {e.valorPipeline > 0 ? fmtUSD(e.valorPipeline) : "—"}
                  </span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 10, color: e.avgDias > e.maxDias ? "#b80000" : e.avgDias > e.maxDias * 0.7 ? "#d4960c" : "#3abab6", fontFamily: "Montserrat,sans-serif", fontWeight: 600 }}>
                      {e.count > 0 ? `~${e.avgDias}d` : "—"}
                    </span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}> /lím.{e.maxDias}d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de negocios */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                Negocios ({filtrados.length})
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)}
                  style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "rgba(255,255,255,0.5)", fontSize: 11, padding: "4px 8px" }}>
                  <option value="todas">Todas las etapas</option>
                  {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "rgba(255,255,255,0.5)", fontSize: 11, padding: "4px 8px" }}>
                  <option value="estancado">Más estancados</option>
                  <option value="valor">Mayor valor</option>
                  <option value="etapa">Por etapa</option>
                  <option value="edad">Más antiguos</option>
                </select>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "24px 0", fontSize: 13 }}>Sin negocios activos</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtrados.map(n => {
                  const etapaConf = ETAPA_MAP[n.etapa];
                  const critColor = n.criticidad === "critico" ? "#b80000" : n.criticidad === "atencion" ? "#d4960c" : "#3abab6";
                  const pctUsado = Math.min(100, (n.diasSinActividad / n.maxDias) * 100);
                  return (
                    <div key={n.id} style={{ background: "#111", borderRadius: 8, padding: "12px 14px", borderLeft: `3px solid ${critColor}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ background: (etapaConf?.color ?? "#6b7280") + "22", color: etapaConf?.color ?? "#6b7280", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 3 }}>
                              {etapaConf?.label ?? n.etapa}
                            </span>
                            {n.criticidad === "critico" && <span style={{ background: "#b8000020", color: "#b80000", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 7px", borderRadius: 3 }}>🔴 CRÍTICO</span>}
                            {n.criticidad === "atencion" && <span style={{ background: "#d4960c20", color: "#d4960c", fontSize: 9, fontWeight: 700, fontFamily: "Montserrat,sans-serif", padding: "2px 7px", borderRadius: 3 }}>⚠ ATENCIÓN</span>}
                          </div>
                          <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.titulo}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                            Sin actividad: <span style={{ color: critColor, fontWeight: 600 }}>{diasLabel(n.diasSinActividad)}</span>
                            <span style={{ color: "rgba(255,255,255,0.25)" }}> · límite: {n.maxDias}d · en pipeline: {diasLabel(n.diasEnPipeline)}</span>
                          </div>
                          <div style={{ marginTop: 6, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pctUsado}%`, background: critColor, borderRadius: 2, transition: "width 0.3s" }} />
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {n.valor_operacion ? (
                            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>{fmtUSD(n.valor_operacion)}</div>
                          ) : null}
                          <Link href={`/crm/negocios/${n.id}`} style={{ display: "inline-block", marginTop: 4, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 10, padding: "3px 8px", borderRadius: 4, textDecoration: "none" }}>
                            Ficha ↗
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Alertas críticas */}
          {criticos.length > 0 && (
            <div style={{ ...cardStyle, borderColor: "rgba(239,68,68,0.25)" }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b80000", marginBottom: 12 }}>🔴 Críticos — Acción urgente</div>
              {criticos.slice(0, 6).map(n => (
                <div key={n.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{n.titulo}</div>
                  <div style={{ fontSize: 10, color: "#b80000" }}>{diasLabel(n.diasSinActividad)} sin actividad · {ETAPA_MAP[n.etapa]?.label ?? n.etapa}</div>
                </div>
              ))}
              {criticos.length > 6 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>+ {criticos.length - 6} más</div>}
            </div>
          )}

          {/* Límites de tiempo por etapa */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Límites de tiempo por etapa</div>
            {ETAPAS.map(e => (
              <div key={e.value} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.color }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{e.label}</span>
                </div>
                <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{e.maxDias} días</span>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: "8px 10px", background: "#111", borderRadius: 6, fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
              Límites basados en benchmarks del sector. Un negocio es "estancado" cuando supera el límite sin actividad registrada.
            </div>
          </div>

          {/* Distribución de salud */}
          <div style={cardStyle}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Salud del pipeline</div>
            {negocios.length > 0 ? (
              <>
                <svg viewBox="0 0 100 100" width="120" height="120" style={{ display: "block", margin: "0 auto 16px" }}>
                  {(() => {
                    const total = negocios.length;
                    const pCrit = (criticos.length / total) * 100;
                    const pAten = (atencion.length / total) * 100;
                    const pOk = (ok.length / total) * 100;
                    const r = 40, cx = 50, cy = 50;
                    let angle = -90;
                    return [
                      { pct: pOk, color: "#3abab6", label: "OK" },
                      { pct: pAten, color: "#d4960c", label: "Atención" },
                      { pct: pCrit, color: "#b80000", label: "Crítico" },
                    ].map((seg, i) => {
                      if (seg.pct === 0) return null;
                      const startAngle = angle;
                      const sweep = (seg.pct / 100) * 360;
                      angle += sweep;
                      const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
                      const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
                      const x2 = cx + r * Math.cos((angle * Math.PI) / 180);
                      const y2 = cy + r * Math.sin((angle * Math.PI) / 180);
                      const largeArc = sweep > 180 ? 1 : 0;
                      return (
                        <path key={i} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={seg.color} opacity={0.85} />
                      );
                    });
                  })()}
                  <circle cx="50" cy="50" r="24" fill="#0d0d0d" />
                  <text x="50" y="53" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff" fontFamily="Montserrat,sans-serif">{negocios.length}</text>
                </svg>
                {[
                  { label: "En buen ritmo", n: ok.length, color: "#3abab6" },
                  { label: "En atención", n: atencion.length, color: "#d4960c" },
                  { label: "Críticos", n: criticos.length, color: "#b80000" },
                ].map((k, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: k.color }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{k.label}</span>
                    </div>
                    <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: k.color }}>{k.n}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, padding: "16px 0" }}>Sin negocios activos</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
