"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Documento {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  url: string;
  tipo_archivo: string;
  destacado: boolean;
  activo: boolean;
  orden: number;
  perfil_id: string | null;
  created_at: string;
  perfiles?: { nombre: string; apellido: string };
}

const CATEGORIAS = [
  { id: "contratos", label: "Contratos" },
  { id: "normativa", label: "Normativa" },
  { id: "guias", label: "Guías" },
  { id: "formularios", label: "Formularios" },
  { id: "jurisprudencia", label: "Jurisprudencia" },
  { id: "otros", label: "Otros" },
];

const TIPOS = ["pdf", "word", "excel", "imagen", "link", "otro"];

const TIPO_ICONO: Record<string, string> = {
  pdf: "📄", word: "📝", excel: "📊", imagen: "🖼️", link: "🔗", otro: "📎",
};

const FORM_VACIO = {
  titulo: "",
  descripcion: "",
  categoria: "contratos",
  url: "",
  tipo_archivo: "pdf",
  destacado: false,
  activo: true,
  orden: 0,
};

export default function AdminBibliotecaPage() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    const verificar = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (!perfil || perfil.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      cargarDocs();
    };
    verificar();
  }, []);

  const cargarDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("biblioteca_documentos")
      .select("*, perfiles(nombre, apellido)")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: false });
    setDocs((data as unknown as Documento[]) ?? []);
    setLoading(false);
  };

  const handleForm = (k: string, v: string | boolean | number) =>
    setForm(p => ({ ...p, [k]: v }));

  const guardarDoc = async () => {
    if (!form.titulo.trim() || !form.url.trim()) return;
    setGuardando(true);

    const payload = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      categoria: form.categoria,
      url: form.url.trim(),
      tipo_archivo: form.tipo_archivo,
      destacado: form.destacado,
      activo: form.activo,
      orden: Number(form.orden) || 0,
    };

    if (editandoId) {
      await supabase.from("biblioteca_documentos").update(payload).eq("id", editandoId);
    } else {
      await supabase.from("biblioteca_documentos").insert(payload);
    }

    setGuardando(false);
    setMostrarForm(false);
    setForm(FORM_VACIO);
    setEditandoId(null);
    cargarDocs();
  };

  const toggleCampo = async (id: string, campo: "activo" | "destacado", valor: boolean) => {
    setProcesando(id + campo);
    await supabase.from("biblioteca_documentos").update({ [campo]: valor }).eq("id", id);
    await cargarDocs();
    setProcesando(null);
  };

  const eliminarDoc = async (id: string) => {
    if (!confirm("¿Eliminar este documento?")) return;
    setProcesando(id + "del");
    await supabase.from("biblioteca_documentos").delete().eq("id", id);
    await cargarDocs();
    setProcesando(null);
  };

  const editarDoc = (doc: Documento) => {
    setForm({
      titulo: doc.titulo,
      descripcion: doc.descripcion ?? "",
      categoria: doc.categoria,
      url: doc.url,
      tipo_archivo: doc.tipo_archivo,
      destacado: doc.destacado,
      activo: doc.activo,
      orden: doc.orden,
    });
    setEditandoId(doc.id);
    setMostrarForm(true);
  };

  const docsFiltrados = docs.filter(d => {
    if (filtro !== "todos" && d.categoria !== filtro) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return d.titulo.toLowerCase().includes(q) || (d.descripcion ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }

        .ab-root { min-height: 100vh; display: flex; flex-direction: column; }
        .ab-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .ab-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .ab-topbar-logo span { color: #cc0000; }
        .ab-topbar-right { display: flex; gap: 12px; align-items: center; }
        .ab-btn-back { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .ab-btn-back:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .ab-btn-nuevo { padding: 8px 18px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .ab-btn-nuevo:hover { background: #e60000; }

        .ab-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; }
        .ab-header { margin-bottom: 24px; }
        .ab-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .ab-header h1 span { color: #cc0000; }
        .ab-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }

        .ab-toolbar { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; align-items: center; }
        .ab-search { flex: 1; min-width: 200px; padding: 9px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .ab-search:focus { border-color: rgba(200,0,0,0.4); }
        .ab-search::placeholder { color: rgba(255,255,255,0.2); }
        .ab-filtro { padding: 7px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .ab-filtro:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .ab-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }

        .ab-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .ab-tabla { width: 100%; border-collapse: collapse; }
        .ab-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .ab-tabla th { padding: 12px 16px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .ab-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
        .ab-tabla tbody tr:last-child { border-bottom: none; }
        .ab-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .ab-tabla td { padding: 12px 16px; font-size: 13px; color: rgba(255,255,255,0.8); vertical-align: middle; }
        .ab-doc-titulo { font-weight: 600; color: #fff; font-size: 13px; }
        .ab-doc-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }

        .badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; white-space: nowrap; }
        .badge-activo { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
        .badge-inactivo { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); }
        .badge-dest { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); color: #eab308; }

        .ab-acciones { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .ab-btn { padding: 5px 10px; border: 1px solid; border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; background: transparent; white-space: nowrap; }
        .ab-btn-edit { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); }
        .ab-btn-edit:hover { border-color: rgba(255,255,255,0.4); color: #fff; }
        .ab-btn-toggle-on { border-color: rgba(34,197,94,0.4); color: #22c55e; }
        .ab-btn-toggle-on:hover { background: rgba(34,197,94,0.1); }
        .ab-btn-toggle-off { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.35); }
        .ab-btn-toggle-off:hover { background: rgba(255,255,255,0.05); }
        .ab-btn-del { border-color: rgba(200,0,0,0.3); color: rgba(200,0,0,0.7); }
        .ab-btn-del:hover { background: rgba(200,0,0,0.1); color: #ff4444; }

        .ab-spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ab-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }

        /* MODAL */
        .ab-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; }
        .ab-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 32px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; position: relative; }
        .ab-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .ab-modal h2 { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 22px; }
        .ab-modal h2 span { color: #cc0000; }
        .ab-field { margin-bottom: 14px; }
        .ab-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-family: 'Montserrat', sans-serif; }
        .ab-input { width: 100%; padding: 9px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .ab-input:focus { border-color: rgba(200,0,0,0.4); }
        .ab-input::placeholder { color: rgba(255,255,255,0.2); }
        .ab-textarea { width: 100%; padding: 9px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 70px; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .ab-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .ab-select { width: 100%; padding: 9px 13px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .ab-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ab-toggle-row { display: flex; gap: 10px; margin-top: 4px; }
        .ab-toggle-btn { padding: 6px 14px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'Montserrat', sans-serif; }
        .ab-toggle-btn.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .ab-form-actions { display: flex; gap: 10px; margin-top: 22px; justify-content: flex-end; }
        .ab-btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .ab-btn-cancel:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .ab-btn-save { padding: 9px 22px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .ab-btn-save:hover { background: #e60000; }
        .ab-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="ab-root">
        <header className="ab-topbar">
          <div className="ab-topbar-logo"><span>GFI</span>® · Biblioteca Admin</div>
          <div className="ab-topbar-right">
            <a className="ab-btn-back" href="/admin">← Panel Admin</a>
            <button
              className="ab-btn-nuevo"
              onClick={() => { setForm(FORM_VACIO); setEditandoId(null); setMostrarForm(true); }}
            >
              + Nuevo documento
            </button>
          </div>
        </header>

        <main className="ab-content">
          <div className="ab-header">
            <h1>Gestión de <span>biblioteca</span></h1>
            <p>Administrá contratos, normativa, guías y recursos para la comunidad.</p>
          </div>

          <div className="ab-toolbar">
            <input
              className="ab-search"
              placeholder="Buscar por título o descripción..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <button
              className={`ab-filtro${filtro === "todos" ? " activo" : ""}`}
              onClick={() => setFiltro("todos")}
            >
              Todos ({docs.length})
            </button>
            {CATEGORIAS.map(c => {
              const n = docs.filter(d => d.categoria === c.id).length;
              return (
                <button
                  key={c.id}
                  className={`ab-filtro${filtro === c.id ? " activo" : ""}`}
                  onClick={() => setFiltro(c.id)}
                >
                  {c.label} ({n})
                </button>
              );
            })}
          </div>

          <div className="ab-tabla-wrap">
            {loading ? (
              <div className="ab-empty">Cargando documentos...</div>
            ) : docsFiltrados.length === 0 ? (
              <div className="ab-empty">No hay documentos en esta categoría.</div>
            ) : (
              <table className="ab-tabla">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Categoría</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {docsFiltrados.map(doc => {
                    const catLabel = CATEGORIAS.find(c => c.id === doc.categoria)?.label ?? doc.categoria;
                    const spinnerEl = <span className="ab-spinner" />;
                    return (
                      <tr key={doc.id}>
                        <td>
                          <div className="ab-doc-titulo">
                            {TIPO_ICONO[doc.tipo_archivo] ?? "📎"} {doc.titulo}
                          </div>
                          {doc.descripcion && (
                            <div className="ab-doc-sub">{doc.descripcion.slice(0, 80)}{doc.descripcion.length > 80 ? "…" : ""}</div>
                          )}
                          <div className="ab-doc-sub">{formatFecha(doc.created_at)}</div>
                        </td>
                        <td>
                          <span className="badge badge-inactivo">{catLabel}</span>
                        </td>
                        <td style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
                          {doc.tipo_archivo}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span className={`badge ${doc.activo ? "badge-activo" : "badge-inactivo"}`}>
                              {doc.activo ? "Activo" : "Inactivo"}
                            </span>
                            {doc.destacado && <span className="badge badge-dest">Destacado</span>}
                          </div>
                        </td>
                        <td>
                          {procesando?.startsWith(doc.id) ? spinnerEl : (
                            <div className="ab-acciones">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ab-btn ab-btn-edit"
                              >
                                Ver
                              </a>
                              <button className="ab-btn ab-btn-edit" onClick={() => editarDoc(doc)}>
                                Editar
                              </button>
                              <button
                                className={`ab-btn ${doc.activo ? "ab-btn-toggle-on" : "ab-btn-toggle-off"}`}
                                onClick={() => toggleCampo(doc.id, "activo", !doc.activo)}
                              >
                                {doc.activo ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                className={`ab-btn ${doc.destacado ? "ab-btn-toggle-on" : "ab-btn-toggle-off"}`}
                                onClick={() => toggleCampo(doc.id, "destacado", !doc.destacado)}
                              >
                                {doc.destacado ? "★ Destacado" : "☆ Destacar"}
                              </button>
                              <button
                                className="ab-btn ab-btn-del"
                                onClick={() => eliminarDoc(doc.id)}
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {mostrarForm && (
        <div
          className="ab-modal-bg"
          onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}
        >
          <div className="ab-modal">
            <h2>{editandoId ? "Editar" : "Nuevo"} <span>documento</span></h2>

            <div className="ab-field">
              <label className="ab-label">Título *</label>
              <input
                className="ab-input"
                placeholder="Nombre del documento"
                value={form.titulo}
                onChange={e => handleForm("titulo", e.target.value)}
              />
            </div>

            <div className="ab-field">
              <label className="ab-label">Descripción</label>
              <textarea
                className="ab-textarea"
                placeholder="Breve descripción del contenido..."
                value={form.descripcion}
                onChange={e => handleForm("descripcion", e.target.value)}
              />
            </div>

            <div className="ab-field">
              <label className="ab-label">URL del documento *</label>
              <input
                className="ab-input"
                placeholder="https://drive.google.com/... o https://..."
                value={form.url}
                onChange={e => handleForm("url", e.target.value)}
              />
            </div>

            <div className="ab-form-row">
              <div className="ab-field">
                <label className="ab-label">Categoría</label>
                <select
                  className="ab-select"
                  value={form.categoria}
                  onChange={e => handleForm("categoria", e.target.value)}
                >
                  {CATEGORIAS.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="ab-field">
                <label className="ab-label">Tipo de archivo</label>
                <select
                  className="ab-select"
                  value={form.tipo_archivo}
                  onChange={e => handleForm("tipo_archivo", e.target.value)}
                >
                  {TIPOS.map(t => (
                    <option key={t} value={t}>{TIPO_ICONO[t]} {t.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ab-form-row">
              <div className="ab-field">
                <label className="ab-label">Orden</label>
                <input
                  className="ab-input"
                  type="number"
                  placeholder="0"
                  value={form.orden}
                  onChange={e => handleForm("orden", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="ab-field">
              <label className="ab-label">Visibilidad</label>
              <div className="ab-toggle-row">
                <button
                  type="button"
                  className={`ab-toggle-btn${form.activo ? " activo" : ""}`}
                  onClick={() => handleForm("activo", true)}
                >
                  Activo
                </button>
                <button
                  type="button"
                  className={`ab-toggle-btn${!form.activo ? " activo" : ""}`}
                  onClick={() => handleForm("activo", false)}
                >
                  Inactivo
                </button>
              </div>
            </div>

            <div className="ab-field">
              <label className="ab-label">Destacado</label>
              <div className="ab-toggle-row">
                <button
                  type="button"
                  className={`ab-toggle-btn${form.destacado ? " activo" : ""}`}
                  onClick={() => handleForm("destacado", true)}
                >
                  Sí, destacar
                </button>
                <button
                  type="button"
                  className={`ab-toggle-btn${!form.destacado ? " activo" : ""}`}
                  onClick={() => handleForm("destacado", false)}
                >
                  No
                </button>
              </div>
            </div>

            <div className="ab-form-actions">
              <button className="ab-btn-cancel" onClick={() => setMostrarForm(false)}>
                Cancelar
              </button>
              <button
                className="ab-btn-save"
                onClick={guardarDoc}
                disabled={guardando || !form.titulo.trim() || !form.url.trim()}
              >
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar documento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
