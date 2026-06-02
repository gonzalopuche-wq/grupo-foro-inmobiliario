"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

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

const TIPO_INTERACCION: Record<string, { icon: string; color: string }> = {
  llamada:   { icon: "📞", color: "#22c55e" },
  email:     { icon: "📧", color: "#60a5fa" },
  visita:    { icon: "🏠", color: "#f97316" },
  whatsapp:  { icon: "💬", color: "#25d366" },
  "reunión": { icon: "🤝", color: "#a855f7" },
  reunion:   { icon: "🤝", color: "#a855f7" },
  nota:      { icon: "📝", color: "rgba(255,255,255,0.5)" },
  propuesta: { icon: "📋", color: "#fbbf24" },
  otro:      { icon: "⚡", color: "#cc0000" },
};

const ETAPA_COLOR: Record<string, string> = {
  prospecto: "#6b7280", contactado: "#3b82f6", visita_coordinada: "#8b5cf6",
  visita_realizada: "#a78bfa", oferta_enviada: "#f59e0b", negociacion: "#f97316",
  reserva: "#06b6d4", escritura: "#10b981", cerrado: "#22c55e", perdido: "#ef4444",
};

const ESTADO_COLOR: Record<string, string> = {
  activo: "#22c55e", inactivo: "#6b7280", archivado: "#374151",
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

  // ── Styles ────────────────────────────────────────────────────────────────

  const cardSt: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "18px 20px",
    marginBottom: 14,
  };

  const inputSt: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6, color: "#fff",
    fontFamily: "Inter,sans-serif", fontSize: 13,
    padding: "8px 10px", width: "100%", boxSizing: "border-box", outline: "none",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
        Cargando contacto...
      </div>
    );
  }

  if (!contacto) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif" }}>
        Contacto no encontrado.{" "}
        <Link href="/crm" style={{ color: "#cc0000", marginLeft: 6 }}>← Volver</Link>
      </div>
    );
  }

  const nombre = `${contacto.nombre} ${contacto.apellido}`.trim();
  const iniciales = `${contacto.nombre?.[0] ?? ""}${contacto.apellido?.[0] ?? ""}`.toUpperCase();
  const negociosActivos = negocios.filter(n => !["cerrado", "perdido"].includes(n.etapa));
  const recordatoriosPendientes = recordatorios.filter(r => !r.completado);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@300;400;500;600&display=swap');
        input:focus,select:focus,textarea:focus { border-color: rgba(204,0,0,0.5) !important; outline: none; box-shadow: 0 0 0 2px rgba(204,0,0,0.1); }
        .tab-btn { background: none; border: none; padding: 8px 16px; cursor: pointer; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 2px solid transparent; color: rgba(255,255,255,0.35); transition: all 0.15s; }
        .tab-btn.on { color: #fff; border-bottom-color: #cc0000; }
        .tab-btn:hover:not(.on) { color: rgba(255,255,255,0.6); }
        .action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; text-decoration: none; }
        .action-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .action-btn.primary { background: rgba(204,0,0,0.15); border-color: rgba(204,0,0,0.4); color: #cc0000; }
        .action-btn.wa { background: rgba(37,211,102,0.12); border-color: rgba(37,211,102,0.3); color: #25d366; }
        .int-row:hover { background: rgba(255,255,255,0.03); }
        @media (max-width: 700px) { .two-col { grid-template-columns: 1fr !important; } }
        .tl-wrap { position: relative; padding-left: 32px; }
        .tl-wrap::before { content: ''; position: absolute; left: 10px; top: 0; bottom: 0; width: 2px; background: rgba(200,0,0,0.15); }
        .tl-item { position: relative; margin-bottom: 14px; }
        .tl-dot { position: absolute; left: -26px; top: 4px; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; border: 2px solid rgba(0,0,0,0.3); }
        .tl-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px; transition: border-color 0.15s; }
        .tl-card:hover { border-color: rgba(255,255,255,0.15); }
        .tl-tipo { font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 3px; }
        .tl-desc { font-size: 12px; color: rgba(255,255,255,0.75); font-family: 'Inter',sans-serif; line-height: 1.4; }
        .tl-fecha { font-size: 9px; color: rgba(255,255,255,0.3); margin-top: 4px; font-family: 'Inter',sans-serif; }
        .filtro-btn { padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .filtro-btn:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); }
        .filtro-btn.on { background: rgba(204,0,0,0.15); border-color: rgba(204,0,0,0.4); color: #cc0000; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", zIndex: 9999, pointerEvents: "none" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", maxWidth: 940, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/crm" style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
          ← CRM
        </Link>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat',sans-serif" }}>
          Creado {fmtFecha(contacto.created_at)}
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: "22px auto", padding: "0 16px", display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }} className="two-col">

        {/* ── Panel izquierdo: datos del contacto ── */}
        <div>
          {/* Avatar + nombre */}
          <div style={{ ...cardSt, textAlign: "center", marginBottom: 14 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(204,0,0,0.12)", border: "2px solid rgba(204,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color: "#cc0000" }}>
              {iniciales || "👤"}
            </div>
            <div style={{ fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, marginBottom: 4 }}>{nombre}</div>
            {contacto.tipo && (
              <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
                {contacto.tipo}
              </div>
            )}
            {contacto.estado && (
              <div style={{ display: "inline-block", marginTop: 8, padding: "2px 10px", borderRadius: 20, background: `${ESTADO_COLOR[contacto.estado] ?? "#6b7280"}18`, border: `1px solid ${ESTADO_COLOR[contacto.estado] ?? "#6b7280"}40`, fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: ESTADO_COLOR[contacto.estado] ?? "#6b7280" }}>
                {contacto.estado}
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {contacto.telefono && (
              <a href={`https://wa.me/${contacto.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="action-btn wa">
                💬 WhatsApp
              </a>
            )}
            {contacto.email && (
              <a href={`mailto:${contacto.email}`} className="action-btn">
                📧 Email
              </a>
            )}
            {contacto.telefono && (
              <a href={`tel:${contacto.telefono}`} className="action-btn">
                📞 Llamar
              </a>
            )}
            <button className="action-btn primary" onClick={() => setShowIntModal(true)}>
              + Interacción
            </button>
            <button className="action-btn" onClick={() => setShowRecModal(true)}>
              🔔 Recordatorio
            </button>
          </div>

          {/* Datos de contacto */}
          <div style={cardSt}>
            <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>
              Datos de contacto
            </div>
            {[
              { label: "Teléfono", val: contacto.telefono },
              { label: "Email", val: contacto.email },
              { label: "Inmobiliaria", val: contacto.inmobiliaria },
              { label: "Matrícula", val: contacto.matricula },
              { label: "Origen", val: contacto.origen },
            ].filter(x => x.val).map(({ label, val }) => (
              <div key={label} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Criterios de búsqueda */}
          {(contacto.interes || contacto.zona_interes || contacto.presupuesto_max) && (
            <div style={cardSt}>
              <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>
                Criterios de búsqueda
              </div>
              {contacto.interes && (
                <div style={{ marginBottom: 9 }}>
                  <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>Interés</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{contacto.interes}</div>
                </div>
              )}
              {contacto.zona_interes && (
                <div style={{ marginBottom: 9 }}>
                  <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>Zona</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{contacto.zona_interes}</div>
                </div>
              )}
              {(contacto.presupuesto_min || contacto.presupuesto_max) && (
                <div>
                  <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>Presupuesto</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
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
            <div style={cardSt}>
              <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 10 }}>
                Etiquetas
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(contacto.etiquetas ?? []).map(et => (
                  <span key={et} style={{ padding: "3px 10px", borderRadius: 12, background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.25)", fontSize: 10, color: "#cc0000", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>
                    {et}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          {contacto.notas && (
            <div style={cardSt}>
              <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 8 }}>
                Notas
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{contacto.notas}</div>
            </div>
          )}

          {/* Recordatorios pendientes */}
          {recordatoriosPendientes.length > 0 && (
            <div style={cardSt}>
              <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 10 }}>
                🔔 Recordatorios ({recordatoriosPendientes.length})
              </div>
              {recordatoriosPendientes.map(r => {
                const vencido = new Date(r.fecha_recordatorio) < new Date();
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, padding: "8px 10px", background: vencido ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${vencido ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                    <input type="checkbox" checked={false} onChange={() => marcarRecordatorio(r.id, true)} style={{ marginTop: 2, cursor: "pointer", accentColor: "#22c55e" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{r.descripcion}</div>
                      <div style={{ fontSize: 10, color: vencido ? "#ef4444" : "rgba(255,255,255,0.3)", marginTop: 2 }}>
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

        {/* ── Panel derecho: tabs ── */}
        <div>
          {/* KPI badges */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { label: "Interacciones", val: interacciones.length, color: "#60a5fa" },
              { label: "Negocios activos", val: negociosActivos.length, color: "#cc0000" },
              { label: "Negocios totales", val: negocios.length, color: "rgba(255,255,255,0.5)" },
              { label: "Recordatorios", val: recordatoriosPendientes.length, color: "#f59e0b" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ ...cardSt, marginBottom: 0, flex: 1, minWidth: 100, textAlign: "center" }}>
                <div style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 24, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 14, display: "flex", gap: 0 }}>
            {[
              { id: "historial", label: `Historial (${interacciones.length})` },
              { id: "negocios", label: `Negocios (${negocios.length})` },
              { id: "tareas", label: `Tareas (${tareas.length})` },
            ].map(({ id: tid, label }) => (
              <button key={tid} className={`tab-btn${tab === tid ? " on" : ""}`} onClick={() => setTab(tid as typeof tab)}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: Historial ── */}
          {tab === "historial" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                {/* Filtros por tipo */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {[
                    { key: "todos", label: "Todos" },
                    { key: "llamada", label: "📞 Llamadas" },
                    { key: "email", label: "📧 Emails" },
                    { key: "visita", label: "🏠 Visitas" },
                    { key: "whatsapp", label: "💬 WhatsApp" },
                    { key: "nota", label: "📝 Notas" },
                    { key: "propuesta", label: "📋 Propuestas" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`filtro-btn${filtroTipo === key ? " on" : ""}`}
                      onClick={() => setFiltroTipo(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button className="action-btn primary" onClick={() => setShowIntModal(true)}>+ Registrar</button>
              </div>

              {interacciones.length === 0 ? (
                <div style={{ ...cardSt, textAlign: "center", padding: "32px 20px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                  No hay interacciones registradas todavía.
                </div>
              ) : (() => {
                const filtradas = filtroTipo === "todos"
                  ? interacciones
                  : interacciones.filter(i => i.tipo === filtroTipo);
                if (filtradas.length === 0) {
                  return (
                    <div style={{ ...cardSt, textAlign: "center", padding: "24px 20px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                      No hay interacciones de este tipo.
                    </div>
                  );
                }
                return (
                  <div className="tl-wrap">
                    {filtradas.map((int) => {
                      const cfg = TIPO_INTERACCION[int.tipo] ?? TIPO_INTERACCION.otro;
                      return (
                        <div key={int.id} className="tl-item">
                          <div
                            className="tl-dot"
                            style={{ background: `${cfg.color}22`, borderColor: `${cfg.color}60` }}
                          >
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
                <Link href="/crm/negocios" className="action-btn">+ Ver negocios</Link>
              </div>
              {negocios.length === 0 ? (
                <div style={{ ...cardSt, textAlign: "center", padding: "32px 20px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                  No hay negocios vinculados a este contacto.
                </div>
              ) : (
                negocios.map(n => {
                  const etapaColor = ETAPA_COLOR[n.etapa] ?? "#6b7280";
                  return (
                    <div key={n.id} style={{ ...cardSt, display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: etapaColor, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{n.titulo}</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                          <span style={{ color: etapaColor, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9 }}>{n.etapa.replace(/_/g, " ")}</span>
                          <span>{n.tipo_operacion}</span>
                          {n.valor_operacion && <span style={{ color: "#f59e0b" }}>{fmtMon(n.valor_operacion, n.moneda)}</span>}
                          <span>{fmtFecha(n.created_at)}</span>
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
                <div style={{ ...cardSt, textAlign: "center", padding: "32px 20px", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                  No hay tareas vinculadas a este contacto.
                </div>
              ) : (
                tareas.map(t => {
                  const vencido = t.fecha_vencimiento && new Date(t.fecha_vencimiento) < new Date();
                  return (
                    <div key={t.id} style={{ ...cardSt, display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: t.estado === "completada" ? "#22c55e" : vencido ? "#ef4444" : "#f59e0b", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, marginBottom: 3, color: t.estado === "completada" ? "rgba(255,255,255,0.35)" : "#fff", textDecoration: t.estado === "completada" ? "line-through" : "none" }}>
                          {t.titulo}
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                          <span>{t.estado}</span>
                          {t.prioridad && <span style={{ color: t.prioridad === "alta" ? "#ef4444" : t.prioridad === "media" ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>Prioridad {t.prioridad}</span>}
                          {t.fecha_vencimiento && <span style={{ color: vencido ? "#ef4444" : "rgba(255,255,255,0.3)" }}>📅 {fmtFecha(t.fecha_vencimiento)}</span>}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "24px", width: "100%", maxWidth: 420 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Registrar interacción</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 5 }}>Tipo</label>
              <select style={{ ...inputSt, background: "#1a1a1a" }} value={intForm.tipo} onChange={e => setIntForm(f => ({ ...f, tipo: e.target.value }))}>
                {Object.keys(TIPO_INTERACCION).map(k => (
                  <option key={k} value={k}>{TIPO_INTERACCION[k].icon} {k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 5 }}>Descripción</label>
              <textarea
                style={{ ...inputSt, minHeight: 90, resize: "vertical" }}
                value={intForm.descripcion}
                onChange={e => setIntForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="¿Qué pasó en esta interacción?"
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowIntModal(false)} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700 }}>
                Cancelar
              </button>
              <button onClick={agregarInteraccion} disabled={guardandoInt} style={{ flex: 2, padding: "10px", background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", opacity: guardandoInt ? 0.6 : 1 }}>
                {guardandoInt ? "Guardando..." : "Guardar interacción"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Recordatorio ── */}
      {showRecModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "24px", width: "100%", maxWidth: 380 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Nuevo recordatorio</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 5 }}>¿Qué recordar?</label>
              <input style={inputSt} value={recForm.descripcion} onChange={e => setRecForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Llamar para coordinar visita" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 5 }}>Fecha y hora</label>
              <input type="datetime-local" style={{ ...inputSt, colorScheme: "dark" }} value={recForm.fecha_recordatorio} onChange={e => setRecForm(f => ({ ...f, fecha_recordatorio: e.target.value }))} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowRecModal(false)} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700 }}>
                Cancelar
              </button>
              <button onClick={agregarRecordatorio} disabled={guardandoRec} style={{ flex: 2, padding: "10px", background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", opacity: guardandoRec ? 0.6 : 1 }}>
                {guardandoRec ? "Guardando..." : "Crear recordatorio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
