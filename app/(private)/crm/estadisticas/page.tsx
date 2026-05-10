"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

interface Stats {
  total: number;
  porEstado: Record<string, number>;
  porOperacion: Record<string, number>;
  porTipo: Record<string, number>;
  valorTotal: Record<string, number>;
  syncStatus: { tokko: number; kiteprop: number; sinSync: number };
  recientes: { id: string; titulo: string; estado: string; created_at: string }[];
  leads: { total: number; porEstado: Record<string, number>; porOrigen: Record<string, number> };
  visitas: { total: number; porEstado: Record<string, number> };
}

const ESTADO_COLOR: Record<string, string> = {
  activa: "#22c55e",
  reservada: "#eab308",
  vendida: "#60a5fa",
  pausada: "#6b7280",
};

const OP_COLOR: Record<string, string> = {
  Venta: "#22c55e",
  Alquiler: "#60a5fa",
  "Alquiler temporal": "#eab308",
};

function formatMoney(n: number, moneda = "USD") {
  if (n >= 1_000_000) return `${moneda} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${moneda} ${(n / 1_000).toFixed(0)}K`;
  return `${moneda} ${n.toFixed(0)}`;
}

function StatBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{count} <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

export default function EstadisticasPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentStats, setAgentStats] = useState<{nombre:string;leads:number;visitas:number}[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargarStats(data.user.id);
      setLoading(false);
    };
    init();
  }, []);

  const cargarStats = async (uid: string) => {
    const [{ data: props }, { data: syncs }, { data: leadsRaw }, { data: visitasRaw }, { data: leadsBy }, { data: visitasBy }, { data: colabs }] = await Promise.all([
      supabase.from("cartera_propiedades").select("id, titulo, estado, operacion, tipo, precio, moneda, created_at").eq("perfil_id", uid),
      supabase.from("cartera_sync_portales").select("propiedad_id, tokko_id, kiteprop_id"),
      supabase.from("crm_leads").select("estado, origen").eq("perfil_id", uid),
      supabase.from("cartera_visitas").select("estado").eq("perfil_id", uid),
      supabase.from("crm_leads").select("created_by").eq("perfil_id", uid).not("created_by", "is", null),
      supabase.from("cartera_visitas").select("created_by").eq("perfil_id", uid).not("created_by", "is", null),
      supabase.from("perfiles").select("id,nombre,apellido").eq("corredor_ref_id", uid),
    ]);

    const all = props ?? [];
    const allSyncs = syncs ?? [];
    const syncedIds = new Set(allSyncs.map((s: any) => s.propiedad_id));
    const tokkoIds = new Set(allSyncs.filter((s: any) => s.tokko_id).map((s: any) => s.propiedad_id));
    const kiteIds = new Set(allSyncs.filter((s: any) => s.kiteprop_id).map((s: any) => s.propiedad_id));

    const count = (arr: any[], key: string) => {
      const m: Record<string, number> = {};
      arr.forEach(p => { m[p[key]] = (m[p[key]] ?? 0) + 1; });
      return m;
    };

    const valorTotal: Record<string, number> = {};
    all.filter(p => p.precio && p.estado === "activa").forEach((p: any) => {
      valorTotal[p.moneda ?? "USD"] = (valorTotal[p.moneda ?? "USD"] ?? 0) + p.precio;
    });

    const recientes = [...all]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(p => ({ id: p.id, titulo: p.titulo, estado: p.estado, created_at: p.created_at }));

    const leads = leadsRaw ?? [];
    const visitas = visitasRaw ?? [];

    // Per-agent stats (only meaningful when colaboradores exist with created_by data)
    if ((colabs ?? []).length > 0 && ((leadsBy ?? []).length > 0 || (visitasBy ?? []).length > 0)) {
      const agMap: Record<string, {nombre:string;leads:number;visitas:number}> = {};
      (colabs ?? []).forEach((c: any) => { agMap[c.id] = {nombre:`${c.nombre} ${c.apellido}`,leads:0,visitas:0}; });
      (leadsBy ?? []).forEach((l: any) => { if (agMap[l.created_by]) agMap[l.created_by].leads++; });
      (visitasBy ?? []).forEach((v: any) => { if (agMap[v.created_by]) agMap[v.created_by].visitas++; });
      setAgentStats(Object.values(agMap).filter(a => a.leads > 0 || a.visitas > 0));
    }
    const countKey = (arr: any[], key: string) => {
      const m: Record<string, number> = {};
      arr.forEach(r => { const v = r[key] ?? "sin_dato"; m[v] = (m[v] ?? 0) + 1; });
      return m;
    };

    setStats({
      total: all.length,
      porEstado: count(all, "estado"),
      porOperacion: count(all, "operacion"),
      porTipo: count(all, "tipo"),
      valorTotal,
      syncStatus: {
        tokko: tokkoIds.size,
        kiteprop: kiteIds.size,
        sinSync: all.filter(p => !syncedIds.has(p.id)).length,
      },
      recientes,
      leads: { total: leads.length, porEstado: countKey(leads, "estado"), porOrigen: countKey(leads, "origen") },
      visitas: { total: visitas.length, porEstado: countKey(visitas, "estado") },
    });
  };

  const card = (titulo: string, valor: string | number, sub?: string, color = "#fff") => (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "20px 22px" }}>
      <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>{titulo}</div>
      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #fff; font-family: Inter,sans-serif; }
        .est-wrap { min-height: 100vh; background: #0a0a0a; display: flex; flex-direction: column; }
        .est-topbar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .est-back { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); text-decoration: none; text-transform: uppercase; }
        .est-back:hover { color: #fff; }
        .est-titulo { font-family: Montserrat,sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .est-content { padding: 24px 20px; max-width: 900px; }
        .est-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .est-section { margin-bottom: 24px; }
        .est-section-title { font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 14px; }
        .est-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px 22px; }
        .est-panel-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 600px) { .est-panel-2col { grid-template-columns: 1fr; } .est-grid { grid-template-columns: repeat(2, 1fr); } }
        .est-reciente { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .est-reciente:last-child { border-bottom: none; }
      `}</style>

      <div className="est-wrap">
        <div className="est-topbar">
          <Link href="/crm/cartera" className="est-back">← Cartera</Link>
          <div className="est-titulo">Estadísticas de Cartera</div>
        </div>

        <div className="est-content">
          {loading || !stats ? (
            <div style={{ color: "rgba(255,255,255,0.3)", padding: 40, textAlign: "center" }}>Cargando estadísticas...</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="est-grid">
                {card("Total propiedades", stats.total)}
                {card("Activas", stats.porEstado.activa ?? 0, "disponibles para cerrar", "#22c55e")}
                {card("Reservadas", stats.porEstado.reservada ?? 0, "en proceso", "#eab308")}
                {card("Vendidas", stats.porEstado.vendida ?? 0, "cerradas", "#60a5fa")}
              </div>

              {/* Valor cartera */}
              {Object.keys(stats.valorTotal).length > 0 && (
                <div className="est-section">
                  <div className="est-section-title">Valor de cartera activa</div>
                  <div className="est-panel" style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                    {Object.entries(stats.valorTotal).map(([moneda, total]) => (
                      <div key={moneda}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{moneda}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: "#22c55e" }}>{formatMoney(total, moneda)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Distribución */}
              <div className="est-section">
                <div className="est-section-title">Distribución</div>
                <div className="est-panel-2col">
                  <div className="est-panel">
                    <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Por operación</div>
                    {Object.entries(stats.porOperacion).map(([op, n]) => (
                      <StatBar key={op} label={op} count={n} total={stats.total} color={OP_COLOR[op] ?? "#888"} />
                    ))}
                  </div>
                  <div className="est-panel">
                    <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Por tipo</div>
                    {Object.entries(stats.porTipo).sort(([, a], [, b]) => b - a).map(([tipo, n]) => (
                      <StatBar key={tipo} label={tipo} count={n} total={stats.total} color="rgba(204,0,0,0.8)" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Sync portales */}
              <div className="est-section">
                <div className="est-section-title">Sincronización con portales</div>
                <div className="est-panel">
                  <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Tokko Broker</div>
                      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: stats.syncStatus.tokko > 0 ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                        {stats.syncStatus.tokko}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>sincronizadas</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>KiteProp</div>
                      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: stats.syncStatus.kiteprop > 0 ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                        {stats.syncStatus.kiteprop}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>sincronizadas</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Sin sincronizar</div>
                      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: stats.syncStatus.sinSync > 0 ? "#eab308" : "#22c55e" }}>
                        {stats.syncStatus.sinSync}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>solo en GFI</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leads inbox */}
              {stats.leads.total > 0 && (
                <div className="est-section">
                  <div className="est-section-title">Inbox de leads ({stats.leads.total})</div>
                  <div className="est-panel-2col">
                    <div className="est-panel">
                      <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Por estado</div>
                      {[["nuevo","#f59e0b"],["contactado","#60a5fa"],["en_seguimiento","#a855f7"],["visita_coordinada","#22c55e"],["cerrado","#6b7280"],["descartado","#6b7280"]].map(([est, color]) => stats.leads.porEstado[est] ? (
                        <StatBar key={est} label={est.replace(/_/g," ")} count={stats.leads.porEstado[est]} total={stats.leads.total} color={color} />
                      ) : null)}
                    </div>
                    <div className="est-panel">
                      <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Por origen</div>
                      {Object.entries(stats.leads.porOrigen).sort(([,a],[,b]) => b-a).map(([origen, n]) => (
                        <StatBar key={origen} label={origen} count={n} total={stats.leads.total} color="rgba(204,0,0,0.8)" />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Visitas */}
              {stats.visitas.total > 0 && (
                <div className="est-section">
                  <div className="est-section-title">Órdenes de visita ({stats.visitas.total})</div>
                  <div className="est-panel" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {Object.entries(stats.visitas.porEstado).map(([est, n]) => (
                      <div key={est}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{est.replace(/_/g," ")}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: est === "realizada" ? "#22c55e" : est === "cancelada" ? "#6b7280" : "#fff" }}>{n}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Por agente */}
              {agentStats.length > 0 && (
                <div className="est-section">
                  <div className="est-section-title">Actividad por agente</div>
                  <div className="est-panel">
                    <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"8px 16px", alignItems:"center" }}>
                      <div style={{ fontSize:10, fontFamily:"Montserrat,sans-serif", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)" }}>Agente</div>
                      <div style={{ fontSize:10, fontFamily:"Montserrat,sans-serif", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", textAlign:"right" }}>Leads</div>
                      <div style={{ fontSize:10, fontFamily:"Montserrat,sans-serif", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", textAlign:"right" }}>Visitas</div>
                      {agentStats.map(a => (<>
                        <div key={a.nombre} style={{ fontSize:13, color:"rgba(255,255,255,0.8)", paddingTop:6, borderTop:"1px solid rgba(255,255,255,0.05)" }}>{a.nombre}</div>
                        <div style={{ fontSize:18, fontWeight:800, fontFamily:"Montserrat,sans-serif", color: a.leads > 0 ? "#60a5fa" : "rgba(255,255,255,0.2)", textAlign:"right", borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:6 }}>{a.leads}</div>
                        <div style={{ fontSize:18, fontWeight:800, fontFamily:"Montserrat,sans-serif", color: a.visitas > 0 ? "#22c55e" : "rgba(255,255,255,0.2)", textAlign:"right", borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:6 }}>{a.visitas}</div>
                      </>))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recientes */}
              {stats.recientes.length > 0 && (
                <div className="est-section">
                  <div className="est-section-title">Últimas propiedades cargadas</div>
                  <div className="est-panel">
                    {stats.recientes.map(p => {
                      const color = ESTADO_COLOR[p.estado] ?? "#666";
                      return (
                        <div key={p.id} className="est-reciente">
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{p.titulo}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                            {new Date(p.created_at).toLocaleDateString("es-AR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
