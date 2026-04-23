"use client";

// app/(private)/components/IndicadoresWidget.tsx
// ICL e IPC con acumulados: mensual, trimestral, cuatrimestral, semestral
// Mismo método que alquiler.com — producto encadenado de variaciones mensuales

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface HistorialItem {
  periodo: string; // 'YYYY-MM'
  valor: number;
}

interface Acumulados {
  mensual: number | null;
  trimestral: number | null;
  cuatrimestral: number | null;
  semestral: number | null;
}

interface IndicadorState {
  ultimo: number | null;
  ultimoPeriodo: string | null;
  acumulados: Acumulados;
  historial: HistorialItem[];
  loading: boolean;
}

// ── Cálculo de acumulado ──────────────────────────────────────────────────────
// Para ICL: acumulado = (valor_actual / valor_hace_N_meses) - 1
// Para IPC: acumulado = producto encadenado de variaciones mensuales
//           = (1 + m1/100) * (1 + m2/100) * ... - 1

function calcularAcumuladosICL(historial: HistorialItem[]): Acumulados {
  if (!historial || historial.length === 0) {
    return { mensual: null, trimestral: null, cuatrimestral: null, semestral: null };
  }
  // Ordenar de más reciente a más antiguo
  const sorted = [...historial].sort((a, b) => b.periodo.localeCompare(a.periodo));
  const ultimo = sorted[0]?.valor;
  if (!ultimo) return { mensual: null, trimestral: null, cuatrimestral: null, semestral: null };

  const getAcum = (meses: number): number | null => {
    if (sorted.length <= meses) return null;
    const base = sorted[meses]?.valor;
    if (!base) return null;
    return ((ultimo / base) - 1) * 100;
  };

  return {
    mensual: getAcum(1),
    trimestral: getAcum(3),
    cuatrimestral: getAcum(4),
    semestral: getAcum(6),
  };
}

function calcularAcumuladosIPC(historial: HistorialItem[]): Acumulados {
  if (!historial || historial.length === 0) {
    return { mensual: null, trimestral: null, cuatrimestral: null, semestral: null };
  }
  const sorted = [...historial].sort((a, b) => b.periodo.localeCompare(a.periodo));

  const getAcum = (meses: number): number | null => {
    const ultimos = sorted.slice(0, meses);
    if (ultimos.length < meses) return null;
    const producto = ultimos.reduce((acc, item) => acc * (1 + item.valor / 100), 1);
    return (producto - 1) * 100;
  };

  return {
    mensual: sorted[0]?.valor ?? null,
    trimestral: getAcum(3),
    cuatrimestral: getAcum(4),
    semestral: getAcum(6),
  };
}

// ── Formato ───────────────────────────────────────────────────────────────────

const fmt = (n: number | null, decimales = 2): string => {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}%`;
};

const fmtPeriodo = (p: string | null): string => {
  if (!p) return "";
  const [anio, mes] = p.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${meses[parseInt(mes) - 1]} ${anio}`;
};

const colorAcum = (n: number | null): string => {
  if (n === null) return "rgba(255,255,255,0.4)";
  if (n > 0) return "#f87171";  // rojo — sube
  return "#22c55e";              // verde — baja
};

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  compact?: boolean;
}

