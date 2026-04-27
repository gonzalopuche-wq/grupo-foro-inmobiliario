"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Propiedad {
  id: string;
  perfil_id: string;
  codigo: string | null;
  titulo: string;
  descripcion: string | null;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string;
  ciudad: string | null;
  zona: string | null;
  direccion: string | null;
  dormitorios: number | null;
  banos: number | null;
  superficie_cubierta: number | null;
  superficie_total: number | null;
  antiguedad: string | null;
  apto_credito: boolean;
  con_cochera: boolean;
  amenities: string[] | null;
  fotos: string[] | null;
  video_url: string | null;
  estado: string;
  destacada_web: boolean;
  publicada_web: boolean;
  created_at: string;
  updated_at: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────
const OPERACIONES = ["Venta", "Alquiler", "Alquiler temporal"];
const TIPOS = ["Departamento", "Casa", "PH", "Local", "Oficina", "Terreno", "Cochera", "Galpon", "Otro"];
const ESTADOS = [
  { value: "activa", label: "ACTIVA", color: "#22c55e" },
  { value: "reservada", label: "RESERVADA", color: "#f59e0b" },
  { value: "vendida", label: "VENDIDA", color: "#6b7280" },
  { value: "pausada", label: "PAUSADA", color: "#ef4444" },
];
const ANTIGUEDADES = ["A estrenar", "Menos de 5 años", "5-10 años", "10-20 años", "Más de 20 años"];

const FORM_VACIO = {
  titulo: "", descripcion: "", operacion: "Venta", tipo: "Departamento",
  precio: "", moneda: "USD", ciudad: "Rosario", zona: "", direccion: "",
  dormitorios: "", banos: "", superficie_cubierta: "", superficie_total: "",
  antiguedad: "", apto_credito: false, con_cochera: false,
  amenities: "", video_url: "", estado: "activa",
};

const fmt = (n: number | null) => n ? n.toLocaleString("es-AR") : "-";
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

