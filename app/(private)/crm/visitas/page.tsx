"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Visita {
  id: string;
  numero_orden: string | null;
  perfil_id: string;
  propiedad_id: string | null;
  cliente_nombre: string;
  cliente_dni: string | null;
  cliente_telefono: string | null;
  cliente_email: string | null;
  fecha_visita: string | null;
  estado: string;
  observaciones: string | null;
  created_at: string;
  feedback_puntaje: number | null;
  feedback_interes: string | null;
  feedback_comentario: string | null;
  feedback_at: string | null;
  cartera_propiedades?: { titulo: string; direccion: string | null; tipo: string } | null;
}

const FORM_VACIO = {
  propiedad_id: "",
  cliente_nombre: "",
  cliente_dni: "",
  cliente_telefono: "",
  cliente_email: "",
  fecha_visita: "",
  observaciones: "",
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente: "#eab308",
  realizada: "#22c55e",
  cancelada: "#ef4444",
};

function formatFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function VisitasPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [propiedades, setPropiedades] = useState<{ id: string; titulo: string; direccion: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof FORM_VACIO>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [enviandoCalendar, setEnviandoCalendar] = useState<string|null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await Promise.all([cargarVisitas(data.user.id), cargarPropiedades(data.user.id)]);
      setLoading(false);
    };
    init();
  }, []);

  const cargarVisitas = async (uid: string) => {
    const { data } = await supabase
      .from("cartera_visitas")
      .select("*, cartera_propiedades(titulo, direccion, tipo)")
      .eq("perfil_id", uid)
      .order("created_at", { ascending: false });
    setVisitas((data as unknown as Visita[]) ?? []);
  };

  const cargarPropiedades = async (uid: string) => {
    const { data } = await supabase
      .from("cartera_propiedades")
      .select("id, titulo, direccion")
      .eq("perfil_id", uid)
      .eq("estado", "activa")
      .order("titulo");
    setPropiedades(data ?? []);
  };

  const abrirNueva = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setMostrarForm(true);
  };

  const abrirEditar = (v: Visita) => {
    setEditandoId(v.id);
    setForm({
      propiedad_id: v.propiedad_id ?? "",
      cliente_nombre: v.cliente_nombre,
      cliente_dni: v.cliente_dni ?? "",
      cliente_telefono: v.cliente_telefono ?? "",
      cliente_email: v.cliente_email ?? "",
      fecha_visita: v.fecha_visita ? v.fecha_visita.slice(0, 16) : "",
      observaciones: v.observaciones ?? "",
    });
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!userId || !form.cliente_nombre.trim()) return;
    setGuardando(true);
    const payload = {
      perfil_id: userId,
      propiedad_id: form.propiedad_id || null,
      cliente_nombre: form.cliente_nombre.trim(),
      cliente_dni: form.cliente_dni.trim() || null,
      cliente_telefono: form.cliente_telefono.trim() || null,
      cliente_email: form.cliente_email.trim() || null,
      fecha_visita: form.fecha_visita ? new Date(form.fecha_visita).toISOString() : null,
      observaciones: form.observaciones.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (editandoId) {
      await supabase.from("cartera_visitas").update(payload).eq("id", editandoId);
    } else {
      await supabase.from("cartera_visitas").insert({ ...payload, created_by: userId });
    }
    await cargarVisitas(userId);
    setMostrarForm(false);
    setGuardando(false);
  };

  const cambiarEstado = async (id: string, estado: string) => {
    if (!userId) return;
    await supabase.from("cartera_visitas").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
    setVisitas(v => v.map(x => x.id === id ? { ...x, estado } : x));
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta orden de visita?")) return;
    await supabase.from("cartera_visitas").delete().eq("id", id);
    setVisitas(v => v.filter(x => x.id !== id));
  };

  const compartirFeedback = (v: Visita) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/feedback/visita/${v.id}`;
    const prop = v.cartera_propiedades;
    const texto = encodeURIComponent(
      `Hola ${v.cliente_nombre}, gracias por visitar ${prop?.titulo ?? "la propiedad"}.\n\n` +
      `Te agradecería que nos dejes un breve feedback sobre la visita:\n${link}\n\n¡Muchas gracias! 🙏`
    );
    const tel = v.cliente_telefono?.replace(/\D/g, "") ?? "";
    if (tel) {
      window.open(`https://wa.me/${tel.startsWith("54") ? tel : "54" + tel}?text=${texto}`, "_blank");
    } else {
      navigator.clipboard.writeText(link);
      alert("Link de feedback copiado al portapapeles");
    }
  };

  const enviarACalendar = async (v: Visita) => {
    if (!userId) return;
    setEnviandoCalendar(v.id);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/cartera/sync-calendar", {
      method: "POST",
      headers: {"Content-Type":"application/json", Authorization: `Bearer ${session?.access_token}`},
      body: JSON.stringify({visita_id: v.id, perfil_id: userId}),
    });
    const data = await res.json();
    if (data.pendiente) {
      alert("Google Calendar no conectado. Andá a CRM → Portales para conectar tu cuenta.");
    } else if (data.link) {
      window.open(data.link, "_blank");
    } else if (data.error) {
      alert(`Error: ${data.error}`);
    }
    setEnviandoCalendar(null);
  };

  const enviarWhatsApp = (v: Visita) => {
    if (!v.cliente_telefono) return;
    const prop = v.cartera_propiedades;
    const texto = encodeURIComponent(
      `Orden de Visita N° ${v.numero_orden ?? "—"}\n` +
      `Propiedad: ${prop?.titulo ?? "—"} (${prop?.direccion ?? ""})\n` +
      `Fecha: ${formatFecha(v.fecha_visita)}\n` +
      `Cliente: ${v.cliente_nombre}${v.cliente_dni ? ` · DNI ${v.cliente_dni}` : ""}\n\n` +
      `Por favor confirmá la visita respondiendo este mensaje.`
    );
    const tel = v.cliente_telefono.replace(/\D/g, "");
    window.open(`https://wa.me/${tel.startsWith("54") ? tel : "54" + tel}?text=${texto}`, "_blank");
  };

  const visitasFiltradas = visitas.filter(v => {
    if (filtroEstado && v.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        v.cliente_nombre.toLowerCase().includes(q) ||
        (v.cartera_propiedades?.titulo ?? "").toLowerCase().includes(q) ||
        (v.numero_orden ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendientes = visitas.filter(v => v.estado === "pendiente").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #fff; }
        .vis-wrap { min-height: 100vh; background: #0a0a0a; display: flex; flex-direction: column; }
        .vis-topbar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); background: #0a0a0a; flex-shrink: 0; }
        .vis-back { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); text-decoration: none; text-transform: uppercase; }
        .vis-back:hover { color: #fff; }
        .vis-titulo { font-family: Montserrat,sans-serif; font-size: 14px; font-weight: 800; color: #fff; letter-spacing: 0.05em; }
        .vis-badge { background: #cc0000; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 10px; font-family: Montserrat,sans-serif; }
        .vis-spacer { flex: 1; }
        .vis-btn { padding: 8px 16px; border-radius: 6px; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: none; }
        .vis-btn-primary { background: #cc0000; color: #fff; }
        .vis-btn-primary:hover { background: #aa0000; }
        .vis-toolbar { display: flex; gap: 8px; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; }
        .vis-search { flex: 1; min-width: 200px; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; }
        .vis-select { padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 12px; outline: none; cursor: pointer; }
        .vis-list { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
        .vis-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; display: flex; gap: 16px; align-items: flex-start; }
        .vis-card:hover { border-color: rgba(255,255,255,0.15); }
        .vis-card-num { font-family: Montserrat,sans-serif; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.3); min-width: 80px; }
        .vis-card-body { flex: 1; }
        .vis-card-cliente { font-family: Montserrat,sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 3px; }
        .vis-card-prop { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 6px; }
        .vis-card-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; color: rgba(255,255,255,0.4); }
        .vis-estado-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; font-family: Montserrat,sans-serif; text-transform: uppercase; }
        .vis-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .vis-action-btn { padding: 5px 10px; border-radius: 4px; font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.6); }
        .vis-action-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .vis-empty { text-align: center; color: rgba(255,255,255,0.3); font-size: 14px; padding: 60px 20px; }
        .vis-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .vis-modal { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 28px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
        .vis-modal-title { font-family: Montserrat,sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .vis-field { margin-bottom: 14px; }
        .vis-label { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 5px; display: block; }
        .vis-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; font-family: Inter,sans-serif; }
        .vis-input:focus { border-color: rgba(204,0,0,0.5); }
        .vis-row { display: flex; gap: 10px; }
        .vis-row .vis-field { flex: 1; }
        .vis-modal-actions { display: flex; gap: 10px; margin-top: 20px; }
      `}</style>

      <div className="vis-wrap">
        <div className="vis-topbar">
          <Link href="/crm/cartera" className="vis-back">← Cartera</Link>
          <div className="vis-titulo">Órdenes de Visita</div>
          {pendientes > 0 && <span className="vis-badge">{pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>}
          <div className="vis-spacer" />
          <button className="vis-btn vis-btn-primary" onClick={abrirNueva}>+ Nueva orden</button>
        </div>

        <div className="vis-toolbar">
          <input className="vis-search" placeholder="Buscar por cliente, propiedad u orden..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="vis-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <div className="vis-list">
          {loading ? <div className="vis-empty">Cargando...</div>
          : visitasFiltradas.length === 0 ? (
            <div className="vis-empty">
              {visitas.length === 0 ? "No hay órdenes de visita todavía. Creá la primera." : "No hay resultados."}
            </div>
          ) : visitasFiltradas.map(v => {
            const prop = v.cartera_propiedades;
            const color = ESTADO_COLOR[v.estado] ?? "#666";
            return (
              <div key={v.id} className="vis-card">
                <div className="vis-card-num">
                  <div>{v.numero_orden ?? "—"}</div>
                  <div style={{ marginTop: 6 }}>
                    <span className="vis-estado-badge" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                      {v.estado}
                    </span>
                  </div>
                </div>
                <div className="vis-card-body">
                  <div className="vis-card-cliente">{v.cliente_nombre}</div>
                  <div className="vis-card-prop">
                    {prop ? `🏠 ${prop.titulo}${prop.direccion ? ` · ${prop.direccion}` : ""}` : "Sin propiedad asignada"}
                  </div>
                  <div className="vis-card-meta">
                    {v.fecha_visita && <span>📅 {formatFecha(v.fecha_visita)}</span>}
                    {v.cliente_telefono && <span>📱 {v.cliente_telefono}</span>}
                    {v.cliente_dni && <span>DNI {v.cliente_dni}</span>}
                  </div>
                  {v.observaciones && <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>{v.observaciones}</div>}
                  {v.feedback_at && (
                    <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 6, fontSize: 11 }}>
                      <span style={{ color: "#22c55e", fontWeight: 700 }}>Feedback recibido</span>
                      {v.feedback_puntaje != null && <span style={{ marginLeft: 8 }}>{"⭐".repeat(v.feedback_puntaje)}</span>}
                      {v.feedback_interes && <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.4)" }}>{v.feedback_interes === "si" ? "✅ Interesado" : v.feedback_interes === "tal_vez" ? "🤔 Tal vez" : "❌ No interesado"}</span>}
                      {v.feedback_comentario && <div style={{ color: "rgba(255,255,255,0.35)", marginTop: 4, fontStyle: "italic" }}>"{v.feedback_comentario}"</div>}
                    </div>
                  )}
                  <div className="vis-actions" style={{ marginTop: 10 }}>
                    <button className="vis-action-btn" onClick={() => abrirEditar(v)}>✏️ Editar</button>
                    {v.estado === "pendiente" && <>
                      <button className="vis-action-btn" style={{ color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }} onClick={() => cambiarEstado(v.id, "realizada")}>✓ Realizada</button>
                      <button className="vis-action-btn" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }} onClick={() => cambiarEstado(v.id, "cancelada")}>✗ Cancelar</button>
                    </>}
                    {v.cliente_telefono && <button className="vis-action-btn" style={{ color: "#25d366", borderColor: "rgba(37,211,102,0.3)" }} onClick={() => enviarWhatsApp(v)}>📲 WhatsApp</button>}
                    <button className="vis-action-btn" style={{ color: "#60a5fa", borderColor: "rgba(96,165,250,0.25)" }} onClick={() => compartirFeedback(v)} title="Enviar link de feedback al cliente">⭐ Feedback</button>
                    <button className="vis-action-btn" style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.25)" }} onClick={() => enviarACalendar(v)} disabled={enviandoCalendar === v.id} title="Añadir a Google Calendar">{enviandoCalendar === v.id ? "..." : "📅 Cal"}</button>
                    <button className="vis-action-btn" style={{ color: "rgba(255,255,255,0.25)" }} onClick={() => eliminar(v.id)}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {mostrarForm && (
        <div className="vis-overlay">
          <div className="vis-modal">
            <div className="vis-modal-title">{editandoId ? "Editar orden de visita" : "Nueva orden de visita"}</div>
            <div className="vis-field">
              <label className="vis-label">Propiedad</label>
              <select className="vis-input" value={form.propiedad_id} onChange={e => setForm(f => ({ ...f, propiedad_id: e.target.value }))}>
                <option value="">Sin propiedad asignada</option>
                {propiedades.map(p => <option key={p.id} value={p.id}>{p.titulo}{p.direccion ? ` · ${p.direccion}` : ""}</option>)}
              </select>
            </div>
            <div className="vis-row">
              <div className="vis-field">
                <label className="vis-label">Nombre del cliente *</label>
                <input className="vis-input" value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} placeholder="Juan Pérez" />
              </div>
              <div className="vis-field">
                <label className="vis-label">DNI</label>
                <input className="vis-input" value={form.cliente_dni} onChange={e => setForm(f => ({ ...f, cliente_dni: e.target.value }))} placeholder="30.123.456" />
              </div>
            </div>
            <div className="vis-row">
              <div className="vis-field">
                <label className="vis-label">Teléfono</label>
                <input className="vis-input" value={form.cliente_telefono} onChange={e => setForm(f => ({ ...f, cliente_telefono: e.target.value }))} placeholder="+54 341 ..." />
              </div>
              <div className="vis-field">
                <label className="vis-label">Email</label>
                <input className="vis-input" type="email" value={form.cliente_email} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} />
              </div>
            </div>
            <div className="vis-field">
              <label className="vis-label">Fecha y hora de visita</label>
              <input className="vis-input" type="datetime-local" value={form.fecha_visita} onChange={e => setForm(f => ({ ...f, fecha_visita: e.target.value }))} />
            </div>
            <div className="vis-field">
              <label className="vis-label">Observaciones</label>
              <textarea className="vis-input" rows={3} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Notas sobre la visita..." style={{ resize: "vertical" }} />
            </div>
            <div className="vis-modal-actions">
              <button className="vis-btn vis-btn-primary" onClick={guardar} disabled={guardando || !form.cliente_nombre.trim()}>
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear orden"}
              </button>
              <button className="vis-btn" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }} onClick={() => setMostrarForm(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
