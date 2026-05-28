"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaPersonal {
  año: number;
  metaHonorariosUSD: number;
  metaOperaciones: number;
  metaNuevasCapt: number;
  metaTaskaciones: number;
  metaTasaCierreObj: number;
  notas: string;
}

interface Negocio {
  id: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  split_pct: number | null;
  fecha_cierre: string | null;
  tipo_operacion: string | null;
}

interface Contacto {
  id: string;
  created_at: string;
  tipo: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 45;

const DEFAULT_META: MetaPersonal = {
  año: new Date().getFullYear(),
  metaHonorariosUSD: 50000,
  metaOperaciones: 24,
  metaNuevasCapt: 48,
  metaTaskaciones: 20,
  metaTasaCierreObj: 30,
  notas: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function honorariosNetaUSD(n: Negocio, tc: number): number {
  const precio = n.valor_operacion ?? 0;
  const hPct = n.honorarios_pct ?? 0;
  const splitPct = n.split_pct ?? 0;
  const bruto = precio * (hPct / 100) * (1 - splitPct / 100);
  return n.moneda === "ARS" ? bruto / tc : bruto;
}

function progresoPct(real: number, meta: number): number {
  if (meta === 0) return 0;
  return Math.min((real / meta) * 100, 100);
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: decimals });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GaugeCircle({
  pct,
  label,
  real,
  meta,
  unit = "",
}: {
  pct: number;
  label: string;
  real: number;
  meta: number;
  unit?: string;
}) {
  const dash = (pct / 100) * CIRCUMFERENCE;
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#cc0000";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "24px 20px",
        flex: "1 1 200px",
        minWidth: 180,
      }}
    >
      <svg
        viewBox="0 0 120 120"
        width={110}
        height={110}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* background ring */}
        <circle
          cx={60}
          cy={60}
          r={45}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={10}
        />
        {/* progress arc */}
        <circle
          cx={60}
          cy={60}
          r={45}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* center text — undo the rotation */}
        <text
          x={60}
          y={60}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={18}
          fontWeight={800}
          fontFamily="Montserrat, sans-serif"
          style={{ transform: "rotate(90deg)", transformOrigin: "60px 60px" }}
        >
          {Math.round(pct)}%
        </text>
      </svg>

      <div
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          color: "rgba(255,255,255,0.7)",
          textAlign: "center",
          marginTop: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 20,
          fontWeight: 700,
          color: "#fff",
          marginTop: 4,
        }}
      >
        {fmt(real, real < 100 ? 0 : 0)}
        {unit ? ` ${unit}` : ""}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          color: "rgba(255,255,255,0.35)",
          marginTop: 2,
        }}
      >
        meta: {fmt(meta)}
        {unit ? ` ${unit}` : ""}
      </div>
    </div>
  );
}

