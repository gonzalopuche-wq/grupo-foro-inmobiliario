"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoTasacion = "programada" | "realizada" | "cancelada" | "sin_respuesta";
type TipoPropiedad = "departamento" | "casa" | "ph" | "oficina" | "local" | "terreno" | "otro";

interface Tasacion {
  id: string;
  contacto_id: string | null;
  contacto_nombre: string;
  contacto_telefono: string | null;
  direccion: string;
  barrio: string;
  tipo_propiedad: TipoPropiedad;
  ambientes: number | null;
  superficie_cubierta: number | null;
  fecha_programada: string;
  hora_programada: string;
  estado: EstadoTasacion;
  valor_estimado: number | null;
  notas: string;
  corredor_id: string | null;
  corredor_nombre: string;
  created_at: string;
}

interface FormData {
  contacto_nombre: string;
  contacto_telefono: string;
  direccion: string;
  barrio: string;
  tipo_propiedad: TipoPropiedad;
  ambientes: string;
  superficie_cubierta: string;
  fecha_programada: string;
  hora_programada: string;
  corredor_nombre: string;
  valor_estimado: string;
  notas: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoTasacion, { label: string; bg: string; color: string }> = {
  programada:    { label: "Programada",    bg: "rgba(99,102,241,0.15)",  color: "#818cf8" },
  realizada:     { label: "Realizada",     bg: "rgba(34,197,94,0.15)",   color: "#4ade80" },
  cancelada:     { label: "Cancelada",     bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
  sin_respuesta: { label: "Sin respuesta", bg: "rgba(245,158,11,0.15)",  color: "#d4960c" },
};

const TIPOS_PROPIEDAD: TipoPropiedad[] = [
  "departamento", "casa", "ph", "oficina", "local", "terreno", "otro",
];

const TIPO_LABEL: Record<TipoPropiedad, string> = {
  departamento: "Departamento",
  casa: "Casa",
  ph: "PH",
  oficina: "Oficina",
  local: "Local",
  terreno: "Terreno",
  otro: "Otro",
};

const DIAS_SEMANA_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const FORM_INICIAL: FormData = {
  contacto_nombre: "",
  contacto_telefono: "",
  direccion: "",
  barrio: "",
  tipo_propiedad: "departamento",
  ambientes: "",
  superficie_cubierta: "",
  fecha_programada: "",
  hora_programada: "",
  corredor_nombre: "",
  valor_estimado: "",
  notas: "",
};

// ── Utilidades de fecha ───────────────────────────────────────────────────────

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getLunesDeSemana(base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekDays(lunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeekForDate(d: Date): Date {
  return getLunesDeSemana(d);
}

function endOfWeekForDate(d: Date): Date {
  const lunes = getLunesDeSemana(d);
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);
  return domingo;
}

function fmtFechaCorta(iso: string): string {
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
}

function fmtValor(v: number): string {
  return `USD ${v.toLocaleString("es-AR")}`;
}

// ── Chip de estado ────────────────────────────────────────────────────────────

function EstadoChip({ estado }: { estado: EstadoTasacion }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      padding: "2px 8px",
      borderRadius: 10,
      fontSize: 10,
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

// ── Gráfico SVG barras ────────────────────────────────────────────────────────

interface SemanaData {
  label: string;
  programadas: number;
  realizadas: number;
}

function GraficoBarras({ data }: { data: SemanaData[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.programadas, d.realizadas]), 1);
  const W = 560;
  const H = 140;
  const padL = 30;
  const padB = 30;
  const padT = 10;
  const barW = 14;
  const gap = 4;
  const groupW = barW * 2 + gap + 16;
  const chartW = W - padL;
  const chartH = H - padB - padT;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      {/* Ejes */}
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--gfi-border)" strokeWidth={1} />
      <line x1={padL} y1={H - padB} x2={W} y2={H - padB} stroke="var(--gfi-border)" strokeWidth={1} />

      {/* Líneas guía */}
      {[0.25, 0.5, 0.75, 1].map(f => {
        const y = padT + chartH * (1 - f);
        const val = Math.round(maxVal * f);
        return (
          <g key={f}>
            <line x1={padL} y1={y} x2={W} y2={y} stroke="var(--gfi-border-subtle)" strokeWidth={1} strokeDasharray="4,4" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fill="var(--gfi-text-dim)" fontSize={9} fontFamily="Inter,sans-serif">{val}</text>
          </g>
        );
      })}

      {/* Barras */}
      {data.map((d, i) => {
        const x = padL + i * groupW + 8;
        const hP = maxVal > 0 ? (d.programadas / maxVal) * chartH : 0;
        const hR = maxVal > 0 ? (d.realizadas / maxVal) * chartH : 0;
        const labelX = x + barW + gap / 2;

        return (
          <g key={i}>
            {/* Barra programadas */}
            <rect
              x={x}
              y={padT + chartH - hP}
              width={barW}
              height={hP}
              fill="rgba(99,102,241,0.6)"
              rx={2}
            />
            {/* Barra realizadas */}
            <rect
              x={x + barW + gap}
              y={padT + chartH - hR}
              width={barW}
              height={hR}
              fill="rgba(34,197,94,0.6)"
              rx={2}
            />
            {/* Label semana */}
            <text
              x={labelX}
              y={H - padB + 14}
              textAnchor="middle"
              fill="var(--gfi-text-muted)"
              fontSize={8}
              fontFamily="Montserrat,sans-serif"
            >
              {d.label}
            </text>
          </g>
        );
      })}

      {/* Leyenda */}
      <rect x={W - 130} y={padT} width={10} height={10} fill="rgba(99,102,241,0.6)" rx={2} />
      <text x={W - 116} y={padT + 9} fill="var(--gfi-text-muted)" fontSize={9} fontFamily="Inter,sans-serif">Programadas</text>
      <rect x={W - 130} y={padT + 16} width={10} height={10} fill="rgba(34,197,94,0.6)" rx={2} />
      <text x={W - 116} y={padT + 25} fill="var(--gfi-text-muted)" fontSize={9} fontFamily="Inter,sans-serif">Realizadas</text>
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AgendaTasacionesPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [tasaciones, setTasaciones] = useState<Tasacion[]>([]);
  const [vistaActiva, setVistaActiva] = useState<"calendario" | "lista" | "kpis">("calendario");
  const [filtroEstado, setFiltroEstado] = useState<EstadoTasacion | "todas">("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"semana" | "proxima" | "mes" | "todas">("semana");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<FormData>(FORM_INICIAL);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [semanaBase, setSemanaBase] = useState<Date>(() => getLunesDeSemana(new Date()));
  const [cardExpandida, setCardExpandida] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const hoy = toLocalStr(new Date());

  // ── Cargar desde Supabase ──
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_agenda_tasaciones")
        .select("tasaciones")
        .eq("perfil_id", userId)
        .maybeSingle();
      if (row?.tasaciones && Array.isArray(row.tasaciones)) {
        setTasaciones(row.tasaciones as Tasacion[]);
      }
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Formulario ──
  const abrirNuevo = useCallback(() => {
    setForm(FORM_INICIAL);
    setEditandoId(null);
    setMostrarForm(true);
  }, []);

  const abrirEditar = useCallback((t: Tasacion) => {
    setForm({
      contacto_nombre: t.contacto_nombre,
      contacto_telefono: t.contacto_telefono ?? "",
      direccion: t.direccion,
      barrio: t.barrio,
      tipo_propiedad: t.tipo_propiedad,
      ambientes: t.ambientes != null ? String(t.ambientes) : "",
      superficie_cubierta: t.superficie_cubierta != null ? String(t.superficie_cubierta) : "",
      fecha_programada: t.fecha_programada,
      hora_programada: t.hora_programada,
      corredor_nombre: t.corredor_nombre,
      valor_estimado: t.valor_estimado != null ? String(t.valor_estimado) : "",
      notas: t.notas,
    });
    setEditandoId(t.id);
    setMostrarForm(true);
  }, []);

  const persistirTasaciones = useCallback((lista: Tasacion[]) => {
    setTasaciones(lista);
    if (uid) {
      supabase.from("crm_agenda_tasaciones").upsert(
        { perfil_id: uid, tasaciones: lista, updated_at: new Date().toISOString() },
        { onConflict: "perfil_id" }
      ).then(() => {});
    }
  }, [uid]);

  const guardarForm = useCallback(() => {
    if (!form.contacto_nombre.trim() || !form.direccion.trim()) {
      showToast("Completá nombre y dirección");
      return;
    }

    const nueva: Tasacion = {
      id: editandoId ?? crypto.randomUUID(),
      contacto_id: null,
      contacto_nombre: form.contacto_nombre.trim(),
      contacto_telefono: form.contacto_telefono.trim() || null,
      direccion: form.direccion.trim(),
      barrio: form.barrio.trim(),
      tipo_propiedad: form.tipo_propiedad,
      ambientes: form.ambientes ? Number(form.ambientes) : null,
      superficie_cubierta: form.superficie_cubierta ? Number(form.superficie_cubierta) : null,
      fecha_programada: form.fecha_programada,
      hora_programada: form.hora_programada,
      estado: editandoId
        ? (tasaciones.find(t => t.id === editandoId)?.estado ?? "programada")
        : "programada",
      valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      notas: form.notas.trim(),
      corredor_id: null,
      corredor_nombre: form.corredor_nombre.trim(),
      created_at: editandoId
        ? (tasaciones.find(t => t.id === editandoId)?.created_at ?? new Date().toISOString())
        : new Date().toISOString(),
    };

    const nuevaLista = editandoId
      ? tasaciones.map(t => t.id === editandoId ? nueva : t)
      : [...tasaciones, nueva];

    persistirTasaciones(nuevaLista);
    setMostrarForm(false);
    setEditandoId(null);
    setForm(FORM_INICIAL);
    showToast(editandoId ? "Tasación actualizada" : "Tasación creada");
  }, [form, editandoId, tasaciones, showToast, persistirTasaciones]);

  const cambiarEstado = useCallback((id: string, estado: EstadoTasacion) => {
    const nuevaLista = tasaciones.map(t => t.id === id ? { ...t, estado } : t);
    persistirTasaciones(nuevaLista);
  }, [tasaciones, persistirTasaciones]);

  const eliminar = useCallback((id: string) => {
    if (!confirm("¿Eliminar esta tasación?")) return;
    const nuevaLista = tasaciones.filter(t => t.id !== id);
    persistirTasaciones(nuevaLista);
    showToast("Tasación eliminada");
  }, [tasaciones, showToast, persistirTasaciones]);

  // ── Filtrado ──
  const tasacionesFiltradas = useMemo(() => {
    let lista = [...tasaciones];

    // Filtro estado
    if (filtroEstado !== "todas") {
      lista = lista.filter(t => t.estado === filtroEstado);
    }

    // Filtro periodo
    if (filtroPeriodo !== "todas") {
      const hoyDate = new Date(hoy + "T00:00:00");
      if (filtroPeriodo === "semana") {
        const desde = toLocalStr(startOfWeekForDate(hoyDate));
        const hasta = toLocalStr(endOfWeekForDate(hoyDate));
        lista = lista.filter(t => t.fecha_programada >= desde && t.fecha_programada <= hasta);
      } else if (filtroPeriodo === "proxima") {
        const lunesProx = addWeeks(getLunesDeSemana(hoyDate), 1);
        const desde = toLocalStr(lunesProx);
        const domProx = new Date(lunesProx);
        domProx.setDate(domProx.getDate() + 6);
        const hasta = toLocalStr(domProx);
        lista = lista.filter(t => t.fecha_programada >= desde && t.fecha_programada <= hasta);
      } else if (filtroPeriodo === "mes") {
        const desde = toLocalStr(startOfMonth(hoyDate));
        const hasta = toLocalStr(endOfMonth(hoyDate));
        lista = lista.filter(t => t.fecha_programada >= desde && t.fecha_programada <= hasta);
      }
    }

    // Búsqueda
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(t =>
        t.contacto_nombre.toLowerCase().includes(q) ||
        t.direccion.toLowerCase().includes(q) ||
        t.barrio.toLowerCase().includes(q)
      );
    }

    return lista.sort((a, b) => {
      const cmp = a.fecha_programada.localeCompare(b.fecha_programada);
      if (cmp !== 0) return cmp;
      return a.hora_programada.localeCompare(b.hora_programada);
    });
  }, [tasaciones, filtroEstado, filtroPeriodo, busqueda, hoy]);

  // ── Días de la semana actual ──
  const diasSemana = useMemo(() => getWeekDays(semanaBase), [semanaBase]);

  const tasacionesPorDia = useMemo(() => {
    const mapa: Record<string, Tasacion[]> = {};
    for (const t of tasaciones) {
      if (!mapa[t.fecha_programada]) mapa[t.fecha_programada] = [];
      mapa[t.fecha_programada].push(t);
    }
    for (const key of Object.keys(mapa)) {
      mapa[key].sort((a, b) => a.hora_programada.localeCompare(b.hora_programada));
    }
    return mapa;
  }, [tasaciones]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const hoyDate = new Date(hoy + "T00:00:00");
    const desdeM = toLocalStr(startOfMonth(hoyDate));
    const hastaM = toLocalStr(endOfMonth(hoyDate));
    const desdeSem = toLocalStr(startOfWeekForDate(hoyDate));
    const hastaSem = toLocalStr(endOfWeekForDate(hoyDate));

    const delMes = tasaciones.filter(t => t.fecha_programada >= desdeM && t.fecha_programada <= hastaM);
    const realizadasMes = delMes.filter(t => t.estado === "realizada");
    const conValor = tasaciones.filter(t => t.valor_estimado != null && t.estado === "realizada");
    const promedioValor = conValor.length > 0
      ? conValor.reduce((s, t) => s + (t.valor_estimado ?? 0), 0) / conValor.length
      : 0;
    const pendientesSem = tasaciones.filter(
      t => t.fecha_programada >= desdeSem && t.fecha_programada <= hastaSem && t.estado === "programada"
    );
    const tasaConversion = delMes.length > 0
      ? Math.round((realizadasMes.length / delMes.length) * 100)
      : 0;

    // Últimas 8 semanas
    const semanas: SemanaData[] = [];
    for (let i = 7; i >= 0; i--) {
      const lunesSem = addWeeks(getLunesDeSemana(hoyDate), -i);
      const desde = toLocalStr(lunesSem);
      const domSem = new Date(lunesSem);
      domSem.setDate(domSem.getDate() + 6);
      const hasta = toLocalStr(domSem);
      const delaSem = tasaciones.filter(t => t.fecha_programada >= desde && t.fecha_programada <= hasta);
      semanas.push({
        label: `S${desde.slice(5, 7)}/${desde.slice(8, 10)}`,
        programadas: delaSem.filter(t => t.estado === "programada" || t.estado === "sin_respuesta").length,
        realizadas: delaSem.filter(t => t.estado === "realizada").length,
      });
    }

    return { totalMes: delMes.length, tasaConversion, promedioValor, pendientesSem: pendientesSem.length, semanas };
  }, [tasaciones, hoy]);

  // ── Estilos comunes ──
  const s = {
    input: {
      width: "100%",
      padding: "8px 10px",
      background: "var(--gfi-border-subtle)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 5,
      color: "#fff",
      fontSize: 13,
      fontFamily: "Inter,sans-serif",
      outline: "none",
      boxSizing: "border-box" as const,
    },
    select: {
      padding: "7px 10px",
      background: "var(--gfi-bg-primary)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 5,
      color: "#fff",
      fontSize: 12,
      fontFamily: "Inter,sans-serif",
      outline: "none",
      cursor: "pointer",
    },
    btn: (active?: boolean) => ({
      padding: "7px 14px",
      border: "1px solid var(--gfi-border)",
      borderRadius: 5,
      fontFamily: "var(--font-display)",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      background: active ? "rgba(153,0,0,0.2)" : "var(--gfi-border-subtle)",
      color: active ? "#990000" : "rgba(255,255,255,0.55)",
      borderColor: active ? "rgba(153,0,0,0.4)" : "var(--gfi-border)",
    }),
    card: {
      background: "var(--gfi-bg-primary)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 10,
      padding: "14px 16px",
    },
    label: {
      display: "block",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "var(--gfi-text-muted)",
      marginBottom: 5,
      fontFamily: "var(--font-display)",
    },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        select option { background: #111; color: #fff; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--gfi-border); border-radius: 4px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "24px 20px" }}>

        {/* ── Header ── */}
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div>
              <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 800,
                margin: 0,
                color: "#fff",
              }}>
                Agenda de <span style={{ color: "#990000" }}>Tasaciones</span>
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--gfi-text-muted)" }}>
                Gestioná tasaciones programadas y realizadas
              </p>
            </div>
          </div>