// ── Componente principal ───────────────────────────────────────────────────
export default function CarteraPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroOp, setFiltroOp] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Modal
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(FORM_VACIO);

  // Selección múltiple
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      cargar(data.user.id);
    };
    init();
  }, []);

  const cargar = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("cartera_propiedades")
      .select("*")
      .eq("perfil_id", uid)
      .order("updated_at", { ascending: false });
    setPropiedades((data as Propiedad[]) ?? []);
    setLoading(false);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const abrirNueva = () => { setEditandoId(null); setForm(FORM_VACIO); setMostrarForm(true); };

  const abrirEditar = (p: Propiedad) => {
    setEditandoId(p.id);
    setForm({
      titulo: p.titulo, descripcion: p.descripcion ?? "",
      operacion: p.operacion, tipo: p.tipo,
      precio: p.precio?.toString() ?? "", moneda: p.moneda,
      ciudad: p.ciudad ?? "Rosario", zona: p.zona ?? "", direccion: p.direccion ?? "",
      dormitorios: p.dormitorios?.toString() ?? "", banos: p.banos?.toString() ?? "",
      superficie_cubierta: p.superficie_cubierta?.toString() ?? "",
      superficie_total: p.superficie_total?.toString() ?? "",
      antiguedad: p.antiguedad ?? "", apto_credito: p.apto_credito,
      con_cochera: p.con_cochera, amenities: (p.amenities ?? []).join(", "),
      video_url: p.video_url ?? "", estado: p.estado,
    });
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!userId || !form.titulo) return;
    setGuardando(true);
    const amenitiesArr = form.amenities.split(",").map((a: string) => a.trim()).filter(Boolean);
    const datos = {
      perfil_id: userId,
      titulo: form.titulo, descripcion: form.descripcion || null,
      operacion: form.operacion, tipo: form.tipo,
      precio: form.precio ? parseFloat(form.precio) : null, moneda: form.moneda,
      ciudad: form.ciudad || null, zona: form.zona || null, direccion: form.direccion || null,
      dormitorios: form.dormitorios ? parseInt(form.dormitorios) : null,
      banos: form.banos ? parseInt(form.banos) : null,
      superficie_cubierta: form.superficie_cubierta ? parseFloat(form.superficie_cubierta) : null,
      superficie_total: form.superficie_total ? parseFloat(form.superficie_total) : null,
      antiguedad: form.antiguedad || null,
      apto_credito: form.apto_credito, con_cochera: form.con_cochera,
      amenities: amenitiesArr.length > 0 ? amenitiesArr : null,
      video_url: form.video_url || null, estado: form.estado,
      updated_at: new Date().toISOString(),
    };
    if (editandoId) {
      await supabase.from("cartera_propiedades").update(datos).eq("id", editandoId);
    } else {
      await supabase.from("cartera_propiedades").insert(datos);
    }
    setGuardando(false); setMostrarForm(false);
    if (userId) cargar(userId);
  };

  const cambiarEstado = async (id: string, estado: string) => {
    await supabase.from("cartera_propiedades").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
    if (userId) cargar(userId);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta propiedad? También se eliminará del MIR.")) return;
    await supabase.from("cartera_propiedades").delete().eq("id", id);
    setSeleccionadas(prev => { const s = new Set(prev); s.delete(id); return s; });
    if (userId) cargar(userId);
  };

  const toggleSeleccion = (id: string) => {
    setSeleccionadas(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleTodas = () => {
    if (seleccionadas.size === filtradas.length) { setSeleccionadas(new Set()); }
    else { setSeleccionadas(new Set(filtradas.map(p => p.id))); }
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => propiedades.filter(p => {
    if (filtroOp && p.operacion !== filtroOp) return false;
    if (filtroTipo && p.tipo !== filtroTipo) return false;
    if (filtroEstado && p.estado !== filtroEstado) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return p.titulo?.toLowerCase().includes(q) || p.direccion?.toLowerCase().includes(q) || p.zona?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q);
    }
    return true;
  }), [propiedades, filtroOp, filtroTipo, filtroEstado, busqueda]);

  const estadoInfo = (e: string) => ESTADOS.find(x => x.value === e) ?? { value: e, label: e.toUpperCase(), color: "#6b7280" };
  const tieneActivas = propiedades.filter(p => p.estado === "activa").length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');

        .cart-root { display: flex; flex-direction: column; gap: 0; background: #080808; min-height: calc(100vh - 70px); }

        /* ── Header ── */
        .cart-header { padding: 18px 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 0; }
        .cart-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .cart-titulo span { color: #cc0000; }
        .cart-stats { display: flex; gap: 16px; }
        .cart-stat { display: flex; flex-direction: column; align-items: center; }
        .cart-stat-val { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .cart-stat-label { font-size: 9px; color: rgba(255,255,255,0.25); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .cart-btn-nueva { padding: 9px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: background 0.15s; }
        .cart-btn-nueva:hover { background: #e60000; }

        /* ── Toolbar ── */
        .cart-toolbar { padding: 12px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .cart-search-wrap { position: relative; }
        .cart-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: rgba(255,255,255,0.2); pointer-events: none; }
        .cart-search { padding: 8px 10px 8px 28px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter',sans-serif; width: 220px; }
        .cart-search:focus { border-color: rgba(200,0,0,0.35); }
        .cart-search::placeholder { color: rgba(255,255,255,0.2); }
        .cart-select { padding: 7px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; font-family: 'Inter',sans-serif; outline: none; cursor: pointer; }
        .cart-select:focus { border-color: rgba(200,0,0,0.35); }
        .cart-count { font-size: 11px; color: rgba(255,255,255,0.25); font-family: 'Inter',sans-serif; margin-left: auto; }
        .cart-sel-bar { padding: 8px 12px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 4px; display: flex; align-items: center; gap: 10px; font-size: 11px; color: rgba(255,255,255,0.6); font-family: 'Inter',sans-serif; }

        /* ── Lista ── */
        .cart-lista { display: flex; flex-direction: column; gap: 6px; padding: 14px 0; }

        /* ── Card estilo KiteProp ── */
        .cart-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px; display: flex; gap: 0; overflow: hidden; transition: border-color 0.12s; }
        .cart-card:hover { border-color: rgba(255,255,255,0.13); }
        .cart-card.seleccionada { border-color: rgba(200,0,0,0.35); background: rgba(200,0,0,0.03); }

        /* Check */
        .cart-card-check { width: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .cart-checkbox { width: 16px; height: 16px; border-radius: 4px; border: 2px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; transition: all 0.12s; cursor: pointer; }
        .cart-checkbox.marcado { background: #cc0000; border-color: #cc0000; }

        /* Foto */
        .cart-card-foto { width: 140px; flex-shrink: 0; position: relative; background: rgba(255,255,255,0.03); overflow: hidden; }
        .cart-card-foto img { width: 100%; height: 100%; object-fit: cover; }
        .cart-card-foto-empty { width: 100%; height: 100%; min-height: 110px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: rgba(255,255,255,0.08); }
        .cart-estado-badge { position: absolute; top: 8px; left: 8px; padding: 3px 7px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 800; letter-spacing: 0.1em; color: #000; }
        .cart-destacada-badge { position: absolute; top: 8px; right: 8px; padding: 3px 7px; border-radius: 3px; background: #f59e0b; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 800; color: #000; }

        /* Info */
        .cart-card-info { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .cart-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .cart-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
        .cart-card-titulo:hover { color: #cc0000; }
        .cart-card-tipo { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .cart-card-precio { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; white-space: nowrap; }
        .cart-card-precio-op { font-size: 9px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; font-weight: 700; text-transform: uppercase; }
        .cart-card-meta { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
        .cart-meta-item { font-size: 11px; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 4px; font-family: 'Inter',sans-serif; }
        .cart-meta-ico { font-size: 12px; }
        .cart-card-dir { font-size: 11px; color: rgba(255,255,255,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cart-card-chips { display: flex; gap: 5px; flex-wrap: wrap; }
        .cart-chip { font-size: 9px; padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .cart-chip-verde { border-color: rgba(34,197,94,0.3); color: rgba(34,197,94,0.7); }
        .cart-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
        .cart-card-codigo { font-size: 9px; color: rgba(255,255,255,0.2); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; }
        .cart-card-fecha { font-size: 9px; color: rgba(255,255,255,0.18); }
        .cart-mir-badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); color: rgba(200,0,0,0.7); font-family: 'Montserrat',sans-serif; font-weight: 700; }

        /* Acciones */
        .cart-card-acciones { width: 110px; flex-shrink: 0; padding: 12px 10px; display: flex; flex-direction: column; gap: 5px; border-left: 1px solid rgba(255,255,255,0.05); }
        .cart-acc-btn { padding: 5px 8px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; text-align: center; transition: all 0.12s; width: 100%; }
        .cart-acc-editar { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.45); }
        .cart-acc-editar:hover { background: rgba(255,255,255,0.08); }
        .cart-acc-estado { background: transparent; border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); }
        .cart-acc-estado:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.5); }
        .cart-acc-eliminar { background: transparent; border: 1px solid rgba(200,0,0,0.15); color: rgba(200,0,0,0.4); }
        .cart-acc-eliminar:hover { background: rgba(200,0,0,0.08); }
        .cart-estado-select { width: 100%; padding: 4px 6px; background: rgba(12,12,12,0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; color: rgba(255,255,255,0.5); font-size: 9px; font-family: 'Montserrat',sans-serif; outline: none; cursor: pointer; }

        /* ── Empty ── */
        .cart-empty { padding: 60px 20px; text-align: center; color: rgba(255,255,255,0.18); font-family: 'Inter',sans-serif; font-size: 13px; line-height: 1.8; }
        .cart-empty-ico { font-size: 36px; margin-bottom: 12px; }

        /* ── Modal ── */
        .cart-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: flex-start; justify-content: center; z-index: 300; padding: 20px; overflow-y: auto; }
        .cart-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.22); border-radius: 8px; padding: 26px 30px; width: 100%; max-width: 620px; margin: auto; position: relative; }
        .cart-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 8px 8px 0 0; }
        .cart-modal-titulo { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 18px; }
        .cart-modal-titulo span { color: #cc0000; }
        .cart-field { margin-bottom: 11px; }
        .cart-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .cart-input { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; box-sizing: border-box; transition: border-color 0.18s; }
        .cart-input:focus { border-color: rgba(200,0,0,0.45); }
        .cart-input::placeholder { color: rgba(255,255,255,0.18); }
        .cart-select-modal { width: 100%; padding: 8px 11px; background: rgba(12,12,12,0.95); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .cart-textarea { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: #fff; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; resize: none; box-sizing: border-box; }
        .cart-textarea:focus { border-color: rgba(200,0,0,0.45); }
        .cart-textarea::placeholder { color: rgba(255,255,255,0.18); }
        .cart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cart-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .cart-divider { height: 1px; background: rgba(255,255,255,0.065); margin: 12px 0; }
        .cart-section-label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.18); margin-bottom: 9px; }
        .cart-check-row { display: flex; gap: 16px; flex-wrap: wrap; }
        .cart-check-item { display: flex; align-items: center; gap: 7px; cursor: pointer; }
        .cart-check-box { width: 16px; height: 16px; border-radius: 3px; border: 2px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.12s; }
        .cart-check-box.on { background: #cc0000; border-color: #cc0000; }
        .cart-check-label { font-size: 12px; color: rgba(255,255,255,0.55); font-family: 'Inter',sans-serif; }
        .cart-modal-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 18px; }
        .cart-btn-cancel { padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.13); border-radius: 3px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .cart-btn-save { padding: 8px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .cart-btn-save:disabled { opacity: 0.45; cursor: not-allowed; }
        .cart-spinner { display: inline-block; width: 9px; height: 9px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cart-mir-info { background: rgba(200,0,0,0.05); border: 1px solid rgba(200,0,0,0.15); border-radius: 5px; padding: 10px 12px; font-size: 11px; color: rgba(255,255,255,0.45); font-family: 'Inter',sans-serif; line-height: 1.5; margin-bottom: 14px; }
        .cart-mir-info strong { color: rgba(200,0,0,0.8); }

        @media (max-width: 768px) {
          .cart-card-foto { width: 90px; }
          .cart-card-acciones { width: 80px; }
          .cart-card-precio { font-size: 13px; }
        }
      `}</style>

      <div className="cart-root">

        {/* Header */}
        <div className="cart-header">
          <div>
            <div className="cart-titulo">Cartera <span>de Propiedades</span></div>
          </div>
          <div className="cart-stats">
            <div className="cart-stat"><span className="cart-stat-val">{propiedades.length}</span><span className="cart-stat-label">Total</span></div>
            <div className="cart-stat"><span className="cart-stat-val" style={{color:"#22c55e"}}>{tieneActivas}</span><span className="cart-stat-label">Activas</span></div>
            <div className="cart-stat"><span className="cart-stat-val" style={{color:"#cc0000"}}>{tieneActivas}</span><span className="cart-stat-label">En MIR</span></div>
          </div>
          <button className="cart-btn-nueva" onClick={abrirNueva}>+ Nueva propiedad</button>
        </div>

        {/* Toolbar */}
        <div className="cart-toolbar">
          <div className="cart-search-wrap">
            <span className="cart-search-ico">🔍</span>
            <input className="cart-search" placeholder="Buscar por título, dirección, zona..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <select className="cart-select" value={filtroOp} onChange={e => setFiltroOp(e.target.value)}>
            <option value="">Tipo de operación</option>
            {OPERACIONES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className="cart-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Tipo de propiedad</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="cart-select" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Estado</option>
            {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(filtroOp || filtroTipo || filtroEstado || busqueda) && (
            <button style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:11,fontFamily:"Inter,sans-serif"}} onClick={() => { setBusqueda(""); setFiltroOp(""); setFiltroTipo(""); setFiltroEstado(""); }}>✕ Limpiar</button>
          )}
          <span className="cart-count">{filtradas.length} propiedad{filtradas.length !== 1 ? "es" : ""}</span>
        </div>

        {/* Barra selección */}
        {seleccionadas.size > 0 && (
          <div className="cart-sel-bar">
            <span>{seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? "s" : ""}</span>
            <button style={{background:"rgba(200,0,0,0.08)",border:"1px solid rgba(200,0,0,0.2)",borderRadius:3,padding:"3px 10px",color:"rgba(200,0,0,0.7)",cursor:"pointer",fontSize:9,fontFamily:"Montserrat,sans-serif",fontWeight:700}} onClick={() => setSeleccionadas(new Set())}>Deseleccionar</button>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="cart-empty"><div className="cart-empty-ico">⏳</div>Cargando propiedades...</div>
        ) : filtradas.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-ico">🏠</div>
            {propiedades.length === 0 ? "No tenés propiedades en tu cartera.\nHacé clic en + Nueva propiedad para agregar una." : "Sin resultados para los filtros aplicados."}
          </div>
        ) : (
          <div className="cart-lista">
            {/* Header selección */}
            <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:8,marginBottom:2}}>
              <div className={`cart-checkbox${seleccionadas.size === filtradas.length && filtradas.length > 0 ? " marcado" : ""}`} onClick={toggleTodas}>
                {seleccionadas.size === filtradas.length && filtradas.length > 0 && <span style={{fontSize:9,color:"#fff"}}>✓</span>}
              </div>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:"Inter,sans-serif"}}>Seleccionar todas</span>
            </div>

            {filtradas.map(p => {
              const est = estadoInfo(p.estado);
              const foto = (p.fotos ?? [])[0];
              const sel = seleccionadas.has(p.id);
              return (
                <div key={p.id} className={`cart-card${sel ? " seleccionada" : ""}`}>

                  {/* Check */}
                  <div className="cart-card-check" onClick={() => toggleSeleccion(p.id)}>
                    <div className={`cart-checkbox${sel ? " marcado" : ""}`}>
                      {sel && <span style={{fontSize:9,color:"#fff"}}>✓</span>}
                    </div>
                  </div>

                  {/* Foto */}
                  <div className="cart-card-foto">
                    {foto
                      ? <img src={foto} alt={p.titulo} style={{minHeight:110}} />
                      : <div className="cart-card-foto-empty">🏠</div>
                    }
                    <div className="cart-estado-badge" style={{background: est.color}}>{est.label}</div>
                    {p.destacada_web && <div className="cart-destacada-badge">Destacada Web</div>}
                  </div>

                  {/* Info */}
                  <div className="cart-card-info">
                    <div className="cart-card-top">
                      <div style={{flex:1,minWidth:0}}>
                        <div className="cart-card-titulo" onClick={() => abrirEditar(p)}>{p.titulo}</div>
                        <div className="cart-card-tipo">{p.tipo} · {p.zona ?? p.ciudad ?? "Rosario"}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div className="cart-card-precio-op">{p.operacion}</div>
                        <div className="cart-card-precio">{p.moneda} {fmt(p.precio)}</div>
                      </div>
                    </div>

                    {p.direccion && <div className="cart-card-dir">📍 {p.direccion}</div>}

                    <div className="cart-card-meta">
                      {p.dormitorios != null && <span className="cart-meta-item"><span className="cart-meta-ico">🛏</span>{p.dormitorios} dorm.</span>}
                      {p.banos != null && <span className="cart-meta-item"><span className="cart-meta-ico">🚿</span>{p.banos} baños</span>}
                      {p.superficie_cubierta != null && <span className="cart-meta-item"><span className="cart-meta-ico">📐</span>{p.superficie_cubierta} m² cub.</span>}
                      {p.superficie_total != null && <span className="cart-meta-item">{p.superficie_total} m² total</span>}
                      {p.antiguedad && <span className="cart-meta-item">{p.antiguedad}</span>}
                    </div>

                    <div className="cart-card-chips">
                      {p.apto_credito && <span className="cart-chip cart-chip-verde">Apto crédito</span>}
                      {p.con_cochera && <span className="cart-chip cart-chip-verde">Cochera</span>}
                      {(p.amenities ?? []).slice(0, 3).map(a => <span key={a} className="cart-chip">{a}</span>)}
                    </div>

                    <div className="cart-card-footer">
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        {p.codigo && <span className="cart-card-codigo">{p.codigo}</span>}
                        <span className="cart-card-fecha">Actualizada {formatFecha(p.updated_at)}</span>
                      </div>
                      {p.estado === "activa" && (
                        <span className="cart-mir-badge">🔄 En MIR</span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="cart-card-acciones">
                    <button className="cart-acc-btn cart-acc-editar" onClick={() => abrirEditar(p)}>Editar</button>
                    <select
                      className="cart-estado-select"
                      value={p.estado}
                      onChange={e => cambiarEstado(p.id, e.target.value)}
                    >
                      {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button className="cart-acc-btn cart-acc-eliminar" onClick={() => eliminar(p.id)}>Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal nueva/editar propiedad ── */}
      {mostrarForm && (
        <div className="cart-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="cart-modal">
            <div className="cart-modal-titulo">{editandoId ? "Editar" : "Nueva"} <span>propiedad</span></div>

            {!editandoId && (
              <div className="cart-mir-info">
                <strong>🔄 Se publicará automáticamente en el MIR</strong> como ofrecido tuyo en la red. Podés pausarla después si querés.
              </div>
            )}

            <div className="cart-section-label">Datos principales</div>
            <div className="cart-field"><label className="cart-label">Título *</label><input className="cart-input" value={form.titulo} onChange={e => setForm((p: any) => ({...p, titulo: e.target.value}))} placeholder="Ej: Departamento 3 amb. con balcón - Fisherton" /></div>

            <div className="cart-row">
              <div className="cart-field"><label className="cart-label">Operación</label>
                <select className="cart-select-modal" value={form.operacion} onChange={e => setForm((p: any) => ({...p, operacion: e.target.value}))}>
                  {OPERACIONES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="cart-field"><label className="cart-label">Tipo de propiedad</label>
                <select className="cart-select-modal" value={form.tipo} onChange={e => setForm((p: any) => ({...p, tipo: e.target.value}))}>
                  {TIPOS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="cart-row">
              <div className="cart-field"><label className="cart-label">Precio</label><input className="cart-input" type="number" value={form.precio} onChange={e => setForm((p: any) => ({...p, precio: e.target.value}))} placeholder="180000" /></div>
              <div className="cart-field"><label className="cart-label">Moneda</label>
                <select className="cart-select-modal" value={form.moneda} onChange={e => setForm((p: any) => ({...p, moneda: e.target.value}))}>
                  <option>USD</option><option>ARS</option>
                </select>
              </div>
            </div>

            <div className="cart-divider" />
            <div className="cart-section-label">Ubicación</div>
            <div className="cart-row">
              <div className="cart-field"><label className="cart-label">Ciudad</label><input className="cart-input" value={form.ciudad} onChange={e => setForm((p: any) => ({...p, ciudad: e.target.value}))} placeholder="Rosario" /></div>
              <div className="cart-field"><label className="cart-label">Zona / Barrio</label><input className="cart-input" value={form.zona} onChange={e => setForm((p: any) => ({...p, zona: e.target.value}))} placeholder="Fisherton, Palermo..." /></div>
            </div>
            <div className="cart-field"><label className="cart-label">Dirección</label><input className="cart-input" value={form.direccion} onChange={e => setForm((p: any) => ({...p, direccion: e.target.value}))} placeholder="Av. Pellegrini 1200" /></div>

            <div className="cart-divider" />
            <div className="cart-section-label">Características</div>
            <div className="cart-row-3">
              <div className="cart-field"><label className="cart-label">Dormitorios</label><input className="cart-input" type="number" value={form.dormitorios} onChange={e => setForm((p: any) => ({...p, dormitorios: e.target.value}))} placeholder="3" /></div>
              <div className="cart-field"><label className="cart-label">Baños</label><input className="cart-input" type="number" value={form.banos} onChange={e => setForm((p: any) => ({...p, banos: e.target.value}))} placeholder="2" /></div>
              <div className="cart-field"><label className="cart-label">Sup. cubierta m²</label><input className="cart-input" type="number" value={form.superficie_cubierta} onChange={e => setForm((p: any) => ({...p, superficie_cubierta: e.target.value}))} placeholder="85" /></div>
            </div>
            <div className="cart-row">
              <div className="cart-field"><label className="cart-label">Sup. total m²</label><input className="cart-input" type="number" value={form.superficie_total} onChange={e => setForm((p: any) => ({...p, superficie_total: e.target.value}))} placeholder="95" /></div>
              <div className="cart-field"><label className="cart-label">Antigüedad</label>
                <select className="cart-select-modal" value={form.antiguedad} onChange={e => setForm((p: any) => ({...p, antiguedad: e.target.value}))}>
                  <option value="">Sin especificar</option>
                  {ANTIGUEDADES.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="cart-check-row" style={{marginBottom:10}}>
              <div className="cart-check-item" onClick={() => setForm((p: any) => ({...p, apto_credito: !p.apto_credito}))}>
                <div className={`cart-check-box${form.apto_credito ? " on" : ""}`}>{form.apto_credito && <span style={{fontSize:9,color:"#fff"}}>✓</span>}</div>
                <span className="cart-check-label">Apto crédito</span>
              </div>
              <div className="cart-check-item" onClick={() => setForm((p: any) => ({...p, con_cochera: !p.con_cochera}))}>
                <div className={`cart-check-box${form.con_cochera ? " on" : ""}`}>{form.con_cochera && <span style={{fontSize:9,color:"#fff"}}>✓</span>}</div>
                <span className="cart-check-label">Con cochera</span>
              </div>
            </div>

            <div className="cart-field"><label className="cart-label">Amenities <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"rgba(255,255,255,0.18)"}}>separados por coma</span></label><input className="cart-input" value={form.amenities} onChange={e => setForm((p: any) => ({...p, amenities: e.target.value}))} placeholder="Pileta, Gimnasio, Salón de usos múltiples..." /></div>

            <div className="cart-divider" />
            <div className="cart-section-label">Descripción y estado</div>
            <div className="cart-field"><label className="cart-label">Descripción</label><textarea className="cart-textarea" value={form.descripcion} onChange={e => setForm((p: any) => ({...p, descripcion: e.target.value}))} rows={3} placeholder="Descripción para la ficha y el MIR..." /></div>
            <div className="cart-field"><label className="cart-label">Estado</label>
              <select className="cart-select-modal" value={form.estado} onChange={e => setForm((p: any) => ({...p, estado: e.target.value}))}>
                {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div className="cart-modal-actions">
              <button className="cart-btn-cancel" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="cart-btn-save" onClick={guardar} disabled={guardando || !form.titulo}>
                {guardando ? <><span className="cart-spinner"/>Guardando...</> : editandoId ? "Guardar cambios" : "Crear propiedad"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
