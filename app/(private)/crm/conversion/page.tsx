"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Negocio {
  id: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string;
  archivado: boolean;
  created_at: string;
  updated_at: string;
  fecha_primer_contacto: string | null;
  fecha_visita: string | null;
  fecha_reserva: string | null;
  fecha_cierre: string | null;
}

// ── Const ─────────────────────────────────────────────────────────────────────

const ETAPAS_ORDEN = [
  { key: "prospecto",         label: "Prospecto",       color: "#6b7280", group: "top" },
  { key: "contactado",        label: "Contactado",      color: "#60a5fa", group: "top" },
  { key: "visita_coordinada", label: "Visita coord.",   color: "#8b5cf6", group: "mid" },
  { key: "visita_realizada",  label: "Visita realiz.",  color: "#a78bfa", group: "mid" },
  { key: "oferta_enviada",    label: "Oferta enviada",  color: "#f59e0b", group: "mid" },
  { key: "negociacion",       label: "Negociación",     color: "#f97316", group: "mid" },
  { key: "reserva",           label: "Reserva",         color: "#06b6d4", group: "bot" },
  { key: "escritura",         label: "Escritura",       color: "#10b981", group: "bot" },
  { key: "cerrado",           label: "Cerrado",         color: "#22c55e", group: "bot" },
];

