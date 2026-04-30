"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

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

interface Contacto { id: string; nombre: string; apellido: string; }
interface Negocio  { id: string; titulo: string; }

const PRIORIDADES = [
  { value: "baja",    label: "Baja",    color: "#6b7280" },
  { value: "normal",  label: "Normal",  color: "#3b82f6" },
  { value: "alta",    label: "Alta",    color: "#f97316" },
  { value: "urgente", label: "Urgente", color: "#ef4444" },
];

const TIPOS = [
  { value: "general",       label: "General" },
  { value: "llamar",        label: "📞 Llamar" },
  { value: "whatsapp",      label: "💬 WhatsApp" },
  { value: "email",         label: "✉️ Email" },
  { value: "visita",        label: "🏠 Visita" },
  { value: "documentacion", label: "📄 Documentación" },
  { value: "tasacion",      label: "🏷️ Tasación" },
  { value: "publicar",      label: "📢 Publicar" },
  { value: "seguimiento",   label: "🔄 Seguimiento" },
];

const FORM_VACIO = {
  titulo: "", descripcion: "", tipo: "general", prioridad: "normal",
  fecha_vencimiento: "", notas: "", contacto_id: "", negocio_id: "",
};

const fmtFecha = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

const estaVencida = (t: Tarea) =>
  t.estado !== "completada" && t.fecha_vencimiento && t.fecha_vencimiento < new Date().toISOString().split("T")[0];

