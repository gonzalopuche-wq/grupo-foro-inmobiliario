"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Categoria =
  | "llamada"
  | "visita"
  | "documento"
  | "publicacion"
  | "reunion"
  | "seguimiento"
  | "admin"
  | "otro";

type Prioridad = "urgente" | "alta" | "media" | "baja";
type Estado = "pendiente" | "en_proceso" | "completada" | "cancelada";

interface Tarea {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  prioridad: Prioridad;
  estado: Estado;
  fecha_vencimiento: string | null;
  fecha_completada: string | null;
  contacto_ref: string;
  propiedad_ref: string;
  recordatorio: boolean;
  created_at: string;
  updated_at: string;
}

type Tab = "hoy" | "kanban" | "historial";

// ─── Constantes ───────────────────────────────────────────────────────────────

const LS_KEY = "tareas_crm";

const CATEGORIA_EMOJI: Record<Categoria, string> = {
  llamada: "📞",
  visita: "🏠",
  documento: "📄",
  publicacion: "📢",
  reunion: "🤝",
  seguimiento: "🔄",
  admin: "⚙️",
  otro: "📌",
};

const CATEGORIA_LABEL: Record<Categoria, string> = {
  llamada: "Llamada",
  visita: "Visita",
  documento: "Documento",
  publicacion: "Publicación",
  reunion: "Reunión",
  seguimiento: "Seguimiento",
  admin: "Admin",
  otro: "Otro",
};

const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  urgente: "#cc0000",
  alta: "#f97316",
  media: "#eab308",
  baja: "#6b7280",
};

const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const ESTADO_LABEL: Record<Estado, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  completada: "Completada",
  cancelada: "Cancelada",
};

const ESTADO_ORDER: Estado[] = [
  "pendiente",
  "en_proceso",
  "completada",
  "cancelada",
];

const CATEGORIAS: Categoria[] = [
  "llamada",
  "visita",
  "documento",
  "publicacion",
  "reunion",
  "seguimiento",
  "admin",
  "otro",
];

const PRIORIDADES: Prioridad[] = ["urgente", "alta", "media", "baja"];
const ESTADOS: Estado[] = ["pendiente", "en_proceso", "completada", "cancelada"];

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

function isoHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: string, n: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function esFechaPasada(fecha: string | null): boolean {
  if (!fecha) return false;
  return fecha < isoHoy();
}

function esFechaHoy(fecha: string | null): boolean {
  if (!fecha) return false;
  return fecha === isoHoy();
}

function esFechaEnProximos7(fecha: string | null): boolean {
  if (!fecha) return false;
  const limite = addDays(isoHoy(), 7);
  return fecha > isoHoy() && fecha <= limite;
}

