"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const ETAPAS_EMP = [
  { value: "en_planos",       label: "En planos",       color: "#3b82f6" },
  { value: "en_construccion", label: "En construcción", color: "#f97316" },
  { value: "terminado",       label: "Terminado",       color: "#22c55e" },
  { value: "vendido",         label: "Vendido",         color: "#6b7280" },
];

const TIPOS_EMP = ["Departamentos", "Casas", "Oficinas", "Locales", "Cocheras", "Loteo"];

const AMENITIES_OPT = ["Piscina", "Gimnasio", "SUM", "Cochera", "Seguridad 24h", "Terraza", "Laundry", "Ascensor", "Balcón", "Jardín"];

interface Emprendimiento {
  id: string;
  nombre: string;
  descripcion: string | null;
  ubicacion: string | null;
  barrio: string | null;
  tipo: string | null;
  etapa: string | null;
  precio_desde: number | null;
  moneda: string | null;
  total_unidades: number | null;
  unidades_disponibles: number | null;
  fecha_entrega: string | null;
  imagenes: string[] | null;
  perfil_id: string | null;
  es_publica: boolean;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_whatsapp: string | null;
  web_url: string | null;
  comision_corredor_pct: number | null;
  dormitorios_desde: number | null;
  dormitorios_hasta: number | null;
  sup_desde: number | null;
  sup_hasta: number | null;
  amenities: string[] | null;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; inmobiliaria: string | null; email: string | null; telefono: string | null; } | null;
}

const FORM_VACIO = {
  nombre: "", descripcion: "", ubicacion: "", barrio: "", tipo: "", etapa: "",
  precio_desde: "", moneda: "USD", total_unidades: "", unidades_disponibles: "",
  fecha_entrega: "", contacto_nombre: "", contacto_email: "", contacto_whatsapp: "",
  web_url: "", comision_corredor_pct: "3", dormitorios_desde: "", dormitorios_hasta: "",
  sup_desde: "", sup_hasta: "", amenities: [] as string[], es_publica: true,
};

