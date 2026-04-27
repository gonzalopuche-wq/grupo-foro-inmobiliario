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

interface SyncPortal {
  tokko_id: string | null;
  tokko_synced_at: string | null;
  kiteprop_id: string | null;
  kiteprop_synced_at: string | null;
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
const MAX_FOTOS = 20;

const FORM_VACIO = {
  titulo: "", descripcion: "", operacion: "Venta", tipo: "Departamento",
  precio: "", moneda: "USD", ciudad: "Rosario", zona: "", direccion: "",
  dormitorios: "", banos: "", superficie_cubierta: "", superficie_total: "",
  antiguedad: "", apto_credito: false, con_cochera: false,
  amenities: "", video_url: "", estado: "activa",
};

const fmt = (n: number | null) => n ? n.toLocaleString("es-AR") : "-";
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

// Extrae ID de YouTube de cualquier formato de URL
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

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

  // Modal form
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(FORM_VACIO);

  // Fotos
  const [fotosNuevas, setFotosNuevas] = useState<File[]>([]);
  const [fotosExistentes, setFotosExistentes] = useState<string[]>([]);
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const [progresoFotos, setProgresoFotos] = useState(0);

  // Sync portales
  const [syncData, setSyncData] = useState<Record<string, SyncPortal>>({});
  const [sincronizando, setSincronizando] = useState<string | null>(null);

  // Selección múltiple
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
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
    const props = (data as Propiedad[]) ?? [];
    setPropiedades(props);

