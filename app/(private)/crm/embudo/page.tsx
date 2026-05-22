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
  archivado: boolean;
}

const ETAPAS = [
  { key: "prospecto",    label: "Prospecto",    color: "#6b7280" },
  { key: "calificado",   label: "Calificado",   color: "#3b82f6" },
  { key: "propuesta",    label: "Propuesta",    color: "#a855f7" },
  { key: "negociacion",  label: "Negociación",  color: "#f97316" },
  { key: "reservado",    label: "Reservado",    color: "#eab308" },
  { key: "en_escritura", label: "En Escritura", color: "#22c55e" },
  { key: "cerrado",      label: "Cerrado",      color: "#cc0000" },
];

const PROB: Record<string, number> = {
  prospecto: 10, calificado: 25, propuesta: 40,
  negociacion: 65, reservado: 80, en_escritura: 92, cerrado: 100,
};

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function EmbudoPage() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [tc, setTc] = useState(1300);
  const [honPct, setHonPct] = useState(3);
  const [periodo, setPeriodo] = useState(90); // días

  useEffect(() => {
    supabase
      .from("crm_negocios")
      .select("id,titulo,etapa,tipo_operacion,valor_operacion,moneda,honorarios_pct,created_at,archivado")
      .eq("archivado", false)
      .then(({ data }) => {
        setNegocios((data ?? []) as Negocio[]);
        setLoading(false);
      });
  }, []);

  const desde = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodo);
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  const negFiltrados = useMemo(() => {
    return negocios.filter(n => {
      if (filtroTipo !== "todos" && n.tipo_operacion !== filtroTipo) return false;
      if (n.created_at.slice(0, 10) < desde) return false;
      return true;
    });
  }, [negocios, filtroTipo, desde]);

  const porEtapa = useMemo(() => {
    const map: Record<string, Negocio[]> = {};
    ETAPAS.forEach(e => { map[e.key] = []; });
    negFiltrados.forEach(n => {
      if (map[n.etapa]) map[n.etapa].push(n);
    });
    return map;
  }, [negFiltrados]);

  const maxCount = useMemo(() => {
    return Math.max(1, ...ETAPAS.map(e => porEtapa[e.key]?.length ?? 0));
  }, [porEtapa]);

  const valorUSD = (n: Negocio) => {
    const v = n.valor_operacion ?? 0;
    return n.moneda === "ARS" ? v / tc : v;
  };

  const honorariosUSD = (n: Negocio) => {
    const v = valorUSD(n);
    const pct = (n.honorarios_pct ?? honPct) / 100;
    return v * pct;
  };

  const conversionEntre = (desde: string, hasta: string) => {
    const d = porEtapa[desde]?.length ?? 0;
    const h = porEtapa[hasta]?.length ?? 0;
    if (d === 0) return null;
    return ((h / d) * 100).toFixed(0) + "%";
  };

  const pipelineTotal = useMemo(() => {
    return negFiltrados
      .filter(n => n.etapa !== "cerrado")
      .reduce((sum, n) => sum + valorUSD(n) * (PROB[n.etapa] ?? 0) / 100, 0);
  }, [negFiltrados, tc]);

  const honorariosPonderados = useMemo(() => {
    return negFiltrados
      .filter(n => n.etapa !== "cerrado")
      .reduce((sum, n) => sum + honorariosUSD(n) * (PROB[n.etapa] ?? 0) / 100, 0);
  }, [negFiltrados, tc, honPct]);

  const cerradosValor = useMemo(() => {
    return (porEtapa["cerrado"] ?? []).reduce((s, n) => s + valorUSD(n), 0);
  }, [porEtapa, tc]);

  const cerradosHon = useMemo(() => {
    return (porEtapa["cerrado"] ?? []).reduce((s, n) => s + honorariosUSD(n), 0);
  }, [porEtapa, tc, honPct]);

  const tiposOp = useMemo(() => {
    const set = new Set(negocios.map(n => n.tipo_operacion).filter(Boolean));
    return Array.from(set) as string[];
  }, [negocios]);

  if (loading) return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
      Cargando embudo…
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🔻 Embudo de Conversión
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
              {negFiltrados.length} negocios · últimos {periodo} días
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
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
              <option value={180}>6 meses</option>
              <option value={365}>1 año</option>
              <option value={3650}>Todo</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Tipo operación</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13 }}>
              <option value="todos">Todos</option>
              {tiposOp.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>TC USD/ARS</label>
            <input type="number" value={tc} onChange={e => setTc(parseFloat(e.target.value) || 1)}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: 90 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>% Honorarios</label>
            <input type="number" value={honPct} onChange={e => setHonPct(parseFloat(e.target.value) || 0)} step={0.5}
              style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 13, width: 70 }} />
          </div>
        </div>

        {/* KPIs summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Pipeline Ponderado", value: `USD ${fmt(pipelineTotal)}`, sub: "valor × probabilidad etapa", color: "#3b82f6" },
            { label: "Honorarios Esperados", value: `USD ${fmt(honorariosPonderados)}`, sub: "ponderado por prob.", color: "#a855f7" },
            { label: "Cerrado (valor)", value: `USD ${fmt(cerradosValor)}`, sub: `${porEtapa["cerrado"]?.length ?? 0} operaciones`, color: "#22c55e" },
            { label: "Honorarios Reales", value: `USD ${fmt(cerradosHon)}`, sub: "operaciones cerradas", color: "#cc0000" },
          ].map(k => (
            <div key={k.label} style={{ background: "#111", border: `1px solid ${k.color}33`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Embudo visual */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 20 }}>Etapas del Pipeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ETAPAS.map((etapa, idx) => {
              const count = porEtapa[etapa.key]?.length ?? 0;
              const valor = (porEtapa[etapa.key] ?? []).reduce((s, n) => s + valorUSD(n), 0);
              const barW = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const conv = idx > 0 ? conversionEntre(ETAPAS[idx - 1].key, etapa.key) : null;
              return (
                <div key={etapa.key}>
                  {conv && (
                    <div style={{ textAlign: "center", fontSize: 11, color: "#4b5563", padding: "2px 0" }}>
                      ▼ conversión: <span style={{ color: "#9ca3af", fontWeight: 600 }}>{conv}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 110, textAlign: "right", fontSize: 12, color: etapa.color, fontFamily: "Montserrat, sans-serif", fontWeight: 700, flexShrink: 0 }}>
                      {etapa.label}
                    </div>
                    <div style={{ flex: 1, background: "#1a1a1a", borderRadius: 6, height: 36, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${barW}%`, background: `${etapa.color}44`, borderRight: `2px solid ${etapa.color}`, transition: "width 0.4s" }} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 10, gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 16, color: etapa.color }}>{count}</span>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>negocio{count !== 1 ? "s" : ""}</span>
                        {valor > 0 && <span style={{ fontSize: 11, color: "#9ca3af" }}>· USD {fmt(valor)}</span>}
                        <span style={{ fontSize: 10, color: "#4b5563", marginLeft: "auto", paddingRight: 10 }}>{PROB[etapa.key]}% prob.</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalle por etapa */}
        {ETAPAS.filter(e => (porEtapa[e.key]?.length ?? 0) > 0).map(etapa => (
          <div key={etapa.key} style={{ background: "#111", border: `1px solid ${etapa.color}33`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: etapa.color }}>
                {etapa.label} ({porEtapa[etapa.key]?.length ?? 0})
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                USD {fmt((porEtapa[etapa.key] ?? []).reduce((s, n) => s + valorUSD(n), 0))} total
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(porEtapa[etapa.key] ?? []).map(n => (
                <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f0f0f", borderRadius: 6, padding: "8px 12px" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5" }}>{n.titulo}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{n.tipo_operacion}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e5e5" }}>USD {fmt(valorUSD(n))}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Hon: USD {fmt(honorariosUSD(n))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {negFiltrados.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 60 }}>
            Sin negocios en el período seleccionado
          </div>
        )}
      </div>
    </div>
  );
}
