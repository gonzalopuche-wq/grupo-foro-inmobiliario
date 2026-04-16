"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Enlace {
  id: string;
  nombre: string;
  descripcion: string;
  url: string;
  categoria: string;
  localidad: string | null;
  destacado: boolean;
  activo: boolean;
  orden: number;
}

interface Sugerencia {
  id: string;
  nombre: string;
  descripcion: string | null;
  url: string;
  categoria: string | null;
  estado: string;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
}

const CATEGORIAS = [
  { id: "padron", label: "Padrón y Colegios" },
  { id: "impuestos", label: "Impuestos Provinciales" },
  { id: "catastro", label: "Catastro y Registro" },
  { id: "tasas", label: "Tasas Municipales" },
  { id: "servicios", label: "Servicios Públicos" },
  { id: "tramites", label: "Trámites y Portales" },
];

const FORM_VACIO = { nombre: "", descripcion: "", url: "", categoria: "padron", localidad: "", destacado: false, orden: 0 };

export default function AdminEnlacesPage() {
  const [enlaces, setEnlaces] = useState<Enlace[]>([]);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"enlaces" | "sugerencias">("enlaces");
  const [editando, setEditando] = useState<Enlace | null>(null);
  const [mostrando, setMostrando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("todos");

  useEffect(() => {
    cargarTodo();
  }, []);

  const cargarTodo = async () => {
    setLoading(true);
    const [{ data: enl }, { data: sug }] = await Promise.all([
      supabase.from("enlaces_utiles").select("*").order("orden"),
      supabase.from("enlaces_sugerencias").select("*, perfiles(nombre,apellido,matricula)").order("created_at", { ascending: false }),
    ]);
    setEnlaces((enl as Enlace[]) ?? []);
    setSugerencias((sug as unknown as Sugerencia[]) ?? []);
    setLoading(false);
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...FORM_VACIO, orden: enlaces.length + 1 });
    setMostrando(true);
  };

  const abrirEditar = (e: Enlace) => {
    setEditando(e);
    setForm({ nombre: e.nombre, descripcion: e.descripcion, url: e.url, categoria: e.categoria, localidad: e.localidad ?? "", destacado: e.destacado, orden: e.orden });
    setMostrando(true);
  };

  const guardar = async () => {
    if (!form.nombre || !form.url) return;
    setGuardando(true);
    const payload = { nombre: form.nombre, descripcion: form.descripcion, url: form.url, categoria: form.categoria, localidad: form.localidad || null, destacado: form.destacado, orden: form.orden };
    if (editando) {
      await supabase.from("enlaces_utiles").update(payload).eq("id", editando.id);
    } else {
      await supabase.from("enlaces_utiles").insert({ ...payload, activo: true });
    }
    setGuardando(false);
    setMostrando(false);
    cargarTodo();
  };

  const toggleActivo = async (e: Enlace) => {
    await supabase.from("enlaces_utiles").update({ activo: !e.activo }).eq("id", e.id);
    cargarTodo();
  };

  const toggleDestacado = async (e: Enlace) => {
    await supabase.from("enlaces_utiles").update({ destacado: !e.destacado }).eq("id", e.id);
    cargarTodo();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este enlace?")) return;
    await supabase.from("enlaces_utiles").delete().eq("id", id);
    cargarTodo();
  };

  const aprobarSugerencia = async (s: Sugerencia) => {
    await supabase.from("enlaces_utiles").insert({ nombre: s.nombre, descripcion: s.descripcion ?? "", url: s.url, categoria: s.categoria ?? "tramites", localidad: null, destacado: false, activo: true, orden: enlaces.length + 1 });
    await supabase.from("enlaces_sugerencias").update({ estado: "aprobada" }).eq("id", s.id);
    cargarTodo();
  };

  const rechazarSugerencia = async (id: string) => {
    await supabase.from("enlaces_sugerencias").update({ estado: "rechazada" }).eq("id", id);
    cargarTodo();
  };

  const enlacesFiltrados = enlaces.filter(e => {
    if (filtroActivo === "activos" && !e.activo) return false;
    if (filtroActivo === "inactivos" && e.activo) return false;
    if (busqueda.trim() && !e.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const sugerenciasPendientes = sugerencias.filter(s => s.estado === "pendiente");

  return (
    <>
      <style>{`
        .admenl-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .admenl-tab { padding: 8px 20px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; position: relative; }
        .admenl-tab.active { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .admenl-badge { position: absolute; top: -6px; right: -6px; background: #cc0000; color: #fff; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 10px; }
        .admenl-topbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .admenl-search { flex: 1; min-width: 200px; }
        .admenl-search input { width: 100%; padding: 8px 12px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .admenl-search input:focus { border-color: rgba(200,0,0,0.4); }
        .admenl-search input::placeholder { color: rgba(255,255,255,0.2); }
        .admenl-filtro { padding: 7px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .admenl-filtro.active { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .admenl-btn-nuevo { padding: 8px 18px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .admenl-btn-nuevo:hover { background: #e60000; }
        .admenl-count { font-size: 11px; color: rgba(255,255,255,0.25); }
        .admenl-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .admenl-tabla { width: 100%; border-collapse: collapse; }
        .admenl-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .admenl-tabla th { padding: 10px 14px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); white-space: nowrap; }
        .admenl-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .admenl-tabla tbody tr:last-child { border-bottom: none; }
        .admenl-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .admenl-tabla tbody tr.inactivo { opacity: 0.45; }
        .admenl-tabla td { padding: 11px 14px; font-size: 12px; color: rgba(255,255,255,0.7); vertical-align: middle; }
        .admenl-nombre { font-weight: 600; color: #fff; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .admenl-url { font-size: 10px; color: rgba(255,255,255,0.3); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .admenl-cat-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; white-space: nowrap; }
        .admenl-actions { display: flex; align-items: center; gap: 6px; }
        .admenl-btn-sm { padding: 4px 10px; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; font-family: 'Montserrat',sans-serif; border: 1px solid; transition: all 0.15s; white-space: nowrap; }
        .admenl-btn-edit { background: transparent; border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.5); }
        .admenl-btn-edit:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .admenl-btn-toggle { background: transparent; }
        .admenl-btn-toggle.on { border-color: rgba(34,197,94,0.3); color: #22c55e; }
        .admenl-btn-toggle.off { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.35); }
        .admenl-btn-dest { background: transparent; font-size: 13px; border: none; cursor: pointer; padding: 2px 4px; }
        .admenl-btn-del { background: transparent; border-color: rgba(200,0,0,0.25); color: rgba(200,0,0,0.5); }
        .admenl-btn-del:hover { border-color: rgba(200,0,0,0.5); color: #ff4444; background: rgba(200,0,0,0.08); }
        /* SUGERENCIAS */
        .admenl-sug-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
        .admenl-sug-nombre { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .admenl-sug-url { font-size: 11px; color: #60a5fa; margin-bottom: 4px; word-break: break-all; }
        .admenl-sug-desc { font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 6px; }
        .admenl-sug-corredor { font-size: 10px; color: rgba(255,255,255,0.3); }
        .admenl-sug-actions { display: flex; gap: 8px; flex-shrink: 0; align-items: flex-start; }
        .admenl-btn-aprobar { padding: 7px 14px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 3px; color: #22c55e; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .admenl-btn-rechazar { padding: 7px 14px; background: transparent; border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: rgba(200,0,0,0.6); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        /* MODAL */
        .admenl-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 300; padding: 24px; overflow-y: auto; }
        .admenl-modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.25); border-radius: 6px; padding: 28px 32px; width: 100%; max-width: 520px; position: relative; margin: auto; }
        .admenl-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .admenl-modal-title { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .admenl-modal-title span { color: #cc0000; }
        .admenl-field { margin-bottom: 12px; }
        .admenl-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .admenl-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .admenl-input:focus { border-color: rgba(200,0,0,0.4); }
        .admenl-input::placeholder { color: rgba(255,255,255,0.2); }
        .admenl-select { width: 100%; padding: 9px 12px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .admenl-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .admenl-toggle-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; cursor: pointer; }
        .admenl-toggle-row span { font-size: 12px; color: rgba(255,255,255,0.6); }
        .admenl-modal-actions { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }
        .admenl-btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .admenl-btn-guardar { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .admenl-btn-guardar:hover:not(:disabled) { background: #e60000; }
        .admenl-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
        .admenl-empty { padding: 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 12px; font-style: italic; }
      `}</style>

      <div className="admenl-tabs">
        <button className={`admenl-tab${vista === "enlaces" ? " active" : ""}`} onClick={() => setVista("enlaces")}>
          🔗 Links ({enlaces.length})
        </button>
        <button className={`admenl-tab${vista === "sugerencias" ? " active" : ""}`} onClick={() => setVista("sugerencias")}>
          💡 Sugerencias
          {sugerenciasPendientes.length > 0 && <span className="admenl-badge">{sugerenciasPendientes.length}</span>}
        </button>
      </div>

      {vista === "enlaces" && (
        <>
          <div className="admenl-topbar">
            <div className="admenl-search">
              <input placeholder="Buscar por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            {["todos","activos","inactivos"].map(f => (
              <button key={f} className={`admenl-filtro${filtroActivo === f ? " active" : ""}`} onClick={() => setFiltroActivo(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <span className="admenl-count">{enlacesFiltrados.length} links</span>
            <button className="admenl-btn-nuevo" onClick={abrirNuevo}>+ Nuevo enlace</button>
          </div>

          <div className="admenl-tabla-wrap">
            <table className="admenl-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>URL</th>
                  <th>Categoría</th>
                  <th>Localidad</th>
                  <th>Orden</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{textAlign:"center",padding:32,color:"rgba(255,255,255,0.2)"}}>Cargando...</td></tr>
                ) : enlacesFiltrados.length === 0 ? (
                  <tr><td colSpan={6}><div className="admenl-empty">No hay enlaces.</div></td></tr>
                ) : enlacesFiltrados.map(e => (
                  <tr key={e.id} className={!e.activo ? "inactivo" : ""}>
                    <td>
                      <div className="admenl-nombre">{e.nombre}</div>
                      <div className="admenl-cat-badge" style={{marginTop:3}}>{CATEGORIAS.find(c => c.id === e.categoria)?.label}</div>
                    </td>
                    <td><div className="admenl-url">{e.url}</div></td>
                    <td><span className="admenl-cat-badge">{e.categoria}</span></td>
                    <td style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{e.localidad ?? "—"}</td>
                    <td style={{fontSize:11,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>{e.orden}</td>
                    <td>
                      <div className="admenl-actions">
                        <button className="admenl-btn-dest" onClick={() => toggleDestacado(e)} title={e.destacado ? "Quitar destacado" : "Destacar"}>
                          {e.destacado ? "⭐" : "☆"}
                        </button>
                        <button className={`admenl-btn-sm admenl-btn-toggle ${e.activo ? "on" : "off"}`} onClick={() => toggleActivo(e)}>
                          {e.activo ? "Activo" : "Inactivo"}
                        </button>
                        <button className="admenl-btn-sm admenl-btn-edit" onClick={() => abrirEditar(e)}>Editar</button>
                        <button className="admenl-btn-sm admenl-btn-del" onClick={() => eliminar(e.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {vista === "sugerencias" && (
        <>
          {sugerenciasPendientes.length === 0 ? (
            <div className="admenl-empty" style={{background:"rgba(14,14,14,0.9)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6}}>
              No hay sugerencias pendientes.
            </div>
          ) : sugerenciasPendientes.map(s => (
            <div key={s.id} className="admenl-sug-card">
              <div style={{flex:1}}>
                <div className="admenl-sug-nombre">{s.nombre}</div>
                <div className="admenl-sug-url">{s.url}</div>
                {s.descripcion && <div className="admenl-sug-desc">{s.descripcion}</div>}
                {s.categoria && <span className="admenl-cat-badge">{CATEGORIAS.find(c => c.id === s.categoria)?.label ?? s.categoria}</span>}
                <div className="admenl-sug-corredor" style={{marginTop:6}}>
                  Sugerido por: {s.perfiles?.apellido}, {s.perfiles?.nombre} · Mat. {s.perfiles?.matricula ?? "—"}
                </div>
              </div>
              <div className="admenl-sug-actions">
                <button className="admenl-btn-aprobar" onClick={() => aprobarSugerencia(s)}>✓ Aprobar y agregar</button>
                <button className="admenl-btn-rechazar" onClick={() => rechazarSugerencia(s.id)}>✕ Rechazar</button>
              </div>
            </div>
          ))}
        </>
      )}

      {mostrando && (
        <div className="admenl-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrando(false); }}>
          <div className="admenl-modal">
            <div className="admenl-modal-title">{editando ? "Editar" : "Nuevo"} <span>enlace</span></div>
            <div className="admenl-field">
              <label className="admenl-label">Nombre *</label>
              <input className="admenl-input" placeholder="Ej: Catastro Municipal de Rosario" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} />
            </div>
            <div className="admenl-field">
              <label className="admenl-label">URL *</label>
              <input className="admenl-input" placeholder="https://..." value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} />
            </div>
            <div className="admenl-field">
              <label className="admenl-label">Descripción</label>
              <input className="admenl-input" placeholder="¿Para qué sirve?" value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))} />
            </div>
            <div className="admenl-row">
              <div className="admenl-field">
                <label className="admenl-label">Categoría *</label>
                <select className="admenl-select" value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}>
                  {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="admenl-field">
                <label className="admenl-label">Localidad</label>
                <input className="admenl-input" placeholder="Rosario (opcional)" value={form.localidad} onChange={e => setForm(f => ({...f, localidad: e.target.value}))} />
              </div>
            </div>
            <div className="admenl-row">
              <div className="admenl-field">
                <label className="admenl-label">Orden</label>
                <input className="admenl-input" type="number" value={form.orden} onChange={e => setForm(f => ({...f, orden: parseInt(e.target.value) || 0}))} />
              </div>
              <div className="admenl-field" style={{display:"flex",alignItems:"flex-end"}}>
                <div className="admenl-toggle-row" style={{flex:1}} onClick={() => setForm(f => ({...f, destacado: !f.destacado}))}>
                  <div style={{width:32,height:18,borderRadius:9,background:form.destacado?"#eab308":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:2,left:form.destacado?16:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                  </div>
                  <span>Destacado ⭐</span>
                </div>
              </div>
            </div>
            <div className="admenl-modal-actions">
              <button className="admenl-btn-cancel" onClick={() => setMostrando(false)}>Cancelar</button>
              <button className="admenl-btn-guardar" onClick={guardar} disabled={guardando || !form.nombre || !form.url}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Agregar enlace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
