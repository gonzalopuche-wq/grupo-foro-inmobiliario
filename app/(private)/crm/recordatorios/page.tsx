"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoRecordatorio =
  | "manual"
  | "auto_inactividad"
  | "auto_cumpleanos"
  | "auto_vencimiento_contrato"
  | "auto_seguimiento_tasacion";

type PrioridadRecordatorio = "alta" | "media" | "baja";
type EstadoRecordatorio = "pendiente" | "completado" | "ignorado";

interface Recordatorio {
  id: string;
  tipo: TipoRecordatorio;
  titulo: string;
  descripcion: string;
  fecha: string; // YYYY-MM-DD
  prioridad: PrioridadRecordatorio;
  estado: EstadoRecordatorio;
  contacto_id?: string;
  negocio_id?: string;
  contacto_nombre?: string;
  negocio_titulo?: string;
  created_at: string;
}

// ─── Supabase raw shapes (narrow) ─────────────────────────────────────────────

interface ContactoInactivo {
  id: string;
  nombre: string;
  apellido: string;
  updated_at: string;
}

interface ContactoCumple {
  id: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string | null;
}

interface NegocioRaw {
  id: string;
  titulo: string;
  etapa: string;
  updated_at: string;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "crm_recordatorios_v1";
const IGNORADOS_KEY = "crm_recordatorios_ignorados_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoyStr(): string {
  return new Date().toISOString().split("T")[0];
}

function mananaStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function fmtFecha(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function proximoCumpleAnios(fechaNacimiento: string): Date {
  const hoy = new Date();
  const parts = fechaNacimiento.split("-").map(Number);
  const mm = parts[1];
  const dd = parts[2];
  let proxAnio = new Date(hoy.getFullYear(), mm - 1, dd);
  if (proxAnio < hoy) proxAnio.setFullYear(hoy.getFullYear() + 1);
  return proxAnio;
}

function prioridadColor(p: PrioridadRecordatorio): string {
  if (p === "alta") return "#cc0000";
  if (p === "media") return "#eab308";
  return "#3b82f6";
}

function tipoLabel(t: TipoRecordatorio): string {
  const map: Record<TipoRecordatorio, string> = {
    manual: "Manual",
    auto_inactividad: "Inactividad",
    auto_cumpleanos: "Cumpleaños",
    auto_vencimiento_contrato: "Vencimiento",
    auto_seguimiento_tasacion: "Seguimiento",
  };
  return map[t];
}

function tipoColor(t: TipoRecordatorio): string {
  if (t === "auto_inactividad") return "#3b82f6";
  if (t === "auto_cumpleanos") return "#a855f7";
  if (t === "auto_seguimiento_tasacion") return "#cc0000";
  if (t === "auto_vencimiento_contrato") return "#f97316";
  return "#6b7280";
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

function cargarManuales(): Recordatorio[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Recordatorio[];
  } catch {
    return [];
  }
}

function guardarManuales(list: Recordatorio[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function cargarIgnorados(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORADOS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function guardarIgnorados(s: Set<string>): void {
  localStorage.setItem(IGNORADOS_KEY, JSON.stringify([...s]));
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  titulo: string;
  descripcion: string;
  fecha: string;
  prioridad: PrioridadRecordatorio;
  contacto_nombre: string;
  negocio_titulo: string;
}

const FORM_VACIO: FormState = {
  titulo: "",
  descripcion: "",
  fecha: mananaStr(),
  prioridad: "media",
  contacto_nombre: "",
  negocio_titulo: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecordatoriosPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [tab, setTab] = useState<"pendientes" | "crear" | "historial">("pendientes");
  const [manuales, setManuales] = useState<Recordatorio[]>([]);
  const [autos, setAutos] = useState<Recordatorio[]>([]);
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Alert generation ──────────────────────────────────────────────────────

  const generarAlertas = useCallback(async (userId: string): Promise<Recordatorio[]> => {
    const hoy = new Date().toISOString().split("T")[0];
    const hace30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const hace7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const hace5 = new Date(Date.now() - 5 * 86400000).toISOString();

    const [
      { data: inactivosRaw },
      { data: contactosConFechaRaw },
      { data: prospectosPasivosRaw },
      { data: negociacionesPasivasRaw },
    ] = await Promise.all([
      supabase
        .from("crm_contactos")
        .select("id, nombre, apellido, updated_at")
        .eq("perfil_id", userId)
        .neq("estado", "archivado")
        .lt("updated_at", hace30)
        .limit(20),
      supabase
        .from("crm_contactos")
        .select("id, nombre, apellido, fecha_nacimiento")
        .eq("perfil_id", userId)
        .not("fecha_nacimiento", "is", null)
        .limit(200),
      supabase
        .from("crm_negocios")
        .select("id, titulo, etapa, updated_at")
        .eq("perfil_id", userId)
        .eq("etapa", "prospecto")
        .lt("updated_at", hace7)
        .limit(10),
      supabase
        .from("crm_negocios")
        .select("id, titulo, etapa, updated_at")
        .eq("perfil_id", userId)
        .eq("etapa", "negociacion")
        .lt("updated_at", hace5)
        .limit(10),
    ]);

    const inactivos = (inactivosRaw ?? []) as ContactoInactivo[];
    const contactosConFecha = (contactosConFechaRaw ?? []) as ContactoCumple[];
    const prospectosPasivos = (prospectosPasivosRaw ?? []) as NegocioRaw[];
    const negociacionesPasivas = (negociacionesPasivasRaw ?? []) as NegocioRaw[];

    const alertas: Recordatorio[] = [];
    const nowIso = new Date().toISOString();

    // 1. Contactos inactivos
    for (const c of inactivos) {
      const nombre = `${c.nombre} ${c.apellido}`;
      alertas.push({
        id: `auto_inactividad_${c.id}`,
        tipo: "auto_inactividad",
        titulo: `Sin contacto con ${nombre}`,
        descripcion: "No contactaste a este cliente en más de 30 días",
        fecha: hoy,
        prioridad: "baja",
        estado: "pendiente",
        contacto_id: c.id,
        contacto_nombre: nombre,
        created_at: nowIso,
      });
    }

    // 2. Cumpleaños próximos
    const hoyDate = new Date();
    hoyDate.setHours(0, 0, 0, 0);
    for (const c of contactosConFecha) {
      if (!c.fecha_nacimiento) continue;
      const prox = proximoCumpleAnios(c.fecha_nacimiento);
      const diffMs = prox.getTime() - hoyDate.getTime();
      const diffDias = Math.ceil(diffMs / 86400000);
      if (diffDias >= 0 && diffDias <= 7) {
        const nombre = `${c.nombre} ${c.apellido}`;
        const fechaCump = prox.toISOString().split("T")[0];
        alertas.push({
          id: `auto_cumpleanos_${c.id}`,
          tipo: "auto_cumpleanos",
          titulo: `Cumpleaños de ${nombre}`,
          descripcion:
            diffDias === 0
              ? "¡Hoy es su cumpleaños!"
              : `Cumpleaños en ${diffDias} día${diffDias === 1 ? "" : "s"}`,
          fecha: fechaCump,
          prioridad: "media",
          estado: "pendiente",
          contacto_id: c.id,
          contacto_nombre: nombre,
          created_at: nowIso,
        });
      }
    }

    // 3. Prospectos sin movimiento
    for (const n of prospectosPasivos) {
      alertas.push({
        id: `auto_seguimiento_tasacion_prospecto_${n.id}`,
        tipo: "auto_seguimiento_tasacion",
        titulo: `Tasación sin avance: ${n.titulo}`,
        descripcion: "Tasación en etapa prospecto hace 7+ días sin movimiento",
        fecha: hoy,
        prioridad: "alta",
        estado: "pendiente",
        negocio_id: n.id,
        negocio_titulo: n.titulo,
        created_at: nowIso,
      });
    }

    // 4. Negociaciones sin movimiento
    for (const n of negociacionesPasivas) {
      alertas.push({
        id: `auto_seguimiento_tasacion_negociacion_${n.id}`,
        tipo: "auto_seguimiento_tasacion",
        titulo: `Negociación sin movimiento: ${n.titulo}`,
        descripcion: "Negociación sin avance hace 5+ días",
        fecha: hoy,
        prioridad: "alta",
        estado: "pendiente",
        negocio_id: n.id,
        negocio_titulo: n.titulo,
        created_at: nowIso,
      });
    }

    return alertas;
  }, []);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const ignoradosLS = cargarIgnorados();
    setIgnorados(ignoradosLS);
    const manualesLS = cargarManuales();
    setManuales(manualesLS);

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setUid(data.user.id);
      const alertasGen = await generarAlertas(data.user.id);
      setAutos(alertasGen);
      setLoading(false);
    });
  }, [generarAlertas]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const autosVisibles = useMemo(() => {
    return autos
      .filter((a) => !ignorados.has(a.id))
      .sort((a, b) => {
        const orden: Record<PrioridadRecordatorio, number> = { alta: 0, media: 1, baja: 2 };
        return orden[a.prioridad] - orden[b.prioridad];
      });
  }, [autos, ignorados]);

  const hoy = hoyStr();

  const manualesPendientes = useMemo(() => {
    return manuales
      .filter((r) => r.estado === "pendiente" && r.fecha <= hoy)
      .sort((a, b) => {
        const orden: Record<PrioridadRecordatorio, number> = { alta: 0, media: 1, baja: 2 };
        return orden[a.prioridad] - orden[b.prioridad];
      });
  }, [manuales, hoy]);

  const manualesFuturos = useMemo(() => {
    return manuales
      .filter((r) => r.estado === "pendiente" && r.fecha > hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [manuales, hoy]);

  const historial = useMemo(() => {
    return manuales.filter((r) => r.estado !== "pendiente");
  }, [manuales]);

  const totalPendientes = autosVisibles.length + manualesPendientes.length;

  // ── Actions ───────────────────────────────────────────────────────────────

  const ignorarAlerta = (id: string) => {
    const nuevo = new Set([...ignorados, id]);
    setIgnorados(nuevo);
    guardarIgnorados(nuevo);
    showToast("Alerta ignorada");
  };

  const completarManual = (id: string) => {
    const updated = manuales.map((r) =>
      r.id === id ? { ...r, estado: "completado" as EstadoRecordatorio } : r
    );
    setManuales(updated);
    guardarManuales(updated);
    showToast("Recordatorio completado");
  };

  const eliminarManual = (id: string) => {
    if (!confirm("¿Eliminar este recordatorio?")) return;
    const updated = manuales.filter((r) => r.id !== id);
    setManuales(updated);
    guardarManuales(updated);
    showToast("Recordatorio eliminado");
  };

  const restaurarManual = (id: string) => {
    const updated = manuales.map((r) =>
      r.id === id ? { ...r, estado: "pendiente" as EstadoRecordatorio } : r
    );
    setManuales(updated);
    guardarManuales(updated);
    showToast("Recordatorio restaurado");
  };

  const vaciarHistorial = () => {
    if (!confirm("¿Vaciar todo el historial? Esta acción no se puede deshacer.")) return;
    const pendientes = manuales.filter((r) => r.estado === "pendiente");
    setManuales(pendientes);
    guardarManuales(pendientes);
    showToast("Historial vaciado");
  };

  const abrirEditar = (r: Recordatorio) => {
    setForm({
      titulo: r.titulo,
      descripcion: r.descripcion,
      fecha: r.fecha,
      prioridad: r.prioridad,
      contacto_nombre: r.contacto_nombre ?? "",
      negocio_titulo: r.negocio_titulo ?? "",
    });
    setEditId(r.id);
    setTab("crear");
  };

  const guardarForm = () => {
    if (!form.titulo.trim()) return;
    const now = new Date().toISOString();

    if (editId) {
      const updated = manuales.map((r) =>
        r.id === editId
          ? {
              ...r,
              titulo: form.titulo.trim(),
              descripcion: form.descripcion,
              fecha: form.fecha,
              prioridad: form.prioridad,
              contacto_nombre: form.contacto_nombre || undefined,
              negocio_titulo: form.negocio_titulo || undefined,
            }
          : r
      );
      setManuales(updated);
      guardarManuales(updated);
      showToast("Recordatorio actualizado");
    } else {
      const nuevo: Recordatorio = {
        id: crypto.randomUUID(),
        tipo: "manual",
        titulo: form.titulo.trim(),
        descripcion: form.descripcion,
        fecha: form.fecha,
        prioridad: form.prioridad,
        estado: "pendiente",
        contacto_nombre: form.contacto_nombre || undefined,
        negocio_titulo: form.negocio_titulo || undefined,
        created_at: now,
      };
      const updated = [...manuales, nuevo];
      setManuales(updated);
      guardarManuales(updated);
      showToast("Recordatorio creado");
    }

    setForm(FORM_VACIO);
    setEditId(null);
    setTab("pendientes");
  };

  const cancelarForm = () => {
    setForm(FORM_VACIO);
    setEditId(null);
    setTab("pendientes");
  };

  // ── Style helpers ─────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 5,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
    marginBottom: 5,
    fontFamily: "Montserrat, sans-serif",
  };

  const fieldStyle: React.CSSProperties = { marginBottom: 14 };

  const btnStyle = (
    bg: string,
    color: string,
    border?: string
  ): React.CSSProperties => ({
    padding: "9px 16px",
    border: border ?? "none",
    borderRadius: 5,
    fontFamily: "Montserrat, sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
    background: bg,
    color,
    transition: "opacity 0.15s",
  });

  const cardStyle: React.CSSProperties = {
    background: "rgba(14,14,14,0.9)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8,
    padding: "14px 16px",
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  };

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "Montserrat, sans-serif",
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
  });

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 16px",
    borderRadius: 20,
    border: "none",
    fontFamily: "Montserrat, sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
    background: active ? "#cc0000" : "rgba(255,255,255,0.06)",
    color: active ? "#fff" : "rgba(255,255,255,0.45)",
    transition: "all 0.15s",
  });

  const sectionHeaderStyle: React.CSSProperties = {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12,
  };

  const emptyStyle: React.CSSProperties = {
    background: "rgba(14,14,14,0.9)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8,
    padding: "28px 20px",
    textAlign: "center",
    color: "rgba(255,255,255,0.25)",
    fontFamily: "Montserrat, sans-serif",
    fontSize: 13,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!uid && loading) {
    return (
      <div
        style={{
          background: "#0a0a0a",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.3)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Cargando...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .rec-input:focus { border-color: rgba(204,0,0,0.5) !important; }
        .rec-card:hover { border-color: rgba(255,255,255,0.14) !important; }
        @media (max-width: 600px) {
          .rec-grid-2 { grid-template-columns: 1fr !important; }
          .rec-hist-table { display: flex !important; flex-direction: column !important; gap: 8px !important; }
        }
      `}</style>

      <div
        style={{
          maxWidth: 860,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          fontFamily: "Inter, sans-serif",
          color: "#fff",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                fontSize: 28,
                color: "#fff",
                margin: 0,
              }}
            >
              Recordatorios
            </h1>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.35)",
                marginTop: 4,
              }}
            >
              Alertas automáticas y recordatorios manuales del CRM
            </div>
          </div>
          <button
            style={btnStyle("#cc0000", "#fff")}
            onClick={() => {
              setForm(FORM_VACIO);
              setEditId(null);
              setTab("crear");
            }}
          >
            + Nuevo recordatorio
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={tabBtnStyle(tab === "pendientes")}
            onClick={() => setTab("pendientes")}
          >
            Pendientes
            {totalPendientes > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: tab === "pendientes" ? "rgba(255,255,255,0.25)" : "#cc0000",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 7px",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {totalPendientes}
              </span>
            )}
          </button>

          <button
            style={tabBtnStyle(tab === "crear")}
            onClick={() => {
              setForm(FORM_VACIO);
              setEditId(null);
              setTab("crear");
            }}
          >
            {editId ? "Editar recordatorio" : "Crear recordatorio"}
          </button>

          <button
            style={tabBtnStyle(tab === "historial")}
            onClick={() => setTab("historial")}
          >
            Historial
            {historial.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background:
                    tab === "historial"
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.6)",
                  borderRadius: 10,
                  padding: "1px 7px",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {historial.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab: Pendientes ─────────────────────────────────────────────────── */}
        {tab === "pendientes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 48,
                  color: "rgba(255,255,255,0.25)",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                Analizando datos...
              </div>
            ) : (
              <>
                {/* Alertas automáticas */}
                <div>
                  <div style={sectionHeaderStyle}>
                    🚨 Alertas automáticas
                    {autosVisibles.length > 0 && (
                      <span
                        style={{
                          marginLeft: 8,
                          background: "#cc000033",
                          color: "#cc0000",
                          borderRadius: 10,
                          padding: "1px 8px",
                          fontSize: 11,
                        }}
                      >
                        {autosVisibles.length}
                      </span>
                    )}
                  </div>

                  {autosVisibles.length === 0 ? (
                    <div style={emptyStyle}>Sin alertas automáticas activas</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {autosVisibles.map((alerta) => (
                        <div
                          key={alerta.id}
                          className="rec-card"
                          style={cardStyle}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                marginBottom: 6,
                              }}
                            >
                              <span style={badgeStyle(tipoColor(alerta.tipo))}>
                                {tipoLabel(alerta.tipo)}
                              </span>
                              <span style={badgeStyle(prioridadColor(alerta.prioridad))}>
                                {alerta.prioridad.charAt(0).toUpperCase() +
                                  alerta.prioridad.slice(1)}
                              </span>
                              <span
                                style={{
                                  fontFamily: "Montserrat, sans-serif",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "#fff",
                                }}
                              >
                                {alerta.titulo}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "rgba(255,255,255,0.4)",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {alerta.descripcion}
                            </div>
                            {(alerta.contacto_nombre || alerta.negocio_titulo) && (
                              <div
                                style={{
                                  marginTop: 6,
                                  display: "flex",
                                  gap: 10,
                                  flexWrap: "wrap",
                                }}
                              >
                                {alerta.contacto_nombre && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "rgba(255,255,255,0.3)",
                                      fontFamily: "Inter, sans-serif",
                                    }}
                                  >
                                    👤 {alerta.contacto_nombre}
                                  </span>
                                )}
                                {alerta.negocio_titulo && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "rgba(255,255,255,0.3)",
                                      fontFamily: "Inter, sans-serif",
                                    }}
                                  >
                                    🤝 {alerta.negocio_titulo}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            style={btnStyle(
                              "rgba(255,255,255,0.06)",
                              "rgba(255,255,255,0.45)",
                              "1px solid rgba(255,255,255,0.1)"
                            )}
                            onClick={() => ignorarAlerta(alerta.id)}
                          >
                            Ignorar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recordatorios manuales — hoy o vencidos */}
                <div>
                  <div style={sectionHeaderStyle}>
                    📝 Mis recordatorios
                    {manualesPendientes.length > 0 && (
                      <span
                        style={{
                          marginLeft: 8,
                          background: "rgba(59,130,246,0.2)",
                          color: "#3b82f6",
                          borderRadius: 10,
                          padding: "1px 8px",
                          fontSize: 11,
                        }}
                      >
                        {manualesPendientes.length}
                      </span>
                    )}
                  </div>

                  {manualesPendientes.length === 0 ? (
                    <div style={emptyStyle}>
                      No tenés recordatorios manuales pendientes para hoy
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {manualesPendientes.map((r) => (
                        <div
                          key={r.id}
                          className="rec-card"
                          style={cardStyle}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                marginBottom: 5,
                              }}
                            >
                              <span style={badgeStyle(prioridadColor(r.prioridad))}>
                                {r.prioridad.charAt(0).toUpperCase() + r.prioridad.slice(1)}
                              </span>
                              <span
                                style={{
                                  fontFamily: "Montserrat, sans-serif",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "#fff",
                                }}
                              >
                                {r.titulo}
                              </span>
                            </div>
                            {r.descripcion && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "rgba(255,255,255,0.4)",
                                  fontFamily: "Inter, sans-serif",
                                  marginBottom: 5,
                                }}
                              >
                                {r.descripcion}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "rgba(255,255,255,0.3)",
                                  fontFamily: "Inter, sans-serif",
                                }}
                              >
                                📅 {fmtFecha(r.fecha)}
                              </span>
                              {r.contacto_nombre && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,255,255,0.3)",
                                    fontFamily: "Inter, sans-serif",
                                  }}
                                >
                                  👤 {r.contacto_nombre}
                                </span>
                              )}
                              {r.negocio_titulo && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "rgba(255,255,255,0.3)",
                                    fontFamily: "Inter, sans-serif",
                                  }}
                                >
                                  🤝 {r.negocio_titulo}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              style={btnStyle(
                                "rgba(34,197,94,0.12)",
                                "#22c55e",
                                "1px solid rgba(34,197,94,0.3)"
                              )}
                              onClick={() => completarManual(r.id)}
                            >
                              Completar
                            </button>
                            <button
                              style={btnStyle(
                                "rgba(255,255,255,0.06)",
                                "rgba(255,255,255,0.5)",
                                "1px solid rgba(255,255,255,0.1)"
                              )}
                              onClick={() => abrirEditar(r)}
                            >
                              Editar
                            </button>
                            <button
                              style={btnStyle(
                                "rgba(204,0,0,0.1)",
                                "#cc0000",
                                "1px solid rgba(204,0,0,0.25)"
                              )}
                              onClick={() => eliminarManual(r.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Próximos (futuros) */}
                {manualesFuturos.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.35)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginBottom: 10,
                      }}
                    >
                      🗓 Próximos ({manualesFuturos.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {manualesFuturos.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            background: "rgba(14,14,14,0.6)",
                            border: "1px solid rgba(255,255,255,0.05)",
                            borderRadius: 8,
                            padding: "10px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontFamily: "Montserrat, sans-serif",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "rgba(255,255,255,0.7)",
                                marginRight: 8,
                              }}
                            >
                              {r.titulo}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.25)",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              📅 {fmtFecha(r.fecha)}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button
                              style={btnStyle(
                                "rgba(255,255,255,0.05)",
                                "rgba(255,255,255,0.4)",
                                "1px solid rgba(255,255,255,0.08)"
                              )}
                              onClick={() => abrirEditar(r)}
                            >
                              Editar
                            </button>
                            <button
                              style={btnStyle(
                                "rgba(204,0,0,0.08)",
                                "#cc0000",
                                "1px solid rgba(204,0,0,0.2)"
                              )}
                              onClick={() => eliminarManual(r.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tab: Crear / Editar ──────────────────────────────────────────────── */}
        {tab === "crear" && (
          <div
            style={{
              background: "rgba(14,14,14,0.9)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: 24,
              maxWidth: 560,
            }}
          >
            <div
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: 15,
                fontWeight: 800,
                color: "#fff",
                marginBottom: 20,
              }}
            >
              {editId ? "Editar recordatorio" : "Nuevo recordatorio"}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Título *</label>
              <input
                className="rec-input"
                style={inputStyle}
                placeholder="¿Qué hay que recordar?"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Descripción</label>
              <textarea
                className="rec-input"
                style={{ ...inputStyle, resize: "vertical" }}
                rows={3}
                placeholder="Detalles opcionales..."
                value={form.descripcion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descripcion: e.target.value }))
                }
              />
            </div>

            <div
              className="rec-grid-2"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
            >
              <div style={fieldStyle}>
                <label style={labelStyle}>Fecha</label>
                <input
                  className="rec-input"
                  style={inputStyle}
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Prioridad</label>
                <select
                  style={{
                    ...inputStyle,
                    background: "rgba(14,14,14,0.95)",
                  }}
                  value={form.prioridad}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      prioridad: e.target.value as PrioridadRecordatorio,
                    }))
                  }
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
            </div>

            <div
              className="rec-grid-2"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
            >
              <div style={fieldStyle}>
                <label style={labelStyle}>Contacto (opcional)</label>
                <input
                  className="rec-input"
                  style={inputStyle}
                  placeholder="Nombre del contacto"
                  value={form.contacto_nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contacto_nombre: e.target.value }))
                  }
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Negocio (opcional)</label>
                <input
                  className="rec-input"
                  style={inputStyle}
                  placeholder="Título del negocio"
                  value={form.negocio_titulo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, negocio_titulo: e.target.value }))
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 6,
              }}
            >
              <button
                style={btnStyle(
                  "rgba(255,255,255,0.06)",
                  "rgba(255,255,255,0.6)",
                  "1px solid rgba(255,255,255,0.12)"
                )}
                onClick={cancelarForm}
              >
                Cancelar
              </button>
              <button
                style={{
                  ...btnStyle("#cc0000", "#fff"),
                  opacity: !form.titulo.trim() ? 0.5 : 1,
                  cursor: !form.titulo.trim() ? "not-allowed" : "pointer",
                }}
                onClick={guardarForm}
                disabled={!form.titulo.trim()}
              >
                {editId ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Historial ───────────────────────────────────────────────────── */}
        {tab === "historial" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={sectionHeaderStyle}>
                Historial ({historial.length})
              </div>
              {historial.length > 0 && (
                <button
                  style={btnStyle(
                    "rgba(204,0,0,0.1)",
                    "#cc0000",
                    "1px solid rgba(204,0,0,0.25)"
                  )}
                  onClick={vaciarHistorial}
                >
                  Vaciar historial
                </button>
              )}
            </div>

            {historial.length === 0 ? (
              <div style={emptyStyle}>El historial está vacío</div>
            ) : (
              <div
                style={{
                  background: "rgba(14,14,14,0.9)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {/* Table header */}
                <div
                  className="rec-hist-table"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 1fr 100px 100px 100px",
                    gap: 8,
                    padding: "10px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    fontFamily: "Montserrat, sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  <span>Tipo</span>
                  <span>Título</span>
                  <span>Fecha</span>
                  <span>Estado</span>
                  <span>Acción</span>
                </div>

                {historial.map((r, idx) => (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "90px 1fr 100px 100px 100px",
                      gap: 8,
                      padding: "11px 16px",
                      borderBottom:
                        idx < historial.length - 1
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "none",
                      alignItems: "center",
                    }}
                  >
                    <span style={badgeStyle(tipoColor(r.tipo))}>
                      {tipoLabel(r.tipo)}
                    </span>
                    <div>
                      <div
                        style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        {r.titulo}
                      </div>
                      {r.descripcion && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.25)",
                            fontFamily: "Inter, sans-serif",
                            marginTop: 2,
                          }}
                        >
                          {r.descripcion}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.3)",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {fmtFecha(r.fecha)}
                    </span>
                    <span
                      style={badgeStyle(
                        r.estado === "completado" ? "#22c55e" : "#6b7280"
                      )}
                    >
                      {r.estado === "completado" ? "Completado" : "Ignorado"}
                    </span>
                    <button
                      style={btnStyle(
                        "rgba(255,255,255,0.06)",
                        "rgba(255,255,255,0.5)",
                        "1px solid rgba(255,255,255,0.1)"
                      )}
                      onClick={() => restaurarManual(r.id)}
                    >
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "12px 20px",
            color: "#fff",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
