"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import LeadScoreButton from "../LeadScoreButton";

// ── Types ────────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo: string | null;
  estado: string | null;
  origen: string | null;
  interes: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  moneda: string | null;
  zona_interes: string | null;
  etiquetas: string[] | null;
  notas: string | null;
  inmobiliaria: string | null;
  matricula: string | null;
  created_at: string;
  updated_at: string;
}

interface Interaccion {
  id: string;
  tipo: string;
  descripcion: string;
  created_at: string;
}

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string;
  created_at: string;
}

interface Recordatorio {
  id: string;
  descripcion: string;
  fecha_recordatorio: string;
  completado: boolean;
}

interface Tarea {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string | null;
  fecha_vencimiento: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const fmtMon = (n: number, m: string) =>
  m === "USD" ? `USD ${n.toLocaleString("es-AR")}` : `$ ${n.toLocaleString("es-AR")}`;

const TIPO_INTERACCION: Record<string, { icon: string; colorClass: string; color: string }> = {
  llamada:   { icon: "📞", colorClass: "gfi-badge--green",  color: "#3abab6" },
  email:     { icon: "📧", colorClass: "gfi-badge--blue",   color: "#4ab8d8" },
  visita:    { icon: "🏠", colorClass: "gfi-badge--orange", color: "#d4960c" },
  whatsapp:  { icon: "💬", colorClass: "gfi-badge--green",  color: "#25d366" },
  "reunión": { icon: "🤝", colorClass: "gfi-badge--gray",   color: "#a855f7" },
  reunion:   { icon: "🤝", colorClass: "gfi-badge--gray",   color: "#a855f7" },
  nota:      { icon: "📝", colorClass: "gfi-badge--gray",   color: "var(--gfi-text-secondary)" },
  propuesta: { icon: "📋", colorClass: "gfi-badge--orange", color: "#d4960c" },
  otro:      { icon: "⚡", colorClass: "gfi-badge--red",    color: "var(--gfi-red)" },
};

const ETAPA_COLOR: Record<string, string> = {
  prospecto: "var(--gfi-text-muted)", contactado: "#4ab8d8",
  visita_coordinada: "#a78bfa", visita_realizada: "#c084fc",
  oferta_enviada: "#d4960c", negociacion: "#fb923c",
  reserva: "#22d3ee", escritura: "#3abab6", cerrado: "#3abab6", perdido: "var(--gfi-red)",
};

const ESTADO_LABEL_MAP: Record<string, string> = {
  "lead:nuevo": "Nuevo", "lead:evolucionando": "Evolucionando",
  "lead:esperando": "Esperando", "lead:tomar_accion": "Tomar acción",
  "lead:congelado": "Congelado", "lead:cerrado_lead": "Cerrado",
  activo: "Activo", inactivo: "Inactivo", archivado: "Archivado",
};

const ESTADO_BADGE: Record<string, string> = {
  "lead:nuevo": "gfi-badge--gray", "lead:evolucionando": "gfi-badge--green",
  "lead:esperando": "gfi-badge--blue", "lead:tomar_accion": "gfi-badge--orange",
  "lead:congelado": "gfi-badge--gray", "lead:cerrado_lead": "gfi-badge--green",
  activo: "gfi-badge--green", inactivo: "gfi-badge--gray", archivado: "gfi-badge--gray",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ContactoFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // ── Interacción rápida ──
  const [showIntModal, setShowIntModal] = useState(false);
  const [intForm, setIntForm] = useState({ tipo: "llamada", descripcion: "" });
  const [guardandoInt, setGuardandoInt] = useState(false);

  // ── Recordatorio rápido ──
  const [showRecModal, setShowRecModal] = useState(false);
  const [recForm, setRecForm] = useState({ descripcion: "", fecha_recordatorio: "" });
  const [guardandoRec, setGuardandoRec] = useState(false);

  // ── Tab ──
  const [tab, setTab] = useState<"historial" | "negocios" | "tareas">("historial");

  // ── Filtro de interacciones ──
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const cargar = useCallback(async (uid: string) => {
    const [
      { data: c },
      { data: ints },
      { data: negs },
      { data: recs },
      { data: tasks },
    ] = await Promise.all([
      supabase.from("crm_contactos").select("*").eq("id", id).eq("perfil_id", uid).single(),
      supabase.from("crm_interacciones").select("id,tipo,descripcion,created_at").eq("contacto_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("crm_negocios").select("id,titulo,etapa,tipo_operacion,valor_operacion,moneda,created_at").eq("contacto_id", id).eq("perfil_id", uid).order("created_at", { ascending: false }),
      supabase.from("crm_recordatorios").select("id,descripcion,fecha_recordatorio,completado").eq("contacto_id", id).eq("perfil_id", uid).order("fecha_recordatorio", { ascending: true }),
      supabase.from("crm_tareas").select("id,titulo,estado,prioridad,fecha_vencimiento").eq("contacto_id", id).eq("perfil_id", uid).order("created_at", { ascending: false }),
    ]);
    setContacto(c as Contacto);
    setInteracciones((ints ?? []) as Interaccion[]);
    setNegocios((negs ?? []) as Negocio[]);
    setRecordatorios((recs ?? []) as Recordatorio[]);
    setTareas((tasks ?? []) as Tarea[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, [cargar]);

  const agregarInteraccion = async () => {
    if (!intForm.descripcion.trim()) return;
    setGuardandoInt(true);
    await supabase.from("crm_interacciones").insert({
      contacto_id: id, perfil_id: uid,
      tipo: intForm.tipo, descripcion: intForm.descripcion.trim(),
    });
    setGuardandoInt(false);
    setShowIntModal(false);
    setIntForm({ tipo: "llamada", descripcion: "" });
    showToast("Interacción registrada");
    cargar(uid);
  };

  const agregarRecordatorio = async () => {
    if (!recForm.descripcion.trim() || !recForm.fecha_recordatorio) return;
    setGuardandoRec(true);
    await supabase.from("crm_recordatorios").insert({
      contacto_id: id, perfil_id: uid,
      descripcion: recForm.descripcion.trim(),
      fecha_recordatorio: recForm.fecha_recordatorio,
      completado: false,
    });
    setGuardandoRec(false);
    setShowRecModal(false);
    setRecForm({ descripcion: "", fecha_recordatorio: "" });
    showToast("Recordatorio creado");
    cargar(uid);
  };

  const marcarRecordatorio = async (recId: string, completado: boolean) => {
    await supabase.from("crm_recordatorios").update({ completado, estado: completado ? "completado" : "pendiente" }).eq("id", recId);
    setRecordatorios(r => r.map(x => x.id === recId ? { ...x, completado } : x));
  };

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)" }}>
        Cargando contacto...
      </div>
    );
  }

  if (!contacto) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)" }}>
        Contacto no encontrado.{" "}
        <Link href="/crm" style={{ color: "var(--gfi-red)", marginLeft: 6 }}>← Volver</Link>
      </div>
    );
  }

  const nombre = `${contacto.nombre} ${contacto.apellido}`.trim();
  const iniciales = `${contacto.nombre?.[0] ?? ""}${contacto.apellido?.[0] ?? ""}`.toUpperCase();
  const negociosActivos = negocios.filter(n => !["cerrado", "perdido"].includes(n.etapa));
  const recordatoriosPendientes = recordatorios.filter(r => !r.completado);
  const estadoLabel = ESTADO_LABEL_MAP[contacto.estado ?? ""] ?? contacto.estado ?? "";
  const estadoBadge = ESTADO_BADGE[contacto.estado ?? ""] ?? "gfi-badge--gray";

  return (
    <div style={{ color: "var(--gfi-text-primary)", fontFamily: "var(--font-body)", paddingBottom: 60 }}>
      <style>{`
        .cf-nav {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px; padding-bottom: 14px;
          border-bottom: 1px solid var(--gfi-border-subtle);
        }
        .cf-nav-back {
          font-size: 9px; font-family: var(--font-display); font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--gfi-text-muted); text-decoration: none;
          transition: var(--gfi-transition);
        }
        .cf-nav-back:hover { color: var(--gfi-text-secondary); }
        .cf-layout {
          display: grid; grid-template-columns: 268px 1fr; gap: 18px;
        }
        @media(max-width:700px){ .cf-layout { grid-template-columns: 1fr !important; } }

        /* Profile card */
        .cf-profile {
          background: var(--gfi-bg-card);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg);
          padding: 22px 20px; text-align: center; margin-bottom: 14px;
          position: relative; overflow: hidden;
        }
        .cf-profile::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, var(--gfi-red) 0%, rgba(153,0,0,0.1) 60%, transparent 100%);
        }
        .cf-avatar-wrap {
          width: 74px; height: 74px; border-radius: 50%;
          background: rgba(153,0,0,0.10);
          border: 2px solid rgba(153,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
          font-family: var(--font-display); font-size: 26px; font-weight: 900;
          color: var(--gfi-red);
        }
        .cf-nombre {
          font-family: var(--font-display); font-size: 17px; font-weight: 900;
          margin-bottom: 3px; color: var(--gfi-text-primary);
        }
        .cf-tipo {
          font-size: 9px; font-family: var(--font-display); font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--gfi-text-muted); margin-bottom: 10px;
        }

        /* Info card */
        .cf-card {
          background: var(--gfi-bg-card);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg);
          padding: 16px 18px; margin-bottom: 12px;
        }
        .cf-card-title {
          font-size: 9px; font-family: var(--font-display); font-weight: 800;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--gfi-text-muted); margin-bottom: 13px;
          display: flex; align-items: center; gap: 10px;
        }
        .cf-card-title::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, var(--gfi-border) 0%, transparent 100%);
        }
        .cf-data-row { margin-bottom: 10px; }
        .cf-data-label {
          font-size: 9px; font-family: var(--font-display); font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--gfi-text-muted); margin-bottom: 2px;
        }
        .cf-data-val {
          font-size: 13px; color: var(--gfi-text-secondary);
        }
        .cf-data-val-mono {
          font-size: 13px; color: var(--gfi-text-secondary);
          font-family: var(--font-mono);
        }

        /* Quick actions */
        .cf-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .cf-action-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: var(--gfi-radius-md);
          border: 1px solid var(--gfi-border);
          background: var(--gfi-bg-elevated);
          color: var(--gfi-text-secondary);
          font-family: var(--font-display); font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          cursor: pointer; transition: var(--gfi-transition); text-decoration: none;
        }
        .cf-action-btn:hover { background: var(--gfi-bg-hover); color: var(--gfi-text-primary); border-color: var(--gfi-border-bright); }
        .cf-action-btn.red { background: var(--gfi-red-soft); border-color: var(--gfi-red-border); color: var(--gfi-red); }
        .cf-action-btn.red:hover { background: rgba(153,0,0,0.18); }
        .cf-action-btn.wa { background: rgba(37,211,102,0.10); border-color: rgba(37,211,102,0.25); color: #25d366; }
        .cf-action-btn.wa:hover { background: rgba(37,211,102,0.17); }

        /* KPI row */
        .cf-kpi-row { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .cf-kpi {
          flex: 1; min-width: 90px;
          background: var(--gfi-bg-card);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg);
          padding: 13px 14px; text-align: center;
        }
        .cf-kpi-n {
          font-family: var(--font-display); font-size: 26px; font-weight: 900;
          line-height: 1; letter-spacing: -0.02em;
        }
        .cf-kpi-l {
          font-size: 9px; font-family: var(--font-display); font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--gfi-text-muted); margin-top: 5px;
        }

        /* Tabs */
        .cf-tabs {
          display: flex; gap: 0;
          border-bottom: 1px solid var(--gfi-border-subtle); margin-bottom: 16px;
        }
        .cf-tab {
          background: none; border: none; padding: 9px 16px; cursor: pointer;
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          border-bottom: 2px solid transparent;
          color: var(--gfi-text-muted); transition: var(--gfi-transition);
        }
        .cf-tab.on { color: var(--gfi-text-primary); border-bottom-color: var(--gfi-red); }
        .cf-tab:hover:not(.on) { color: var(--gfi-text-secondary); }

        /* Timeline */
        .tl-wrap { position: relative; padding-left: 30px; }
        .tl-wrap::before {
          content: ''; position: absolute; left: 9px; top: 0; bottom: 0;
          width: 1px; background: linear-gradient(180deg, var(--gfi-red-border) 0%, transparent 100%);
        }
        .tl-item { position: relative; margin-bottom: 12px; animation: gfi-slide-in-left 0.2s ease both; }
        .tl-dot {
          position: absolute; left: -23px; top: 5px; width: 20px; height: 20px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 10px; flex-shrink: 0;
          border: 1px solid var(--gfi-border-subtle);
        }
        .tl-card {
          background: var(--gfi-bg-card); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md); padding: 9px 12px;
          transition: border-color 0.12s;
        }
        .tl-card:hover { border-color: var(--gfi-border-bright); }
        .tl-tipo {
          font-size: 9px; font-family: var(--font-display); font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px;
        }
        .tl-desc { font-size: 12px; color: var(--gfi-text-secondary); line-height: 1.5; }
        .tl-fecha {
          font-size: 9px; color: var(--gfi-text-muted); margin-top: 5px;
          font-family: var(--font-mono);
        }

        /* Reminder item */
        .rec-item {
          display: flex; align-items: flex-start; gap: 9px; margin-bottom: 8px;
          padding: 9px 12px; border-radius: var(--gfi-radius-md);
          border: 1px solid var(--gfi-border-subtle);
          background: var(--gfi-bg-elevated);
        }
        .rec-item.vencido {
          background: rgba(153,0,0,0.05); border-color: var(--gfi-red-border);
        }

        /* Negocio item */
        .neg-item {
          background: var(--gfi-bg-card); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg); padding: 13px 16px; margin-bottom: 8px;
          display: flex; align-items: center; gap: 13px;
          transition: var(--gfi-transition);
        }
        .neg-item:hover { border-color: var(--gfi-border-bright); box-shadow: var(--gfi-shadow-sm); }

        /* Tarea item */
        .tarea-item {
          background: var(--gfi-bg-card); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg); padding: 13px 16px; margin-bottom: 8px;
          display: flex; align-items: center; gap: 12px;
        }

        /* Modal */
        .cf-modal-bg {
          position: fixed; inset: 0; background: rgba(0,0,0,0.80);
          z-index: 9000; display: flex; align-items: center; justify-content: center;
          padding: 20px; backdrop-filter: blur(4px);
        }
        .cf-modal {
          background: var(--gfi-bg-card); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-xl); padding: 24px;
          width: 100%; max-width: 430px;
          position: relative; box-shadow: var(--gfi-shadow-lg);
        }
        .cf-modal::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: var(--gfi-red-gradient);
          border-radius: var(--gfi-radius-xl) var(--gfi-radius-xl) 0 0;
        }
        .cf-modal-title {
          font-family: var(--font-display); font-weight: 800; font-size: 15px;
          margin-bottom: 18px; color: var(--gfi-text-primary);
        }
        .cf-field { margin-bottom: 13px; }
        .cf-label {
          font-size: 9px; font-family: var(--font-display); font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--gfi-text-muted); display: block; margin-bottom: 5px;
        }
        .cf-input {
          width: 100%; padding: 9px 12px;
          background: var(--gfi-bg-input); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary);
          font-family: var(--font-body); font-size: 13px; outline: none;
          box-sizing: border-box; transition: var(--gfi-transition);
        }
        .cf-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px rgba(153,0,0,0.10); }
        .cf-modal-footer { display: flex; gap: 10px; margin-top: 6px; }

        /* Toast */
        .cf-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: var(--gfi-green); color: #fff;
          padding: 10px 22px; border-radius: var(--gfi-radius-md);
          font-size: 13px; font-weight: 700; font-family: var(--font-display);
          z-index: 9999; pointer-events: none;
          border: 1px solid rgba(58,186,182,0.4);
          box-shadow: 0 4px 20px rgba(10,61,46,0.5);
          letter-spacing: 0.04em;
        }

        /* Etiquetas */
        .cf-tag {
          padding: 3px 10px; border-radius: 12px;
          background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border);
          font-size: 10px; color: var(--gfi-red);
          font-family: var(--font-display); font-weight: 700;
        }

        /* Empty state */
        .cf-empty {
          text-align: center; padding: 32px 20px;
          color: var(--gfi-text-muted); font-size: 13px;
          border: 1px dashed var(--gfi-border-subtle);
          border-radius: var(--gfi-radius-lg);
        }
      `}</style>

      {/* Toast */}
      {toast && <div className="cf-toast">{toast}</div>}

      {/* Nav */}
      <div className="cf-nav">
        <Link href="/crm" className="cf-nav-back">← CRM</Link>
        <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "var(--font-mono)" }}>
          {fmtFecha(contacto.created_at)}
        </div>
      </div>

      <div className="cf-layout">

        {/* ── Panel izquierdo ── */}
        <div>
          {/* Perfil */}
          <div className="cf-profile">
            <div className="cf-avatar-wrap">{iniciales || "?"}</div>
            <div className="cf-nombre">{nombre}</div>
            {contacto.tipo && <div className="cf-tipo">{contacto.tipo}</div>}
            {contacto.estado && (
              <span className={`gfi-badge ${estadoBadge}`} style={{ display: "inline-flex" }}>
                {estadoLabel}
              </span>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="cf-actions">
            {contacto.telefono && (
              <a href={`https://wa.me/${contacto.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="cf-action-btn wa">
                💬 WhatsApp
              </a>
            )}
            {contacto.email && (
              <a href={`mailto:${contacto.email}`} className="cf-action-btn">
                📧 Email
              </a>
            )}
            {contacto.telefono && (
              <a href={`tel:${contacto.telefono}`} className="cf-action-btn">
                📞 Llamar
              </a>
            )}
            <button className="cf-action-btn red" onClick={() => setShowIntModal(true)}>
              + Interacción
            </button>
            <button className="cf-action-btn" onClick={() => setShowRecModal(true)}>
              🔔 Recordatorio
            </button>
          </div>

          {/* Datos de contacto */}
          <div className="cf-card">
            <div className="cf-card-title">Datos de contacto</div>
            {[
              { label: "Teléfono", val: contacto.telefono, mono: true },
              { label: "Email", val: contacto.email, mono: true },
              { label: "Inmobiliaria", val: contacto.inmobiliaria, mono: false },
              { label: "Matrícula", val: contacto.matricula, mono: true },
              { label: "Origen", val: contacto.origen, mono: false },
            ].filter(x => x.val).map(({ label, val, mono }) => (
              <div key={label} className="cf-data-row">
                <div className="cf-data-label">{label}</div>
                <div className={mono ? "cf-data-val-mono" : "cf-data-val"}>{val}</div>
              </div>
            ))}
          </div>

          {/* Criterios de búsqueda */}
          {(contacto.interes || contacto.zona_interes || contacto.presupuesto_max) && (
            <div className="cf-card">
              <div className="cf-card-title">Criterios de búsqueda</div>
              {contacto.interes && (
                <div className="cf-data-row">
                  <div className="cf-data-label">Interés</div>
                  <div className="cf-data-val">{contacto.interes}</div>
                </div>
              )}
              {contacto.zona_interes && (
                <div className="cf-data-row">
                  <div className="cf-data-label">Zona</div>
                  <div className="cf-data-val">{contacto.zona_interes}</div>
                </div>
              )}
              {(contacto.presupuesto_min || contacto.presupuesto_max) && (
                <div className="cf-data-row">
                  <div className="cf-data-label">Presupuesto</div>
                  <div className="cf-data-val-mono">
                    {contacto.presupuesto_min ? fmtMon(contacto.presupuesto_min, contacto.moneda ?? "USD") : ""}
                    {contacto.presupuesto_min && contacto.presupuesto_max ? " — " : ""}
                    {contacto.presupuesto_max ? fmtMon(contacto.presupuesto_max, contacto.moneda ?? "USD") : ""}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Etiquetas */}
          {(contacto.etiquetas ?? []).length > 0 && (
            <div className="cf-card">
              <div className="cf-card-title">Etiquetas</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(contacto.etiquetas ?? []).map(et => (
                  <span key={et} className="cf-tag">{et}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          {contacto.notas && (
            <div className="cf-card">
              <div className="cf-card-title">Notas</div>
              <div style={{ fontSize: 13, color: "var(--gfi-text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{contacto.notas}</div>
            </div>
          )}

          {/* Lead Score IA */}
          <LeadScoreButton contactoId={contacto.id} />

          {/* Recordatorios pendientes */}
          {recordatoriosPendientes.length > 0 && (
            <div className="cf-card">
              <div className="cf-card-title">Recordatorios ({recordatoriosPendientes.length})</div>
              {recordatoriosPendientes.map(r => {
                const vencido = new Date(r.fecha_recordatorio) < new Date();
                return (
                  <div key={r.id} className={`rec-item${vencido ? " vencido" : ""}`}>
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => marcarRecordatorio(r.id, true)}
                      style={{ marginTop: 2, cursor: "pointer", accentColor: "var(--gfi-green-text)" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "var(--gfi-text-secondary)" }}>{r.descripcion}</div>
                      <div style={{ fontSize: 10, color: vencido ? "var(--gfi-red)" : "var(--gfi-text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                        {vencido ? "⚠ " : ""}
                        {new Date(r.fecha_recordatorio).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Panel derecho ── */}
        <div>
          {/* KPI badges */}
          <div className="cf-kpi-row">
            {[
              { label: "Interacciones", val: interacciones.length, color: "#4ab8d8" },
              { label: "Negocios activos", val: negociosActivos.length, color: "var(--gfi-red)" },
              { label: "Negocios totales", val: negocios.length, color: "var(--gfi-text-secondary)" },
              { label: "Recordatorios", val: recordatoriosPendientes.length, color: "#d4960c" },
            ].map(({ label, val, color }) => (
              <div key={label} className="cf-kpi">
                <div className="cf-kpi-n" style={{ color }}>{val}</div>
                <div className="cf-kpi-l">{label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="cf-tabs">
            {[
              { id: "historial", label: `Historial (${interacciones.length})` },
              { id: "negocios", label: `Negocios (${negocios.length})` },
              { id: "tareas", label: `Tareas (${tareas.length})` },
            ].map(({ id: tid, label }) => (
              <button key={tid} className={`cf-tab${tab === tid ? " on" : ""}`} onClick={() => setTab(tid as typeof tab)}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: Historial ── */}
          {tab === "historial" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div className="gfi-filter-bar" style={{ marginBottom: 0, flex: 1 }}>
                  {[
                    { key: "todos", label: "Todos" },
                    { key: "llamada", label: "Llamadas" },
                    { key: "email", label: "Emails" },
                    { key: "visita", label: "Visitas" },
                    { key: "whatsapp", label: "WhatsApp" },
                    { key: "nota", label: "Notas" },
                    { key: "propuesta", label: "Propuestas" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`gfi-filter-chip${filtroTipo === key ? " active" : ""}`}
                      onClick={() => setFiltroTipo(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button className="gfi-btn gfi-btn--primary" onClick={() => setShowIntModal(true)} style={{ flexShrink: 0 }}>+ Registrar</button>
              </div>

              {interacciones.length === 0 ? (
                <div className="cf-empty">No hay interacciones registradas todavía.</div>
              ) : (() => {
                const filtradas = filtroTipo === "todos"
                  ? interacciones
                  : interacciones.filter(i => i.tipo === filtroTipo);
                if (filtradas.length === 0) {
                  return <div className="cf-empty">No hay interacciones de este tipo.</div>;
                }
                return (
                  <div className="tl-wrap">
                    {filtradas.map((int) => {
                      const cfg = TIPO_INTERACCION[int.tipo] ?? TIPO_INTERACCION.otro;
                      return (
                        <div key={int.id} className="tl-item">
                          <div className="tl-dot" style={{ background: `${cfg.color}18`, borderColor: `${cfg.color}50` }}>
                            {cfg.icon}
                          </div>
                          <div className="tl-card">
                            <div className="tl-tipo" style={{ color: cfg.color }}>{int.tipo}</div>
                            <div className="tl-desc">{int.descripcion}</div>
                            <div className="tl-fecha">{fmtFechaHora(int.created_at)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Tab: Negocios ── */}
          {tab === "negocios" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <Link href="/crm/negocios" className="gfi-btn gfi-btn--secondary">+ Ver negocios</Link>
              </div>
              {negocios.length === 0 ? (
                <div className="cf-empty">No hay negocios vinculados a este contacto.</div>
              ) : (
                negocios.map(n => {
                  const etapaColor = ETAPA_COLOR[n.etapa] ?? "var(--gfi-text-muted)";
                  return (
                    <div key={n.id} className="neg-item">
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: etapaColor, flexShrink: 0, boxShadow: `0 0 6px ${etapaColor}` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, marginBottom: 4, color: "var(--gfi-text-primary)" }}>{n.titulo}</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ color: etapaColor, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>
                            {n.etapa.replace(/_/g, " ")}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>{n.tipo_operacion}</span>
                          {n.valor_operacion && (
                            <span className="gfi-price-usd" style={{ fontSize: 12 }}>
                              {fmtMon(n.valor_operacion, n.moneda)}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "var(--font-mono)" }}>{fmtFecha(n.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Tab: Tareas ── */}
          {tab === "tareas" && (
            <div>
              {tareas.length === 0 ? (
                <div className="cf-empty">No hay tareas vinculadas a este contacto.</div>
              ) : (
                tareas.map(t => {
                  const vencido = t.fecha_vencimiento && new Date(t.fecha_vencimiento) < new Date();
                  const prioColor = t.prioridad === "alta" ? "var(--gfi-red)" : t.prioridad === "media" ? "#d4960c" : "var(--gfi-text-muted)";
                  return (
                    <div key={t.id} className="tarea-item">
                      <div style={{
                        width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                        background: t.estado === "completada" ? "var(--gfi-green-text)" : vencido ? "var(--gfi-red)" : "#d4960c",
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 700,
                          marginBottom: 4, color: t.estado === "completada" ? "var(--gfi-text-muted)" : "var(--gfi-text-primary)",
                          textDecoration: t.estado === "completada" ? "line-through" : "none",
                        }}>
                          {t.titulo}
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--gfi-text-muted)", alignItems: "center", flexWrap: "wrap" }}>
                          <span className={`gfi-badge ${t.estado === "completada" ? "gfi-badge--green" : "gfi-badge--gray"}`}>{t.estado}</span>
                          {t.prioridad && (
                            <span style={{ color: prioColor, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                              {t.prioridad} prioridad
                            </span>
                          )}
                          {t.fecha_vencimiento && (
                            <span style={{ color: vencido ? "var(--gfi-red)" : "var(--gfi-text-muted)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                              {fmtFecha(t.fecha_vencimiento)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Añadir interacción ── */}
      {showIntModal && (
        <div className="cf-modal-bg" onClick={e => { if (e.target === e.currentTarget) setShowIntModal(false); }}>
          <div className="cf-modal">
            <div className="cf-modal-title">Registrar interacción</div>

            <div className="cf-field">
              <label className="cf-label">Tipo</label>
              <select className="cf-input" value={intForm.tipo} onChange={e => setIntForm(f => ({ ...f, tipo: e.target.value }))}>
                {Object.entries(TIPO_INTERACCION).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="cf-field">
              <label className="cf-label">Descripción</label>
              <textarea
                className="cf-input"
                style={{ minHeight: 88, resize: "vertical" }}
                value={intForm.descripcion}
                onChange={e => setIntForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="¿Qué pasó en esta interacción?"
              />
            </div>

            <div className="cf-modal-footer">
              <button className="gfi-btn gfi-btn--secondary" style={{ flex: 1 }} onClick={() => setShowIntModal(false)}>
                Cancelar
              </button>
              <button className="gfi-btn gfi-btn--primary" style={{ flex: 2 }} onClick={agregarInteraccion} disabled={guardandoInt}>
                {guardandoInt ? "Guardando..." : "Guardar interacción"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Recordatorio ── */}
      {showRecModal && (
        <div className="cf-modal-bg" onClick={e => { if (e.target === e.currentTarget) setShowRecModal(false); }}>
          <div className="cf-modal">
            <div className="cf-modal-title">Nuevo recordatorio</div>

            <div className="cf-field">
              <label className="cf-label">¿Qué recordar?</label>
              <input className="cf-input" value={recForm.descripcion} onChange={e => setRecForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Llamar para coordinar visita" />
            </div>

            <div className="cf-field">
              <label className="cf-label">Fecha y hora</label>
              <input type="datetime-local" className="cf-input" style={{ colorScheme: "dark" }} value={recForm.fecha_recordatorio} onChange={e => setRecForm(f => ({ ...f, fecha_recordatorio: e.target.value }))} />
            </div>

            <div className="cf-modal-footer">
              <button className="gfi-btn gfi-btn--secondary" style={{ flex: 1 }} onClick={() => setShowRecModal(false)}>
                Cancelar
              </button>
              <button className="gfi-btn gfi-btn--primary" style={{ flex: 2 }} onClick={agregarRecordatorio} disabled={guardandoRec}>
                {guardandoRec ? "Guardando..." : "Crear recordatorio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
