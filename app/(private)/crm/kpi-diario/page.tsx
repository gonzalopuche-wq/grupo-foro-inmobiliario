"use client";

import { useState, useMemo, useEffect, useRef } from "react";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface DiaKPI {
  fecha: string;
  llamadas: number;
  whatsapps: number;
  emails: number;
  visitas: number;
  tasaciones: number;
  nuevosContactos: number;
  publicaciones: number;
  reuniones: number;
  captaciones: number;
  cierres: number;
  notas: string;
}

interface MetaDiaria {
  llamadas: number;
  whatsapps: number;
  emails: number;
  visitas: number;
  tasaciones: number;
  nuevosContactos: number;
  publicaciones: number;
  reuniones: number;
  captaciones: number;
  cierres: number;
}

type KPIKey = keyof Omit<DiaKPI, "fecha" | "notas">;

// ── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "crm_kpi_diario_v1";
const META_KEY = "crm_kpi_meta_v1";

const META_DEFAULT: MetaDiaria = {
  llamadas: 20,
  whatsapps: 15,
  emails: 10,
  visitas: 3,
  tasaciones: 2,
  nuevosContactos: 5,
  publicaciones: 3,
  reuniones: 2,
  captaciones: 1,
  cierres: 0.2,
};

const KPI_FIELDS: { key: KPIKey; label: string; icon: string }[] = [
  { key: "llamadas", label: "Llamadas", icon: "📞" },
  { key: "whatsapps", label: "WhatsApps", icon: "💬" },
  { key: "emails", label: "Emails", icon: "✉️" },
  { key: "visitas", label: "Visitas", icon: "🏠" },
  { key: "tasaciones", label: "Tasaciones", icon: "📊" },
  { key: "nuevosContactos", label: "Nuevos Contactos", icon: "👤" },
  { key: "publicaciones", label: "Publicaciones", icon: "📢" },
  { key: "reuniones", label: "Reuniones", icon: "🤝" },
  { key: "captaciones", label: "Captaciones", icon: "🎯" },
  { key: "cierres", label: "Cierres", icon: "🔑" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(fecha: string, n: number): string {
  const d = new Date(fecha + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatFechaLarga(fecha: string): string {
  const d = new Date(fecha + "T12:00:00");
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatFechaCorta(fecha: string): string {
  const d = new Date(fecha + "T12:00:00");
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `${dias[d.getDay()]} ${d.getDate()}`;
}

function semaforo(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function totalActividades(dia: DiaKPI): number {
  return (
    dia.llamadas + dia.whatsapps + dia.emails + dia.visitas +
    dia.tasaciones + dia.nuevosContactos + dia.publicaciones +
    dia.reuniones + dia.captaciones + dia.cierres
  );
}

function diasHabilesDelMes(anio: number, mes: number): number {
  const primer = new Date(anio, mes, 1);
  const ultimo = new Date(anio, mes + 1, 0);
  let habiles = 0;
  for (let d = new Date(primer); d <= ultimo; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) habiles++;
  }
  return habiles;
}

function rachaConsecutiva(dias: DiaKPI[], hoy: string): number {
  const fechas = new Set(dias.map((d) => d.fecha));
  let racha = 0;
  let cursor = hoy;
  while (fechas.has(cursor)) {
    racha++;
    cursor = addDays(cursor, -1);
  }
  return racha;
}

function getLunesDeSeamana(fecha: string): string {
  const d = new Date(fecha + "T12:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function diaVacio(fecha: string): DiaKPI {
  return {
    fecha,
    llamadas: 0,
    whatsapps: 0,
    emails: 0,
    visitas: 0,
    tasaciones: 0,
    nuevosContactos: 0,
    publicaciones: 0,
    reuniones: 0,
    captaciones: 0,
    cierres: 0,
    notas: "",
  };
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Counter({
  campo,
  valor,
  meta,
  onChange,
}: {
  campo: { key: KPIKey; label: string; icon: string };
  valor: number;
  meta: number;
  onChange: (key: KPIKey, val: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pct = meta > 0 ? Math.min((valor / meta) * 100, 100) : 0;
  const color = semaforo(pct);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") inputRef.current?.blur();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v >= 0) onChange(campo.key, v);
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{campo.icon}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif" }}>
            {campo.label}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter, sans-serif" }}>
          meta: {meta}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onChange(campo.key, Math.max(0, valor - 1))}
          style={{
            width: 32, height: 32,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            color: "white",
            fontSize: 18,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Inter, sans-serif",
            lineHeight: 1,
          }}
        >
          −
        </button>
        <input
          ref={inputRef}
          type="number"
          value={valor}
          min={0}
          step={campo.key === "cierres" ? 0.1 : 1}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          style={{
            width: 60,
            textAlign: "center",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            color: "white",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "Montserrat, sans-serif",
            padding: "4px 0",
            outline: "none",
          }}
        />
        <button
          onClick={() => onChange(campo.key, valor + 1)}
          style={{
            width: 32, height: 32,
            background: "#cc0000",
            border: "none",
            borderRadius: 6,
            color: "white",
            fontSize: 18,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Inter, sans-serif",
            lineHeight: 1,
          }}
        >
          +
        </button>

        <div style={{ flex: 1, marginLeft: 4 }}>
          <div style={{ fontSize: 11, color: color, fontFamily: "Inter, sans-serif", marginBottom: 3 }}>
            {pct.toFixed(0)}%
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: color,
                borderRadius: 2,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Radar / Spider chart ──────────────────────────────────────────────────────

const RADAR_CAMPOS: KPIKey[] = ["llamadas", "visitas", "tasaciones", "nuevosContactos", "captaciones", "cierres"];
const RADAR_LABELS: string[] = ["Llamadas", "Visitas", "Tasaciones", "Contactos", "Captaciones", "Cierres"];

function polarPoint(cx: number, cy: number, r: number, index: number, total: number): [number, number] {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function RadarChart({ dias, meta }: { dias: DiaKPI[]; meta: MetaDiaria }) {
  const cx = 200, cy = 200, maxR = 140;
  const N = RADAR_CAMPOS.length;

  const totalesSemana = useMemo(() => {
    const result: Partial<Record<KPIKey, number>> = {};
    for (const k of RADAR_CAMPOS) {
      result[k] = dias.reduce((acc, d) => acc + d[k], 0);
    }
    return result as Record<KPIKey, number>;
  }, [dias]);

  const metaSemana = useMemo(() => {
    const result: Partial<Record<KPIKey, number>> = {};
    for (const k of RADAR_CAMPOS) {
      result[k] = (meta[k] as number) * 5;
    }
    return result as Record<KPIKey, number>;
  }, [meta]);

  function points(values: Record<KPIKey, number>, maxValues: Record<KPIKey, number>): string {
    return RADAR_CAMPOS.map((k, i) => {
      const ratio = maxValues[k] > 0 ? Math.min(values[k] / maxValues[k], 1) : 0;
      const [x, y] = polarPoint(cx, cy, maxR * ratio, i, N);
      return `${x},${y}`;
    }).join(" ");
  }

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox="0 0 400 400" style={{ width: "100%", maxWidth: 380, display: "block" }}>
      {/* Grid */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={RADAR_CAMPOS.map((_, i) => {
            const [x, y] = polarPoint(cx, cy, maxR * level, i, N);
            return `${x},${y}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {/* Axes */}
      {RADAR_CAMPOS.map((_, i) => {
        const [x, y] = polarPoint(cx, cy, maxR, i, N);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />;
      })}
      {/* Meta polygon */}
      <polygon
        points={points(metaSemana, metaSemana)}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1.5}
      />
      {/* Actual polygon */}
      <polygon
        points={points(totalesSemana, metaSemana)}
        fill="rgba(204,0,0,0.25)"
        stroke="#cc0000"
        strokeWidth={2}
      />
      {/* Labels */}
      {RADAR_LABELS.map((label, i) => {
        const [x, y] = polarPoint(cx, cy, maxR + 22, i, N);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.65)"
            fontSize={11}
            fontFamily="Inter, sans-serif"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ dias, campo }: { dias: DiaKPI[]; campo: KPIKey }) {
  const [hover, setHover] = useState<number | null>(null);
  const last30 = useMemo(() => {
    const sorted = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return sorted.slice(-30);
  }, [dias]);

  if (!last30.length) {
    return (
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40, fontFamily: "Inter, sans-serif" }}>
        Sin datos históricos aún
      </div>
    );
  }

  const maxVal = Math.max(...last30.map((d) => d[campo] as number), 1);
  const W = 900, H = 200;
  const padL = 30, padR = 10, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = Math.max(4, (chartW / last30.length) * 0.65);
  const step = chartW / last30.length;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 400 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((l) => {
          const y = padT + chartH * (1 - l);
          return (
            <g key={l}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={padL - 4} y={y} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="Inter, sans-serif">
                {(maxVal * l).toFixed(l === 0 ? 0 : maxVal < 2 ? 1 : 0)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {last30.map((dia, i) => {
          const val = dia[campo] as number;
          const barH = Math.max(2, (val / maxVal) * chartH);
          const x = padL + i * step + (step - barW) / 2;
          const y = padT + chartH - barH;
          const isHover = hover === i;
          return (
            <g key={dia.fecha}>
              <rect
                x={x} y={y} width={barW} height={barH}
                fill={isHover ? "#ff2020" : "#cc0000"}
                rx={2}
                style={{ cursor: "pointer", transition: "fill 0.15s" }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {isHover && (
                <g>
                  <rect x={x - 20} y={y - 30} width={56} height={22} fill="rgba(20,20,20,0.95)" rx={4} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                  <text x={x + barW / 2} y={y - 15} textAnchor="middle" fill="white" fontSize={11} fontFamily="Montserrat, sans-serif" fontWeight={700}>{val}</text>
                </g>
              )}
              {/* X label every 7 days */}
              {i % 7 === 0 && (
                <text x={x + barW / 2} y={H - padB + 14} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} fontFamily="Inter, sans-serif">
                  {formatFechaCorta(dia.fecha)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function KPIDiarioPage() {
  const [dias, setDias] = useState<DiaKPI[]>([]);
  const [meta, setMeta] = useState<MetaDiaria>({ ...META_DEFAULT });
  const [metaEdit, setMetaEdit] = useState<MetaDiaria>({ ...META_DEFAULT });
  const [fechaActiva, setFechaActiva] = useState<string>(fechaHoy());
  const [formDia, setFormDia] = useState<DiaKPI>(diaVacio(fechaHoy()));
  const [tab, setTab] = useState<"semana" | "historico" | "mes">("semana");
  const [metaOpen, setMetaOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [kpiGrafico, setKpiGrafico] = useState<KPIKey>("llamadas");

  const hoy = fechaHoy();

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDias(JSON.parse(raw) as DiaKPI[]);
      const rawMeta = localStorage.getItem(META_KEY);
      if (rawMeta) {
        const m = JSON.parse(rawMeta) as MetaDiaria;
        setMeta(m);
        setMetaEdit(m);
      }
    } catch {
      // ignore
    }
  }, []);

  // Sync formDia when fechaActiva changes
  useEffect(() => {
    const existente = dias.find((d) => d.fecha === fechaActiva);
    setFormDia(existente ? { ...existente } : diaVacio(fechaActiva));
  }, [fechaActiva, dias]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function guardarDia() {
    const nuevos = dias.filter((d) => d.fecha !== formDia.fecha);
    const updated = [...nuevos, { ...formDia }].sort((a, b) => a.fecha.localeCompare(b.fecha));
    setDias(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    showToast("Día guardado ✓");
  }

  function guardarMeta() {
    setMeta({ ...metaEdit });
    localStorage.setItem(META_KEY, JSON.stringify(metaEdit));
    setMetaOpen(false);
    showToast("Metas actualizadas ✓");
  }

  function handleCounter(key: KPIKey, val: number) {
    setFormDia((prev) => ({ ...prev, [key]: val }));
  }

  // ── Semana actual ──

  const lunesActual = useMemo(() => getLunesDeSeamana(hoy), [hoy]);
  const diasSemana = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const f = addDays(lunesActual, i);
      return dias.find((d) => d.fecha === f) ?? diaVacio(f);
    });
  }, [lunesActual, dias]);

  // ── Mes actual ──

  const mesActual = useMemo(() => {
    const d = new Date(hoy + "T12:00:00");
    return { anio: d.getFullYear(), mes: d.getMonth() };
  }, [hoy]);

  const diasDelMes = useMemo(() => {
    const prefijo = `${mesActual.anio}-${String(mesActual.mes + 1).padStart(2, "0")}`;
    return dias.filter((d) => d.fecha.startsWith(prefijo));
  }, [dias, mesActual]);

  const diasHabiles = useMemo(
    () => diasHabilesDelMes(mesActual.anio, mesActual.mes),
    [mesActual]
  );

  const racha = useMemo(() => rachaConsecutiva(dias, hoy), [dias, hoy]);

  const top5Mes = useMemo(() => {
    return [...diasDelMes]
      .sort((a, b) => totalActividades(b) - totalActividades(a))
      .slice(0, 5);
  }, [diasDelMes]);

  const pctCumplimientoSemana = useMemo(() => {
    const totalReal = diasSemana.reduce((acc, d) => acc + totalActividades(d), 0);
    const totalMeta = KPI_FIELDS.reduce((acc, f) => acc + (meta[f.key] as number), 0) * 5;
    return totalMeta > 0 ? (totalReal / totalMeta) * 100 : 0;
  }, [diasSemana, meta]);

  // ── Styles ──

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "white",
      fontFamily: "Inter, sans-serif",
      padding: "24px 20px 60px",
    } as React.CSSProperties,
    heading: {
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 800,
      color: "white",
    } as React.CSSProperties,
    card: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: 20,
    } as React.CSSProperties,
    tabBtn: (active: boolean): React.CSSProperties => ({
      padding: "8px 20px",
      borderRadius: 8,
      border: "1px solid",
      borderColor: active ? "#cc0000" : "rgba(255,255,255,0.1)",
      background: active ? "rgba(204,0,0,0.15)" : "transparent",
      color: active ? "white" : "rgba(255,255,255,0.5)",
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
    }),
    navBtn: {
      width: 36, height: 36,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      color: "white",
      fontSize: 16,
      cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    } as React.CSSProperties,
    input: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      color: "white",
      fontSize: 14,
      padding: "8px 12px",
      fontFamily: "Inter, sans-serif",
      outline: "none",
      width: "100%",
    } as React.CSSProperties,
    btn: {
      background: "#cc0000",
      border: "none",
      borderRadius: 8,
      color: "white",
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 700,
      fontSize: 14,
      padding: "10px 24px",
      cursor: "pointer",
    } as React.CSSProperties,
    label: {
      fontSize: 12,
      color: "rgba(255,255,255,0.45)",
      marginBottom: 4,
      display: "block",
    } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed", top: 20, right: 20, zIndex: 9999,
            background: "#22c55e", color: "white",
            padding: "10px 20px", borderRadius: 8,
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            animation: "none",
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            CRM · Tracker Diario
          </span>
        </div>
        <h1 style={{ ...s.heading, fontSize: 28, margin: "0 0 20px" }}>
          KPIs Diarios
        </h1>

        {/* Navegación de fecha */}
        <div style={{ ...s.card, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button style={s.navBtn} onClick={() => setFechaActiva((f) => addDays(f, -1))}>←</button>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white" }}>
                {formatFechaLarga(fechaActiva)}
              </div>
              {fechaActiva === hoy && (
                <span style={{ fontSize: 11, color: "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: 1 }}>
                  HOY
                </span>
              )}
            </div>
            <button style={s.navBtn} onClick={() => setFechaActiva((f) => addDays(f, 1))} disabled={fechaActiva >= hoy}>
              →
            </button>
            {fechaActiva !== hoy && (
              <button
                onClick={() => setFechaActiva(hoy)}
                style={{ ...s.btn, padding: "8px 16px", fontSize: 12 }}
              >
                Hoy
              </button>
            )}
          </div>
        </div>

        {/* Panel de carga del día */}
        {fechaActiva <= hoy && (
          <div style={{ ...s.card, marginBottom: 20 }}>
            <h2 style={{ ...s.heading, fontSize: 16, margin: "0 0 16px" }}>
              Actividades del día
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {KPI_FIELDS.map((campo) => (
                <Counter
                  key={campo.key}
                  campo={campo}
                  valor={formDia[campo.key]}
                  meta={meta[campo.key]}
                  onChange={handleCounter}
                />
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={s.label}>Notas del día</label>
              <textarea
                value={formDia.notas}
                onChange={(e) => setFormDia((p) => ({ ...p, notas: e.target.value }))}
                rows={3}
                placeholder="Observaciones, logros destacados, dificultades..."
                style={{
                  ...s.input,
                  resize: "vertical",
                  minHeight: 72,
                }}
              />
            </div>

            <button style={s.btn} onClick={guardarDia}>
              Guardar día
            </button>
          </div>
        )}

        {/* Panel de metas (colapsable) */}
        <div style={{ ...s.card, marginBottom: 24 }}>
          <button
            onClick={() => setMetaOpen((o) => !o)}
            style={{
              background: "none", border: "none", color: "white",
              fontFamily: "Montserrat, sans-serif", fontWeight: 700,
              fontSize: 15, cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", gap: 8, width: "100%",
            }}
          >
            <span>Metas Diarias</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{metaOpen ? "▲" : "▼"}</span>
          </button>

          {metaOpen && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {KPI_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label style={s.label}>
                      {f.icon} {f.label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={f.key === "cierres" ? 0.1 : 1}
                      value={metaEdit[f.key]}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0)
                          setMetaEdit((m) => ({ ...m, [f.key]: v }));
                      }}
                      style={s.input}
                    />
                  </div>
                ))}
              </div>
              <button style={s.btn} onClick={guardarMeta}>
                Guardar metas
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button style={s.tabBtn(tab === "semana")} onClick={() => setTab("semana")}>
            Semana actual
          </button>
          <button style={s.tabBtn(tab === "historico")} onClick={() => setTab("historico")}>
            Histórico 30 días
          </button>
          <button style={s.tabBtn(tab === "mes")} onClick={() => setTab("mes")}>
            Resumen del mes
          </button>
        </div>

        {/* Tab: Semana actual */}
        {tab === "semana" && (
          <div>
            {/* Grid días semana */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 8,
                marginBottom: 24,
              }}
            >
              {diasSemana.map((dia) => {
                const total = totalActividades(dia);
                const totalMetaDia = KPI_FIELDS.reduce((acc, f) => acc + (meta[f.key] as number), 0);
                const pct = totalMetaDia > 0 ? (total / totalMetaDia) * 100 : 0;
                const color = semaforo(pct);
                const esHoy = dia.fecha === hoy;
                const tieneDatos = dias.some((d) => d.fecha === dia.fecha);
                return (
                  <div
                    key={dia.fecha}
                    onClick={() => setFechaActiva(dia.fecha)}
                    style={{
                      background: esHoy ? "rgba(204,0,0,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${esHoy ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 10,
                      padding: "12px 10px",
                      cursor: "pointer",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
                      {formatFechaCorta(dia.fecha)}
                    </div>
                    {tieneDatos ? (
                      <>
                        <div style={{ fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white", marginBottom: 4 }}>
                          {total}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
                          de {Math.round(totalMetaDia)}
                        </div>
                        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2 }} />
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 4 }} />
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "Inter, sans-serif" }}>
                        Sin datos
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stats de la semana */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 8,
                marginBottom: 24,
              }}
            >
              {KPI_FIELDS.map((f) => {
                const totalSem = diasSemana.reduce((acc, d) => acc + d[f.key], 0);
                const metaSem = (meta[f.key] as number) * 5;
                const pct = metaSem > 0 ? (totalSem / metaSem) * 100 : 0;
                const color = semaforo(pct);
                return (
                  <div key={f.key} style={{ ...s.card, padding: 12 }}>
                    <div style={{ fontSize: 14, marginBottom: 4 }}>{f.icon}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4, fontFamily: "Inter, sans-serif" }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 18, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color }}>
                      {totalSem}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif" }}>
                      / {metaSem.toFixed(f.key === "cierres" ? 1 : 0)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Semáforo general */}
            <div style={{ ...s.card, marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: semaforo(pctCumplimientoSemana),
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: semaforo(pctCumplimientoSemana) }}>
                  {pctCumplimientoSemana.toFixed(0)}%
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>
                  cumplimiento general de la semana
                </div>
              </div>
            </div>

            {/* Radar chart */}
            <div style={s.card}>
              <h3 style={{ ...s.heading, fontSize: 14, margin: "0 0 16px", color: "rgba(255,255,255,0.7)" }}>
                Radar de la semana
              </h3>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <RadarChart dias={diasSemana.filter((d) => dias.some((x) => x.fecha === d.fecha))} meta={meta} />
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 3, background: "#cc0000", borderRadius: 2 }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>Real</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 2 }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>Meta</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Histórico 30 días */}
        {tab === "historico" && (
          <div>
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <h3 style={{ ...s.heading, fontSize: 14, margin: 0, color: "rgba(255,255,255,0.7)" }}>
                  Evolución de KPI
                </h3>
                <select
                  value={kpiGrafico}
                  onChange={(e) => setKpiGrafico(e.target.value as KPIKey)}
                  style={{
                    ...s.input,
                    width: "auto",
                    padding: "6px 12px",
                    fontSize: 13,
                  }}
                >
                  {KPI_FIELDS.map((f) => (
                    <option key={f.key} value={f.key} style={{ background: "#1a1a1a" }}>
                      {f.icon} {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <BarChart dias={dias} campo={kpiGrafico} />
            </div>

            {/* Tabla de los últimos 30 días */}
            <div style={s.card}>
              <h3 style={{ ...s.heading, fontSize: 14, margin: "0 0 14px", color: "rgba(255,255,255,0.7)" }}>
                Detalle últimos 30 días
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Inter, sans-serif" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: "rgba(255,255,255,0.4)", fontWeight: 600, whiteSpace: "nowrap" }}>Fecha</th>
                      {KPI_FIELDS.map((f) => (
                        <th key={f.key} style={{ textAlign: "center", padding: "6px 8px", color: "rgba(255,255,255,0.4)", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {f.icon}
                        </th>
                      ))}
                      <th style={{ textAlign: "center", padding: "6px 8px", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dias]
                      .sort((a, b) => b.fecha.localeCompare(a.fecha))
                      .slice(0, 30)
                      .map((dia) => {
                        const total = totalActividades(dia);
                        return (
                          <tr
                            key={dia.fecha}
                            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                            onClick={() => setFechaActiva(dia.fecha)}
                          >
                            <td style={{ padding: "8px 8px", color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", cursor: "pointer" }}>
                              {formatFechaCorta(dia.fecha)}
                            </td>
                            {KPI_FIELDS.map((f) => (
                              <td key={f.key} style={{ textAlign: "center", padding: "8px 8px", color: dia[f.key] > 0 ? "white" : "rgba(255,255,255,0.2)" }}>
                                {dia[f.key]}
                              </td>
                            ))}
                            <td style={{ textAlign: "center", padding: "8px 8px", fontWeight: 700, color: "#cc0000" }}>
                              {total}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Resumen del mes */}
        {tab === "mes" && (
          <div>
            {/* Cards KPI vs meta mensual */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {KPI_FIELDS.map((f) => {
                const totalMes = diasDelMes.reduce((acc, d) => acc + d[f.key], 0);
                const metaMes = (meta[f.key] as number) * diasHabiles;
                const pct = metaMes > 0 ? (totalMes / metaMes) * 100 : 0;
                const color = semaforo(pct);
                return (
                  <div key={f.key} style={s.card}>
                    <div style={{ fontSize: 18, marginBottom: 6 }}>{f.icon}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
                      {f.label}
                    </div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color }}>
                      {f.key === "cierres" ? totalMes.toFixed(1) : totalMes}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8, fontFamily: "Inter, sans-serif" }}>
                      meta: {f.key === "cierres" ? metaMes.toFixed(1) : Math.round(metaMes)}
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color, marginTop: 4, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Estadísticas generales del mes */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div style={{ ...s.card, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000", marginBottom: 4 }}>
                  {diasDelMes.length}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>
                  días registrados
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                  de {diasHabiles} hábiles
                </div>
              </div>

              <div style={{ ...s.card, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#f59e0b", marginBottom: 4 }}>
                  {racha}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>
                  {racha === 1 ? "día" : "días"} de racha
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                  consecutivos registrando
                </div>
              </div>

              <div style={{ ...s.card, textAlign: "center" }}>
                <div style={{ fontSize: 32, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#22c55e", marginBottom: 4 }}>
                  {diasDelMes.length > 0
                    ? Math.round(diasDelMes.reduce((acc, d) => acc + totalActividades(d), 0) / diasDelMes.length)
                    : 0}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>
                  promedio por día
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                  actividades totales
                </div>
              </div>
            </div>

            {/* Top 5 días del mes */}
            <div style={s.card}>
              <h3 style={{ ...s.heading, fontSize: 14, margin: "0 0 14px", color: "rgba(255,255,255,0.7)" }}>
                Top 5 mejores días del mes
              </h3>
              {top5Mes.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
                  Sin datos este mes
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {top5Mes.map((dia, i) => {
                    const total = totalActividades(dia);
                    const maxTotal = totalActividades(top5Mes[0]);
                    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                    const medals = ["🥇", "🥈", "🥉", "4°", "5°"];
                    return (
                      <div
                        key={dia.fecha}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.03)",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                        onClick={() => setFechaActiva(dia.fecha)}
                      >
                        <span style={{ fontSize: 16, minWidth: 24 }}>{medals[i]}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", marginBottom: 4 }}>
                            {formatFechaLarga(dia.fecha)}
                          </div>
                          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "#cc0000", borderRadius: 2 }} />
                          </div>
                        </div>
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 18, color: "#cc0000", minWidth: 36, textAlign: "right" }}>
                          {total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
