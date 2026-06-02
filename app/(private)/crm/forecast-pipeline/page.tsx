"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

interface Negocio {
  id: string;
  titulo: string;
  tipo_operacion: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  split_pct: number | null;
  fecha_reserva: string | null;
  fecha_escritura: string | null;
  fecha_cierre: string | null;
  created_at: string;
  updated_at: string;
  archivado: boolean;
}

interface EtapaConfig {
  value: string;
  label: string;
  color: string;
  prob: number; // probabilidad de cierre 0-100
}

const ETAPAS_CONFIG: EtapaConfig[] = [
  { value: "prospecto",         label: "Prospecto",        color: "#6b7280", prob: 5  },
  { value: "contactado",        label: "Contactado",       color: "#3b82f6", prob: 15 },
  { value: "visita_coordinada", label: "Visita coord.",    color: "#8b5cf6", prob: 25 },
  { value: "visita_realizada",  label: "Visita realizada", color: "#a78bfa", prob: 35 },
  { value: "oferta_enviada",    label: "Oferta enviada",   color: "#d4960c", prob: 50 },
  { value: "negociacion",       label: "Negociación",      color: "#d4960c", prob: 65 },
  { value: "reserva",           label: "Reserva",          color: "#06b6d4", prob: 85 },
  { value: "escritura",         label: "Escritura",        color: "#3abab6", prob: 95 },
  { value: "cerrado",           label: "Cerrado",          color: "#3abab6", prob: 100 },
];

const TIPO_HON_DEFAULTS: Record<string, number> = {
  venta: 3,
  alquiler: 5,
  alquiler_temporal: 10,
  loteo: 3,
  otro: 3,
};

function honBrutoUSD(n: Negocio, tc: number): number {
  if (!n.valor_operacion) return 0;
  const hon = n.honorarios_pct ?? TIPO_HON_DEFAULTS[n.tipo_operacion] ?? 3;
  const vUSD = n.moneda === "USD" ? n.valor_operacion : n.valor_operacion / tc;
  return vUSD * (hon / 100);
}

function honNetoUSD(n: Negocio, tc: number): number {
  const bruto = honBrutoUSD(n, tc);
  const split = n.split_pct ?? 0;
  return bruto * (1 - split / 100);
}

function getProb(etapa: string, overrides: Record<string, number>): number {
  if (etapa in overrides) return overrides[etapa];
  return ETAPAS_CONFIG.find((e) => e.value === etapa)?.prob ?? 10;
}

