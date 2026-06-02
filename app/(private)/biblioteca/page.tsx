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
    if (nivel === "Inicial") return { bg: "rgba(10,61,46,0.4)", border: "rgba(58,186,182,0.25)", color: "var(--gfi-green-text)" };
    if (nivel === "Intermedio") return { bg: "var(--gfi-orange-soft)", border: "var(--gfi-orange-border)", color: "#d4960c" };
    return { bg: "var(--gfi-red-soft)", border: "var(--gfi-red-border)", color: "var(--gfi-red)" };
  };

  return (
    <>
      <style>{`
        .bib-wrap { display: flex; flex-direction: column; gap: 20px; }
        .bib-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .bib-titulo { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--gfi-text-primary); }
        .bib-titulo span { color: var(--gfi-red); }
        .bib-sub { font-size: 13px; color: var(--gfi-text-secondary); margin-top: 4px; }
        .bib-header-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .bib-stats { display: flex; gap: 10px; }
        .bib-stat { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); padding: 8px 16px; text-align: center; }
        .bib-stat-val { font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--gfi-red); font-variant-numeric: tabular-nums; }
        .bib-stat-label { font-size: 9px; color: var(--gfi-text-muted); font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.12em; margin-top: 2px; }
        .bib-btn-subir { padding: 10px 20px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-md); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; box-shadow: var(--gfi-shadow-red); transition: var(--gfi-transition); }
        .bib-btn-subir:hover { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }

        .bib-aviso { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-md); }
        .bib-aviso-icon { font-size: 20px; flex-shrink: 0; }
        .bib-aviso-txt { font-size: 12px; color: var(--gfi-text-secondary); line-height: 1.5; }
        .bib-aviso-txt strong { color: var(--gfi-red); }

        .bib-filtros { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .bib-search { flex: 1; min-width: 200px; padding: 9px 12px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); }
        .bib-search:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .bib-search::placeholder { color: var(--gfi-text-muted); }
        .bib-select { padding: 9px 10px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-secondary); font-size: 12px; outline: none; font-family: var(--font-body); cursor: pointer; transition: var(--gfi-transition); }
        .bib-select:focus { border-color: var(--gfi-red); }
        .bib-count { font-size: 11px; color: var(--gfi-text-muted); white-space: nowrap; font-family: var(--font-mono); }

        .bib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .bib-card { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; transition: var(--gfi-transition); position: relative; overflow: hidden; }
        .bib-card::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,0.012) 0%, transparent 60%); pointer-events: none; }
        .bib-card:hover { border-color: var(--gfi-red-border); box-shadow: var(--gfi-shadow-md); }
        .bib-card-top { display: flex; gap: 12px; align-items: flex-start; }
        .bib-card-icon { font-size: 28px; flex-shrink: 0; line-height: 1; }
        .bib-card-info { flex: 1; min-width: 0; }
        .bib-card-titulo { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--gfi-text-primary); line-height: 1.3; margin-bottom: 4px; }
        .bib-card-desc { font-size: 11px; color: var(--gfi-text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .bib-card-badges { display: flex; gap: 5px; flex-wrap: wrap; }
        .bib-badge { font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; }
        .bib-badge-cat { background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); color: var(--gfi-red); }
        .bib-badge-gfi { background: rgba(255,255,255,0.06); border: 1px solid var(--gfi-border); color: var(--gfi-text-secondary); }
        .bib-badge-com { background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border-subtle); color: var(--gfi-text-muted); }
        .bib-card-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .bib-card-meta { font-size: 10px; color: var(--gfi-text-muted); display: flex; gap: 10px; flex-wrap: wrap; font-family: var(--font-mono); }
        .bib-btn-dl { display: flex; align-items: center; gap: 6px; padding: 7px 14px; background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-md); color: var(--gfi-red); font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .bib-btn-dl:hover { background: rgba(153,0,0,0.18); border-color: var(--gfi-red); color: #fff; }

        .bib-empty { padding: 64px; text-align: center; color: var(--gfi-text-muted); font-size: 13px; background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); }
        .bib-spinner { display: flex; align-items: center; justify-content: center; padding: 64px; }
        .bib-spin { width: 28px; height: 28px; border: 2px solid var(--gfi-red-soft); border-top-color: var(--gfi-red); border-radius: 50%; animation: gfi-spin 0.7s linear infinite; }

        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; }
        .modal { background: var(--gfi-bg-panel); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-lg); padding: 28px 30px; width: 100%; max-width: 560px; position: relative; max-height: 92vh; overflow-y: auto; box-shadow: var(--gfi-shadow-lg); }
        .modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--gfi-red), transparent); border-radius: var(--gfi-radius-lg) var(--gfi-radius-lg) 0 0; }
        .modal-titulo { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--gfi-text-primary); margin-bottom: 6px; }
        .modal-titulo span { color: var(--gfi-red); }
        .modal-sub { font-size: 12px; color: var(--gfi-text-secondary); margin-bottom: 20px; }
        .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .field label { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-muted); }
        .field input, .field select, .field textarea { padding: 9px 12px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); width: 100%; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .field input::placeholder, .field textarea::placeholder { color: var(--gfi-text-muted); }
        .field select { background: var(--gfi-bg-input); }
        .field textarea { resize: vertical; min-height: 80px; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .file-drop { border: 2px dashed var(--gfi-border); border-radius: var(--gfi-radius-md); padding: 24px; text-align: center; cursor: pointer; transition: var(--gfi-transition); }
        .file-drop:hover { border-color: var(--gfi-red-border); }
        .file-drop.tiene { border-color: rgba(58,186,182,0.35); background: var(--gfi-green-soft); }
        .file-drop-txt { font-size: 13px; color: var(--gfi-text-secondary); margin-top: 6px; }
        .file-drop-nombre { font-size: 12px; color: var(--gfi-green-text); font-weight: 600; margin-top: 6px; }
        .file-tipos { font-size: 10px; color: var(--gfi-text-muted); margin-top: 4px; }
        .progreso-wrap { margin: 12px 0; }
        .progreso-bar { height: 4px; background: var(--gfi-border); border-radius: 2px; overflow: hidden; }
        .progreso-fill { height: 100%; background: var(--gfi-red); border-radius: 2px; transition: width 0.3s; }
        .progreso-txt { font-size: 11px; color: var(--gfi-text-secondary); margin-top: 4px; text-align: right; }
        .modal-nota { font-size: 11px; color: var(--gfi-text-secondary); line-height: 1.6; padding: 10px 12px; background: var(--gfi-bg-secondary); border-radius: var(--gfi-radius-md); border: 1px solid var(--gfi-border); margin-bottom: 16px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid var(--gfi-border-subtle); }
        .btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .btn-cancel:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .btn-save { padding: 9px 22px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-md); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: var(--gfi-shadow-red); transition: var(--gfi-transition); }
        .btn-save:hover:not(:disabled) { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: var(--gfi-radius-md); font-family: var(--font-display); font-size: 12px; font-weight: 700; z-index: 999; animation: gfi-fade-in 0.3s ease; max-width: 360px; line-height: 1.4; }
        .toast.ok { background: rgba(10,61,46,0.6); border: 1px solid rgba(58,186,182,0.35); color: var(--gfi-green-text); }
        .toast.err { background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); color: #ff6666; }
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
            <Link href="/biblioteca/drive" className="gfi-btn gfi-btn--secondary">
              Google Drive
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
              🏆 <strong style={{color:"var(--gfi-text-secondary)"}}>Subir & Ganar:</strong> Si tu documento es aprobado, recibís un descuento en tu próxima suscripción. El admin define el monto.
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
