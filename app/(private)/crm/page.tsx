"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;
  perfil_id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  matricula: string | null;
  inmobiliaria: string | null;
  corredor_ref_id: string | null;
  etiquetas: string[] | null;
  notas: string | null;
  tipo: string | null;
  estado: string | null;
  origen: string | null;
  interes: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: string | null;
  zona_interes: string | null;
  created_at: string;
  updated_at: string;
}

interface Interaccion {
  id: string;
  contacto_id: string;
  perfil_id: string;
  tipo: string;
  descripcion: string;
  created_at: string;
}

interface Recordatorio {
  id: string;
  contacto_id: string;
  descripcion: string;
  fecha_recordatorio: string;
  completado: boolean;
  created_at: string;
}

interface Negocio {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  titulo: string;
  tipo_operacion: string;
  etapa: string;
  descripcion: string | null;
  direccion: string | null;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  fecha_primer_contacto: string | null;
  fecha_visita: string | null;
  fecha_reserva: string | null;
  fecha_escritura: string | null;
  fecha_cierre: string | null;
  colega_id: string | null;
  split_pct: number | null;
  etiquetas: string[] | null;
  notas: string | null;
  archivado: boolean;
  created_at: string;
  updated_at: string;
}

interface Tarea {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  negocio_id: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  prioridad: string;
  estado: string;
  fecha_vencimiento: string | null;
  fecha_completada: string | null;
  etiquetas: string[] | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

interface NotaCRM {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  negocio_id: string | null;
  titulo: string | null;
  contenido: string;
  tipo: string;
  fijada: boolean;
  etiquetas: string[] | null;
  created_at: string;
  updated_at: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────

const TIPOS_INTERACCION = [
  { value: "nota", label: "📝 Nota", color: "#60a5fa" },
  { value: "llamada", label: "📞 Llamada", color: "#22c55e" },
  { value: "whatsapp", label: "💬 WhatsApp", color: "#25d366" },
  { value: "email", label: "✉️ Email", color: "#a78bfa" },
  { value: "reunion", label: "🤝 Reunión", color: "#f97316" },
  { value: "visita", label: "🏠 Visita", color: "#eab308" },
];

const TIPOS_CONTACTO = ["cliente", "propietario", "colega", "proveedor", "otro"];
const ORIGENES = ["WhatsApp", "Referido", "Portal", "Web propia", "Redes", "Directo", "Otro"];
const INTERESES = ["Comprar", "Vender", "Alquilar", "Alquilar (dueño)", "Invertir", "Otro"];

const ESTADOS_LEAD = [
  { value: "lead:nuevo", label: "Nuevo", color: "#6b7280" },
  { value: "lead:esperando", label: "Esperando resp.", color: "#3b82f6" },
  { value: "lead:evolucionando", label: "Evolucionando", color: "#10b981" },
  { value: "lead:congelado", label: "Congelado", color: "#94a3b8" },
  { value: "lead:tomar_accion", label: "Tomar acción", color: "#f97316" },
  { value: "lead:pendiente", label: "Pend. contactar", color: "#eab308" },
  { value: "lead:cerrado_lead", label: "Cerrado", color: "#22c55e" },
];

const ETAPAS_NEGOCIO = [
  { value: "prospecto", label: "Prospecto", color: "#6b7280" },
  { value: "contactado", label: "Contactado", color: "#3b82f6" },
  { value: "visita_coordinada", label: "Visita coord.", color: "#8b5cf6" },
  { value: "visita_realizada", label: "Visita realizada", color: "#a78bfa" },
  { value: "oferta_enviada", label: "Oferta enviada", color: "#f59e0b" },
  { value: "negociacion", label: "Negociación", color: "#f97316" },
  { value: "reserva", label: "Reserva", color: "#06b6d4" },
  { value: "escritura", label: "Escritura", color: "#10b981" },
  { value: "cerrado", label: "Cerrado ✓", color: "#22c55e" },
  { value: "perdido", label: "Perdido", color: "#ef4444" },
];

const TIPOS_OPERACION = [
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "alquiler_temporal", label: "Alq. temporal" },
  { value: "loteo", label: "Loteo" },
  { value: "otro", label: "Otro" },
];

const PRIORIDADES_TAREA = [
  { value: "baja", label: "Baja", color: "#6b7280" },
  { value: "normal", label: "Normal", color: "#3b82f6" },
  { value: "alta", label: "Alta", color: "#f97316" },
  { value: "urgente", label: "Urgente", color: "#ef4444" },
];

const TIPOS_TAREA = [
  { value: "general", label: "General" },
  { value: "llamar", label: "📞 Llamar" },
  { value: "whatsapp", label: "💬 WhatsApp" },
  { value: "email", label: "✉️ Email" },
  { value: "visita", label: "🏠 Visita" },
  { value: "documentacion", label: "📄 Documentación" },
  { value: "tasacion", label: "🏷️ Tasación" },
  { value: "publicar", label: "📢 Publicar" },
  { value: "seguimiento", label: "🔄 Seguimiento" },
];

const TIPOS_NOTA = [
  { value: "general", label: "General" },
  { value: "estrategia", label: "Estrategia" },
  { value: "legal", label: "Legal" },
  { value: "financiera", label: "Financiera" },
  { value: "otra", label: "Otra" },
];

const FORM_CONTACTO_VACIO = {
  nombre: "", apellido: "", telefono: "", email: "",
  matricula: "", inmobiliaria: "", tipo: "cliente",
  origen: "", interes: "", zona_interes: "",
  presupuesto_min: "", presupuesto_max: "", moneda: "USD",
  etiquetas: "", notas: "",
};

const FORM_NEGOCIO_VACIO = {
  titulo: "", tipo_operacion: "venta", etapa: "prospecto",
  descripcion: "", direccion: "", valor_operacion: "",
  moneda: "USD", honorarios_pct: "3",
  fecha_primer_contacto: "", fecha_visita: "",
  fecha_reserva: "", fecha_escritura: "", fecha_cierre: "",
  etiquetas: "", notas: "", contacto_id: "",
};

const FORM_TAREA_VACIO = {
  titulo: "", descripcion: "", tipo: "general",
  prioridad: "normal", fecha_vencimiento: "",
  notas: "", contacto_id: "", negocio_id: "", etiquetas: "",
};

const FORM_NOTA_VACIO = {
  titulo: "", contenido: "", tipo: "general",
  contacto_id: "", negocio_id: "", etiquetas: "",
};

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

const formatFechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ── Componente principal ───────────────────────────────────────────────────

export default function CrmPage() {
  const [userId, setUserId] = useState<string | null>(null);

  // Tab principal
  const [tabPrincipal, setTabPrincipal] = useState<"dashboard" | "contactos" | "negocios" | "tareas" | "notas">("dashboard");

  // ── Contactos ─────────────────────────────────────────────────────────────
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loadingContactos, setLoadingContactos] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");
  const [mostrarFormContacto, setMostrarFormContacto] = useState(false);
  const [editandoContactoId, setEditandoContactoId] = useState<string | null>(null);
  const [formContacto, setFormContacto] = useState(FORM_CONTACTO_VACIO);
  const [guardandoContacto, setGuardandoContacto] = useState(false);
  const [contactoSeleccionado, setContactoSeleccionado] = useState<Contacto | null>(null);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [nuevaInteraccion, setNuevaInteraccion] = useState({ tipo: "nota", descripcion: "" });
  const [nuevoRecordatorio, setNuevoRecordatorio] = useState({ descripcion: "", fecha: "" });
  const [guardandoInteraccion, setGuardandoInteraccion] = useState(false);
  const [guardandoRecordatorio, setGuardandoRecordatorio] = useState(false);
  const [tabDetalle, setTabDetalle] = useState<"historial" | "recordatorios" | "propiedades">("historial");
  const [filtroEstadoLead, setFiltroEstadoLead] = useState("");
  // Plantillas
  const [plantillas, setPlantillas] = useState<{id:string;titulo:string;contenido:string;tipo:string}[]>([]);
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [tituloNuevaPlantilla, setTituloNuevaPlantilla] = useState("");
  const [mostrarGuardarPlantilla, setMostrarGuardarPlantilla] = useState(false);
  // Propiedades sugeridas
  const [propiedadesSugeridas, setPropiedadesSugeridas] = useState<any[]>([]);
  const [loadingPropiedades, setLoadingPropiedades] = useState(false);
  const [mostrarImport, setMostrarImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importando, setImportando] = useState(false);
  const [importError, setImportError] = useState("");
  const [mostrarDuplicados, setMostrarDuplicados] = useState(false);
  const [gruposDuplicados, setGruposDuplicados] = useState<Contacto[][]>([]);
  const [mergeSeleccion, setMergeSeleccion] = useState<Record<number, string>>({});
  const [mergeando, setMergeando] = useState(false);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [mostrarProspeccion, setMostrarProspeccion] = useState(false);
  const [filtroScoreProspeccion, setFiltroScoreProspeccion] = useState<"" | "alta" | "media" | "baja">("");