export default function CrmTareasPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [tareas, setTareas]     = useState<Tarea[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [negocios, setNegocios]   = useState<Negocio[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtroEstado, setFiltroEstado]       = useState<"" | "pendiente" | "en_progreso" | "completada">("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [busqueda, setBusqueda]   = useState("");
  const [modal, setModal]         = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]         = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      cargar(data.user.id);
    });
  }, []);

  const cargar = async (id: string) => {
    setLoading(true);
    const [{ data: t }, { data: c }, { data: n }] = await Promise.all([
      supabase.from("crm_tareas").select("*").eq("perfil_id", id).order("fecha_vencimiento", { ascending: true, nullsFirst: false }),
      supabase.from("crm_contactos").select("id, nombre, apellido").eq("perfil_id", id).order("apellido"),
      supabase.from("crm_negocios").select("id, titulo").eq("perfil_id", id).eq("archivado", false).order("titulo"),
    ]);
    setTareas((t as Tarea[]) ?? []);
    setContactos((c as Contacto[]) ?? []);
    setNegocios((n as Negocio[]) ?? []);
    setLoading(false);
  };

  const tareasFiltradas = useMemo(() => {
    return tareas.filter(t => {
      if (filtroEstado && t.estado !== filtroEstado) return false;
      if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false;
      if (busqueda && !t.titulo.toLowerCase().includes(busqueda.toLowerCase()) &&
          !(t.descripcion ?? "").toLowerCase().includes(busqueda.toLowerCase())) return false;
      return true;
    });
  }, [tareas, filtroEstado, filtroPrioridad, busqueda]);

  const abrirNueva = () => { setForm(FORM_VACIO); setEditId(null); setModal(true); };
  const abrirEditar = (t: Tarea) => {
    setForm({
      titulo: t.titulo, descripcion: t.descripcion ?? "",
      tipo: t.tipo, prioridad: t.prioridad,
      fecha_vencimiento: t.fecha_vencimiento ?? "",
      notas: t.notas ?? "",
      contacto_id: t.contacto_id ?? "",
      negocio_id: t.negocio_id ?? "",
    });
    setEditId(t.id);
    setModal(true);
  };

  const guardar = async () => {
    if (!form.titulo.trim() || !uid) return;
    setGuardando(true);
    const payload = {
      perfil_id: uid,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion || null,
      tipo: form.tipo,
      prioridad: form.prioridad,
      estado: editId ? undefined : "pendiente",
      fecha_vencimiento: form.fecha_vencimiento || null,
      notas: form.notas || null,
      contacto_id: form.contacto_id || null,
      negocio_id: form.negocio_id || null,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from("crm_tareas").update(payload).eq("id", editId);
    } else {
      await supabase.from("crm_tareas").insert(payload);
    }
    setGuardando(false);
    setModal(false);
    showToast(editId ? "Tarea actualizada" : "Tarea creada");
    cargar(uid);
  };

  const toggleEstado = async (t: Tarea) => {
    const nuevoEstado = t.estado === "completada" ? "pendiente" : "completada";
    await supabase.from("crm_tareas").update({
      estado: nuevoEstado,
      fecha_completada: nuevoEstado === "completada" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", t.id);
    setTareas(prev => prev.map(x => x.id === t.id ? { ...x, estado: nuevoEstado } : x));
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    await supabase.from("crm_tareas").delete().eq("id", id);
    setTareas(prev => prev.filter(t => t.id !== id));
    showToast("Tarea eliminada");
  };

  const stats = useMemo(() => ({
    pendientes: tareas.filter(t => t.estado === "pendiente").length,
    enProgreso: tareas.filter(t => t.estado === "en_progreso").length,
    completadas: tareas.filter(t => t.estado === "completada").length,
    vencidas: tareas.filter(t => estaVencida(t)).length,
  }), [tareas]);

  const prioridadInfo = (v: string) => PRIORIDADES.find(p => p.value === v) ?? PRIORIDADES[1];
  const tipoInfo = (v: string) => TIPOS.find(t => t.value === v)?.label ?? v;
  const contactoNombre = (id: string | null) => {
    if (!id) return null;
    const c = contactos.find(x => x.id === id);
    return c ? `${c.nombre} ${c.apellido}` : null;
  };
  const negocioTitulo = (id: string | null) => {
    if (!id) return null;
    return negocios.find(x => x.id === id)?.titulo ?? null;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        .t-wrap { max-width: 860px; display: flex; flex-direction: column; gap: 16px; }
        .t-stat { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px 16px; text-align: center; }
        .t-stat-n { font-family: 'Montserrat',sans-serif; font-size: 24px; font-weight: 800; }
        .t-stat-l { font-size: 10px; color: rgba(255,255,255,0.35); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 3px; }
        .t-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start; transition: border-color 0.15s; }
        .t-card:hover { border-color: rgba(255,255,255,0.14); }
        .t-card.completada { opacity: 0.5; }
        .t-card.vencida { border-color: rgba(239,68,68,0.3); }
        .t-check { width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.25); cursor: pointer; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .t-check.done { background: #22c55e; border-color: #22c55e; }
        .t-input { width: 100%; padding: 9px 11px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; box-sizing: border-box; }
        .t-input:focus { border-color: rgba(200,0,0,0.5); }
        .t-select { width: 100%; padding: 9px 11px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; }
        .t-btn { padding: 9px 16px; border: none; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s; }
        .t-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .t-field { margin-bottom: 12px; }
        .t-badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 700; font-family: 'Montserrat',sans-serif; }
        @media (max-width: 600px) {
          .t-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div className="t-wrap">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#fff" }}>
              Tareas <span style={{ color: "#cc0000" }}>CRM</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
              Gestioná seguimientos, llamadas y pendientes
            </div>
          </div>
          <button className="t-btn" style={{ background: "#cc0000", color: "#fff" }} onClick={abrirNueva}>
            + Nueva tarea
          </button>
        </div>

        {/* Stats */}
        <div className="t-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { n: stats.pendientes, l: "Pendientes", c: "#3b82f6" },
            { n: stats.enProgreso, l: "En progreso", c: "#f97316" },
            { n: stats.completadas, l: "Completadas", c: "#22c55e" },
            { n: stats.vencidas,   l: "Vencidas", c: "#ef4444" },
          ].map(s => (
            <div key={s.l} className="t-stat">
              <div className="t-stat-n" style={{ color: s.c }}>{s.n}</div>
              <div className="t-stat-l">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="t-input" style={{ flex: 1, minWidth: 160 }} placeholder="Buscar tarea..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="t-select" style={{ width: 150 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_progreso">En progreso</option>
            <option value="completada">Completadas</option>
          </select>
          <select className="t-select" style={{ width: 130 }} value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}>
            <option value="">Toda prioridad</option>
            {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40, fontFamily: "Inter,sans-serif" }}>Cargando tareas...</div>
        ) : tareasFiltradas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.25)", fontFamily: "Montserrat,sans-serif" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 700 }}>No hay tareas{busqueda ? " que coincidan" : ""}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tareasFiltradas.map(t => {
              const prio = prioridadInfo(t.prioridad);
              const vencida = estaVencida(t);
              return (
                <div key={t.id} className={`t-card${t.estado === "completada" ? " completada" : ""}${vencida ? " vencida" : ""}`}>
                  {/* Checkbox */}
                  <div className={`t-check${t.estado === "completada" ? " done" : ""}`} onClick={() => toggleEstado(t)} title="Marcar como completada">
                    {t.estado === "completada" && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                  </div>
                  {/* Contenido */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: t.estado === "completada" ? "line-through" : "none" }}>
                        {tipoInfo(t.tipo)} {t.titulo}
                      </span>
                      <span className="t-badge" style={{ background: `${prio.color}20`, color: prio.color, border: `1px solid ${prio.color}40` }}>
                        {prio.label}
                      </span>
                      {vencida && <span className="t-badge" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>Vencida</span>}
                      {t.estado === "en_progreso" && <span className="t-badge" style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>En progreso</span>}
                    </div>
                    {t.descripcion && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4, fontFamily: "Inter,sans-serif" }}>{t.descripcion}</div>}
                    <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                      {t.fecha_vencimiento && (
                        <span style={{ fontSize: 11, color: vencida ? "#ef4444" : "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>
                          📅 {fmtFecha(t.fecha_vencimiento)}
                        </span>
                      )}
                      {contactoNombre(t.contacto_id) && (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>👤 {contactoNombre(t.contacto_id)}</span>
                      )}
                      {negocioTitulo(t.negocio_id) && (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter,sans-serif" }}>🤝 {negocioTitulo(t.negocio_id)}</span>
                      )}
                    </div>
                  </div>
                  {/* Acciones */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {t.estado !== "completada" && t.estado !== "en_progreso" && (
                      <button className="t-btn" style={{ background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", padding: "5px 10px", fontSize: 10 }}
                        onClick={async () => {
                          await supabase.from("crm_tareas").update({ estado: "en_progreso", updated_at: new Date().toISOString() }).eq("id", t.id);
                          setTareas(prev => prev.map(x => x.id === t.id ? { ...x, estado: "en_progreso" } : x));
                        }}>
                        Iniciar
                      </button>
                    )}
                    <button className="t-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", padding: "5px 10px", fontSize: 10 }}
                      onClick={() => abrirEditar(t)}>Editar</button>
                    <button className="t-btn" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", padding: "5px 10px", fontSize: 10 }}
                      onClick={() => eliminar(t.id)}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 20 }}>
              {editId ? "Editar tarea" : "Nueva tarea"}
            </div>

            <div className="t-field">
              <label className="t-label">Tipo</label>
              <select className="t-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="t-field">
              <label className="t-label">Título *</label>
              <input className="t-input" placeholder="¿Qué hay que hacer?" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div className="t-field">
              <label className="t-label">Descripción</label>
              <textarea className="t-input" rows={2} style={{ resize: "vertical" }} placeholder="Detalles opcionales..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="t-field">
                <label className="t-label">Prioridad</label>
                <select className="t-select" value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                  {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="t-field">
                <label className="t-label">Fecha límite</label>
                <input className="t-input" type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="t-field">
                <label className="t-label">Contacto (opcional)</label>
                <select className="t-select" value={form.contacto_id} onChange={e => setForm(f => ({ ...f, contacto_id: e.target.value }))}>
                  <option value="">— Sin contacto —</option>
                  {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                </select>
              </div>
              <div className="t-field">
                <label className="t-label">Negocio (opcional)</label>
                <select className="t-select" value={form.negocio_id} onChange={e => setForm(f => ({ ...f, negocio_id: e.target.value }))}>
                  <option value="">— Sin negocio —</option>
                  {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
                </select>
              </div>
            </div>

            <div className="t-field">
              <label className="t-label">Notas internas</label>
              <textarea className="t-input" rows={2} style={{ resize: "vertical" }} placeholder="Notas privadas..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button className="t-btn" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }} onClick={() => setModal(false)}>Cancelar</button>
              <button className="t-btn" style={{ background: "#cc0000", color: "#fff", opacity: guardando ? 0.6 : 1 }} onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : editId ? "Actualizar" : "Crear tarea"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 20px", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 13, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}
    </>
  );
}