    // Cargar sync data
    if (props.length > 0) {
      const ids = props.map(p => p.id);
      const { data: syncs } = await supabase
        .from("cartera_sync_portales")
        .select("*")
        .in("propiedad_id", ids);
      const syncMap: Record<string, SyncPortal> = {};
      (syncs ?? []).forEach((s: any) => { syncMap[s.propiedad_id] = s; });
      setSyncData(syncMap);
    }
    setLoading(false);
  };

  // ── Fotos ─────────────────────────────────────────────────────────────────
  const handleFotosSeleccionadas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const total = fotosExistentes.length + fotosNuevas.length + files.length;
    if (total > MAX_FOTOS) {
      alert(`Máximo ${MAX_FOTOS} fotos por propiedad. Tenés ${fotosExistentes.length + fotosNuevas.length} y querés agregar ${files.length}.`);
      return;
    }
    const validas = files.filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
    if (validas.length < files.length) alert("Algunas fotos fueron ignoradas (no son imagen o superan 10MB).");
    setFotosNuevas(prev => [...prev, ...validas]);
  };

  const eliminarFotoNueva = (idx: number) => {
    setFotosNuevas(prev => prev.filter((_, i) => i !== idx));
  };

  const eliminarFotoExistente = (url: string) => {
    setFotosExistentes(prev => prev.filter(u => u !== url));
  };

  const subirFotos = async (propiedadId: string): Promise<string[]> => {
    if (fotosNuevas.length === 0) return fotosExistentes;
    setSubiendoFotos(true);
    const urls: string[] = [...fotosExistentes];
    for (let i = 0; i < fotosNuevas.length; i++) {
      const file = fotosNuevas[i];
      const ext = file.name.split(".").pop();
      const path = `${userId}/${propiedadId}/${Date.now()}_${i}.${ext}`;
      const { data, error } = await supabase.storage
        .from("fotos_cartera")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("fotos_cartera").getPublicUrl(data.path);
        urls.push(urlData.publicUrl);
      }
      setProgresoFotos(Math.round(((i + 1) / fotosNuevas.length) * 100));
    }
    setSubiendoFotos(false);
    setProgresoFotos(0);
    return urls;
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const abrirNueva = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setFotosNuevas([]);
    setFotosExistentes([]);
    setMostrarForm(true);
  };

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
    setFotosNuevas([]);
    setFotosExistentes(p.fotos ?? []);
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!userId || !form.titulo) return;
    setGuardando(true);
    const amenitiesArr = form.amenities.split(",").map((a: string) => a.trim()).filter(Boolean);

    // Primero insertar/actualizar para obtener el ID
    let propId = editandoId;
    const datosBase = {
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
      await supabase.from("cartera_propiedades").update(datosBase).eq("id", editandoId);
    } else {
      const { data: nueva } = await supabase.from("cartera_propiedades").insert(datosBase).select("id").single();
      propId = nueva?.id ?? null;
    }

    // Subir fotos si hay nuevas
    if (propId) {
      const todasFotos = await subirFotos(propId);
      if (todasFotos.length > 0 || fotosExistentes.length !== (form.fotos ?? []).length) {
        await supabase.from("cartera_propiedades").update({ fotos: todasFotos }).eq("id", propId);
      }
    }

    setGuardando(false);
    setMostrarForm(false);
    setFotosNuevas([]);
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

  // ── Sync portales ─────────────────────────────────────────────────────────
  const sincronizarPortal = async (propiedadId: string, portales: string[]) => {
    setSincronizando(propiedadId);
    try {
      const res = await fetch("/api/cartera/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedad_id: propiedadId, portales }),
      });
      const data = await res.json();
      if (data.ok) {
        if (userId) await cargar(userId);
        alert(`✅ Sincronizado correctamente:\n${portales.map(p => {
          const r = data.resultados[p];
          return `${p}: ${r.ok ? "OK" : "Error: " + r.error}`;
        }).join("\n")}`);
      } else {
        alert("Error al sincronizar: " + data.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setSincronizando(null);
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

  const toggleSeleccion = (id: string) => setSeleccionadas(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleTodas = () => seleccionadas.size === filtradas.length ? setSeleccionadas(new Set()) : setSeleccionadas(new Set(filtradas.map(p => p.id)));
  const estadoInfo = (e: string) => ESTADOS.find(x => x.value === e) ?? { value: e, label: e.toUpperCase(), color: "#6b7280" };
  const tieneActivas = propiedades.filter(p => p.estado === "activa").length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .cart-root { display: flex; flex-direction: column; background: #080808; min-height: calc(100vh - 70px); }
        .cart-header { padding: 18px 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .cart-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; }
        .cart-titulo span { color: #cc0000; }
        .cart-stats { display: flex; gap: 16px; }
        .cart-stat { display: flex; flex-direction: column; align-items: center; }
        .cart-stat-val { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .cart-stat-label { font-size: 9px; color: rgba(255,255,255,0.25); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .cart-btn-nueva { padding: 9px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .cart-btn-nueva:hover { background: #e60000; }
        .cart-toolbar { padding: 12px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .cart-search-wrap { position: relative; }
        .cart-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: rgba(255,255,255,0.2); pointer-events: none; }
        .cart-search { padding: 8px 10px 8px 28px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter',sans-serif; width: 220px; }
        .cart-search:focus { border-color: rgba(200,0,0,0.35); }
        .cart-search::placeholder { color: rgba(255,255,255,0.2); }
        .cart-select { padding: 7px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; font-family: 'Inter',sans-serif; outline: none; cursor: pointer; }
        .cart-count { font-size: 11px; color: rgba(255,255,255,0.25); font-family: 'Inter',sans-serif; margin-left: auto; }
        .cart-lista { display: flex; flex-direction: column; gap: 6px; padding: 14px 0; }
        .cart-card { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 7px; display: flex; overflow: hidden; transition: border-color 0.12s; }
        .cart-card:hover { border-color: rgba(255,255,255,0.13); }
        .cart-card.seleccionada { border-color: rgba(200,0,0,0.35); background: rgba(200,0,0,0.03); }
        .cart-card-check { width: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .cart-checkbox { width: 16px; height: 16px; border-radius: 4px; border: 2px solid rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; transition: all 0.12s; cursor: pointer; }
        .cart-checkbox.marcado { background: #cc0000; border-color: #cc0000; }
        .cart-card-foto { width: 140px; flex-shrink: 0; position: relative; background: rgba(255,255,255,0.03); overflow: hidden; }
        .cart-card-foto img { width: 100%; height: 100%; object-fit: cover; min-height: 110px; }
        .cart-card-foto-empty { width: 100%; min-height: 110px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: rgba(255,255,255,0.08); }
        .cart-estado-badge { position: absolute; top: 8px; left: 8px; padding: 3px 7px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 800; letter-spacing: 0.1em; color: #000; }
        .cart-destacada-badge { position: absolute; top: 8px; right: 8px; padding: 3px 7px; border-radius: 3px; background: #f59e0b; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 800; color: #000; }
        .cart-foto-count { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.7); color: #fff; font-size: 9px; padding: 2px 5px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .cart-card-info { flex: 1; padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .cart-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .cart-card-titulo { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
        .cart-card-titulo:hover { color: #cc0000; }
        .cart-card-tipo { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .cart-card-precio { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; white-space: nowrap; }
        .cart-card-precio-op { font-size: 9px; color: rgba(255,255,255,0.3); font-family: 'Montserrat',sans-serif; font-weight: 700; text-transform: uppercase; }
        .cart-card-meta { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
        .cart-meta-item { font-size: 11px; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 4px; font-family: 'Inter',sans-serif; }
        .cart-card-dir { font-size: 11px; color: rgba(255,255,255,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cart-card-chips { display: flex; gap: 5px; flex-wrap: wrap; }
        .cart-chip { font-size: 9px; padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .cart-chip-verde { border-color: rgba(34,197,94,0.3); color: rgba(34,197,94,0.7); }
        .cart-chip-sync { border-color: rgba(59,130,246,0.3); color: rgba(59,130,246,0.7); }
        .cart-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
        .cart-card-codigo { font-size: 9px; color: rgba(255,255,255,0.2); font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; }
        .cart-card-fecha { font-size: 9px; color: rgba(255,255,255,0.18); }
        .cart-mir-badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); color: rgba(200,0,0,0.7); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .cart-card-acciones { width: 120px; flex-shrink: 0; padding: 12px 10px; display: flex; flex-direction: column; gap: 5px; border-left: 1px solid rgba(255,255,255,0.05); }
        .cart-acc-btn { padding: 5px 8px; border-radius: 3px; font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; text-align: center; transition: all 0.12s; width: 100%; }
        .cart-acc-editar { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.45); }
        .cart-acc-editar:hover { background: rgba(255,255,255,0.08); }
        .cart-acc-tokko { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.2); color: rgba(220,38,38,0.65); }
        .cart-acc-tokko:hover { background: rgba(220,38,38,0.14); }
        .cart-acc-kite { background: rgba(59,130,246,0.07); border: 1px solid rgba(59,130,246,0.2); color: rgba(59,130,246,0.65); }
        .cart-acc-kite:hover { background: rgba(59,130,246,0.14); }
        .cart-acc-ambos { background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.2); color: rgba(16,185,129,0.65); }
        .cart-acc-ambos:hover { background: rgba(16,185,129,0.14); }
        .cart-acc-eliminar { background: transparent; border: 1px solid rgba(200,0,0,0.15); color: rgba(200,0,0,0.4); }
        .cart-acc-eliminar:hover { background: rgba(200,0,0,0.08); }
        .cart-estado-select { width: 100%; padding: 4px 6px; background: rgba(12,12,12,0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px; color: rgba(255,255,255,0.5); font-size: 9px; font-family: 'Montserrat',sans-serif; outline: none; cursor: pointer; }
        .cart-sync-spinner { display: inline-block; width: 8px; height: 8px; border: 1.5px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 3px; vertical-align: middle; }
        .cart-empty { padding: 60px 20px; text-align: center; color: rgba(255,255,255,0.18); font-family: 'Inter',sans-serif; font-size: 13px; line-height: 1.8; }
        .cart-empty-ico { font-size: 36px; margin-bottom: 12px; }

        /* ── Modal ── */
        .cart-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: flex-start; justify-content: center; z-index: 300; padding: 20px; overflow-y: auto; }
        .cart-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.22); border-radius: 8px; padding: 26px 30px; width: 100%; max-width: 660px; margin: auto; position: relative; }
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
        .cart-check-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
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

        /* ── Fotos upload ── */
        .foto-upload-area { border: 2px dashed rgba(255,255,255,0.12); border-radius: 6px; padding: 16px; text-align: center; cursor: pointer; transition: border-color 0.15s; position: relative; }
        .foto-upload-area:hover { border-color: rgba(200,0,0,0.35); }
        .foto-upload-area input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .foto-upload-txt { font-size: 12px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
        .foto-upload-sub { font-size: 10px; color: rgba(255,255,255,0.18); margin-top: 3px; }
        .fotos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; margin-top: 10px; }
        .foto-thumb { position: relative; aspect-ratio: 1; border-radius: 5px; overflow: hidden; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
        .foto-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .foto-thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0); transition: background 0.12s; display: flex; align-items: center; justify-content: center; }
        .foto-thumb:hover .foto-thumb-overlay { background: rgba(0,0,0,0.5); }
        .foto-del-btn { opacity: 0; background: #cc0000; border: none; border-radius: 50%; width: 22px; height: 22px; color: #fff; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.12s; }
        .foto-thumb:hover .foto-del-btn { opacity: 1; }
        .foto-orden-badge { position: absolute; bottom: 3px; left: 3px; background: rgba(0,0,0,0.7); color: #fff; font-size: 8px; padding: 1px 4px; border-radius: 2px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .foto-nueva-badge { position: absolute; top: 3px; right: 3px; background: #22c55e; color: #fff; font-size: 7px; padding: 1px 4px; border-radius: 2px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .foto-progress { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 8px; overflow: hidden; }
        .foto-progress-bar { height: 100%; background: #cc0000; transition: width 0.3s; }

        /* ── Video YouTube ── */
        .video-preview { margin-top: 8px; border-radius: 6px; overflow: hidden; aspect-ratio: 16/9; background: rgba(0,0,0,0.5); }
        .video-preview iframe { width: 100%; height: 100%; border: none; }

        /* ── Sync portales badges ── */
        .sync-badges { display: flex; gap: 4px; flex-wrap: wrap; }
        .sync-badge { font-size: 8px; padding: 2px 6px; border-radius: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .sync-badge-tokko { background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.25); color: rgba(220,38,38,0.7); }
        .sync-badge-kite { background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); color: rgba(59,130,246,0.7); }
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
            <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:8,marginBottom:2}}>
              <div className={`cart-checkbox${seleccionadas.size === filtradas.length && filtradas.length > 0 ? " marcado" : ""}`} onClick={toggleTodas}>
                {seleccionadas.size === filtradas.length && filtradas.length > 0 && <span style={{fontSize:9,color:"#fff"}}>✓</span>}
              </div>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:"Inter,sans-serif"}}>Seleccionar todas</span>
            </div>

            {filtradas.map(p => {
              const est = estadoInfo(p.estado);
              const foto = (p.fotos ?? [])[0];
              const cantFotos = (p.fotos ?? []).length;
              const sel = seleccionadas.has(p.id);
              const sync = syncData[p.id];
              const ytId = getYouTubeId(p.video_url ?? "");
              const enSync = sincronizando === p.id;
              return (
                <div key={p.id} className={`cart-card${sel ? " seleccionada" : ""}`}>
                  <div className="cart-card-check" onClick={() => toggleSeleccion(p.id)}>
                    <div className={`cart-checkbox${sel ? " marcado" : ""}`}>{sel && <span style={{fontSize:9,color:"#fff"}}>✓</span>}</div>
                  </div>

                  <div className="cart-card-foto">
                    {foto ? <img src={foto} alt={p.titulo} /> : <div className="cart-card-foto-empty">🏠</div>}
                    <div className="cart-estado-badge" style={{background: est.color}}>{est.label}</div>
                    {p.destacada_web && <div className="cart-destacada-badge">Destacada Web</div>}
                    {cantFotos > 1 && <div className="cart-foto-count">📷 {cantFotos}</div>}
                    {ytId && <div style={{position:"absolute",bottom:6,left:6,background:"rgba(0,0,0,0.7)",color:"#ff0000",fontSize:9,padding:"2px 5px",borderRadius:3,fontFamily:"Montserrat,sans-serif",fontWeight:700}}>▶ Video</div>}
                  </div>

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
                      {p.dormitorios != null && <span className="cart-meta-item">🛏 {p.dormitorios} dorm.</span>}
                      {p.banos != null && <span className="cart-meta-item">🚿 {p.banos} baños</span>}
                      {p.superficie_cubierta != null && <span className="cart-meta-item">📐 {p.superficie_cubierta} m² cub.</span>}
                      {p.superficie_total != null && <span className="cart-meta-item">{p.superficie_total} m² total</span>}
                    </div>

                    <div className="cart-card-chips">
                      {p.apto_credito && <span className="cart-chip cart-chip-verde">Apto crédito</span>}
                      {p.con_cochera && <span className="cart-chip cart-chip-verde">Cochera</span>}
                      {(p.amenities ?? []).slice(0, 3).map(a => <span key={a} className="cart-chip">{a}</span>)}
                    </div>

                    <div className="cart-card-footer">
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        {p.codigo && <span className="cart-card-codigo">{p.codigo}</span>}
                        <span className="cart-card-fecha">{formatFecha(p.updated_at)}</span>
                        {p.estado === "activa" && <span className="cart-mir-badge">🔄 En MIR</span>}
                      </div>
                      <div className="sync-badges">
                        {sync?.tokko_id && <span className="sync-badge sync-badge-tokko">Tokko ✓</span>}
                        {sync?.kiteprop_id && <span className="sync-badge sync-badge-kite">KiteProp ✓</span>}
                      </div>
                    </div>
                  </div>

                  <div className="cart-card-acciones">
                    <button className="cart-acc-btn cart-acc-editar" onClick={() => abrirEditar(p)}>Editar</button>
                    <select className="cart-estado-select" value={p.estado} onChange={e => cambiarEstado(p.id, e.target.value)}>
                      {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button className="cart-acc-btn cart-acc-tokko" onClick={() => sincronizarPortal(p.id, ["tokko"])} disabled={enSync}>
                      {enSync ? <><span className="cart-sync-spinner"/>...</> : sync?.tokko_id ? "↑ Tokko" : "+ Tokko"}
                    </button>
                    <button className="cart-acc-btn cart-acc-kite" onClick={() => sincronizarPortal(p.id, ["kiteprop"])} disabled={enSync}>
                      {enSync ? "..." : sync?.kiteprop_id ? "↑ KiteProp" : "+ KiteProp"}
                    </button>
                    <button className="cart-acc-btn cart-acc-ambos" onClick={() => sincronizarPortal(p.id, ["tokko","kiteprop"])} disabled={enSync}>
                      {enSync ? "..." : "↑ Ambos"}
                    </button>
                    <button className="cart-acc-btn cart-acc-eliminar" onClick={() => eliminar(p.id)}>Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL NUEVA / EDITAR PROPIEDAD
      ══════════════════════════════════════════════════ */}
      {mostrarForm && (
        <div className="cart-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="cart-modal">
            <div className="cart-modal-titulo">{editandoId ? "Editar" : "Nueva"} <span>propiedad</span></div>

            {!editandoId && (
              <div className="cart-mir-info">
                <strong>🔄 Se publicará automáticamente en el MIR</strong> como ofrecido tuyo en la red. Podés pausarla después si querés.
              </div>
            )}

            {/* Datos principales */}
            <div className="cart-section-label">Datos principales</div>
            <div className="cart-field"><label className="cart-label">Título *</label><input className="cart-input" value={form.titulo} onChange={e => setForm((p: any) => ({...p, titulo: e.target.value}))} placeholder="Ej: Departamento 3 amb. con balcón - Fisherton" /></div>
            <div className="cart-row">
              <div className="cart-field"><label className="cart-label">Operación</label><select className="cart-select-modal" value={form.operacion} onChange={e => setForm((p: any) => ({...p, operacion: e.target.value}))}>{OPERACIONES.map(o => <option key={o}>{o}</option>)}</select></div>
              <div className="cart-field"><label className="cart-label">Tipo</label><select className="cart-select-modal" value={form.tipo} onChange={e => setForm((p: any) => ({...p, tipo: e.target.value}))}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="cart-row">
              <div className="cart-field"><label className="cart-label">Precio</label><input className="cart-input" type="number" value={form.precio} onChange={e => setForm((p: any) => ({...p, precio: e.target.value}))} placeholder="180000" /></div>
              <div className="cart-field"><label className="cart-label">Moneda</label><select className="cart-select-modal" value={form.moneda} onChange={e => setForm((p: any) => ({...p, moneda: e.target.value}))}><option>USD</option><option>ARS</option></select></div>
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
              <div className="cart-field"><label className="cart-label">Antigüedad</label><select className="cart-select-modal" value={form.antiguedad} onChange={e => setForm((p: any) => ({...p, antiguedad: e.target.value}))}><option value="">Sin especificar</option>{ANTIGUEDADES.map(a => <option key={a}>{a}</option>)}</select></div>
            </div>
            <div className="cart-check-row">
              <div className="cart-check-item" onClick={() => setForm((p: any) => ({...p, apto_credito: !p.apto_credito}))}>
                <div className={`cart-check-box${form.apto_credito ? " on" : ""}`}>{form.apto_credito && <span style={{fontSize:9,color:"#fff"}}>✓</span>}</div>
                <span className="cart-check-label">Apto crédito</span>
              </div>
              <div className="cart-check-item" onClick={() => setForm((p: any) => ({...p, con_cochera: !p.con_cochera}))}>
                <div className={`cart-check-box${form.con_cochera ? " on" : ""}`}>{form.con_cochera && <span style={{fontSize:9,color:"#fff"}}>✓</span>}</div>
                <span className="cart-check-label">Con cochera</span>
              </div>
            </div>
            <div className="cart-field"><label className="cart-label">Amenities <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"rgba(255,255,255,0.18)"}}>separados por coma</span></label><input className="cart-input" value={form.amenities} onChange={e => setForm((p: any) => ({...p, amenities: e.target.value}))} placeholder="Pileta, Gimnasio, SUM..." /></div>

            <div className="cart-divider" />
            <div className="cart-section-label">Fotos ({fotosExistentes.length + fotosNuevas.length}/{MAX_FOTOS})</div>

            {/* Fotos existentes + nuevas */}
            {(fotosExistentes.length > 0 || fotosNuevas.length > 0) && (
              <div className="fotos-grid" style={{marginBottom:10}}>
                {fotosExistentes.map((url, i) => (
                  <div key={url} className="foto-thumb">
                    <img src={url} alt={`Foto ${i+1}`} />
                    <div className="foto-thumb-overlay">
                      <button className="foto-del-btn" onClick={() => eliminarFotoExistente(url)}>×</button>
                    </div>
                    <div className="foto-orden-badge">{i+1}</div>
                  </div>
                ))}
                {fotosNuevas.map((file, i) => (
                  <div key={i} className="foto-thumb">
                    <img src={URL.createObjectURL(file)} alt={`Nueva ${i+1}`} />
                    <div className="foto-thumb-overlay">
                      <button className="foto-del-btn" onClick={() => eliminarFotoNueva(i)}>×</button>
                    </div>
                    <div className="foto-orden-badge">{fotosExistentes.length + i + 1}</div>
                    <div className="foto-nueva-badge">NUEVA</div>
                  </div>
                ))}
              </div>
            )}

            {(fotosExistentes.length + fotosNuevas.length) < MAX_FOTOS && (
              <div className="foto-upload-area">
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={handleFotosSeleccionadas} />
                <div className="foto-upload-txt">📷 Arrastrá fotos o hacé clic para seleccionar</div>
                <div className="foto-upload-sub">JPG, PNG o WebP · Máx. 10MB por foto · Hasta {MAX_FOTOS} fotos en total</div>
              </div>
            )}

            {subiendoFotos && (
              <div className="foto-progress" style={{marginTop:8}}>
                <div className="foto-progress-bar" style={{width:`${progresoFotos}%`}} />
              </div>
            )}

            <div className="cart-divider" />
            <div className="cart-section-label">Video</div>
            <div className="cart-field">
              <label className="cart-label">Link YouTube <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"rgba(255,255,255,0.18)"}}>recorrida virtual, tour, etc.</span></label>
              <input className="cart-input" value={form.video_url} onChange={e => setForm((p: any) => ({...p, video_url: e.target.value}))} placeholder="https://www.youtube.com/watch?v=..." />
              {form.video_url && getYouTubeId(form.video_url) && (
                <div className="video-preview" style={{marginTop:8}}>
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeId(form.video_url)}`}
                    allowFullScreen
                    title="Preview video"
                  />
                </div>
              )}
              {form.video_url && !getYouTubeId(form.video_url) && (
                <div style={{marginTop:5,fontSize:10,color:"rgba(200,0,0,0.6)",fontFamily:"Inter,sans-serif"}}>⚠️ URL de YouTube no reconocida</div>
              )}
            </div>

            <div className="cart-divider" />
            <div className="cart-section-label">Descripción y estado</div>
            <div className="cart-field"><label className="cart-label">Descripción</label><textarea className="cart-textarea" value={form.descripcion} onChange={e => setForm((p: any) => ({...p, descripcion: e.target.value}))} rows={3} placeholder="Descripción para la ficha y el MIR..." /></div>
            <div className="cart-field"><label className="cart-label">Estado</label><select className="cart-select-modal" value={form.estado} onChange={e => setForm((p: any) => ({...p, estado: e.target.value}))}>{ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>

            <div className="cart-modal-actions">
              <button className="cart-btn-cancel" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="cart-btn-save" onClick={guardar} disabled={guardando || subiendoFotos || !form.titulo}>
                {guardando || subiendoFotos
                  ? <><span className="cart-spinner"/>{subiendoFotos ? `Subiendo fotos ${progresoFotos}%...` : "Guardando..."}</>
                  : editandoId ? "Guardar cambios" : "Crear propiedad"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