export default function EmprendimientosPage() {
  const [userId, setUserId]       = useState<string | null>(null);
  const [userTipo, setUserTipo]   = useState<string | null>(null);
  const [vista, setVista]         = useState<"marketplace" | "mis">("marketplace");
  const [items, setItems]         = useState<Emprendimiento[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filtroEtapa, setFiltroEtapa] = useState("todos");
  const [filtroTipo,  setFiltroTipo]  = useState("todos");
  const [busqueda,    setBusqueda]    = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId,   setEditandoId]   = useState<string | null>(null);
  const [form, setForm]             = useState(FORM_VACIO);
  const [guardando, setGuardando]   = useState(false);
  const [contactoEmp, setContactoEmp] = useState<string | null>(null);

  const esConstructora = userTipo === "constructora";
  const esAdmin        = userTipo === "admin";
  const esCorredor     = userTipo === "corredor" || userTipo === "colaborador";

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { window.location.href = "/"; return; }
      setUserId(userData.user.id);
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", userData.user.id).single();
      const tipo = perfil?.tipo ?? null;
      setUserTipo(tipo);
      if (tipo === "constructora") {
        setVista("mis");
        cargarMios(userData.user.id);
      } else {
        cargarMarketplace();
      }
    };
    init();
  }, []);

  const cargarMarketplace = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("emprendimientos")
      .select("*, perfiles!perfil_id(nombre, apellido, inmobiliaria, email, telefono)")
      .eq("es_publica", true)
      .order("created_at", { ascending: false });
    setItems((data as Emprendimiento[] | null) ?? []);
    setLoading(false);
  };

  const cargarMios = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("emprendimientos")
      .select("*, perfiles!perfil_id(nombre, apellido, inmobiliaria, email, telefono)")
      .eq("perfil_id", uid)
      .order("created_at", { ascending: false });
    setItems((data as Emprendimiento[] | null) ?? []);
    setLoading(false);
  };

  const cambiarVista = (v: "marketplace" | "mis") => {
    setVista(v);
    setLoading(true);
    if (v === "marketplace") cargarMarketplace();
    else if (userId) cargarMios(userId);
  };

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
      barrio: e.barrio ?? "",
      tipo: e.tipo ?? "",
      etapa: e.etapa ?? "",
      precio_desde: e.precio_desde?.toString() ?? "",
      moneda: e.moneda ?? "USD",
      total_unidades: e.total_unidades?.toString() ?? "",
      unidades_disponibles: e.unidades_disponibles?.toString() ?? "",
      fecha_entrega: e.fecha_entrega ?? "",
      contacto_nombre: e.contacto_nombre ?? "",
      contacto_email: e.contacto_email ?? "",
      contacto_whatsapp: e.contacto_whatsapp ?? "",
      web_url: e.web_url ?? "",
      comision_corredor_pct: e.comision_corredor_pct?.toString() ?? "3",
      dormitorios_desde: e.dormitorios_desde?.toString() ?? "",
      dormitorios_hasta: e.dormitorios_hasta?.toString() ?? "",
      sup_desde: e.sup_desde?.toString() ?? "",
      sup_hasta: e.sup_hasta?.toString() ?? "",
      amenities: e.amenities ?? [],
      es_publica: e.es_publica,
    });
    setEditandoId(e.id);
    setMostrarModal(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !userId) return;
    setGuardando(true);
    const payload: any = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      ubicacion: form.ubicacion.trim() || null,
      barrio: form.barrio.trim() || null,
      tipo: form.tipo || null,
      etapa: form.etapa || null,
      precio_desde: form.precio_desde ? parseFloat(form.precio_desde) : null,
      moneda: form.moneda || "USD",
      total_unidades: form.total_unidades ? parseInt(form.total_unidades) : null,
      unidades_disponibles: form.unidades_disponibles ? parseInt(form.unidades_disponibles) : null,
      fecha_entrega: form.fecha_entrega || null,
      contacto_nombre: form.contacto_nombre.trim() || null,
      contacto_email: form.contacto_email.trim() || null,
      contacto_whatsapp: form.contacto_whatsapp.trim() || null,
      web_url: form.web_url.trim() || null,
      comision_corredor_pct: form.comision_corredor_pct ? parseFloat(form.comision_corredor_pct) : 3,
      dormitorios_desde: form.dormitorios_desde ? parseInt(form.dormitorios_desde) : null,
      dormitorios_hasta: form.dormitorios_hasta ? parseInt(form.dormitorios_hasta) : null,
      sup_desde: form.sup_desde ? parseFloat(form.sup_desde) : null,
      sup_hasta: form.sup_hasta ? parseFloat(form.sup_hasta) : null,
      amenities: form.amenities.length > 0 ? form.amenities : null,
      es_publica: form.es_publica,
      perfil_id: userId,
    };
    if (editandoId) {
      await supabase.from("emprendimientos").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editandoId).eq("perfil_id", userId);
    } else {
      await supabase.from("emprendimientos").insert(payload);
    }
    setMostrarModal(false);
    setEditandoId(null);
    cargarMios(userId);
    setGuardando(false);
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este emprendimiento?") || !userId) return;
    await supabase.from("emprendimientos").delete().eq("id", id).eq("perfil_id", userId);
    cargarMios(userId);
  };

  const toggleAmenity = (a: string) =>
    setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }));

  const filtrados = items.filter(e => {
    if (filtroEtapa !== "todos" && e.etapa !== filtroEtapa) return false;
    if (filtroTipo  !== "todos" && e.tipo  !== filtroTipo)  return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!(`${e.nombre} ${e.ubicacion ?? ""} ${e.barrio ?? ""} ${e.tipo ?? ""}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const getEtapa   = (v: string | null) => ETAPAS_EMP.find(e => e.value === v) ?? { label: v ?? "—", color: "#6b7280" };
  const fmtPrecio  = (e: Emprendimiento) => e.precio_desde ? `Desde ${e.moneda ?? "USD"} ${e.precio_desde.toLocaleString("es-AR")}` : null;
  const fmtEntrega = (iso: string | null) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" }) : null;
  const puedeGestionar = esConstructora || esAdmin;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .emp-root { min-height: 100vh; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .emp-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 56px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; z-index: 100; }
        .emp-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 17px; font-weight: 800; }
        .emp-topbar-logo span { color: #cc0000; }
        .emp-content { max-width: 1180px; margin: 0 auto; padding: 28px 24px; }
        .emp-header { margin-bottom: 24px; }
        .emp-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .emp-header h1 span { color: #cc0000; }
        .emp-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 5px; }
        .emp-vista-tabs { display: flex; gap: 6px; margin-bottom: 18px; }
        .emp-vista-tab { padding: 7px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .emp-vista-tab.activo { background: #cc0000; border-color: #cc0000; color: #fff; }
        .emp-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .emp-filter-btn { padding: 6px 13px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; cursor: pointer; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); transition: all 0.15s; }
        .emp-filter-btn.activo { border-color: rgba(204,0,0,0.5); color: #cc0000; background: rgba(204,0,0,0.08); }
        .emp-search { padding: 7px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #fff; font-size: 12px; font-family: Inter,sans-serif; outline: none; width: 200px; }
        .emp-btn-nuevo { margin-left: auto; padding: 8px 18px; background: #cc0000; border: none; border-radius: 5px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .emp-btn-nuevo:hover { background: #aa0000; }
        .emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
        .emp-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.2s, transform 0.2s; }
        .emp-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-2px); }
        .emp-card-head { padding: 16px 16px 0; }
        .emp-card-body { padding: 10px 16px 14px; flex: 1; display: flex; flex-direction: column; gap: 7px; }
        .emp-etapa-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
        .emp-card-title { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 700; color: #fff; line-height: 1.3; margin-bottom: 2px; }
        .emp-card-sub { font-size: 11px; color: rgba(255,255,255,0.35); }
        .emp-card-footer { padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 8px; flex-wrap: wrap; }
        .emp-btn-sm { padding: 5px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .emp-btn-sm:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .emp-btn-del { padding: 5px 12px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.2); background: transparent; color: rgba(239,68,68,0.6); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .emp-btn-del:hover { border-color: rgba(239,68,68,0.5); color: #ef4444; }
        .emp-btn-contacto { padding: 5px 12px; border-radius: 4px; border: 1px solid rgba(37,211,102,0.25); background: rgba(37,211,102,0.06); color: #25d366; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; }
        .emp-btn-contacto:hover { background: rgba(37,211,102,0.12); }
        .emp-empty { padding: 60px 20px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; }
        .emp-loading { padding: 60px 20px; text-align: center; color: rgba(255,255,255,0.3); font-size: 13px; }
        /* comision badge */
        .emp-comision { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; background: rgba(204,0,0,0.1); border: 1px solid rgba(204,0,0,0.2); font-size: 10px; font-family: 'Montserrat',sans-serif; font-weight: 700; color: #cc0000; }
        /* Modal */
        .emp-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 20px; overflow-y: auto; }
        .emp-modal { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; width: 100%; max-width: 600px; padding: 28px; margin: auto; }
        .emp-modal h2 { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; margin-bottom: 20px; }
        .emp-modal h2 span { color: #cc0000; }
        .emp-modal-section { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin: 16px 0 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .emp-modal-field { margin-bottom: 12px; }
        .emp-modal-label { display: block; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 5px; }
        .emp-modal-input, .emp-modal-select, .emp-modal-textarea { width: 100%; padding: 8px 11px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'Inter',sans-serif; font-size: 13px; outline: none; transition: border-color 0.2s; }
        .emp-modal-input:focus, .emp-modal-select:focus, .emp-modal-textarea:focus { border-color: rgba(204,0,0,0.5); }
        .emp-modal-textarea { min-height: 70px; resize: vertical; }
        .emp-modal-select option { background: #111; }
        .emp-modal-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .emp-modal-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .emp-amenity-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .emp-amenity-btn { padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .emp-amenity-btn.activo { border-color: rgba(204,0,0,0.5); background: rgba(204,0,0,0.1); color: #cc0000; }
        .emp-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
        .emp-modal-btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .emp-modal-btn-save { padding: 9px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; }
        .emp-modal-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        /* Contacto pop */
        .emp-contacto-pop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .emp-contacto-box { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 24px; width: 100%; max-width: 380px; }
        @media (max-width: 640px) {
          .emp-modal-row, .emp-modal-row3 { grid-template-columns: 1fr; }
          .emp-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="emp-root">
        <header className="emp-topbar">
          <div className="emp-topbar-logo">GFI<span>®</span> — Emprendimientos</div>
          <a href="/dashboard" style={{ padding: "6px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>← Dashboard</a>
        </header>

        <main className="emp-content">
          <div className="emp-header">
            <h1>{vista === "marketplace" ? <>Marketplace de <span>Emprendimientos</span></> : <>Mis <span>Proyectos</span></>}</h1>
            <p>{vista === "marketplace"
              ? "Proyectos de constructoras disponibles para vender. Comisiones pactadas con cada empresa."
              : esConstructora ? "Gestioná tus proyectos. Los corredores GFI los verán en el marketplace."
              : "Tus emprendimientos cargados."}
            </p>
          </div>

          {/* Tabs de vista (solo para corredores y admins) */}
          {(esCorredor || esAdmin) && (
            <div className="emp-vista-tabs">
              <button className={`emp-vista-tab${vista === "marketplace" ? " activo" : ""}`} onClick={() => cambiarVista("marketplace")}>🏗 Marketplace</button>
              <button className={`emp-vista-tab${vista === "mis" ? " activo" : ""}`} onClick={() => cambiarVista("mis")}>📋 Mis proyectos</button>
            </div>
          )}

          {/* Toolbar */}
          <div className="emp-toolbar">
            <button className={`emp-filter-btn${filtroEtapa === "todos" ? " activo" : ""}`} onClick={() => setFiltroEtapa("todos")}>Todas las etapas</button>
            {ETAPAS_EMP.map(e => (
              <button key={e.value} className={`emp-filter-btn${filtroEtapa === e.value ? " activo" : ""}`} onClick={() => setFiltroEtapa(e.value)}>{e.label}</button>
            ))}
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
            <button className={`emp-filter-btn${filtroTipo === "todos" ? " activo" : ""}`} onClick={() => setFiltroTipo("todos")}>Todos</button>
            {TIPOS_EMP.map(t => (
              <button key={t} className={`emp-filter-btn${filtroTipo === t ? " activo" : ""}`} onClick={() => setFiltroTipo(t)}>{t}</button>
            ))}
            <input className="emp-search" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {(puedeGestionar || vista === "mis") && (
              <button className="emp-btn-nuevo" onClick={abrirNuevo}>+ Nuevo proyecto</button>
            )}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="emp-loading">Cargando emprendimientos...</div>
          ) : filtrados.length === 0 ? (
            <div className="emp-empty">
              {vista === "marketplace"
                ? "No hay proyectos publicados aún. Las constructoras irán sumando sus emprendimientos."
                : "Aún no cargaste ningún proyecto. Hacé clic en \"+ Nuevo proyecto\" para empezar."}
            </div>
          ) : (
            <div className="emp-grid">
              {filtrados.map(emp => {
                const etapa = getEtapa(emp.etapa);
                return (
                  <div key={emp.id} className="emp-card">
                    <div className="emp-card-head">
                      <span className="emp-etapa-badge" style={{ background: `${etapa.color}18`, color: etapa.color, border: `1px solid ${etapa.color}44` }}>{etapa.label}</span>
                      <div className="emp-card-title">{emp.nombre}</div>
                      {(emp.ubicacion || emp.barrio) && (
                        <div className="emp-card-sub" style={{ marginBottom: 6 }}>📍 {[emp.barrio, emp.ubicacion].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                    <div className="emp-card-body">
                      {emp.tipo && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{emp.tipo}</div>}

                      {(emp.dormitorios_desde || emp.sup_desde) && (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", gap: 12 }}>
                          {emp.dormitorios_desde && <span>🛏 {emp.dormitorios_desde}{emp.dormitorios_hasta && emp.dormitorios_hasta !== emp.dormitorios_desde ? `–${emp.dormitorios_hasta}` : ""} dorm.</span>}
                          {emp.sup_desde && <span>📐 {emp.sup_desde}{emp.sup_hasta && emp.sup_hasta !== emp.sup_desde ? `–${emp.sup_hasta}` : ""}m²</span>}
                        </div>
                      )}

                      {emp.unidades_disponibles != null && (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                          <strong style={{ color: "#fff" }}>{emp.unidades_disponibles}</strong> unidades disponibles{emp.total_unidades ? ` de ${emp.total_unidades}` : ""}
                        </div>
                      )}

                      {fmtPrecio(emp) && (
                        <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "#cc0000" }}>{fmtPrecio(emp)}</div>
                      )}

                      {emp.fecha_entrega && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Entrega: {fmtEntrega(emp.fecha_entrega)}</div>
                      )}

                      {vista === "marketplace" && emp.comision_corredor_pct != null && emp.comision_corredor_pct > 0 && (
                        <span className="emp-comision">🤝 Comisión corredor: {emp.comision_corredor_pct}%</span>
                      )}

                      {emp.perfiles && vista === "marketplace" && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                          {emp.perfiles.inmobiliaria ?? `${emp.perfiles.nombre} ${emp.perfiles.apellido}`}
                        </div>
                      )}

                      {emp.amenities && emp.amenities.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                          {emp.amenities.slice(0, 4).map(a => (
                            <span key={a} style={{ padding: "2px 7px", borderRadius: 10, background: "rgba(255,255,255,0.06)", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{a}</span>
                          ))}
                          {emp.amenities.length > 4 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>+{emp.amenities.length - 4} más</span>}
                        </div>
                      )}
                    </div>

                    <div className="emp-card-footer">
                      {vista === "marketplace" ? (
                        <>
                          {(emp.contacto_whatsapp || emp.perfiles?.telefono) && (
                            <a href={`https://wa.me/${(emp.contacto_whatsapp || emp.perfiles?.telefono || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="emp-btn-contacto">💬 WhatsApp</a>
                          )}
                          <button className="emp-btn-sm" onClick={() => setContactoEmp(emp.id)}>Ver contacto</button>
                          {emp.web_url && <a href={emp.web_url} target="_blank" rel="noopener noreferrer" className="emp-btn-sm">🌐 Web</a>}
                        </>
                      ) : (
                        <>
                          <button className="emp-btn-sm" onClick={() => abrirEditar(emp)}>Editar</button>
                          <button className="emp-btn-del" onClick={() => eliminar(emp.id)}>Eliminar</button>
                          {!emp.es_publica && <span style={{ fontSize: 10, color: "rgba(255,165,0,0.7)", padding: "5px 0", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>⚠ Oculto</span>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Modal: crear/editar proyecto */}
      {mostrarModal && (
        <div className="emp-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarModal(false); }}>
          <div className="emp-modal">
            <h2>{editandoId ? "Editar" : "Nuevo"} <span>proyecto</span></h2>

            <div className="emp-modal-section">Datos del emprendimiento</div>
            <div className="emp-modal-field"><label className="emp-modal-label">Nombre del proyecto *</label><input className="emp-modal-input" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Ej: Torres del Parque" /></div>
            <div className="emp-modal-row">
              <div className="emp-modal-field"><label className="emp-modal-label">Tipo</label>
                <select className="emp-modal-select" value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}>
                  <option value="">Seleccioná</option>
                  {TIPOS_EMP.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="emp-modal-field"><label className="emp-modal-label">Etapa</label>
                <select className="emp-modal-select" value={form.etapa} onChange={e => setForm(f => ({...f, etapa: e.target.value}))}>
                  <option value="">Seleccioná</option>
                  {ETAPAS_EMP.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>
            <div className="emp-modal-row">
              <div className="emp-modal-field"><label className="emp-modal-label">Ubicación</label><input className="emp-modal-input" value={form.ubicacion} onChange={e => setForm(f => ({...f, ubicacion: e.target.value}))} placeholder="Dirección" /></div>
              <div className="emp-modal-field"><label className="emp-modal-label">Barrio</label><input className="emp-modal-input" value={form.barrio} onChange={e => setForm(f => ({...f, barrio: e.target.value}))} placeholder="Ej: Fisherton" /></div>
            </div>
            <div className="emp-modal-field"><label className="emp-modal-label">Descripción</label><textarea className="emp-modal-textarea" value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))} /></div>

            <div className="emp-modal-section">Unidades y precios</div>
            <div className="emp-modal-row3">
              <div className="emp-modal-field"><label className="emp-modal-label">Precio desde</label><input className="emp-modal-input" type="number" value={form.precio_desde} onChange={e => setForm(f => ({...f, precio_desde: e.target.value}))} /></div>
              <div className="emp-modal-field"><label className="emp-modal-label">Moneda</label>
                <select className="emp-modal-select" value={form.moneda} onChange={e => setForm(f => ({...f, moneda: e.target.value}))}>
                  <option value="USD">USD</option><option value="ARS">ARS</option>
                </select>
              </div>
              <div className="emp-modal-field"><label className="emp-modal-label">Entrega</label><input className="emp-modal-input" type="date" value={form.fecha_entrega} onChange={e => setForm(f => ({...f, fecha_entrega: e.target.value}))} /></div>
            </div>
            <div className="emp-modal-row">
              <div className="emp-modal-field"><label className="emp-modal-label">Total unidades</label><input className="emp-modal-input" type="number" value={form.total_unidades} onChange={e => setForm(f => ({...f, total_unidades: e.target.value}))} /></div>
              <div className="emp-modal-field"><label className="emp-modal-label">Disponibles</label><input className="emp-modal-input" type="number" value={form.unidades_disponibles} onChange={e => setForm(f => ({...f, unidades_disponibles: e.target.value}))} /></div>
            </div>
            <div className="emp-modal-row">
              <div className="emp-modal-field"><label className="emp-modal-label">Dorm. desde</label><input className="emp-modal-input" type="number" value={form.dormitorios_desde} onChange={e => setForm(f => ({...f, dormitorios_desde: e.target.value}))} /></div>
              <div className="emp-modal-field"><label className="emp-modal-label">Dorm. hasta</label><input className="emp-modal-input" type="number" value={form.dormitorios_hasta} onChange={e => setForm(f => ({...f, dormitorios_hasta: e.target.value}))} /></div>
            </div>
            <div className="emp-modal-row">
              <div className="emp-modal-field"><label className="emp-modal-label">Sup. desde (m²)</label><input className="emp-modal-input" type="number" value={form.sup_desde} onChange={e => setForm(f => ({...f, sup_desde: e.target.value}))} /></div>
              <div className="emp-modal-field"><label className="emp-modal-label">Sup. hasta (m²)</label><input className="emp-modal-input" type="number" value={form.sup_hasta} onChange={e => setForm(f => ({...f, sup_hasta: e.target.value}))} /></div>
            </div>
            <div className="emp-modal-field">
              <label className="emp-modal-label">Amenities</label>
              <div className="emp-amenity-grid">
                {AMENITIES_OPT.map(a => (
                  <button key={a} type="button" className={`emp-amenity-btn${form.amenities.includes(a) ? " activo" : ""}`} onClick={() => toggleAmenity(a)}>{a}</button>
                ))}
              </div>
            </div>

            <div className="emp-modal-section">Contacto y comisión</div>
            <div className="emp-modal-row">
              <div className="emp-modal-field"><label className="emp-modal-label">Nombre de contacto</label><input className="emp-modal-input" value={form.contacto_nombre} onChange={e => setForm(f => ({...f, contacto_nombre: e.target.value}))} /></div>
              <div className="emp-modal-field"><label className="emp-modal-label">Email</label><input className="emp-modal-input" type="email" value={form.contacto_email} onChange={e => setForm(f => ({...f, contacto_email: e.target.value}))} /></div>
            </div>
            <div className="emp-modal-row">
              <div className="emp-modal-field"><label className="emp-modal-label">WhatsApp (con código país)</label><input className="emp-modal-input" value={form.contacto_whatsapp} onChange={e => setForm(f => ({...f, contacto_whatsapp: e.target.value}))} placeholder="5493415551234" /></div>
              <div className="emp-modal-field"><label className="emp-modal-label">Web</label><input className="emp-modal-input" value={form.web_url} onChange={e => setForm(f => ({...f, web_url: e.target.value}))} placeholder="https://..." /></div>
            </div>
            <div className="emp-modal-row">
              <div className="emp-modal-field"><label className="emp-modal-label">Comisión corredor (%)</label><input className="emp-modal-input" type="number" step="0.5" value={form.comision_corredor_pct} onChange={e => setForm(f => ({...f, comision_corredor_pct: e.target.value}))} /></div>
              <div className="emp-modal-field" style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
                  <input type="checkbox" checked={form.es_publica} onChange={e => setForm(f => ({...f, es_publica: e.target.checked}))} />
                  Publicar en marketplace
                </label>
              </div>
            </div>

            <div className="emp-modal-actions">
              <button className="emp-modal-btn-cancel" onClick={() => setMostrarModal(false)}>Cancelar</button>
              <button className="emp-modal-btn-save" onClick={guardar} disabled={guardando || !form.nombre.trim()}>{guardando ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pop: ver contacto de un emprendimiento */}
      {contactoEmp && (() => {
        const emp = items.find(e => e.id === contactoEmp);
        if (!emp) return null;
        const wa = emp.contacto_whatsapp || emp.perfiles?.telefono;
        const email = emp.contacto_email || emp.perfiles?.email;
        const nombre = emp.contacto_nombre || (emp.perfiles ? `${emp.perfiles.nombre} ${emp.perfiles.apellido}` : "—");
        return (
          <div className="emp-contacto-pop" onClick={e => { if (e.target === e.currentTarget) setContactoEmp(null); }}>
            <div className="emp-contacto-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800 }}>{emp.nombre}</div>
                <button onClick={() => setContactoEmp(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>
                {emp.perfiles?.inmobiliaria ?? nombre}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {wa && <a href={`https://wa.me/${wa.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 6, color: "#25d366", fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: "Montserrat,sans-serif" }}>💬 WhatsApp</a>}
                {email && <a href={`mailto:${email}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: "Montserrat,sans-serif" }}>✉ Email</a>}
                {emp.web_url && <a href={emp.web_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: "Montserrat,sans-serif" }}>🌐 Ver web</a>}
              </div>
              {emp.comision_corredor_pct != null && emp.comision_corredor_pct > 0 && (
                <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(204,0,0,0.1)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 6, fontSize: 12, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                  🤝 Comisión para el corredor: {emp.comision_corredor_pct}%
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