          {/* ── Barra de controles ── */}
          <div style={{
            display: "flex",
            gap: 8,
            marginTop: 20,
            marginBottom: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            {/* Nueva Tasación */}
            <button
              onClick={mostrarForm && editandoId === null ? () => setMostrarForm(false) : abrirNuevo}
              style={{
                padding: "8px 16px",
                background: "#990000",
                color: "#fff",
                border: "none",
                borderRadius: 5,
                fontFamily: "var(--font-display)",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                letterSpacing: "0.05em",
                flexShrink: 0,
              }}
            >
              + Nueva Tasación
            </button>

            {/* Filtro estado */}
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as EstadoTasacion | "todas")}
              style={s.select}
            >
              <option value="todas">Todas</option>
              <option value="programada">Programadas</option>
              <option value="realizada">Realizadas</option>
              <option value="cancelada">Canceladas</option>
              <option value="sin_respuesta">Sin respuesta</option>
            </select>

            {/* Filtro periodo */}
            <select
              value={filtroPeriodo}
              onChange={e => setFiltroPeriodo(e.target.value as typeof filtroPeriodo)}
              style={s.select}
            >
              <option value="semana">Esta semana</option>
              <option value="proxima">Próxima semana</option>
              <option value="mes">Este mes</option>
              <option value="todas">Todas</option>
            </select>

