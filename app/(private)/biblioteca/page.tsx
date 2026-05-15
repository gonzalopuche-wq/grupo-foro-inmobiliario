"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface Documento {
  id: string;
  perfil_id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  nivel: string;
  origen: string;
  archivo_url: string;
  archivo_nombre: string | null;
  archivo_tipo: string | null;
  archivo_size: number | null;
  estado: string;
  descargas: number;
  nota_admin: string | null;
  creado_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
}

const CATEGORIAS = [
  "Contratos y modelos", "Honorarios", "Normativa COCIR", "Escrituración",
  "Alquileres", "Financiamiento", "Impuestos y tasas", "Marketing inmobiliario",
  "Tasación", "Loteos y subdivisiones", "Consorcios", "Capacitación",
  "Formularios", "Guías prácticas", "Otro"
];
const NIVELES = ["Inicial", "Intermedio", "Avanzado"];

const FORM_VACIO = {
  titulo: "", descripcion: "", categoria: "", nivel: "Inicial",
};

export default function BibliotecaPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok"|"err" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [filtroOrigen, setFiltroOrigen] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (perfil?.tipo === "admin" || perfil?.tipo === "master") setEsAdmin(true);
    };
    init();
    cargar();
  }, []);

  const mostrarToast = (msg: string, tipo: "ok"|"err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("biblioteca")
      .select("*, perfiles(nombre,apellido,matricula)")
      .eq("estado", "aprobado")
      .order("creado_at", { ascending: false });
    setDocumentos((data as unknown as Documento[]) ?? []);
    setLoading(false);
  };

  const subirArchivo = async () => {
    if (!archivo || !form.titulo || !form.categoria || !userId) {
      mostrarToast("Título, categoría y archivo son obligatorios", "err");
      return;
    }

    const tiposPermitidos = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!tiposPermitidos.includes(archivo.type)) {
      mostrarToast("Solo se permiten PDF, Word y Excel", "err");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (archivo.size > maxSize) {
      mostrarToast("El archivo no puede superar 10MB", "err");
      return;
    }

    setSubiendo(true);
    setProgreso(10);

    const ext = archivo.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("biblioteca")
      .upload(path, archivo, { contentType: archivo.type });

    if (uploadError) {
      mostrarToast("Error al subir el archivo", "err");
      setSubiendo(false);
      return;
    }

    setProgreso(70);

    const { data: urlData } = supabase.storage.from("biblioteca").getPublicUrl(path);

    const { error: dbError } = await supabase.from("biblioteca").insert({
      perfil_id: userId,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion || null,
      categoria: form.categoria,
      nivel: form.nivel,
      origen: "comunidad",
      archivo_url: path,
      archivo_nombre: archivo.name,
      archivo_tipo: archivo.type,
      archivo_size: archivo.size,
      estado: "pendiente",
    });

    setProgreso(100);

    if (dbError) {
      mostrarToast("Error al registrar el documento", "err");
    } else {
      mostrarToast("✅ Documento enviado. Queda pendiente de aprobación por el admin.");
      setMostrarForm(false);
      setForm(FORM_VACIO);
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = "";
    }

    setSubiendo(false);
    setProgreso(0);
  };

  const descargar = async (doc: Documento) => {
    const { data, error } = await supabase.storage.from("biblioteca").download(doc.archivo_url);
    if (error || !data) { mostrarToast("Error al descargar", "err"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.archivo_nombre ?? doc.titulo;
    a.click();
    URL.revokeObjectURL(url);
    await supabase.from("biblioteca").update({ descargas: doc.descargas + 1 }).eq("id", doc.id);
    setDocumentos(ds => ds.map(d => d.id === doc.id ? { ...d, descargas: d.descargas + 1 } : d));
  };

  const filtrados = documentos.filter(d => {
    if (filtroCategoria !== "todas" && d.categoria !== filtroCategoria) return false;
    if (filtroNivel !== "todos" && d.nivel !== filtroNivel) return false;
    if (filtroOrigen !== "todos" && d.origen !== filtroOrigen) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return d.titulo.toLowerCase().includes(q) || d.descripcion?.toLowerCase().includes(q) || d.categoria.toLowerCase().includes(q);
    }
    return true;
  });

  const categoriasUnicas = ["todas", ...Array.from(new Set(documentos.map(d => d.categoria))).sort()];

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });

  const tipoIcono = (tipo: string | null) => {
    if (!tipo) return "📄";
    if (tipo.includes("pdf")) return "📕";
    if (tipo.includes("word") || tipo.includes("document")) return "📘";
    if (tipo.includes("excel") || tipo.includes("sheet")) return "📗";
    return "📄";
  };

  const nivelColor = (nivel: string) => {
    if (nivel === "Inicial") return { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#22c55e" };
    if (nivel === "Intermedio") return { bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.25)", color: "#eab308" };
    return { bg: "rgba(200,0,0,0.1)", border: "rgba(200,0,0,0.25)", color: "#ff6666" };
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .bib-wrap { display: flex; flex-direction: column; gap: 20px; }
        .bib-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .bib-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .bib-titulo span { color: #cc0000; }
        .bib-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .bib-header-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .bib-stats { display: flex; gap: 10px; }
        .bib-stat { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 8px 14px; text-align: center; }
        .bib-stat-val { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #cc0000; }
        .bib-stat-label { font-size: 9px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; text-transform: uppercase; letter-spacing: 0.1em; }
        .bib-btn-subir { padding: 10px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .bib-btn-subir:hover { background: #e60000; }

        /* Aviso subir y ganar */
        .bib-aviso { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(200,0,0,0.05); border: 1px solid rgba(200,0,0,0.15); border-radius: 6px; }
        .bib-aviso-icon { font-size: 20px; flex-shrink: 0; }
        .bib-aviso-txt { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.5; }
        .bib-aviso-txt strong { color: #cc0000; }

        /* Filtros */
        .bib-filtros { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .bib-search { flex: 1; min-width: 200px; padding: 9px 12px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .bib-search:focus { border-color: rgba(200,0,0,0.4); }
        .bib-search::placeholder { color: rgba(255,255,255,0.2); }
        .bib-select { padding: 9px 10px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; outline: none; font-family: 'Inter',sans-serif; cursor: pointer; }
        .bib-count { font-size: 11px; color: rgba(255,255,255,0.25); white-space: nowrap; }

        /* Grid documentos */
        .bib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .bib-card { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.2s; }
        .bib-card:hover { border-color: rgba(200,0,0,0.2); }
        .bib-card-top { display: flex; gap: 12px; align-items: flex-start; }
        .bib-card-icon { font-size: 28px; flex-shrink: 0; line-height: 1; }
        .bib-card-info { flex: 1; min-width: 0; }
        .bib-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; line-height: 1.3; margin-bottom: 4px; }
        .bib-card-desc { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .bib-card-badges { display: flex; gap: 5px; flex-wrap: wrap; }
        .bib-badge { font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; }
        .bib-badge-cat { background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); color: #cc0000; }
        .bib-badge-gfi { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); color: #818cf8; }
        .bib-badge-com { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); }
        .bib-card-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .bib-card-meta { font-size: 10px; color: rgba(255,255,255,0.25); display: flex; gap: 10px; flex-wrap: wrap; }
        .bib-btn-dl { display: flex; align-items: center; gap: 6px; padding: 7px 14px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); border-radius: 3px; color: #cc0000; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .bib-btn-dl:hover { background: rgba(200,0,0,0.2); border-color: #cc0000; color: #fff; }

        /* Empty */
        .bib-empty { padding: 64px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .bib-spinner { display: flex; align-items: center; justify-content: center; padding: 64px; }
        .bib-spin { width: 28px; height: 28px; border: 2px solid rgba(200,0,0,0.2); border-top-color: #cc0000; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Modal */
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; }
        .modal { background: #0f0f0f; border: 1px solid rgba(200,0,0,0.25); border-radius: 6px; padding: 28px 30px; width: 100%; max-width: 560px; position: relative; max-height: 92vh; overflow-y: auto; }
        .modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg,transparent,#cc0000,transparent); border-radius: 6px 6px 0 0; }
        .modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .modal-titulo span { color: #cc0000; }
        .modal-sub { font-size: 12px; color: rgba(255,255,255,0.3); margin-bottom: 20px; }
        .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .field label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .field input, .field select, .field textarea { padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; transition: border-color 0.2s; width: 100%; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: rgba(200,0,0,0.4); }
        .field input::placeholder, .field textarea::placeholder { color: rgba(255,255,255,0.2); }
        .field select { background: #0f0f0f; }
        .field textarea { resize: vertical; min-height: 80px; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .file-drop { border: 2px dashed rgba(255,255,255,0.12); border-radius: 6px; padding: 24px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .file-drop:hover { border-color: rgba(200,0,0,0.35); }
        .file-drop.tiene { border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.04); }
        .file-drop-txt { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 6px; }
        .file-drop-nombre { font-size: 12px; color: #22c55e; font-weight: 600; margin-top: 6px; }
        .file-tipos { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 4px; }
        .progreso-wrap { margin: 12px 0; }
        .progreso-bar { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
        .progreso-fill { height: 100%; background: #cc0000; border-radius: 2px; transition: width 0.3s; }
        .progreso-txt { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 4px; text-align: right; }
        .modal-nota { font-size: 11px; color: rgba(255,255,255,0.25); line-height: 1.6; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 4px; border: 1px solid rgba(255,255,255,0.07); margin-bottom: 16px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); }
        .btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .btn-save { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .btn-save:hover:not(:disabled) { background: #e60000; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; z-index: 999; animation: toastIn 0.3s ease; max-width: 360px; line-height: 1.4; }
        .toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; }
        .toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media(max-width:600px) { .bib-grid { grid-template-columns: 1fr; } .field-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="bib-wrap">
        {/* Header */}
        <div className="bib-header">
          <div>
            <div className="bib-titulo">Biblioteca del <span>Corredor</span></div>
            <div className="bib-sub">Documentos oficiales GFI® y aportes de la comunidad</div>
          </div>
          <div className="bib-header-right">
            <div className="bib-stats">
              <div className="bib-stat">
                <div className="bib-stat-val">{documentos.length}</div>
                <div className="bib-stat-label">Documentos</div>
              </div>
              <div className="bib-stat">
                <div className="bib-stat-val">{documentos.reduce((s,d) => s + d.descargas, 0)}</div>
                <div className="bib-stat-label">Descargas</div>
              </div>
            </div>
            <Link href="/biblioteca/drive" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "rgba(255,255,255,0.6)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", whiteSpace: "nowrap" }}>
              📁 Google Drive
            </Link>
            <button className="bib-btn-subir" onClick={() => setMostrarForm(true)}>
              ↑ Subir documento
            </button>
          </div>
        </div>

        {/* Aviso Subir & Ganar */}
        <div className="bib-aviso">
          <div className="bib-aviso-icon">🏆</div>
          <div className="bib-aviso-txt">
            <strong>Subir & Ganar:</strong> Cada documento que subás y sea aprobado por el admin te genera un descuento en tu suscripción mensual. El admin define el monto de bonificación.
          </div>
        </div>

        {/* Filtros */}
        <div className="bib-filtros">
          <input className="bib-search" placeholder="Buscar por título, descripción o categoría..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
          <select className="bib-select" value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)}>
            {categoriasUnicas.map(c=><option key={c} value={c}>{c==="todas"?"Todas las categorías":c}</option>)}
          </select>
          <select className="bib-select" value={filtroNivel} onChange={e=>setFiltroNivel(e.target.value)}>
            <option value="todos">Todos los niveles</option>
            {NIVELES.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          <select className="bib-select" value={filtroOrigen} onChange={e=>setFiltroOrigen(e.target.value)}>
            <option value="todos">Todos los orígenes</option>
            <option value="gfi">GFI Oficial</option>
            <option value="comunidad">Comunidad</option>
          </select>
          <span className="bib-count">{filtrados.length} documento{filtrados.length!==1?"s":""}</span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="bib-spinner"><div className="bib-spin"/></div>
        ) : filtrados.length === 0 ? (
          <div className="bib-empty">
            {documentos.length === 0
              ? "Todavía no hay documentos aprobados. ¡Sé el primero en aportar!"
              : "No hay documentos con ese filtro."}
          </div>
        ) : (
          <div className="bib-grid">
            {filtrados.map(d => {
              const nc = nivelColor(d.nivel);
              return (
                <div key={d.id} className="bib-card">
                  <div className="bib-card-top">
                    <div className="bib-card-icon">{tipoIcono(d.archivo_tipo)}</div>
                    <div className="bib-card-info">
                      <div className="bib-card-titulo">{d.titulo}</div>
                      {d.descripcion && <div className="bib-card-desc">{d.descripcion}</div>}
                    </div>
                  </div>
                  <div className="bib-card-badges">
                    <span className="bib-badge bib-badge-cat">{d.categoria}</span>
                    <span className="bib-badge" style={{background:nc.bg,border:`1px solid ${nc.border}`,color:nc.color}}>{d.nivel}</span>
                    <span className={`bib-badge ${d.origen==="gfi"?"bib-badge-gfi":"bib-badge-com"}`}>
                      {d.origen==="gfi"?"✓ GFI Oficial":"Comunidad"}
                    </span>
                  </div>
                  <div className="bib-card-footer">
                    <div className="bib-card-meta">
                      {d.archivo_size && <span>{formatSize(d.archivo_size)}</span>}
                      <span>↓ {d.descargas}</span>
                      <span>{formatFecha(d.creado_at)}</span>
                      {d.perfiles && <span>{d.perfiles.apellido}, {d.perfiles.nombre}</span>}
                    </div>
                    <button className="bib-btn-dl" onClick={()=>descargar(d)}>
                      ↓ Descargar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL SUBIR */}
      {mostrarForm && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setMostrarForm(false);}}}>
          <div className="modal">
            <div className="modal-titulo">Subir <span>documento</span></div>
            <div className="modal-sub">Tu documento quedará pendiente de revisión por el admin antes de publicarse.</div>

            <div className="field">
              <label>Título *</label>
              <input placeholder="Ej: Modelo contrato alquiler con índice ICL" value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea placeholder="Breve descripción del contenido y para qué sirve..." value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} />
            </div>
            <div className="field-grid">
              <div className="field">
                <label>Categoría *</label>
                <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
                  <option value="">Seleccioná</option>
                  {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Nivel</label>
                <select value={form.nivel} onChange={e=>setForm(f=>({...f,nivel:e.target.value}))}>
                  {NIVELES.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Archivo * (PDF, Word o Excel · máx 10MB)</label>
              <div className={`file-drop${archivo?" tiene":""}`} onClick={()=>fileRef.current?.click()}>
                <div style={{fontSize:28}}>{archivo ? tipoIcono(archivo.type) : "📁"}</div>
                {archivo ? (
                  <>
                    <div className="file-drop-nombre">{archivo.name}</div>
                    <div className="file-tipos">{formatSize(archivo.size)}</div>
                  </>
                ) : (
                  <>
                    <div className="file-drop-txt">Hacé click para seleccionar un archivo</div>
                    <div className="file-tipos">PDF, Word (.doc, .docx), Excel (.xls, .xlsx)</div>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                style={{display:"none"}}
                onChange={e=>setArchivo(e.target.files?.[0]??null)}
              />
            </div>

            {subiendo && (
              <div className="progreso-wrap">
                <div className="progreso-bar"><div className="progreso-fill" style={{width:`${progreso}%`}}/></div>
                <div className="progreso-txt">{progreso}%</div>
              </div>
            )}

            <div className="modal-nota">
              🏆 <strong style={{color:"rgba(255,255,255,0.5)"}}>Subir & Ganar:</strong> Si tu documento es aprobado, recibís un descuento en tu próxima suscripción. El admin define el monto.
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>{setMostrarForm(false);setForm(FORM_VACIO);setArchivo(null);}}>Cancelar</button>
              <button className="btn-save" onClick={subirArchivo} disabled={subiendo||!form.titulo||!form.categoria||!archivo}>
                {subiendo?"Subiendo...":"Enviar para revisión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
