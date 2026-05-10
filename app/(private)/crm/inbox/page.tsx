"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

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

const ORIGEN_EMOJI: Record<string, string> = {
  manual: "✏️", zonaprop: "🏠", argenprop: "🏡", mercadolibre: "🛒",
  tokko: "🔷", kiteprop: "🪁", whatsapp: "💬", instagram: "📸",
  web: "🌐", otro: "📌",
};

const ESTADO_COLOR: Record<string, string> = {
  nuevo: "#cc0000", contactado: "#eab308", en_seguimiento: "#60a5fa",
  visita_coordinada: "#a78bfa", cerrado: "#22c55e", descartado: "#6b7280",
};

const PRIO_COLOR: Record<string, string> = { alta: "#ef4444", media: "#eab308", baja: "#6b7280" };

const FORM_VACIO = {
  nombre: "", telefono: "", email: "", mensaje: "",
  origen: "manual", estado: "nuevo", prioridad: "media", notas: "", propiedad_id: "",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default function InboxPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [propiedades, setPropiedades] = useState<{ id: string; titulo: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroOrigen, setFiltroOrigen] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await Promise.all([cargarLeads(data.user.id), cargarPropiedades(data.user.id)]);
      setLoading(false);
    };
    init();
  }, []);

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
    await cargarLeads(userId);
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
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (l.nombre ?? "").toLowerCase().includes(q) ||
        (l.telefono ?? "").includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.cartera_propiedades?.titulo ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const nuevos = leads.filter(l => l.estado === "nuevo").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #fff; font-family: Inter,sans-serif; }
        .in-wrap { min-height: 100vh; background: #0a0a0a; display: flex; flex-direction: column; }
        .in-top { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .in-back { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); text-decoration: none; text-transform: uppercase; }
        .in-back:hover { color: #fff; }
        .in-titulo { font-family: Montserrat,sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .in-badge { background: #cc0000; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 10px; font-family: Montserrat,sans-serif; }
        .in-spacer { flex: 1; }
        .in-btn-primary { padding: 8px 16px; border-radius: 6px; background: #cc0000; color: #fff; font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: none; }
        .in-toolbar { display: flex; gap: 8px; padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; }
        .in-search { flex: 1; min-width: 180px; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; }
        .in-sel { padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 12px; outline: none; cursor: pointer; }
        .in-list { flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 8px; }
        .in-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px 16px; }
        .in-card:hover { border-color: rgba(255,255,255,0.14); }
        .in-card-top { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
        .in-card-body { flex: 1; }
        .in-nombre { font-family: Montserrat,sans-serif; font-size: 13px; font-weight: 700; color: #fff; }
        .in-prop { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .in-msg { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 6px; line-height: 1.4; }
        .in-meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.35); }
        .in-badge-estado { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; font-family: Montserrat,sans-serif; text-transform: uppercase; }
        .in-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .in-act-btn { padding: 4px 10px; border-radius: 4px; font-family: Montserrat,sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.55); }
        .in-act-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .in-empty { text-align: center; color: rgba(255,255,255,0.3); font-size: 14px; padding: 60px 20px; }
        .in-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .in-modal { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .in-modal-title { font-family: Montserrat,sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 18px; }
        .in-field { margin-bottom: 12px; }
        .in-label { font-family: Montserrat,sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 4px; display: block; }
        .in-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; font-family: Inter,sans-serif; }
        .in-input:focus { border-color: rgba(204,0,0,0.5); }
        .in-row { display: flex; gap: 10px; }
        .in-row .in-field { flex: 1; }
        .in-modal-actions { display: flex; gap: 10px; margin-top: 18px; }
      `}</style>

      <div className="in-wrap">
        <div className="in-top">
          <Link href="/crm/cartera" className="in-back">← Cartera</Link>
          <div className="in-titulo">Inbox de Consultas</div>
          {nuevos > 0 && <span className="in-badge">{nuevos} nuevo{nuevos !== 1 ? "s" : ""}</span>}
          <div className="in-spacer" />
          <button className="in-btn-primary" onClick={() => { setEditandoId(null); setForm(FORM_VACIO); setMostrarForm(true); }}>+ Nuevo lead</button>
        </div>

        <div className="in-toolbar">
          <input className="in-search" placeholder="Buscar por nombre, tel, email, propiedad..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
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
          {loading ? <div className="in-empty">Cargando...</div>
          : leadsFiltrados.length === 0 ? (
            <div className="in-empty">
              {leads.length === 0
                ? "El inbox está vacío. Las consultas de portales aparecerán aquí cuando estén integradas. También podés agregar leads manualmente."
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
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: prioColor, display: "inline-block", title: `Prioridad ${l.prioridad}` }} />
                    </div>
                    {l.cartera_propiedades && <div className="in-prop">🏠 {l.cartera_propiedades.titulo}</div>}
                    {l.mensaje && <div className="in-msg">"{l.mensaje.slice(0, 120)}{l.mensaje.length > 120 ? "…" : ""}"</div>}
                    <div className="in-meta">
                      {l.telefono && <span>📱 {l.telefono}</span>}
                      {l.email && <span>✉️ {l.email}</span>}
                      <span>{timeAgo(l.created_at)}</span>
                      <span style={{ textTransform: "capitalize" }}>{l.origen}</span>
                    </div>
                    {l.notas && <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>{l.notas}</div>}
                    <div className="in-actions">
                      <button className="in-act-btn" onClick={() => abrirEditar(l)}>✏️ Editar</button>
                      {l.estado === "nuevo" && <button className="in-act-btn" style={{ color: "#eab308", borderColor: "rgba(234,179,8,0.3)" }} onClick={() => cambiarEstado(l.id, "contactado")}>📞 Contactado</button>}
                      {l.estado === "contactado" && <button className="in-act-btn" style={{ color: "#60a5fa", borderColor: "rgba(96,165,250,0.3)" }} onClick={() => cambiarEstado(l.id, "en_seguimiento")}>🔄 En seguimiento</button>}
                      {l.estado === "en_seguimiento" && <button className="in-act-btn" style={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)" }} onClick={() => cambiarEstado(l.id, "visita_coordinada")}>🗓 Visita</button>}
                      {!["cerrado", "descartado"].includes(l.estado) && <button className="in-act-btn" style={{ color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }} onClick={() => cambiarEstado(l.id, "cerrado")}>✓ Cerrado</button>}
                      {l.telefono && <button className="in-act-btn" style={{ color: "#25d366", borderColor: "rgba(37,211,102,0.3)" }} onClick={() => contactarWhatsApp(l)}>📲 WA</button>}
                      <button className="in-act-btn" style={{ color: "rgba(255,255,255,0.2)" }} onClick={() => eliminar(l.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
              <button className="in-btn-primary" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : editandoId ? "Guardar" : "Crear lead"}</button>
              <button style={{ padding: "8px 16px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700 }} onClick={() => setMostrarForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
