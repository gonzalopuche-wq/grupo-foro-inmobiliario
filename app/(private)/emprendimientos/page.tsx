"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const ETAPAS_EMP = [
  { value: "en_planos", label: "En planos", color: "#3b82f6" },
  { value: "en_construccion", label: "En construcción", color: "#f97316" },
  { value: "terminado", label: "Terminado", color: "#22c55e" },
  { value: "vendido", label: "Vendido", color: "#6b7280" },
];

const TIPOS_EMP = ["Departamentos", "Casas", "Oficinas", "Locales", "Cocheras", "Loteo"];

interface Emprendimiento {
  id: string;
  nombre: string;
  descripcion: string | null;
  ubicacion: string | null;
  tipo: string | null;
  etapa: string | null;
  precio_desde: number | null;
  moneda: string | null;
  total_unidades: number | null;
  unidades_disponibles: number | null;
  fecha_entrega: string | null;
  imagenes: string[] | null;
  perfil_id: string | null;
  created_at: string;
}

const FORM_VACIO = {
  nombre: "",
  descripcion: "",
  ubicacion: "",
  tipo: "",
  etapa: "",
  precio_desde: "",
  moneda: "USD",
  total_unidades: "",
  unidades_disponibles: "",
  fecha_entrega: "",
};

export default function EmprendimientosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userTipo, setUserTipo] = useState<string | null>(null);
  const [emprendimientos, setEmprendimientos] = useState<Emprendimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEtapa, setFiltroEtapa] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { window.location.href = "/"; return; }
      setUserId(userData.user.id);
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", userData.user.id).single();
      setUserTipo(perfil?.tipo ?? null);
      cargar(userData.user.id);
    };
    init();
  }, []);

  const cargar = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("emprendimientos")
        .select("*")
        .eq("perfil_id", uid)
        .order("created_at", { ascending: false });
      if (dbError) {
        setEmprendimientos([]);
      } else {
        setEmprendimientos(data ?? []);
      }
    } catch {
      setEmprendimientos([]);
    }
    setLoading(false);
  };

  const puedeEditar = userTipo === "admin" || userTipo === "corredor";

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setMostrarModal(true);
  };

  const abrirEditar = (e: Emprendimiento) => {
    setForm({
      nombre: e.nombre,
      descripcion: e.descripcion ?? "",
      ubicacion: e.ubicacion ?? "",
      tipo: e.tipo ?? "",
      etapa: e.etapa ?? "",
      precio_desde: e.precio_desde?.toString() ?? "",
      moneda: e.moneda ?? "USD",
      total_unidades: e.total_unidades?.toString() ?? "",
      unidades_disponibles: e.unidades_disponibles?.toString() ?? "",
      fecha_entrega: e.fecha_entrega ?? "",
    });
    setEditandoId(e.id);
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !userId) return;
    setGuardando(true);
    const payload: any = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      ubicacion: form.ubicacion.trim() || null,
      tipo: form.tipo || null,
      etapa: form.etapa || null,
      precio_desde: form.precio_desde ? parseFloat(form.precio_desde) : null,
      moneda: form.moneda || "USD",
      total_unidades: form.total_unidades ? parseInt(form.total_unidades) : null,
      unidades_disponibles: form.unidades_disponibles ? parseInt(form.unidades_disponibles) : null,
      fecha_entrega: form.fecha_entrega || null,
      perfil_id: userId,
    };
    try {
      if (editandoId) {
        await supabase.from("emprendimientos").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editandoId).eq("perfil_id", userId);
      } else {
        await supabase.from("emprendimientos").insert(payload);
      }
      cerrarModal();
      cargar(userId);
    } catch {
      // handle silently
    }
    setGuardando(false);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este emprendimiento?") || !userId) return;
    setEliminando(id);
    try {
      await supabase.from("emprendimientos").delete().eq("id", id).eq("perfil_id", userId);
      cargar(userId);
    } catch {}
    setEliminando(null);
  };

  const empFiltrados = emprendimientos.filter(e => {
    const porEtapa = filtroEtapa === "todos" || e.etapa === filtroEtapa;
    const porTipo = filtroTipo === "todos" || e.tipo === filtroTipo;
    return porEtapa && porTipo;
  });

  const getEtapaInfo = (val: string | null) => ETAPAS_EMP.find(e => e.value === val) ?? { label: val ?? "—", color: "#6b7280" };

  const formatPrecio = (e: Emprendimiento) => {
    if (!e.precio_desde) return null;
    return `Desde ${e.moneda ?? "USD"} ${e.precio_desde.toLocaleString("es-AR")}`;
  };

  const formatFechaEntrega = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .emp-root { min-height: 100vh; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .emp-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .emp-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .emp-topbar-logo span { color: #cc0000; }
        .emp-topbar-right { display: flex; align-items: center; gap: 12px; }
        .emp-btn-volver { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; text-decoration: none; display: inline-flex; align-items: center; }
        .emp-btn-volver:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .emp-content { max-width: 1100px; margin: 0 auto; padding: 32px; }
        .emp-header { margin-bottom: 28px; }
        .emp-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .emp-header h1 span { color: #cc0000; }
        .emp-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 6px; }
        .emp-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .emp-filter-group { display: flex; gap: 6px; flex-wrap: wrap; }
        .emp-filter-btn { padding: 7px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); transition: all 0.2s; }
        .emp-filter-btn.activo { border-color: rgba(204,0,0,0.5); color: #cc0000; background: rgba(204,0,0,0.08); }
        .emp-filter-btn:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
        .emp-btn-nuevo { margin-left: auto; padding: 9px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .emp-btn-nuevo:hover { background: #aa0000; }
        .emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .emp-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.2s; }
        .emp-card:hover { border-color: rgba(255,255,255,0.14); }
        .emp-card-top { padding: 16px 16px 0; }
        .emp-card-body { padding: 0 16px 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .emp-etapa-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; }
        .emp-card-title { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 2px; line-height: 1.3; }
        .emp-card-location { font-size: 12px; color: rgba(255,255,255,0.35); }
        .emp-card-tipo { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .emp-card-unidades { font-size: 12px; color: rgba(255,255,255,0.5); }
        .emp-card-unidades strong { color: #fff; }
        .emp-card-precio { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: #cc0000; }
        .emp-card-entrega { font-size: 11px; color: rgba(255,255,255,0.3); }
        .emp-card-footer { padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 8px; }
        .emp-btn-edit { padding: 6px 14px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.45); font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .emp-btn-edit:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .emp-btn-del { padding: 6px 14px; background: transparent; border: 1px solid rgba(239,68,68,0.2); border-radius: 3px; color: rgba(239,68,68,0.6); font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .emp-btn-del:hover { border-color: rgba(239,68,68,0.5); color: #ef4444; }
        .emp-empty { padding: 60px 20px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; }
        .emp-loading { padding: 60px 20px; text-align: center; color: rgba(255,255,255,0.3); font-size: 13px; }
        .emp-filter-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.08); margin: 0 4px; }

        /* Modal */
        .emp-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .emp-modal { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; padding: 28px; }
        .emp-modal h2 { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; margin-bottom: 20px; }
        .emp-modal h2 span { color: #cc0000; }
        .emp-modal-section { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin: 18px 0 10px; }
        .emp-modal-field { margin-bottom: 14px; }
        .emp-modal-label { display: block; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; }
        .emp-modal-input, .emp-modal-select, .emp-modal-textarea { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-family: 'Inter', sans-serif; font-size: 13px; outline: none; transition: border-color 0.2s; }
        .emp-modal-input:focus, .emp-modal-select:focus, .emp-modal-textarea:focus { border-color: rgba(204,0,0,0.5); }
        .emp-modal-textarea { min-height: 80px; resize: vertical; }
        .emp-modal-select option { background: #111; }
        .emp-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .emp-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
        .emp-modal-btn-cancel { padding: 9px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .emp-modal-btn-save { padding: 9px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; }
        .emp-modal-btn-save:hover:not(:disabled) { background: #aa0000; }
        .emp-modal-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="emp-root">
        {/* Topbar */}
        <header className="emp-topbar">
          <div className="emp-topbar-logo">GFI<span>®</span></div>
          <div className="emp-topbar-right">
            <a href="/dashboard" className="emp-btn-volver">← Dashboard</a>
          </div>
        </header>

        <main className="emp-content">
          <div className="emp-header">
            <h1>Mis <span>Emprendimientos</span></h1>
            <p>Gestioná tus proyectos inmobiliarios en desarrollo.</p>
          </div>

          {/* Toolbar */}
          <div className="emp-toolbar">
            <div className="emp-filter-group">
              <button
                className={`emp-filter-btn${filtroEtapa === "todos" ? " activo" : ""}`}
                onClick={() => setFiltroEtapa("todos")}
              >Todas las etapas</button>
              {ETAPAS_EMP.map(e => (
                <button
                  key={e.value}
                  className={`emp-filter-btn${filtroEtapa === e.value ? " activo" : ""}`}
                  onClick={() => setFiltroEtapa(e.value)}
                >{e.label}</button>
              ))}
            </div>

            <div className="emp-filter-sep" />

            <div className="emp-filter-group">
              <button
                className={`emp-filter-btn${filtroTipo === "todos" ? " activo" : ""}`}
                onClick={() => setFiltroTipo("todos")}
              >Todos los tipos</button>
              {TIPOS_EMP.map(t => (
                <button
                  key={t}
                  className={`emp-filter-btn${filtroTipo === t ? " activo" : ""}`}
                  onClick={() => setFiltroTipo(t)}
                >{t}</button>
              ))}
            </div>

            {puedeEditar && (
              <button className="emp-btn-nuevo" onClick={abrirNuevo}>+ Nuevo emprendimiento</button>
            )}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="emp-loading">Cargando emprendimientos...</div>
          ) : empFiltrados.length === 0 ? (
            <div className="emp-empty">
              {emprendimientos.length === 0
                ? "No tenés emprendimientos cargados aún."
                : "No hay emprendimientos que coincidan con los filtros."}
            </div>
          ) : (
            <div className="emp-grid">
              {empFiltrados.map(e => {
                const etapaInfo = getEtapaInfo(e.etapa);
                const precio = formatPrecio(e);
                const fechaEntrega = formatFechaEntrega(e.fecha_entrega);
                return (
                  <div key={e.id} className="emp-card">
                    <div className="emp-card-top">
                      <div
                        className="emp-etapa-badge"
                        style={{ background: `${etapaInfo.color}22`, color: etapaInfo.color, border: `1px solid ${etapaInfo.color}44` }}
                      >
                        {etapaInfo.label}
                      </div>
                    </div>
                    <div className="emp-card-body">
                      <div className="emp-card-title">{e.nombre}</div>
                      {e.ubicacion && <div className="emp-card-location">📍 {e.ubicacion}</div>}
                      {e.tipo && <div className="emp-card-tipo">{e.tipo}</div>}
                      {(e.total_unidades !== null || e.unidades_disponibles !== null) && (
                        <div className="emp-card-unidades">
                          <strong>{e.unidades_disponibles ?? "—"}</strong> de {e.total_unidades ?? "—"} unidades disponibles
                        </div>
                      )}
                      {precio && <div className="emp-card-precio">{precio}</div>}
                      {fechaEntrega && <div className="emp-card-entrega">Entrega: {fechaEntrega}</div>}
                    </div>
                    {puedeEditar && (
                      <div className="emp-card-footer">
                        <button className="emp-btn-edit" onClick={() => abrirEditar(e)}>Editar</button>
                        <button
                          className="emp-btn-del"
                          onClick={() => eliminar(e.id)}
                          disabled={eliminando === e.id}
                        >{eliminando === e.id ? "..." : "Eliminar"}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <div className="emp-modal-bg" onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="emp-modal">
            <h2>{editandoId ? "Editar" : "Nuevo"} <span>emprendimiento</span></h2>

            <div className="emp-modal-section">Datos generales</div>

            <div className="emp-modal-field">
              <label className="emp-modal-label">Nombre *</label>
              <input
                className="emp-modal-input"
                placeholder="Ej: Torre Central"
                value={form.nombre}
                onChange={ev => setForm(p => ({ ...p, nombre: ev.target.value }))}
              />
            </div>

            <div className="emp-modal-field">
              <label className="emp-modal-label">Descripción</label>
              <textarea
                className="emp-modal-textarea"
                placeholder="Descripción del proyecto..."
                value={form.descripcion}
                onChange={ev => setForm(p => ({ ...p, descripcion: ev.target.value }))}
              />
            </div>

            <div className="emp-modal-field">
              <label className="emp-modal-label">Ubicación</label>
              <input
                className="emp-modal-input"
                placeholder="Ej: Rosario, Santa Fe"
                value={form.ubicacion}
                onChange={ev => setForm(p => ({ ...p, ubicacion: ev.target.value }))}
              />
            </div>

            <div className="emp-modal-row">
              <div className="emp-modal-field">
                <label className="emp-modal-label">Tipo</label>
                <select
                  className="emp-modal-select"
                  value={form.tipo}
                  onChange={ev => setForm(p => ({ ...p, tipo: ev.target.value }))}
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS_EMP.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="emp-modal-field">
                <label className="emp-modal-label">Etapa</label>
                <select
                  className="emp-modal-select"
                  value={form.etapa}
                  onChange={ev => setForm(p => ({ ...p, etapa: ev.target.value }))}
                >
                  <option value="">Seleccionar...</option>
                  {ETAPAS_EMP.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>

            <div className="emp-modal-section">Precio y unidades</div>

            <div className="emp-modal-row">
              <div className="emp-modal-field">
                <label className="emp-modal-label">Precio desde</label>
                <input
                  className="emp-modal-input"
                  type="number"
                  placeholder="Ej: 80000"
                  value={form.precio_desde}
                  onChange={ev => setForm(p => ({ ...p, precio_desde: ev.target.value }))}
                />
              </div>
              <div className="emp-modal-field">
                <label className="emp-modal-label">Moneda</label>
                <select
                  className="emp-modal-select"
                  value={form.moneda}
                  onChange={ev => setForm(p => ({ ...p, moneda: ev.target.value }))}
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
            </div>

            <div className="emp-modal-row">
              <div className="emp-modal-field">
                <label className="emp-modal-label">Total unidades</label>
                <input
                  className="emp-modal-input"
                  type="number"
                  placeholder="Ej: 120"
                  value={form.total_unidades}
                  onChange={ev => setForm(p => ({ ...p, total_unidades: ev.target.value }))}
                />
              </div>
              <div className="emp-modal-field">
                <label className="emp-modal-label">Unidades disponibles</label>
                <input
                  className="emp-modal-input"
                  type="number"
                  placeholder="Ej: 45"
                  value={form.unidades_disponibles}
                  onChange={ev => setForm(p => ({ ...p, unidades_disponibles: ev.target.value }))}
                />
              </div>
            </div>

            <div className="emp-modal-field">
              <label className="emp-modal-label">Fecha de entrega</label>
              <input
                className="emp-modal-input"
                type="date"
                value={form.fecha_entrega}
                onChange={ev => setForm(p => ({ ...p, fecha_entrega: ev.target.value }))}
              />
            </div>

            <div className="emp-modal-actions">
              <button className="emp-modal-btn-cancel" onClick={cerrarModal}>Cancelar</button>
              <button
                className="emp-modal-btn-save"
                onClick={guardar}
                disabled={guardando || !form.nombre.trim()}
              >{guardando ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