function BarChart({
  mensual,
  metaMensual,
}: {
  mensual: number[];
  metaMensual: number;
}) {
  const maxVal = Math.max(...mensual, metaMensual, 1);
  const W = 900;
  const H = 200;
  const PAD_L = 60;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 30;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const colW = chartW / 12;
  const barW = colW * 0.55;

  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const toY = (v: number) => PAD_T + chartH - (v / maxVal) * chartH;

  const metaY = toY(metaMensual);
  const metaLinePoints = `${PAD_L},${metaY} ${PAD_L + chartW},${metaY}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", display: "block" }}
    >
      {/* Y axis */}
      <line
        x1={PAD_L}
        y1={PAD_T}
        x2={PAD_L}
        y2={PAD_T + chartH}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />

      {/* bars */}
      {mensual.map((v, i) => {
        const x = PAD_L + i * colW + (colW - barW) / 2;
        const barH = (v / maxVal) * chartH;
        const y = PAD_T + chartH - barH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill="#cc0000"
              rx={3}
              opacity={0.85}
            />
            {/* month label */}
            <text
              x={x + barW / 2}
              y={PAD_T + chartH + 16}
              textAnchor="middle"
              fill="rgba(255,255,255,0.4)"
              fontSize={11}
              fontFamily="Inter, sans-serif"
            >
              {meses[i]}
            </text>
            {/* value label */}
            {v > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize={9}
                fontFamily="Inter, sans-serif"
              >
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : fmt(v)}
              </text>
            )}
          </g>
        );
      })}

      {/* meta line dashed */}
      <polyline
        points={metaLinePoints}
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1.5}
        strokeDasharray="6,4"
      />
      <text
        x={PAD_L + chartW + 4}
        y={metaY + 4}
        fill="rgba(255,255,255,0.4)"
        fontSize={9}
        fontFamily="Inter, sans-serif"
      >
        meta
      </text>
    </svg>
  );
}

function ProgressRow({
  label,
  real,
  meta,
  unit,
  proyeccion,
}: {
  label: string;
  real: number;
  meta: number;
  unit: string;
  proyeccion: number;
}) {
  const pct = progresoPct(real, meta);
  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#cc0000";

  return (
    <tr>
      <td
        style={{
          padding: "12px 14px",
          color: "rgba(255,255,255,0.7)",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "12px 14px",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          textAlign: "right",
        }}
      >
        {fmt(meta)} {unit}
      </td>
      <td
        style={{
          padding: "12px 14px",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          textAlign: "right",
        }}
      >
        {fmt(real, real < 100 ? 1 : 0)} {unit}
      </td>
      <td style={{ padding: "12px 14px", minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 100,
              height: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: color,
                borderRadius: 100,
                transition: "width 0.5s",
              }}
            />
          </div>
          <span
            style={{
              color,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 12,
              minWidth: 36,
              textAlign: "right",
            }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </td>
      <td
        style={{
          padding: "12px 14px",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          textAlign: "right",
        }}
      >
        {fmt(proyeccion, proyeccion < 100 ? 1 : 0)} {unit}
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MetasPersonalesPage() {
  const añoActual = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1; // 1-12

  const [selectedAño, setSelectedAño] = useState<number>(añoActual);
  const [tipoCambio, setTipoCambio] = useState<number>(1300);
  const [meta, setMeta] = useState<MetaPersonal>({ ...DEFAULT_META, año: añoActual });
  const [editOpen, setEditOpen] = useState(false);
  const [formMeta, setFormMeta] = useState<MetaPersonal>({ ...DEFAULT_META, año: añoActual });
  const [uid, setUid] = useState<string | null>(null);

  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load auth + meta from Supabase ───────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_metas_personales")
        .select("*")
        .eq("perfil_id", userId)
        .eq("anio", selectedAño)
        .maybeSingle();
      if (row) {
        const loaded: MetaPersonal = {
          año: row.anio,
          metaHonorariosUSD: row.meta_honorarios_usd,
          metaOperaciones: row.meta_operaciones,
          metaNuevasCapt: row.meta_nuevas_capt,
          metaTaskaciones: row.meta_tasaciones,
          metaTasaCierreObj: row.meta_tasa_cierre_obj,
          notas: row.notas ?? "",
        };
        setMeta(loaded);
        setFormMeta(loaded);
        if (row.tipo_cambio) setTipoCambio(row.tipo_cambio);
      } else {
        const fresh = { ...DEFAULT_META, año: selectedAño };
        setMeta(fresh);
        setFormMeta(fresh);
      }
    });
  }, [selectedAño]);

  // ── Fetch Supabase data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const fetchData = async () => {
      const [negRes, contRes] = await Promise.all([
        supabase
          .from("crm_negocios")
          .select("id,etapa,valor_operacion,moneda,honorarios_pct,split_pct,fecha_cierre,tipo_operacion")
          .eq("perfil_id", uid)
          .eq("etapa", "cerrado"),
        supabase
          .from("crm_contactos")
          .select("id,created_at,tipo")
          .eq("perfil_id", uid)
          .gte("created_at", `${selectedAño}-01-01`),
      ]);
      setNegocios((negRes.data ?? []) as Negocio[]);
      setContactos((contRes.data ?? []) as Contacto[]);
      setLoading(false);
    };
    fetchData();
  }, [selectedAño, uid]);

  // ── Calculations (useMemo) ───────────────────────────────────────────────
  const negociosDelAño = useMemo(() => {
    return negocios.filter((n) => {
      if (!n.fecha_cierre) return false;
      return n.fecha_cierre.startsWith(String(selectedAño));
    });
  }, [negocios, selectedAño]);

  const realHonorariosUSD = useMemo(() => {
    return negociosDelAño.reduce((sum, n) => sum + honorariosNetaUSD(n, tipoCambio), 0);
  }, [negociosDelAño, tipoCambio]);

  const realOperaciones = useMemo(() => negociosDelAño.length, [negociosDelAño]);

  const realCaptaciones = useMemo(() => {
    return contactos.filter(
      (c) =>
        c.tipo === "propietario" || c.tipo === "vendedor"
    ).length;
  }, [contactos]);

  // Honorarios por mes (array de 12, índice 0=enero)
  const honorariosPorMes = useMemo(() => {
    const arr = new Array<number>(12).fill(0);
    negociosDelAño.forEach((n) => {
      if (!n.fecha_cierre) return;
      const m = parseInt(n.fecha_cierre.substring(5, 7), 10) - 1;
      if (m >= 0 && m < 12) {
        arr[m] += honorariosNetaUSD(n, tipoCambio);
      }
    });
    return arr;
  }, [negociosDelAño, tipoCambio]);

  // Proyección anual al ritmo actual
  const proyeccionHonorarios = useMemo(() => {
    if (mesActual === 0) return realHonorariosUSD;
    return (realHonorariosUSD / mesActual) * 12;
  }, [realHonorariosUSD, mesActual]);

  const proyeccionOperaciones = useMemo(() => {
    if (mesActual === 0) return realOperaciones;
    return (realOperaciones / mesActual) * 12;
  }, [realOperaciones, mesActual]);

  const proyeccionCaptaciones = useMemo(() => {
    if (mesActual === 0) return realCaptaciones;
    return (realCaptaciones / mesActual) * 12;
  }, [realCaptaciones, mesActual]);

  // Overall motivation score based on honorarios pct
  const motivacion = useMemo(() => {
    const p = progresoPct(realHonorariosUSD, meta.metaHonorariosUSD);
    if (p >= 80)
      return { msg: "Vas muy bien — seguí así!", color: "#22c55e" };
    if (p >= 50)
      return { msg: "En camino — mantené el ritmo", color: "#eab308" };
    return { msg: "Acelera el ritmo — el objetivo te espera", color: "#cc0000" };
  }, [realHonorariosUSD, meta.metaHonorariosUSD]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveMeta = async () => {
    if (!uid) return;
    const { error } = await supabase.from("crm_metas_personales").upsert({
      perfil_id: uid,
      anio: formMeta.año,
      meta_honorarios_usd: formMeta.metaHonorariosUSD,
      meta_operaciones: formMeta.metaOperaciones,
      meta_nuevas_capt: formMeta.metaNuevasCapt,
      meta_tasaciones: formMeta.metaTaskaciones,
      meta_tasa_cierre_obj: formMeta.metaTasaCierreObj,
      notas: formMeta.notas,
      tipo_cambio: tipoCambio,
      updated_at: new Date().toISOString(),
    }, { onConflict: "perfil_id,anio" });
    if (!error) {
      setMeta(formMeta);
      setSelectedAño(formMeta.año);
      setEditOpen(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    padding: "8px 12px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 5,
  };

  const sectionTitle: React.CSSProperties = {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 15,
    color: "#fff",
    marginBottom: 16,
    letterSpacing: 0.5,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
        padding: "28px 24px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              fontSize: 26,
              color: "#fff",
              margin: 0,
            }}
          >
            Metas Personales
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              margin: "6px 0 0",
            }}
          >
            Seguí tu progreso anual contra tus objetivos
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Año selector */}
          <div>
            <label style={labelStyle}>Año</label>
            <select
              value={selectedAño}
              onChange={(e) => setSelectedAño(Number(e.target.value))}
              style={{ ...inputStyle, width: 100, cursor: "pointer" }}
            >
              {[añoActual - 1, añoActual, añoActual + 1].map((y) => (
                <option key={y} value={y} style={{ background: "#111" }}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de cambio */}
          <div>
            <label style={labelStyle}>ARS/USD</label>
            <input
              type="number"
              value={tipoCambio}
              onChange={(e) => setTipoCambio(Math.max(1, Number(e.target.value)))}
              style={{ ...inputStyle, width: 110 }}
            />
          </div>

          {/* Editar meta */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={() => {
                setFormMeta({ ...meta });
                setEditOpen((v) => !v);
              }}
              style={{
                background: editOpen ? "rgba(204,0,0,0.2)" : "rgba(255,255,255,0.07)",
                border: `1px solid ${editOpen ? "#cc0000" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 8,
                color: editOpen ? "#cc0000" : "rgba(255,255,255,0.8)",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                padding: "9px 18px",
                cursor: "pointer",
              }}
            >
              {editOpen ? "Cerrar" : "Editar Meta"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Motivación ──────────────────────────────────────────────────────── */}
      {!loading && (
        <div
          style={{
            background: `${motivacion.color}15`,
            border: `1px solid ${motivacion.color}40`,
            borderRadius: 10,
            padding: "12px 18px",
            marginBottom: 28,
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: motivacion.color,
          }}
        >
          {motivacion.msg}
        </div>
      )}

      {/* ── Formulario de meta (colapsable) ─────────────────────────────────── */}
      {editOpen && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: 24,
            marginBottom: 32,
          }}
        >
          <h2 style={{ ...sectionTitle, marginBottom: 20 }}>
            Definir Meta {formMeta.año}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <label style={labelStyle}>Año</label>
              <input
                type="number"
                value={formMeta.año}
                onChange={(e) =>
                  setFormMeta((f) => ({ ...f, año: Number(e.target.value) }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Honorarios Netos (USD)</label>
              <input
                type="number"
                value={formMeta.metaHonorariosUSD}
                onChange={(e) =>
                  setFormMeta((f) => ({
                    ...f,
                    metaHonorariosUSD: Number(e.target.value),
                  }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Operaciones cerradas</label>
              <input
                type="number"
                value={formMeta.metaOperaciones}
                onChange={(e) =>
                  setFormMeta((f) => ({
                    ...f,
                    metaOperaciones: Number(e.target.value),
                  }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Nuevas captaciones</label>
              <input
                type="number"
                value={formMeta.metaNuevasCapt}
                onChange={(e) =>
                  setFormMeta((f) => ({
                    ...f,
                    metaNuevasCapt: Number(e.target.value),
                  }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Tasaciones objetivo</label>
              <input
                type="number"
                value={formMeta.metaTaskaciones}
                onChange={(e) =>
                  setFormMeta((f) => ({
                    ...f,
                    metaTaskaciones: Number(e.target.value),
                  }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Tasa de cierre obj. (%)</label>
              <input
                type="number"
                value={formMeta.metaTasaCierreObj}
                onChange={(e) =>
                  setFormMeta((f) => ({
                    ...f,
                    metaTasaCierreObj: Number(e.target.value),
                  }))
                }
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notas</label>
            <textarea
              value={formMeta.notas}
              onChange={(e) =>
                setFormMeta((f) => ({ ...f, notas: e.target.value }))
              }
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: 72,
                lineHeight: 1.5,
              }}
              placeholder="Estrategia, compromisos, recordatorios..."
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => setEditOpen(false)}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                color: "rgba(255,255,255,0.5)",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                padding: "9px 20px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveMeta}
              style={{
                background: "#cc0000",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                padding: "9px 24px",
                cursor: "pointer",
              }}
            >
              Guardar Meta
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Cargando datos...
        </div>
      ) : (
        <>
          {/* ── 4 KPI Gauges ──────────────────────────────────────────────── */}
          <div style={{ marginBottom: 36 }}>
            <h2 style={sectionTitle}>Indicadores del Año {selectedAño}</h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <GaugeCircle
                pct={progresoPct(realHonorariosUSD, meta.metaHonorariosUSD)}
                label="Honorarios Netos"
                real={Math.round(realHonorariosUSD)}
                meta={meta.metaHonorariosUSD}
                unit="USD"
              />
              <GaugeCircle
                pct={progresoPct(realOperaciones, meta.metaOperaciones)}
                label="Operaciones Cerradas"
                real={realOperaciones}
                meta={meta.metaOperaciones}
                unit="ops"
              />
              <GaugeCircle
                pct={progresoPct(realCaptaciones, meta.metaNuevasCapt)}
                label="Nuevas Captaciones"
                real={realCaptaciones}
                meta={meta.metaNuevasCapt}
                unit="capt"
              />
              <GaugeCircle
                pct={progresoPct(proyeccionHonorarios, meta.metaHonorariosUSD)}
                label="Proyección Anual"
                real={Math.round(proyeccionHonorarios)}
                meta={meta.metaHonorariosUSD}
                unit="USD"
              />
            </div>
          </div>

          {/* ── Bar chart mensual ────────────────────────────────────────── */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "20px 16px",
              marginBottom: 36,
            }}
          >
            <h2 style={sectionTitle}>
              Honorarios por Mes — {selectedAño}
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
                marginBottom: 12,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Barras = real. Línea punteada = meta mensual (
              {fmt(meta.metaHonorariosUSD / 12, 0)} USD/mes)
            </p>
            <BarChart
              mensual={honorariosPorMes}
              metaMensual={meta.metaHonorariosUSD / 12}
            />
          </div>

          {/* ── Tabla de análisis ────────────────────────────────────────── */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              marginBottom: 36,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "20px 20px 4px" }}>
              <h2 style={sectionTitle}>Análisis de Métricas</h2>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {["Métrica", "Meta", "Real", "Progreso", "Proyección"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 14px",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 11,
                            color: "rgba(255,255,255,0.35)",
                            textAlign: h === "Métrica" ? "left" : "right",
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                          }}
                        >
                          {h === "Progreso" ? (
                            <span style={{ textAlign: "left", display: "block" }}>
                              {h}
                            </span>
                          ) : (
                            h
                          )}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  <ProgressRow
                    label="Honorarios Netos (USD)"
                    real={realHonorariosUSD}
                    meta={meta.metaHonorariosUSD}
                    unit="USD"
                    proyeccion={proyeccionHonorarios}
                  />
                  <tr
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td colSpan={5} style={{ padding: 0 }} />
                  </tr>
                  <ProgressRow
                    label="Operaciones Cerradas"
                    real={realOperaciones}
                    meta={meta.metaOperaciones}
                    unit="ops"
                    proyeccion={proyeccionOperaciones}
                  />
                  <tr
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td colSpan={5} style={{ padding: 0 }} />
                  </tr>
                  <ProgressRow
                    label="Nuevas Captaciones"
                    real={realCaptaciones}
                    meta={meta.metaNuevasCapt}
                    unit="capt"
                    proyeccion={proyeccionCaptaciones}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Notas de la meta ─────────────────────────────────────────── */}
          {meta.notas && (
            <div
              style={{
                background: "rgba(204,0,0,0.06)",
                border: "1px solid rgba(204,0,0,0.2)",
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  color: "#cc0000",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                Notas de la Meta
              </div>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.6)",
                  margin: 0,
                  lineHeight: 1.6,
                  whiteSpace: "pre-line",
                }}
              >
                {meta.notas}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
