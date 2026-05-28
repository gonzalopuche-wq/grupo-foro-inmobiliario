"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  created_at: string;
  updated_at: string;
  fecha_cierre: string | null;
}

interface Interaccion {
  id: string;
  negocio_id: string | null;
  tipo: string;
  created_at: string;
}

const ETAPAS_ORDEN = ["prospecto","calificado","propuesta","negociacion","reservado","en_escritura","cerrado"];

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function WinLossPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(180);
  const [tc, setTc] = useState(1300);
  const [honPct, setHonPct] = useState(3);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const uid = data.user.id;
      Promise.all([
        supabase.from("crm_negocios").select("id,titulo,etapa,tipo_operacion,valor_operacion,moneda,honorarios_pct,created_at,updated_at,fecha_cierre").eq("perfil_id", uid),
        supabase.from("crm_interacciones").select("id,negocio_id,tipo,created_at").eq("perfil_id", uid),
      ]).then(([{ data: n }, { data: i }]) => {
        setNegocios((n ?? []) as Negocio[]);
        setInteracciones((i ?? []) as Interaccion[]);
        setLoading(false);
      });
    });
  }, []);

  const desde = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodo);
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  const filtrados = useMemo(() => negocios.filter(n => n.created_at.slice(0, 10) >= desde), [negocios, desde]);

  const valorUSD = (n: Negocio) => {
    const v = n.valor_operacion ?? 0;
    return n.moneda === "ARS" ? v / tc : v;
  };

  const honorarios = (n: Negocio) => valorUSD(n) * (n.honorarios_pct ?? honPct) / 100;

  const stats = useMemo(() => {
    const total = filtrados.length;
    const cerrados = filtrados.filter(n => n.etapa === "cerrado");
    const perdidos = filtrados.filter(n => n.etapa === "perdido");
    const activos = filtrados.filter(n => !["cerrado","perdido","archivado"].includes(n.etapa));

    const winRate = total > 0 ? (cerrados.length / total) * 100 : 0;
    const lossRate = total > 0 ? (perdidos.length / total) * 100 : 0;

    const diasCierre = cerrados
      .filter(n => n.fecha_cierre)
      .map(n => diasEntre(n.created_at, n.fecha_cierre!));
    const avgDiasCierre = diasCierre.length > 0 ? diasCierre.reduce((s, d) => s + d, 0) / diasCierre.length : 0;

    const valorCerrado = cerrados.reduce((s, n) => s + valorUSD(n), 0);
    const honCerrado = cerrados.reduce((s, n) => s + honorarios(n), 0);
    const valorPipeline = activos.reduce((s, n) => s + valorUSD(n), 0);

    const avgValorCerrado = cerrados.length > 0 ? valorCerrado / cerrados.length : 0;

    // Por tipo operación
    const tipos: Record<string, { total: number; cerrados: number; perdidos: number; valor: number }> = {};
    filtrados.forEach(n => {
      const t = n.tipo_operacion;
      if (!tipos[t]) tipos[t] = { total: 0, cerrados: 0, perdidos: 0, valor: 0 };
      tipos[t].total++;
      if (n.etapa === "cerrado") { tipos[t].cerrados++; tipos[t].valor += valorUSD(n); }
      if (n.etapa === "perdido") tipos[t].perdidos++;
    });

    // Interacciones por negocio cerrado
    const intPorNegocio: Record<string, number> = {};
    interacciones.forEach(i => { if (i.negocio_id) intPorNegocio[i.negocio_id] = (intPorNegocio[i.negocio_id] ?? 0) + 1; });
    const avgIntCierre = cerrados.length > 0
      ? cerrados.reduce((s, n) => s + (intPorNegocio[n.id] ?? 0), 0) / cerrados.length
      : 0;

    // Distribución por etapa (solo activos)
    const porEtapa: Record<string, number> = {};
    activos.forEach(n => { porEtapa[n.etapa] = (porEtapa[n.etapa] ?? 0) + 1; });

    // Velocidad promedio por etapa: días desde created_at a updated_at para cerrados
    // (simplificado: días totales / etapas recorridas)
    const velocidadPipeline = avgDiasCierre / Math.max(1, ETAPAS_ORDEN.length - 1);

    return {
      total, cerrados: cerrados.length, perdidos: perdidos.length, activos: activos.length,
      winRate, lossRate, avgDiasCierre, valorCerrado, honCerrado, valorPipeline,
      avgValorCerrado, tipos, avgIntCierre, porEtapa, velocidadPipeline, diasCierre,
    };
  }, [filtrados, interacciones, tc, honPct]);

  const maxTipo = useMemo(() => {
    return Math.max(1, ...Object.values(stats.tipos).map(t => t.total));
  }, [stats.tipos]);

  if (loading) return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Cargando análisis…
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              📊 Win / Loss Analysis
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
              Tasa de cierre, velocidad de pipeline y análisis de operaciones
            </p>
          </div>
          <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Volver al CRM</Link>
        </div>

        {/* Config */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 14, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Período</label>
            <select value={periodo} onChange={e => setPeriodo(Number(e.target.value))}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13 }}>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
              <option value={180}>6 meses</option>
              <option value={365}>1 año</option>
              <option value={3650}>Todo</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>TC</label>
            <input type="number" value={tc} onChange={e => setTc(parseFloat(e.target.value) || 1)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: 90 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>% Honorarios</label>
            <input type="number" value={honPct} onChange={e => setHonPct(parseFloat(e.target.value) || 0)} step={0.5}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: 70 }} />
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
            {stats.total} negocios en el período
          </div>
        </div>

        {/* KPIs principales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Win Rate", value: `${stats.winRate.toFixed(0)}%`, sub: `${stats.cerrados} cerrados`, color: "#22c55e" },
            { label: "Loss Rate", value: `${stats.lossRate.toFixed(0)}%`, sub: `${stats.perdidos} perdidos`, color: "#cc0000" },
            { label: "En Pipeline", value: stats.activos, sub: "negocios activos", color: "#3b82f6" },
            { label: "Días Prom. Cierre", value: `${stats.avgDiasCierre.toFixed(0)}d`, sub: "primer contacto → cierre", color: "#f97316" },
            { label: "Valor Cerrado", value: `USD ${fmt(stats.valorCerrado)}`, sub: "total período", color: "#22c55e" },
            { label: "Honorarios", value: `USD ${fmt(stats.honCerrado)}`, sub: "cobrados período", color: "#a855f7" },
            { label: "Ticket Promedio", value: `USD ${fmt(stats.avgValorCerrado)}`, sub: "por operación", color: "#eab308" },
            { label: "Interacc./Cierre", value: stats.avgIntCierre.toFixed(1), sub: "interacciones promedio", color: "#6b7280" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: `1px solid ${k.color}33`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Win/Loss visual */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Gauge win rate */}
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 16 }}>Tasa de Cierre</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Cerrados", pct: stats.winRate, color: "#22c55e", count: stats.cerrados },
                { label: "Perdidos", pct: stats.lossRate, color: "#cc0000", count: stats.perdidos },
                { label: "Activos", pct: stats.total > 0 ? (stats.activos / stats.total) * 100 : 0, color: "#3b82f6", count: stats.activos },
              ].map(s => (
                <div key={s.label} style={{ flex: 1 }}>
                  <div style={{ textAlign: "center", fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ background: "#1a1a1a", borderRadius: 4, height: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
                    <div style={{ background: s.color, height: `${Math.max(2, s.pct)}%`, transition: "height 0.4s" }} />
                  </div>
                  <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.pct.toFixed(0)}%</div>
                  <div style={{ textAlign: "center", fontSize: 10, color: "#4b5563" }}>{s.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Velocidad pipeline */}
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 16 }}>Pipeline Activo por Etapa</div>
            {ETAPAS_ORDEN.filter(e => !["cerrado"].includes(e)).map(etapa => {
              const count = stats.porEtapa[etapa] ?? 0;
              const maxE = Math.max(1, ...Object.values(stats.porEtapa));
              const pct = (count / maxE) * 100;
              const colores: Record<string, string> = {
                prospecto: "#6b7280", calificado: "#3b82f6", propuesta: "#a855f7",
                negociacion: "#f97316", reservado: "#eab308", en_escritura: "#22c55e",
              };
              return (
                <div key={etapa} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 80, fontSize: 11, color: "#9ca3af", textAlign: "right", flexShrink: 0 }}>{etapa}</div>
                  <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 4, height: 18, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: colores[etapa] ?? "#6b7280" }} />
                  </div>
                  <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: colores[etapa] ?? "#6b7280" }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Por tipo de operación */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ background: "#1a1a1a", padding: "12px 18px", borderBottom: "1px solid #1f2937" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Análisis por Tipo de Operación</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#161616" }}>
                  {["Tipo", "Total", "Cerrados", "Perdidos", "Win %", "Valor Cerrado", "Actividad"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", fontWeight: 600, borderBottom: "1px solid #1f2937" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.tipos)
                  .sort((a, b) => b[1].cerrados - a[1].cerrados)
                  .map(([tipo, t], i) => {
                    const winR = t.total > 0 ? (t.cerrados / t.total) * 100 : 0;
                    return (
                      <tr key={tipo} style={{ background: i % 2 === 0 ? "#0f0f0f" : "#111", borderBottom: "1px solid #1f2937" }}>
                        <td style={{ padding: "9px 14px", color: "#e5e5e5", fontWeight: 600 }}>{tipo}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#9ca3af" }}>{t.total}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#22c55e", fontWeight: 700 }}>{t.cerrados}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#cc0000" }}>{t.perdidos}</td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: winR >= 50 ? "#22c55e" : winR >= 25 ? "#f97316" : "#cc0000", fontWeight: 700 }}>
                          {winR.toFixed(0)}%
                        </td>
                        <td style={{ padding: "9px 14px", textAlign: "right", color: "#e5e5e5" }}>
                          {t.valor > 0 ? `USD ${fmt(t.valor)}` : "—"}
                        </td>
                        <td style={{ padding: "9px 14px", textAlign: "right", paddingRight: 18 }}>
                          <div style={{ background: "#1a1a1a", borderRadius: 4, height: 8, width: 80, overflow: "hidden", marginLeft: "auto" }}>
                            <div style={{ width: `${(t.total / maxTipo) * 100}%`, height: "100%", background: "#3b82f6" }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 14 }}>💡 Insights</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.winRate >= 50 && (
              <div style={{ background: "#15803d22", border: "1px solid #22c55e33", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#22c55e" }}>
                ✅ Win rate {stats.winRate.toFixed(0)}% — Por encima del promedio del mercado (35-45%). Excelente performance.
              </div>
            )}
            {stats.winRate < 30 && (
              <div style={{ background: "#7f1d1d22", border: "1px solid #cc000033", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#cc0000" }}>
                ⚠️ Win rate {stats.winRate.toFixed(0)}% — Por debajo del promedio. Revisar estrategia de calificación y propuestas.
              </div>
            )}
            {stats.avgDiasCierre > 90 && (
              <div style={{ background: "#78350f22", border: "1px solid #f9731633", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f97316" }}>
                🕐 Ciclo de cierre promedio: {stats.avgDiasCierre.toFixed(0)} días. Ciclos largos impactan el cash flow. Revisar seguimiento y urgencia.
              </div>
            )}
            {stats.avgDiasCierre > 0 && stats.avgDiasCierre <= 60 && (
              <div style={{ background: "#1e3a5f22", border: "1px solid #3b82f633", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#3b82f6" }}>
                ⚡ Ciclo rápido de {stats.avgDiasCierre.toFixed(0)} días — Buena velocidad de pipeline.
              </div>
            )}
            {stats.avgIntCierre > 0 && (
              <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#9ca3af" }}>
                📞 Promedio de {stats.avgIntCierre.toFixed(1)} interacciones por cierre exitoso.
                {stats.avgIntCierre < 5 ? " Bajo contacto — posible oportunidad de más seguimiento." : " Buen nivel de contacto."}
              </div>
            )}
            {stats.activos === 0 && stats.total > 0 && (
              <div style={{ background: "#1c1107", border: "1px solid #f9731644", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f97316" }}>
                🔥 Pipeline vacío — Todos los negocios del período están cerrados o perdidos. Momento de prospectar.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
