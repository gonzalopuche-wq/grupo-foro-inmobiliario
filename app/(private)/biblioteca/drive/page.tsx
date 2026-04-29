"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface DriveLink {
  id: string;
  nombre: string;
  url: string;
  tipo: "carpeta" | "documento" | "hoja" | "presentacion" | "formulario" | "otro";
  descripcion?: string;
  created_at: string;
}

const ICONS: Record<string, string> = {
  carpeta: "📁",
  documento: "📄",
  hoja: "📊",
  presentacion: "📊",
  formulario: "📋",
  otro: "🔗",
};

const TIPOS_LABEL: Record<string, string> = {
  carpeta: "Carpeta",
  documento: "Documento",
  hoja: "Hoja de cálculo",
  presentacion: "Presentación",
  formulario: "Formulario",
  otro: "Otro",
};

const FORM_VACIO = {
  nombre: "",
  url: "",
  tipo: "carpeta" as DriveLink["tipo"],
  descripcion: "",
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function DrivePage() {
  const [links, setLinks] = useState<DriveLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [existingConfig, setExistingConfig] = useState<Record<string, any>>({});
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);

      const { data: perfil, error } = await supabase
        .from("perfiles")
        .select("configuracion")
        .eq("id", data.user.id)
        .single();

      if (!error && perfil) {
        const cfg = perfil.configuracion ?? {};
        setExistingConfig(cfg);
        setLinks(cfg.drive_links ?? []);
      }
      setLoading(false);
    };
    init();
  }, []);

  const guardarEnDB = async (nuevosLinks: DriveLink[]) => {
    const { error } = await supabase
      .from("perfiles")
      .update({ configuracion: { ...existingConfig, drive_links: nuevosLinks } })
      .eq("id", userId);
    if (error) {
      mostrarToast("Error al guardar", "err");
      return false;
    }
    setExistingConfig(prev => ({ ...prev, drive_links: nuevosLinks }));
    return true;
  };

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setModal(true);
  };

  const abrirEditar = (link: DriveLink) => {
    setForm({
      nombre: link.nombre,
      url: link.url,
      tipo: link.tipo,
      descripcion: link.descripcion ?? "",
    });
    setEditandoId(link.id);
    setModal(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.url.trim()) {
      mostrarToast("Nombre y URL son obligatorios", "err");
      return;
    }
    setGuardando(true);

    let nuevosLinks: DriveLink[];

    if (editandoId) {
      nuevosLinks = links.map(l =>
        l.id === editandoId
          ? { ...l, nombre: form.nombre, url: form.url, tipo: form.tipo, descripcion: form.descripcion || undefined }
          : l
      );
    } else {
      const nuevo: DriveLink = {
        id: generateId(),
        nombre: form.nombre,
        url: form.url,
        tipo: form.tipo,
        descripcion: form.descripcion || undefined,
        created_at: new Date().toISOString(),
      };
      nuevosLinks = [...links, nuevo];
    }

    const ok = await guardarEnDB(nuevosLinks);
    if (ok) {
      setLinks(nuevosLinks);
      mostrarToast(editandoId ? "Enlace actualizado" : "Enlace agregado");
      setModal(false);
      setEditandoId(null);
    }
    setGuardando(false);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este enlace?")) return;
    const nuevosLinks = links.filter(l => l.id !== id);
    const ok = await guardarEnDB(nuevosLinks);
    if (ok) {
      setLinks(nuevosLinks);
      mostrarToast("Enlace eliminado");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .drv-wrap { display: flex; flex-direction: column; gap: 20px; }
        .drv-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .drv-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }
        .drv-titulo span { color: #cc0000; }
        .drv-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .drv-btn-nuevo { padding: 10px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .drv-btn-nuevo:hover { background: #e60000; }
        .drv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
        .drv-card { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.2s; }
        .drv-card:hover { border-color: rgba(200,0,0,0.2); }
        .drv-card-top { display: flex; align-items: flex-start; gap: 12px; }
        .drv-icon { font-size: 32px; line-height: 1; flex-shrink: 0; }
        .drv-card-info { flex: 1; min-width: 0; }
        .drv-card-nombre { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; word-break: break-word; }
        .drv-card-tipo { font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 4px; }
        .drv-card-desc { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .drv-card-footer { display: flex; gap: 6px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
        .drv-btn-open { display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: #cc0000; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; transition: all 0.2s; cursor: pointer; }
        .drv-btn-open:hover { background: rgba(200,0,0,0.2); color: #fff; }
        .drv-card-actions { display: flex; gap: 4px; }
        .drv-btn-sm { padding: 5px 10px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 1px solid; transition: all 0.15s; }
        .drv-btn-edit { background: transparent; border-color: rgba(255,255,255,0.14); color: rgba(255,255,255,0.4); }
        .drv-btn-edit:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .drv-btn-del { background: transparent; border-color: rgba(200,0,0,0.18); color: rgba(200,0,0,0.5); }
        .drv-btn-del:hover { background: rgba(200,0,0,0.1); border-color: #ff4444; color: #ff4444; }
        .drv-empty { padding: 64px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .drv-spinner { display: flex; align-items: center; justify-content: center; padding: 60px; }
        .drv-spin { width: 26px; height: 26px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Modal */
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; }
        .modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.25); border-radius: 6px; padding: 28px 30px; width: 100%; max-width: 500px; position: relative; max-height: 92vh; overflow-y: auto; }
        .modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg,transparent,#cc0000,transparent); border-radius: 6px 6px 0 0; }
        .modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .modal-titulo span { color: #cc0000; }
        .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .field label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .field input, .field select, .field textarea { padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; transition: border-color 0.2s; width: 100%; box-sizing: border-box; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: rgba(200,0,0,0.4); }
        .field input::placeholder, .field textarea::placeholder { color: rgba(255,255,255,0.2); }
        .field select { background: #0f0f0f; }
        .field textarea { resize: vertical; min-height: 70px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); margin-top: 6px; }
        .btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .btn-save { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .btn-save:hover:not(:disabled) { background: #e60000; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; z-index: 999; animation: toastIn 0.3s ease; }
        .toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; }
        .toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media(max-width:600px) { .drv-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="drv-wrap">
        {/* Header */}
        <div className="drv-header">
          <div>
            <div className="drv-titulo">
              <span>📁</span>
              <span>Google <span style={{ color: "#cc0000" }}>Drive</span></span>
            </div>
            <div className="drv-sub">Tus carpetas y documentos de Google Drive en un solo lugar</div>
          </div>
          <button className="drv-btn-nuevo" onClick={abrirNuevo}>+ Agregar enlace</button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="drv-spinner"><div className="drv-spin" /></div>
        ) : links.length === 0 ? (
          <div className="drv-empty">
            No hay enlaces guardados todavía. ¡Agregá tu primera carpeta o documento!
          </div>
        ) : (
          <div className="drv-grid">
            {links.map(link => (
              <div key={link.id} className="drv-card">
                <div className="drv-card-top">
                  <div className="drv-icon">{ICONS[link.tipo] ?? "🔗"}</div>
                  <div className="drv-card-info">
                    <div className="drv-card-tipo">{TIPOS_LABEL[link.tipo] ?? link.tipo}</div>
                    <div className="drv-card-nombre">{link.nombre}</div>
                    {link.descripcion && <div className="drv-card-desc">{link.descripcion}</div>}
                  </div>
                </div>
                <div className="drv-card-footer">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="drv-btn-open"
                  >
                    ↗ Abrir en Drive
                  </a>
                  <div className="drv-card-actions">
                    <button className="drv-btn-sm drv-btn-edit" onClick={() => abrirEditar(link)}>✏ Editar</button>
                    <button className="drv-btn-sm drv-btn-del" onClick={() => eliminar(link.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) { setModal(false); setEditandoId(null); } }}>
          <div className="modal">
            <div className="modal-titulo">
              {editandoId ? "Editar" : "Agregar"} <span>enlace</span>
            </div>

            <div className="field">
              <label>Nombre *</label>
              <input
                placeholder="Ej: Contratos 2024, Planos Proyecto A..."
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>URL de Google Drive *</label>
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as DriveLink["tipo"] }))}>
                {Object.entries(TIPOS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{ICONS[k]} {v}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Descripción (opcional)</label>
              <textarea
                placeholder="Breve descripción del contenido..."
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setModal(false); setEditandoId(null); }}>Cancelar</button>
              <button className="btn-save" onClick={guardar} disabled={guardando || !form.nombre.trim() || !form.url.trim()}>
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Agregar enlace"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
