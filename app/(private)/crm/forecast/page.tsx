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
  moneda: string | null;
  tipo_operacion: string | null;
  fecha_cierre: string | null;
  created_at: string;
}

// ── Probabilidades por etapa ──────────────────────────────────────────────────

const PROB_ETAPA: Record<string, number> = {
  prospecto: 10,
  calificado: 25,
  propuesta: 40,
  negociacion: 65,
  reservado: 80,
  en_escritura: 92,
  cerrado: 100,
  perdido: 0,
};

const ETAPA_LABEL: Record<string, string> = {
  prospecto: "Prospecto",
  calificado: "Calificado",
  propuesta: "Propuesta",
  negociacion: "Negociación",
  reservado: "Reservado",
  en_escritura: "En Escritura",
  cerrado: "Cerrado",
  perdido: "Perdido",
};

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function mesLabel(fecha: string) {
  const d = new Date(fecha);
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function Forecast() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [tcDolar, setTcDolar] = useState(1200);
  const [honorariosPct, setHonorariosPct] = useState(3.0);
  const [vistaHorizonteMeses, setVistaHorizonteMeses] = useState(6);
  const [modoConfianza, setModoConfianza] = useState<"pesimista"|"base"|"optimista">("base");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("crm_negocios")
        .select("id,titulo,etapa,valor_operacion,moneda,tipo_operacion,fecha_cierre,created_at")
        .eq("perfil_id", user.id)
        .not("etapa", "in", "(perdido)")
        .order("fecha_cierre", { ascending: true });
      setNegocios((data ?? []) as Negocio[]);
      setLoading(false);
    }
    load();
  }, []);

  const factorConfianza = modoConfianza === "pesimista" ? 0.6 : modoConfianza === "optimista" ? 1.25 : 1.0;

  const analisis = useMemo(() => {
    const hoy = new Date();
    const fin = new Date(hoy);
    fin.setMonth(fin.getMonth() + vistaHorizonteMeses);

    // Negocios dentro del horizonte
    const enHorizonte = negocios.filter(n => {
      if (!n.fecha_cierre) return false;
      const fecha = new Date(n.fecha_cierre);
      return fecha >= hoy && fecha <= fin;
    });

    // Para cada negocio, calcular valor ponderado
    const procesados = enHorizonte.map(n => {
      const valorUSD = n.moneda === "ARS" && tcDolar > 0
        ? (n.valor_operacion ?? 0) / tcDolar
        : (n.valor_operacion ?? 0);
      const prob = PROB_ETAPA[n.etapa] ?? 10;
      const probEfectiva = Math.min(100, prob * factorConfianza) / 100;
      const honorarios = valorUSD * honorariosPct / 100;
      const honorariosPonderado = honorarios * probEfectiva;
      return { ...n, valorUSD, prob, probEfectiva, honorarios, honorariosPonderado };
    });

    // Agrupar por mes
    const porMes = new Map<string, { label: string; bruto: number; ponderado: number; cantidad: number }>();
    procesados.forEach(n => {
      const key = n.fecha_cierre!.substring(0, 7);
      const label = mesLabel(n.fecha_cierre!);
      if (!porMes.has(key)) porMes.set(key, { label, bruto: 0, ponderado: 0, cantidad: 0 });
      const m = porMes.get(key)!;
      m.bruto += n.honorarios;
      m.ponderado += n.honorariosPonderado;
      m.cantidad++;
    });

    const meses = Array.from(porMes.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);

    const totalBruto = procesados.reduce((acc, n) => acc + n.honorarios, 0);
    const totalPonderado = procesados.reduce((acc, n) => acc + n.honorariosPonderado, 0);
    const totalValorUSD = procesados.reduce((acc, n) => acc + n.valorUSD, 0);

    // Por etapa
    const porEtapa = new Map<string, { cantidad: number; valorPonderado: number }>();
    procesados.forEach(n => {
      if (!porEtapa.has(n.etapa)) porEtapa.set(n.etapa, { cantidad: 0, valorPonderado: 0 });
      const e = porEtapa.get(n.etapa)!;
      e.cantidad++;
      e.valorPonderado += n.honorariosPonderado;
    });

    return { procesados, meses, totalBruto, totalPonderado, totalValorUSD, porEtapa };
  }, [negocios, tcDolar, honorariosPct, vistaHorizonteMeses, factorConfianza]);

  const maxPonderado = useMemo(() => Math.max(...analisis.meses.map(m => m.bruto), 1), [analisis.meses]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter',sans-serif" }}>Cargando forecast...</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Forecast de Ingresos
        </h1>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{analisis.procesados.length} negocios en horizonte</span>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Controles */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>HORIZONTE:</span>
            {[3, 6, 9, 12].map(m => (
              <button key={m} onClick={() => setVistaHorizonteMeses(m)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${vistaHorizonteMeses === m ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: vistaHorizonteMeses === m ? "rgba(204,0,0,0.12)" : "transparent", color: vistaHorizonteMeses === m ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
                {m}m
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>ESCENARIO:</span>
            {(["pesimista","base","optimista"] as const).map(s => (
              <button key={s} onClick={() => setModoConfianza(s)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${modoConfianza === s ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}`, background: modoConfianza === s ? "rgba(255,255,255,0.08)" : "transparent", color: modoConfianza === s ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                {s === "pesimista" ? "🔴 Pesimista" : s === "optimista" ? "🟢 Optimista" : "🟡 Base"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>TC:</span>
            <input type="number" value={tcDolar} onChange={e => setTcDolar(+e.target.value)} style={{ width: 90, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: 12, fontFamily: "'Inter',sans-serif" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Hon.%:</span>
            <input type="number" step="0.5" value={honorariosPct} onChange={e => setHonorariosPct(+e.target.value)} style={{ width: 60, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: 12, fontFamily: "'Inter',sans-serif" }} />
          </div>
        </div>

        {/* KPIs top */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Honorarios Potenciales", val: `USD ${fmt(analisis.totalBruto)}`, sub: `${vistaHorizonteMeses} meses`, color: "rgba(255,255,255,0.7)" },
            { label: "Honorarios Ponderados", val: `USD ${fmt(analisis.totalPonderado)}`, sub: `Ajustado por probabilidad`, color: "#cc0000" },
            { label: "Valor en Pipeline", val: `USD ${fmt(analisis.totalValorUSD)}`, sub: "Propiedades", color: "#3b82f6" },
            { label: "Deals en Horizonte", val: analisis.procesados.length.toString(), sub: "Negocios activos", color: "#f97316" },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{kpi.label}</p>
              <p style={{ margin: 0, fontSize: 22, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
          {/* Gráfico por mes */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
            <p style={{ margin: "0 0 20px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Proyección Mensual de Honorarios</p>
            {analisis.meses.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                No hay negocios con fecha de cierre en el horizonte seleccionado
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 180 }}>
                {analisis.meses.map(m => {
                  const hBruto = Math.max(8, (m.bruto / maxPonderado) * 160);
                  const hPond = Math.max(4, (m.ponderado / maxPonderado) * 160);
                  return (
                    <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>USD {fmt(m.ponderado)}</span>
                      <div style={{ width: "100%", position: "relative", height: hBruto, display: "flex", alignItems: "flex-end" }}>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: hBruto, background: "rgba(255,255,255,0.06)", borderRadius: "4px 4px 0 0" }} />
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: hPond, background: "rgba(204,0,0,0.5)", borderRadius: "4px 4px 0 0", border: "1px solid rgba(204,0,0,0.3)" }} />
                        <div style={{ position: "absolute", bottom: hPond, left: 0, right: 0, height: 2, background: "#cc0000", borderRadius: 1 }} />
                      </div>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>{m.label}</span>
                      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{m.cantidad} deal{m.cantidad !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Potencial bruto</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, background: "rgba(204,0,0,0.5)", borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Ponderado por prob.</span>
              </div>
            </div>
          </div>

          {/* Por etapa */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>
            <p style={{ margin: "0 0 16px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Por Etapa</p>
            {Array.from(analisis.porEtapa.entries()).sort((a, b) => (PROB_ETAPA[b[0]] ?? 0) - (PROB_ETAPA[a[0]] ?? 0)).map(([etapa, data]) => (
              <div key={etapa} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{ETAPA_LABEL[etapa] ?? etapa}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{data.cantidad} deal{data.cantidad !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(PROB_ETAPA[etapa] ?? 10)}%`, background: PROB_ETAPA[etapa] >= 80 ? "#22c55e" : PROB_ETAPA[etapa] >= 50 ? "#f97316" : "#3b82f6", borderRadius: 3 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Prob. {PROB_ETAPA[etapa] ?? 10}%</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#cc0000" }}>USD {fmt(data.valorPonderado)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla detalle */}
        <div style={{ marginTop: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
          <p style={{ margin: 0, padding: "14px 20px", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>Detalle de Negocios</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Negocio", "Etapa", "Prob.", "Valor", "Honorarios", "Hon. Ponderado", "Cierre Est."].map(h => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: h === "Negocio" ? "left" : "right", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analisis.procesados.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Sin negocios en el horizonte</td></tr>
              ) : analisis.procesados.map((n, i) => (
                <tr key={n.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td style={{ padding: "9px 14px", fontSize: 13 }}>{n.titulo}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: n.prob >= 80 ? "rgba(34,197,94,0.12)" : n.prob >= 50 ? "rgba(249,115,22,0.12)" : "rgba(59,130,246,0.12)", color: n.prob >= 80 ? "#22c55e" : n.prob >= 50 ? "#f97316" : "#3b82f6", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
                      {ETAPA_LABEL[n.etapa] ?? n.etapa}
                    </span>
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: n.prob >= 80 ? "#22c55e" : "rgba(255,255,255,0.6)" }}>{n.prob.toFixed(0)}%</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12 }}>USD {fmt(n.valorUSD)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>USD {fmt(n.honorarios)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#cc0000" }}>USD {fmt(n.honorariosPonderado)}</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {n.fecha_cierre ? mesLabel(n.fecha_cierre) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