function esFechaEstaSemana(fecha: string | null): boolean {
  if (!fecha) return false;
  const limite = addDays(isoHoy(), 7);
  return fecha >= isoHoy() && fecha <= limite;
}

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function diasDiferencia(desde: string, hasta: string): number {
  const a = new Date(desde + "T12:00:00").getTime();
  const b = new Date(hasta + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function semanaISO(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - day);
  return lunes.toISOString().slice(0, 10);
}

// ─── Datos de ejemplo ─────────────────────────────────────────────────────────

function generarEjemplos(): Tarea[] {
  const hoy = isoHoy();
  return [
    {
      id: "t1",
      titulo: "Llamar a García por el departamento de Alberdi",
      descripcion: "Confirmar si sigue interesado y coordinar visita",
      categoria: "llamada",
      prioridad: "urgente",
      estado: "pendiente",
      fecha_vencimiento: addDays(hoy, -1),
      fecha_completada: null,
      contacto_ref: "Ramón García",
      propiedad_ref: "Depto 3A, Bv. Oroño 1200, Alberdi",
      recordatorio: true,
      created_at: addDays(hoy, -5) + "T09:00:00Z",
      updated_at: addDays(hoy, -1) + "T08:00:00Z",
    },
    {
      id: "t2",
      titulo: "Preparar contrato de alquiler Local Pichincha",
      descripcion: "Revisar cláusulas con la escribanía y enviar borrador",
      categoria: "documento",
      prioridad: "alta",
      estado: "en_proceso",
      fecha_vencimiento: hoy,
      fecha_completada: null,
      contacto_ref: "Marta Ruiz",
      propiedad_ref: "Local comercial, Pichincha 780 PB",
      recordatorio: true,
      created_at: addDays(hoy, -3) + "T10:00:00Z",
      updated_at: addDays(hoy, -1) + "T17:00:00Z",
    },
    {
      id: "t3",
      titulo: "Publicar departamento Macrocentro en ZonaProp",
      descripcion: "Subir fotos, precio actualizado y descripción detallada",
      categoria: "publicacion",
      prioridad: "media",
      estado: "pendiente",
      fecha_vencimiento: addDays(hoy, 1),
      fecha_completada: null,
      contacto_ref: "Pedro Almirón",
      propiedad_ref: "Depto 2 amb, Córdoba 1450 4°B",
      recordatorio: false,
      created_at: addDays(hoy, -2) + "T11:00:00Z",
      updated_at: addDays(hoy, -2) + "T11:00:00Z",
    },
    {
      id: "t4",
      titulo: "Visita guiada - familia López - Fisherton",
      descripcion: "Preparar carpeta con información del barrio y preguntas frecuentes",
      categoria: "visita",
      prioridad: "alta",
      estado: "pendiente",
      fecha_vencimiento: addDays(hoy, 2),
      fecha_completada: null,
      contacto_ref: "Familia López",
      propiedad_ref: "Casa 4 amb, Los Aromos 1220, Fisherton",
      recordatorio: true,
      created_at: addDays(hoy, -1) + "T14:00:00Z",
      updated_at: addDays(hoy, -1) + "T14:00:00Z",
    },
    {
      id: "t5",
      titulo: "Renovar póliza de seguro de responsabilidad civil",
      descripcion: "Contactar a la aseguradora y comparar precios",
      categoria: "admin",
      prioridad: "baja",
      estado: "pendiente",
      fecha_vencimiento: addDays(hoy, 30),
      fecha_completada: null,
      contacto_ref: "",
      propiedad_ref: "",
      recordatorio: false,
      created_at: hoy + "T09:00:00Z",
      updated_at: hoy + "T09:00:00Z",
    },
    {
      id: "t6",
      titulo: "Reunión con propietaria Fernández sobre tasación",
      descripcion: "Presentar informe comparativo de precios del mercado",
      categoria: "reunion",
      prioridad: "alta",
      estado: "pendiente",
      fecha_vencimiento: addDays(hoy, 4),
      fecha_completada: null,
      contacto_ref: "Silvia Fernández",
      propiedad_ref: "PH 3 amb, Av. Pellegrini 1900, Centro",
      recordatorio: true,
      created_at: addDays(hoy, -1) + "T08:00:00Z",
      updated_at: addDays(hoy, -1) + "T08:00:00Z",
    },
    {
      id: "t7",
      titulo: "Seguimiento oferta Martínez - Departamento Pichincha",
      descripcion: "Verificar respuesta de contrapropuesta",
      categoria: "seguimiento",
      prioridad: "urgente",
      estado: "pendiente",
      fecha_vencimiento: addDays(hoy, -2),
      fecha_completada: null,
      contacto_ref: "Guillermo Martínez",
      propiedad_ref: "Depto 3 amb, San Luis 2100, Nueva Córdoba",
      recordatorio: true,
      created_at: addDays(hoy, -7) + "T16:00:00Z",
      updated_at: addDays(hoy, -3) + "T16:00:00Z",
    },
    {
      id: "t8",
      titulo: "Enviar reporte mensual de actividades a la inmobiliaria",
      descripcion: "Consolidar operaciones del mes, comisiones y pipeline",
      categoria: "admin",
      prioridad: "media",
      estado: "completada",
      fecha_vencimiento: addDays(hoy, -5),
      fecha_completada: addDays(hoy, -5),
      contacto_ref: "",
      propiedad_ref: "",
      recordatorio: false,
      created_at: addDays(hoy, -10) + "T09:00:00Z",
      updated_at: addDays(hoy, -5) + "T18:00:00Z",
    },
  ];
}

// ─── Modal Form ───────────────────────────────────────────────────────────────

interface FormData {
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  prioridad: Prioridad;
  estado: Estado;
  fecha_vencimiento: string;
  contacto_ref: string;
  propiedad_ref: string;
  recordatorio: boolean;
}

const FORM_VACIO: FormData = {
  titulo: "",
  descripcion: "",
  categoria: "llamada",
  prioridad: "media",
  estado: "pendiente",
  fecha_vencimiento: "",
  contacto_ref: "",
  propiedad_ref: "",
  recordatorio: false,
};

interface ModalProps {
  tarea: Tarea | null; // null = nueva
  onClose: () => void;
  onSave: (t: Tarea) => void;
  onDelete: (id: string) => void;
  initialData?: Partial<FormData>;
}

function ModalTarea({ tarea, onClose, onSave, onDelete, initialData }: ModalProps) {
  const [form, setForm] = useState<FormData>(() => {
    if (tarea) {
      return {
        titulo: tarea.titulo,
        descripcion: tarea.descripcion,
        categoria: tarea.categoria,
        prioridad: tarea.prioridad,
        estado: tarea.estado,
        fecha_vencimiento: tarea.fecha_vencimiento ?? "",
        contacto_ref: tarea.contacto_ref,
        propiedad_ref: tarea.propiedad_ref,
        recordatorio: tarea.recordatorio,
      };
    }
    return { ...FORM_VACIO, ...initialData };
  });
  const [error, setError] = useState("");

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleGuardar() {
    if (!form.titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    const now = new Date().toISOString();
    const nueva: Tarea = tarea
      ? {
          ...tarea,
          ...form,
          fecha_vencimiento: form.fecha_vencimiento || null,
          fecha_completada:
            form.estado === "completada" && !tarea.fecha_completada
              ? isoHoy()
              : tarea.fecha_completada,
          updated_at: now,
        }
      : {
          id: crypto.randomUUID(),
          ...form,
          fecha_vencimiento: form.fecha_vencimiento || null,
          fecha_completada: form.estado === "completada" ? isoHoy() : null,
          created_at: now,
          updated_at: now,
        };
    onSave(nueva);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#111111",
          border: "1px solid #222222",
          borderRadius: "10px",
          padding: "28px",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            fontSize: "18px",
            color: "#e0e0e0",
            margin: "0 0 20px",
          }}
        >
          {tarea ? "Editar tarea" : "Nueva tarea"}
        </h2>

        {/* Título */}
        <label style={labelStyle}>Título *</label>
        <input
          style={inputStyle}
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Ej: Llamar a García..."
        />

        {/* Descripción */}
        <label style={labelStyle}>Descripción</label>
        <textarea
          style={{ ...inputStyle, height: "72px", resize: "vertical" }}
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          placeholder="Detalles adicionales..."
        />

        {/* Fila: categoría + prioridad */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Categoría</label>
            <select
              style={inputStyle}
              value={form.categoria}
              onChange={(e) => set("categoria", e.target.value as Categoria)}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_EMOJI[c]} {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Prioridad</label>
            <select
              style={inputStyle}
              value={form.prioridad}
              onChange={(e) => set("prioridad", e.target.value as Prioridad)}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {PRIORIDAD_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila: estado + fecha */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Estado</label>
            <select
              style={inputStyle}
              value={form.estado}
              onChange={(e) => set("estado", e.target.value as Estado)}
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {ESTADO_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Fecha de vencimiento</label>
            <input
              style={inputStyle}
              type="date"
              value={form.fecha_vencimiento}
              onChange={(e) => set("fecha_vencimiento", e.target.value)}
            />
          </div>
        </div>

        {/* Contacto + propiedad */}
        <label style={labelStyle}>Contacto de referencia</label>
        <input
          style={inputStyle}
          value={form.contacto_ref}
          onChange={(e) => set("contacto_ref", e.target.value)}
          placeholder="Nombre del contacto..."
        />

        <label style={labelStyle}>Propiedad de referencia</label>
        <input
          style={inputStyle}
          value={form.propiedad_ref}
          onChange={(e) => set("propiedad_ref", e.target.value)}
          placeholder="Descripción de la propiedad..."
        />

        {/* Recordatorio */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#aaaaaa",
            fontSize: "14px",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          <input
            type="checkbox"
            checked={form.recordatorio}
            onChange={(e) => set("recordatorio", e.target.checked)}
            style={{ accentColor: "#cc0000" }}
          />
          Activar recordatorio
        </label>

        {error && (
          <p style={{ color: "#cc0000", fontSize: "13px", marginBottom: "12px", fontFamily: "Inter, sans-serif" }}>
            {error}
          </p>
        )}

        {/* Botones */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          {tarea && (
            <button
              style={btnDanger}
              onClick={() => {
                onDelete(tarea.id);
                onClose();
              }}
            >
              Eliminar
            </button>
          )}
          <button style={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button style={btnPrimary} onClick={handleGuardar}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Estilos reutilizables ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "#777777",
  fontFamily: "Inter, sans-serif",
  marginBottom: "4px",
  marginTop: "14px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid #333333",
  borderRadius: "6px",
  color: "#e0e0e0",
  fontFamily: "Inter, sans-serif",
  fontSize: "14px",
  padding: "9px 12px",
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  background: "#cc0000",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "9px 20px",
  fontFamily: "Inter, sans-serif",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  background: "#222222",
  color: "#e0e0e0",
  border: "1px solid #333333",
  borderRadius: "6px",
  padding: "9px 20px",
  fontFamily: "Inter, sans-serif",
  fontSize: "14px",
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  background: "transparent",
  color: "#cc0000",
  border: "1px solid #cc0000",
  borderRadius: "6px",
  padding: "9px 20px",
  fontFamily: "Inter, sans-serif",
  fontSize: "14px",
  cursor: "pointer",
};

// ─── Componente tarjeta tarea ─────────────────────────────────────────────────

interface TareaCardProps {
  tarea: Tarea;
  onToggle: (id: string) => void;
  onEdit: (t: Tarea) => void;
  mostrarCheckbox?: boolean;
}

function TareaCard({ tarea, onToggle, onEdit, mostrarCheckbox = true }: TareaCardProps) {
  const vencida = esFechaPasada(tarea.fecha_vencimiento) && tarea.estado !== "completada" && tarea.estado !== "cancelada";
  const completada = tarea.estado === "completada";

  const borderLeft = vencida
    ? "3px solid #cc0000"
    : tarea.prioridad === "urgente"
    ? "3px solid #f97316"
    : "3px solid #333333";

  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #222222",
        borderLeft,
        borderRadius: "8px",
        padding: "12px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        opacity: completada ? 0.55 : 1,
        cursor: "pointer",
        transition: "opacity 0.2s",
      }}
      onClick={() => onEdit(tarea)}
    >
      {mostrarCheckbox && (
        <div
          style={{ marginTop: "2px", flexShrink: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(tarea.id);
          }}
        >
          <div
            style={{
              width: "18px",
              height: "18px",
              border: completada ? "2px solid #cc0000" : "2px solid #444444",
              borderRadius: "4px",
              background: completada ? "#cc0000" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {completada && (
              <span style={{ color: "#fff", fontSize: "11px", fontWeight: 700 }}>✓</span>
            )}
          </div>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "14px" }}>{CATEGORIA_EMOJI[tarea.categoria]}</span>
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              color: "#e0e0e0",
              textDecoration: completada ? "line-through" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "340px",
            }}
          >
            {tarea.titulo}
          </span>
          <span
            style={{
              background: PRIORIDAD_COLOR[tarea.prioridad] + "33",
              color: PRIORIDAD_COLOR[tarea.prioridad],
              border: `1px solid ${PRIORIDAD_COLOR[tarea.prioridad]}55`,
              borderRadius: "4px",
              fontSize: "10px",
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              padding: "1px 7px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              flexShrink: 0,
            }}
          >
            {PRIORIDAD_LABEL[tarea.prioridad]}
          </span>
          {tarea.recordatorio && (
            <span style={{ fontSize: "12px" }} title="Recordatorio activo">🔔</span>
          )}
        </div>
        <div
          style={{
            marginTop: "5px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {tarea.contacto_ref && (
            <span style={{ fontSize: "12px", color: "#777777", fontFamily: "Inter, sans-serif" }}>
              👤 {tarea.contacto_ref}
            </span>
          )}
          {tarea.propiedad_ref && (
            <span style={{ fontSize: "12px", color: "#777777", fontFamily: "Inter, sans-serif" }}>
              🏠 {tarea.propiedad_ref}
            </span>
          )}
          {tarea.fecha_vencimiento && (
            <span
              style={{
                fontSize: "12px",
                fontFamily: "Inter, sans-serif",
                color: vencida ? "#cc0000" : "#aaaaaa",
                fontWeight: vencida ? 700 : 400,
              }}
            >
              📅 {formatFecha(tarea.fecha_vencimiento)}
              {vencida && " — VENCIDA"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Tareas del día ──────────────────────────────────────────────────────

interface TabHoyProps {
  tareas: Tarea[];
  onToggle: (id: string) => void;
  onEdit: (t: Tarea) => void;
  onNueva: (partial?: Partial<FormData>) => void;
}

function TabHoy({ tareas, onToggle, onEdit, onNueva }: TabHoyProps) {
  const [busqueda, setBusqueda] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(busqueda), 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  const activas = useMemo(
    () =>
      tareas.filter(
        (t) => t.estado !== "completada" && t.estado !== "cancelada"
      ),
    [tareas]
  );

  const vencidas = useMemo(
    () => activas.filter((t) => esFechaPasada(t.fecha_vencimiento)),
    [activas]
  );
  const hoy = useMemo(
    () => activas.filter((t) => esFechaHoy(t.fecha_vencimiento)),
    [activas]
  );
  const proximas = useMemo(
    () => activas.filter((t) => esFechaEnProximos7(t.fecha_vencimiento)),
    [activas]
  );

  const urgentesEstaSemana = useMemo(
    () =>
      activas.filter(
        (t) =>
          t.prioridad === "urgente" && esFechaEstaSemana(t.fecha_vencimiento)
      ),
    [activas]
  );

  function filtrar(lista: Tarea[]): Tarea[] {
    if (!debouncedQ) return lista;
    const q = debouncedQ.toLowerCase();
    return lista.filter(
      (t) =>
        t.titulo.toLowerCase().includes(q) ||
        t.contacto_ref.toLowerCase().includes(q) ||
        t.propiedad_ref.toLowerCase().includes(q)
    );
  }

  return (
    <div>
      {/* Banner de alertas */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        {vencidas.length > 0 && (
          <span
            style={{
              background: "#cc000033",
              color: "#cc0000",
              border: "1px solid #cc000055",
              borderRadius: "20px",
              padding: "5px 14px",
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
            }}
          >
            🚨 {vencidas.length} vencida{vencidas.length !== 1 ? "s" : ""}
          </span>
        )}
        {hoy.length > 0 && (
          <span
            style={{
              background: "#f9731633",
              color: "#f97316",
              border: "1px solid #f9731655",
              borderRadius: "20px",
              padding: "5px 14px",
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
            }}
          >
            ⏰ {hoy.length} para hoy
          </span>
        )}
        {urgentesEstaSemana.length > 0 && (
          <span
            style={{
              background: "#eab30833",
              color: "#eab308",
              border: "1px solid #eab30855",
              borderRadius: "20px",
              padding: "5px 14px",
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
            }}
          >
            ⚡ {urgentesEstaSemana.length} urgente{urgentesEstaSemana.length !== 1 ? "s" : ""} esta semana
          </span>
        )}
        {vencidas.length === 0 && hoy.length === 0 && urgentesEstaSemana.length === 0 && (
          <span
            style={{
              background: "#1a3a1a",
              color: "#4ade80",
              border: "1px solid #4ade8055",
              borderRadius: "20px",
              padding: "5px 14px",
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
            }}
          >
            ✅ Todo al día
          </span>
        )}
      </div>

      {/* Buscador */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
        <input
          style={{ ...inputStyle, maxWidth: "340px" }}
          placeholder="Buscar tarea, contacto, propiedad..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button
          style={btnPrimary}
          onClick={() => onNueva()}
        >
          + Agregar tarea rápida
        </button>
      </div>

      {/* Sección: Vencidas */}
      {filtrar(vencidas).length > 0 && (
        <SeccionTareas
          titulo="VENCIDAS"
          tareas={filtrar(vencidas)}
          bgHeader="#3a0a0a"
          onToggle={onToggle}
          onEdit={onEdit}
        />
      )}

      {/* Sección: Hoy */}
      {filtrar(hoy).length > 0 && (
        <SeccionTareas
          titulo="HOY"
          tareas={filtrar(hoy)}
          bgHeader="#1a1a0a"
          onToggle={onToggle}
          onEdit={onEdit}
        />
      )}

      {/* Sección: Próximas */}
      {filtrar(proximas).length > 0 && (
        <SeccionTareas
          titulo="PRÓXIMAS (7 días)"
          tareas={filtrar(proximas)}
          bgHeader="#0d0d1a"
          onToggle={onToggle}
          onEdit={onEdit}
        />
      )}

      {filtrar(vencidas).length === 0 &&
        filtrar(hoy).length === 0 &&
        filtrar(proximas).length === 0 && (
          <p
            style={{
              color: "#555555",
              textAlign: "center",
              fontFamily: "Inter, sans-serif",
              marginTop: "40px",
            }}
          >
            No hay tareas para mostrar.
          </p>
        )}
    </div>
  );
}

interface SeccionProps {
  titulo: string;
  tareas: Tarea[];
  bgHeader: string;
  onToggle: (id: string) => void;
  onEdit: (t: Tarea) => void;
}

function SeccionTareas({ titulo, tareas, bgHeader, onToggle, onEdit }: SeccionProps) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          background: bgHeader,
          borderRadius: "6px 6px 0 0",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: "11px",
            color: "#aaaaaa",
            letterSpacing: "0.1em",
          }}
        >
          {titulo}
        </span>
        <span
          style={{
            background: "#333333",
            color: "#888888",
            borderRadius: "10px",
            fontSize: "11px",
            padding: "1px 8px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {tareas.length}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          padding: "8px 0",
        }}
      >
        {tareas.map((t) => (
          <TareaCard
            key={t.id}
            tarea={t}
            onToggle={onToggle}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Kanban ──────────────────────────────────────────────────────────────

interface TabKanbanProps {
  tareas: Tarea[];
  onMover: (id: string, nuevoEstado: Estado) => void;
  onEdit: (t: Tarea) => void;
  onNueva: () => void;
}

function TabKanban({ tareas, onMover, onEdit, onNueva }: TabKanbanProps) {
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | "todas">("todas");

  const tareasFiltradas = useMemo(
    () =>
      filtroCategoria === "todas"
        ? tareas
        : tareas.filter((t) => t.categoria === filtroCategoria),
    [tareas, filtroCategoria]
  );

  const columnas: { estado: Estado; label: string; color: string }[] = [
    { estado: "pendiente", label: "Pendiente", color: "#555555" },
    { estado: "en_proceso", label: "En proceso", color: "#3b82f6" },
    { estado: "completada", label: "Completada", color: "#22c55e" },
    { estado: "cancelada", label: "Cancelada", color: "#6b7280" },
  ];

  return (
    <div>
      {/* Filtros de categoría */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <PillFiltro
          label="Todas"
          activo={filtroCategoria === "todas"}
          onClick={() => setFiltroCategoria("todas")}
        />
        {CATEGORIAS.map((c) => (
          <PillFiltro
            key={c}
            label={`${CATEGORIA_EMOJI[c]} ${CATEGORIA_LABEL[c]}`}
            activo={filtroCategoria === c}
            onClick={() => setFiltroCategoria(c)}
          />
        ))}
        <button style={{ ...btnPrimary, marginLeft: "auto" }} onClick={onNueva}>
          + Nueva tarea
        </button>
      </div>

      {/* Columnas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          alignItems: "start",
        }}
      >
        {columnas.map(({ estado, label, color }) => {
          const col = tareasFiltradas.filter((t) => t.estado === estado);
          const idx = ESTADO_ORDER.indexOf(estado);
          return (
            <div key={estado}>
              {/* Header columna */}
              <div
                style={{
                  background: "#111111",
                  border: "1px solid #222222",
                  borderTop: `3px solid ${color}`,
                  borderRadius: "8px 8px 0 0",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: "#e0e0e0",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    background: color + "33",
                    color,
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "1px 8px",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {col.length}
                </span>
              </div>
              {/* Cards */}
              <div
                style={{
                  background: "#0d0d0d",
                  border: "1px solid #1a1a1a",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minHeight: "80px",
                }}
              >
                {col.length === 0 && (
                  <p
                    style={{
                      color: "#333333",
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                      textAlign: "center",
                      margin: "10px 0",
                    }}
                  >
                    Sin tareas
                  </p>
                )}
                {col.map((t) => (
                  <KanbanCard
                    key={t.id}
                    tarea={t}
                    idxEstado={idx}
                    totalEstados={ESTADO_ORDER.length}
                    onMover={onMover}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface KanbanCardProps {
  tarea: Tarea;
  idxEstado: number;
  totalEstados: number;
  onMover: (id: string, estado: Estado) => void;
  onEdit: (t: Tarea) => void;
}

function KanbanCard({ tarea, idxEstado, totalEstados, onMover, onEdit }: KanbanCardProps) {
  const vencida =
    esFechaPasada(tarea.fecha_vencimiento) &&
    tarea.estado !== "completada" &&
    tarea.estado !== "cancelada";
  const borderLeft =
    vencida
      ? "3px solid #cc0000"
      : tarea.prioridad === "urgente"
      ? "3px solid #f97316"
      : "3px solid #222222";

  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #222222",
        borderLeft,
        borderRadius: "6px",
        padding: "10px 12px",
        cursor: "pointer",
      }}
      onClick={() => onEdit(tarea)}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "13px",
          fontWeight: 600,
          color: "#e0e0e0",
          marginBottom: "6px",
          lineHeight: "1.3",
        }}
      >
        {CATEGORIA_EMOJI[tarea.categoria]} {tarea.titulo}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span
          style={{
            background: PRIORIDAD_COLOR[tarea.prioridad] + "33",
            color: PRIORIDAD_COLOR[tarea.prioridad],
            border: `1px solid ${PRIORIDAD_COLOR[tarea.prioridad]}55`,
            borderRadius: "4px",
            fontSize: "10px",
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            padding: "1px 6px",
          }}
        >
          {PRIORIDAD_LABEL[tarea.prioridad]}
        </span>
        {tarea.fecha_vencimiento && (
          <span
            style={{
              fontSize: "11px",
              color: vencida ? "#cc0000" : "#666666",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {formatFecha(tarea.fecha_vencimiento)}
          </span>
        )}
      </div>
      {/* Botones mover */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginTop: "8px",
          justifyContent: "flex-end",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {idxEstado > 0 && (
          <button
            style={{
              background: "#222222",
              border: "1px solid #333333",
              borderRadius: "4px",
              color: "#aaaaaa",
              fontSize: "11px",
              padding: "2px 8px",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
            onClick={() => onMover(tarea.id, ESTADO_ORDER[idxEstado - 1])}
            title={`Mover a ${ESTADO_LABEL[ESTADO_ORDER[idxEstado - 1]]}`}
          >
            ← {ESTADO_LABEL[ESTADO_ORDER[idxEstado - 1]]}
          </button>
        )}
        {idxEstado < totalEstados - 1 && (
          <button
            style={{
              background: "#222222",
              border: "1px solid #333333",
              borderRadius: "4px",
              color: "#aaaaaa",
              fontSize: "11px",
              padding: "2px 8px",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
            onClick={() => onMover(tarea.id, ESTADO_ORDER[idxEstado + 1])}
            title={`Mover a ${ESTADO_LABEL[ESTADO_ORDER[idxEstado + 1]]}`}
          >
            {ESTADO_LABEL[ESTADO_ORDER[idxEstado + 1]]} →
          </button>
        )}
      </div>
    </div>
  );
}

function PillFiltro({
  label,
  activo,
  onClick,
}: {
  label: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: activo ? "#cc0000" : "#1a1a1a",
        color: activo ? "#fff" : "#aaaaaa",
        border: activo ? "1px solid #cc0000" : "1px solid #333333",
        borderRadius: "20px",
        padding: "5px 14px",
        fontSize: "12px",
        fontFamily: "Inter, sans-serif",
        fontWeight: activo ? 700 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ─── Tab: Historial y estadísticas ─────────────────────────────────────────────

interface TabHistorialProps {
  tareas: Tarea[];
}

function TabHistorial({ tareas }: TabHistorialProps) {
  const completadas = useMemo(
    () => tareas.filter((t) => t.estado === "completada"),
    [tareas]
  );

  const mesActual = isoHoy().slice(0, 7);

  const completadasEsteMes = useMemo(
    () =>
      completadas.filter(
        (t) => t.fecha_completada && t.fecha_completada.startsWith(mesActual)
      ),
    [completadas, mesActual]
  );

  const tasaCompletitud = tareas.length > 0 ? Math.round((completadas.length / tareas.length) * 100) : 0;

  const promedioDias = useMemo(() => {
    const conDias = completadas.filter(
      (t) => t.fecha_completada && t.created_at
    );
    if (conDias.length === 0) return 0;
    const total = conDias.reduce(
      (acc, t) =>
        acc +
        diasDiferencia(
          t.created_at.slice(0, 10),
          t.fecha_completada!
        ),
      0
    );
    return Math.round(total / conDias.length);
  }, [completadas]);

  const categoriaMasFrecuente = useMemo(() => {
    if (tareas.length === 0) return "—";
    const freq: Partial<Record<Categoria, number>> = {};
    for (const t of tareas) {
      freq[t.categoria] = (freq[t.categoria] ?? 0) + 1;
    }
    let max = 0;
    let cat: Categoria = "otro";
    for (const [k, v] of Object.entries(freq) as [Categoria, number][]) {
      if (v > max) {
        max = v;
        cat = k;
      }
    }
    return `${CATEGORIA_EMOJI[cat]} ${CATEGORIA_LABEL[cat]}`;
  }, [tareas]);

  // Semanas para el gráfico
  const semanas = useMemo(() => {
    const result: { label: string; iso: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const iso = semanaISO(addDays(isoHoy(), -i * 7));
      const fin = addDays(iso, 6);
      result.push({
        label: `${formatFecha(iso).slice(0, 5)}`,
        iso,
        count: completadas.filter(
          (t) =>
            t.fecha_completada &&
            t.fecha_completada >= iso &&
            t.fecha_completada <= fin
        ).length,
      });
    }
    return result;
  }, [completadas]);

  const maxCount = Math.max(...semanas.map((s) => s.count), 1);

  // Tabla ultimas 20 completadas
  const ultimasCompletadas = useMemo(
    () =>
      [...completadas]
        .sort((a, b) =>
          (b.fecha_completada ?? "").localeCompare(a.fecha_completada ?? "")
        )
        .slice(0, 20),
    [completadas]
  );

  return (
    <div>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "14px",
          marginBottom: "32px",
        }}
      >
        <KpiCard
          titulo="Completadas este mes"
          valor={String(completadasEsteMes.length)}
          sub="tareas"
        />
        <KpiCard
          titulo="Tasa de completitud"
          valor={`${tasaCompletitud}%`}
          sub={`${completadas.length} de ${tareas.length}`}
        />
        <KpiCard
          titulo="Promedio días"
          valor={String(promedioDias)}
          sub="días para completar"
        />
        <KpiCard
          titulo="Categoría frecuente"
          valor={categoriaMasFrecuente}
          sub="más usada"
        />
      </div>

      {/* Gráfico de barras SVG */}
      <div
        style={{
          background: "#111111",
          border: "1px solid #222222",
          borderRadius: "10px",
          padding: "20px 24px",
          marginBottom: "28px",
          overflowX: "auto",
        }}
      >
        <h3
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: "14px",
            color: "#e0e0e0",
            margin: "0 0 16px",
          }}
        >
          Tareas completadas por semana (últimas 8 semanas)
        </h3>
        <svg
          width="700"
          height="260"
          viewBox="0 0 700 260"
          style={{ display: "block", maxWidth: "100%" }}
        >
          {/* Grilla horizontal */}
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 200 - (i * 160) / 4;
            return (
              <g key={i}>
                <line
                  x1={40}
                  y1={y}
                  x2={680}
                  y2={y}
                  stroke="#222222"
                  strokeWidth={1}
                />
                <text
                  x={34}
                  y={y + 4}
                  fill="#555555"
                  fontSize={11}
                  textAnchor="end"
                  fontFamily="Inter, sans-serif"
                >
                  {Math.round((maxCount * i) / 4)}
                </text>
              </g>
            );
          })}

          {/* Barras */}
          {semanas.map((s, i) => {
            const barW = 54;
            const gap = (640 - semanas.length * barW) / (semanas.length + 1);
            const x = 40 + gap + i * (barW + gap);
            const barH = maxCount > 0 ? (s.count / maxCount) * 160 : 0;
            const y = 200 - barH;
            return (
              <g key={s.iso}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  fill="#cc0000"
                  rx={3}
                  opacity={0.85}
                />
                {/* número encima */}
                {s.count > 0 && (
                  <text
                    x={x + barW / 2}
                    y={y - 5}
                    fill="#e0e0e0"
                    fontSize={12}
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    fontWeight="bold"
                  >
                    {s.count}
                  </text>
                )}
                {/* label fecha */}
                <text
                  x={x + barW / 2}
                  y={220}
                  fill="#666666"
                  fontSize={10}
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                >
                  {s.label}
                </text>
              </g>
            );
          })}

          {/* Eje X base */}
          <line x1={40} y1={200} x2={680} y2={200} stroke="#333333" strokeWidth={1} />
        </svg>
      </div>

      {/* Tabla */}
      <div
        style={{
          background: "#111111",
          border: "1px solid #222222",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #222222",
          }}
        >
          <h3
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: "14px",
              color: "#e0e0e0",
              margin: 0,
            }}
          >
            Últimas tareas completadas
          </h3>
        </div>
        {ultimasCompletadas.length === 0 ? (
          <p
            style={{
              color: "#555555",
              textAlign: "center",
              fontFamily: "Inter, sans-serif",
              padding: "30px",
            }}
          >
            Sin tareas completadas todavía.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ background: "#0d0d0d" }}>
                  {["Título", "Categoría", "Creada", "Completada", "Días"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          textAlign: "left",
                          color: "#666666",
                          fontWeight: 600,
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {ultimasCompletadas.map((t, i) => (
                  <tr
                    key={t.id}
                    style={{
                      background: i % 2 === 0 ? "transparent" : "#0d0d0d",
                      borderTop: "1px solid #1a1a1a",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#e0e0e0",
                        maxWidth: "240px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.titulo}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#aaaaaa", whiteSpace: "nowrap" }}>
                      {CATEGORIA_EMOJI[t.categoria]} {CATEGORIA_LABEL[t.categoria]}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#666666", whiteSpace: "nowrap" }}>
                      {formatFecha(t.created_at.slice(0, 10))}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#666666", whiteSpace: "nowrap" }}>
                      {formatFecha(t.fecha_completada)}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#4ade80", fontWeight: 700 }}>
                      {t.fecha_completada
                        ? diasDiferencia(t.created_at.slice(0, 10), t.fecha_completada)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  sub,
}: {
  titulo: string;
  valor: string;
  sub: string;
}) {
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #222222",
        borderRadius: "10px",
        padding: "18px 20px",
      }}
    >
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          color: "#666666",
          margin: "0 0 8px",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {titulo}
      </p>
      <p
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 800,
          fontSize: "26px",
          color: "#e0e0e0",
          margin: "0 0 4px",
          lineHeight: 1,
        }}
      >
        {valor}
      </p>
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          color: "#555555",
          margin: 0,
        }}
      >
        {sub}
      </p>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function GestionTareasPage() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [tab, setTab] = useState<Tab>("hoy");
  const [modalOpen, setModalOpen] = useState(false);
  const [tareaEditando, setTareaEditando] = useState<Tarea | null>(null);
  const [initialForm, setInitialForm] = useState<Partial<FormData>>({});
  const [loaded, setLoaded] = useState(false);

  // Cargar desde localStorage
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (raw) {
      try {
        setTareas(JSON.parse(raw) as Tarea[]);
      } catch {
        setTareas(generarEjemplos());
      }
    } else {
      const ejemplos = generarEjemplos();
      setTareas(ejemplos);
      localStorage.setItem(LS_KEY, JSON.stringify(ejemplos));
    }
    setLoaded(true);
  }, []);

  // Persistir
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(LS_KEY, JSON.stringify(tareas));
    }
  }, [tareas, loaded]);

  const guardarTarea = useCallback((t: Tarea) => {
    setTareas((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = t;
        return copy;
      }
      return [t, ...prev];
    });
    setModalOpen(false);
    setTareaEditando(null);
  }, []);

  const eliminarTarea = useCallback((id: string) => {
    setTareas((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleCompletada = useCallback((id: string) => {
    const now = new Date().toISOString();
    setTareas((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const yaCompletada = t.estado === "completada";
        return {
          ...t,
          estado: yaCompletada ? "pendiente" : "completada",
          fecha_completada: yaCompletada ? null : isoHoy(),
          updated_at: now,
        };
      })
    );
  }, []);

  const moverEstado = useCallback((id: string, nuevoEstado: Estado) => {
    const now = new Date().toISOString();
    setTareas((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          estado: nuevoEstado,
          fecha_completada:
            nuevoEstado === "completada" && !t.fecha_completada
              ? isoHoy()
              : nuevoEstado !== "completada"
              ? null
              : t.fecha_completada,
          updated_at: now,
        };
      })
    );
  }, []);

  function abrirNueva(partial?: Partial<FormData>) {
    setTareaEditando(null);
    setInitialForm(partial ?? {});
    setModalOpen(true);
  }

  function abrirEditar(t: Tarea) {
    setTareaEditando(t);
    setInitialForm({});
    setModalOpen(true);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "hoy", label: "📋 Tareas del día" },
    { id: "kanban", label: "🗂 Kanban" },
    { id: "historial", label: "📊 Historial" },
  ];

  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        padding: "28px 20px",
        maxWidth: "1200px",
        margin: "0 auto",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Encabezado */}
      <div style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            fontSize: "26px",
            color: "#e0e0e0",
            margin: "0 0 6px",
            letterSpacing: "-0.01em",
          }}
        >
          Gestión de Tareas
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#555555",
            margin: 0,
            fontFamily: "Inter, sans-serif",
          }}
        >
          To-do profesional integrado con el flujo inmobiliario
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          borderBottom: "1px solid #222222",
          marginBottom: "28px",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom:
                tab === t.id ? "2px solid #cc0000" : "2px solid transparent",
              color: tab === t.id ? "#e0e0e0" : "#555555",
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              fontWeight: tab === t.id ? 600 : 400,
              padding: "10px 16px",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === "hoy" && (
        <TabHoy
          tareas={tareas}
          onToggle={toggleCompletada}
          onEdit={abrirEditar}
          onNueva={abrirNueva}
        />
      )}
      {tab === "kanban" && (
        <TabKanban
          tareas={tareas}
          onMover={moverEstado}
          onEdit={abrirEditar}
          onNueva={() => abrirNueva()}
        />
      )}
      {tab === "historial" && <TabHistorial tareas={tareas} />}

      {/* Modal */}
      {modalOpen && (
        <ModalTarea
          tarea={tareaEditando}
          initialData={initialForm}
          onClose={() => {
            setModalOpen(false);
            setTareaEditando(null);
          }}
          onSave={guardarTarea}
          onDelete={eliminarTarea}
        />
      )}
    </div>
  );
}