  // ── Negocios ──────────────────────────────────────────────────────────────
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loadingNegocios, setLoadingNegocios] = useState(true);
  const [mostrarFormNegocio, setMostrarFormNegocio] = useState(false);
  const [editandoNegocioId, setEditandoNegocioId] = useState<string | null>(null);
  const [formNegocio, setFormNegocio] = useState(FORM_NEGOCIO_VACIO);
  const [guardandoNegocio, setGuardandoNegocio] = useState(false);
  const [filtroEtapaNegocio, setFiltroEtapaNegocio] = useState("");
  const [busquedaNegocio, setBusquedaNegocio] = useState("");

  // ── Tareas ────────────────────────────────────────────────────────────────
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loadingTareas, setLoadingTareas] = useState(true);
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [editandoTareaId, setEditandoTareaId] = useState<string | null>(null);
  const [formTarea, setFormTarea] = useState(FORM_TAREA_VACIO);
  const [guardandoTarea, setGuardandoTarea] = useState(false);
  const [filtroEstadoTarea, setFiltroEstadoTarea] = useState("pendiente");
  const [filtroPrioridadTarea, setFiltroPrioridadTarea] = useState("");

  // ── Notas ─────────────────────────────────────────────────────────────────
  const [notas, setNotas] = useState<NotaCRM[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const [mostrarFormNota, setMostrarFormNota] = useState(false);
  const [editandoNotaId, setEditandoNotaId] = useState<string | null>(null);
  const [formNota, setFormNota] = useState(FORM_NOTA_VACIO);
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [busquedaNota, setBusquedaNota] = useState("");

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      cargarContactos(data.user.id);
      cargarNegocios(data.user.id);
      cargarTareas(data.user.id);
      cargarNotas(data.user.id);
    };
    init();
  }, []);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const cargarContactos = async (uid: string) => {
    setLoadingContactos(true);
    const { data } = await supabase.from("crm_contactos").select("*").eq("perfil_id", uid).order("updated_at", { ascending: false });
    setContactos((data as Contacto[]) ?? []);
    setLoadingContactos(false);
  };

  const cargarNegocios = async (uid: string) => {
    setLoadingNegocios(true);
    const { data } = await supabase.from("crm_negocios").select("*").eq("perfil_id", uid).eq("archivado", false).order("updated_at", { ascending: false });
    setNegocios((data as Negocio[]) ?? []);
    setLoadingNegocios(false);
  };

  const cargarTareas = async (uid: string) => {
    setLoadingTareas(true);
    const { data } = await supabase.from("crm_tareas").select("*").eq("perfil_id", uid).order("fecha_vencimiento", { ascending: true, nullsFirst: false });
    setTareas((data as Tarea[]) ?? []);
    setLoadingTareas(false);
  };

  const cargarNotas = async (uid: string) => {
    setLoadingNotas(true);
    const { data } = await supabase.from("crm_notas").select("*").eq("perfil_id", uid).order("fijada", { ascending: false });
    setNotas((data as NotaCRM[]) ?? []);
    setLoadingNotas(false);
  };

  const cargarDetalle = async (contacto: Contacto) => {
    setContactoSeleccionado(contacto);
    setLoadingDetalle(true);
    const [{ data: ints }, { data: recs }] = await Promise.all([
      supabase.from("crm_interacciones").select("*").eq("contacto_id", contacto.id).order("created_at", { ascending: false }),
      supabase.from("crm_recordatorios").select("*").eq("contacto_id", contacto.id).order("fecha_recordatorio", { ascending: true }),
    ]);
    setInteracciones((ints as Interaccion[]) ?? []);
    setRecordatorios((recs as Recordatorio[]) ?? []);
    setLoadingDetalle(false);
  };

  // ── CRUD Contactos ────────────────────────────────────────────────────────
  const abrirFormNuevoContacto = () => { setEditandoContactoId(null); setFormContacto(FORM_CONTACTO_VACIO); setMostrarFormContacto(true); };
  const abrirFormEditarContacto = (c: Contacto) => {
    setEditandoContactoId(c.id);
    setFormContacto({ nombre: c.nombre ?? "", apellido: c.apellido ?? "", telefono: c.telefono ?? "", email: c.email ?? "", matricula: c.matricula ?? "", inmobiliaria: c.inmobiliaria ?? "", tipo: c.tipo ?? "cliente", origen: c.origen ?? "", interes: c.interes ?? "", zona_interes: c.zona_interes ?? "", presupuesto_min: c.presupuesto_min?.toString() ?? "", presupuesto_max: c.presupuesto_max?.toString() ?? "", moneda: c.moneda ?? "USD", etiquetas: (c.etiquetas ?? []).join(", "), notas: c.notas ?? "" });
    setMostrarFormContacto(true);
  };

  const guardarContacto = async () => {
    if (!userId || !formContacto.nombre) return;
    setGuardandoContacto(true);
    const etiquetasArr = formContacto.etiquetas.split(",").map(e => e.trim()).filter(Boolean);
    const datos = { perfil_id: userId, nombre: formContacto.nombre, apellido: formContacto.apellido, telefono: formContacto.telefono || null, email: formContacto.email || null, matricula: formContacto.matricula || null, inmobiliaria: formContacto.inmobiliaria || null, tipo: formContacto.tipo, origen: formContacto.origen || null, interes: formContacto.interes || null, zona_interes: formContacto.zona_interes || null, presupuesto_min: formContacto.presupuesto_min ? parseFloat(formContacto.presupuesto_min) : null, presupuesto_max: formContacto.presupuesto_max ? parseFloat(formContacto.presupuesto_max) : null, moneda: formContacto.moneda, etiquetas: etiquetasArr.length > 0 ? etiquetasArr : null, notas: formContacto.notas || null, updated_at: new Date().toISOString() };
    if (editandoContactoId) { await supabase.from("crm_contactos").update(datos).eq("id", editandoContactoId); } else { await supabase.from("crm_contactos").insert(datos); }
    setGuardandoContacto(false); setMostrarFormContacto(false); cargarContactos(userId);
    if (contactoSeleccionado?.id === editandoContactoId) { const { data } = await supabase.from("crm_contactos").select("*").eq("id", editandoContactoId).single(); if (data) setContactoSeleccionado(data as Contacto); }
  };

  const eliminarContacto = async (id: string) => {
    if (!confirm("¿Eliminar este contacto y todo su historial?")) return;
    await supabase.from("crm_contactos").delete().eq("id", id);
    if (contactoSeleccionado?.id === id) setContactoSeleccionado(null);
    if (userId) cargarContactos(userId);
  };

  const archivarContacto = async (c: Contacto) => {
    const nuevoEstado = c.estado === "archivado" ? null : "archivado";
    await supabase.from("crm_contactos").update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq("id", c.id);
    setContactoSeleccionado(null);
    if (userId) cargarContactos(userId);
  };

  const guardarInteraccion = async () => {
    if (!userId || !contactoSeleccionado || !nuevaInteraccion.descripcion.trim()) return;
    setGuardandoInteraccion(true);
    await supabase.from("crm_interacciones").insert({ contacto_id: contactoSeleccionado.id, perfil_id: userId, tipo: nuevaInteraccion.tipo, descripcion: nuevaInteraccion.descripcion });
    await supabase.from("crm_contactos").update({ updated_at: new Date().toISOString() }).eq("id", contactoSeleccionado.id);
    setNuevaInteraccion({ tipo: "nota", descripcion: "" }); setGuardandoInteraccion(false);
    cargarDetalle(contactoSeleccionado); if (userId) cargarContactos(userId);
  };

  const eliminarInteraccion = async (id: string) => {
    await supabase.from("crm_interacciones").delete().eq("id", id);
    if (contactoSeleccionado) cargarDetalle(contactoSeleccionado);
  };

  const guardarRecordatorio = async () => {
    if (!userId || !contactoSeleccionado || !nuevoRecordatorio.descripcion.trim() || !nuevoRecordatorio.fecha) return;
    setGuardandoRecordatorio(true);
    await supabase.from("crm_recordatorios").insert({ contacto_id: contactoSeleccionado.id, perfil_id: userId, descripcion: nuevoRecordatorio.descripcion, fecha_recordatorio: nuevoRecordatorio.fecha });
    setNuevoRecordatorio({ descripcion: "", fecha: "" }); setGuardandoRecordatorio(false); cargarDetalle(contactoSeleccionado);
  };

  const toggleRecordatorio = async (r: Recordatorio) => {
    await supabase.from("crm_recordatorios").update({ completado: !r.completado }).eq("id", r.id);
    if (contactoSeleccionado) cargarDetalle(contactoSeleccionado);
  };

  const eliminarRecordatorio = async (id: string) => {
    await supabase.from("crm_recordatorios").delete().eq("id", id);
    if (contactoSeleccionado) cargarDetalle(contactoSeleccionado);
  };

  // ── Lead Estado ──────────────────────────────────────────────────────────
  const actualizarEstadoLead = async (contacto: Contacto, nuevoEstado: string) => {
    await supabase.from("crm_contactos").update({ estado: nuevoEstado, updated_at: new Date().toISOString() }).eq("id", contacto.id);
    setContactoSeleccionado(prev => prev ? { ...prev, estado: nuevoEstado } : prev);
    if (userId) cargarContactos(userId);
  };

  // ── Plantillas ────────────────────────────────────────────────────────────
  const cargarPlantillas = async () => {
    if (!userId) return;
    try {
      const { data } = await supabase.from("crm_plantillas").select("id,titulo,contenido,tipo").eq("perfil_id", userId).order("titulo");
      setPlantillas((data as any[]) ?? []);
    } catch { setPlantillas([]); }
  };

  const sugerirConIA = async () => {
    if (!contactoSeleccionado) return;
    setCargandoIA(true);
    try {
      const resp = await fetch("/api/ia-respuesta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contacto: contactoSeleccionado, interacciones: interacciones.slice(0, 8), tipo: nuevaInteraccion.tipo }),
      });
      const { text } = await resp.json();
      setNuevaInteraccion(prev => ({ ...prev, descripcion: text }));
    } catch {}
    setCargandoIA(false);
  };

  const guardarPlantilla = async () => {
    if (!userId || !nuevaInteraccion.descripcion.trim() || !tituloNuevaPlantilla.trim()) return;
    setGuardandoPlantilla(true);
    try {
      await supabase.from("crm_plantillas").insert({ perfil_id: userId, titulo: tituloNuevaPlantilla.trim(), contenido: nuevaInteraccion.descripcion, tipo: nuevaInteraccion.tipo });
      setTituloNuevaPlantilla(""); setMostrarGuardarPlantilla(false);
      cargarPlantillas();
    } catch { /* tabla puede no existir */ }
    setGuardandoPlantilla(false);
  };

  const eliminarPlantilla = async (id: string) => {
    try { await supabase.from("crm_plantillas").delete().eq("id", id); cargarPlantillas(); } catch { /* */ }
  };

  // ── Propiedades sugeridas (IA Matching) ──────────────────────────────────
  const cargarPropiedadesSugeridas = async (contacto: Contacto) => {
    if (!userId) return;
    setLoadingPropiedades(true);
    try {
      // Primero intentar IA matching
      const res = await fetch("/api/ia-matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil_id: userId, contacto_id: contacto.id }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.matches?.length > 0) {
          setPropiedadesSugeridas(json.matches.map((m: any) => ({
            id: m.id, titulo: m.titulo,
            compatibilidad: m.compatibilidad, razon: m.razon,
          })));
          setLoadingPropiedades(false);
          return;
        }
      }
      // Fallback: query simple por operación y presupuesto
      let query = supabase.from("cartera_propiedades").select("id, titulo, precio, moneda, operacion, zona, ciudad").eq("perfil_id", userId).eq("estado", "activa");
      if (contacto.interes === "Comprar") query = query.eq("operacion", "Venta");
      else if (contacto.interes === "Alquilar") query = query.eq("operacion", "Alquiler");
      const { data } = await query.limit(20);
      let resultado = (data as any[]) ?? [];
      if (contacto.presupuesto_min || contacto.presupuesto_max) {
        resultado = resultado.filter((p: any) => {
          if (contacto.presupuesto_min && p.precio && p.precio < contacto.presupuesto_min) return false;
          if (contacto.presupuesto_max && p.precio && p.precio > contacto.presupuesto_max) return false;
          return true;
        });
      }
      setPropiedadesSugeridas(resultado);
    } catch { setPropiedadesSugeridas([]); }
    setLoadingPropiedades(false);
  };

  // ── CRUD Negocios ─────────────────────────────────────────────────────────
  const abrirFormNuevoNegocio = () => { setEditandoNegocioId(null); setFormNegocio(FORM_NEGOCIO_VACIO); setMostrarFormNegocio(true); };
  const abrirFormEditarNegocio = (n: Negocio) => {
    setEditandoNegocioId(n.id);
    setFormNegocio({ titulo: n.titulo, tipo_operacion: n.tipo_operacion, etapa: n.etapa, descripcion: n.descripcion ?? "", direccion: n.direccion ?? "", valor_operacion: n.valor_operacion?.toString() ?? "", moneda: n.moneda, honorarios_pct: n.honorarios_pct?.toString() ?? "3", fecha_primer_contacto: n.fecha_primer_contacto ?? "", fecha_visita: n.fecha_visita ?? "", fecha_reserva: n.fecha_reserva ?? "", fecha_escritura: n.fecha_escritura ?? "", fecha_cierre: n.fecha_cierre ?? "", etiquetas: (n.etiquetas ?? []).join(", "), notas: n.notas ?? "", contacto_id: n.contacto_id ?? "" });
    setMostrarFormNegocio(true);
  };

  const guardarNegocio = async () => {
    if (!userId || !formNegocio.titulo) return;
    setGuardandoNegocio(true);
    const etiquetasArr = formNegocio.etiquetas.split(",").map(e => e.trim()).filter(Boolean);
    const datos = { perfil_id: userId, titulo: formNegocio.titulo, tipo_operacion: formNegocio.tipo_operacion, etapa: formNegocio.etapa, descripcion: formNegocio.descripcion || null, direccion: formNegocio.direccion || null, valor_operacion: formNegocio.valor_operacion ? parseFloat(formNegocio.valor_operacion) : null, moneda: formNegocio.moneda, honorarios_pct: formNegocio.honorarios_pct ? parseFloat(formNegocio.honorarios_pct) : 3, fecha_primer_contacto: formNegocio.fecha_primer_contacto || null, fecha_visita: formNegocio.fecha_visita || null, fecha_reserva: formNegocio.fecha_reserva || null, fecha_escritura: formNegocio.fecha_escritura || null, fecha_cierre: formNegocio.fecha_cierre || null, etiquetas: etiquetasArr.length > 0 ? etiquetasArr : null, notas: formNegocio.notas || null, contacto_id: formNegocio.contacto_id || null, updated_at: new Date().toISOString() };
    if (editandoNegocioId) { await supabase.from("crm_negocios").update(datos).eq("id", editandoNegocioId); } else { await supabase.from("crm_negocios").insert(datos); }
    setGuardandoNegocio(false); setMostrarFormNegocio(false); cargarNegocios(userId);
  };

  const eliminarNegocio = async (id: string) => {
    if (!confirm("¿Eliminar este negocio?")) return;
    await supabase.from("crm_negocios").delete().eq("id", id);
    if (userId) cargarNegocios(userId);
  };

  const avanzarEtapa = async (n: Negocio) => {
    const idx = ETAPAS_NEGOCIO.findIndex(e => e.value === n.etapa);
    if (idx < ETAPAS_NEGOCIO.length - 1) {
      const nuevaEtapa = ETAPAS_NEGOCIO[idx + 1].value;
      await supabase.from("crm_negocios").update({ etapa: nuevaEtapa, updated_at: new Date().toISOString() }).eq("id", n.id);
      if (userId) cargarNegocios(userId);
    }
  };

  // ── CRUD Tareas ───────────────────────────────────────────────────────────
  const abrirFormNuevaTarea = () => { setEditandoTareaId(null); setFormTarea(FORM_TAREA_VACIO); setMostrarFormTarea(true); };
  const abrirFormEditarTarea = (t: Tarea) => {
    setEditandoTareaId(t.id);
    setFormTarea({ titulo: t.titulo, descripcion: t.descripcion ?? "", tipo: t.tipo, prioridad: t.prioridad, fecha_vencimiento: t.fecha_vencimiento ?? "", notas: t.notas ?? "", contacto_id: t.contacto_id ?? "", negocio_id: t.negocio_id ?? "", etiquetas: (t.etiquetas ?? []).join(", ") });
    setMostrarFormTarea(true);
  };

  const guardarTarea = async () => {
    if (!userId || !formTarea.titulo) return;
    setGuardandoTarea(true);
    const etiquetasArr = formTarea.etiquetas.split(",").map(e => e.trim()).filter(Boolean);
    const datos = { perfil_id: userId, titulo: formTarea.titulo, descripcion: formTarea.descripcion || null, tipo: formTarea.tipo, prioridad: formTarea.prioridad, estado: "pendiente", fecha_vencimiento: formTarea.fecha_vencimiento || null, notas: formTarea.notas || null, contacto_id: formTarea.contacto_id || null, negocio_id: formTarea.negocio_id || null, etiquetas: etiquetasArr.length > 0 ? etiquetasArr : null, updated_at: new Date().toISOString() };
    if (editandoTareaId) { await supabase.from("crm_tareas").update(datos).eq("id", editandoTareaId); } else { await supabase.from("crm_tareas").insert(datos); }
    setGuardandoTarea(false); setMostrarFormTarea(false); cargarTareas(userId);
  };

  const completarTarea = async (t: Tarea) => {
    const nuevoEstado = t.estado === "completada" ? "pendiente" : "completada";
    await supabase.from("crm_tareas").update({ estado: nuevoEstado, fecha_completada: nuevoEstado === "completada" ? new Date().toISOString().split("T")[0] : null, updated_at: new Date().toISOString() }).eq("id", t.id);
    if (userId) cargarTareas(userId);
  };

  const eliminarTarea = async (id: string) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    await supabase.from("crm_tareas").delete().eq("id", id);
    if (userId) cargarTareas(userId);
  };

  // ── CRUD Notas ────────────────────────────────────────────────────────────
  const abrirFormNuevaNota = () => { setEditandoNotaId(null); setFormNota(FORM_NOTA_VACIO); setMostrarFormNota(true); };
  const abrirFormEditarNota = (n: NotaCRM) => {
    setEditandoNotaId(n.id);
    setFormNota({ titulo: n.titulo ?? "", contenido: n.contenido, tipo: n.tipo, contacto_id: n.contacto_id ?? "", negocio_id: n.negocio_id ?? "", etiquetas: (n.etiquetas ?? []).join(", ") });
    setMostrarFormNota(true);
  };

  const guardarNota = async () => {
    if (!userId || !formNota.contenido) return;
    setGuardandoNota(true);
    const etiquetasArr = formNota.etiquetas.split(",").map(e => e.trim()).filter(Boolean);
    const datos = { perfil_id: userId, titulo: formNota.titulo || null, contenido: formNota.contenido, tipo: formNota.tipo, contacto_id: formNota.contacto_id || null, negocio_id: formNota.negocio_id || null, etiquetas: etiquetasArr.length > 0 ? etiquetasArr : null, updated_at: new Date().toISOString() };
    if (editandoNotaId) { await supabase.from("crm_notas").update(datos).eq("id", editandoNotaId); } else { await supabase.from("crm_notas").insert(datos); }
    setGuardandoNota(false); setMostrarFormNota(false); cargarNotas(userId);
  };

  const toggleFijarNota = async (n: NotaCRM) => {
    await supabase.from("crm_notas").update({ fijada: !n.fijada }).eq("id", n.id);
    if (userId) cargarNotas(userId);
  };

  const eliminarNota = async (id: string) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    await supabase.from("crm_notas").delete().eq("id", id);
    if (userId) cargarNotas(userId);
  };

  // ── Filtrados ─────────────────────────────────────────────────────────────
  const todasEtiquetas = useMemo(() => { const set = new Set<string>(); contactos.forEach(c => (c.etiquetas ?? []).forEach(e => set.add(e))); return Array.from(set).sort(); }, [contactos]);

  const contactosFiltrados = useMemo(() => contactos.filter(c => {
    const archivado = c.estado === "archivado";
    if (!mostrarArchivados && archivado) return false;
    if (mostrarArchivados && !archivado) return false;
    if (filtroEtiqueta && !(c.etiquetas ?? []).includes(filtroEtiqueta)) return false;
    if (filtroEstadoLead && c.estado !== filtroEstadoLead) return false;
    if (busqueda.trim()) { const q = busqueda.toLowerCase(); return c.nombre?.toLowerCase().includes(q) || c.apellido?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.telefono?.toLowerCase().includes(q) || c.inmobiliaria?.toLowerCase().includes(q) || (c.etiquetas ?? []).some(e => e.toLowerCase().includes(q)); }
    return true;
  }), [contactos, busqueda, filtroEtiqueta, mostrarArchivados, filtroEstadoLead]);

  const negociosFiltrados = useMemo(() => negocios.filter(n => {
    if (filtroEtapaNegocio && n.etapa !== filtroEtapaNegocio) return false;
    if (busquedaNegocio.trim()) { const q = busquedaNegocio.toLowerCase(); return n.titulo?.toLowerCase().includes(q) || n.direccion?.toLowerCase().includes(q); }
    return true;
  }), [negocios, filtroEtapaNegocio, busquedaNegocio]);

  const tareasFiltradas = useMemo(() => tareas.filter(t => {
    if (filtroEstadoTarea && t.estado !== filtroEstadoTarea) return false;
    if (filtroPrioridadTarea && t.prioridad !== filtroPrioridadTarea) return false;
    return true;
  }), [tareas, filtroEstadoTarea, filtroPrioridadTarea]);

  const notasFiltradas = useMemo(() => notas.filter(n => {
    if (busquedaNota.trim()) { const q = busquedaNota.toLowerCase(); return n.titulo?.toLowerCase().includes(q) || n.contenido?.toLowerCase().includes(q); }
    return true;
  }), [notas, busquedaNota]);

  const hoy = new Date().toISOString().split("T")[0];
  const iniciales = (c: Contacto) => `${c.nombre?.charAt(0) ?? ""}${c.apellido?.charAt(0) ?? ""}`.toUpperCase();
  const recordatoriosPendientes = recordatorios.filter(r => !r.completado);
  const recordatoriosVencidos = recordatoriosPendientes.filter(r => r.fecha_recordatorio < hoy);
  const tareasVencidas = tareas.filter(t => t.estado !== "completada" && t.fecha_vencimiento && t.fecha_vencimiento < hoy).length;
  const nombreContacto = (id: string | null) => { if (!id) return null; const c = contactos.find(x => x.id === id); return c ? `${c.apellido ? c.apellido + ", " : ""}${c.nombre}` : null; };
  const tituloNegocio = (id: string | null) => { if (!id) return null; const n = negocios.find(x => x.id === id); return n?.titulo ?? null; };

  // ── Smart Prospecting ─────────────────────────────────────────────────────
  type MatchProspeccion = { contacto: Contacto; negocio: Negocio; score: number; razon: string[] };
  const matchesProspeccion = useMemo((): MatchProspeccion[] => {
    const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();
    const negociosActivos = negocios.filter(n => !["cerrado","perdido"].includes(n.etapa) && !n.archivado);
    const contactosBuscadores = contactos.filter(c => c.estado !== "archivado" && ["Comprar","Alquilar","Invertir"].includes(c.interes ?? ""));
    const matches: MatchProspeccion[] = [];
    for (const c of contactosBuscadores) {
      const tiposNeg = c.interes === "Alquilar" ? ["alquiler","alquiler_temporal"] : ["venta"];
      for (const n of negociosActivos) {
        if (!tiposNeg.includes(n.tipo_operacion)) continue;
        const razon: string[] = [];
        let score = 0;
        if (c.presupuesto_min != null || c.presupuesto_max != null) {
          if (n.valor_operacion != null) {
            const min = c.presupuesto_min ?? 0;
            const max = c.presupuesto_max ?? Infinity;
            if (n.valor_operacion >= min && n.valor_operacion <= max) { score++; razon.push("Presupuesto compatible"); }
          }
        }
        if (c.zona_interes && n.direccion) {
          const zona = norm(c.zona_interes);
          const dir = norm(n.direccion);
          if (zona.split(/\s+/).some(w => w.length > 2 && dir.includes(w))) { score++; razon.push("Zona coincide"); }
        }
        matches.push({ contacto: c, negocio: n, score, razon });
      }
    }
    return matches.sort((a, b) => b.score - a.score);
  }, [contactos, negocios]);

  // ── Duplicados ────────────────────────────────────────────────────────────
  const abrirDuplicados = () => {
    const norm = (s: string | null) => (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
    const grupos: Contacto[][] = [];
    const vistos = new Set<string>();
    contactos.forEach(c => {
      if (vistos.has(c.id)) return;
      const matches = contactos.filter(x => {
        if (x.id === c.id) return false;
        const mismoNombre = norm(c.nombre) && norm(x.nombre) && norm(`${c.nombre} ${c.apellido}`) === norm(`${x.nombre} ${x.apellido}`);
        const mismoTel = c.telefono && x.telefono && norm(c.telefono) === norm(x.telefono);
        const mismoEmail = c.email && x.email && norm(c.email) === norm(x.email);
        return mismoNombre || mismoTel || mismoEmail;
      });
      if (matches.length > 0) {
        const grupo = [c, ...matches];
        grupo.forEach(x => vistos.add(x.id));
        grupos.push(grupo);
      }
    });
    const seleccion: Record<number, string> = {};
    grupos.forEach((g, i) => { seleccion[i] = g[0].id; });
    setGruposDuplicados(grupos);
    setMergeSeleccion(seleccion);
    setMostrarDuplicados(true);
  };

  const ejecutarMerge = async (grupo: Contacto[], masterId: string, idx: number) => {
    setMergeando(true);
    const master = grupo.find(c => c.id === masterId)!;
    const duplicados = grupo.filter(c => c.id !== masterId);
    const etiquetasUnion = Array.from(new Set([
      ...(master.etiquetas ?? []),
      ...duplicados.flatMap(d => d.etiquetas ?? []),
    ]));
    const patch: Partial<Contacto> = {
      telefono: master.telefono ?? duplicados.find(d => d.telefono)?.telefono ?? null,
      email: master.email ?? duplicados.find(d => d.email)?.email ?? null,
      inmobiliaria: master.inmobiliaria ?? duplicados.find(d => d.inmobiliaria)?.inmobiliaria ?? null,
      matricula: master.matricula ?? duplicados.find(d => d.matricula)?.matricula ?? null,
      origen: master.origen ?? duplicados.find(d => d.origen)?.origen ?? null,
      interes: master.interes ?? duplicados.find(d => d.interes)?.interes ?? null,
      zona_interes: master.zona_interes ?? duplicados.find(d => d.zona_interes)?.zona_interes ?? null,
      presupuesto_min: master.presupuesto_min ?? duplicados.find(d => d.presupuesto_min)?.presupuesto_min ?? null,
      presupuesto_max: master.presupuesto_max ?? duplicados.find(d => d.presupuesto_max)?.presupuesto_max ?? null,
      etiquetas: etiquetasUnion.length > 0 ? etiquetasUnion : null,
      notas: [master.notas, ...duplicados.map(d => d.notas)].filter(Boolean).join("\n---\n") || null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("crm_contactos").update(patch).eq("id", masterId);
    for (const dup of duplicados) {
      await supabase.from("crm_interacciones").update({ contacto_id: masterId }).eq("contacto_id", dup.id);
      await supabase.from("crm_recordatorios").update({ contacto_id: masterId }).eq("contacto_id", dup.id);
      await supabase.from("crm_negocios").update({ contacto_id: masterId }).eq("contacto_id", dup.id);
      await supabase.from("crm_tareas").update({ contacto_id: masterId }).eq("contacto_id", dup.id);
      await supabase.from("crm_notas").update({ contacto_id: masterId }).eq("contacto_id", dup.id);
      await supabase.from("crm_contactos").delete().eq("id", dup.id);
    }
    setGruposDuplicados(prev => prev.filter((_, i) => i !== idx));
    setMergeSeleccion(prev => { const n = {...prev}; delete n[idx]; return n; });
    setMergeando(false);
    if (userId) cargarContactos(userId);
  };

  // ── Import Excel ─────────────────────────────────────────────────────────
  const handleArchivoImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError("");
    setImportRows([]);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        if (rows.length === 0) { setImportError("El archivo está vacío."); return; }
        setImportRows(rows);
      } catch {
        setImportError("No se pudo leer el archivo. Verificá que sea un .xlsx válido.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmarImport = async () => {
    if (!userId || importRows.length === 0) return;
    setImportando(true);
    const registros = importRows.map(r => ({
      perfil_id: userId,
      nombre: r["Nombre"] || r["nombre"] || "Sin nombre",
      apellido: r["Apellido"] || r["apellido"] || null,
      telefono: r["Teléfono"] || r["Telefono"] || r["telefono"] || null,
      email: r["Email"] || r["email"] || null,
      inmobiliaria: r["Inmobiliaria"] || r["inmobiliaria"] || null,
      matricula: r["Matrícula"] || r["Matricula"] || r["matricula"] || null,
      tipo: r["Tipo"] || r["tipo"] || "cliente",
      origen: r["Origen"] || r["origen"] || null,
      interes: r["Interés"] || r["Interes"] || r["interes"] || null,
      zona_interes: r["Zona"] || r["zona_interes"] || null,
      presupuesto_min: r["Presup. min"] ? parseFloat(r["Presup. min"]) || null : null,
      presupuesto_max: r["Presup. max"] ? parseFloat(r["Presup. max"]) || null : null,
      moneda: r["Moneda"] || r["moneda"] || "USD",
      etiquetas: r["Etiquetas"] ? r["Etiquetas"].split(",").map((x: string) => x.trim()).filter(Boolean) : null,
      notas: r["Notas"] || r["notas"] || null,
    }));
    await supabase.from("crm_contactos").insert(registros);
    setImportando(false);
    setMostrarImport(false);
    setImportRows([]);
    cargarContactos(userId);
  };

  // ── Export Excel ─────────────────────────────────────────────────────────
  const exportarContactosExcel = () => {
    const filas = contactosFiltrados.map(c => ({
      Nombre: c.nombre,
      Apellido: c.apellido ?? "",
      Tipo: c.tipo ?? "",
      Teléfono: c.telefono ?? "",
      Email: c.email ?? "",
      Inmobiliaria: c.inmobiliaria ?? "",
      Matrícula: c.matricula ?? "",
      Etiquetas: (c.etiquetas ?? []).join(", "),
      Interés: c.interes ?? "",
      Zona: c.zona_interes ?? "",
      "Presup. min": c.presupuesto_min ?? "",
      "Presup. max": c.presupuesto_max ?? "",
      Moneda: c.moneda ?? "",
      Origen: c.origen ?? "",
      Notas: c.notas ?? "",
      "Creado": formatFecha(c.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contactos");
    XLSX.writeFile(wb, `contactos-gfi-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');

        /* ── Layout principal ── */
        .crm-root { display: flex; flex-direction: column; height: calc(100vh - 70px); overflow: hidden; background: #080808; }

        /* ── Tabs principales ── */
        .crm-tabs-bar { display: flex; align-items: center; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.07); background: #0a0a0a; flex-shrink: 0; padding: 0 16px; }
        .crm-tab-main { padding: 13px 18px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); cursor: pointer; border-bottom: 2px solid transparent; background: none; border-top: none; border-left: none; border-right: none; transition: all 0.15s; white-space: nowrap; }
        .crm-tab-main:hover { color: rgba(255,255,255,0.6); }
        .crm-tab-main.activo { color: #fff; border-bottom-color: #cc0000; }
        .crm-tab-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 4px; background: #cc0000; color: #fff; font-size: 8px; font-weight: 700; border-radius: 8px; margin-left: 6px; font-family: 'Montserrat',sans-serif; }
        .crm-tabs-spacer { flex: 1; }

        /* ── Contenido tab ── */
        .crm-tab-content { flex: 1; overflow: hidden; display: flex; }

        /* ── Shared: layout split ── */
        .crm-split { display: flex; height: 100%; overflow: hidden; }
        .crm-panel-izq { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.07); background: #0a0a0a; }
        .crm-panel-der { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #0d0d0d; }

        /* ── Panel header ── */
        .crm-panel-header { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .crm-panel-titulo { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 10px; }
        .crm-panel-titulo span { color: #cc0000; }

        /* ── Search ── */
        .crm-search-wrap { position: relative; margin-bottom: 8px; }
        .crm-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: rgba(255,255,255,0.2); pointer-events: none; }
        .crm-search { width: 100%; padding: 7px 10px 7px 28px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; }
        .crm-search:focus { border-color: rgba(200,0,0,0.35); }
        .crm-search::placeholder { color: rgba(255,255,255,0.18); }

        /* ── Etiquetas filtro ── */
        .crm-etiquetas-filtro { display: flex; gap: 4px; flex-wrap: wrap; }
        .crm-etq-btn { padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.35); font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .crm-etq-btn:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.6); }
        .crm-etq-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }

        /* ── Barra lista ── */
        .crm-lista-barra { display: flex; align-items: center; justify-content: space-between; padding: 7px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .crm-count { font-size: 10px; color: rgba(255,255,255,0.22); font-family: 'Inter',sans-serif; }
        .crm-btn-nuevo { padding: 5px 12px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: background 0.15s; }
        .crm-btn-nuevo:hover { background: #e60000; }
        .crm-btn-export { padding: 5px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .crm-btn-export:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.2); }
        .crm-btn-export:disabled { opacity: 0.3; cursor: not-allowed; }
        .crm-btn-export-activo { background: rgba(255,165,0,0.08) !important; border-color: rgba(255,165,0,0.3) !important; color: rgba(255,165,0,0.8) !important; }
        .crm-btn-export-prospeccion:not(:disabled) { border-color: rgba(251,191,36,0.25) !important; color: rgba(251,191,36,0.75) !important; }
        .crm-btn-export-prospeccion:not(:disabled):hover { background: rgba(251,191,36,0.07) !important; color: rgba(251,191,36,1) !important; }

        /* ── Items lista ── */
        .crm-lista-items { flex: 1; overflow-y: auto; }
        .crm-lista-items::-webkit-scrollbar { width: 3px; }
        .crm-lista-items::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .crm-item { padding: 11px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.12s; display: flex; align-items: center; gap: 10px; }
        .crm-item:hover { background: rgba(255,255,255,0.025); }
        .crm-item.activo { background: rgba(200,0,0,0.05); border-left: 2px solid #cc0000; }
        .crm-avatar { width: 34px; height: 34px; border-radius: 7px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.18); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 800; color: #cc0000; flex-shrink: 0; }
        .crm-item-info { flex: 1; min-width: 0; }
        .crm-item-nombre { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .crm-item-sub { font-size: 10px; color: rgba(255,255,255,0.32); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .crm-item-etqs { display: flex; gap: 3px; flex-wrap: wrap; margin-top: 4px; }
        .crm-etq { font-size: 8px; padding: 1px 5px; border-radius: 8px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.18); color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .crm-empty-lista { padding: 40px 14px; text-align: center; color: rgba(255,255,255,0.18); font-size: 12px; font-family: 'Inter',sans-serif; line-height: 1.6; }

        /* ── Panel detalle contacto ── */
        .crm-detalle-vacio { flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.12); font-size: 13px; font-style: italic; font-family: 'Inter',sans-serif; }
        .crm-detalle-header { padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-shrink: 0; }
        .crm-detalle-nombre { font-family: 'Montserrat',sans-serif; font-size: 17px; font-weight: 800; color: #fff; }
        .crm-detalle-tipo { font-size: 10px; color: rgba(255,255,255,0.32); margin-top: 3px; text-transform: uppercase; font-family: 'Montserrat',sans-serif; font-weight: 600; letter-spacing: 0.1em; }
        .crm-detalle-acciones { display: flex; gap: 7px; }
        .crm-btn-editar { padding: 5px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-eliminar { padding: 5px 12px; background: rgba(200,0,0,0.07); border: 1px solid rgba(200,0,0,0.18); border-radius: 3px; color: rgba(200,0,0,0.65); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-detalle-datos { padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; flex-shrink: 0; }
        .crm-dato { display: flex; flex-direction: column; gap: 2px; }
        .crm-dato-label { font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.22); }
        .crm-dato-val { font-size: 12px; color: rgba(255,255,255,0.65); }
        .crm-detalle-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
        .crm-tab { padding: 9px 16px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; background: none; border-top: none; border-left: none; border-right: none; }
        .crm-tab.activo { color: #fff; border-bottom-color: #cc0000; }
        .crm-tab:hover { color: rgba(255,255,255,0.55); }
        .crm-detalle-body { flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }
        .crm-detalle-body::-webkit-scrollbar { width: 3px; }
        .crm-detalle-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }

        /* ── Interacciones / Recordatorios ── */
        .crm-nueva-interaccion { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 11px; display: flex; flex-direction: column; gap: 8px; }
        .crm-tipo-btns { display: flex; gap: 5px; flex-wrap: wrap; }
        .crm-tipo-btn { padding: 4px 9px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.09); background: transparent; color: rgba(255,255,255,0.38); font-size: 10px; cursor: pointer; transition: all 0.12s; font-family: 'Inter',sans-serif; }
        .crm-tipo-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.09); color: #fff; }
        .crm-textarea { width: 100%; padding: 7px 10px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; resize: none; min-height: 55px; box-sizing: border-box; }
        .crm-textarea:focus { border-color: rgba(200,0,0,0.35); }
        .crm-textarea::placeholder { color: rgba(255,255,255,0.18); }
        .crm-btn-guardar-int { align-self: flex-end; padding: 5px 14px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-guardar-int:disabled { opacity: 0.45; cursor: not-allowed; }
        .crm-interaccion { background: rgba(12,12,12,0.9); border: 1px solid rgba(255,255,255,0.055); border-radius: 6px; padding: 9px 11px; display: flex; gap: 9px; }
        .crm-int-icono { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
        .crm-int-body { flex: 1; }
        .crm-int-tipo { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.27); margin-bottom: 2px; }
        .crm-int-desc { font-size: 12px; color: rgba(255,255,255,0.65); line-height: 1.5; }
        .crm-int-fecha { font-size: 10px; color: rgba(255,255,255,0.18); margin-top: 3px; }
        .crm-int-del { background: none; border: none; color: rgba(255,255,255,0.18); font-size: 14px; cursor: pointer; flex-shrink: 0; padding: 0 3px; }
        .crm-int-del:hover { color: #ff4444; }
        .crm-nuevo-rec { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 11px; display: flex; gap: 7px; flex-wrap: wrap; align-items: flex-end; }
        .crm-input-sm { padding: 6px 9px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; }
        .crm-input-sm:focus { border-color: rgba(200,0,0,0.35); }
        .crm-input-sm::placeholder { color: rgba(255,255,255,0.18); }
        .crm-rec { background: rgba(12,12,12,0.9); border: 1px solid rgba(255,255,255,0.055); border-radius: 6px; padding: 9px 11px; display: flex; align-items: center; gap: 9px; }
        .crm-rec.vencido { border-color: rgba(200,0,0,0.2); background: rgba(200,0,0,0.025); }
        .crm-rec.completado { opacity: 0.38; }
        .crm-rec-check { width: 17px; height: 17px; border-radius: 4px; border: 2px solid rgba(255,255,255,0.18); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.12s; }
        .crm-rec-check.hecho { background: #22c55e; border-color: #22c55e; }
        .crm-rec-body { flex: 1; }
        .crm-rec-desc { font-size: 12px; color: rgba(255,255,255,0.65); }
        .crm-rec-fecha { font-size: 10px; color: rgba(255,255,255,0.22); margin-top: 2px; }
        .crm-rec-del { background: none; border: none; color: rgba(255,255,255,0.18); font-size: 14px; cursor: pointer; padding: 0 3px; }
        .crm-rec-del:hover { color: #ff4444; }

        /* ── Negocios: kanban-list ── */
        .neg-full { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .neg-toolbar { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex-shrink: 0; }
        .neg-filtros-etapa { display: flex; gap: 5px; flex-wrap: wrap; }
        .neg-list { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
        .neg-list::-webkit-scrollbar { width: 3px; }
        .neg-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .neg-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px; padding: 13px 15px; display: flex; gap: 12px; align-items: flex-start; transition: border-color 0.15s; }
        .neg-card:hover { border-color: rgba(255,255,255,0.12); }
        .neg-card-main { flex: 1; min-width: 0; }
        .neg-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
        .neg-card-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 6px; }
        .neg-chip { font-size: 9px; padding: 2px 7px; border-radius: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; border: 1px solid; }
        .neg-chip-op { border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.4); }
        .neg-chip-etapa { }
        .neg-card-dir { font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .neg-card-valor { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .neg-card-honor { font-size: 10px; color: rgba(255,255,255,0.3); margin-left: 6px; }
        .neg-card-contacto { font-size: 10px; color: rgba(200,0,0,0.6); margin-top: 4px; }
        .neg-card-acciones { display: flex; flex-direction: column; gap: 5px; align-items: flex-end; flex-shrink: 0; }
        .neg-btn-avanzar { padding: 4px 10px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; color: rgba(200,0,0,0.7); font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .neg-btn-avanzar:hover { background: rgba(200,0,0,0.15); }
        .neg-btn-edit { padding: 3px 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: rgba(255,255,255,0.35); font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; }
        .neg-btn-del { padding: 3px 8px; background: transparent; border: 1px solid rgba(200,0,0,0.15); border-radius: 3px; color: rgba(200,0,0,0.4); font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; }

        /* ── Tareas ── */
        .tar-full { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .tar-toolbar { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex-shrink: 0; }
        .tar-list { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
        .tar-list::-webkit-scrollbar { width: 3px; }
        .tar-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .tar-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 11px 13px; display: flex; gap: 10px; align-items: flex-start; transition: border-color 0.12s; }
        .tar-card:hover { border-color: rgba(255,255,255,0.11); }
        .tar-card.completada { opacity: 0.4; }
        .tar-check { width: 18px; height: 18px; border-radius: 5px; border: 2px solid rgba(255,255,255,0.18); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; transition: all 0.12s; }
        .tar-check.hecho { background: #22c55e; border-color: #22c55e; }
        .tar-card-main { flex: 1; min-width: 0; }
        .tar-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .tar-card.completada .tar-card-titulo { text-decoration: line-through; color: rgba(255,255,255,0.4); }
        .tar-card-meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .tar-chip-prio { font-size: 8px; padding: 2px 6px; border-radius: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; border: 1px solid; }
        .tar-chip-tipo { font-size: 9px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        .tar-vence { font-size: 10px; color: rgba(255,255,255,0.22); margin-top: 4px; }
        .tar-vence.vencido { color: #ef4444; }
        .tar-ref { font-size: 10px; color: rgba(200,0,0,0.5); margin-top: 3px; }
        .tar-card-acciones { display: flex; gap: 5px; flex-shrink: 0; }

        /* ── Notas ── */
        .not-full { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .not-toolbar { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
        .not-grid { flex: 1; overflow-y: auto; padding: 14px 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; align-content: start; }
        .not-grid::-webkit-scrollbar { width: 3px; }
        .not-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .not-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px; padding: 13px 15px; display: flex; flex-direction: column; gap: 7px; transition: border-color 0.12s; cursor: pointer; }
        .not-card:hover { border-color: rgba(255,255,255,0.12); }
        .not-card.fijada { border-color: rgba(200,0,0,0.25); background: rgba(200,0,0,0.025); }
        .not-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .not-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #fff; flex: 1; }
        .not-card-tipo { font-size: 8px; padding: 2px 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.35); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .not-card-contenido { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .not-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .not-card-fecha { font-size: 10px; color: rgba(255,255,255,0.2); }
        .not-card-ref { font-size: 10px; color: rgba(200,0,0,0.5); }
        .not-card-acciones { display: flex; gap: 5px; }
        .not-btn-pin { background: none; border: none; font-size: 14px; cursor: pointer; color: rgba(255,255,255,0.2); padding: 0; transition: color 0.12s; }
        .not-btn-pin.fijada { color: #cc0000; }
        .not-btn-pin:hover { color: rgba(255,255,255,0.5); }

        /* ── Modal compartido ── */
        .crm-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: flex-start; justify-content: center; z-index: 300; padding: 20px; overflow-y: auto; }
        .crm-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.22); border-radius: 8px; padding: 26px 30px; width: 100%; max-width: 560px; margin: auto; position: relative; }
        .crm-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .crm-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 18px; }
        .crm-modal-titulo span { color: #cc0000; }
        .crm-field { margin-bottom: 11px; }
        .crm-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.32); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .crm-input { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; transition: border-color 0.18s; }
        .crm-input:focus { border-color: rgba(200,0,0,0.45); }
        .crm-input::placeholder { color: rgba(255,255,255,0.18); }
        .crm-select { width: 100%; padding: 8px 11px; background: rgba(12,12,12,0.95); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .crm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .crm-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .crm-divider { height: 1px; background: rgba(255,255,255,0.065); margin: 12px 0; }
        .crm-section-label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.18); margin-bottom: 9px; }
        .crm-modal-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 18px; }
        .crm-btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.13); border-radius: 3px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-save { padding: 8px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-save:disabled { opacity: 0.45; cursor: not-allowed; }
        .crm-spinner { display: inline-block; width: 9px; height: 9px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Etapas picker en form negocio ── */
        .etapa-grid { display: flex; flex-wrap: wrap; gap: 5px; }
        .etapa-btn { padding: 4px 10px; border-radius: 4px; border: 1px solid; font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; transition: all 0.12s; background: transparent; }

        /* ── Lead estado badge ── */
        .lead-badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 8px; font-family: 'Montserrat',sans-serif; font-weight: 700; border: 1px solid; margin-top: 3px; }
        /* ── Pipeline section ── */
        .pipeline-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
        .pipeline-btn { padding: 5px 11px; border-radius: 5px; border: 1px solid; font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; transition: all 0.15s; background: transparent; }
        .pipeline-btn:hover { opacity: 0.9; }
        /* ── Plantillas popup ── */
        .plantillas-popup { position: absolute; bottom: 110%; left: 0; background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; padding: 10px; min-width: 280px; max-width: 340px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
        .plantilla-item { padding: 7px 9px; border-radius: 4px; cursor: pointer; transition: background 0.12s; display: flex; align-items: flex-start; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .plantilla-item:last-child { border-bottom: none; }
        .plantilla-item:hover { background: rgba(255,255,255,0.04); }
        .plantilla-titulo { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; color: #fff; }
        .plantilla-preview { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
        /* ── Prop sugeridas ── */
        .prop-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
        .prop-card-dir { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .prop-card-meta { font-size: 10px; color: rgba(255,255,255,0.4); display: flex; gap: 8px; flex-wrap: wrap; }

        @media (max-width: 768px) {
          .crm-tabs-bar { overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 0 8px; }
          .crm-tab-main { padding: 12px 12px; font-size: 9px; letter-spacing: 0.08em; flex-shrink: 0; }
          .crm-split { flex-direction: column; }
          .crm-panel-izq { width: 100%; height: 300px; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07); }
          .not-grid { grid-template-columns: 1fr; }
          .neg-filtros-etapa { flex-wrap: wrap; gap: 4px; }
          .tar-toolbar { flex-wrap: wrap; gap: 6px; }
        }
      `}</style>

      <div className="crm-root">

        {/* ── Tabs principales ── */}
        <div className="crm-tabs-bar">
          <button className={`crm-tab-main${tabPrincipal === "dashboard" ? " activo" : ""}`} onClick={() => setTabPrincipal("dashboard")}>Dashboard</button>
          {(["contactos", "negocios", "tareas", "notas"] as const).map(tab => (
            <button key={tab} className={`crm-tab-main${tabPrincipal === tab ? " activo" : ""}`} onClick={() => setTabPrincipal(tab)}>
              {tab === "contactos" && <>{mostrarArchivados ? "Archivados" : "Contactos"} {contactos.filter(c => c.estado !== "archivado").length > 0 && <span className="crm-tab-badge">{contactos.filter(c => c.estado !== "archivado").length}</span>}</>}
              {tab === "negocios" && <>Negocios {negocios.length > 0 && <span className="crm-tab-badge">{negocios.length}</span>}</>}
              {tab === "tareas" && <>Tareas {tareasVencidas > 0 && <span className="crm-tab-badge">{tareasVencidas}</span>}</>}
              {tab === "notas" && <>Notas {notas.length > 0 && <span className="crm-tab-badge">{notas.length}</span>}</>}
            </button>
          ))}
          <div className="crm-tabs-spacer" />
          <Link href="/crm/portales" className="crm-tab-main" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>🔗 Portales</Link>
          <Link href="/crm/cartera" className="crm-tab-main" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>🏠 Cartera</Link>
          <Link href="/crm/llaves" className="crm-tab-main" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>🔑 Llaves</Link>
          <Link href="/crm/honorarios" className="crm-tab-main" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>💰 Honorarios</Link>
          <Link href="/crm/metas" className="crm-tab-main" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>🎯 Metas</Link>
          <Link href="/crm/post-cierre" className="crm-tab-main" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>📋 Post-cierre</Link>
          <Link href="/agenda" className="crm-tab-main" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>📆 Agenda</Link>
        </div>

        <div className="crm-tab-content">

          {/* ══════════════════════════════════════════════════
              TAB DASHBOARD
          ══════════════════════════════════════════════════ */}
          {tabPrincipal === "dashboard" && (() => {
            const contactosActivos = contactos.filter(c => c.estado !== "archivado");
            const negociosActivos = negocios.filter(n => !["cerrado","perdido"].includes(n.etapa));
            const tareasPendientes = tareas.filter(t => t.estado !== "completada");
            const tareasHoy = tareasPendientes.filter(t => t.fecha_vencimiento === hoy);
            const tareasAtrasadas = tareasPendientes.filter(t => t.fecha_vencimiento && t.fecha_vencimiento < hoy);
            const valorPipeline = negociosActivos.reduce((s, n) => s + (n.valor_operacion ?? 0), 0);
            const negCerrados = negocios.filter(n => n.etapa === "cerrado");
            const honorariosEst = negociosActivos.reduce((s, n) => s + ((n.valor_operacion ?? 0) * ((n.honorarios_pct ?? 3) / 100)), 0);
            const etapaConteo = ETAPAS_NEGOCIO.map(e => ({ ...e, count: negocios.filter(n => n.etapa === e.value).length })).filter(e => e.count > 0);
            const maxEtapa = Math.max(...etapaConteo.map(e => e.count), 1);
            const interaccRecientes = [] as { tipo: string; desc: string; fecha: string }[];
            return (
              <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:20,background:"#080808"}}>
                {/* KPIs */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
                  {[
                    { label:"Contactos activos", val: contactosActivos.length, color:"#cc0000", icon:"👥" },
                    { label:"Negocios activos", val: negociosActivos.length, color:"#3b82f6", icon:"🏠" },
                    { label:"Tareas pendientes", val: tareasPendientes.length, color:"#f59e0b", icon:"📋" },
                    { label:"Vencidas / Hoy", val: `${tareasAtrasadas.length} / ${tareasHoy.length}`, color: tareasAtrasadas.length > 0 ? "#ef4444" : "#22c55e", icon:"⚠️" },
                    { label:"Pipeline (valor)", val: valorPipeline > 0 ? `USD ${(valorPipeline/1000).toFixed(0)}k` : "—", color:"#a78bfa", icon:"💰" },
                    { label:"Hon. estimados", val: honorariosEst > 0 ? `USD ${(honorariosEst/1000).toFixed(1)}k` : "—", color:"#22c55e", icon:"✓" },
                    { label:"Cerrados", val: negCerrados.length, color:"#22c55e", icon:"🏆" },
                    { label:"Matches prospec.", val: matchesProspeccion.length, color:"#fbbf24", icon:"🎯" },
                  ].map((k,i) => (
                    <div key={i} style={{background:"#0d0d0d",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"14px 16px"}}>
                      <div style={{fontSize:16,marginBottom:6}}>{k.icon}</div>
                      <div style={{fontFamily:"Montserrat,sans-serif",fontSize:20,fontWeight:800,color:k.color,lineHeight:1}}>{k.val}</div>
                      <div style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginTop:5}}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Pipeline por etapa */}
                {etapaConteo.length > 0 && (
                  <div style={{background:"#0d0d0d",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"16px 18px"}}>
                    <div style={{fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:14}}>Pipeline — negocios por etapa</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {etapaConteo.map(e => (
                        <div key={e.value} style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:120,fontSize:10,color:"rgba(255,255,255,0.45)",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flexShrink:0}}>{e.label}</div>
                          <div style={{flex:1,height:8,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${(e.count/maxEtapa)*100}%`,background:e.color,borderRadius:4,transition:"width 0.4s"}}/>
                          </div>
                          <div style={{width:20,textAlign:"right",fontSize:11,fontFamily:"Montserrat,sans-serif",fontWeight:700,color:e.color,flexShrink:0}}>{e.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tareas vencidas + accesos rápidos */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {/* Tareas atrasadas */}
                  <div style={{background:"#0d0d0d",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"16px 18px"}}>
                    <div style={{fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:12}}>Tareas vencidas</div>
                    {tareasAtrasadas.length === 0 ? (
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",fontFamily:"Inter,sans-serif",padding:"8px 0"}}>Sin tareas vencidas ✓</div>
                    ) : tareasAtrasadas.slice(0,5).map(t => {
                      const prioridad = PRIORIDADES_TAREA.find(p => p.value === t.prioridad);
                      return (
                        <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:prioridad?.color ?? "#6b7280",marginTop:4,flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.titulo}</div>
                            <div style={{fontSize:10,color:"#ef4444",marginTop:1}}>{formatFecha(t.fecha_vencimiento!)}</div>
                          </div>
                        </div>
                      );
                    })}
                    {tareasAtrasadas.length > 5 && <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:8}}>+{tareasAtrasadas.length-5} más</div>}
                  </div>

                  {/* Accesos rápidos */}
                  <div style={{background:"#0d0d0d",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"16px 18px"}}>
                    <div style={{fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:12}}>Accesos rápidos</div>
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      {[
                        { label:"+ Nuevo contacto", tab:"contactos" as const, action: () => { setTabPrincipal("contactos"); setTimeout(abrirFormNuevoContacto, 50); } },
                        { label:"+ Nuevo negocio",  tab:"negocios" as const,  action: () => { setTabPrincipal("negocios"); setTimeout(abrirFormNuevoNegocio, 50); } },
                        { label:"+ Nueva tarea",    tab:"tareas" as const,    action: () => { setTabPrincipal("tareas"); setTimeout(abrirFormNuevaTarea, 50); } },
                        { label:"Ver contactos",    tab:"contactos" as const, action: () => setTabPrincipal("contactos") },
                        { label:"Ver pipeline",     tab:"negocios" as const,  action: () => setTabPrincipal("negocios") },
                        { label:"🎯 Prospección",   tab:"contactos" as const, action: () => { setTabPrincipal("contactos"); setTimeout(() => setMostrarProspeccion(true), 50); } },
                      ].map((a,i) => (
                        <button key={i} onClick={a.action} style={{textAlign:"left",padding:"8px 11px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:5,color:"rgba(255,255,255,0.55)",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.07em",cursor:"pointer",transition:"all 0.12s"}}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background="rgba(200,0,0,0.07)"; (e.currentTarget as HTMLButtonElement).style.borderColor="rgba(200,0,0,0.2)"; (e.currentTarget as HTMLButtonElement).style.color="#fff"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.03)"; (e.currentTarget as HTMLButtonElement).style.borderColor="rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.color="rgba(255,255,255,0.55)"; }}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {interaccRecientes.length > 0 && null}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════
              TAB CONTACTOS
          ══════════════════════════════════════════════════ */}
          {tabPrincipal === "contactos" && (
            <div className="crm-split">
              {/* Lista */}
              <div className="crm-panel-izq">
                <div className="crm-panel-header">
                  <div className="crm-panel-titulo">CRM <span>GFI®</span></div>
                  <div className="crm-search-wrap">
                    <span className="crm-search-ico">🔍</span>
                    <input className="crm-search" placeholder="Buscar contacto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                  </div>
                  {todasEtiquetas.length > 0 && (
                    <div className="crm-etiquetas-filtro">
                      {todasEtiquetas.slice(0, 8).map(e => (
                        <button key={e} className={`crm-etq-btn${filtroEtiqueta === e ? " activo" : ""}`} onClick={() => setFiltroEtiqueta(filtroEtiqueta === e ? "" : e)}>{e}</button>
                      ))}
                    </div>
                  )}
                  {!mostrarArchivados && (
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                      {filtroEstadoLead && <button onClick={() => setFiltroEstadoLead("")} style={{padding:"2px 7px",borderRadius:10,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"rgba(255,255,255,0.5)",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,cursor:"pointer"}}>✕ Pipeline</button>}
                      {ESTADOS_LEAD.map(e => (
                        <button key={e.value} onClick={() => setFiltroEstadoLead(filtroEstadoLead === e.value ? "" : e.value)} style={{padding:"2px 7px",borderRadius:10,border:`1px solid ${filtroEstadoLead===e.value?e.color:e.color+"40"}`,background:filtroEstadoLead===e.value?`${e.color}20`:"transparent",color:filtroEstadoLead===e.value?e.color:`${e.color}90`,fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,cursor:"pointer",transition:"all 0.12s"}}>{e.label}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="crm-lista-barra">
                  <span className="crm-count">
                    {contactosFiltrados.length} contacto{contactosFiltrados.length !== 1 ? "s" : ""}
                    {!mostrarArchivados && contactos.filter(c => c.estado === "archivado").length > 0 && (
                      <span style={{marginLeft:6,color:"rgba(255,255,255,0.22)",fontSize:9}}>(+{contactos.filter(c => c.estado === "archivado").length} arch.)</span>
                    )}
                  </span>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button className={`crm-btn-export${mostrarArchivados ? " crm-btn-export-activo" : ""}`} onClick={() => { setMostrarArchivados(v => !v); setContactoSeleccionado(null); }} title={mostrarArchivados ? "Ver activos" : "Ver archivados"}>⊘ {mostrarArchivados ? "Activos" : "Archivados"}</button>
                    <button className="crm-btn-export crm-btn-export-prospeccion" onClick={() => setMostrarProspeccion(true)} title="Prospección inteligente" disabled={matchesProspeccion.length === 0}>🎯 Prospección{matchesProspeccion.length > 0 && <span style={{marginLeft:4,background:"rgba(251,191,36,0.25)",borderRadius:8,padding:"0 4px",fontSize:8}}>{matchesProspeccion.length}</span>}</button>
                    <button className="crm-btn-export" onClick={abrirDuplicados} title="Detectar duplicados" disabled={contactos.length < 2}>⊕ Duplicados</button>
                    <button className="crm-btn-export" onClick={() => { setImportRows([]); setImportError(""); setMostrarImport(true); }} title="Importar desde Excel">↑ Importar</button>
                    <button className="crm-btn-export" onClick={exportarContactosExcel} title="Exportar a Excel" disabled={contactosFiltrados.length === 0}>↓ Excel</button>
                    <button className="crm-btn-nuevo" onClick={abrirFormNuevoContacto}>+ Nuevo</button>
                  </div>
                </div>
                <div className="crm-lista-items">
                  {loadingContactos ? <div className="crm-empty-lista">Cargando...</div>
                    : contactosFiltrados.length === 0 ? <div className="crm-empty-lista">{busqueda || filtroEtiqueta ? "Sin resultados" : "No hay contactos.\nHacé clic en + Nuevo."}</div>
                    : contactosFiltrados.map(c => {
                      const estadoLead = ESTADOS_LEAD.find(e => e.value === c.estado);
                      return (
                        <div key={c.id} className={`crm-item${contactoSeleccionado?.id === c.id ? " activo" : ""}`} onClick={() => cargarDetalle(c)}>
                          <div className="crm-avatar">{iniciales(c)}</div>
                          <div className="crm-item-info">
                            <div className="crm-item-nombre">{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</div>
                            <div className="crm-item-sub">{c.telefono ?? c.email ?? c.inmobiliaria ?? c.tipo ?? ""}</div>
                            {estadoLead && <span className="lead-badge" style={{color:estadoLead.color,borderColor:`${estadoLead.color}40`,background:`${estadoLead.color}12`}}>{estadoLead.label}</span>}
                            {(c.etiquetas ?? []).length > 0 && <div className="crm-item-etqs">{(c.etiquetas ?? []).slice(0, 3).map(e => <span key={e} className="crm-etq">{e}</span>)}</div>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Detalle */}
              <div className="crm-panel-der">
                {!contactoSeleccionado ? (
                  <div className="crm-detalle-vacio">Seleccioná un contacto para ver el detalle</div>
                ) : (
                  <>
                    <div className="crm-detalle-header">
                      <div>
                        <div className="crm-detalle-nombre">{contactoSeleccionado.apellido ? `${contactoSeleccionado.apellido}, ${contactoSeleccionado.nombre}` : contactoSeleccionado.nombre}</div>
                        <div className="crm-detalle-tipo">{contactoSeleccionado.tipo ?? "contacto"}{contactoSeleccionado.interes ? ` · ${contactoSeleccionado.interes}` : ""}{contactoSeleccionado.origen ? ` · ${contactoSeleccionado.origen}` : ""}</div>
                        {(contactoSeleccionado.etiquetas ?? []).length > 0 && <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>{(contactoSeleccionado.etiquetas ?? []).map(e => <span key={e} className="crm-etq" style={{fontSize:8,padding:"2px 6px"}}>{e}</span>)}</div>}
                      </div>
                      <div className="crm-detalle-acciones">
                        {contactoSeleccionado.estado === "archivado" && <span style={{fontSize:9,padding:"3px 7px",background:"rgba(255,165,0,0.08)",border:"1px solid rgba(255,165,0,0.25)",borderRadius:3,color:"rgba(255,165,0,0.7)",fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Archivado</span>}
                        <button className="crm-btn-editar" onClick={() => archivarContacto(contactoSeleccionado)} title={contactoSeleccionado.estado === "archivado" ? "Quitar del archivo" : "Archivar contacto"}>{contactoSeleccionado.estado === "archivado" ? "↩ Restaurar" : "⊘ Archivar"}</button>
                        <button className="crm-btn-editar" onClick={() => abrirFormEditarContacto(contactoSeleccionado)}>Editar</button>
                        <button className="crm-btn-eliminar" onClick={() => eliminarContacto(contactoSeleccionado.id)}>Eliminar</button>
                      </div>
                    </div>
                    <div className="crm-detalle-datos">
                      {contactoSeleccionado.telefono && <div className="crm-dato"><span className="crm-dato-label">📞 Teléfono</span><a href={`https://wa.me/54${contactoSeleccionado.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{color:"#25d366",fontSize:12,textDecoration:"none"}}>{contactoSeleccionado.telefono}</a></div>}
                      {contactoSeleccionado.email && <div className="crm-dato"><span className="crm-dato-label">✉️ Email</span><a href={`mailto:${contactoSeleccionado.email}`} style={{color:"rgba(200,0,0,0.65)",fontSize:12,textDecoration:"none"}}>{contactoSeleccionado.email}</a></div>}
                      {contactoSeleccionado.inmobiliaria && <div className="crm-dato"><span className="crm-dato-label">🏢 Inmobiliaria</span><span className="crm-dato-val">{contactoSeleccionado.inmobiliaria}</span></div>}
                      {contactoSeleccionado.zona_interes && <div className="crm-dato"><span className="crm-dato-label">📍 Zona</span><span className="crm-dato-val">{contactoSeleccionado.zona_interes}</span></div>}
                      {(contactoSeleccionado.presupuesto_min || contactoSeleccionado.presupuesto_max) && <div className="crm-dato"><span className="crm-dato-label">💰 Presupuesto</span><span className="crm-dato-val">{contactoSeleccionado.moneda} {contactoSeleccionado.presupuesto_min?.toLocaleString("es-AR")}{contactoSeleccionado.presupuesto_max ? ` – ${contactoSeleccionado.presupuesto_max.toLocaleString("es-AR")}` : ""}</span></div>}
                      {contactoSeleccionado.notas && <div className="crm-dato" style={{gridColumn:"1/-1"}}><span className="crm-dato-label">📋 Notas</span><span className="crm-dato-val" style={{fontSize:11,lineHeight:1.5}}>{contactoSeleccionado.notas}</span></div>}
                      <div className="crm-dato"><span className="crm-dato-label">📅 Cargado</span><span className="crm-dato-val">{formatFecha(contactoSeleccionado.created_at)}</span></div>
                    </div>
                    {/* Pipeline section */}
                    {contactoSeleccionado.estado !== "archivado" && (
                      <div style={{padding:"10px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
                        <div style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.22)",marginBottom:6}}>Pipeline</div>
                        <div className="pipeline-grid">
                          {ESTADOS_LEAD.map(e => {
                            const isActive = contactoSeleccionado.estado === e.value;
                            return (
                              <button key={e.value} className="pipeline-btn" style={{borderColor:isActive?e.color:`${e.color}35`,color:isActive?"#fff":e.color,background:isActive?`${e.color}25`:"transparent",opacity:isActive?1:0.75}} onClick={() => actualizarEstadoLead(contactoSeleccionado, e.value)}>
                                {isActive && "✓ "}{e.label}
                              </button>
                            );
                          })}
                          {contactoSeleccionado.estado?.startsWith("lead:") && (
                            <button className="pipeline-btn" style={{borderColor:"rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.35)"}} onClick={() => actualizarEstadoLead(contactoSeleccionado, "")}>✕ Sin estado</button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="crm-detalle-tabs">
                      <button className={`crm-tab${tabDetalle === "historial" ? " activo" : ""}`} onClick={() => setTabDetalle("historial")}>Historial {interacciones.length > 0 && `(${interacciones.length})`}</button>
                      <button className={`crm-tab${tabDetalle === "recordatorios" ? " activo" : ""}`} onClick={() => setTabDetalle("recordatorios")}>Recordatorios{recordatoriosVencidos.length > 0 && <span className="crm-tab-badge">{recordatoriosVencidos.length}</span>}</button>
                      <button className={`crm-tab${tabDetalle === "propiedades" ? " activo" : ""}`} onClick={() => { setTabDetalle("propiedades"); cargarPropiedadesSugeridas(contactoSeleccionado); }}>Propiedades</button>
                    </div>
                    <div className="crm-detalle-body">
                      {loadingDetalle ? <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",padding:28}}>Cargando...</div>
                        : tabDetalle === "historial" ? (
                          <>
                            <div className="crm-nueva-interaccion">
                              <div className="crm-tipo-btns">{TIPOS_INTERACCION.map(t => <button key={t.value} className={`crm-tipo-btn${nuevaInteraccion.tipo === t.value ? " activo" : ""}`} onClick={() => setNuevaInteraccion(p => ({...p, tipo: t.value}))}>{t.label}</button>)}</div>
                              <div style={{position:"relative"}}>
                                <textarea className="crm-textarea" placeholder="Escribí una nota, registrá una llamada..." value={nuevaInteraccion.descripcion} onChange={e => setNuevaInteraccion(p => ({...p, descripcion: e.target.value}))} rows={2} />
                                {mostrarPlantillas && (
                                  <div className="plantillas-popup">
                                    <div style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:7}}>Plantillas guardadas</div>
                                    {plantillas.length === 0 ? (
                                      <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",padding:"6px 0"}}>No hay plantillas guardadas.</div>
                                    ) : plantillas.map(pl => (
                                      <div key={pl.id} className="plantilla-item" onClick={() => { setNuevaInteraccion(prev => ({...prev, descripcion: pl.contenido})); setMostrarPlantillas(false); }}>
                                        <div style={{flex:1,minWidth:0}}>
                                          <div className="plantilla-titulo">{pl.titulo}</div>
                                          <div className="plantilla-preview">{pl.contenido}</div>
                                        </div>
                                        <button style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",cursor:"pointer",padding:"0 2px",fontSize:13,flexShrink:0}} onClick={ev => { ev.stopPropagation(); eliminarPlantilla(pl.id); }} title="Eliminar">×</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={sugerirConIA}
                                disabled={cargandoIA}
                                style={{alignSelf:"flex-start",padding:"4px 10px",background:"rgba(147,51,234,0.12)",border:"1px solid rgba(147,51,234,0.25)",borderRadius:4,color:"rgba(147,51,234,0.8)",fontFamily:"Montserrat,sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.08em",cursor:"pointer",transition:"all 0.15s"}}
                              >
                                {cargandoIA ? "Generando..." : "✨ Sugerir con IA"}
                              </button>
                              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                                <button className="crm-btn-guardar-int" onClick={guardarInteraccion} disabled={guardandoInteraccion || !nuevaInteraccion.descripcion.trim()}>{guardandoInteraccion ? <><span className="crm-spinner"/>Guardando</> : "Registrar"}</button>
                                <button style={{padding:"5px 10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,color:"rgba(255,255,255,0.45)",fontFamily:"Montserrat,sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.08em",cursor:"pointer"}} onClick={() => { setMostrarPlantillas(v => !v); if (!mostrarPlantillas) cargarPlantillas(); }}>📋 Plantillas</button>
                                {nuevaInteraccion.descripcion.trim() && (
                                  <button style={{padding:"5px 10px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:3,color:"rgba(255,255,255,0.45)",fontFamily:"Montserrat,sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.08em",cursor:"pointer"}} onClick={() => setMostrarGuardarPlantilla(v => !v)}>💾 Guardar como plantilla</button>
                                )}
                              </div>
                              {mostrarGuardarPlantilla && (
                                <div style={{display:"flex",gap:6,alignItems:"center",paddingTop:4}}>
                                  <input className="crm-input-sm" placeholder="Nombre de la plantilla..." value={tituloNuevaPlantilla} onChange={e => setTituloNuevaPlantilla(e.target.value)} style={{flex:1}} />
                                  <button className="crm-btn-guardar-int" onClick={guardarPlantilla} disabled={guardandoPlantilla || !tituloNuevaPlantilla.trim()}>{guardandoPlantilla ? "..." : "Guardar"}</button>
                                </div>
                              )}
                            </div>
                            {interacciones.length === 0 ? <div style={{textAlign:"center",color:"rgba(255,255,255,0.18)",fontSize:12,padding:20}}>Sin interacciones todavía</div>
                              : interacciones.map(int => { const tipo = TIPOS_INTERACCION.find(t => t.value === int.tipo); return (
                                <div key={int.id} className="crm-interaccion">
                                  <div className="crm-int-icono">{tipo?.label.split(" ")[0] ?? "📝"}</div>
                                  <div className="crm-int-body"><div className="crm-int-tipo">{tipo?.label.slice(2) ?? int.tipo}</div><div className="crm-int-desc">{int.descripcion}</div><div className="crm-int-fecha">{formatFechaHora(int.created_at)}</div></div>
                                  <button className="crm-int-del" onClick={() => eliminarInteraccion(int.id)}>×</button>
                                </div>
                              );})}
                          </>
                        ) : tabDetalle === "recordatorios" ? (
                          <>
                            <div className="crm-nuevo-rec">
                              <input className="crm-input-sm" placeholder="Descripción..." value={nuevoRecordatorio.descripcion} onChange={e => setNuevoRecordatorio(p => ({...p, descripcion: e.target.value}))} style={{flex:1,minWidth:140}} />
                              <input type="date" className="crm-input-sm" value={nuevoRecordatorio.fecha} onChange={e => setNuevoRecordatorio(p => ({...p, fecha: e.target.value}))} style={{width:130}} />
                              <button className="crm-btn-guardar-int" onClick={guardarRecordatorio} disabled={guardandoRecordatorio || !nuevoRecordatorio.descripcion.trim() || !nuevoRecordatorio.fecha}>{guardandoRecordatorio ? "..." : "+ Agregar"}</button>
                            </div>
                            {recordatorios.length === 0 ? <div style={{textAlign:"center",color:"rgba(255,255,255,0.18)",fontSize:12,padding:20}}>Sin recordatorios</div>
                              : recordatorios.map(r => { const vencido = r.fecha_recordatorio < hoy && !r.completado; return (
                                <div key={r.id} className={`crm-rec${r.completado ? " completado" : vencido ? " vencido" : ""}`}>
                                  <div className={`crm-rec-check${r.completado ? " hecho" : ""}`} onClick={() => toggleRecordatorio(r)}>{r.completado && <span style={{fontSize:9,color:"#fff"}}>✓</span>}</div>
                                  <div className="crm-rec-body"><div className="crm-rec-desc" style={{textDecoration:r.completado?"line-through":"none"}}>{r.descripcion}</div><div className="crm-rec-fecha" style={{color:vencido?"#ef4444":"rgba(255,255,255,0.22)"}}>{vencido?"⚠️ Vencido · ":""}{formatFecha(r.fecha_recordatorio)}</div></div>
                                  <button className="crm-rec-del" onClick={() => eliminarRecordatorio(r.id)}>×</button>
                                </div>
                              );})}
                          </>
                        ) : (
                          /* ── Tab Propiedades sugeridas ── */
                          <>
                            {loadingPropiedades ? (
                              <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",padding:28}}>Buscando propiedades...</div>
                            ) : propiedadesSugeridas.length === 0 ? (
                              <div style={{textAlign:"center",color:"rgba(255,255,255,0.18)",fontSize:12,padding:28,lineHeight:1.7}}>
                                Sin propiedades sugeridas.<br/>
                                <span style={{fontSize:11,color:"rgba(255,255,255,0.12)"}}>Verificá que el contacto tenga interés y presupuesto cargados.</span>
                              </div>
                            ) : (
                              <>
                                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{propiedadesSugeridas.length} propiedad{propiedadesSugeridas.length !== 1 ? "es" : ""} sugerida{propiedadesSugeridas.length !== 1 ? "s" : ""}</div>
                                {propiedadesSugeridas.map((prop: any) => (
                                  <div key={prop.id} className="prop-card">
                                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6}}>
                                      <div className="prop-card-dir" style={{flex:1}}>{prop.titulo ?? prop.direccion ?? "Sin título"}</div>
                                      {prop.compatibilidad != null && (
                                        <div style={{flexShrink:0,fontSize:11,fontFamily:"Montserrat,sans-serif",fontWeight:700,color: prop.compatibilidad >= 80 ? "#22c55e" : prop.compatibilidad >= 55 ? "#f59e0b" : "rgba(255,255,255,0.35)",background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"2px 7px",border:`1px solid ${prop.compatibilidad >= 80 ? "rgba(34,197,94,0.3)" : prop.compatibilidad >= 55 ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`}}>{prop.compatibilidad}%</div>
                                      )}
                                    </div>
                                    {prop.direccion && prop.titulo && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"Inter,sans-serif"}}>📍 {prop.direccion}{prop.barrio ? `, ${prop.barrio}` : ""}</div>}
                                    {prop.razon && <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontFamily:"Inter,sans-serif",marginTop:2,lineHeight:1.4,fontStyle:"italic"}}>✦ {prop.razon}</div>}
                                    <div className="prop-card-meta">
                                      {prop.precio && <span style={{fontFamily:"Montserrat,sans-serif",fontWeight:700,color:"#fff"}}>{prop.moneda ?? "USD"} {prop.precio.toLocaleString("es-AR")}</span>}
                                      {prop.tipo_operacion && <span style={{padding:"1px 6px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,color:"rgba(255,255,255,0.4)"}}>{prop.tipo_operacion}</span>}
                                      {prop.barrio && !prop.titulo && <span>{prop.barrio}</span>}
                                    </div>
                                  </div>
                                ))}
                              </>
                            )}
                          </>
                        )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB NEGOCIOS
          ══════════════════════════════════════════════════ */}
          {tabPrincipal === "negocios" && (
            <div className="neg-full">
              <div className="neg-toolbar">
                <div className="crm-search-wrap" style={{margin:0,width:200}}>
                  <span className="crm-search-ico">🔍</span>
                  <input className="crm-search" placeholder="Buscar negocio..." value={busquedaNegocio} onChange={e => setBusquedaNegocio(e.target.value)} />
                </div>
                <div className="neg-filtros-etapa">
                  <button className={`crm-etq-btn${filtroEtapaNegocio === "" ? " activo" : ""}`} onClick={() => setFiltroEtapaNegocio("")}>Todos</button>
                  {ETAPAS_NEGOCIO.map(e => (
                    <button key={e.value} className={`crm-etq-btn${filtroEtapaNegocio === e.value ? " activo" : ""}`} style={filtroEtapaNegocio === e.value ? {borderColor:e.color,color:"#fff",background:`${e.color}20`} : {}} onClick={() => setFiltroEtapaNegocio(filtroEtapaNegocio === e.value ? "" : e.value)}>{e.label}</button>
                  ))}
                </div>
                <div style={{flex:1}} />
                <button className="crm-btn-nuevo" onClick={abrirFormNuevoNegocio}>+ Nuevo negocio</button>
              </div>
              <div className="neg-list">
                {loadingNegocios ? <div className="crm-empty-lista">Cargando...</div>
                  : negociosFiltrados.length === 0 ? <div className="crm-empty-lista">No hay negocios activos.<br/>Hacé clic en + Nuevo negocio.</div>
                  : negociosFiltrados.map(n => {
                    const etapa = ETAPAS_NEGOCIO.find(e => e.value === n.etapa);
                    const op = TIPOS_OPERACION.find(t => t.value === n.tipo_operacion);
                    const idxEtapa = ETAPAS_NEGOCIO.findIndex(e => e.value === n.etapa);
                    const honEstimado = n.valor_operacion && n.honorarios_pct ? (n.valor_operacion * n.honorarios_pct / 100) : null;
                    return (
                      <div key={n.id} className="neg-card">
                        <div className="neg-card-main">
                          <div className="neg-card-titulo">{n.titulo}</div>
                          <div className="neg-card-meta">
                            <span className="neg-chip neg-chip-op">{op?.label ?? n.tipo_operacion}</span>
                            <span className="neg-chip neg-chip-etapa" style={{borderColor:`${etapa?.color}40`,color:etapa?.color,background:`${etapa?.color}12`}}>{etapa?.label ?? n.etapa}</span>
                          </div>
                          {n.direccion && <div className="neg-card-dir">📍 {n.direccion}</div>}
                          {n.valor_operacion && <div style={{display:"flex",alignItems:"baseline",gap:4}}><span className="neg-card-valor">{n.moneda} {n.valor_operacion.toLocaleString("es-AR")}</span>{honEstimado && <span className="neg-card-honor">Hon. est. {n.moneda} {honEstimado.toLocaleString("es-AR")}</span>}</div>}
                          {nombreContacto(n.contacto_id) && <div className="neg-card-contacto">👤 {nombreContacto(n.contacto_id)}</div>}
                          {(n.etiquetas ?? []).length > 0 && <div className="crm-item-etqs" style={{marginTop:5}}>{(n.etiquetas ?? []).map(e => <span key={e} className="crm-etq">{e}</span>)}</div>}
                        </div>
                        {/* Timeline visual */}
                        <div style={{padding:"8px 12px 4px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                          {(() => {
                            const pasos = [
                              { key: "fecha_primer_contacto", label: "Contacto", icon: "📞" },
                              { key: "fecha_visita", label: "Visita", icon: "🏠" },
                              { key: "fecha_reserva", label: "Reserva", icon: "📝" },
                              { key: "fecha_escritura", label: "Escritura", icon: "📄" },
                              { key: "fecha_cierre", label: "Cierre", icon: "✅" },
                            ] as const;
                            const tieneAlguno = pasos.some(p => n[p.key]);
                            if (!tieneAlguno) return null;
                            return (
                              <div style={{display:"flex",alignItems:"center",gap:0}}>
                                {pasos.map((paso, i) => {
                                  const fecha = n[paso.key as keyof typeof n] as string | null;
                                  const hecho = !!fecha;
                                  return (
                                    <div key={paso.key} style={{display:"flex",alignItems:"center",flex:i < pasos.length-1 ? 1 : "none"}}>
                                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                        <div style={{width:22,height:22,borderRadius:"50%",background:hecho ? "rgba(200,0,0,0.2)" : "rgba(255,255,255,0.04)",border:`1px solid ${hecho ? "#cc0000" : "rgba(255,255,255,0.1)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>{hecho ? paso.icon : "·"}</div>
                                        <div style={{fontSize:8,color:hecho ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)",fontFamily:"Montserrat,sans-serif",fontWeight:600,letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{fecha ? new Date(fecha).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"}) : paso.label}</div>
                                      </div>
                                      {i < pasos.length-1 && <div style={{flex:1,height:1,background:hecho && (n[pasos[i+1].key as keyof typeof n]) ? "#cc000040" : "rgba(255,255,255,0.06)",margin:"0 3px",marginBottom:16}} />}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="neg-card-acciones">
                          {idxEtapa < ETAPAS_NEGOCIO.length - 1 && <button className="neg-btn-avanzar" onClick={() => avanzarEtapa(n)}>→ {ETAPAS_NEGOCIO[idxEtapa + 1]?.label}</button>}
                          <button className="neg-btn-edit" onClick={() => abrirFormEditarNegocio(n)}>Editar</button>
                          <button className="neg-btn-del" onClick={() => eliminarNegocio(n.id)}>Eliminar</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB TAREAS
          ══════════════════════════════════════════════════ */}
          {tabPrincipal === "tareas" && (
            <div className="tar-full">
              <div className="tar-toolbar">
                <div className="neg-filtros-etapa">
                  {["pendiente","en_progreso","completada"].map(s => (
                    <button key={s} className={`crm-etq-btn${filtroEstadoTarea === s ? " activo" : ""}`} onClick={() => setFiltroEstadoTarea(filtroEstadoTarea === s ? "" : s)}>
                      {s === "pendiente" ? "Pendientes" : s === "en_progreso" ? "En progreso" : "Completadas"}
                    </button>
                  ))}
                </div>
                <div style={{width:1,height:16,background:"rgba(255,255,255,0.1)"}} />
                {PRIORIDADES_TAREA.map(p => (
                  <button key={p.value} className={`crm-etq-btn${filtroPrioridadTarea === p.value ? " activo" : ""}`} style={filtroPrioridadTarea === p.value ? {borderColor:p.color,color:"#fff",background:`${p.color}20`} : {}} onClick={() => setFiltroPrioridadTarea(filtroPrioridadTarea === p.value ? "" : p.value)}>{p.label}</button>
                ))}
                <div style={{flex:1}} />
                <button className="crm-btn-nuevo" onClick={abrirFormNuevaTarea}>+ Nueva tarea</button>
              </div>
              <div className="tar-list">
                {loadingTareas ? <div className="crm-empty-lista">Cargando...</div>
                  : tareasFiltradas.length === 0 ? <div className="crm-empty-lista">No hay tareas {filtroEstadoTarea ? `con estado "${filtroEstadoTarea}"` : ""}.</div>
                  : tareasFiltradas.map(t => {
                    const prio = PRIORIDADES_TAREA.find(p => p.value === t.prioridad);
                    const tipoLabel = TIPOS_TAREA.find(x => x.value === t.tipo)?.label ?? t.tipo;
                    const vencida = t.estado !== "completada" && t.fecha_vencimiento && t.fecha_vencimiento < hoy;
                    const contactRef = nombreContacto(t.contacto_id);
                    const negRef = tituloNegocio(t.negocio_id);
                    return (
                      <div key={t.id} className={`tar-card${t.estado === "completada" ? " completada" : ""}`}>
                        <div className={`tar-check${t.estado === "completada" ? " hecho" : ""}`} onClick={() => completarTarea(t)}>{t.estado === "completada" && <span style={{fontSize:9,color:"#fff"}}>✓</span>}</div>
                        <div className="tar-card-main">
                          <div className="tar-card-titulo">{t.titulo}</div>
                          <div className="tar-card-meta">
                            <span className="tar-chip-prio" style={{borderColor:`${prio?.color}40`,color:prio?.color,background:`${prio?.color}12`}}>{prio?.label}</span>
                            <span className="tar-chip-tipo">{tipoLabel}</span>
                          </div>
                          {t.descripcion && <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:4,lineHeight:1.4}}>{t.descripcion}</div>}
                          {t.fecha_vencimiento && <div className={`tar-vence${vencida ? " vencido" : ""}`}>{vencida ? "⚠️ Vencida · " : "📅 "}{formatFecha(t.fecha_vencimiento)}</div>}
                          {(contactRef || negRef) && <div className="tar-ref">{contactRef && `👤 ${contactRef}`}{contactRef && negRef && " · "}{negRef && `📁 ${negRef}`}</div>}
                        </div>
                        <div className="tar-card-acciones">
                          <button className="neg-btn-edit" onClick={() => abrirFormEditarTarea(t)}>Editar</button>
                          <button className="neg-btn-del" onClick={() => eliminarTarea(t.id)}>×</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB NOTAS
          ══════════════════════════════════════════════════ */}
          {tabPrincipal === "notas" && (
            <div className="not-full">
              <div className="not-toolbar">
                <div className="crm-search-wrap" style={{margin:0,width:220}}>
                  <span className="crm-search-ico">🔍</span>
                  <input className="crm-search" placeholder="Buscar nota..." value={busquedaNota} onChange={e => setBusquedaNota(e.target.value)} />
                </div>
                <div style={{flex:1}} />
                <button className="crm-btn-nuevo" onClick={abrirFormNuevaNota}>+ Nueva nota</button>
              </div>
              <div className="not-grid">
                {loadingNotas ? <div className="crm-empty-lista" style={{gridColumn:"1/-1"}}>Cargando...</div>
                  : notasFiltradas.length === 0 ? <div className="crm-empty-lista" style={{gridColumn:"1/-1"}}>No hay notas. Hacé clic en + Nueva nota.</div>
                  : notasFiltradas.map(n => {
                    const contactRef = nombreContacto(n.contacto_id);
                    const negRef = tituloNegocio(n.negocio_id);
                    return (
                      <div key={n.id} className={`not-card${n.fijada ? " fijada" : ""}`}>
                        <div className="not-card-header">
                          <div className="not-card-titulo">{n.titulo || <span style={{color:"rgba(255,255,255,0.2)",fontStyle:"italic"}}>Sin título</span>}</div>
                          <span className="not-card-tipo">{n.tipo}</span>
                        </div>
                        <div className="not-card-contenido">{n.contenido}</div>
                        {(n.etiquetas ?? []).length > 0 && <div className="crm-item-etqs">{(n.etiquetas ?? []).map(e => <span key={e} className="crm-etq">{e}</span>)}</div>}
                        <div className="not-card-footer">
                          <div>
                            <div className="not-card-fecha">{formatFecha(n.created_at)}</div>
                            {(contactRef || negRef) && <div className="not-card-ref">{contactRef && `👤 ${contactRef}`}{contactRef && negRef && " · "}{negRef && `📁 ${negRef}`}</div>}
                          </div>
                          <div className="not-card-acciones">
                            <button className={`not-btn-pin${n.fijada ? " fijada" : ""}`} onClick={() => toggleFijarNota(n)} title={n.fijada ? "Desfijar" : "Fijar"}>📌</button>
                            <button className="neg-btn-edit" onClick={() => abrirFormEditarNota(n)}>Editar</button>
                            <button className="neg-btn-del" onClick={() => eliminarNota(n.id)}>×</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL CONTACTO
      ══════════════════════════════════════════════════ */}
      {mostrarFormContacto && (
        <div className="crm-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormContacto(false); }}>
          <div className="crm-modal">
            <div className="crm-modal-titulo">{editandoContactoId ? "Editar" : "Nuevo"} <span>contacto</span></div>
            <div className="crm-section-label">Datos personales</div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Nombre *</label><input className="crm-input" value={formContacto.nombre} onChange={e => setFormContacto(p => ({...p, nombre: e.target.value}))} placeholder="Juan" /></div>
              <div className="crm-field"><label className="crm-label">Apellido</label><input className="crm-input" value={formContacto.apellido} onChange={e => setFormContacto(p => ({...p, apellido: e.target.value}))} placeholder="García" /></div>
            </div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Teléfono</label><input className="crm-input" value={formContacto.telefono} onChange={e => setFormContacto(p => ({...p, telefono: e.target.value}))} placeholder="3415001234" /></div>
              <div className="crm-field"><label className="crm-label">Email</label><input className="crm-input" type="email" value={formContacto.email} onChange={e => setFormContacto(p => ({...p, email: e.target.value}))} placeholder="juan@email.com" /></div>
            </div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Tipo</label><select className="crm-select" value={formContacto.tipo} onChange={e => setFormContacto(p => ({...p, tipo: e.target.value}))}>{TIPOS_CONTACTO.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
              <div className="crm-field"><label className="crm-label">Origen</label><select className="crm-select" value={formContacto.origen} onChange={e => setFormContacto(p => ({...p, origen: e.target.value}))}><option value="">Sin especificar</option>{ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
            </div>
            <div className="crm-field"><label className="crm-label">Inmobiliaria</label><input className="crm-input" value={formContacto.inmobiliaria} onChange={e => setFormContacto(p => ({...p, inmobiliaria: e.target.value}))} placeholder="Opcional" /></div>
            <div className="crm-divider" />
            <div className="crm-section-label">Interés inmobiliario</div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Interés</label><select className="crm-select" value={formContacto.interes} onChange={e => setFormContacto(p => ({...p, interes: e.target.value}))}><option value="">Sin especificar</option>{INTERESES.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
              <div className="crm-field"><label className="crm-label">Zona</label><input className="crm-input" value={formContacto.zona_interes} onChange={e => setFormContacto(p => ({...p, zona_interes: e.target.value}))} placeholder="Fisherton, Rosario..." /></div>
            </div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Presupuesto mín.</label><input className="crm-input" type="number" value={formContacto.presupuesto_min} onChange={e => setFormContacto(p => ({...p, presupuesto_min: e.target.value}))} placeholder="50000" /></div>
              <div className="crm-field"><label className="crm-label">Presupuesto máx.</label><input className="crm-input" type="number" value={formContacto.presupuesto_max} onChange={e => setFormContacto(p => ({...p, presupuesto_max: e.target.value}))} placeholder="200000" /></div>
            </div>
            <div className="crm-field"><label className="crm-label">Moneda</label><div style={{display:"flex",gap:7}}>{["USD","ARS"].map(m => <button key={m} type="button" style={{padding:"5px 13px",borderRadius:3,border:`1px solid ${formContacto.moneda===m?"#cc0000":"rgba(255,255,255,0.09)"}`,background:formContacto.moneda===m?"rgba(200,0,0,0.1)":"transparent",color:formContacto.moneda===m?"#fff":"rgba(255,255,255,0.38)",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}} onClick={() => setFormContacto(p => ({...p, moneda: m}))}>{m}</button>)}</div></div>
            <div className="crm-divider" />
            <div className="crm-section-label">Etiquetas y notas</div>
            <div className="crm-field"><label className="crm-label">Etiquetas <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:9,color:"rgba(255,255,255,0.18)"}}>separadas por coma</span></label><input className="crm-input" value={formContacto.etiquetas} onChange={e => setFormContacto(p => ({...p, etiquetas: e.target.value}))} placeholder="comprador, urgente, zona norte..." /></div>
            <div className="crm-field"><label className="crm-label">Notas</label><textarea className="crm-textarea" value={formContacto.notas} onChange={e => setFormContacto(p => ({...p, notas: e.target.value}))} rows={3} style={{width:"100%",boxSizing:"border-box"}} /></div>
            <div className="crm-modal-actions">
              <button className="crm-btn-cancel" onClick={() => setMostrarFormContacto(false)}>Cancelar</button>
              <button className="crm-btn-save" onClick={guardarContacto} disabled={guardandoContacto || !formContacto.nombre}>{guardandoContacto ? <><span className="crm-spinner"/>Guardando...</> : editandoContactoId ? "Guardar cambios" : "Crear contacto"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL NEGOCIO
      ══════════════════════════════════════════════════ */}
      {mostrarFormNegocio && (
        <div className="crm-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormNegocio(false); }}>
          <div className="crm-modal">
            <div className="crm-modal-titulo">{editandoNegocioId ? "Editar" : "Nuevo"} <span>negocio</span></div>
            <div className="crm-field"><label className="crm-label">Título *</label><input className="crm-input" value={formNegocio.titulo} onChange={e => setFormNegocio(p => ({...p, titulo: e.target.value}))} placeholder="Ej: Venta dpto. Fisherton" /></div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Tipo operación</label><select className="crm-select" value={formNegocio.tipo_operacion} onChange={e => setFormNegocio(p => ({...p, tipo_operacion: e.target.value}))}>{TIPOS_OPERACION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div className="crm-field"><label className="crm-label">Contacto</label><select className="crm-select" value={formNegocio.contacto_id} onChange={e => setFormNegocio(p => ({...p, contacto_id: e.target.value}))}><option value="">Sin contacto</option>{contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}</select></div>
            </div>
            <div className="crm-field"><label className="crm-label">Etapa</label>
              <div className="etapa-grid">
                {ETAPAS_NEGOCIO.map(e => (
                  <button key={e.value} type="button" className="etapa-btn" style={{borderColor:`${e.color}${formNegocio.etapa===e.value?"":"30"}`,color:formNegocio.etapa===e.value?"#fff":e.color,background:formNegocio.etapa===e.value?`${e.color}25`:"transparent",opacity:formNegocio.etapa===e.value?1:0.6}} onClick={() => setFormNegocio(p => ({...p, etapa: e.value}))}>{e.label}</button>
                ))}
              </div>
            </div>
            <div className="crm-field"><label className="crm-label">Dirección</label><input className="crm-input" value={formNegocio.direccion} onChange={e => setFormNegocio(p => ({...p, direccion: e.target.value}))} placeholder="Ej: Av. Pellegrini 1200, Rosario" /></div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Valor operación</label><input className="crm-input" type="number" value={formNegocio.valor_operacion} onChange={e => setFormNegocio(p => ({...p, valor_operacion: e.target.value}))} placeholder="180000" /></div>
              <div className="crm-field"><label className="crm-label">Moneda</label><select className="crm-select" value={formNegocio.moneda} onChange={e => setFormNegocio(p => ({...p, moneda: e.target.value}))}><option>USD</option><option>ARS</option></select></div>
            </div>
            <div className="crm-field"><label className="crm-label">% Honorarios</label><input className="crm-input" type="number" step="0.5" value={formNegocio.honorarios_pct} onChange={e => setFormNegocio(p => ({...p, honorarios_pct: e.target.value}))} placeholder="3" /></div>
            <div className="crm-divider" />
            <div className="crm-section-label">Fechas clave</div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Primer contacto</label><input type="date" className="crm-input" value={formNegocio.fecha_primer_contacto} onChange={e => setFormNegocio(p => ({...p, fecha_primer_contacto: e.target.value}))} /></div>
              <div className="crm-field"><label className="crm-label">Visita</label><input type="date" className="crm-input" value={formNegocio.fecha_visita} onChange={e => setFormNegocio(p => ({...p, fecha_visita: e.target.value}))} /></div>
            </div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Reserva</label><input type="date" className="crm-input" value={formNegocio.fecha_reserva} onChange={e => setFormNegocio(p => ({...p, fecha_reserva: e.target.value}))} /></div>
              <div className="crm-field"><label className="crm-label">Escritura</label><input type="date" className="crm-input" value={formNegocio.fecha_escritura} onChange={e => setFormNegocio(p => ({...p, fecha_escritura: e.target.value}))} /></div>
            </div>
            <div className="crm-divider" />
            <div className="crm-field"><label className="crm-label">Etiquetas <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:9,color:"rgba(255,255,255,0.18)"}}>separadas por coma</span></label><input className="crm-input" value={formNegocio.etiquetas} onChange={e => setFormNegocio(p => ({...p, etiquetas: e.target.value}))} placeholder="zona norte, compartido..." /></div>
            <div className="crm-field"><label className="crm-label">Notas</label><textarea className="crm-textarea" value={formNegocio.notas} onChange={e => setFormNegocio(p => ({...p, notas: e.target.value}))} rows={2} style={{width:"100%",boxSizing:"border-box"}} /></div>
            <div className="crm-modal-actions">
              <button className="crm-btn-cancel" onClick={() => setMostrarFormNegocio(false)}>Cancelar</button>
              <button className="crm-btn-save" onClick={guardarNegocio} disabled={guardandoNegocio || !formNegocio.titulo}>{guardandoNegocio ? <><span className="crm-spinner"/>Guardando...</> : editandoNegocioId ? "Guardar cambios" : "Crear negocio"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL TAREA
      ══════════════════════════════════════════════════ */}
      {mostrarFormTarea && (
        <div className="crm-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormTarea(false); }}>
          <div className="crm-modal">
            <div className="crm-modal-titulo">{editandoTareaId ? "Editar" : "Nueva"} <span>tarea</span></div>
            <div className="crm-field"><label className="crm-label">Título *</label><input className="crm-input" value={formTarea.titulo} onChange={e => setFormTarea(p => ({...p, titulo: e.target.value}))} placeholder="Ej: Llamar a García mañana" /></div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Tipo</label><select className="crm-select" value={formTarea.tipo} onChange={e => setFormTarea(p => ({...p, tipo: e.target.value}))}>{TIPOS_TAREA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div className="crm-field"><label className="crm-label">Prioridad</label><select className="crm-select" value={formTarea.prioridad} onChange={e => setFormTarea(p => ({...p, prioridad: e.target.value}))}>{PRIORIDADES_TAREA.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
            </div>
            <div className="crm-field"><label className="crm-label">Fecha vencimiento</label><input type="date" className="crm-input" value={formTarea.fecha_vencimiento} onChange={e => setFormTarea(p => ({...p, fecha_vencimiento: e.target.value}))} /></div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Contacto</label><select className="crm-select" value={formTarea.contacto_id} onChange={e => setFormTarea(p => ({...p, contacto_id: e.target.value}))}><option value="">Sin contacto</option>{contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}</select></div>
              <div className="crm-field"><label className="crm-label">Negocio</label><select className="crm-select" value={formTarea.negocio_id} onChange={e => setFormTarea(p => ({...p, negocio_id: e.target.value}))}><option value="">Sin negocio</option>{negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}</select></div>
            </div>
            <div className="crm-field"><label className="crm-label">Descripción</label><textarea className="crm-textarea" value={formTarea.descripcion} onChange={e => setFormTarea(p => ({...p, descripcion: e.target.value}))} rows={2} style={{width:"100%",boxSizing:"border-box"}} /></div>
            <div className="crm-modal-actions">
              <button className="crm-btn-cancel" onClick={() => setMostrarFormTarea(false)}>Cancelar</button>
              <button className="crm-btn-save" onClick={guardarTarea} disabled={guardandoTarea || !formTarea.titulo}>{guardandoTarea ? <><span className="crm-spinner"/>Guardando...</> : editandoTareaId ? "Guardar cambios" : "Crear tarea"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL NOTA
      ══════════════════════════════════════════════════ */}
      {mostrarImport && (
        <div className="crm-modal-overlay" onClick={() => !importando && setMostrarImport(false)}>
          <div className="crm-modal" style={{maxWidth:600,width:"95vw"}} onClick={e => e.stopPropagation()}>
            <div className="crm-modal-titulo">Importar contactos desde Excel</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:12,lineHeight:1.6}}>
              El archivo debe tener columnas: <strong style={{color:"rgba(255,255,255,0.6)"}}>Nombre, Apellido, Tipo, Teléfono, Email, Inmobiliaria, Matrícula, Etiquetas, Interés, Zona, Presup. min, Presup. max, Moneda, Origen, Notas</strong>.<br/>
              Podés usar el export de este CRM como plantilla.
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={handleArchivoImport} style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:10}} />
            {importError && <div style={{fontSize:12,color:"#ff6b6b",marginBottom:10}}>{importError}</div>}
            {importRows.length > 0 && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:8}}>{importRows.length} contacto{importRows.length !== 1 ? "s" : ""} encontrado{importRows.length !== 1 ? "s" : ""}. Vista previa (primeros 5):</div>
                <div style={{overflowX:"auto",borderRadius:5,border:"1px solid rgba(255,255,255,0.07)"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                    <thead>
                      <tr style={{background:"rgba(255,255,255,0.04)"}}>
                        {["Nombre","Apellido","Tipo","Teléfono","Email"].map(h => (
                          <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"rgba(255,255,255,0.35)",fontFamily:"Montserrat,sans-serif",letterSpacing:"0.08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0,5).map((r,i) => (
                        <tr key={i} style={{borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                          {["Nombre","Apellido","Tipo","Teléfono","Email"].map(h => (
                            <td key={h} style={{padding:"6px 10px",color:"rgba(255,255,255,0.6)",whiteSpace:"nowrap",overflow:"hidden",maxWidth:120,textOverflow:"ellipsis"}}>{r[h] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="crm-modal-actions">
              <button className="crm-btn-cancel" onClick={() => setMostrarImport(false)} disabled={importando}>Cancelar</button>
              <button className="crm-btn-save" onClick={confirmarImport} disabled={importando || importRows.length === 0}>
                {importando ? <><span className="crm-spinner"/>Importando...</> : `Importar ${importRows.length > 0 ? importRows.length + " contactos" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarDuplicados && (
        <div className="crm-modal-overlay" onClick={() => !mergeando && setMostrarDuplicados(false)}>
          <div className="crm-modal" style={{maxWidth:660,width:"95vw",maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={e => e.stopPropagation()}>
            <div className="crm-modal-titulo">Contactos duplicados</div>
            {gruposDuplicados.length === 0 ? (
              <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",padding:"20px 0",textAlign:"center"}}>No se encontraron duplicados.</div>
            ) : (
              <div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:14,paddingBottom:4}}>
                {gruposDuplicados.map((grupo, idx) => (
                  <div key={idx} style={{border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,overflow:"hidden"}}>
                    <div style={{background:"rgba(255,255,255,0.03)",padding:"8px 13px",fontSize:10,fontFamily:"Montserrat,sans-serif",letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>
                      Grupo {idx + 1} — {grupo.length} registros
                    </div>
                    {grupo.map(c => (
                      <div key={c.id} style={{padding:"10px 13px",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:10,cursor:"pointer",background:mergeSeleccion[idx]===c.id?"rgba(200,0,0,0.08)":"transparent",transition:"background 0.12s"}} onClick={() => setMergeSeleccion(p => ({...p,[idx]:c.id}))}>
                        <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${mergeSeleccion[idx]===c.id?"#cc0000":"rgba(255,255,255,0.2)"}`,background:mergeSeleccion[idx]===c.id?"#cc0000":"transparent",flexShrink:0,transition:"all 0.12s"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#fff",fontFamily:"Montserrat,sans-serif"}}>{c.apellido?`${c.apellido}, ${c.nombre}`:c.nombre}</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2,display:"flex",gap:10,flexWrap:"wrap"}}>
                            {c.telefono && <span>{c.telefono}</span>}
                            {c.email && <span>{c.email}</span>}
                            {c.tipo && <span>{c.tipo}</span>}
                            <span style={{color:"rgba(255,255,255,0.18)"}}>{formatFecha(c.created_at)}</span>
                          </div>
                        </div>
                        {mergeSeleccion[idx]===c.id && <span style={{fontSize:9,fontFamily:"Montserrat,sans-serif",letterSpacing:"0.1em",textTransform:"uppercase",color:"#cc0000",fontWeight:700}}>Conservar</span>}
                      </div>
                    ))}
                    <div style={{padding:"10px 13px",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"flex-end"}}>
                      <button className="crm-btn-save" style={{fontSize:10,padding:"5px 14px"}} disabled={mergeando} onClick={() => ejecutarMerge(grupo, mergeSeleccion[idx], idx)}>
                        {mergeando ? <><span className="crm-spinner"/>Fusionando...</> : "Fusionar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="crm-modal-actions" style={{marginTop:12}}>
              <button className="crm-btn-cancel" onClick={() => setMostrarDuplicados(false)} disabled={mergeando}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {mostrarFormNota && (
        <div className="crm-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormNota(false); }}>
          <div className="crm-modal">
            <div className="crm-modal-titulo">{editandoNotaId ? "Editar" : "Nueva"} <span>nota</span></div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Título</label><input className="crm-input" value={formNota.titulo} onChange={e => setFormNota(p => ({...p, titulo: e.target.value}))} placeholder="Título opcional" /></div>
              <div className="crm-field"><label className="crm-label">Tipo</label><select className="crm-select" value={formNota.tipo} onChange={e => setFormNota(p => ({...p, tipo: e.target.value}))}>{TIPOS_NOTA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            </div>
            <div className="crm-field"><label className="crm-label">Contenido *</label><textarea className="crm-textarea" value={formNota.contenido} onChange={e => setFormNota(p => ({...p, contenido: e.target.value}))} rows={5} style={{width:"100%",boxSizing:"border-box"}} placeholder="Escribí tu nota..." /></div>
            <div className="crm-row">
              <div className="crm-field"><label className="crm-label">Contacto</label><select className="crm-select" value={formNota.contacto_id} onChange={e => setFormNota(p => ({...p, contacto_id: e.target.value}))}><option value="">Sin contacto</option>{contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}</select></div>
              <div className="crm-field"><label className="crm-label">Negocio</label><select className="crm-select" value={formNota.negocio_id} onChange={e => setFormNota(p => ({...p, negocio_id: e.target.value}))}><option value="">Sin negocio</option>{negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}</select></div>
            </div>
            <div className="crm-field"><label className="crm-label">Etiquetas</label><input className="crm-input" value={formNota.etiquetas} onChange={e => setFormNota(p => ({...p, etiquetas: e.target.value}))} placeholder="separadas por coma" /></div>
            <div className="crm-modal-actions">
              <button className="crm-btn-cancel" onClick={() => setMostrarFormNota(false)}>Cancelar</button>
              <button className="crm-btn-save" onClick={guardarNota} disabled={guardandoNota || !formNota.contenido}>{guardandoNota ? <><span className="crm-spinner"/>Guardando...</> : editandoNotaId ? "Guardar cambios" : "Crear nota"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL PROSPECCIÓN INTELIGENTE
      ══════════════════════════════════════════════════ */}
      {mostrarProspeccion && (() => {
        const scoreLabel = (s: number) => s === 2 ? "Alta" : s === 1 ? "Media" : "Baja";
        const scoreColor = (s: number) => s === 2 ? "#22c55e" : s === 1 ? "#f59e0b" : "#6b7280";
        const matchesFiltrados = filtroScoreProspeccion
          ? matchesProspeccion.filter(m => scoreLabel(m.score).toLowerCase() === filtroScoreProspeccion)
          : matchesProspeccion;
        return (
          <div className="crm-modal-overlay" onClick={() => setMostrarProspeccion(false)}>
            <div style={{background:"#111",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,width:"min(820px,96vw)",maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div>
                  <div style={{fontFamily:"Montserrat,sans-serif",fontSize:15,fontWeight:800,color:"#fff"}}>🎯 Prospección <span style={{color:"#fbbf24"}}>inteligente</span></div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:3}}>{matchesProspeccion.length} coincidencia{matchesProspeccion.length !== 1 ? "s" : ""} entre compradores/inquilinos y propiedades activas</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {(["","alta","media","baja"] as const).map(f => (
                    <button key={f} onClick={() => setFiltroScoreProspeccion(f)} style={{padding:"3px 10px",borderRadius:10,border:`1px solid ${filtroScoreProspeccion===f?"rgba(251,191,36,0.5)":"rgba(255,255,255,0.1)"}`,background:filtroScoreProspeccion===f?"rgba(251,191,36,0.1)":"transparent",color:filtroScoreProspeccion===f?"#fbbf24":"rgba(255,255,255,0.4)",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer"}}>
                      {f === "" ? "Todas" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {/* Lista */}
              <div style={{overflowY:"auto",flex:1,padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
                {matchesFiltrados.length === 0 ? (
                  <div style={{padding:"40px 0",textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:13,fontFamily:"Inter,sans-serif"}}>
                    {matchesProspeccion.length === 0
                      ? "Cargá contactos con interés (Comprar/Alquilar) y negocios activos para ver matches."
                      : "Sin coincidencias para este filtro."}
                  </div>
                ) : matchesFiltrados.map((m, i) => {
                  const c = m.contacto;
                  const n = m.negocio;
                  const etapaNeg = ETAPAS_NEGOCIO.find(e => e.value === n.etapa);
                  const tipoOpLabel = TIPOS_OPERACION.find(t => t.value === n.tipo_operacion)?.label ?? n.tipo_operacion;
                  return (
                    <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:12,alignItems:"center",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"12px 14px"}}>
                      {/* Contacto */}
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)",marginBottom:4}}>Buscador</div>
                        <div style={{fontFamily:"Montserrat,sans-serif",fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                          {c.interes && <span style={{color:"#a78bfa"}}>{c.interes}</span>}
                          {c.zona_interes && <span>📍 {c.zona_interes}</span>}
                        </div>
                        {(c.presupuesto_min || c.presupuesto_max) && (
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:3}}>
                            💰 {c.moneda} {c.presupuesto_min?.toLocaleString("es-AR")}{c.presupuesto_max ? ` – ${c.presupuesto_max.toLocaleString("es-AR")}` : "+"}
                          </div>
                        )}
                        {c.telefono && (
                          <a href={`https://wa.me/54${c.telefono.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:6,padding:"3px 9px",background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.25)",borderRadius:4,color:"#25d366",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.08em",textDecoration:"none",textTransform:"uppercase"}}>
                            💬 WhatsApp
                          </a>
                        )}
                      </div>
                      {/* Score central */}
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0}}>
                        <div style={{width:40,height:40,borderRadius:"50%",border:`2px solid ${scoreColor(m.score)}`,display:"flex",alignItems:"center",justifyContent:"center",background:`${scoreColor(m.score)}18`}}>
                          <span style={{fontSize:14,fontWeight:800,fontFamily:"Montserrat,sans-serif",color:scoreColor(m.score)}}>{m.score === 2 ? "★★" : m.score === 1 ? "★" : "·"}</span>
                        </div>
                        <div style={{fontSize:8,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:scoreColor(m.score)}}>{scoreLabel(m.score)}</div>
                        {m.razon.length > 0 && (
                          <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                            {m.razon.map((r,ri) => <span key={ri} style={{fontSize:8,color:"rgba(255,255,255,0.25)",whiteSpace:"nowrap"}}>{r}</span>)}
                          </div>
                        )}
                      </div>
                      {/* Negocio */}
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)",marginBottom:4}}>Propiedad</div>
                        <div style={{fontFamily:"Montserrat,sans-serif",fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.titulo}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                          <span style={{color:"#cc0000"}}>{tipoOpLabel}</span>
                          {etapaNeg && <span style={{color:etapaNeg.color}}>{etapaNeg.label}</span>}
                        </div>
                        {n.direccion && <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>📍 {n.direccion}</div>}
                        {n.valor_operacion && <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:3}}>💰 {n.moneda} {n.valor_operacion.toLocaleString("es-AR")}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Footer */}
              <div style={{padding:"12px 20px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"flex-end",flexShrink:0}}>
                <button className="crm-btn-cancel" onClick={() => setMostrarProspeccion(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