            {/* Buscador */}
            <input
              type="text"
              placeholder="Buscar por nombre o dirección..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ ...s.input, width: 220, flexShrink: 0 }}
            />

            {/* Tabs de vista */}
            <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
              {(["calendario", "lista", "kpis"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setVistaActiva(v)}
                  style={s.btn(vistaActiva === v)}
                >
                  {v === "calendario" ? "Calendario" : v === "lista" ? "Lista" : "KPIs"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Formulario inline ── */}
          {mostrarForm && (
            <div style={{
              ...s.card,
              marginBottom: 20,
              border: "1px solid rgba(153,0,0,0.25)",
            }}>
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 16,
                color: "#fff",
              }}>
                {editandoId ? "Editar Tasación" : "Nueva Tasación"}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {/* Nombre */}
                <div>
                  <label style={s.label}>Propietario / Contacto *</label>
                  <input
                    style={s.input}
                    placeholder="Nombre completo"
                    value={form.contacto_nombre}
                    onChange={e => setForm(f => ({ ...f, contacto_nombre: e.target.value }))}
                  />
                </div>
                {/* Teléfono */}
                <div>
                  <label style={s.label}>Teléfono</label>
                  <input
                    style={s.input}
                    placeholder="+54 9 11 ..."
                    value={form.contacto_telefono}
                    onChange={e => setForm(f => ({ ...f, contacto_telefono: e.target.value }))}
                  />
                </div>
                {/* Dirección */}
                <div>
                  <label style={s.label}>Dirección *</label>
                  <input
                    style={s.input}
                    placeholder="Calle 123, Piso 4 Dpto B"
                    value={form.direccion}
                    onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                  />
                </div>
                {/* Barrio */}
                <div>
                  <label style={s.label}>Barrio</label>
                  <input
                    style={s.input}
                    placeholder="Palermo, Recoleta..."
                    value={form.barrio}
                    onChange={e => setForm(f => ({ ...f, barrio: e.target.value }))}
                  />
                </div>
                {/* Tipo */}
                <div>
                  <label style={s.label}>Tipo de Propiedad</label>
                  <select
                    style={{ ...s.select, width: "100%" }}
                    value={form.tipo_propiedad}
                    onChange={e => setForm(f => ({ ...f, tipo_propiedad: e.target.value as TipoPropiedad }))}
                  >
                    {TIPOS_PROPIEDAD.map(t => (
                      <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                    ))}
                  </select>
                </div>
                {/* Ambientes */}
                <div>
                  <label style={s.label}>Ambientes</label>
                  <input
                    type="number"
                    min={1}
                    style={s.input}
                    placeholder="3"
                    value={form.ambientes}
                    onChange={e => setForm(f => ({ ...f, ambientes: e.target.value }))}
                  />
                </div>
                {/* Superficie */}
                <div>
                  <label style={s.label}>Superficie cubierta (m²)</label>
                  <input
                    type="number"
                    min={1}
                    style={s.input}
                    placeholder="75"
                    value={form.superficie_cubierta}
                    onChange={e => setForm(f => ({ ...f, superficie_cubierta: e.target.value }))}
                  />
                </div>
                {/* Fecha */}
                <div>
                  <label style={s.label}>Fecha</label>
                  <input
                    type="date"
                    style={s.input}
                    value={form.fecha_programada}
                    onChange={e => setForm(f => ({ ...f, fecha_programada: e.target.value }))}
                  />
                </div>
                {/* Hora */}
                <div>
                  <label style={s.label}>Hora</label>
                  <input
                    type="time"
                    style={s.input}
                    value={form.hora_programada}
                    onChange={e => setForm(f => ({ ...f, hora_programada: e.target.value }))}
                  />
                </div>
                {/* Corredor */}
                <div>
                  <label style={s.label}>Corredor</label>
                  <input
                    style={s.input}
                    placeholder="Nombre del corredor"
                    value={form.corredor_nombre}
                    onChange={e => setForm(f => ({ ...f, corredor_nombre: e.target.value }))}
                  />
                </div>
                {/* Valor estimado */}
                <div>
                  <label style={s.label}>Valor estimado (USD)</label>
                  <input
                    type="number"
                    min={0}
                    style={s.input}
                    placeholder="150000"
                    value={form.valor_estimado}
                    onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notas */}
              <div style={{ marginTop: 12 }}>
                <label style={s.label}>Notas</label>
                <textarea
                  rows={2}
                  style={{ ...s.input, resize: "vertical" }}
                  placeholder="Observaciones, acceso, contacto adicional..."
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button
                  onClick={() => { setMostrarForm(false); setEditandoId(null); setForm(FORM_INICIAL); }}
                  style={{
                    ...s.btn(),
                    padding: "8px 16px",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarForm}
                  style={{
                    padding: "8px 20px",
                    background: "#990000",
                    color: "#fff",
                    border: "none",
                    borderRadius: 5,
                    fontFamily: "var(--font-display)",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {editandoId ? "Actualizar" : "Guardar Tasación"}
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VISTA CALENDARIO
          ══════════════════════════════════════════════════════ */}
          {vistaActiva === "calendario" && (
            <div>
              {/* Nav semana */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <button
                  onClick={() => setSemanaBase(d => addWeeks(d, -1))}
                  style={{ ...s.btn(), padding: "6px 12px", fontSize: 14 }}
                >
                  ←
                </button>
                <button
                  onClick={() => setSemanaBase(getLunesDeSemana(new Date()))}
                  style={s.btn(toLocalStr(semanaBase) === toLocalStr(getLunesDeSemana(new Date())))}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setSemanaBase(d => addWeeks(d, 1))}
                  style={{ ...s.btn(), padding: "6px 12px", fontSize: 14 }}
                >
                  →
                </button>
                <span style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--gfi-text-secondary)",
                  marginLeft: 6,
                }}>
                  {diasSemana[0].getDate()} {MESES[diasSemana[0].getMonth()].slice(0, 3)} — {diasSemana[6].getDate()} {MESES[diasSemana[6].getMonth()].slice(0, 3)} {diasSemana[6].getFullYear()}
                </span>
              </div>

              {/* Grid 7 días */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
              }}>
                {diasSemana.map((dia, idx) => {
                  const diaStr = toLocalStr(dia);
                  const esHoy = diaStr === hoy;
                  const esPasado = diaStr < hoy;
                  const tasDelDia = tasacionesPorDia[diaStr] ?? [];

                  return (
                    <div
                      key={diaStr}
                      style={{
                        background: esHoy ? "rgba(153,0,0,0.05)" : "var(--gfi-bg-primary)",
                        border: `1px solid ${esHoy ? "rgba(153,0,0,0.3)" : "var(--gfi-border-subtle)"}`,
                        borderRadius: 8,
                        padding: "10px 8px",
                        minHeight: 180,
                      }}
                    >
                      {/* Header día */}
                      <div style={{ textAlign: "center", marginBottom: 8 }}>
                        <div style={{
                          fontSize: 9,
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: esHoy ? "#990000" : "var(--gfi-text-muted)",
                          marginBottom: 2,
                        }}>
                          {DIAS_SEMANA_SHORT[idx]}
                        </div>
                        <div style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 18,
                          fontWeight: 800,
                          color: esHoy ? "#990000" : esPasado ? "var(--gfi-text-dim)" : "rgba(255,255,255,0.8)",
                          lineHeight: 1,
                        }}>
                          {dia.getDate()}
                        </div>
                        {tasDelDia.length > 0 && (
                          <div style={{
                            marginTop: 4,
                            display: "inline-block",
                            background: "#990000",
                            color: "#fff",
                            fontSize: 8,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 8,
                          }}>
                            {tasDelDia.length}
                          </div>
                        )}
                      </div>

                      {/* Cards tasaciones del día */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {tasDelDia.map(tas => {
                          const cfg = ESTADO_CONFIG[tas.estado];
                          const expandida = cardExpandida === tas.id;
                          return (
                            <div
                              key={tas.id}
                              onClick={() => setCardExpandida(expandida ? null : tas.id)}
                              style={{
                                background: cfg.bg,
                                borderLeft: `2px solid ${cfg.color}`,
                                borderRadius: "0 4px 4px 0",
                                padding: "4px 6px",
                                cursor: "pointer",
                                transition: "opacity 0.15s",
                              }}
                            >
                              <div style={{
                                fontSize: 9,
                                color: cfg.color,
                                fontFamily: "var(--font-display)",
                                fontWeight: 700,
                              }}>
                                {tas.hora_programada}
                              </div>
                              <div style={{
                                fontSize: 9,
                                color: "rgba(255,255,255,0.8)",
                                lineHeight: 1.3,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                              }}>
                                {tas.contacto_nombre}
                              </div>
                              <div style={{
                                fontSize: 8,
                                color: "var(--gfi-text-muted)",
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: "vertical",
                              }}>
                                {tas.tipo_propiedad} · {tas.barrio || tas.direccion.split(",")[0]}
                              </div>
                            </div>
                          );
                        })}

                        {tasDelDia.length === 0 && (
                          <div style={{ textAlign: "center", fontSize: 9, color: "var(--gfi-border)", paddingTop: 8 }}>—</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detalle expandido */}
              {cardExpandida && (() => {
                const tas = tasaciones.find(t => t.id === cardExpandida);
                if (!tas) return null;
                const cfg = ESTADO_CONFIG[tas.estado];
                return (
                  <div style={{
                    ...s.card,
                    marginTop: 12,
                    border: `1px solid ${cfg.color}30`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800 }}>{tas.contacto_nombre}</span>
                          <EstadoChip estado={tas.estado} />
                        </div>
                        <div style={{ fontSize: 12, color: "var(--gfi-text-secondary)", marginTop: 4 }}>
                          {fmtFechaCorta(tas.fecha_programada)} · {tas.hora_programada} · {tas.corredor_nombre && `Corredor: ${tas.corredor_nombre}`}
                        </div>
                      </div>
                      <button onClick={() => setCardExpandida(null)} style={{ ...s.btn(), padding: "4px 10px", fontSize: 12 }}>×</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 12 }}>
                      <InfoItem label="Dirección" value={tas.direccion} />
                      <InfoItem label="Barrio" value={tas.barrio || "—"} />
                      <InfoItem label="Tipo" value={TIPO_LABEL[tas.tipo_propiedad]} />
                      <InfoItem label="Ambientes" value={tas.ambientes != null ? String(tas.ambientes) : "—"} />
                      <InfoItem label="Superficie" value={tas.superficie_cubierta != null ? `${tas.superficie_cubierta} m²` : "—"} />
                      <InfoItem label="Valor estimado" value={tas.valor_estimado != null ? fmtValor(tas.valor_estimado) : "—"} />
                      {tas.contacto_telefono && <InfoItem label="Teléfono" value={tas.contacto_telefono} />}
                    </div>
                    {tas.notas && (
                      <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--gfi-bg-card)", borderRadius: 5, fontSize: 12, color: "var(--gfi-text-secondary)" }}>
                        {tas.notas}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <button onClick={() => { abrirEditar(tas); setCardExpandida(null); }} style={{ ...s.btn(), padding: "6px 12px" }}>Editar</button>
                      {(["programada", "realizada", "cancelada", "sin_respuesta"] as EstadoTasacion[]).map(e => (
                        <button
                          key={e}
                          onClick={() => cambiarEstado(tas.id, e)}
                          style={{
                            padding: "6px 12px",
                            background: tas.estado === e ? ESTADO_CONFIG[e].bg : "var(--gfi-border-subtle)",
                            color: tas.estado === e ? ESTADO_CONFIG[e].color : "var(--gfi-text-muted)",
                            border: `1px solid ${tas.estado === e ? ESTADO_CONFIG[e].color + "50" : "var(--gfi-border)"}`,
                            borderRadius: 5,
                            fontSize: 10,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {ESTADO_CONFIG[e].label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VISTA LISTA
          ══════════════════════════════════════════════════════ */}
          {vistaActiva === "lista" && (
            <div style={{ overflowX: "auto" }}>
              {tasacionesFiltradas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--gfi-text-dim)" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🏠</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
                    No hay tasaciones{busqueda ? " que coincidan" : ""}
                  </div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Inter,sans-serif" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--gfi-border)" }}>
                      {["Fecha / Hora", "Propietario", "Dirección", "Tipo", "Sup.", "Corredor", "Estado", "Valor Est.", "Acciones"].map(col => (
                        <th key={col} style={{
                          padding: "10px 10px",
                          textAlign: "left",
                          fontSize: 9,
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--gfi-text-muted)",
                          whiteSpace: "nowrap",
                        }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasacionesFiltradas.map(t => (
                      <tr key={t.id} style={{ borderBottom: "1px solid var(--gfi-border-subtle)" }}>
                        <td style={{ padding: "10px 10px", whiteSpace: "nowrap", color: "var(--gfi-text-primary)" }}>
                          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11 }}>{t.hora_programada}</div>
                          <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", marginTop: 1 }}>{fmtFechaCorta(t.fecha_programada)}</div>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ color: "#fff", fontWeight: 600 }}>{t.contacto_nombre}</div>
                          {t.contacto_telefono && (
                            <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", marginTop: 1 }}>{t.contacto_telefono}</div>
                          )}
                        </td>
                        <td style={{ padding: "10px 10px", maxWidth: 160 }}>
                          <div style={{ color: "var(--gfi-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.direccion}</div>
                          {t.barrio && <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", marginTop: 1 }}>{t.barrio}</div>}
                        </td>
                        <td style={{ padding: "10px 10px", whiteSpace: "nowrap", color: "rgba(255,255,255,0.55)" }}>
                          {TIPO_LABEL[t.tipo_propiedad]}
                        </td>
                        <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                          {t.superficie_cubierta != null ? `${t.superficie_cubierta}m²` : "—"}
                        </td>
                        <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                          {t.corredor_nombre || "—"}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <EstadoChip estado={t.estado} />
                        </td>
                        <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>
                          {t.valor_estimado != null ? fmtValor(t.valor_estimado) : "—"}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {/* Dropdown estado */}
                            <select
                              value={t.estado}
                              onChange={e => cambiarEstado(t.id, e.target.value as EstadoTasacion)}
                              style={{
                                ...s.select,
                                padding: "4px 6px",
                                fontSize: 10,
                                background: ESTADO_CONFIG[t.estado].bg,
                                color: ESTADO_CONFIG[t.estado].color,
                                border: "none",
                              }}
                            >
                              {(["programada", "realizada", "cancelada", "sin_respuesta"] as EstadoTasacion[]).map(e => (
                                <option key={e} value={e}>{ESTADO_CONFIG[e].label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => abrirEditar(t)}
                              style={{ ...s.btn(), padding: "4px 8px", fontSize: 10, border: "none" }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => eliminar(t.id)}
                              style={{
                                padding: "4px 8px",
                                background: "rgba(239,68,68,0.1)",
                                color: "#f87171",
                                border: "none",
                                borderRadius: 4,
                                fontSize: 12,
                                cursor: "pointer",
                                fontFamily: "var(--font-display)",
                                fontWeight: 700,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              VISTA KPIs
          ══════════════════════════════════════════════════════ */}
          {vistaActiva === "kpis" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Cards KPI */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                <KpiCard
                  valor={String(kpis.totalMes)}
                  label="Tasaciones este mes"
                  color="#818cf8"
                />
                <KpiCard
                  valor={`${kpis.tasaConversion}%`}
                  label="Tasa conversión a captación"
                  color="#4ade80"
                />
                <KpiCard
                  valor={kpis.promedioValor > 0 ? fmtValor(Math.round(kpis.promedioValor)) : "—"}
                  label="Valor promedio tasado"
                  color="#d4960c"
                />
                <KpiCard
                  valor={String(kpis.pendientesSem)}
                  label="Pendientes esta semana"
                  color="#f87171"
                />
              </div>

              {/* Gráfico barras */}
              <div style={{ ...s.card }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--gfi-text-secondary)",
                  marginBottom: 14,
                }}>
                  Tasaciones — últimas 8 semanas
                </div>
                <GraficoBarras data={kpis.semanas} />
              </div>

              {/* Distribución por tipo */}
              <div style={{ ...s.card }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--gfi-text-secondary)",
                  marginBottom: 14,
                }}>
                  Distribución por tipo de propiedad
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {TIPOS_PROPIEDAD.map(tipo => {
                    const count = tasaciones.filter(t => t.tipo_propiedad === tipo).length;
                    const pct = tasaciones.length > 0 ? Math.round((count / tasaciones.length) * 100) : 0;
                    return (
                      <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--gfi-text-secondary)", fontFamily: "var(--font-display)", width: 100, flexShrink: 0 }}>
                          {TIPO_LABEL[tipo]}
                        </span>
                        <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 6 }}>
                          <div style={{
                            width: `${pct}%`,
                            background: "rgba(99,102,241,0.7)",
                            height: "100%",
                            borderRadius: 4,
                            transition: "width 0.3s",
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", width: 40, textAlign: "right", fontFamily: "Inter,sans-serif" }}>
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Distribución por estado */}
              <div style={{ ...s.card }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--gfi-text-secondary)",
                  marginBottom: 14,
                }}>
                  Distribución por estado
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(["programada", "realizada", "cancelada", "sin_respuesta"] as EstadoTasacion[]).map(estado => {
                    const count = tasaciones.filter(t => t.estado === estado).length;
                    const cfg = ESTADO_CONFIG[estado];
                    return (
                      <div key={estado} style={{
                        flex: 1,
                        minWidth: 120,
                        background: cfg.bg,
                        borderRadius: 8,
                        padding: "14px 16px",
                        textAlign: "center",
                      }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: cfg.color }}>{count}</div>
                        <div style={{ fontSize: 10, color: cfg.color, fontFamily: "var(--font-display)", fontWeight: 700, marginTop: 2 }}>{cfg.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1a1a1a",
          border: "1px solid var(--gfi-border)",
          borderRadius: 8,
          padding: "12px 20px",
          color: "#fff",
          fontFamily: "Inter,sans-serif",
          fontSize: 13,
          zIndex: 9999,
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontSize: 9,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--gfi-text-muted)",
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter,sans-serif" }}>
        {value}
      </div>
    </div>
  );
}

function KpiCard({ valor, label, color }: { valor: string; label: string; color: string }) {
  return (
    <div style={{
      background: "var(--gfi-bg-primary)",
      border: "1px solid var(--gfi-border)",
      borderRadius: 10,
      padding: "16px 18px",
    }}>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 26,
        fontWeight: 800,
        color,
        lineHeight: 1,
      }}>
        {valor}
      </div>
      <div style={{
        fontSize: 10,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        color: "var(--gfi-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginTop: 6,
      }}>
        {label}
      </div>
    </div>
  );
}
