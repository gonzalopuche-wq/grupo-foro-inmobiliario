"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface EtapaCount { etapa: string; count: number }
interface MesCount   { mes: string; label: string; leads: number; cerrados: number }

const ETAPAS_FUNNEL = [
  { key: "prospecto",          label: "Prospecto",     color: "#6b7280" },
  { key: "contactado",         label: "Contactado",    color: "#4ab8d8" },
  { key: "visita_coordinada",  label: "Visita coord.", color: "#a78bfa" },
  { key: "visita_realizada",   label: "Visita real.",  color: "#818cf8" },
  { key: "oferta_enviada",     label: "Oferta",        color: "#d4960c" },
  { key: "negociacion",        label: "Negociación",   color: "#d4960c" },
  { key: "reserva",            label: "Reserva",       color: "#3abab6" },
  { key: "escritura",          label: "Escritura",     color: "#3abab6" },
  { key: "cerrado",            label: "Cerrado",       color: "#990000" },
  { key: "perdido",            label: "Perdido",       color: "#374151" },
];

const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function getUltimos6Meses(): { mes: string; label: string }[] {
  const hoy = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1);
    return {
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MESES_LABEL[d.getMonth()],
    };
  });
}

interface Props { uid: string }

export default function TendenciasWidget({ uid }: Props) {
  const [etapas, setEtapas] = useState<EtapaCount[]>([]);
  const [meses, setMeses] = useState<MesCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"funnel"|"tendencia">("funnel");

  useEffect(() => {
    if (!uid) return;
    const cargar = async () => {
      setLoading(true);
      const ultimos6 = getUltimos6Meses();
      const desde = ultimos6[0].mes + "-01";

      const [{ data: negocios }, { data: leads }, { data: cerrados }] = await Promise.all([
        supabase.from("crm_negocios").select("etapa").eq("perfil_id", uid).eq("archivado", false),
        supabase.from("web_leads").select("created_at").eq("perfil_id", uid).gte("created_at", desde),
        supabase.from("crm_negocios").select("fecha_cierre").eq("perfil_id", uid).not("fecha_cierre", "is", null).gte("fecha_cierre", desde),
      ]);

      // Funnel: count by etapa
      const etapaMap: Record<string, number> = {};
      for (const n of negocios ?? []) {
        etapaMap[n.etapa] = (etapaMap[n.etapa] ?? 0) + 1;
      }
      setEtapas(
        ETAPAS_FUNNEL
          .map(e => ({ etapa: e.key, count: etapaMap[e.key] ?? 0 }))
          .filter(e => e.count > 0)
      );

      // Tendencia: leads y cierres por mes
      const leadsPorMes: Record<string, number> = {};
      for (const l of leads ?? []) {
        const m = (l.created_at as string).substring(0, 7);
        leadsPorMes[m] = (leadsPorMes[m] ?? 0) + 1;
      }
      const cerradosPorMes: Record<string, number> = {};
      for (const c of cerrados ?? []) {
        const m = (c.fecha_cierre as string).substring(0, 7);
        cerradosPorMes[m] = (cerradosPorMes[m] ?? 0) + 1;
      }
      setMeses(ultimos6.map(u => ({
        ...u,
        leads: leadsPorMes[u.mes] ?? 0,
        cerrados: cerradosPorMes[u.mes] ?? 0,
      })));

      setLoading(false);
    };
    cargar();
  }, [uid]);

  const funnelMax = Math.max(...etapas.map(e => e.count), 1);
  const leadsMax = Math.max(...meses.map(m => m.leads), 1);
  const cerradosMax = Math.max(...meses.map(m => m.cerrados), 1);
  const totalFunnel = etapas.filter(e => e.etapa !== "perdido").reduce((s, e) => s + e.count, 0);
  const totalCerrados = meses.reduce((s, m) => s + m.cerrados, 0);
  const totalLeads = meses.reduce((s, m) => s + m.leads, 0);

  // SVG sparkline for leads trend
  const sparW = 260; const sparH = 56;
  const sparPts = meses.map((m, i) => ({
    x: meses.length <= 1 ? sparW / 2 : (i / (meses.length - 1)) * sparW,
    y: sparH - (m.leads / leadsMax) * (sparH - 8) - 4,
  }));
  const sparPath = sparPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const sparArea = `${sparPath} L ${sparW} ${sparH} L 0 ${sparH} Z`;

  return (
    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 10, padding: "18px 22px", marginBottom: 20 }}>
      <style>{`
        .td-tab { background: none; border: none; cursor: pointer; font-family: var(--font-display); font-size: 9px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; transition: all 0.15s; }
        .td-tab.active { background: rgba(153,0,0,0.15); color: #990000; }
        .td-tab:not(.active) { color: var(--gfi-text-dim); }
        .td-tab:not(.active):hover { color: var(--gfi-text-secondary); }
        .td-bar:hover { opacity: 0.85 !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-display)" }}>
            Pipeline
          </div>
          <div style={{ flex: 1, height: 1, width: 40, background: "linear-gradient(90deg, var(--gfi-border-subtle) 0%, transparent 100%)" }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className={`td-tab${tab === "funnel" ? " active" : ""}`} onClick={() => setTab("funnel")}>Funnel</button>
          <button className={`td-tab${tab === "tendencia" ? " active" : ""}`} onClick={() => setTab("tendencia")}>Tendencia</button>
        </div>
      </div>

      {loading ? (
        <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gfi-text-dim)", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
          Cargando pipeline...
        </div>
      ) : tab === "funnel" ? (
        /* ── FUNNEL VIEW ── */
        <div>
          {etapas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "var(--gfi-text-dim)", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
              No hay negocios activos todavía
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 900, color: "#990000", lineHeight: 1 }}>{totalFunnel}</div>
                  <div style={{ fontSize: 8, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>Activos</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 900, color: "#3abab6", lineHeight: 1 }}>{etapas.find(e => e.etapa === "cerrado")?.count ?? 0}</div>
                  <div style={{ fontSize: 8, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>Cerrados</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {etapas.map(e => {
                  const cfg = ETAPAS_FUNNEL.find(f => f.key === e.etapa);
                  if (!cfg) return null;
                  const pct = Math.round((e.count / funnelMax) * 100);
                  return (
                    <div key={e.etapa} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 80, fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--gfi-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right", flexShrink: 0 }}>
                        {cfg.label}
                      </div>
                      <div style={{ flex: 1, height: 14, background: "var(--gfi-border-subtle)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                        <div
                          className="td-bar"
                          style={{ height: "100%", width: `${pct}%`, background: cfg.color, borderRadius: 4, opacity: 0.75, transition: "width 0.6s ease", minWidth: e.count > 0 ? 18 : 0 }}
                        />
                      </div>
                      <div style={{ width: 22, fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 800, color: cfg.color, textAlign: "right", flexShrink: 0 }}>
                        {e.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        /* ── TENDENCIA VIEW ── */
        <div>
          <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 900, color: "#3b82f6", lineHeight: 1 }}>{totalLeads}</div>
              <div style={{ fontSize: 8, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>Leads (6m)</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 900, color: "#3abab6", lineHeight: 1 }}>{totalCerrados}</div>
              <div style={{ fontSize: 8, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>Cierres (6m)</div>
            </div>
          </div>

          {/* Grouped bar chart — leads vs cerrados por mes */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 72, marginBottom: 6 }}>
            {meses.map(m => {
              const lH = Math.max(leadsMax > 0 ? Math.round((m.leads / leadsMax) * 60) : 0, m.leads > 0 ? 4 : 0);
              const cH = Math.max(cerradosMax > 0 ? Math.round((m.cerrados / cerradosMax) * 60) : 0, m.cerrados > 0 ? 4 : 0);
              return (
                <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 64 }}>
                    <div title={`${m.leads} leads`} style={{ width: 8, height: lH, background: "#3b82f6", borderRadius: "2px 2px 0 0", opacity: 0.7, transition: "height 0.5s ease" }} />
                    <div title={`${m.cerrados} cierres`} style={{ width: 8, height: cH, background: "#3abab6", borderRadius: "2px 2px 0 0", opacity: 0.8, transition: "height 0.5s ease" }} />
                  </div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-display)", fontWeight: 700, marginTop: 4, letterSpacing: "0.04em" }}>{m.label}</div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
            {[{ color: "#3b82f6", label: "Leads" }, { color: "#3abab6", label: "Cierres" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, opacity: 0.8 }} />
                {l.label}
              </div>
            ))}
          </div>

          {/* Sparkline overlay (leads only) */}
          {totalLeads > 0 && (
            <svg width={sparW} height={sparH} style={{ marginTop: 12, display: "block", overflow: "visible" }}>
              <defs>
                <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={sparArea} fill="url(#spark-grad)" />
              <path d={sparPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
              {sparPts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" opacity="0.8" />
              ))}
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
