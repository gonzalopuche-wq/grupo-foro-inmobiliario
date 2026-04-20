"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";

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

const FORM_VACIO = {
  nombre: "", apellido: "", telefono: "", email: "",
  matricula: "", inmobiliaria: "", tipo: "cliente",
  origen: "", interes: "", zona_interes: "",
  presupuesto_min: "", presupuesto_max: "", moneda: "USD",
  etiquetas: "", notas: "",
};

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

const formatFechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ── Componente principal ───────────────────────────────────────────────────

export default function CrmPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");

  // Modal contacto
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  // Panel detalle
  const [contactoSeleccionado, setContactoSeleccionado] = useState<Contacto | null>(null);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [nuevaInteraccion, setNuevaInteraccion] = useState({ tipo: "nota", descripcion: "" });
  const [nuevoRecordatorio, setNuevoRecordatorio] = useState({ descripcion: "", fecha: "" });
  const [guardandoInteraccion, setGuardandoInteraccion] = useState(false);
  const [guardandoRecordatorio, setGuardandoRecordatorio] = useState(false);
  const [tabDetalle, setTabDetalle] = useState<"historial" | "recordatorios">("historial");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      cargarContactos(data.user.id);
    };
    init();
  }, []);

  const cargarContactos = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_contactos")
      .select("*")
      .eq("perfil_id", uid)
      .order("updated_at", { ascending: false });
    setContactos((data as Contacto[]) ?? []);
    setLoading(false);
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

  const abrirFormNuevo = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setMostrarForm(true);
  };

  const abrirFormEditar = (c: Contacto) => {
    setEditandoId(c.id);
    setForm({
      nombre: c.nombre ?? "", apellido: c.apellido ?? "",
      telefono: c.telefono ?? "", email: c.email ?? "",
      matricula: c.matricula ?? "", inmobiliaria: c.inmobiliaria ?? "",
      tipo: c.tipo ?? "cliente", origen: c.origen ?? "",
      interes: c.interes ?? "", zona_interes: c.zona_interes ?? "",
      presupuesto_min: c.presupuesto_min?.toString() ?? "",
      presupuesto_max: c.presupuesto_max?.toString() ?? "",
      moneda: c.moneda ?? "USD",
      etiquetas: (c.etiquetas ?? []).join(", "),
      notas: c.notas ?? "",
    });
    setMostrarForm(true);
  };

  const guardarContacto = async () => {
    if (!userId || !form.nombre) return;
    setGuardando(true);
    const etiquetasArr = form.etiquetas.split(",").map(e => e.trim()).filter(Boolean);
    const datos = {
      perfil_id: userId,
      nombre: form.nombre, apellido: form.apellido,
      telefono: form.telefono || null, email: form.email || null,
      matricula: form.matricula || null, inmobiliaria: form.inmobiliaria || null,
      tipo: form.tipo, origen: form.origen || null,
      interes: form.interes || null, zona_interes: form.zona_interes || null,
      presupuesto_min: form.presupuesto_min ? parseFloat(form.presupuesto_min) : null,
      presupuesto_max: form.presupuesto_max ? parseFloat(form.presupuesto_max) : null,
      moneda: form.moneda,
      etiquetas: etiquetasArr.length > 0 ? etiquetasArr : null,
      notas: form.notas || null,
      updated_at: new Date().toISOString(),
    };
    if (editandoId) {
      await supabase.from("crm_contactos").update(datos).eq("id", editandoId);
    } else {
      await supabase.from("crm_contactos").insert(datos);
    }
    setGuardando(false);
    setMostrarForm(false);
    cargarContactos(userId);
    if (contactoSeleccionado?.id === editandoId) {
      const { data } = await supabase.from("crm_contactos").select("*").eq("id", editandoId).single();
      if (data) setContactoSeleccionado(data as Contacto);
    }
  };

  const eliminarContacto = async (id: string) => {
    if (!confirm("¿Eliminar este contacto y todo su historial?")) return;
    await supabase.from("crm_contactos").delete().eq("id", id);
    if (contactoSeleccionado?.id === id) setContactoSeleccionado(null);
    if (userId) cargarContactos(userId);
  };

  // ── Interacciones ─────────────────────────────────────────────────────────

  const guardarInteraccion = async () => {
    if (!userId || !contactoSeleccionado || !nuevaInteraccion.descripcion.trim()) return;
    setGuardandoInteraccion(true);
    await supabase.from("crm_interacciones").insert({
      contacto_id: contactoSeleccionado.id,
      perfil_id: userId,
      tipo: nuevaInteraccion.tipo,
      descripcion: nuevaInteraccion.descripcion,
    });
    await supabase.from("crm_contactos").update({ updated_at: new Date().toISOString() }).eq("id", contactoSeleccionado.id);
    setNuevaInteraccion({ tipo: "nota", descripcion: "" });
    setGuardandoInteraccion(false);
    cargarDetalle(contactoSeleccionado);
    if (userId) cargarContactos(userId);
  };

  const eliminarInteraccion = async (id: string) => {
    await supabase.from("crm_interacciones").delete().eq("id", id);
    if (contactoSeleccionado) cargarDetalle(contactoSeleccionado);
  };

  // ── Recordatorios ─────────────────────────────────────────────────────────

  const guardarRecordatorio = async () => {
    if (!userId || !contactoSeleccionado || !nuevoRecordatorio.descripcion.trim() || !nuevoRecordatorio.fecha) return;
    setGuardandoRecordatorio(true);
    await supabase.from("crm_recordatorios").insert({
      contacto_id: contactoSeleccionado.id,
      perfil_id: userId,
      descripcion: nuevoRecordatorio.descripcion,
      fecha_recordatorio: nuevoRecordatorio.fecha,
    });
    setNuevoRecordatorio({ descripcion: "", fecha: "" });
    setGuardandoRecordatorio(false);
    cargarDetalle(contactoSeleccionado);
  };

  const toggleRecordatorio = async (r: Recordatorio) => {
    await supabase.from("crm_recordatorios").update({ completado: !r.completado }).eq("id", r.id);
    if (contactoSeleccionado) cargarDetalle(contactoSeleccionado);
  };

  const eliminarRecordatorio = async (id: string) => {
    await supabase.from("crm_recordatorios").delete().eq("id", id);
    if (contactoSeleccionado) cargarDetalle(contactoSeleccionado);
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────

  const todasEtiquetas = useMemo(() => {
    const set = new Set<string>();
    contactos.forEach(c => (c.etiquetas ?? []).forEach(e => set.add(e)));
    return Array.from(set).sort();
  }, [contactos]);

  const filtrados = useMemo(() => {
    return contactos.filter(c => {
      if (filtroEtiqueta && !(c.etiquetas ?? []).includes(filtroEtiqueta)) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        return (
          c.nombre?.toLowerCase().includes(q) ||
          c.apellido?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.telefono?.toLowerCase().includes(q) ||
          c.inmobiliaria?.toLowerCase().includes(q) ||
          (c.etiquetas ?? []).some(e => e.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [contactos, busqueda, filtroEtiqueta]);

  const iniciales = (c: Contacto) =>
    `${c.nombre?.charAt(0) ?? ""}${c.apellido?.charAt(0) ?? ""}`.toUpperCase();

  const hoy = new Date().toISOString().split("T")[0];
  const recordatoriosPendientes = recordatorios.filter(r => !r.completado);
  const recordatoriosVencidos = recordatoriosPendientes.filter(r => r.fecha_recordatorio < hoy);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .crm-wrap { display: flex; gap: 0; height: calc(100vh - 70px); overflow: hidden; }
        /* Lista izquierda */
        .crm-lista { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.07); background: #0a0a0a; }
        .crm-lista-header { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .crm-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 10px; }
        .crm-titulo span { color: #cc0000; }
        .crm-search-wrap { position: relative; margin-bottom: 8px; }
        .crm-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: rgba(255,255,255,0.25); }
        .crm-search { width: 100%; padding: 8px 10px 8px 30px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; }
        .crm-search:focus { border-color: rgba(200,0,0,0.4); }
        .crm-search::placeholder { color: rgba(255,255,255,0.2); }
        .crm-etiquetas-filtro { display: flex; gap: 5px; flex-wrap: wrap; }
        .crm-etq-btn { padding: 3px 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .crm-etq-btn:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .crm-etq-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .crm-lista-barra { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .crm-count { font-size: 10px; color: rgba(255,255,255,0.25); font-family: 'Inter',sans-serif; }
        .crm-btn-nuevo { padding: 6px 12px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-nuevo:hover { background: #e60000; }
        .crm-lista-items { flex: 1; overflow-y: auto; }
        .crm-lista-items::-webkit-scrollbar { width: 3px; }
        .crm-lista-items::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        .crm-item { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 10px; }
        .crm-item:hover { background: rgba(255,255,255,0.03); }
        .crm-item.activo { background: rgba(200,0,0,0.06); border-left: 2px solid #cc0000; }
        .crm-avatar { width: 36px; height: 36px; border-radius: 8px; background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.2); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 800; color: #cc0000; flex-shrink: 0; }
        .crm-item-info { flex: 1; min-width: 0; }
        .crm-item-nombre { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .crm-item-sub { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .crm-item-etqs { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
        .crm-etq { font-size: 8px; padding: 1px 5px; border-radius: 8px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.2); color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .crm-empty-lista { padding: 48px 16px; text-align: center; color: rgba(255,255,255,0.2); font-size: 12px; }
        /* Panel derecho */
        .crm-detalle { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #0d0d0d; }
        .crm-detalle-vacio { flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.15); font-size: 13px; font-style: italic; }
        .crm-detalle-header { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-shrink: 0; }
        .crm-detalle-nombre { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .crm-detalle-tipo { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 3px; text-transform: uppercase; font-family: 'Montserrat',sans-serif; font-weight: 600; letter-spacing: 0.1em; }
        .crm-detalle-acciones { display: flex; gap: 8px; }
        .crm-btn-editar { padding: 6px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-eliminar { padding: 6px 14px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; color: rgba(200,0,0,0.7); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-detalle-datos { padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; flex-shrink: 0; }
        .crm-dato { display: flex; flex-direction: column; gap: 2px; }
        .crm-dato-label { font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.25); }
        .crm-dato-val { font-size: 12px; color: rgba(255,255,255,0.7); }
        .crm-detalle-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
        .crm-tab { padding: 10px 18px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; background: none; border-top: none; border-left: none; border-right: none; }
        .crm-tab.activo { color: #fff; border-bottom-color: #cc0000; }
        .crm-tab:hover { color: rgba(255,255,255,0.6); }
        .crm-detalle-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
        .crm-detalle-body::-webkit-scrollbar { width: 3px; }
        .crm-detalle-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        /* Interacciones */
        .crm-nueva-interaccion { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .crm-tipo-btns { display: flex; gap: 6px; flex-wrap: wrap; }
        .crm-tipo-btn { padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 10px; cursor: pointer; transition: all 0.15s; font-family: 'Inter',sans-serif; }
        .crm-tipo-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .crm-textarea { width: 100%; padding: 8px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; resize: none; min-height: 60px; box-sizing: border-box; }
        .crm-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .crm-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .crm-btn-guardar-int { align-self: flex-end; padding: 6px 16px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-guardar-int:disabled { opacity: 0.5; cursor: not-allowed; }
        .crm-interaccion { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 10px 12px; display: flex; gap: 10px; }
        .crm-int-icono { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
        .crm-int-body { flex: 1; }
        .crm-int-tipo { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 3px; }
        .crm-int-desc { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5; }
        .crm-int-fecha { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 4px; }
        .crm-int-del { background: none; border: none; color: rgba(255,255,255,0.2); font-size: 14px; cursor: pointer; flex-shrink: 0; padding: 0 4px; }
        .crm-int-del:hover { color: #ff4444; }
        /* Recordatorios */
        .crm-nuevo-rec { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
        .crm-input-sm { padding: 7px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; }
        .crm-input-sm:focus { border-color: rgba(200,0,0,0.4); }
        .crm-input-sm::placeholder { color: rgba(255,255,255,0.2); }
        .crm-rec { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; }
        .crm-rec.vencido { border-color: rgba(200,0,0,0.2); background: rgba(200,0,0,0.03); }
        .crm-rec.completado { opacity: 0.4; }
        .crm-rec-check { width: 18px; height: 18px; border-radius: 4px; border: 2px solid rgba(255,255,255,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
        .crm-rec-check.hecho { background: #22c55e; border-color: #22c55e; }
        .crm-rec-body { flex: 1; }
        .crm-rec-desc { font-size: 12px; color: rgba(255,255,255,0.7); }
        .crm-rec-fecha { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 2px; }
        .crm-rec-del { background: none; border: none; color: rgba(255,255,255,0.2); font-size: 14px; cursor: pointer; padding: 0 4px; }
        .crm-rec-del:hover { color: #ff4444; }
        /* Modal form */
        .crm-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: flex-start; justify-content: center; z-index: 300; padding: 24px; overflow-y: auto; }
        .crm-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 8px; padding: 28px 32px; width: 100%; max-width: 560px; margin: auto; position: relative; }
        .crm-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .crm-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .crm-modal-titulo span { color: #cc0000; }
        .crm-field { margin-bottom: 12px; }
        .crm-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .crm-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; transition: border-color 0.2s; }
        .crm-input:focus { border-color: rgba(200,0,0,0.5); }
        .crm-input::placeholder { color: rgba(255,255,255,0.2); }
        .crm-select { width: 100%; padding: 9px 12px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .crm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .crm-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 14px 0; }
        .crm-section-label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.2); margin-bottom: 10px; }
        .crm-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
        .crm-btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-save { padding: 9px 22px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .crm-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .crm-spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .crm-wrap { flex-direction: column; height: auto; } .crm-lista { width: 100%; height: 300px; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07); } }
      `}</style>

      <div className="crm-wrap">

        {/* ── Lista de contactos ── */}
        <div className="crm-lista">
          <div className="crm-lista-header">
            <div className="crm-titulo">CRM <span>GFI®</span></div>
            <div className="crm-search-wrap">
              <span className="crm-search-ico">🔍</span>
              <input
                className="crm-search"
                placeholder="Buscar contacto..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            {todasEtiquetas.length > 0 && (
              <div className="crm-etiquetas-filtro">
                {todasEtiquetas.slice(0, 8).map(e => (
                  <button
                    key={e}
                    className={`crm-etq-btn${filtroEtiqueta === e ? " activo" : ""}`}
                    onClick={() => setFiltroEtiqueta(filtroEtiqueta === e ? "" : e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="crm-lista-barra">
            <span className="crm-count">{filtrados.length} contacto{filtrados.length !== 1 ? "s" : ""}</span>
            <button className="crm-btn-nuevo" onClick={abrirFormNuevo}>+ Nuevo</button>
          </div>

          <div className="crm-lista-items">
            {loading ? (
              <div className="crm-empty-lista">Cargando...</div>
            ) : filtrados.length === 0 ? (
              <div className="crm-empty-lista">
                {busqueda || filtroEtiqueta ? "Sin resultados" : "No hay contactos todavía.\nHacé click en + Nuevo."}
              </div>
            ) : (
              filtrados.map(c => (
                <div
                  key={c.id}
                  className={`crm-item${contactoSeleccionado?.id === c.id ? " activo" : ""}`}
                  onClick={() => cargarDetalle(c)}
                >
                  <div className="crm-avatar">{iniciales(c)}</div>
                  <div className="crm-item-info">
                    <div className="crm-item-nombre">{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</div>
                    <div className="crm-item-sub">
                      {c.telefono ?? c.email ?? c.inmobiliaria ?? c.tipo ?? ""}
                    </div>
                    {(c.etiquetas ?? []).length > 0 && (
                      <div className="crm-item-etqs">
                        {(c.etiquetas ?? []).slice(0, 3).map(e => (
                          <span key={e} className="crm-etq">{e}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Panel detalle ── */}
        <div className="crm-detalle">
          {!contactoSeleccionado ? (
            <div className="crm-detalle-vacio">
              Seleccioná un contacto para ver el detalle
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="crm-detalle-header">
                <div>
                  <div className="crm-detalle-nombre">
                    {contactoSeleccionado.apellido
                      ? `${contactoSeleccionado.apellido}, ${contactoSeleccionado.nombre}`
                      : contactoSeleccionado.nombre}
                  </div>
                  <div className="crm-detalle-tipo">
                    {contactoSeleccionado.tipo ?? "contacto"}
                    {contactoSeleccionado.interes ? ` · ${contactoSeleccionado.interes}` : ""}
                    {contactoSeleccionado.origen ? ` · Origen: ${contactoSeleccionado.origen}` : ""}
                  </div>
                  {(contactoSeleccionado.etiquetas ?? []).length > 0 && (
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
                      {(contactoSeleccionado.etiquetas ?? []).map(e => (
                        <span key={e} className="crm-etq" style={{fontSize:9,padding:"2px 7px"}}>{e}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="crm-detalle-acciones">
                  <button className="crm-btn-editar" onClick={() => abrirFormEditar(contactoSeleccionado)}>Editar</button>
                  <button className="crm-btn-eliminar" onClick={() => eliminarContacto(contactoSeleccionado.id)}>Eliminar</button>
                </div>
              </div>

              {/* Datos */}
              <div className="crm-detalle-datos">
                {contactoSeleccionado.telefono && (
                  <div className="crm-dato">
                    <span className="crm-dato-label">📞 Teléfono</span>
                    <a href={`https://wa.me/54${contactoSeleccionado.telefono.replace(/\D/g,"")}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{color:"#25d366",fontSize:12,textDecoration:"none"}}>
                      {contactoSeleccionado.telefono}
                    </a>
                  </div>
                )}
                {contactoSeleccionado.email && (
                  <div className="crm-dato">
                    <span className="crm-dato-label">✉️ Email</span>
                    <a href={`mailto:${contactoSeleccionado.email}`}
                      style={{color:"rgba(200,0,0,0.7)",fontSize:12,textDecoration:"none"}}>
                      {contactoSeleccionado.email}
                    </a>
                  </div>
                )}
                {contactoSeleccionado.inmobiliaria && (
                  <div className="crm-dato">
                    <span className="crm-dato-label">🏢 Inmobiliaria</span>
                    <span className="crm-dato-val">{contactoSeleccionado.inmobiliaria}</span>
                  </div>
                )}
                {contactoSeleccionado.zona_interes && (
                  <div className="crm-dato">
                    <span className="crm-dato-label">📍 Zona</span>
                    <span className="crm-dato-val">{contactoSeleccionado.zona_interes}</span>
                  </div>
                )}
                {(contactoSeleccionado.presupuesto_min || contactoSeleccionado.presupuesto_max) && (
                  <div className="crm-dato">
                    <span className="crm-dato-label">💰 Presupuesto</span>
                    <span className="crm-dato-val">
                      {contactoSeleccionado.moneda} {contactoSeleccionado.presupuesto_min?.toLocaleString("es-AR")}
                      {contactoSeleccionado.presupuesto_max ? ` – ${contactoSeleccionado.presupuesto_max.toLocaleString("es-AR")}` : ""}
                    </span>
                  </div>
                )}
                {contactoSeleccionado.notas && (
                  <div className="crm-dato" style={{gridColumn:"1/-1"}}>
                    <span className="crm-dato-label">📋 Notas</span>
                    <span className="crm-dato-val" style={{fontSize:11,lineHeight:1.5}}>{contactoSeleccionado.notas}</span>
                  </div>
                )}
                <div className="crm-dato">
                  <span className="crm-dato-label">📅 Cargado</span>
                  <span className="crm-dato-val">{formatFecha(contactoSeleccionado.created_at)}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="crm-detalle-tabs">
                <button
                  className={`crm-tab${tabDetalle === "historial" ? " activo" : ""}`}
                  onClick={() => setTabDetalle("historial")}
                >
                  Historial {interacciones.length > 0 && `(${interacciones.length})`}
                </button>
                <button
                  className={`crm-tab${tabDetalle === "recordatorios" ? " activo" : ""}`}
                  onClick={() => setTabDetalle("recordatorios")}
                >
                  Recordatorios
                  {recordatoriosVencidos.length > 0 && (
                    <span style={{marginLeft:5,background:"#cc0000",color:"#fff",fontSize:8,padding:"1px 5px",borderRadius:8,fontFamily:"Montserrat,sans-serif",fontWeight:700}}>
                      {recordatoriosVencidos.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Cuerpo tabs */}
              <div className="crm-detalle-body">
                {loadingDetalle ? (
                  <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",padding:32}}>Cargando...</div>
                ) : tabDetalle === "historial" ? (
                  <>
                    {/* Nueva interacción */}
                    <div className="crm-nueva-interaccion">
                      <div className="crm-tipo-btns">
                        {TIPOS_INTERACCION.map(t => (
                          <button
                            key={t.value}
                            className={`crm-tipo-btn${nuevaInteraccion.tipo === t.value ? " activo" : ""}`}
                            onClick={() => setNuevaInteraccion(p => ({...p, tipo: t.value}))}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="crm-textarea"
                        placeholder="Escribí una nota, registrá una llamada, etc..."
                        value={nuevaInteraccion.descripcion}
                        onChange={e => setNuevaInteraccion(p => ({...p, descripcion: e.target.value}))}
                        rows={2}
                      />
                      <button
                        className="crm-btn-guardar-int"
                        onClick={guardarInteraccion}
                        disabled={guardandoInteraccion || !nuevaInteraccion.descripcion.trim()}
                      >
                        {guardandoInteraccion ? <><span className="crm-spinner"/>Guardando</> : "Registrar"}
                      </button>
                    </div>

                    {/* Lista interacciones */}
                    {interacciones.length === 0 ? (
                      <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:12,padding:24}}>
                        Sin interacciones todavía
                      </div>
                    ) : (
                      interacciones.map(int => {
                        const tipo = TIPOS_INTERACCION.find(t => t.value === int.tipo);
                        return (
                          <div key={int.id} className="crm-interaccion">
                            <div className="crm-int-icono">{tipo?.label.split(" ")[0] ?? "📝"}</div>
                            <div className="crm-int-body">
                              <div className="crm-int-tipo">{tipo?.label.slice(2) ?? int.tipo}</div>
                              <div className="crm-int-desc">{int.descripcion}</div>
                              <div className="crm-int-fecha">{formatFechaHora(int.created_at)}</div>
                            </div>
                            <button className="crm-int-del" onClick={() => eliminarInteraccion(int.id)} title="Eliminar">×</button>
                          </div>
                        );
                      })
                    )}
                  </>
                ) : (
                  <>
                    {/* Nuevo recordatorio */}
                    <div className="crm-nuevo-rec">
                      <input
                        className="crm-input-sm"
                        placeholder="Descripción del recordatorio..."
                        value={nuevoRecordatorio.descripcion}
                        onChange={e => setNuevoRecordatorio(p => ({...p, descripcion: e.target.value}))}
                        style={{flex:1,minWidth:160}}
                      />
                      <input
                        type="date"
                        className="crm-input-sm"
                        value={nuevoRecordatorio.fecha}
                        onChange={e => setNuevoRecordatorio(p => ({...p, fecha: e.target.value}))}
                        style={{width:140}}
                      />
                      <button
                        className="crm-btn-guardar-int"
                        onClick={guardarRecordatorio}
                        disabled={guardandoRecordatorio || !nuevoRecordatorio.descripcion.trim() || !nuevoRecordatorio.fecha}
                      >
                        {guardandoRecordatorio ? "..." : "+ Agregar"}
                      </button>
                    </div>

                    {/* Lista recordatorios */}
                    {recordatorios.length === 0 ? (
                      <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:12,padding:24}}>
                        Sin recordatorios
                      </div>
                    ) : (
                      recordatorios.map(r => {
                        const vencido = r.fecha_recordatorio < hoy && !r.completado;
                        return (
                          <div key={r.id} className={`crm-rec${r.completado ? " completado" : vencido ? " vencido" : ""}`}>
                            <div
                              className={`crm-rec-check${r.completado ? " hecho" : ""}`}
                              onClick={() => toggleRecordatorio(r)}
                            >
                              {r.completado && <span style={{fontSize:10,color:"#fff"}}>✓</span>}
                            </div>
                            <div className="crm-rec-body">
                              <div className="crm-rec-desc" style={{textDecoration: r.completado ? "line-through" : "none"}}>
                                {r.descripcion}
                              </div>
                              <div className="crm-rec-fecha" style={{color: vencido ? "#ff4444" : "rgba(255,255,255,0.25)"}}>
                                {vencido ? "⚠️ Vencido · " : ""}{formatFecha(r.fecha_recordatorio)}
                              </div>
                            </div>
                            <button className="crm-rec-del" onClick={() => eliminarRecordatorio(r.id)}>×</button>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal nuevo/editar contacto ── */}
      {mostrarForm && (
        <div className="crm-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="crm-modal">
            <div className="crm-modal-titulo">
              {editandoId ? "Editar" : "Nuevo"} <span>contacto</span>
            </div>

            <div className="crm-section-label">Datos personales</div>
            <div className="crm-row">
              <div className="crm-field">
                <label className="crm-label">Nombre *</label>
                <input className="crm-input" value={form.nombre} onChange={e => setForm(p => ({...p, nombre: e.target.value}))} placeholder="Juan" />
              </div>
              <div className="crm-field">
                <label className="crm-label">Apellido</label>
                <input className="crm-input" value={form.apellido} onChange={e => setForm(p => ({...p, apellido: e.target.value}))} placeholder="García" />
              </div>
            </div>
            <div className="crm-row">
              <div className="crm-field">
                <label className="crm-label">Teléfono</label>
                <input className="crm-input" value={form.telefono} onChange={e => setForm(p => ({...p, telefono: e.target.value}))} placeholder="3415001234" />
              </div>
              <div className="crm-field">
                <label className="crm-label">Email</label>
                <input className="crm-input" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="juan@email.com" />
              </div>
            </div>
            <div className="crm-row">
              <div className="crm-field">
                <label className="crm-label">Tipo</label>
                <select className="crm-select" value={form.tipo} onChange={e => setForm(p => ({...p, tipo: e.target.value}))}>
                  {TIPOS_CONTACTO.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="crm-field">
                <label className="crm-label">Origen</label>
                <select className="crm-select" value={form.origen} onChange={e => setForm(p => ({...p, origen: e.target.value}))}>
                  <option value="">Sin especificar</option>
                  {ORIGENES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="crm-field">
              <label className="crm-label">Inmobiliaria</label>
              <input className="crm-input" value={form.inmobiliaria} onChange={e => setForm(p => ({...p, inmobiliaria: e.target.value}))} placeholder="Opcional" />
            </div>

            <div className="crm-divider" />
            <div className="crm-section-label">Interés inmobiliario</div>

            <div className="crm-row">
              <div className="crm-field">
                <label className="crm-label">Interés</label>
                <select className="crm-select" value={form.interes} onChange={e => setForm(p => ({...p, interes: e.target.value}))}>
                  <option value="">Sin especificar</option>
                  {INTERESES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="crm-field">
                <label className="crm-label">Zona de interés</label>
                <input className="crm-input" value={form.zona_interes} onChange={e => setForm(p => ({...p, zona_interes: e.target.value}))} placeholder="Fisherton, Rosario..." />
              </div>
            </div>
            <div className="crm-row">
              <div className="crm-field">
                <label className="crm-label">Presupuesto mín.</label>
                <input className="crm-input" type="number" value={form.presupuesto_min} onChange={e => setForm(p => ({...p, presupuesto_min: e.target.value}))} placeholder="50000" />
              </div>
              <div className="crm-field">
                <label className="crm-label">Presupuesto máx.</label>
                <input className="crm-input" type="number" value={form.presupuesto_max} onChange={e => setForm(p => ({...p, presupuesto_max: e.target.value}))} placeholder="200000" />
              </div>
            </div>
            <div className="crm-field">
              <label className="crm-label">Moneda</label>
              <div style={{display:"flex",gap:8}}>
                {["USD","ARS"].map(m => (
                  <button key={m} type="button"
                    style={{padding:"6px 14px",borderRadius:3,border:`1px solid ${form.moneda===m?"#cc0000":"rgba(255,255,255,0.1)"}`,background:form.moneda===m?"rgba(200,0,0,0.1)":"transparent",color:form.moneda===m?"#fff":"rgba(255,255,255,0.4)",fontFamily:"Montserrat,sans-serif",fontSize:10,fontWeight:700,cursor:"pointer"}}
                    onClick={() => setForm(p => ({...p, moneda: m}))}
                  >{m}</button>
                ))}
              </div>
            </div>

            <div className="crm-divider" />
            <div className="crm-section-label">Etiquetas y notas</div>

            <div className="crm-field">
              <label className="crm-label">Etiquetas <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:9,color:"rgba(255,255,255,0.2)"}}>separadas por coma</span></label>
              <input className="crm-input" value={form.etiquetas} onChange={e => setForm(p => ({...p, etiquetas: e.target.value}))} placeholder="comprador, urgente, zona norte..." />
            </div>
            <div className="crm-field">
              <label className="crm-label">Notas</label>
              <textarea className="crm-textarea" value={form.notas} onChange={e => setForm(p => ({...p, notas: e.target.value}))} placeholder="Observaciones generales..." rows={3} style={{width:"100%",boxSizing:"border-box"}} />
            </div>

            <div className="crm-modal-actions">
              <button className="crm-btn-cancel" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="crm-btn-save" onClick={guardarContacto} disabled={guardando || !form.nombre}>
                {guardando ? <><span className="crm-spinner"/>Guardando...</> : editandoId ? "Guardar cambios" : "Crear contacto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