const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMon = (n: number, m: string) =>
  m === "USD" ? `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

const diasEntre = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const fmtDias = (d: number | null) => d === null ? "—" : d === 0 ? "< 1 día" : d === 1 ? "1 día" : `${d} días`;

function ultimos6Meses() {
  const hoy = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1);
    return {
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MESES_LABEL[d.getMonth()],
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConversionPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"todo" | "90d" | "180d" | "365d">("todo");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const uid = data.user.id;
      const { data: negs } = await supabase
        .from("crm_negocios")
        .select("id,etapa,valor_operacion,moneda,archivado,created_at,updated_at,fecha_primer_contacto,fecha_visita,fecha_reserva,fecha_cierre")
        .eq("perfil_id", uid)
        .order("created_at", { ascending: false });
      setNegocios((negs ?? []) as Negocio[]);
      setLoading(false);
    });
  }, []);

  // ── Filtrado por período ──────────────────────────────────────────────────

  const negociosFiltrados = useMemo(() => {
    if (periodo === "todo") return negocios;
    const dias = { "90d": 90, "180d": 180, "365d": 365 }[periodo];
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    return negocios.filter(n => new Date(n.created_at) >= desde);
  }, [negocios, periodo]);

  // ── Conteo por etapa (no archivados) ─────────────────────────────────────

  const etapaCount = useMemo(() => {
    const activos = negociosFiltrados.filter(n => !n.archivado);
    const m: Record<string, number> = {};
    ETAPAS_ORDEN.forEach(e => { m[e.key] = 0; });
    activos.forEach(n => { if (m[n.etapa] !== undefined) m[n.etapa]++; });
    return m;
  }, [negociosFiltrados]);

  const perdidos = useMemo(() =>
    negociosFiltrados.filter(n => n.etapa === "perdido" && !n.archivado).length,
  [negociosFiltrados]);

  const totalActivos = useMemo(() =>
    ETAPAS_ORDEN.reduce((s, e) => s + (etapaCount[e.key] ?? 0), 0),
  [etapaCount]);

  const totalCerrados = etapaCount["cerrado"] ?? 0;
  const tasaConversionGlobal = totalActivos > 0 ? (totalCerrados / (totalActivos + perdidos)) * 100 : 0;

  // ── Tasa de conversión entre etapas ──────────────────────────────────────

  const tasasConversion = useMemo(() => {
    return ETAPAS_ORDEN.slice(0, -1).map((etapa, i) => {
      const siguiente = ETAPAS_ORDEN[i + 1];
      const desde = etapaCount[etapa.key] ?? 0;
      const hasta = etapaCount[siguiente.key] ?? 0;
      const total = desde + hasta;
      const tasa = total > 0 ? (hasta / total) * 100 : null;
      return { desde: etapa, hasta: siguiente, tasa };
    });
  }, [etapaCount]);

  // ── Valor pipeline por etapa ──────────────────────────────────────────────

  const valorPorEtapa = useMemo(() => {
    const m: Record<string, { usd: number; ars: number }> = {};
    ETAPAS_ORDEN.forEach(e => { m[e.key] = { usd: 0, ars: 0 }; });
    negociosFiltrados
      .filter(n => !n.archivado && n.valor_operacion)
      .forEach(n => {
        const key = n.moneda === "USD" ? "usd" : "ars";
        if (m[n.etapa]) m[n.etapa][key] += n.valor_operacion!;
      });
    return m;
  }, [negociosFiltrados]);

  const valorTotalPipeline = useMemo(() => {
    return negociosFiltrados
      .filter(n => !n.archivado && n.valor_operacion && n.moneda === "USD" && !["cerrado","perdido"].includes(n.etapa))
      .reduce((s, n) => s + (n.valor_operacion ?? 0), 0);
  }, [negociosFiltrados]);

  // ── Tiempo promedio por etapa ─────────────────────────────────────────────

  const tiempoPromedio = useMemo(() => {
    const cerrados = negociosFiltrados.filter(n => n.etapa === "cerrado" && n.fecha_cierre);
    if (cerrados.length === 0) return null;

    const tiempos = cerrados.map(n => {
      const inicio = n.fecha_primer_contacto ?? n.created_at;
      return diasEntre(inicio, n.fecha_cierre!);
    });
    const promedio = Math.round(tiempos.reduce((s, t) => s + t, 0) / tiempos.length);
    const min = Math.min(...tiempos);
    const max = Math.max(...tiempos);
    return { promedio, min, max };
  }, [negociosFiltrados]);

  // ── Cierres por mes (últimos 6 meses) ─────────────────────────────────────

  const cierresPorMes = useMemo(() => {
    const meses = ultimos6Meses();
    return meses.map(m => {
      const count = negociosFiltrados.filter(n =>
        n.etapa === "cerrado" && n.fecha_cierre && n.fecha_cierre.substring(0, 7) === m.mes
      ).length;
      const valor = negociosFiltrados
        .filter(n => n.etapa === "cerrado" && n.fecha_cierre && n.fecha_cierre.substring(0, 7) === m.mes && n.moneda === "USD")
        .reduce((s, n) => s + (n.valor_operacion ?? 0), 0);
      return { ...m, count, valor };
    });
  }, [negociosFiltrados]);

  const maxCierres = Math.max(...cierresPorMes.map(m => m.count), 1);

  // ── Predicción de cierres ─────────────────────────────────────────────────

  const prediccion = useMemo(() => {
    const enPipeline = negociosFiltrados.filter(n =>
      !n.archivado && ["reserva", "escritura", "oferta_enviada", "negociacion"].includes(n.etapa)
    );
    const valor = enPipeline.filter(n => n.moneda === "USD").reduce((s, n) => s + (n.valor_operacion ?? 0), 0);
    return { count: enPipeline.length, valor };
  }, [negociosFiltrados]);

  // ── Funnel max ────────────────────────────────────────────────────────────

  const funnelMax = Math.max(...ETAPAS_ORDEN.map(e => etapaCount[e.key] ?? 0), 1);

  // ── Render ────────────────────────────────────────────────────────────────

  const cardSt = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "18px 20px",
    marginBottom: 14,
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
        Calculando análisis de conversión...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');
        .per-btn { background: none; border: 1px solid rgba(255,255,255,0.12); padding: 5px 12px; border-radius: 20px; cursor: pointer; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); transition: all 0.15s; }
        .per-btn.on { background: rgba(204,0,0,0.15); border-color: rgba(204,0,0,0.4); color: #cc0000; }
        .per-btn:hover:not(.on) { color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.2); }
        .funnel-row:hover { opacity: 0.9 !important; }
        @media (max-width: 700px) { .two-col { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Link href="/crm" style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
            ← CRM
          </Link>
          <div style={{ marginTop: 6, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 18 }}>
            Análisis de <span style={{ color: "#cc0000" }}>Conversión</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
            Tasas de conversión del pipeline · Tiempo de cierre · Predicción
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["todo","90d","180d","365d"] as const).map(p => (
            <button key={p} className={`per-btn${periodo === p ? " on" : ""}`} onClick={() => setPeriodo(p)}>
              {p === "todo" ? "Todo" : p === "90d" ? "90d" : p === "180d" ? "6m" : "1a"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "22px auto", padding: "0 16px" }}>

        {/* KPIs globales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }} className="two-col">
          {[
            { label: "Deals activos", val: String(totalActivos), color: "#fff" },
            { label: "Cerrados", val: String(totalCerrados), color: "#22c55e" },
            { label: "Tasa de cierre", val: tasaConversionGlobal > 0 ? `${tasaConversionGlobal.toFixed(1)}%` : "—", color: "#cc0000" },
            { label: "Tiempo prom. cierre", val: tiempoPromedio ? fmtDias(tiempoPromedio.promedio) : "—", color: "#a78bfa" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ ...cardSt, marginBottom: 0, textAlign: "center" }}>
              <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="two-col">

          {/* ── Funnel SVG ── */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 16 }}>
              Funnel de conversión
            </div>
            {totalActivos === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Sin deals en el período</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {ETAPAS_ORDEN.map(etapa => {
                  const count = etapaCount[etapa.key] ?? 0;
                  const pct = Math.max((count / funnelMax) * 100, count > 0 ? 6 : 0);
                  const valUSD = valorPorEtapa[etapa.key]?.usd ?? 0;
                  return (
                    <div key={etapa.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 90, fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", flexShrink: 0 }}>
                        {etapa.label}
                      </div>
                      <div style={{ flex: 1, height: 22, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                        <div
                          className="funnel-row"
                          style={{ height: "100%", width: `${pct}%`, background: etapa.color, borderRadius: 4, opacity: 0.75, transition: "width 0.6s ease", display: "flex", alignItems: "center", paddingLeft: 6 }}
                        >
                          {count > 0 && pct > 15 && (
                            <span style={{ fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#fff" }}>{count}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ width: 30, fontSize: 13, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: count > 0 ? etapa.color : "rgba(255,255,255,0.15)", textAlign: "right", flexShrink: 0 }}>{count}</div>
                      {valUSD > 0 && (
                        <div style={{ width: 70, fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "right", flexShrink: 0 }}>
                          {valUSD >= 1_000_000 ? `${(valUSD/1_000_000).toFixed(1)}M` : `${Math.round(valUSD/1000)}K`}
                        </div>
                      )}
                    </div>
                  );
                })}
                {perdidos > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ width: 90, fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "rgba(239,68,68,0.6)", textTransform: "uppercase", textAlign: "right", flexShrink: 0 }}>Perdidos</div>
                    <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max((perdidos / funnelMax) * 100, 4)}%`, background: "#ef4444", borderRadius: 4, opacity: 0.4 }} />
                    </div>
                    <div style={{ width: 30, fontSize: 13, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#ef4444", opacity: 0.6, textAlign: "right" }}>{perdidos}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Tasas de conversión entre etapas ── */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 16 }}>
              Conversión por paso
            </div>
            {tasasConversion.filter(t => (etapaCount[t.desde.key] ?? 0) > 0 || (etapaCount[t.hasta.key] ?? 0) > 0).length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Sin datos suficientes</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tasasConversion
                  .filter(t => (etapaCount[t.desde.key] ?? 0) > 0 || (etapaCount[t.hasta.key] ?? 0) > 0)
                  .map(({ desde, hasta, tasa }) => (
                    <div key={`${desde.key}-${hasta.key}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                          <span style={{ color: desde.color }}>{desde.label}</span>
                          <span style={{ margin: "0 5px", color: "rgba(255,255,255,0.2)" }}>→</span>
                          <span style={{ color: hasta.color }}>{hasta.label}</span>
                        </div>
                        <div style={{ fontSize: 13, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: tasa === null ? "rgba(255,255,255,0.2)" : tasa >= 50 ? "#22c55e" : tasa >= 25 ? "#f59e0b" : "#ef4444" }}>
                          {tasa === null ? "—" : `${tasa.toFixed(0)}%`}
                        </div>
                      </div>
                      {tasa !== null && (
                        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${tasa}%`, background: tasa >= 50 ? "#22c55e" : tasa >= 25 ? "#f59e0b" : "#ef4444", borderRadius: 2, transition: "width 0.5s", opacity: 0.7 }} />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* ── Cierres por mes ── */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 16 }}>
              Cierres — últimos 6 meses
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80, marginBottom: 6 }}>
              {cierresPorMes.map(m => {
                const h = Math.max((m.count / maxCierres) * 64, m.count > 0 ? 4 : 0);
                return (
                  <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                    <div title={`${m.count} cierres${m.valor > 0 ? ` · USD ${m.valor.toLocaleString("es-AR")}` : ""}`} style={{ width: "100%", height: h, background: "#22c55e", borderRadius: "3px 3px 0 0", opacity: 0.75, transition: "height 0.5s" }} />
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, marginTop: 5 }}>{m.label}</div>
                    <div style={{ fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: m.count > 0 ? "#22c55e" : "rgba(255,255,255,0.15)" }}>{m.count}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                Total: <strong style={{ color: "#22c55e" }}>{cierresPorMes.reduce((s, m) => s + m.count, 0)} cierres</strong>
              </div>
              {cierresPorMes.some(m => m.valor > 0) && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  Valor: <strong style={{ color: "#60a5fa" }}>USD {cierresPorMes.reduce((s, m) => s + m.valor, 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</strong>
                </div>
              )}
            </div>
          </div>

          {/* ── Métricas de tiempo y predicción ── */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 16 }}>
              Velocidad de cierre & predicción
            </div>

            {/* Tiempo promedio */}
            {tiempoPromedio ? (
              <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
                  Tiempo de cierre (deals cerrados)
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  {[
                    { label: "Promedio", val: fmtDias(tiempoPromedio.promedio), color: "#a78bfa" },
                    { label: "Mínimo", val: fmtDias(tiempoPromedio.min), color: "#22c55e" },
                    { label: "Máximo", val: fmtDias(tiempoPromedio.max), color: "#ef4444" },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div style={{ fontSize: 8, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                Sin deals cerrados para calcular tiempo promedio
              </div>
            )}

            {/* Predicción pipeline */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
                Pipeline caliente (en reserva/escritura/oferta/negociación)
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "baseline" }}>
                <div>
                  <div style={{ fontSize: 32, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color: "#f97316" }}>{prediccion.count}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>deals</div>
                </div>
                {prediccion.valor > 0 && (
                  <div>
                    <div style={{ fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#60a5fa" }}>
                      USD {prediccion.valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>en pipeline</div>
                  </div>
                )}
              </div>
              {valorTotalPipeline > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
                  El valor total del pipeline activo (excl. cerrados) es{" "}
                  <strong style={{ color: "#60a5fa" }}>{fmtMon(valorTotalPipeline, "USD")}</strong>.
                  {totalCerrados > 0 && tasaConversionGlobal > 0 && (
                    <> Con una tasa de cierre del <strong style={{ color: "#cc0000" }}>{tasaConversionGlobal.toFixed(1)}%</strong>, se esperan{" "}
                    <strong style={{ color: "#22c55e" }}>{Math.round(prediccion.count * tasaConversionGlobal / 100)} cierres</strong> adicionales.</>
                  )}
                </div>
              )}
            </div>

            {/* Valor total cartera */}
            {valorTotalPipeline > 0 && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Valor cartera activa en USD</span>
                  <span style={{ fontSize: 15, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: "#fff" }}>
                    {fmtMon(valorTotalPipeline, "USD")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navegación */}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/crm/negocios" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
            → Gestionar negocios
          </Link>
          <Link href="/crm/estadisticas" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
            → Estadísticas cartera
          </Link>
        </div>
      </div>
    </div>
  );
}
