"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface KPIs {
  llamadas: number;
  visitas: number;
  tasaciones: number;
  captaciones: number;
  cierres: number;
  nuevosContactos: number;
  whatsapps: number;
  publicaciones: number;
}

interface SemanaScore {
  semana: string;
  fechaInicio: string;
  fechaFin: string;
  kpis: KPIs;
  metas: KPIs;
  negociosCerrados: number;
  honorariosGenerados: number;
  contactosNuevos: number;
  score: number;
  comentario: string;
}

type KPIKey = keyof KPIs;

// ── Constantes ────────────────────────────────────────────────────────────────

const PESOS: KPIs = {
  llamadas: 15,
  visitas: 20,
  tasaciones: 15,
  captaciones: 20,
  cierres: 30,
  nuevosContactos: 0,
  whatsapps: 0,
  publicaciones: 0,
};

const METAS_DEFAULT: KPIs = {
  llamadas: 80,
  visitas: 10,
  tasaciones: 4,
  captaciones: 2,
  cierres: 1,
  nuevosContactos: 20,
  whatsapps: 60,
  publicaciones: 15,
};

const KPI_LABELS: { key: KPIKey; label: string }[] = [
  { key: "llamadas", label: "Llamadas" },
  { key: "visitas", label: "Visitas" },
  { key: "tasaciones", label: "Tasaciones" },
  { key: "captaciones", label: "Captaciones" },
  { key: "cierres", label: "Cierres" },
  { key: "nuevosContactos", label: "Nuevos Contactos" },
  { key: "whatsapps", label: "WhatsApps" },
  { key: "publicaciones", label: "Publicaciones" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

function isoWeekToString(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getWeekBounds(year: number, week: number): { fechaInicio: string; fechaFin: string } {
  // Find the Monday of given ISO week
  const jan4 = new Date(Date.UTC(year, 0, 4)); // Jan 4 is always in week 1
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() + (week - 1) * 7 * 86400000 - (jan4Day - 1) * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return {
    fechaInicio: monday.toISOString().slice(0, 10),
    fechaFin: sunday.toISOString().slice(0, 10),
  };
}

function build12Weeks(): { semana: string; fechaInicio: string; fechaFin: string }[] {
  const today = new Date();
  const result: { semana: string; fechaInicio: string; fechaFin: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 7 * 86400000);
    const { week, year } = getISOWeek(d);
    const semana = isoWeekToString(year, week);
    const { fechaInicio, fechaFin } = getWeekBounds(year, week);
    if (!result.find((r) => r.semana === semana)) {
      result.push({ semana, fechaInicio, fechaFin });
    }
  }
  return result;
}

function calcularScore(kpis: KPIs, metas: KPIs): number {
  const pesoKeys: KPIKey[] = ["llamadas", "visitas", "tasaciones", "captaciones", "cierres"];
  const totalPeso = pesoKeys.reduce((acc, k) => acc + PESOS[k], 0);
  let scorePonderado = 0;
  for (const k of pesoKeys) {
    const ratio = metas[k] > 0 ? Math.min(kpis[k] / metas[k], 1) : 0;
    scorePonderado += ratio * PESOS[k];
  }
  let score = (scorePonderado / totalPeso) * 100;
  if (kpis.cierres >= metas.cierres && metas.cierres > 0) {
    score = Math.min(score + 5, 100);
  }
  return Math.min(Math.round(score), 100);
}

function scoreColor(score: number): string {
  if (score < 40) return "#990000";
  if (score < 70) return "#f5a623";
  return "#27ae60";
}

function barColor(pct: number): string {
  if (pct < 0.5) return "#990000";
  if (pct < 0.8) return "#f5a623";
  return "#27ae60";
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function shortWeek(semana: string): string {
  // "2024-W12" → "S12"
  const parts = semana.split("-W");
  return `S${parts[1]}`;
}

function emptyKPIs(): KPIs {
  return { llamadas: 0, visitas: 0, tasaciones: 0, captaciones: 0, cierres: 0, nuevosContactos: 0, whatsapps: 0, publicaciones: 0 };
}

// ── Componente SVG Score Circle ───────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const r = 70;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <svg viewBox="0 0 200 200" width={180} height={180} style={{ display: "block", margin: "0 auto" }}>
      {/* track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2a2a" strokeWidth={12} />
      {/* progress */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      {/* score number */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={36}
        fontFamily="Montserrat, sans-serif"
        fontWeight={800}
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        fill="rgba(255,255,255,0.5)"
        fontSize={11}
        fontFamily="Inter, sans-serif"
      >
        / 100
      </text>
    </svg>
  );
}

// ── Componente SVG Histórico Chart ────────────────────────────────────────────

function HistoricoChart({ semanas }: { semanas: SemanaScore[] }) {
  const W = 860;
  const H = 220;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const n = semanas.length;
  if (n === 0) return <div style={{ color: "rgba(255,255,255,0.4)", padding: 40, textAlign: "center" }}>Sin datos históricos</div>;

  const xOf = (i: number) => padL + (i / (n - 1 || 1)) * chartW;
  const yOf = (score: number) => padT + chartH - (score / 100) * chartH;

  // area path
  const points = semanas.map((s, i) => `${xOf(i)},${yOf(s.score)}`).join(" L ");
  const areaPath = `M ${xOf(0)},${yOf(semanas[0].score)} L ${points} L ${xOf(n - 1)},${padT + chartH} L ${xOf(0)},${padT + chartH} Z`;
  const linePath = `M ${semanas.map((s, i) => `${xOf(i)},${yOf(s.score)}`).join(" L ")}`;

  // target line y=70
  const targetY = yOf(70);

  // y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {/* y-axis grid */}
      {yLabels.map((v) => (
        <g key={v}>
          <line x1={padL} y1={yOf(v)} x2={padL + chartW} y2={yOf(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={padL - 6} y={yOf(v)} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.35)" fontSize={10} fontFamily="Inter, sans-serif">
            {v}
          </text>
        </g>
      ))}
      {/* target dashed line */}
      <line x1={padL} y1={targetY} x2={padL + chartW} y2={targetY} stroke="#f5a623" strokeWidth={1} strokeDasharray="4 4" />
      <text x={padL + chartW + 4} y={targetY} dominantBaseline="middle" fill="#f5a623" fontSize={10} fontFamily="Inter, sans-serif">70</text>
      {/* area */}
      <path d={areaPath} fill="rgba(153,0,0,0.15)" />
      {/* line */}
      <path d={linePath} fill="none" stroke="#990000" strokeWidth={2.5} strokeLinejoin="round" />
      {/* dots + x labels */}
      {semanas.map((s, i) => (
        <g key={s.semana}>
          <circle cx={xOf(i)} cy={yOf(s.score)} r={4} fill={scoreColor(s.score)} stroke="#0a0a0a" strokeWidth={2} />
          <text
            x={xOf(i)}
            y={padT + chartH + 16}
            textAnchor="middle"
            fill="rgba(255,255,255,0.45)"
            fontSize={9}
            fontFamily="Inter, sans-serif"
          >
            {shortWeek(s.semana)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────

export default function ScorecardSemanal() {
  const semanas12 = build12Weeks();
  const semanaActual = semanas12[semanas12.length - 1].semana;

  const [uid, setUid] = useState<string | null>(null);
  const [tab, setTab] = useState<"scorecard" | "historico" | "metas">("scorecard");
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<string>(semanaActual);
  const [historial, setHistorial] = useState<SemanaScore[]>([]);
  const [metas, setMetas] = useState<KPIs>(METAS_DEFAULT);
  const [metasEdit, setMetasEdit] = useState<KPIs>(METAS_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [metasSaved, setMetasSaved] = useState(false);

  // ── Cargar datos de Supabase ──────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_scorecard_semanal")
        .select("semanas, metas")
        .eq("perfil_id", userId)
        .maybeSingle();
      if (row) {
        if (row.semanas && typeof row.semanas === 'object') setHistorial(row.semanas as SemanaScore[]);
        if (row.metas && typeof row.metas === 'object') {
          setMetas(row.metas as KPIs);
          setMetasEdit(row.metas as KPIs);
        }
      }
    });
  }, []);

  // ── Semana seleccionada ───────────────────────────────────────────────────

  const semanaInfo = semanas12.find((s) => s.semana === semanaSeleccionada) ?? semanas12[semanas12.length - 1];

  const semanaData: SemanaScore = historial.find((s) => s.semana === semanaSeleccionada) ?? {
    semana: semanaInfo.semana,
    fechaInicio: semanaInfo.fechaInicio,
    fechaFin: semanaInfo.fechaFin,
    kpis: emptyKPIs(),
    metas,
    negociosCerrados: 0,
    honorariosGenerados: 0,
    contactosNuevos: 0,
    score: 0,
    comentario: "",
  };

  // ── Guardar en Supabase ───────────────────────────────────────────────────

  const guardarSB = useCallback((newSemanas: SemanaScore[], newMetas: KPIs) => {
    if (!uid) return;
    supabase.from("crm_scorecard_semanal").upsert(
      { perfil_id: uid, semanas: newSemanas, metas: newMetas, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id" }
    ).then(() => {});
  }, [uid]);

  // ── Fetch Supabase ────────────────────────────────────────────────────────

  const fetchSupabase = useCallback(async (inicio: string, fin: string) => {
    setLoading(true);
    try {
      const [negResult, conResult] = await Promise.all([
        supabase
          .from("crm_negocios")
          .select("id, honorarios_pct, valor_operacion, etapa, updated_at")
          .eq("etapa", "cerrado")
          .gte("updated_at", inicio)
          .lte("updated_at", fin + "T23:59:59"),
        supabase
          .from("crm_contactos")
          .select("id")
          .gte("created_at", inicio)
          .lte("created_at", fin + "T23:59:59"),
      ]);

      const negocios = negResult.data ?? [];
      const contactos = conResult.data ?? [];

      const negociosCerrados = negocios.length;
      const honorariosGenerados = negocios.reduce((acc, neg) => {
        const honorarios_pct = typeof neg.honorarios_pct === "number" ? neg.honorarios_pct : 0;
        const valor_operacion = typeof neg.valor_operacion === "number" ? neg.valor_operacion : 0;
        return acc + valor_operacion * (honorarios_pct / 100);
      }, 0);
      const contactosNuevos = contactos.length;

      setHistorial((prev) => {
        const updated = prev.map((s) =>
          s.semana === semanaSeleccionada
            ? { ...s, negociosCerrados, honorariosGenerados, contactosNuevos }
            : s
        );
        if (!updated.find((s) => s.semana === semanaSeleccionada)) {
          // no change needed, handled separately
          return prev;
        }
        guardarSB(updated, metas);
        return updated;
      });
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, [semanaSeleccionada, guardarSB, metas]);

  useEffect(() => {
    if (semanaInfo) {
      fetchSupabase(semanaInfo.fechaInicio, semanaInfo.fechaFin);
    }
  }, [semanaInfo, fetchSupabase]);

  // ── Actualizar KPI ────────────────────────────────────────────────────────

  function updateKPI(key: KPIKey, value: number) {
    setHistorial((prev) => {
      const newKPIs = { ...semanaData.kpis, [key]: value };
      const newScore = calcularScore(newKPIs, semanaData.metas);
      const updated = prev.find((s) => s.semana === semanaSeleccionada)
        ? prev.map((s) =>
            s.semana === semanaSeleccionada
              ? { ...s, kpis: newKPIs, score: newScore }
              : s
          )
        : [
            ...prev,
            {
              ...semanaData,
              kpis: newKPIs,
              score: newScore,
            },
          ];
      return updated;
    });
  }

  function updateComentario(comentario: string) {
    setHistorial((prev) => {
      const updated = prev.find((s) => s.semana === semanaSeleccionada)
        ? prev.map((s) =>
            s.semana === semanaSeleccionada ? { ...s, comentario } : s
          )
        : [...prev, { ...semanaData, comentario }];
      return updated;
    });
  }

  function guardarSemana() {
    setGuardando(true);
    const newScore = calcularScore(semanaData.kpis, semanaData.metas);
    const entry: SemanaScore = { ...semanaData, score: newScore };

    setHistorial((prev) => {
      const updated = prev.find((s) => s.semana === semanaSeleccionada)
        ? prev.map((s) => (s.semana === semanaSeleccionada ? entry : s))
        : [...prev, entry];
      guardarSB(updated, metas);
      return updated;
    });

    setTimeout(() => setGuardando(false), 800);
  }

  function guardarMetas() {
    setMetas(metasEdit);
    guardarSB(historial, metasEdit);
    setMetasSaved(true);
    setTimeout(() => setMetasSaved(false), 1500);
  }

  // ── Score computed ────────────────────────────────────────────────────────

  const scoreActual = calcularScore(semanaData.kpis, semanaData.metas);

  // ── Histórico ordenado para chart ─────────────────────────────────────────

  const historicoPorSemana: SemanaScore[] = semanas12.map((sw) => {
    const found = historial.find((s) => s.semana === sw.semana);
    return found ?? {
      semana: sw.semana,
      fechaInicio: sw.fechaInicio,
      fechaFin: sw.fechaFin,
      kpis: emptyKPIs(),
      metas,
      negociosCerrados: 0,
      honorariosGenerados: 0,
      contactosNuevos: 0,
      score: 0,
      comentario: "",
    };
  });

  // ── Estilos ───────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    background: "#0a0a0a",
    minHeight: "100vh",
    padding: "32px 24px",
    fontFamily: "Inter, sans-serif",
    color: "#fff",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 12,
  };

  const tabsStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    marginBottom: 32,
    flexWrap: "wrap",
  };

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: "8px 20px",
      borderRadius: 20,
      border: "none",
      cursor: "pointer",
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 700,
      fontSize: 13,
      background: active ? "#990000" : "#1a1a1a",
      color: active ? "#fff" : "rgba(255,255,255,0.6)",
      transition: "background 0.2s",
    };
  }

  const cardStyle: React.CSSProperties = {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 16,
    marginTop: 0,
  };

  const selectStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    color: "#fff",
    padding: "6px 12px",
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    color: "#fff",
    padding: "8px 12px",
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };

  const btnPrimaryStyle: React.CSSProperties = {
    background: "#990000",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
    display: "block",
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#fff", margin: 0 }}>
          Scorecard Semanal
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Semana:</label>
          <select
            style={selectStyle}
            value={semanaSeleccionada}
            onChange={(e) => setSemanaSeleccionada(e.target.value)}
          >
            {[...semanas12].reverse().map((s) => (
              <option key={s.semana} value={s.semana}>
                {s.semana} ({s.fechaInicio} → {s.fechaFin})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabsStyle}>
        <button style={tabStyle(tab === "scorecard")} onClick={() => setTab("scorecard")}>
          Esta semana
        </button>
        <button style={tabStyle(tab === "historico")} onClick={() => setTab("historico")}>
          Histórico
        </button>
        <button style={tabStyle(tab === "metas")} onClick={() => setTab("metas")}>
          Metas semanales
        </button>
      </div>

      {/* ── Tab: Scorecard ─────────────────────────────────────────────────── */}
      {tab === "scorecard" && (
        <div>
          {/* Score Circle */}
          <div style={{ ...cardStyle, textAlign: "center", paddingTop: 32, paddingBottom: 32 }}>
            <ScoreCircle score={scoreActual} />
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 12, marginBottom: 0 }}>
              Rendimiento semanal
            </p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: scoreColor(scoreActual), marginTop: 4, marginBottom: 0 }}>
              {scoreActual < 40 ? "Bajo rendimiento" : scoreActual < 70 ? "Rendimiento moderado" : "Buen rendimiento"}
            </p>
          </div>

          {/* KPIs Grid */}
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Actividad semanal</p>
            {loading && (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                Cargando datos de Supabase...
              </p>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {KPI_LABELS.map(({ key, label }) => {
                const real = semanaData.kpis[key];
                const meta = semanaData.metas[key];
                const pct = meta > 0 ? Math.min(real / meta, 1) : 0;
                const color = barColor(pct);
                return (
                  <div
                    key={key}
                    style={{
                      background: "#1a1a1a",
                      borderRadius: 10,
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                        {label}
                      </span>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#fff" }}>
                        {real}
                        <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}> / {meta}</span>
                      </span>
                    </div>
                    {/* Barra de progreso */}
                    <div style={{ background: "#2a2a2a", borderRadius: 4, height: 6, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.round(pct * 100)}%`,
                          height: "100%",
                          background: color,
                          borderRadius: 4,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    {/* Input numérico */}
                    <input
                      type="number"
                      min={0}
                      value={real}
                      onChange={(e) => updateKPI(key, Math.max(0, Number(e.target.value)))}
                      style={{
                        ...inputStyle,
                        marginTop: 10,
                        padding: "6px 10px",
                        fontSize: 13,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPIs Supabase */}
          <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
            <div>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Negocios cerrados
              </span>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#990000", margin: "4px 0 0" }}>
                {semanaData.negociosCerrados}
              </p>
            </div>
            <div style={{ width: 1, background: "#333", alignSelf: "stretch" }} />
            <div>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Honorarios generados
              </span>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: "#27ae60", margin: "4px 0 0" }}>
                {formatARS(semanaData.honorariosGenerados)}
              </p>
            </div>
            <div style={{ width: 1, background: "#333", alignSelf: "stretch" }} />
            <div>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Contactos nuevos
              </span>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#f5a623", margin: "4px 0 0" }}>
                {semanaData.contactosNuevos}
              </p>
            </div>
          </div>

          {/* Comentario */}
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Notas del corredor</p>
            <textarea
              value={semanaData.comentario}
              onChange={(e) => updateComentario(e.target.value)}
              placeholder="Escribí tus observaciones de la semana..."
              rows={4}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "Inter, sans-serif",
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* Guardar */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button style={btnPrimaryStyle} onClick={guardarSemana} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar semana"}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Histórico ─────────────────────────────────────────────────── */}
      {tab === "historico" && (
        <div>
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Evolución del score — últimas 12 semanas</p>
            <HistoricoChart semanas={historicoPorSemana} />
          </div>

          {/* Tabla resumen */}
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Resumen histórico</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Semana", "Score", "Cierres", "Honorarios"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          color: "rgba(255,255,255,0.5)",
                          fontWeight: 600,
                          borderBottom: "1px solid #222",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...historicoPorSemana].reverse().map((s) => (
                    <tr key={s.semana} style={{ borderBottom: "1px solid #1a1a1a" }}>
                      <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.8)" }}>
                        <button
                          onClick={() => {
                            setSemanaSeleccionada(s.semana);
                            setTab("scorecard");
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#990000",
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                            fontSize: 13,
                            textDecoration: "underline",
                            padding: 0,
                          }}
                        >
                          {s.semana}
                        </button>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 14,
                            color: scoreColor(s.score),
                          }}
                        >
                          {s.score}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.8)" }}>
                        {s.negociosCerrados}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#27ae60" }}>
                        {s.honorariosGenerados > 0 ? formatARS(s.honorariosGenerados) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Metas ─────────────────────────────────────────────────────── */}
      {tab === "metas" && (
        <div>
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Metas semanales</p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: -8, marginBottom: 20 }}>
              Estas metas se aplican a todas las semanas nuevas.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 20,
              }}
            >
              {KPI_LABELS.map(({ key, label }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type="number"
                    min={0}
                    value={metasEdit[key]}
                    onChange={(e) =>
                      setMetasEdit((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))
                    }
                    style={inputStyle}
                  />
                  {PESOS[key] > 0 && (
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", display: "block", marginTop: 4 }}>
                      Peso en score: {PESOS[key]}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 16 }}>
              <button style={btnPrimaryStyle} onClick={guardarMetas}>
                Guardar metas
              </button>
              {metasSaved && (
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#27ae60" }}>
                  Metas guardadas correctamente
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
