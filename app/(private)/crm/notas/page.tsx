"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

interface Nota {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  titulo: string | null;
  contenido: string;
  color: string;
  created_at: string;
  updated_at: string;
  crm_contactos?: { nombre: string; apellido: string; } | null;
}

interface Contacto { id: string; nombre: string; apellido: string; }

const COLORES = [
  { id: "default", bg: "rgba(14,14,14,0.9)", border: "rgba(255,255,255,0.1)", label: "Default" },
  { id: "rojo", bg: "rgba(200,0,0,0.08)", border: "rgba(200,0,0,0.25)", label: "Rojo" },
  { id: "azul", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)", label: "Azul" },
  { id: "verde", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", label: "Verde" },
  { id: "amarillo", bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.25)", label: "Amarillo" },
  { id: "violeta", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)", label: "Violeta" },
];

const getColor = (id: string) => COLORES.find(c => c.id === id) ?? COLORES[0];

const formatFechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });

export default function NotasPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ titulo: "", contenido: "", color: "default", contacto_id: "" });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await Promise.all([cargarNotas(data.user.id), cargarContactos(data.user.id)]);
    };
    init();
  }, []);

  const cargarNotas = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_notas")
      .select("*, crm_contactos(nombre, apellido)")
      .eq("perfil_id", uid)
      .order("updated_at", { ascending: false });
    setNotas((data as any[]) ?? []);
    setLoading(false);
  };

  const cargarContactos = async (uid: string) => {
    const { data } = await supabase.from("crm_contactos").select("id, nombre, apellido").eq("perfil_id", uid).order("apellido");
    setContactos((data as Contacto[]) ?? []);
  };

  const abrirFormNuevo = () => {
    setEditandoId(null);
    setForm({ titulo: "", contenido: "", color: "default", contacto_id: "" });
    setMostrarForm(true);
  };

  const abrirFormEditar = (n: Nota) => {
    setEditandoId(n.id);
    setForm({ titulo: n.titulo ?? "", contenido: n.contenido, color: n.color, contacto_id: n.contacto_id ?? "" });
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!userId || !form.contenido.trim()) return;
    setGuardando(true);
    const datos = {
      perfil_id: userId,
      titulo: form.titulo || null,
      contenido: form.contenido,
      color: form.color,
      contacto_id: form.contacto_id || null,
      updated_at: new Date().toISOString(),
    };
    if (editandoId) {
      await supabase.from("crm_notas").update(datos).eq("id", editandoId);
    } else {
      await supabase.from("crm_notas").insert(datos);
    }
    setGuardando(false);
    setMostrarForm(false);
    if (userId) cargarNotas(userId);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    await supabase.from("crm_notas").delete().eq("id", id);
    if (userId) cargarNotas(userId);
  };

  const notasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return notas;
    const q = busqueda.toLowerCase();
    return notas.filter(n =>
      n.contenido?.toLowerCase().includes(q) ||
      n.titulo?.toLowerCase().includes(q) ||
      n.crm_contactos?.nombre?.toLowerCase().includes(q) ||
      n.crm_contactos?.apellido?.toLowerCase().includes(q)
    );
  }, [notas, busqueda]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .not-wrap { display: flex; flex-direction: column; gap: 16px; }
        .not-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .not-titulo { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .not-titulo span { color: #cc0000; }
        .not-acciones { display: flex; gap: 8px; align-items: center; }
        .not-search-wrap { position: relative; }
        .not-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: rgba(255,255,255,0.25); }
        .not-search { padding: 7px 10px 7px 30px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter',sans-serif; width: 200px; }
        .not-search:focus { border-color: rgba(200,0,0,0.4); }
        .not-search::placeholder { color: rgba(255,255,255,0.2); }
        .not-btn-nuevo { padding: 8px 16px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .not-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .not-card { border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; gap: 8px; }
        .not-card:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .not-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; }
        .not-card-contenido { font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.5; flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; }
        .not-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
        .not-card-fecha { font-size: 9px; color: rgba(255,255,255,0.25); font-family: 'Montserrat',sans-serif; }
        .not-card-contacto { font-size: 9px; color: rgba(255,255,255,0.35); }
        .not-card-del { background: none; border: none; color: rgba(255,255,255,0.2); font-size: 14px; cursor: pointer; padding: 0; }
        .not-card-del:hover { color: #ff4444; }
        .not-empty { padding: 64px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }
        /* Modal */
        .not-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: flex-start; justify-content: center; z-index: 300; padding: 24px; overflow-y: auto; }
        .not-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 8px; padding: 28px 32px; width: 100%; max-width: 520px; margin: auto; position: relative; }
        .not-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .not-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 18px; }
        .not-modal-titulo span { color: #cc0000; }
        .not-field { margin-bottom: 11px; }
        .not-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .not-input { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; }
        .not-input:focus { border-color: rgba(200,0,0,0.4); }
        .not-input::placeholder { color: rgba(255,255,255,0.2); }
        .not-select { width: 100%; padding: 8px 11px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .not-colores { display: flex; gap: 8px; flex-wrap: wrap; }
        .not-color-btn { width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
        .not-color-btn.activo { border-color: #fff; transform: scale(1.2); }
        .not-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
        .not-btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .not-btn-save { padding: 8px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .not-btn-save:disabled { opacity: 0.5; }
        .not-spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="not-wrap">
        <div className="not-header">
          <div className="not-titulo">Notas <span>GFI®</span></div>
          <div className="not-acciones">
            <div className="not-search-wrap">
              <span className="not-search-ico">🔍</span>
              <input className="not-search" placeholder="Buscar notas..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <button className="not-btn-nuevo" onClick={abrirFormNuevo}>+ Nueva nota</button>
          </div>
        </div>

        {loading ? (
          <div className="not-empty">Cargando...</div>
        ) : notasFiltradas.length === 0 ? (
          <div className="not-empty">
            {busqueda ? `Sin notas para "${busqueda}"` : "No hay notas todavía. Creá la primera."}
          </div>
        ) : (
          <div className="not-grid">
            {notasFiltradas.map(n => {
              const c = getColor(n.color);
              return (
                <div key={n.id} className="not-card"
                  style={{background: c.bg, border: `1px solid ${c.border}`}}
                  onClick={() => abrirFormEditar(n)}>
                  {n.titulo && <div className="not-card-titulo">{n.titulo}</div>}
                  <div className="not-card-contenido">{n.contenido}</div>
                  <div className="not-card-footer">
                    <div>
                      <div className="not-card-fecha">{formatFechaHora(n.updated_at)}</div>
                      {n.crm_contactos && (
                        <div className="not-card-contacto">👤 {n.crm_contactos.apellido ?? ""} {n.crm_contactos.nombre}</div>
                      )}
                    </div>
                    <button className="not-card-del" onClick={e => { e.stopPropagation(); eliminar(n.id); }}>✗</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mostrarForm && (
        <div className="not-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="not-modal">
            <div className="not-modal-titulo">{editandoId ? "Editar" : "Nueva"} <span>nota</span></div>

            <div className="not-field">
              <label className="not-label">Título (opcional)</label>
              <input className="not-input" value={form.titulo} onChange={e => setForm(p => ({...p, titulo: e.target.value}))} placeholder="Título de la nota..." />
            </div>

            <div className="not-field">
              <label className="not-label">Contenido *</label>
              <textarea className="not-input" value={form.contenido} onChange={e => setForm(p => ({...p, contenido: e.target.value}))} rows={6} placeholder="Escribí tu nota acá..." style={{resize:"vertical"}} />
            </div>

            <div className="not-field">
              <label className="not-label">Color</label>
              <div className="not-colores">
                {COLORES.map(c => (
                  <div key={c.id} className={`not-color-btn${form.color === c.id ? " activo" : ""}`}
                    style={{background: c.bg === "rgba(14,14,14,0.9)" ? "rgba(255,255,255,0.1)" : c.bg.replace("0.08","0.4"), borderColor: c.border.replace("0.25","0.6")}}
                    onClick={() => setForm(p => ({...p, color: c.id}))}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="not-field">
              <label className="not-label">Contacto relacionado</label>
              <select className="not-select" value={form.contacto_id} onChange={e => setForm(p => ({...p, contacto_id: e.target.value}))}>
                <option value="">Sin contacto</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}
              </select>
            </div>

            <div className="not-modal-actions">
              <button className="not-btn-cancel" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="not-btn-save" onClick={guardar} disabled={guardando || !form.contenido.trim()}>
                {guardando ? <><span className="not-spinner"/>Guardando...</> : editandoId ? "Guardar" : "Crear nota"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