export default function IndicadoresWidget({ compact = false }: Props) {
  const [icl, setIcl] = useState<IndicadorState>({
    ultimo: null, ultimoPeriodo: null,
    acumulados: { mensual: null, trimestral: null, cuatrimestral: null, semestral: null },
    historial: [], loading: true,
  });
  const [ipc, setIpc] = useState<IndicadorState>({
    ultimo: null, ultimoPeriodo: null,
    acumulados: { mensual: null, trimestral: null, cuatrimestral: null, semestral: null },
    historial: [], loading: true,
  });
  const [jus, setJus] = useState<{ valor: number | null; loading: boolean }>({ valor: null, loading: true });

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    // Traer historial de los últimos 8 meses (necesitamos 6 + 2 de margen)
    const hace8meses = new Date();
    hace8meses.setMonth(hace8meses.getMonth() - 8);
    const periodoDesde = hace8meses.toISOString().substring(0, 7);

    const [{ data: histICL }, { data: histIPC }, { data: indJus }] = await Promise.all([
      supabase.from("indicadores_historial")
        .select("valor, periodo")
        .eq("clave", "icl")
        .gte("periodo", periodoDesde)
        .order("periodo", { ascending: false }),
      supabase.from("indicadores_historial")
        .select("valor, periodo")
        .eq("clave", "ipc")
        .gte("periodo", periodoDesde)
        .order("periodo", { ascending: false }),
      supabase.from("indicadores")
        .select("valor")
        .eq("clave", "valor_jus")
        .single(),
    ]);

    // Intentar actualizar ICL desde argentinadatos
    fetch("https://argentinadatos.com/api/v1/finanzas/indices/icl/ultimo")
      .then(r => r.json())
      .then(async (d) => {
        const valor = d?.valor ?? null;
        const periodo = d?.fecha?.substring(0, 7) ?? null;
        if (valor && periodo) {
          // Upsert en historial
          await supabase.from("indicadores_historial").upsert(
            { clave: "icl", valor, periodo, descripcion: `ICL ${periodo}`, fuente: "BCRA" },
            { onConflict: "clave,periodo", ignoreDuplicates: true }
          );
          // Actualizar indicadores
          await supabase.from("indicadores").upsert(
            { clave: "icl_diario", valor, descripcion: `ICL - ${periodo}`, actualizado_at: new Date().toISOString() },
            { onConflict: "clave" }
          );
        }
      })
      .catch(() => {}); // silencioso, ya tenemos los datos de Supabase

    // Intentar actualizar IPC desde argentinadatos
    fetch("https://argentinadatos.com/api/v1/finanzas/indices/inflacion/ultimo")
      .then(r => r.json())
      .then(async (d) => {
        const valor = d?.valor ?? null;
        const periodo = d?.fecha?.substring(0, 7) ?? null;
        if (valor && periodo) {
          await supabase.from("indicadores_historial").upsert(
            { clave: "ipc", valor, periodo, descripcion: `IPC ${periodo}`, fuente: "INDEC" },
            { onConflict: "clave,periodo", ignoreDuplicates: true }
          );
          await supabase.from("indicadores").upsert(
            { clave: "ipc_mensual", valor, descripcion: `IPC Mensual - ${periodo}`, actualizado_at: new Date().toISOString() },
            { onConflict: "clave" }
          );
        }
      })
      .catch(() => {});

    // Procesar ICL
    const iclHist: HistorialItem[] = (histICL || []).map(h => ({ periodo: h.periodo, valor: Number(h.valor) }));
    const iclAcum = calcularAcumuladosICL(iclHist);
    setIcl({
      ultimo: iclHist[0]?.valor ?? null,
      ultimoPeriodo: iclHist[0]?.periodo ?? null,
      acumulados: iclAcum,
      historial: iclHist,
      loading: false,
    });

    // Procesar IPC
    const ipcHist: HistorialItem[] = (histIPC || []).map(h => ({ periodo: h.periodo, valor: Number(h.valor) }));
    const ipcAcum = calcularAcumuladosIPC(ipcHist);
    setIpc({
      ultimo: ipcHist[0]?.valor ?? null,
      ultimoPeriodo: ipcHist[0]?.periodo ?? null,
      acumulados: ipcAcum,
      historial: ipcHist,
      loading: false,
    });

    // Valor JUS
    setJus({ valor: indJus?.valor ? Number(indJus.valor) : null, loading: false });
  };

  if (compact) {
    // Versión compacta para el dashboard — solo último valor
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        <IndCard
          label="ICL DIARIO · BCRA"
          valor={icl.ultimo !== null ? icl.ultimo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : null}
          sub={fmtPeriodo(icl.ultimoPeriodo)}
          loading={icl.loading}
        />
        <IndCard
          label="IPC MENSUAL · INDEC"
          valor={ipc.ultimo !== null ? `${ipc.ultimo.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%` : null}
          sub={fmtPeriodo(ipc.ultimoPeriodo)}
          loading={ipc.loading}
        />
        {jus.valor && (
          <IndCard
            label="VALOR JUS · COCIR"
            valor={`$ ${jus.valor.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
            sub="Ley 13.154"
            loading={jus.loading}
          />
        )}
      </div>
    );
  }

  // Versión completa con acumulados
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ICL */}
      <IndicadorCompleto
        titulo="ICL — Índice de Contratos de Locación"
        fuente="BCRA"
        ultimo={icl.ultimo}
        ultimoPeriodo={icl.ultimoPeriodo}
        acumulados={icl.acumulados}
        loading={icl.loading}
        tipo="icl"
        descripcion="Índice oficial para actualización de contratos de alquiler. Acumulado = variación del índice entre períodos."
      />

      {/* IPC */}
      <IndicadorCompleto
        titulo="IPC — Índice de Precios al Consumidor"
        fuente="INDEC"
        ultimo={ipc.ultimo}
        ultimoPeriodo={ipc.ultimoPeriodo}
        acumulados={ipc.acumulados}
        loading={ipc.loading}
        tipo="ipc"
        descripcion="Inflación mensual. Acumulado = producto encadenado de variaciones mensuales (igual que alquiler.com)."
      />

      {/* Valor JUS */}
      {(jus.valor || jus.loading) && (
        <div style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.35)" }}>
              VALOR JUS · COCIR 2DA CIRC.
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Ley 13.154</span>
          </div>
          {jus.loading
            ? <Skeleton w={120} h={28} />
            : <div style={{ fontSize: 26, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>
                $ {jus.valor?.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </div>
          }
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Honorarios profesionales · COCIR</div>
        </div>
      )}

      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center" as const, fontStyle: "italic" }}>
        Fuentes: BCRA · INDEC · Cálculo igual a alquiler.com — solo referencia
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Skeleton({ w, h }: { w: number; h: number }) {
  return <div style={{ width: w, height: h, background: "rgba(255,255,255,0.06)", borderRadius: 4, animation: "pulse 1.5s infinite" }} />;
}

function IndCard({ label, valor, sub, loading }: { label: string; valor: string | null; sub?: string; loading: boolean }) {
  return (
    <div style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "14px 18px" }}>
      <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>{label}</div>
      {loading ? <Skeleton w={80} h={20} /> : (
        <>
          <div style={{ fontSize: 20, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>{valor ?? "Sin datos"}</div>
          {sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>{sub}</div>}
        </>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  );
}

function IndicadorCompleto({ titulo, fuente, ultimo, ultimoPeriodo, acumulados, loading, tipo, descripcion }: {
  titulo: string; fuente: string; ultimo: number | null; ultimoPeriodo: string | null;
  acumulados: Acumulados; loading: boolean; tipo: "icl" | "ipc"; descripcion: string;
}) {
  const PERIODOS = [
    { key: "mensual", label: "Mensual", meses: "1m" },
    { key: "trimestral", label: "Trimestral", meses: "3m" },
    { key: "cuatrimestral", label: "Cuatrimestral", meses: "4m" },
    { key: "semestral", label: "Semestral", meses: "6m" },
  ] as const;

  const valorUltimo = tipo === "icl"
    ? ultimo?.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) ?? "—"
    : ultimo !== null ? `${ultimo.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%` : "—";

  return (
    <div style={{ background: "rgba(14,14,14,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "16px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap" as const, gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>{titulo}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{descripcion}</div>
        </div>
        <div style={{ textAlign: "right" as const }}>
          {loading ? <Skeleton w={80} h={24} /> : (
            <>
              <div style={{ fontSize: 22, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: "#fff" }}>{valorUltimo}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{fmtPeriodo(ultimoPeriodo)} · {fuente}</div>
            </>
          )}
        </div>
      </div>

      {/* Acumulados */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {PERIODOS.map(p => {
          const val = acumulados[p.key];
          return (
            <div key={p.key} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "10px 12px", textAlign: "center" as const }}>
              <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
                {p.label}
              </div>
              {loading ? <Skeleton w={50} h={18} /> : (
                <div style={{ fontSize: 16, fontFamily: "Montserrat,sans-serif", fontWeight: 800, color: colorAcum(val) }}>
                  {fmt(val, 2)}
                </div>
              )}
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 3 }}>{p.meses}</div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  );
}
