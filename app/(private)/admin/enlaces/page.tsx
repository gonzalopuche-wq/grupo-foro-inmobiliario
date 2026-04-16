"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const CATEGORIAS = [
  { id: "padron", label: "Padrón y Colegios" },
  { id: "impuestos", label: "Impuestos Provinciales" },
  { id: "catastro", label: "Catastro y Registro" },
  { id: "tasas", label: "Tasas Municipales" },
  { id: "servicios", label: "Servicios Públicos" },
  { id: "tramites", label: "Trámites y Portales" },
];

const LOCALIDADES = ["Rosario", "Funes", "Roldán", "Villa Constitución", "Santa Fe", "Nacional"];

interface Enlace {
  id: string;
  nombre: string;
  descripcion: string | null;
  url: string;
  categoria: string;
  localidad: string | null;
  destacado: boolean;
  orden: number;
  activo: boolean;
}

interface Sugerencia {
  id: string;
  nombre: string;
  url: string;
  descripcion: string | null;
  categoria: string | null;
  created_at: string;
  perfil_id: string;
  perfiles?: { nombre: string; apellido: string; matricula: string } | null;
}

const EMPTY_ENLACE: Omit<Enlace, "id"> = {
  nombre: "",
  descripcion: "",
  url: "",
  categoria: "tramites",
  localidad: null,
  destacado: false,
  orden: 0,
  activo: true,
};

