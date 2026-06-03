"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos inbox multi-canal ───────────────────────────────────────────────────

interface Interaccion {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  tipo: string;
  direccion: string;
  asunto: string | null;
  cuerpo: string | null;
  leido: boolean;
  created_at: string;
  updated_at: string;
  contacto?: { nombre: string | null; telefono: string | null; email: string | null } | null;
}

interface MensajeChat {
  id: string;
  de: "entrante" | "saliente";
  texto: string;
  fecha: string;
}

type TabId = "todos" | "whatsapp" | "email" | "portal" | "noleidos";

// ── Tipos leads (bandeja clásica) ─────────────────────────────────────────────

interface Lead {
  id: string;
  perfil_id: string;
  propiedad_id: string | null;
  contacto_id: string | null;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  mensaje: string | null;
  origen: string;
  estado: string;
  prioridad: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
  cartera_propiedades?: { titulo: string } | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "Me comunico a la brevedad",
  "Paso info de la propiedad",
  "Agendamos una visita?",
];

const CANAL_META: Record<string, { label: string; color: string; bg: string }> = {
  whatsapp:    { label: "WhatsApp", color: "#25d366", bg: "rgba(37,211,102,0.12)" },
  email:       { label: "Email",    color: "#4ab8d8", bg: "rgba(74,184,216,0.12)" },
  portal_lead: { label: "Portal",   color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  sms:         { label: "SMS",      color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  llamada:     { label: "Llamada",  color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
};

function canalMeta(tipo: string) {
  return CANAL_META[tipo] ?? { label: tipo, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
}

function initials(nombre: string | null | undefined): string {
  if (!nombre) return "?";
  const parts = nombre.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function previewTexto(texto: string | null | undefined): string {
  if (!texto) return "";
  const lines = texto.split("\n").filter(l => l.trim());
  const last2 = lines.slice(-2).join(" ").trim();
  return last2.length > 100 ? last2.slice(0, 100) + "…" : last2;
}

function generarHistorial(ix: Interaccion): MensajeChat[] {
  const msgs: MensajeChat[] = [];
  const base = new Date(ix.created_at).getTime();
  if (ix.cuerpo) {
    msgs.push({ id: ix.id + "_1", de: "entrante", texto: ix.cuerpo, fecha: ix.created_at });
  }
  if (ix.tipo === "whatsapp") {
    msgs.push({
      id: ix.id + "_2", de: "saliente",
      texto: "Hola! Gracias por contactarnos. En breve me comunico con más información.",
      fecha: new Date(base + 5 * 60000).toISOString(),
    });
  }
  return msgs;
}

const ORIGEN_EMOJI: Record<string, string> = {
  manual: "✏️", zonaprop: "🏠", argenprop: "🏡", mercadolibre: "🛒",
  tokko: "🔷", kiteprop: "🪁", whatsapp: "💬", instagram: "📸",
  web: "🌐", otro: "📌",
};

const ESTADO_COLOR: Record<string, string> = {
  nuevo: "#990000", contactado: "#d4960c", en_seguimiento: "#4ab8d8",
  visita_coordinada: "#a78bfa", cerrado: "#3abab6", descartado: "#6b7280",
};

const PRIO_COLOR: Record<string, string> = { alta: "#b80000", media: "#d4960c", baja: "#6b7280" };

const FORM_VACIO = {
  nombre: "", telefono: "", email: "", mensaje: "",
  origen: "manual", estado: "nuevo", prioridad: "media", notas: "", propiedad_id: "",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export default function InboxPage() {
  // ── Inbox multi-canal ──────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [tab, setTab] = useState<TabId>("todos");
  const [busquedaInbox, setBusquedaInbox] = useState("");
  const [seleccionado, setSeleccionado] = useState<Interaccion | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajesExtra, setMensajesExtra] = useState<MensajeChat[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Leads clásicos ─────────────────────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [propiedades, setPropiedades] = useState<{ id: string; titulo: string }[]>([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroOrigen, setFiltroOrigen] = useState("");
  const [busquedaLeads, setBusquedaLeads] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await Promise.all([
        cargarInteracciones(data.user.id),
        cargarLeads(data.user.id),
        cargarPropiedades(data.user.id),
      ]);
      setLoadingInbox(false);
    };
    init();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [seleccionado, mensajesExtra]);

  // ── Inbox ──────────────────────────────────────────────────────────────────

  const cargarInteracciones = async (uid: string) => {
    const { data } = await supabase
      .from("crm_interacciones")
      .select("*, contacto:contacto_id(nombre, telefono, email)")
      .eq("perfil_id", uid)
      .in("tipo", ["whatsapp", "email", "portal_lead", "sms", "llamada"])
      .order("created_at", { ascending: false })
      .limit(200);
    setInteracciones((data as unknown as Interaccion[]) ?? []);
  };

  const marcarLeido = async (id: string) => {
    await supabase.from("crm_interacciones").update({ leido: true }).eq("id", id);
    setInteracciones(prev => prev.map(x => x.id === id ? { ...x, leido: true } : x));
  };

  const enviarRespuesta = async () => {
    if (!respuesta.trim() || !seleccionado || !userId) return;
    setEnviando(true);
    const nuevo: MensajeChat = {
      id: Date.now().toString(),
      de: "saliente",
      texto: respuesta.trim(),
      fecha: new Date().toISOString(),
    };
    setMensajesExtra(prev => [...prev, nuevo]);
    await supabase.from("crm_interacciones").insert({
      perfil_id: userId,
      contacto_id: seleccionado.contacto_id,
      tipo: seleccionado.tipo,
      direccion: "saliente",
      cuerpo: respuesta.trim(),
      leido: true,
      created_at: nuevo.fecha,
      updated_at: nuevo.fecha,
    });
    setRespuesta("");
    setEnviando(false);
  };

  const abrirHilo = (ix: Interaccion) => {
    setSeleccionado(ix);
    setMensajesExtra([]);
    setRespuesta("");
    if (!ix.leido) marcarLeido(ix.id);
  };

  const noLeidosCount = interacciones.filter(x => !x.leido).length;

  const filtradosInbox = interacciones.filter(ix => {
    if (tab === "whatsapp" && ix.tipo !== "whatsapp") return false;
    if (tab === "email" && ix.tipo !== "email") return false;
    if (tab === "portal" && ix.tipo !== "portal_lead") return false;
    if (tab === "noleidos" && ix.leido) return false;
    if (busquedaInbox) {
      const q = busquedaInbox.toLowerCase();
      const nom = (ix.contacto?.nombre ?? ix.asunto ?? "").toLowerCase();
      const cuerpo = (ix.cuerpo ?? "").toLowerCase();
      return nom.includes(q) || cuerpo.includes(q);
    }
    return true;
  });

  const historial = seleccionado ? [
    ...generarHistorial(seleccionado),
    ...mensajesExtra,
  ] : [];

  const TABS: { id: TabId; label: string }[] = [
    { id: "todos",    label: "Todos" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "email",    label: "Email" },
    { id: "portal",   label: "Portales" },
    { id: "noleidos", label: `No leídos${noLeidosCount > 0 ? ` (${noLeidosCount})` : ""}` },
  ];

  // ── Leads ──────────────────────────────────────────────────────────────────

  const cargarLeads = async (uid: string) => {
    const { data } = await supabase
      .from("crm_leads")
      .select("*, cartera_propiedades(titulo)")
      .eq("perfil_id", uid)
      .order("created_at", { ascending: false });
    setLeads((data as unknown as Lead[]) ?? []);
  };

  const cargarPropiedades = async (uid: string) => {
    const { data } = await supabase
      .from("cartera_propiedades")
      .select("id, titulo")
      .eq("perfil_id", uid)
      .order("titulo");
    setPropiedades(data ?? []);
  };

  const guardar = async () => {
    if (!userId) return;
    setGuardando(true);
    const payload = {
      perfil_id: userId,
      nombre: form.nombre.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      mensaje: form.mensaje.trim() || null,
      origen: form.origen,
      estado: form.estado,
      prioridad: form.prioridad,
      notas: form.notas.trim() || null,
      propiedad_id: form.propiedad_id || null,
      updated_at: new Date().toISOString(),
    };
    if (editandoId) {
      await supabase.from("crm_leads").update(payload).eq("id", editandoId);
    } else {
      await supabase.from("crm_leads").insert({ ...payload, created_by: userId });
    }
    if (userId) await cargarLeads(userId);
    setMostrarForm(false);
    setGuardando(false);
    setEditandoId(null);
  };

  const abrirEditar = (l: Lead) => {
    setEditandoId(l.id);
    setForm({
      nombre: l.nombre ?? "", telefono: l.telefono ?? "", email: l.email ?? "",
      mensaje: l.mensaje ?? "", origen: l.origen, estado: l.estado,
      prioridad: l.prioridad, notas: l.notas ?? "", propiedad_id: l.propiedad_id ?? "",
    });
    setMostrarForm(true);
  };

  const cambiarEstado = async (id: string, estado: string) => {
    if (!userId) return;
    await supabase.from("crm_leads").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
    setLeads(l => l.map(x => x.id === id ? { ...x, estado } : x));
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este lead?")) return;
    await supabase.from("crm_leads").delete().eq("id", id);
    setLeads(l => l.filter(x => x.id !== id));
  };

  const contactarWhatsApp = (l: Lead) => {
    if (!l.telefono) return;
    const tel = l.telefono.replace(/\D/g, "");
    const prop = l.cartera_propiedades;
    const txt = encodeURIComponent(
      `Hola ${l.nombre ?? ""}! Te contacto por ${prop?.titulo ?? "la propiedad que consultaste"}. ¿Estás disponible para coordinar?`
    );
    window.open(`https://wa.me/${tel.startsWith("54") ? tel : "54" + tel}?text=${txt}`, "_blank");
  };

  const leadsFiltrados = leads.filter(l => {
    if (filtroEstado && l.estado !== filtroEstado) return false;
    if (filtroOrigen && l.origen !== filtroOrigen) return false;
    if (busquedaLeads) {
      const q = busquedaLeads.toLowerCase();
      return (l.nombre ?? "").toLowerCase().includes(q) ||
        (l.telefono ?? "").includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.cartera_propiedades?.titulo ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const nuevos = leads.filter(l => l.estado === "nuevo").length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Layout ── */
        .ib-wrap { min-height: 100vh; background: #0a0a0a; display: flex; flex-direction: column; color: #fff; font-family: Inter,sans-serif; }
        .ib-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--gfi-border-subtle); flex-shrink: 0; }
        .ib-back { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .1em; color: var(--gfi-text-muted); text-decoration: none; text-transform: uppercase; }
        .ib-back:hover { color: #fff; }
        .ib-titulo { font-family: Montserrat,sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .ib-badge-red { background: #990000; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 10px; font-family: Montserrat,sans-serif; }
        .ib-spacer { flex: 1; }
        .ib-btn-primary { padding: 8px 16px; border-radius: 6px; background: #990000; color: #fff; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; border: none; }

        /* ── Tabs ── */
        .ib-tabs { display: flex; gap: 2px; padding: 10px 20px 0; border-bottom: 1px solid var(--gfi-border-subtle); flex-shrink: 0; overflow-x: auto; }
        .ib-tab { padding: 8px 16px; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; border: none; background: transparent; color: var(--gfi-text-muted); border-bottom: 2px solid transparent; white-space: nowrap; }
        .ib-tab:hover { color: #fff; }
        .ib-tab.active { color: #fff; border-bottom-color: #990000; }

        /* ── Split body ── */
        .ib-body { flex: 1; display: flex; min-height: 0; overflow: hidden; }
        .ib-lista { width: 360px; min-width: 260px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--gfi-border-subtle); }
        .ib-search-row { padding: 10px 14px; border-bottom: 1px solid var(--gfi-border-subtle); }
        .ib-search { width: 100%; padding: 8px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 6px; color: #fff; font-size: 13px; outline: none; font-family: Inter,sans-serif; }
        .ib-items { flex: 1; overflow-y: auto; }
        .ib-item { display: flex; gap: 10px; align-items: flex-start; padding: 14px; border-bottom: 1px solid var(--gfi-border-subtle); cursor: pointer; transition: background .15s; }
        .ib-item:hover { background: rgba(255,255,255,.03); }
        .ib-item.selected { background: rgba(153,0,0,.12); border-left: 3px solid #990000; }
        .ib-item.unread .ib-item-nombre { color: #fff; font-weight: 800; }
        .ib-item:not(.unread) .ib-item-nombre { color: rgba(255,255,255,.7); }
        .ib-avatar { width: 38px; height: 38px; border-radius: 50%; background: #990000; display: flex; align-items: center; justify-content: center; font-family: Montserrat,sans-serif; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
        .ib-item-body { flex: 1; min-width: 0; }
        .ib-item-top { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
        .ib-item-nombre { font-family: Montserrat,sans-serif; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .ib-item-time { font-size: 10px; color: var(--gfi-text-muted); flex-shrink: 0; }
        .ib-item-preview { font-size: 12px; color: rgba(255,255,255,.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; }
        .ib-item-meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
        .ib-canal-badge { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 10px; font-size: 9px; font-weight: 700; font-family: Montserrat,sans-serif; text-transform: uppercase; }
        .ib-unread-dot { width: 7px; height: 7px; border-radius: 50%; background: #990000; flex-shrink: 0; }
        .ib-empty { text-align: center; color: var(--gfi-text-muted); font-size: 13px; padding: 50px 20px; line-height: 1.6; }

        /* ── Panel derecho ── */
        .ib-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .ib-panel-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--gfi-text-muted); font-size: 14px; }
        .ib-panel-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--gfi-border-subtle); flex-shrink: 0; }
        .ib-panel-avatar { width: 36px; height: 36px; border-radius: 50%; background: #990000; display: flex; align-items: center; justify-content: center; font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0; }
        .ib-panel-nombre { font-family: Montserrat,sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .ib-panel-sub { font-size: 11px; color: var(--gfi-text-muted); margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

        /* ── Chat ── */
        .ib-chat { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
        .ib-msg { max-width: 72%; }
        .ib-msg.entrante { align-self: flex-start; }
        .ib-msg.saliente { align-self: flex-end; }
        .ib-msg-burbuja { padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
        .ib-msg.entrante .ib-msg-burbuja { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); color: rgba(255,255,255,.85); border-bottom-left-radius: 4px; }
        .ib-msg.saliente .ib-msg-burbuja { background: #990000; color: #fff; border-bottom-right-radius: 4px; }
        .ib-msg-time { font-size: 10px; color: var(--gfi-text-muted); margin-top: 4px; }
        .ib-msg.saliente .ib-msg-time { text-align: right; }

        /* ── Quick replies ── */
        .ib-quick { padding: 8px 20px; border-top: 1px solid var(--gfi-border-subtle); display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; align-items: center; }
        .ib-quick-label { font-size: 10px; font-family: Montserrat,sans-serif; color: var(--gfi-text-muted); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
        .ib-quick-btn { padding: 5px 11px; border: 1px solid var(--gfi-border); background: var(--gfi-border-subtle); color: rgba(255,255,255,.65); border-radius: 16px; font-size: 11px; cursor: pointer; font-family: Inter,sans-serif; transition: all .15s; }
        .ib-quick-btn:hover { border-color: rgba(153,0,0,.5); color: #fff; background: rgba(153,0,0,.1); }

        /* ── Reply box ── */
        .ib-reply { display: flex; gap: 10px; align-items: flex-end; padding: 12px 20px; border-top: 1px solid var(--gfi-border-subtle); flex-shrink: 0; background: #0d0d0d; }
        .ib-reply-input { flex: 1; padding: 10px 14px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 10px; color: #fff; font-size: 13px; outline: none; font-family: Inter,sans-serif; resize: none; min-height: 42px; max-height: 120px; line-height: 1.4; }
        .ib-reply-input:focus { border-color: rgba(153,0,0,.5); }
        .ib-reply-btn { padding: 10px 18px; background: #990000; color: #fff; border: none; border-radius: 8px; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; flex-shrink: 0; }
        .ib-reply-btn:disabled { opacity: .5; cursor: default; }

        /* ── Leads section ── */
        .ib-section-header { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid var(--gfi-border-subtle); }
        .ib-section-title { font-family: Montserrat,sans-serif; font-size: 13px; font-weight: 800; color: #fff; }
        .in-toolbar { display: flex; gap: 8px; padding: 10px 20px; border-bottom: 1px solid var(--gfi-border-subtle); flex-wrap: wrap; }
        .in-search { flex: 1; min-width: 180px; padding: 8px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 6px; color: #fff; font-size: 13px; outline: none; }
        .in-sel { padding: 8px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 6px; color: #fff; font-size: 12px; outline: none; cursor: pointer; }
        .in-list { flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 8px; }
        .in-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 10px; padding: 14px 16px; }
        .in-card:hover { border-color: rgba(255,255,255,0.14); }
        .in-card-top { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
        .in-card-body { flex: 1; }
        .in-nombre { font-family: Montserrat,sans-serif; font-size: 13px; font-weight: 700; color: #fff; }
        .in-prop { font-size: 11px; color: var(--gfi-text-muted); margin-top: 2px; }
        .in-msg { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 6px; line-height: 1.4; }
        .in-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; font-size: 11px; color: var(--gfi-text-muted); }
        .in-badge-estado { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; font-family: Montserrat,sans-serif; text-transform: uppercase; }
        .in-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .in-act-btn { padding: 4px 10px; border-radius: 4px; font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: 1px solid var(--gfi-border); background: var(--gfi-border-subtle); color: rgba(255,255,255,0.55); }
        .in-act-btn:hover { background: var(--gfi-border); color: #fff; }
        .in-empty { text-align: center; color: var(--gfi-text-muted); font-size: 14px; padding: 40px 20px; }

        /* ── Modal ── */
        .in-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .in-modal { background: #111; border: 1px solid var(--gfi-border); border-radius: 12px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .in-modal-title { font-family: Montserrat,sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 18px; }
        .in-field { margin-bottom: 12px; }
        .in-label { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 4px; display: block; }
        .in-input { width: 100%; padding: 9px 12px; background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); border-radius: 6px; color: #fff; font-size: 13px; outline: none; font-family: Inter,sans-serif; }
        .in-input:focus { border-color: rgba(153,0,0,0.5); }
        .in-row { display: flex; gap: 10px; }
        .in-row .in-field { flex: 1; }
        .in-modal-actions { display: flex; gap: 10px; margin-top: 18px; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .ib-lista { width: 100%; border-right: none; }
          .ib-lista.hide-mobile { display: none; }
          .ib-panel { position: absolute; inset: 0; background: #0a0a0a; z-index: 10; }
          .ib-panel.hide-mobile { display: none; }
          .ib-body { position: relative; overflow: hidden; }
          .ib-panel-back-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .ib-panel-back-btn { display: none !important; }
        }
        .ib-panel-back-btn { padding: 0 8px 0 0; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--gfi-text-muted); background: transparent; border: none; cursor: pointer; }
        .ib-panel-back-btn:hover { color: #fff; }
      `}</style>

      <div className="ib-wrap">
        {/* Header */}
        <div className="ib-header">
          <Link href="/crm" className="ib-back">← CRM</Link>
          <div className="ib-titulo">Inbox Unificado</div>
          {noLeidosCount > 0 && (
            <span className="ib-badge-red">{noLeidosCount} no leído{noLeidosCount !== 1 ? "s" : ""}</span>
          )}
          {nuevos > 0 && (
            <span className="ib-badge-red" style={{ background: "#d4960c" }}>
              {nuevos} lead{nuevos !== 1 ? "s" : ""} nuevo{nuevos !== 1 ? "s" : ""}
            </span>
          )}
          <div className="ib-spacer" />
          <button
            className="ib-btn-primary"
            onClick={() => { setEditandoId(null); setForm(FORM_VACIO); setMostrarForm(true); }}
          >
            + Nuevo lead
          </button>
        </div>

        {/* Tabs */}
        <div className="ib-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`ib-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Split layout: inbox de interacciones */}
        <div className="ib-body">
          {/* Lista */}
          <div className={`ib-lista${seleccionado ? " hide-mobile" : ""}`}>
            <div className="ib-search-row">
              <input
                className="ib-search"
                placeholder="Buscar mensajes..."
                value={busquedaInbox}
                onChange={e => setBusquedaInbox(e.target.value)}
              />
            </div>
            <div className="ib-items">
              {loadingInbox ? (
                <div className="ib-empty">Cargando...</div>
              ) : filtradosInbox.length === 0 ? (
                <div className="ib-empty">
                  {interacciones.length === 0
                    ? "No hay mensajes aún.\nLas consultas de WhatsApp, email y portales aparecerán aquí cuando estén integradas."
                    : "No hay resultados con esos filtros."}
                </div>
              ) : filtradosInbox.map(ix => {
                const cm = canalMeta(ix.tipo);
                const nombre = ix.contacto?.nombre ?? ix.asunto ?? "Sin nombre";
                const isSelected = seleccionado?.id === ix.id;
                return (
                  <div
                    key={ix.id}
                    className={`ib-item${isSelected ? " selected" : ""}${!ix.leido ? " unread" : ""}`}
                    onClick={() => abrirHilo(ix)}
                  >
                    <div className="ib-avatar">{initials(nombre)}</div>
                    <div className="ib-item-body">
                      <div className="ib-item-top">
                        <div className="ib-item-nombre">{nombre}</div>
                        <div className="ib-item-time">{timeAgo(ix.created_at)}</div>
                        {!ix.leido && <div className="ib-unread-dot" />}
                      </div>
                      <div className="ib-item-preview">{previewTexto(ix.cuerpo)}</div>
                      <div className="ib-item-meta">
                        <span className="ib-canal-badge" style={{ color: cm.color, background: cm.bg }}>
                          {cm.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel detalle / chat */}
          <div className={`ib-panel${!seleccionado ? " hide-mobile" : ""}`}>
            {!seleccionado ? (
              <div className="ib-panel-placeholder">
                Seleccioná un mensaje para ver el hilo
              </div>
            ) : (
              <>
                <div className="ib-panel-header">
                  <button className="ib-panel-back-btn" onClick={() => setSeleccionado(null)}>
                    ← Volver
                  </button>
                  <div className="ib-panel-avatar">
                    {initials(seleccionado.contacto?.nombre ?? seleccionado.asunto)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ib-panel-nombre">
                      {seleccionado.contacto?.nombre ?? seleccionado.asunto ?? "Sin nombre"}
                    </div>
                    <div className="ib-panel-sub">
                      {seleccionado.contacto?.telefono && <span>{seleccionado.contacto.telefono}</span>}
                      {seleccionado.contacto?.email && <span>{seleccionado.contacto.email}</span>}
                      <span
                        className="ib-canal-badge"
                        style={{
                          color: canalMeta(seleccionado.tipo).color,
                          background: canalMeta(seleccionado.tipo).bg,
                        }}
                      >
                        {canalMeta(seleccionado.tipo).label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ib-chat">
                  {historial.length === 0 ? (
                    <div style={{ color: "var(--gfi-text-muted)", fontSize: 13, textAlign: "center", marginTop: 30 }}>
                      Sin mensajes en el historial.
                    </div>
                  ) : historial.map(m => (
                    <div key={m.id} className={`ib-msg ${m.de}`}>
                      <div className="ib-msg-burbuja">{m.texto}</div>
                      <div className="ib-msg-time">{timeAgo(m.fecha)}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="ib-quick">
                  <span className="ib-quick-label">Rápidas:</span>
                  {QUICK_REPLIES.map(qr => (
                    <button key={qr} className="ib-quick-btn" onClick={() => setRespuesta(qr)}>
                      {qr}
                    </button>
                  ))}
                </div>

                <div className="ib-reply">
                  <textarea
                    className="ib-reply-input"
                    placeholder="Escribí tu respuesta... (Enter envía, Shift+Enter nueva línea)"
                    value={respuesta}
                    onChange={e => setRespuesta(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        enviarRespuesta();
                      }
                    }}
                    rows={1}
                  />
                  <button
                    className="ib-reply-btn"
                    onClick={enviarRespuesta}
                    disabled={!respuesta.trim() || enviando}
                  >
                    {enviando ? "..." : "Enviar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sección leads clásica */}
        <div className="ib-section-header">
          <div className="ib-section-title">Leads / Consultas</div>
          {nuevos > 0 && <span className="ib-badge-red">{nuevos} nuevo{nuevos !== 1 ? "s" : ""}</span>}
          <div className="ib-spacer" />
        </div>
        <div className="in-toolbar">
          <input
            className="in-search"
            placeholder="Buscar por nombre, tel, email, propiedad..."
            value={busquedaLeads}
            onChange={e => setBusquedaLeads(e.target.value)}
          />
          <select className="in-sel" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.keys(ESTADO_COLOR).map(e => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
          </select>
          <select className="in-sel" value={filtroOrigen} onChange={e => setFiltroOrigen(e.target.value)}>
            <option value="">Todos los orígenes</option>
            {Object.keys(ORIGEN_EMOJI).map(o => <option key={o} value={o}>{ORIGEN_EMOJI[o]} {o}</option>)}
          </select>
        </div>

        <div className="in-list">
          {loadingInbox ? (
            <div className="in-empty">Cargando leads...</div>
          ) : leadsFiltrados.length === 0 ? (
            <div className="in-empty">
              {leads.length === 0
                ? "Sin leads. Las consultas de portales aparecerán aquí cuando estén integradas. También podés agregar leads manualmente."
                : "No hay resultados con esos filtros."}
            </div>
          ) : leadsFiltrados.map(l => {
            const estadoColor = ESTADO_COLOR[l.estado] ?? "#666";
            const prioColor = PRIO_COLOR[l.prioridad] ?? "#666";
            return (
              <div key={l.id} className="in-card">
                <div className="in-card-top">
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{ORIGEN_EMOJI[l.origen] ?? "📌"}</div>
                  <div className="in-card-body">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div className="in-nombre">{l.nombre ?? "Sin nombre"}</div>
                      <span className="in-badge-estado" style={{ background: `${estadoColor}22`, color: estadoColor, border: `1px solid ${estadoColor}44` }}>
                        {l.estado.replace("_", " ")}
                      </span>
                      <span title={`Prioridad ${l.prioridad}`} style={{ width: 8, height: 8, borderRadius: "50%", background: prioColor, display: "inline-block" }} />
                    </div>
                    {l.cartera_propiedades && <div className="in-prop">🏠 {l.cartera_propiedades.titulo}</div>}
                    {l.mensaje && <div className="in-msg">"{l.mensaje.slice(0, 120)}{l.mensaje.length > 120 ? "…" : ""}"</div>}
                    <div className="in-meta">
                      {l.telefono && <span>📱 {l.telefono}</span>}
                      {l.email && <span>✉️ {l.email}</span>}
                      <span>{timeAgo(l.created_at)}</span>
                      <span style={{ textTransform: "capitalize" }}>{l.origen}</span>
                    </div>
                    {l.notas && <div style={{ marginTop: 6, fontSize: 11, color: "var(--gfi-text-muted)", fontStyle: "italic" }}>{l.notas}</div>}
                    <div className="in-actions">
                      <button className="in-act-btn" onClick={() => abrirEditar(l)}>✏️ Editar</button>
                      {l.estado === "nuevo" && <button className="in-act-btn" style={{ color: "#d4960c", borderColor: "rgba(234,179,8,0.3)" }} onClick={() => cambiarEstado(l.id, "contactado")}>📞 Contactado</button>}
                      {l.estado === "contactado" && <button className="in-act-btn" style={{ color: "#4ab8d8", borderColor: "rgba(74,184,216,0.3)" }} onClick={() => cambiarEstado(l.id, "en_seguimiento")}>Seguimiento</button>}
                      {l.estado === "en_seguimiento" && <button className="in-act-btn" style={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)" }} onClick={() => cambiarEstado(l.id, "visita_coordinada")}>Visita</button>}
                      {!["cerrado", "descartado"].includes(l.estado) && <button className="in-act-btn" style={{ color: "#3abab6", borderColor: "rgba(34,197,94,0.3)" }} onClick={() => cambiarEstado(l.id, "cerrado")}>✓ Cerrado</button>}
                      {l.telefono && <button className="in-act-btn" style={{ color: "#25d366", borderColor: "rgba(37,211,102,0.3)" }} onClick={() => contactarWhatsApp(l)}>WA</button>}
                      <button className="in-act-btn" style={{ color: "var(--gfi-text-dim)" }} onClick={() => eliminar(l.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal nuevo/editar lead */}
      {mostrarForm && (
        <div className="in-overlay">
          <div className="in-modal">
            <div className="in-modal-title">{editandoId ? "Editar lead" : "Nuevo lead"}</div>
            <div className="in-row">
              <div className="in-field">
                <label className="in-label">Nombre</label>
                <input className="in-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Juan Pérez" />
              </div>
              <div className="in-field">
                <label className="in-label">Teléfono</label>
                <input className="in-input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="+54 341..." />
              </div>
            </div>
            <div className="in-field">
              <label className="in-label">Email</label>
              <input className="in-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="in-field">
              <label className="in-label">Propiedad consultada</label>
              <select className="in-input" value={form.propiedad_id} onChange={e => setForm(f => ({ ...f, propiedad_id: e.target.value }))}>
                <option value="">Sin propiedad asignada</option>
                {propiedades.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>
            <div className="in-field">
              <label className="in-label">Mensaje</label>
              <textarea className="in-input" rows={3} value={form.mensaje} onChange={e => setForm(f => ({ ...f, mensaje: e.target.value }))} placeholder="Consulta del interesado..." style={{ resize: "vertical" }} />
            </div>
            <div className="in-row">
              <div className="in-field">
                <label className="in-label">Origen</label>
                <select className="in-input" value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))}>
                  {Object.keys(ORIGEN_EMOJI).map(o => <option key={o} value={o}>{ORIGEN_EMOJI[o]} {o}</option>)}
                </select>
              </div>
              <div className="in-field">
                <label className="in-label">Prioridad</label>
                <select className="in-input" value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div className="in-field">
                <label className="in-label">Estado</label>
                <select className="in-input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.keys(ESTADO_COLOR).map(e => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
            <div className="in-field">
              <label className="in-label">Notas internas</label>
              <textarea className="in-input" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
            <div className="in-modal-actions">
              <button className="ib-btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : editandoId ? "Guardar" : "Crear lead"}
              </button>
              <button
                style={{ padding: "8px 16px", background: "var(--gfi-border-subtle)", color: "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)", borderRadius: 6, cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700 }}
                onClick={() => setMostrarForm(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