function fmtUSD(v: number): string {
  if (v >= 1000000) return `USD ${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `USD ${(v / 1000).toFixed(1)}k`;
  return `USD ${Math.round(v).toLocaleString("es-AR")}`;
}

function mesLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

function getClosingMonth(n: Negocio): number {
  const ref = n.fecha_cierre ?? n.fecha_escritura ?? n.fecha_reserva;
  if (!ref) return 0;
  const d = new Date(ref + "T12:00:00");
  const now = new Date();
  const diff = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  return Math.max(0, Math.min(11, diff));
}

export default function ForecastPipelinePage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [tc, setTc] = useState(1000);
  const [probOverrides, setProbOverrides] = useState<Record<string, number>>({});
  const [editingProb, setEditingProb] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id;
      if (!id) { setLoading(false); return; }
      supabase
        .from("crm_negocios")
        .select("*")
        .eq("perfil_id", id)
        .eq("archivado", false)
        .neq("etapa", "perdido")
        .order("updated_at", { ascending: false })
        .then(({ data: neg }) => {
          setNegocios(neg ?? []);
          setLoading(false);
        });
    });
  }, []);

  const etapaProbs = useMemo(() => {
    const result: Record<string, number> = {};
    for (const e of ETAPAS_CONFIG) {
      result[e.value] = probOverrides[e.value] ?? e.prob;
    }
    return result;
  }, [probOverrides]);

  const items = useMemo(() => {
    return negocios.map((n) => {
      const prob = getProb(n.etapa, probOverrides) / 100;
      const neto = honNetoUSD(n, tc);
      const bruto = honBrutoUSD(n, tc);
      const ponderado = neto * prob;
      const mesIdx = getClosingMonth(n);
      return { n, prob, neto, bruto, ponderado, mesIdx };
    });
  }, [negocios, probOverrides, tc]);

  // Totales
  const totalBruto = items.reduce((s, i) => s + i.bruto, 0);
  const totalNeto = items.reduce((s, i) => s + i.neto, 0);
  const totalPonderado = items.reduce((s, i) => s + i.ponderado, 0);

  // Por etapa
  const porEtapa = useMemo(() => {
    return ETAPAS_CONFIG.map((e) => {
      const its = items.filter((i) => i.n.etapa === e.value);
      return {
        ...e,
        count: its.length,
        totalNeto: its.reduce((s, i) => s + i.neto, 0),
        totalPond: its.reduce((s, i) => s + i.ponderado, 0),
      };
    }).filter((e) => e.count > 0);
  }, [items]);

  // Forecast por mes (próximos 12 meses)
  const forecastMeses = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({
      mes: i,
      label: mesLabel(i),
      garantizado: 0,
      ponderado: 0,
      optimista: 0,
    }));
    for (const it of items) {
      const m = it.mesIdx;
      arr[m].garantizado += it.n.etapa === "cerrado" ? it.neto : 0;
      arr[m].ponderado += it.ponderado;
      arr[m].optimista += it.neto;
    }
    return arr;
  }, [items]);

  const maxBar = Math.max(...forecastMeses.map((m) => m.optimista), 1);
  const barH = 100;

  const inp: React.CSSProperties = {
    background: "#161616", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 13, fontFamily: "Inter, sans-serif",
  };

  if (loading) return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
      Cargando forecast...
    </div>
  );

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, margin: 0 }}>
              Forecast de Pipeline
            </h1>
            <p style={{ color: "#999", fontSize: 13, margin: "6px 0 0" }}>
              Proyección de honorarios ponderados por probabilidad de cierre
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
              TC (ARS/USD)
            </div>
            <input
              type="number"
              value={tc}
              step={50}
              min={100}
              onChange={(e) => setTc(parseFloat(e.target.value) || 1000)}
              style={{ ...inp, width: 100 }}
            />
            <button
              onClick={() => setEditingProb(!editingProb)}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: editingProb ? "1px solid #990000" : "1px solid #333",
                background: editingProb ? "rgba(153,0,0,0.15)" : "#111",
                color: editingProb ? "#990000" : "#888",
                fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12,
                cursor: "pointer", textTransform: "uppercase",
              }}
            >
              {editingProb ? "✓ Guardar" : "⚙ Probabilidades"}
            </button>
          </div>
        </div>

        {/* Prob editor */}
        {editingProb && (
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, margin: "0 0 16px", color: "#990000" }}>
              Probabilidades de cierre por etapa (%)
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {ETAPAS_CONFIG.map((e) => (
                <div key={e.value} style={{ width: 140 }}>
                  <div style={{ fontSize: 10, color: e.color, fontFamily: "Montserrat, sans-serif", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>
                    {e.label}
                  </div>
                  <input
                    type="number"
                    value={probOverrides[e.value] ?? e.prob}
                    min={0} max={100} step={5}
                    onChange={(ev) => setProbOverrides((p) => ({ ...p, [e.value]: parseInt(ev.target.value) || 0 }))}
                    style={{ ...inp, width: "100%" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Negocios activos", value: negocios.length.toString(), color: "#fff" },
            { label: "Hon. bruto total", value: fmtUSD(totalBruto), color: "#fff" },
            { label: "Hon. neto total", value: fmtUSD(totalNeto), color: "#fff" },
            { label: "Forecast ponderado", value: fmtUSD(totalPonderado), color: "#990000" },
          ].map((k) => (
            <div key={k.label} style={{ background: "#111", border: k.color === "#990000" ? "1px solid rgba(153,0,0,0.4)" : "1px solid #222", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 10, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                {k.label}
              </div>
              <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: k.color }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          {/* Por etapa */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, margin: "0 0 16px", color: "#fff" }}>
              Pipeline por Etapa
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {porEtapa.map((e) => {
                const pct = totalNeto > 0 ? (e.totalNeto / totalNeto) * 100 : 0;
                return (
                  <div key={e.value}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color }} />
                        <span style={{ fontSize: 12, color: "#aaa" }}>{e.label}</span>
                        <span style={{ fontSize: 11, color: "#555", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          {e.count} neg.
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 12, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>
                          {fmtUSD(e.totalNeto)}
                        </span>
                        <span style={{ fontSize: 11, color: e.color, marginLeft: 8 }}>
                          ×{etapaProbs[e.value]}% = {fmtUSD(e.totalPond)}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: e.color, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Forecast mensual SVG */}
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, margin: "0 0 4px", color: "#fff" }}>
              Forecast Mensual (12 meses)
            </h2>
            <p style={{ color: "#666", fontSize: 11, margin: "0 0 16px" }}>
              Negocios con fecha estimada de cierre asignada
            </p>
            <svg width="100%" viewBox={`0 0 ${12 * 44} ${barH + 40}`} style={{ overflow: "visible" }}>
              {forecastMeses.map((m, i) => {
                const x = i * 44 + 4;
                const optH = maxBar > 0 ? (m.optimista / maxBar) * barH : 0;
                const pondH = maxBar > 0 ? (m.ponderado / maxBar) * barH : 0;
                return (
                  <g key={m.mes}>
                    {/* Optimista (fondo) */}
                    <rect x={x} y={barH - optH} width={36} height={optH} rx={3} fill="rgba(255,255,255,0.06)" />
                    {/* Ponderado */}
                    <rect x={x + 4} y={barH - pondH} width={28} height={pondH} rx={3} fill="rgba(153,0,0,0.7)" />
                    {/* Label mes */}
                    <text x={x + 18} y={barH + 14} textAnchor="middle" fill="#555" fontSize={8} fontFamily="Montserrat,sans-serif">
                      {m.label}
                    </text>
                    {pondH > 10 && (
                      <text x={x + 18} y={barH - pondH - 4} textAnchor="middle" fill="#990000" fontSize={7} fontFamily="Montserrat,sans-serif">
                        {fmtUSD(m.ponderado).replace("USD ", "")}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 8, borderRadius: 2, background: "rgba(255,255,255,0.06)", border: "1px solid #333" }} />
                <span style={{ fontSize: 10, color: "#666" }}>Optimista (100%)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 8, borderRadius: 2, background: "rgba(153,0,0,0.7)" }} />
                <span style={{ fontSize: 10, color: "#666" }}>Ponderado por prob.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de negocios */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, margin: "0 0 16px", color: "#fff" }}>
            Detalle por Negocio
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Negocio", "Tipo", "Etapa", "Prob.", "Hon. neto", "Pond.", "Fecha est."].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid #222" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items
                  .sort((a, b) => b.ponderado - a.ponderado)
                  .map(({ n, prob, neto, ponderado }) => {
                    const etapaConf = ETAPAS_CONFIG.find((e) => e.value === n.etapa);
                    const fechaRef = n.fecha_cierre ?? n.fecha_escritura ?? n.fecha_reserva;
                    return (
                      <tr key={n.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ padding: "9px 12px", color: "#fff", fontFamily: "Montserrat, sans-serif", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.titulo}
                        </td>
                        <td style={{ padding: "9px 12px", color: "#888" }}>
                          {n.tipo_operacion.replace("_", " ")}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ color: etapaConf?.color ?? "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11 }}>
                            {etapaConf?.label ?? n.etapa}
                          </span>
                        </td>
                        <td style={{ padding: "9px 12px", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#fff" }}>
                          {Math.round(prob * 100)}%
                        </td>
                        <td style={{ padding: "9px 12px", color: "#fff" }}>
                          {neto > 0 ? fmtUSD(neto) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#990000" }}>
                          {ponderado > 0 ? fmtUSD(ponderado) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", color: "#666" }}>
                          {fechaRef
                            ? new Date(fechaRef + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {items.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#444" }}>
                No hay negocios activos en el pipeline
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