export default function AdminEnlacesPage() {
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"enlaces" | "sugerencias">("enlaces");
  const [editando, setEditando] = useState<Enlace | null>(null);
  const [nuevoModal, setNuevoModal] = useState(false);
  const [formNuevo, setFormNuevo] = useState<Omit<Enlace, "id">>(EMPTY_ENLACE);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    setLoading(true);
    const [{ data: enl }, { data: sug }] = await Promise.all([
      supabase.from("enlaces_utiles").select("*").order("orden"),
      supabase.from("enlaces_sugerencias")
        .select("*, perfiles(nombre, apellido, matricula)")
        .order("created_at", { ascending: false }),
    ]);
    setEnlaces((enl as Enlace[]) ?? []);
    setSugerencias((sug as Sugerencia[]) ?? []);
    setLoading(false);
  };

  // ── GUARDAR EDICIÓN ──
  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    const { error } = await supabase
      .from("enlaces_utiles")
      .update({
        nombre: editando.nombre,
        descripcion: editando.descripcion || null,
        url: editando.url,
        categoria: editando.categoria,
        localidad: editando.localidad || null,
        destacado: editando.destacado,
        orden: editando.orden,
        activo: editando.activo,
      })
      .eq("id", editando.id);
    setGuardando(false);
    if (error) { mostrarToast("Error al guardar", "err"); return; }
    mostrarToast("Enlace actualizado");
    setEditando(null);
    cargarTodo();
  };

  // ── CREAR NUEVO ──
  const crearEnlace = async () => {
    if (!formNuevo.nombre || !formNuevo.url) return;
    setGuardando(true);
    const { error } = await supabase.from("enlaces_utiles").insert({
      ...formNuevo,
      descripcion: formNuevo.descripcion || null,
      localidad: formNuevo.localidad || null,
    });
    setGuardando(false);
    if (error) { mostrarToast("Error al crear", "err"); return; }
    mostrarToast("Enlace creado");
    setNuevoModal(false);
    setFormNuevo(EMPTY_ENLACE);
    cargarTodo();
  };

  // ── ELIMINAR ──
  const eliminarEnlace = async (id: string) => {
    const { error } = await supabase.from("enlaces_utiles").delete().eq("id", id);
    if (error) { mostrarToast("Error al eliminar", "err"); return; }
    mostrarToast("Enlace eliminado");
    setConfirmarEliminar(null);
    cargarTodo();
  };

  // ── TOGGLE ACTIVO ──
  const toggleActivo = async (enlace: Enlace) => {
    await supabase.from("enlaces_utiles").update({ activo: !enlace.activo }).eq("id", enlace.id);
    cargarTodo();
  };

  // ── APROBAR SUGERENCIA ──
  const aprobarSugerencia = async (sug: Sugerencia) => {
    setGuardando(true);
    const maxOrden = enlaces.length > 0 ? Math.max(...enlaces.map(e => e.orden)) + 1 : 1;
    const { error } = await supabase.from("enlaces_utiles").insert({
      nombre: sug.nombre,
      url: sug.url,
      descripcion: sug.descripcion || null,
      categoria: sug.categoria || "tramites",
      localidad: null,
      destacado: false,
      orden: maxOrden,
      activo: true,
    });
    if (!error) {
      await supabase.from("enlaces_sugerencias").delete().eq("id", sug.id);
      mostrarToast("Sugerencia aprobada y publicada");
    } else {
      mostrarToast("Error al aprobar", "err");
    }
    setGuardando(false);
    cargarTodo();
  };

  // ── RECHAZAR SUGERENCIA ──
  const rechazarSugerencia = async (id: string) => {
    await supabase.from("enlaces_sugerencias").delete().eq("id", id);
    mostrarToast("Sugerencia rechazada");
    cargarTodo();
  };

  const enlacesFiltrados = enlaces.filter(e => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return e.nombre.toLowerCase().includes(q) || e.url.toLowerCase().includes(q);
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');

        .adm-enl-wrap { display: flex; flex-direction: column; gap: 20px; }

        /* Header */
        .adm-enl-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .adm-enl-titulo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .adm-enl-titulo span { color: #cc0000; }
        .adm-enl-header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

        /* Tabs */
        .adm-tabs { display: flex; gap: 0; border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; overflow: hidden; }
        .adm-tab { padding: 8px 18px; background: transparent; border: none; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; border-right: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 7px; }
        .adm-tab:last-child { border-right: none; }
        .adm-tab.active { background: rgba(200,0,0,0.15); color: #cc0000; }
        .adm-tab:hover:not(.active) { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); }
        .adm-tab-badge { background: #cc0000; color: #fff; font-size: 9px; padding: 1px 6px; border-radius: 10px; font-family: 'Montserrat', sans-serif; }

        /* Toolbar */
        .adm-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .adm-search { position: relative; flex: 1; min-width: 200px; }
        .adm-search input { width: 100%; padding: 8px 12px 8px 32px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter', sans-serif; }
        .adm-search input:focus { border-color: rgba(200,0,0,0.4); }
        .adm-search input::placeholder { color: rgba(255,255,255,0.2); }
        .adm-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: rgba(255,255,255,0.3); }
        .adm-count { font-size: 11px; color: rgba(255,255,255,0.25); white-space: nowrap; }

        /* Botones */
        .btn-primary { padding: 8px 18px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .btn-primary:hover { background: #e60000; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { padding: 7px 14px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-ghost:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .btn-danger { padding: 6px 12px; background: transparent; border: 1px solid rgba(200,0,0,0.3); border-radius: 4px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .btn-danger:hover { background: rgba(200,0,0,0.12); }
        .btn-success { padding: 6px 12px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 4px; color: #22c55e; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .btn-success:hover { background: rgba(34,197,94,0.2); }
        .btn-edit { padding: 6px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.6); font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .btn-edit:hover { border-color: rgba(255,255,255,0.25); color: #fff; background: rgba(255,255,255,0.08); }

        /* Tabla */
        .adm-table-wrap { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .adm-table { width: 100%; border-collapse: collapse; }
        .adm-table th { padding: 10px 14px; font-family: 'Montserrat', sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.28); text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); white-space: nowrap; }
        .adm-table td { padding: 11px 14px; font-size: 12px; color: rgba(255,255,255,0.7); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .adm-table tr:last-child td { border-bottom: none; }
        .adm-table tr:hover td { background: rgba(255,255,255,0.02); }
        .adm-td-nombre { font-weight: 500; color: #fff; max-width: 200px; }
        .adm-td-url { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .adm-td-url a { color: rgba(200,0,0,0.7); text-decoration: none; font-size: 11px; }
        .adm-td-url a:hover { color: #cc0000; text-decoration: underline; }
        .adm-td-actions { display: flex; gap: 6px; align-items: center; white-space: nowrap; }
        .adm-badge-cat { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); font-family: 'Montserrat', sans-serif; white-space: nowrap; }
        .adm-toggle { width: 34px; height: 18px; border-radius: 9px; border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .adm-toggle.on { background: rgba(34,197,94,0.4); }
        .adm-toggle.off { background: rgba(255,255,255,0.1); }
        .adm-toggle::after { content: ''; position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #fff; top: 3px; transition: left 0.2s; }
        .adm-toggle.on::after { left: 19px; }
        .adm-toggle.off::after { left: 3px; }
        .adm-star { color: #eab308; font-size: 14px; }
        .adm-star.off { color: rgba(255,255,255,0.1); }
        .adm-orden { font-family: 'Montserrat', sans-serif; font-size: 11px; color: rgba(255,255,255,0.3); }

        /* Sugerencias */
        .sug-card { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .sug-card:hover { border-color: rgba(255,255,255,0.12); }
        .sug-info { flex: 1; min-width: 200px; }
        .sug-nombre { font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .sug-url { font-size: 11px; color: rgba(200,0,0,0.7); margin-bottom: 6px; word-break: break-all; }
        .sug-desc { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.5; margin-bottom: 6px; }
        .sug-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .sug-who { font-size: 10px; color: rgba(255,255,255,0.25); }
        .sug-cat { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); font-family: 'Montserrat', sans-serif; }
        .sug-date { font-size: 9px; color: rgba(255,255,255,0.2); font-family: 'Montserrat', sans-serif; }
        .sug-actions { display: flex; gap: 8px; flex-shrink: 0; align-items: center; flex-wrap: wrap; }

        /* Modal */
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 24px; }
        .modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.25); border-radius: 6px; padding: 28px 30px; width: 100%; max-width: 560px; position: relative; max-height: 90vh; overflow-y: auto; }
        .modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .modal-title { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 22px; }
        .modal-title span { color: #cc0000; }
        .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-grid .full { grid-column: 1 / -1; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .field input, .field select, .field textarea { padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; width: 100%; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: rgba(200,0,0,0.4); }
        .field input::placeholder, .field textarea::placeholder { color: rgba(255,255,255,0.2); }
        .field select { background: #0f0f0f; }
        .field textarea { resize: vertical; min-height: 70px; }
        .field-check { display: flex; align-items: center; gap: 10px; padding: 9px 0; }
        .field-check input[type=checkbox] { width: 16px; height: 16px; accent-color: #cc0000; cursor: pointer; }
        .field-check label { font-size: 12px; color: rgba(255,255,255,0.6); cursor: pointer; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.07); }

        /* Confirmar eliminar */
        .confirm-box { background: rgba(200,0,0,0.06); border: 1px solid rgba(200,0,0,0.25); border-radius: 5px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .confirm-txt { font-size: 12px; color: rgba(255,255,255,0.7); }
        .confirm-actions { display: flex; gap: 8px; }

        /* Toast */
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: 5px; font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; z-index: 999; animation: fadeIn 0.3s ease; }
        .toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; }
        .toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        /* Empty */
        .empty-state { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; }

        /* Loading */
        .adm-loading { padding: 48px; display: flex; align-items: center; justify-content: center; }
        .spin { width: 28px; height: 28px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .adm-table { display: block; overflow-x: auto; }
          .modal-grid { grid-template-columns: 1fr; }
          .modal-grid .full { grid-column: 1; }
        }
      `}</style>

      <div className="adm-enl-wrap">
        {/* Header */}
        <div className="adm-enl-header">
          <h1 className="adm-enl-titulo">Admin — <span>Enlaces Útiles</span></h1>
          <div className="adm-enl-header-actions">
            <div className="adm-tabs">
              <button
                className={`adm-tab${tab === "enlaces" ? " active" : ""}`}
                onClick={() => setTab("enlaces")}
              >
                🔗 Enlaces
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginLeft: 2 }}>
                  ({enlaces.length})
                </span>
              </button>
              <button
                className={`adm-tab${tab === "sugerencias" ? " active" : ""}`}
                onClick={() => setTab("sugerencias")}
              >
                💡 Sugerencias
                {sugerencias.length > 0 && (
                  <span className="adm-tab-badge">{sugerencias.length}</span>
                )}
              </button>
            </div>
            {tab === "enlaces" && (
              <button className="btn-primary" onClick={() => setNuevoModal(true)}>
                + Nuevo enlace
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="spin" /></div>
        ) : tab === "enlaces" ? (
          <>
            {/* Toolbar */}
            <div className="adm-toolbar">
              <div className="adm-search">
                <span className="adm-search-ico">🔍</span>
                <input
                  placeholder="Buscar por nombre o URL..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </div>
              <span className="adm-count">
                {enlacesFiltrados.length} de {enlaces.length} enlaces
              </span>
            </div>

            {/* Confirmar eliminar */}
            {confirmarEliminar && (
              <div className="confirm-box">
                <span className="confirm-txt">
                  ¿Eliminar el enlace <strong>
                    &quot;{enlaces.find(e => e.id === confirmarEliminar)?.nombre}&quot;
                  </strong>? Esta acción no se puede deshacer.
                </span>
                <div className="confirm-actions">
                  <button className="btn-ghost" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
                  <button className="btn-danger" onClick={() => eliminarEnlace(confirmarEliminar)}>Eliminar</button>
                </div>
              </div>
            )}

            {/* Tabla */}
            {enlacesFiltrados.length === 0 ? (
              <div className="empty-state">No hay enlaces con ese filtro.</div>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nombre</th>
                      <th>URL</th>
                      <th>Categoría</th>
                      <th>Localidad</th>
                      <th>⭐</th>
                      <th>Activo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enlacesFiltrados.map(e => (
                      <tr key={e.id}>
                        <td className="adm-orden">{e.orden}</td>
                        <td className="adm-td-nombre">{e.nombre}</td>
                        <td className="adm-td-url">
                          <a href={e.url} target="_blank" rel="noopener noreferrer">
                            {e.url.replace(/^https?:\/\//, "").slice(0, 40)}{e.url.length > 46 ? "…" : ""}
                          </a>
                        </td>
                        <td>
                          <span className="adm-badge-cat">
                            {CATEGORIAS.find(c => c.id === e.categoria)?.label ?? e.categoria}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                          {e.localidad ?? "—"}
                        </td>
                        <td>
                          <span className={`adm-star${e.destacado ? "" : " off"}`}>★</span>
                        </td>
                        <td>
                          <button
                            className={`adm-toggle${e.activo ? " on" : " off"}`}
                            onClick={() => toggleActivo(e)}
                            title={e.activo ? "Desactivar" : "Activar"}
                          />
                        </td>
                        <td>
                          <div className="adm-td-actions">
                            <button className="btn-edit" onClick={() => setEditando({ ...e })}>
                              Editar
                            </button>
                            <button className="btn-danger" onClick={() => setConfirmarEliminar(e.id)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* ── SUGERENCIAS ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sugerencias.length === 0 ? (
              <div className="empty-state">No hay sugerencias pendientes.</div>
            ) : (
              sugerencias.map(s => (
                <div key={s.id} className="sug-card">
                  <div className="sug-info">
                    <div className="sug-nombre">{s.nombre}</div>
                    <div className="sug-url">{s.url}</div>
                    {s.descripcion && <div className="sug-desc">{s.descripcion}</div>}
                    <div className="sug-meta">
                      {s.perfiles && (
                        <span className="sug-who">
                          👤 {s.perfiles.nombre} {s.perfiles.apellido}
                          {s.perfiles.matricula ? ` · Mat. ${s.perfiles.matricula}` : ""}
                        </span>
                      )}
                      {s.categoria && (
                        <span className="sug-cat">
                          {CATEGORIAS.find(c => c.id === s.categoria)?.label ?? s.categoria}
                        </span>
                      )}
                      <span className="sug-date">
                        {new Date(s.created_at).toLocaleDateString("es-AR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="sug-actions">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}
                    >
                      Ver ↗
                    </a>
                    <button
                      className="btn-success"
                      onClick={() => aprobarSugerencia(s)}
                      disabled={guardando}
                    >
                      ✓ Aprobar
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => rechazarSugerencia(s.id)}
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── MODAL NUEVO ENLACE ── */}
      {nuevoModal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setNuevoModal(false); }}>
          <div className="modal">
            <div className="modal-title">Nuevo <span>enlace</span></div>
            <div className="modal-grid">
              <div className="field full">
                <label>Nombre *</label>
                <input
                  placeholder="Ej: Catastro Municipal de Rosario"
                  value={formNuevo.nombre}
                  onChange={e => setFormNuevo(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="field full">
                <label>URL *</label>
                <input
                  placeholder="https://..."
                  value={formNuevo.url}
                  onChange={e => setFormNuevo(f => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div className="field full">
                <label>Descripción</label>
                <textarea
                  placeholder="¿Para qué sirve este enlace?"
                  value={formNuevo.descripcion ?? ""}
                  onChange={e => setFormNuevo(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Categoría</label>
                <select
                  value={formNuevo.categoria}
                  onChange={e => setFormNuevo(f => ({ ...f, categoria: e.target.value }))}
                >
                  {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Localidad</label>
                <select
                  value={formNuevo.localidad ?? ""}
                  onChange={e => setFormNuevo(f => ({ ...f, localidad: e.target.value || null }))}
                >
                  <option value="">Sin localidad</option>
                  {LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Orden</label>
                <input
                  type="number"
                  value={formNuevo.orden}
                  onChange={e => setFormNuevo(f => ({ ...f, orden: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Opciones</label>
                <div className="field-check">
                  <input
                    type="checkbox"
                    id="new-dest"
                    checked={formNuevo.destacado}
                    onChange={e => setFormNuevo(f => ({ ...f, destacado: e.target.checked }))}
                  />
                  <label htmlFor="new-dest">⭐ Destacado</label>
                </div>
                <div className="field-check">
                  <input
                    type="checkbox"
                    id="new-activo"
                    checked={formNuevo.activo}
                    onChange={e => setFormNuevo(f => ({ ...f, activo: e.target.checked }))}
                  />
                  <label htmlFor="new-activo">Activo</label>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => { setNuevoModal(false); setFormNuevo(EMPTY_ENLACE); }}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={crearEnlace}
                disabled={guardando || !formNuevo.nombre || !formNuevo.url}
              >
                {guardando ? "Guardando..." : "Crear enlace"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR ── */}
      {editando && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEditando(null); }}>
          <div className="modal">
            <div className="modal-title">Editar <span>enlace</span></div>
            <div className="modal-grid">
              <div className="field full">
                <label>Nombre *</label>
                <input
                  value={editando.nombre}
                  onChange={e => setEditando(ed => ed ? { ...ed, nombre: e.target.value } : ed)}
                />
              </div>
              <div className="field full">
                <label>URL *</label>
                <input
                  value={editando.url}
                  onChange={e => setEditando(ed => ed ? { ...ed, url: e.target.value } : ed)}
                />
              </div>
              <div className="field full">
                <label>Descripción</label>
                <textarea
                  value={editando.descripcion ?? ""}
                  onChange={e => setEditando(ed => ed ? { ...ed, descripcion: e.target.value } : ed)}
                />
              </div>
              <div className="field">
                <label>Categoría</label>
                <select
                  value={editando.categoria}
                  onChange={e => setEditando(ed => ed ? { ...ed, categoria: e.target.value } : ed)}
                >
                  {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Localidad</label>
                <select
                  value={editando.localidad ?? ""}
                  onChange={e => setEditando(ed => ed ? { ...ed, localidad: e.target.value || null } : ed)}
                >
                  <option value="">Sin localidad</option>
                  {LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Orden</label>
                <input
                  type="number"
                  value={editando.orden}
                  onChange={e => setEditando(ed => ed ? { ...ed, orden: parseInt(e.target.value) || 0 } : ed)}
                />
              </div>
              <div className="field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Opciones</label>
                <div className="field-check">
                  <input
                    type="checkbox"
                    id="edit-dest"
                    checked={editando.destacado}
                    onChange={e => setEditando(ed => ed ? { ...ed, destacado: e.target.checked } : ed)}
                  />
                  <label htmlFor="edit-dest">⭐ Destacado</label>
                </div>
                <div className="field-check">
                  <input
                    type="checkbox"
                    id="edit-activo"
                    checked={editando.activo}
                    onChange={e => setEditando(ed => ed ? { ...ed, activo: e.target.checked } : ed)}
                  />
                  <label htmlFor="edit-activo">Activo</label>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={guardarEdicion}
                disabled={guardando || !editando.nombre || !editando.url}
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.tipo}`}>{toast.msg}</div>
      )}
    </>
  );
}
