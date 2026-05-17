"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoVisita = "visita" | "tasacion" | "firma" | "entrega_llaves" | "reunion";
type EstadoVisita = "programada" | "confirmada" | "realizada" | "cancelada" | "no_asistio";

interface Visita {
  id: string;
  fecha: string;        // ISO date "YYYY-MM-DD"
  hora: string;         // "HH:MM"
  propiedad: string;
  contacto_nombre: string;
  contacto_tel: string;
  tipo: TipoVisita;
  estado: EstadoVisita;
  notas: string;
  recordatorio: boolean;
  created_at: string;
}

type Tab = "semanal" | "proximas" | "historial";

// ─── Constantes ───────────────────────────────────────────────────────────────

const LS_KEY = "agenda_visitas";

const TIPO_EMOJI: Record<TipoVisita, string> = {
  visita: "🏠",
  tasacion: "📊",
  firma: "✍️",
  entrega_llaves: "🔑",
  reunion: "🤝",
};

const TIPO_LABEL: Record<TipoVisita, string> = {
  visita: "Visita",
  tasacion: "Tasación",
  firma: "Firma",
  entrega_llaves: "Entrega de llaves",
  reunion: "Reunión",
};

const ESTADO_LABEL: Record<EstadoVisita, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

const ESTADO_BG: Record<EstadoVisita, string> = {
  programada: "#333333",
  confirmada: "#1a3a1a",
  realizada: "#1a1a3a",
  cancelada: "#3a1a1a",
  no_asistio: "#2a2a1a",
};

const ESTADO_COLOR: Record<EstadoVisita, string> = {
  programada: "#aaaaaa",
  confirmada: "#4ade80",
  realizada: "#60a5fa",
  cancelada: "#f87171",
  no_asistio: "#fb923c",
};

const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

function isoHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLunes(offset = 0): Date {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff + offset * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function semanaDates(lunesBase: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunesBase);
    d.setDate(lunesBase.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function formatDia(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dia = DIAS_CORTO[date.getDay()];
  return `${dia} ${d.toString().padStart(2, "0")}/${m.toString().padStart(2, "0")}`;
}

function formatFechaCorta(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dia = DIAS_CORTO[date.getDay()];
  return `${dia} ${d.toString().padStart(2, "0")}/${m.toString().padStart(2, "0")}/${y}`;
}

function getLunesOfDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diaSemana = date.getDay();
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function semanaLabel(lunesBase: Date): string {
  const domingo = new Date(lunesBase);
  domingo.setDate(lunesBase.getDate() + 6);
  const fmtDate = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  return `${fmtDate(lunesBase)} – ${fmtDate(domingo)}`;
}

function getSemanaIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const startOfYear = new Date(y, 0, 1);
  const diffMs = date.getTime() - startOfYear.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

function isoDateFromOffset(baseDate: Date, days: number): string {
  const d = new Date(baseDate);
  d.setDate(baseDate.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Ejemplos pre-cargados ────────────────────────────────────────────────────

function generarEjemplos(): Visita[] {
  const hoy = isoHoy();
  const [y, m, d] = hoy.split("-").map(Number);

  const fechas = [
    new Date(y, m - 1, d),
    new Date(y, m - 1, d + 1),
    new Date(y, m - 1, d + 3),
  ].map((dt) => dt.toISOString().slice(0, 10));

  return [
    {
      id: crypto.randomUUID(),
      fecha: fechas[0],
      hora: "10:00",
      propiedad: "Av. Corrientes 1234, CABA",
      contacto_nombre: "Martín González",
      contacto_tel: "11 5555-1234",
      tipo: "visita",
      estado: "confirmada",
      notas: "Busca 3 ambientes. Tiene precalificación bancaria.",
      recordatorio: true,
      created_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      fecha: fechas[1],
      hora: "14:30",
      propiedad: "San Martín 567, Rosario",
      contacto_nombre: "Laura Pérez",
      contacto_tel: "341 444-7890",
      tipo: "tasacion",
      estado: "programada",
      notas: "Herencia familiar. Tres herederos.",
      recordatorio: false,
      created_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      fecha: fechas[2],
      hora: "09:00",
      propiedad: "Escribanía López — Florida 890, CABA",
      contacto_nombre: "Carlos Ruiz",
      contacto_tel: "11 6666-4321",
      tipo: "firma",
      estado: "programada",
      notas: "Firma escritura. Llevar toda la documentación.",
      recordatorio: true,
      created_at: new Date().toISOString(),
    },
  ];
}

// ─── localStorage ─────────────────────────────────────────────────────────────

function cargarVisitas(): Visita[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Visita[];
  } catch {
    // ignore
  }
  const ejemplos = generarEjemplos();
  localStorage.setItem(LS_KEY, JSON.stringify(ejemplos));
  return ejemplos;
}

function guardarVisitas(visitas: Visita[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(visitas));
}

// ─── Valores por defecto del form ─────────────────────────────────────────────

const FORM_DEFAULT: Omit<Visita, "id" | "created_at"> = {
  fecha: isoHoy(),
  hora: "10:00",
  propiedad: "",
  contacto_nombre: "",
  contacto_tel: "",
  tipo: "visita",
  estado: "programada",
  notas: "",
  recordatorio: false,
};

// ─── Componente modal ────────────────────────────────────────────────────────

interface ModalProps {
  visita: Partial<Visita> & { id?: string };
  onGuardar: (v: Omit<Visita, "id" | "created_at">) => void;
  onEliminar?: () => void;
  onCerrar: () => void;
}

function ModalVisita({ visita, onGuardar, onEliminar, onCerrar }: ModalProps) {
  const [form, setForm] = useState<Omit<Visita, "id" | "created_at">>({
    fecha: visita.fecha ?? FORM_DEFAULT.fecha,
    hora: visita.hora ?? FORM_DEFAULT.hora,
    propiedad: visita.propiedad ?? "",
    contacto_nombre: visita.contacto_nombre ?? "",
    contacto_tel: visita.contacto_tel ?? "",
    tipo: visita.tipo ?? "visita",
    estado: visita.estado ?? "programada",
    notas: visita.notas ?? "",
    recordatorio: visita.recordatorio ?? false,
  });
  const [errores, setErrores] = useState<Record<string, string>>({});

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.fecha) e.fecha = "La fecha es obligatoria";
    if (!form.hora) e.hora = "La hora es obligatoria";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = () => {
    if (validar()) onGuardar(form);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6,
    color: "#e0e0e0",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "Montserrat, sans-serif",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "rgba(224,224,224,0.45)",
    marginBottom: 5,
  };

  const fieldStyle: React.CSSProperties = { marginBottom: 14 };
  const errorStyle: React.CSSProperties = { fontSize: 11, color: "#f87171", marginTop: 3 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div
        style={{
          background: "#111111",
          border: "1px solid #222222",
          borderRadius: 12,
          padding: 28,
          width: "100%",
          maxWidth: 560,
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontSize: 17,
            fontWeight: 800,
            color: "#e0e0e0",
            marginBottom: 22,
          }}
        >
          {visita.id ? "Editar visita" : "Nueva visita"}
        </div>

        {/* Fila fecha / hora */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <label style={labelStyle}>Fecha *</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => set("fecha", e.target.value)}
              style={{ ...inputStyle, borderColor: errores.fecha ? "#f87171" : "rgba(255,255,255,0.12)" }}
            />
            {errores.fecha && <div style={errorStyle}>{errores.fecha}</div>}
          </div>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <label style={labelStyle}>Hora *</label>
            <input
              type="time"
              value={form.hora}
              onChange={(e) => set("hora", e.target.value)}
              style={{ ...inputStyle, borderColor: errores.hora ? "#f87171" : "rgba(255,255,255,0.12)" }}
            />
            {errores.hora && <div style={errorStyle}>{errores.hora}</div>}
          </div>
        </div>

        {/* Tipo */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Tipo</label>
          <select
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value as TipoVisita)}
            style={inputStyle}
          >
            {(Object.keys(TIPO_LABEL) as TipoVisita[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_EMOJI[t]} {TIPO_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Propiedad */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Propiedad / Lugar</label>
          <input
            type="text"
            value={form.propiedad}
            onChange={(e) => set("propiedad", e.target.value)}
            placeholder="Av. Corrientes 1234, CABA"
            style={inputStyle}
          />
        </div>

        {/* Contacto */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <label style={labelStyle}>Nombre del contacto</label>
            <input
              type="text"
              value={form.contacto_nombre}
              onChange={(e) => set("contacto_nombre", e.target.value)}
              placeholder="Juan Pérez"
              style={inputStyle}
            />
          </div>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <label style={labelStyle}>Teléfono</label>
            <input
              type="tel"
              value={form.contacto_tel}
              onChange={(e) => set("contacto_tel", e.target.value)}
              placeholder="11 5555-1234"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Estado */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Estado</label>
          <select
            value={form.estado}
            onChange={(e) => set("estado", e.target.value as EstadoVisita)}
            style={inputStyle}
          >
            {(Object.keys(ESTADO_LABEL) as EstadoVisita[]).map((s) => (
              <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {/* Notas */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Notas</label>
          <textarea
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
            rows={3}
            placeholder="Observaciones sobre la visita..."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {/* Recordatorio */}
        <div style={{ ...fieldStyle, display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            id="recordatorio"
            checked={form.recordatorio}
            onChange={(e) => set("recordatorio", e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "#cc0000", cursor: "pointer" }}
          />
          <label
            htmlFor="recordatorio"
            style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#e0e0e0", cursor: "pointer" }}
          >
            Mostrar recordatorio si es hoy
          </label>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            onClick={handleGuardar}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "#cc0000",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontFamily: "Montserrat, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Guardar
          </button>
          <button
            onClick={onCerrar}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(224,224,224,0.5)",
              border: "1px solid #222222",
              borderRadius: 6,
              fontFamily: "Montserrat, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          {visita.id && onEliminar && (
            <button
              onClick={() => {
                if (confirm("¿Eliminar esta visita?")) onEliminar();
              }}
              style={{
                padding: "10px 18px",
                background: "rgba(204,0,0,0.1)",
                color: "#f87171",
                border: "1px solid rgba(204,0,0,0.3)",
                borderRadius: 6,
                fontFamily: "Montserrat, sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AgendaVisitasPage() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [tab, setTab] = useState<Tab>("semanal");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [modalVisita, setModalVisita] = useState<Partial<Visita> | null>(null);
  const [modalNueva, setModalNueva] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroDesde, setFiltroDesde] = useState<string>("");
  const [filtroHasta, setFiltroHasta] = useState<string>("");
  const [montado, setMontado] = useState(false);

  // Cargar desde localStorage (solo en cliente)
  useEffect(() => {
    setVisitas(cargarVisitas());
    setMontado(true);
  }, []);

  const persistir = useCallback((nuevas: Visita[]) => {
    setVisitas(nuevas);
    guardarVisitas(nuevas);
  }, []);

  const handleGuardar = useCallback(
    (datos: Omit<Visita, "id" | "created_at">) => {
      if (modalVisita?.id) {
        // Edición
        persistir(
          visitas.map((v) =>
            v.id === modalVisita.id ? { ...v, ...datos } : v
          )
        );
      } else {
        // Nueva
        const nueva: Visita = {
          ...datos,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        };
        persistir([...visitas, nueva]);
      }
      setModalVisita(null);
      setModalNueva(false);
    },
    [modalVisita, visitas, persistir]
  );

  const handleEliminar = useCallback(() => {
    if (!modalVisita?.id) return;
    persistir(visitas.filter((v) => v.id !== modalVisita.id));
    setModalVisita(null);
  }, [modalVisita, visitas, persistir]);

  const cambiarEstado = useCallback(
    (id: string, estado: EstadoVisita) => {
      persistir(visitas.map((v) => (v.id === id ? { ...v, estado } : v)));
    },
    [visitas, persistir]
  );

  // ── Recordatorios de hoy ────────────────────────────────────────────────────
  const hoy = isoHoy();
  const recordatoriosHoy = montado
    ? visitas.filter(
        (v) =>
          v.fecha === hoy &&
          v.recordatorio &&
          (v.estado === "programada" || v.estado === "confirmada")
      )
    : [];

  // ── Vista semanal ───────────────────────────────────────────────────────────
  const lunesBase = getLunes(semanaOffset);
  const diasSemana = semanaDates(lunesBase);

  const visitasDia = (isoDate: string) =>
    visitas
      .filter((v) => v.fecha === isoDate)
      .sort((a, b) => a.hora.localeCompare(b.hora));

  // ── Tab Próximas ────────────────────────────────────────────────────────────
  const visitasProximas = visitas
    .filter((v) => {
      if (v.fecha < hoy) return false;
      if (filtroEstado && v.estado !== filtroEstado) return false;
      if (filtroTipo && v.tipo !== filtroTipo) return false;
      if (filtroDesde && v.fecha < filtroDesde) return false;
      if (filtroHasta && v.fecha > filtroHasta) return false;
      return true;
    })
    .sort((a, b) =>
      a.fecha !== b.fecha
        ? a.fecha.localeCompare(b.fecha)
        : a.hora.localeCompare(b.hora)
    );

  // Agrupar por fecha
  const proxGrouped: Record<string, Visita[]> = {};
  for (const v of visitasProximas) {
    if (!proxGrouped[v.fecha]) proxGrouped[v.fecha] = [];
    proxGrouped[v.fecha].push(v);
  }

  // Badge de pendientes esta semana
  const pendientesEsta = visitas.filter(
    (v) =>
      diasSemana.includes(v.fecha) &&
      (v.estado === "programada" || v.estado === "confirmada")
  ).length;

  // ── Tab Historial / Estadísticas ────────────────────────────────────────────
  const ahora = new Date();
  const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const visitasMes = visitas.filter((v) => v.fecha >= primerDiaMes);
  const realizadasMes = visitasMes.filter((v) => v.estado === "realizada").length;
  const programadasConfMes = visitasMes.filter(
    (v) => v.estado === "programada" || v.estado === "confirmada" || v.estado === "realizada"
  ).length;
  const tasaAsistencia =
    programadasConfMes > 0
      ? Math.round((realizadasMes / programadasConfMes) * 100)
      : 0;

  // Tipo más frecuente
  const conteoTipos: Record<string, number> = {};
  for (const v of visitasMes) {
    conteoTipos[v.tipo] = (conteoTipos[v.tipo] ?? 0) + 1;
  }
  const tipoMasFrecuente = (Object.entries(conteoTipos).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0] ?? null) as TipoVisita | null;

  // Últimas 8 semanas (para gráfico)
  const ultimasOchoSemanas: { label: string; porEstado: Record<EstadoVisita, number>; total: number }[] =
    Array.from({ length: 8 }, (_, i) => {
      const lunesSem = new Date(lunesBase);
      lunesSem.setDate(lunesBase.getDate() - (7 - i) * 7);
      const fechasSem = semanaDates(lunesSem);
      const semVisitas = visitas.filter((v) => fechasSem.includes(v.fecha));
      const porEstado: Record<EstadoVisita, number> = {
        programada: 0,
        confirmada: 0,
        realizada: 0,
        cancelada: 0,
        no_asistio: 0,
      };
      for (const v of semVisitas) porEstado[v.estado]++;
      return {
        label: `${lunesSem.getDate().toString().padStart(2, "0")}/${(lunesSem.getMonth() + 1).toString().padStart(2, "0")}`,
        porEstado,
        total: semVisitas.length,
      };
    });

  const maxBarra = Math.max(...ultimasOchoSemanas.map((s) => s.total), 1);

  // Resumen por tipo
  const resPorTipo: { tipo: TipoVisita; cantidad: number; realizadas: number }[] = (
    Object.keys(TIPO_LABEL) as TipoVisita[]
  ).map((tipo) => {
    const del = visitas.filter((v) => v.tipo === tipo);
    const realizadas = del.filter((v) => v.estado === "realizada").length;
    return { tipo, cantidad: del.length, realizadas };
  }).filter((r) => r.cantidad > 0);

  // Semanas desde inicio del año para "por semana"
  const semanaActual = getSemanaIndex(hoy);

  // ── Estilos comunes ─────────────────────────────────────────────────────────
  const btnAccionStyle = (color?: string): React.CSSProperties => ({
    padding: "4px 10px",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${color ? color + "44" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 4,
    color: color ?? "rgba(224,224,224,0.55)",
    fontFamily: "Montserrat, sans-serif",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
  });

  if (!montado) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(224,224,224,0.3)",
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
        }}
      >
        Cargando...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0a",
          color: "#e0e0e0",
          fontFamily: "Inter, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 20px",
            borderBottom: "1px solid #222222",
            background: "#0a0a0a",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <a
            href="/crm"
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "rgba(224,224,224,0.3)",
              textDecoration: "none",
              textTransform: "uppercase",
            }}
          >
            ← CRM
          </a>
          <div
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 15,
              fontWeight: 800,
              color: "#e0e0e0",
              letterSpacing: "0.04em",
            }}
          >
            Agenda de Visitas
          </div>
          <div style={{ flex: 1 }} />
        </div>

        {/* ── Banner de recordatorios ─────────────────────────────────────── */}
        {recordatoriosHoy.length > 0 && (
          <div
            style={{
              background: "#2a2500",
              border: "1px solid #554d00",
              borderLeft: "4px solid #eab308",
              margin: "12px 16px 0",
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>⏰</span>
            <div>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#eab308",
                  marginBottom: 4,
                }}
              >
                Tenés {recordatoriosHoy.length} visita{recordatoriosHoy.length !== 1 ? "s" : ""} hoy:
              </div>
              {recordatoriosHoy.map((v) => (
                <div
                  key={v.id}
                  style={{ fontSize: 12, color: "rgba(224,224,224,0.7)", marginBottom: 2 }}
                >
                  {v.hora} — {TIPO_EMOJI[v.tipo]} {v.propiedad || v.contacto_nombre || "Sin datos"}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 0,
            padding: "12px 16px 0",
            borderBottom: "1px solid #222222",
          }}
        >
          {(
            [
              { key: "semanal", label: "Semana" },
              { key: "proximas", label: "Próximas", badge: pendientesEsta },
              { key: "historial", label: "Historial" },
            ] as { key: Tab; label: string; badge?: number }[]
          ).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "8px 16px",
                background: "none",
                border: "none",
                borderBottom: tab === key ? "2px solid #cc0000" : "2px solid transparent",
                color: tab === key ? "#e0e0e0" : "rgba(224,224,224,0.35)",
                fontFamily: "Montserrat, sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                position: "relative",
                marginBottom: -1,
              }}
            >
              {label}
              {badge != null && badge > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: "#cc0000",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 10,
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: VISTA SEMANAL
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "semanal" && (
          <div style={{ flex: 1, padding: 16, overflowX: "auto" }}>
            {/* Navegación de semana */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <button
                onClick={() => setSemanaOffset((o) => o - 1)}
                style={{
                  ...btnAccionStyle(),
                  padding: "6px 12px",
                  fontSize: 11,
                }}
              >
                ← Anterior
              </button>
              <span
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: semanaOffset === 0 ? "#cc0000" : "rgba(224,224,224,0.6)",
                }}
              >
                {semanaOffset === 0 ? "Esta semana" : semanaLabel(lunesBase)}
              </span>
              {semanaOffset !== 0 && (
                <button
                  onClick={() => setSemanaOffset(0)}
                  style={{ ...btnAccionStyle("#cc0000"), padding: "4px 8px", fontSize: 9 }}
                >
                  Hoy
                </button>
              )}
              <button
                onClick={() => setSemanaOffset((o) => o + 1)}
                style={{
                  ...btnAccionStyle(),
                  padding: "6px 12px",
                  fontSize: 11,
                }}
              >
                Siguiente →
              </button>
            </div>

            {/* Grid 7 columnas */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
                gap: 8,
                minWidth: 700,
              }}
            >
              {diasSemana.map((fecha) => {
                const esHoy = fecha === hoy;
                const vissDia = visitasDia(fecha);
                return (
                  <div
                    key={fecha}
                    style={{
                      background: "#111111",
                      border: esHoy ? "1px solid #cc0000" : "1px solid #222222",
                      borderRadius: 8,
                      minHeight: 160,
                      padding: 8,
                    }}
                  >
                    {/* Encabezado del día */}
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: esHoy ? "#cc0000" : "rgba(224,224,224,0.45)",
                        marginBottom: 8,
                        textAlign: "center",
                        textTransform: "uppercase",
                      }}
                    >
                      {formatDia(fecha)}
                      {esHoy && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 8,
                            color: "#cc0000",
                            marginTop: 1,
                          }}
                        >
                          HOY
                        </span>
                      )}
                    </div>

                    {/* Tarjetas de visitas */}
                    {vissDia.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => setModalVisita(v)}
                        style={{
                          background: ESTADO_BG[v.estado],
                          border: `1px solid ${ESTADO_COLOR[v.estado]}33`,
                          borderRadius: 5,
                          padding: "6px 8px",
                          marginBottom: 5,
                          cursor: "pointer",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLDivElement).style.opacity = "0.8")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLDivElement).style.opacity = "1")
                        }
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            marginBottom: 2,
                          }}
                        >
                          <span style={{ fontSize: 11 }}>{TIPO_EMOJI[v.tipo]}</span>
                          <span
                            style={{
                              fontFamily: "Montserrat, sans-serif",
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#e0e0e0",
                            }}
                          >
                            {v.hora}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(224,224,224,0.75)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {v.contacto_nombre || v.propiedad || "Sin datos"}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            display: "inline-block",
                            background: ESTADO_BG[v.estado],
                            border: `1px solid ${ESTADO_COLOR[v.estado]}66`,
                            borderRadius: 3,
                            padding: "1px 5px",
                            fontSize: 8,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color: ESTADO_COLOR[v.estado],
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {ESTADO_LABEL[v.estado]}
                        </div>
                      </div>
                    ))}

                    {vissDia.length === 0 && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(224,224,224,0.15)",
                          textAlign: "center",
                          marginTop: 20,
                        }}
                      >
                        —
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: PRÓXIMAS / LISTA
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "proximas" && (
          <div style={{ flex: 1, padding: 16 }}>
            {/* Filtros */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                style={{
                  padding: "7px 10px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid #222222",
                  borderRadius: 6,
                  color: "#e0e0e0",
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Todos los estados</option>
                <option value="programada">Programada</option>
                <option value="confirmada">Confirmada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
                <option value="no_asistio">No asistió</option>
              </select>

              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                style={{
                  padding: "7px 10px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid #222222",
                  borderRadius: 6,
                  color: "#e0e0e0",
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Todos los tipos</option>
                {(Object.keys(TIPO_LABEL) as TipoVisita[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_EMOJI[t]} {TIPO_LABEL[t]}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(224,224,224,0.4)",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  Desde
                </span>
                <input
                  type="date"
                  value={filtroDesde}
                  onChange={(e) => setFiltroDesde(e.target.value)}
                  style={{
                    padding: "6px 8px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid #222222",
                    borderRadius: 6,
                    color: "#e0e0e0",
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(224,224,224,0.4)",
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  Hasta
                </span>
                <input
                  type="date"
                  value={filtroHasta}
                  onChange={(e) => setFiltroHasta(e.target.value)}
                  style={{
                    padding: "6px 8px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid #222222",
                    borderRadius: 6,
                    color: "#e0e0e0",
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                    outline: "none",
                  }}
                />
              </div>

              {(filtroEstado || filtroTipo || filtroDesde || filtroHasta) && (
                <button
                  onClick={() => {
                    setFiltroEstado("");
                    setFiltroTipo("");
                    setFiltroDesde("");
                    setFiltroHasta("");
                  }}
                  style={{ ...btnAccionStyle("#f87171"), padding: "6px 10px", fontSize: 10 }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Lista agrupada */}
            {Object.keys(proxGrouped).length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "rgba(224,224,224,0.25)",
                  fontSize: 14,
                  padding: "60px 20px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                No hay visitas próximas
              </div>
            ) : (
              Object.entries(proxGrouped).map(([fecha, viss]) => (
                <div key={fecha} style={{ marginBottom: 20 }}>
                  {/* Separador de día */}
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: fecha === hoy ? "#cc0000" : "rgba(224,224,224,0.4)",
                      borderBottom: `1px solid ${fecha === hoy ? "#cc000033" : "#222222"}`,
                      paddingBottom: 6,
                      marginBottom: 10,
                    }}
                  >
                    {formatFechaCorta(fecha)}
                    {fecha === hoy && (
                      <span
                        style={{
                          marginLeft: 8,
                          background: "#cc0000",
                          color: "#fff",
                          fontSize: 8,
                          padding: "2px 6px",
                          borderRadius: 3,
                          verticalAlign: "middle",
                        }}
                      >
                        HOY
                      </span>
                    )}
                  </div>

                  {/* Items del día */}
                  {viss.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        background: "#111111",
                        border: "1px solid #222222",
                        borderRadius: 8,
                        padding: "12px 14px",
                        marginBottom: 8,
                        display: "flex",
                        gap: 14,
                        alignItems: "flex-start",
                      }}
                    >
                      {/* Hora + tipo */}
                      <div
                        style={{
                          minWidth: 56,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#e0e0e0",
                          }}
                        >
                          {v.hora}
                        </div>
                        <div style={{ fontSize: 18, marginTop: 2 }}>{TIPO_EMOJI[v.tipo]}</div>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#e0e0e0",
                            marginBottom: 2,
                          }}
                        >
                          {v.contacto_nombre || "Sin contacto"}
                        </div>
                        {v.propiedad && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(224,224,224,0.5)",
                              marginBottom: 4,
                            }}
                          >
                            {v.propiedad}
                          </div>
                        )}
                        {v.contacto_tel && (
                          <div
                            style={{ fontSize: 11, color: "rgba(224,224,224,0.35)", marginBottom: 6 }}
                          >
                            📱 {v.contacto_tel}
                          </div>
                        )}
                        {/* Badge estado */}
                        <span
                          style={{
                            display: "inline-block",
                            background: ESTADO_BG[v.estado],
                            border: `1px solid ${ESTADO_COLOR[v.estado]}55`,
                            borderRadius: 4,
                            padding: "2px 7px",
                            fontSize: 9,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color: ESTADO_COLOR[v.estado],
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {ESTADO_LABEL[v.estado]}
                        </span>
                      </div>

                      {/* Acciones rápidas */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                        <button
                          style={btnAccionStyle()}
                          onClick={() => setModalVisita(v)}
                        >
                          Editar
                        </button>
                        {(v.estado === "programada") && (
                          <button
                            style={btnAccionStyle("#4ade80")}
                            onClick={() => cambiarEstado(v.id, "confirmada")}
                          >
                            Confirmar
                          </button>
                        )}
                        {(v.estado === "programada" || v.estado === "confirmada") && (
                          <>
                            <button
                              style={btnAccionStyle("#60a5fa")}
                              onClick={() => cambiarEstado(v.id, "realizada")}
                            >
                              Realizada
                            </button>
                            <button
                              style={btnAccionStyle("#f87171")}
                              onClick={() => cambiarEstado(v.id, "cancelada")}
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: HISTORIAL Y ESTADÍSTICAS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "historial" && (
          <div style={{ flex: 1, padding: 16 }}>
            {/* KPIs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 24,
              }}
            >
              {[
                {
                  label: "Visitas este mes",
                  value: visitasMes.length.toString(),
                  color: "#60a5fa",
                },
                {
                  label: "Tasa de asistencia",
                  value: `${tasaAsistencia}%`,
                  color: "#4ade80",
                },
                {
                  label: "Tipo más frecuente",
                  value: tipoMasFrecuente
                    ? `${TIPO_EMOJI[tipoMasFrecuente]} ${TIPO_LABEL[tipoMasFrecuente]}`
                    : "—",
                  color: "#eab308",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    background: "#111111",
                    border: "1px solid #222222",
                    borderRadius: 10,
                    padding: "16px 18px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "rgba(224,224,224,0.35)",
                      marginBottom: 8,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: 22,
                      fontWeight: 800,
                      color,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Gráfico de barras SVG — últimas 8 semanas */}
            <div
              style={{
                background: "#111111",
                border: "1px solid #222222",
                borderRadius: 10,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(224,224,224,0.4)",
                  marginBottom: 16,
                }}
              >
                Visitas por semana — últimas 8 semanas
              </div>
              <svg
                width="100%"
                viewBox="0 0 560 160"
                preserveAspectRatio="xMidYMid meet"
                style={{ overflow: "visible" }}
              >
                {ultimasOchoSemanas.map((sem, i) => {
                  const barW = 44;
                  const gap = 26;
                  const x = i * (barW + gap) + 10;
                  const maxH = 110;
                  const estados: EstadoVisita[] = ["realizada", "confirmada", "programada", "cancelada", "no_asistio"];
                  const colores: Record<EstadoVisita, string> = {
                    realizada: "#1a1a3a",
                    confirmada: "#1a3a1a",
                    programada: "#333333",
                    cancelada: "#3a1a1a",
                    no_asistio: "#2a2a1a",
                  };
                  const strokeColores: Record<EstadoVisita, string> = {
                    realizada: "#60a5fa",
                    confirmada: "#4ade80",
                    programada: "#aaaaaa",
                    cancelada: "#f87171",
                    no_asistio: "#fb923c",
                  };
                  let accH = 0;
                  return (
                    <g key={sem.label}>
                      {estados.map((est) => {
                        const count = sem.porEstado[est];
                        if (count === 0) return null;
                        const h = (count / maxBarra) * maxH;
                        const y = maxH - accH - h + 20;
                        accH += h;
                        return (
                          <rect
                            key={est}
                            x={x}
                            y={y}
                            width={barW}
                            height={h}
                            fill={colores[est]}
                            stroke={strokeColores[est]}
                            strokeWidth={0.5}
                            rx={2}
                          />
                        );
                      })}
                      {sem.total === 0 && (
                        <rect
                          x={x}
                          y={maxH + 20 - 3}
                          width={barW}
                          height={3}
                          fill="rgba(255,255,255,0.06)"
                          rx={1}
                        />
                      )}
                      {sem.total > 0 && (
                        <text
                          x={x + barW / 2}
                          y={maxH + 20 - accH - 4}
                          textAnchor="middle"
                          fill="rgba(224,224,224,0.7)"
                          fontSize={9}
                          fontFamily="Montserrat, sans-serif"
                          fontWeight={700}
                        >
                          {sem.total}
                        </text>
                      )}
                      <text
                        x={x + barW / 2}
                        y={maxH + 38}
                        textAnchor="middle"
                        fill="rgba(224,224,224,0.3)"
                        fontSize={8}
                        fontFamily="Inter, sans-serif"
                      >
                        {sem.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Leyenda */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
                {(["realizada", "confirmada", "programada", "cancelada", "no_asistio"] as EstadoVisita[]).map((est) => {
                  const dotColors: Record<EstadoVisita, string> = {
                    realizada: "#60a5fa",
                    confirmada: "#4ade80",
                    programada: "#aaaaaa",
                    cancelada: "#f87171",
                    no_asistio: "#fb923c",
                  };
                  return (
                    <div key={est} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: dotColors[est],
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          color: "rgba(224,224,224,0.45)",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {ESTADO_LABEL[est]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabla resumen por tipo */}
            <div
              style={{
                background: "#111111",
                border: "1px solid #222222",
                borderRadius: 10,
                padding: 20,
              }}
            >
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(224,224,224,0.4)",
                  marginBottom: 14,
                }}
              >
                Resumen por tipo
              </div>
              {resPorTipo.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(224,224,224,0.25)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  Sin datos
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Tipo", "Cantidad", "% Asistencia", "Prom. por semana"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            fontFamily: "Montserrat, sans-serif",
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "rgba(224,224,224,0.3)",
                            paddingBottom: 8,
                            borderBottom: "1px solid #222222",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resPorTipo.map(({ tipo, cantidad, realizadas }) => {
                      const pct =
                        cantidad > 0 ? Math.round((realizadas / cantidad) * 100) : 0;
                      const semanasTranscurridas = Math.max(semanaActual, 1);
                      const promSem = (cantidad / semanasTranscurridas).toFixed(1);
                      return (
                        <tr key={tipo}>
                          <td
                            style={{
                              padding: "10px 0",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              fontFamily: "Inter, sans-serif",
                              fontSize: 13,
                              color: "#e0e0e0",
                            }}
                          >
                            {TIPO_EMOJI[tipo]} {TIPO_LABEL[tipo]}
                          </td>
                          <td
                            style={{
                              padding: "10px 0",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              fontFamily: "Montserrat, sans-serif",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#e0e0e0",
                            }}
                          >
                            {cantidad}
                          </td>
                          <td
                            style={{
                              padding: "10px 0",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              fontFamily: "Montserrat, sans-serif",
                              fontSize: 13,
                              fontWeight: 700,
                              color: pct >= 70 ? "#4ade80" : pct >= 40 ? "#eab308" : "#f87171",
                            }}
                          >
                            {pct}%
                          </td>
                          <td
                            style={{
                              padding: "10px 0",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              fontFamily: "Inter, sans-serif",
                              fontSize: 13,
                              color: "rgba(224,224,224,0.55)",
                            }}
                          >
                            {promSem}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── FAB Nueva Visita ─────────────────────────────────────────────── */}
        <button
          onClick={() => {
            setModalVisita(null);
            setModalNueva(true);
          }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#cc0000",
            border: "none",
            color: "#fff",
            fontSize: 24,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(204,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          title="Nueva visita"
        >
          +
        </button>
      </div>

      {/* ── Modal: edición de visita existente ─────────────────────────── */}
      {modalVisita && (
        <ModalVisita
          visita={modalVisita}
          onGuardar={handleGuardar}
          onEliminar={handleEliminar}
          onCerrar={() => setModalVisita(null)}
        />
      )}

      {/* ── Modal: nueva visita ─────────────────────────────────────────── */}
      {modalNueva && (
        <ModalVisita
          visita={FORM_DEFAULT}
          onGuardar={handleGuardar}
          onCerrar={() => setModalNueva(false)}
        />
      )}
    </>
  );
}
