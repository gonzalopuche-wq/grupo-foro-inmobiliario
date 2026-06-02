"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

interface Comparable {
  id: string;
  perfil_id: string;
  anio: number;
  mes: number;
  calle: string;
  altura: string | null;
  barrio: string | null;
  ciudad: string;
  tipo_inmueble: string;
  dormitorios: number | null;
  banos: number | null;
  antiguedad: number | null;
  sup_cubierta: number | null;
  sup_terreno: number | null;
  disposicion: string | null;
  balcon: boolean;
  patio: boolean;
  amenities: string | null;
  precio_publicacion: number | null;
  precio_venta: number | null;
  propuesta_pago: string | null;
  cotizacion_dolar: number | null;
  notas: string | null;
  creado_at: string;
}

const TIPOS = ["Departamento","Casa","PH","Local","Oficina","Cochera","Terreno","Galpon","Otro"];
const DISPOSICIONES = ["Frente","Contrafrente","Lateral","Interior","S/D"];
const BARRIOS = ["Centro","Pichincha","Echesortu","Fisherton","Alberdi","Belgrano","Martin","República de la Sexta","Refinería","Abasto","Lisandro de la Torre","Empalme Graneros","Las Flores","Ludueña","Parque Casas","Parque Yatay","Parque Latinoamericano","Villa Hortensia","Tablada","Saladillo","Barrio Corrientes","La Florida","Parque Sur","Roque Sáenz Peña","Sargento Cabral","Tiro Suizo","Villa del Parque","Otro"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const FORM_VACIO = {
  anio: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,
  calle: "", altura: "", barrio: "", ciudad: "Rosario",
  tipo_inmueble: "", dormitorios: "", banos: "", antiguedad: "",
  sup_cubierta: "", sup_terreno: "", disposicion: "",
  balcon: false, patio: false, amenities: "",
  precio_publicacion: "", precio_venta: "", propuesta_pago: "",
  cotizacion_dolar: "", notas: "",
};

export default function ComparablesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [comparables, setComparables] = useState<Comparable[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [dolarBlue, setDolarBlue] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok"|"err" } | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroBarrio, setFiltroBarrio] = useState("todos");
  const [filtroDorm, setFiltroDorm] = useState("todos");
  const [filtroAnio, setFiltroAnio] = useState("todos");
  const [filtroCiudad, setFiltroCiudad] = useState("todos");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [supMin, setSupMin] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloMios, setSoloMios] = useState(false);
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
      if (perfil?.tipo === "admin" || perfil?.tipo === "master") setEsAdmin(true);

      fetch("https://dolarapi.com/v1/dolares/blue")
        .then(r => r.json())
        .then(d => {
          const prom = Math.round((d.compra + d.venta) / 2);
          setDolarBlue(prom);
          setForm(f => ({ ...f, cotizacion_dolar: prom.toString() }));
        }).catch(() => {});
    };
    init();
    cargar();
  }, []);

  const mostrarToast = (msg: string, tipo: "ok"|"err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("comparables")
      .select("*")
      .order("anio", { ascending: false })
      .order("mes", { ascending: false })
      .order("creado_at", { ascending: false });
    setComparables((data as Comparable[]) ?? []);
    setLoading(false);
  };

  const abrirEditar = (c: Comparable) => {
    setForm({
      anio: c.anio, mes: c.mes, calle: c.calle, altura: c.altura ?? "",
      barrio: c.barrio ?? "", ciudad: c.ciudad, tipo_inmueble: c.tipo_inmueble,
      dormitorios: c.dormitorios?.toString() ?? "", banos: c.banos?.toString() ?? "",
      antiguedad: c.antiguedad?.toString() ?? "", sup_cubierta: c.sup_cubierta?.toString() ?? "",
      sup_terreno: c.sup_terreno?.toString() ?? "", disposicion: c.disposicion ?? "",
      balcon: c.balcon, patio: c.patio, amenities: c.amenities ?? "",
      precio_publicacion: c.precio_publicacion?.toString() ?? "",
      precio_venta: c.precio_venta?.toString() ?? "",
      propuesta_pago: c.propuesta_pago ?? "",
      cotizacion_dolar: c.cotizacion_dolar?.toString() ?? "",
      notas: c.notas ?? "",
    });
    setEditandoId(c.id);
    setMostrarForm(true);
  };

  const guardar = async () => {
    if (!form.calle || !form.tipo_inmueble || !userId) {
      mostrarToast("Calle y tipo de inmueble son obligatorios", "err");
      return;
    }
    setGuardando(true);

    const n = (v: string) => v ? parseFloat(v.replace(",", ".")) : null;
    const i = (v: string) => v ? parseInt(v) : null;

    const payload = {
      perfil_id: userId,
      anio: form.anio, mes: form.mes,
      calle: form.calle.trim(), altura: form.altura || null,
      barrio: form.barrio || null, ciudad: form.ciudad,
      tipo_inmueble: form.tipo_inmueble,
      dormitorios: i(form.dormitorios), banos: i(form.banos),
      antiguedad: i(form.antiguedad), sup_cubierta: n(form.sup_cubierta),
      sup_terreno: n(form.sup_terreno), disposicion: form.disposicion || null,
      balcon: form.balcon, patio: form.patio,
      amenities: form.amenities || null,
      precio_publicacion: n(form.precio_publicacion),
      precio_venta: n(form.precio_venta),
      propuesta_pago: form.propuesta_pago || null,
      cotizacion_dolar: n(form.cotizacion_dolar),
      notas: form.notas || null,
    };

    if (editandoId) {
      const { error } = await supabase.from("comparables").update({ ...payload, actualizado_at: new Date().toISOString() }).eq("id", editandoId);
      if (error) { mostrarToast("Error al actualizar", "err"); }
      else { mostrarToast("Comparable actualizado"); }
    } else {
      const { error } = await supabase.from("comparables").insert(payload);
      if (error) { mostrarToast("Error al guardar", "err"); }
      else { mostrarToast("Comparable cargado"); }
    }

    setGuardando(false);
    setMostrarForm(false);
    setEditandoId(null);
    setForm({ ...FORM_VACIO, cotizacion_dolar: dolarBlue?.toString() ?? "" });
    cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este comparable?")) return;
    await supabase.from("comparables").delete().eq("id", id);
    mostrarToast("Comparable eliminado");
    cargar();
  };

  // Filtrado
  const filtrados = comparables.filter(c => {
    if (soloMios && c.perfil_id !== userId) return false;
    if (filtroTipo !== "todos" && c.tipo_inmueble !== filtroTipo) return false;
    if (filtroBarrio !== "todos" && c.barrio !== filtroBarrio) return false;
    if (filtroCiudad !== "todos" && c.ciudad !== filtroCiudad) return false;
    if (filtroAnio !== "todos" && c.anio.toString() !== filtroAnio) return false;
    if (filtroDorm !== "todos") {
      if (filtroDorm === "4+" && (c.dormitorios ?? 0) < 4) return false;
      if (filtroDorm !== "4+" && c.dormitorios?.toString() !== filtroDorm) return false;
    }
    if (precioMin && (c.precio_venta ?? 0) < parseFloat(precioMin)) return false;
    if (precioMax && (c.precio_venta ?? 0) > parseFloat(precioMax)) return false;
    if (supMin && (c.sup_cubierta ?? 0) < parseFloat(supMin)) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return c.calle.toLowerCase().includes(q) || c.barrio?.toLowerCase().includes(q) || c.tipo_inmueble.toLowerCase().includes(q) || c.ciudad?.toLowerCase().includes(q);
    }
    return true;
  });

  const barriosUnicos = ["todos", ...Array.from(new Set(comparables.map(c => c.barrio).filter(Boolean))).sort() as string[]];
  const tiposUnicos = ["todos", ...Array.from(new Set(comparables.map(c => c.tipo_inmueble))).sort()];
  const aniosUnicos = ["todos", ...Array.from(new Set(comparables.map(c => c.anio.toString()))).sort((a,b) => parseInt(b)-parseInt(a))];
  const ciudadesUnicas = ["todos", ...Array.from(new Set(comparables.map(c => c.ciudad).filter(Boolean))).sort() as string[]];

  const formatUSD = (n: number | null) => n ? `USD ${n.toLocaleString("es-AR")}` : "—";
  const formatNum = (n: number | null) => n ? n.toLocaleString("es-AR") : "—";

  return (
    <>
      <style>{`
        .cmp-wrap { display: flex; flex-direction: column; gap: 20px; }
        .cmp-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .cmp-titulo { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--gfi-text-primary); }
        .cmp-titulo span { color: var(--gfi-red); }
        .cmp-sub { font-size: 13px; color: var(--gfi-text-muted); margin-top: 4px; }
        .cmp-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .cmp-stat { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); padding: 10px 16px; text-align: center; min-width: 80px; }
        .cmp-stat-val { font-family: var(--font-mono); font-size: 20px; font-weight: 800; color: var(--gfi-red); font-variant-numeric: tabular-nums; }
        .cmp-stat-label { font-size: 9px; color: var(--gfi-text-muted); margin-top: 2px; font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.1em; }
        .cmp-btn-nuevo { padding: 10px 20px; background: var(--gfi-red); border: none; border-radius: var(--gfi-radius-sm); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: var(--gfi-transition); }
        .cmp-btn-nuevo:hover { background: var(--gfi-red-hover); }
        .cmp-filtros { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .cmp-search { flex: 1; min-width: 180px; padding: 9px 12px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); }
        .cmp-search:focus { border-color: var(--gfi-red-border); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .cmp-search::placeholder { color: var(--gfi-text-muted); }
        .cmp-select { padding: 9px 10px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-secondary); font-size: 12px; outline: none; font-family: var(--font-body); cursor: pointer; transition: var(--gfi-transition); }
        .cmp-select:focus { border-color: var(--gfi-red-border); }
        .cmp-toggle { display: flex; align-items: center; gap: 7px; cursor: pointer; user-select: none; }
        .cmp-toggle-switch { width: 32px; height: 16px; border-radius: 8px; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .cmp-toggle-knob { position: absolute; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: left 0.2s; }
        .cmp-toggle-label { font-size: 11px; color: var(--gfi-text-muted); font-family: var(--font-display); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .cmp-count { font-size: 11px; color: var(--gfi-text-muted); white-space: nowrap; font-family: var(--font-mono); }

        /* Tabla */
        .cmp-tabla-wrap { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); overflow: auto; }
        .cmp-tabla { width: 100%; border-collapse: collapse; min-width: 900px; }
        .cmp-tabla thead tr { background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--gfi-border); }
        .cmp-tabla th { padding: 11px 14px; text-align: left; font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gfi-text-muted); white-space: nowrap; }
        .cmp-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background var(--gfi-transition); }
        .cmp-tabla tbody tr:last-child { border-bottom: none; }
        .cmp-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .cmp-tabla td { padding: 12px 14px; font-size: 12px; color: var(--gfi-text-secondary); vertical-align: middle; }
        .cmp-direccion { font-weight: 600; color: var(--gfi-text-primary); font-size: 13px; }
        .cmp-sub-info { font-size: 10px; color: var(--gfi-text-muted); margin-top: 2px; }
        .cmp-tipo-badge { font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); color: var(--gfi-red); }
        .cmp-precio { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--gfi-green-text); font-variant-numeric: tabular-nums; }
        .cmp-precio-pub { font-family: var(--font-mono); font-size: 10px; color: var(--gfi-text-muted); margin-top: 2px; text-decoration: line-through; font-variant-numeric: tabular-nums; }
        .cmp-acciones { display: flex; gap: 6px; }
        .cmp-btn-sm { padding: 5px 10px; border-radius: var(--gfi-radius-sm); font-family: var(--font-display); font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); border: 1px solid; }
        .cmp-btn-editar { background: transparent; border-color: var(--gfi-border); color: var(--gfi-text-muted); }
        .cmp-btn-editar:hover { border-color: rgba(255,255,255,0.3); color: var(--gfi-text-primary); }
        .cmp-btn-eliminar { background: transparent; border-color: var(--gfi-red-border); color: rgba(204,0,0,0.5); }
        .cmp-btn-eliminar:hover { background: var(--gfi-red-soft); border-color: var(--gfi-red); color: var(--gfi-red); }
        .cmp-mio { font-size: 8px; color: var(--gfi-red); font-family: var(--font-display); font-weight: 700; }
        .cmp-empty { padding: 64px; text-align: center; color: var(--gfi-text-muted); font-size: 13px; font-style: italic; }
        .cmp-spinner { display: flex; align-items: center; justify-content: center; padding: 64px; }
        .cmp-spin { width: 28px; height: 28px; border: 2px solid var(--gfi-red-soft); border-top-color: var(--gfi-red); border-radius: 50%; animation: gfi-spin 0.7s linear infinite; }

        /* Modal */
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; }
        .modal { background: var(--gfi-bg-card); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-md); padding: 28px 30px; width: 100%; max-width: 720px; position: relative; max-height: 92vh; overflow-y: auto; box-shadow: var(--gfi-shadow-lg); }
        .modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--gfi-red-gradient); border-radius: var(--gfi-radius-md) var(--gfi-radius-md) 0 0; }
        .modal-titulo { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--gfi-text-primary); margin-bottom: 20px; }
        .modal-titulo span { color: var(--gfi-red); }
        .modal-seccion { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gfi-text-muted); margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--gfi-border); }
        .modal-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .full { grid-column: 1 / -1; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gfi-text-muted); }
        .field input, .field select, .field textarea { padding: 8px 11px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); width: 100%; }
        .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--gfi-red-border); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .field input::placeholder, .field textarea::placeholder { color: var(--gfi-text-muted); }
        .field select { background: var(--gfi-bg-card); }
        .field textarea { resize: vertical; min-height: 70px; }
        .checks { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px; }
        .check-item { display: flex; align-items: center; gap: 7px; cursor: pointer; font-size: 12px; color: var(--gfi-text-secondary); }
        .check-item input { width: 14px; height: 14px; cursor: pointer; accent-color: var(--gfi-red); }
        .dolar-ref { font-size: 11px; color: var(--gfi-text-muted); margin-top: 3px; font-family: var(--font-mono); }
        .dolar-ref strong { color: var(--gfi-green-text); }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--gfi-border); }
        .btn-cancel { padding: 9px 18px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .btn-cancel:hover { border-color: rgba(255,255,255,0.25); color: var(--gfi-text-primary); }
        .btn-save { padding: 9px 22px; background: var(--gfi-red); border: none; border-radius: var(--gfi-radius-sm); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .btn-save:hover:not(:disabled) { background: var(--gfi-red-hover); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: var(--gfi-radius-md); font-family: var(--font-display); font-size: 12px; font-weight: 700; z-index: 999; animation: gfi-slide-up 0.3s ease; box-shadow: var(--gfi-shadow-md); }
        .toast.ok { background: var(--gfi-green-soft); border: 1px solid rgba(16,185,129,0.3); color: var(--gfi-green-text); }
        .toast.err { background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); color: #ff6666; }
        @media print { body * { display: none !important; } }
      `}</style>

      <div className="cmp-wrap">
        {/* Header */}
        <div className="cmp-header">
          <div>
            <div className="cmp-titulo">Comparables de <span>Venta</span></div>
            <div className="cmp-sub">Solo ventas cerradas · 2da Circunscripción COCIR · Datos anonimizados por corredor</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <div className="cmp-stats">
              <div className="cmp-stat">
                <div className="cmp-stat-val">{comparables.length}</div>
                <div className="cmp-stat-label">Total</div>
              </div>
              <div className="cmp-stat">
                <div className="cmp-stat-val">{comparables.filter(c=>c.perfil_id===userId).length}</div>
                <div className="cmp-stat-label">Míos</div>
              </div>
            </div>
            <Link href="/comparables/barrios" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "var(--gfi-bg-elevated)", border: "1px solid var(--gfi-border)", borderRadius: "var(--gfi-radius-sm)", color: "var(--gfi-text-secondary)", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", whiteSpace: "nowrap" }}>
              📍 Consulta Barrios
            </Link>
            <Link href="/comparables/tasador" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "var(--gfi-red-soft)", border: "1px solid var(--gfi-red-border)", borderRadius: "var(--gfi-radius-sm)", color: "var(--gfi-red)", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", whiteSpace: "nowrap" }}>
              🤖 Tasador IA
            </Link>
            <button className="cmp-btn-nuevo" onClick={() => { setForm({...FORM_VACIO,cotizacion_dolar:dolarBlue?.toString()??""}); setEditandoId(null); setMostrarForm(true); }}>
              + Cargar comparable
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div className="cmp-filtros">
            <input className="cmp-search" placeholder="Buscar calle, barrio, ciudad, tipo..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
            <select className="cmp-select" value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
              {tiposUnicos.map(t=><option key={t} value={t}>{t==="todos"?"Todos los tipos":t}</option>)}
            </select>
            <select className="cmp-select" value={filtroBarrio} onChange={e=>setFiltroBarrio(e.target.value)}>
              {barriosUnicos.map(b=><option key={b} value={b}>{b==="todos"?"Todos los barrios":b}</option>)}
            </select>
            <select className="cmp-select" value={filtroDorm} onChange={e=>setFiltroDorm(e.target.value)}>
              <option value="todos">Dorm: todos</option>
              {["1","2","3","4+"].map(d=><option key={d} value={d}>{d} dorm.</option>)}
            </select>
            <button
              className="cmp-select"
              style={{cursor:"pointer",color:mostrarFiltrosAvanzados?"#cc0000":"rgba(255,255,255,0.6)",borderColor:mostrarFiltrosAvanzados?"rgba(200,0,0,0.4)":"rgba(255,255,255,0.1)"}}
              onClick={()=>setMostrarFiltrosAvanzados(v=>!v)}
            >
              {mostrarFiltrosAvanzados?"▲ Menos filtros":"▼ Más filtros"}
            </button>
            <div className="cmp-toggle" onClick={()=>setSoloMios(v=>!v)}>
              <div className="cmp-toggle-switch" style={{background:soloMios?"#cc0000":"rgba(255,255,255,0.1)"}}>
                <div className="cmp-toggle-knob" style={{left:soloMios?18:2}}/>
              </div>
              <span className="cmp-toggle-label">Solo míos</span>
            </div>
            <span className="cmp-count">{filtrados.length} resultado{filtrados.length!==1?"s":""}</span>
          </div>

          {mostrarFiltrosAvanzados && (
            <div className="cmp-filtros" style={{background:"var(--gfi-bg-secondary)",border:"1px solid var(--gfi-border)",borderRadius:"var(--gfi-radius-sm)",padding:"10px 12px"}}>
              <select className="cmp-select" value={filtroAnio} onChange={e=>setFiltroAnio(e.target.value)}>
                {aniosUnicos.map(a=><option key={a} value={a}>{a==="todos"?"Todos los años":a}</option>)}
              </select>
              <select className="cmp-select" value={filtroCiudad} onChange={e=>setFiltroCiudad(e.target.value)}>
                {ciudadesUnicas.map(c=><option key={c} value={c}>{c==="todos"?"Todas las ciudades":c}</option>)}
              </select>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:"var(--gfi-text-muted)",whiteSpace:"nowrap",fontFamily:"var(--font-body)"}}>Precio USD:</span>
                <input className="cmp-search" style={{width:90,minWidth:0}} placeholder="Desde" value={precioMin} onChange={e=>setPrecioMin(e.target.value)} type="number" />
                <span style={{fontSize:11,color:"var(--gfi-text-muted)"}}>—</span>
                <input className="cmp-search" style={{width:90,minWidth:0}} placeholder="Hasta" value={precioMax} onChange={e=>setPrecioMax(e.target.value)} type="number" />
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:"var(--gfi-text-muted)",whiteSpace:"nowrap",fontFamily:"var(--font-body)"}}>Sup. mín (m²):</span>
                <input className="cmp-search" style={{width:80,minWidth:0}} placeholder="Ej: 50" value={supMin} onChange={e=>setSupMin(e.target.value)} type="number" />
              </div>
              <button
                style={{padding:"6px 12px",background:"transparent",border:"1px solid var(--gfi-border)",borderRadius:"var(--gfi-radius-sm)",color:"var(--gfi-text-muted)",fontSize:10,fontFamily:"var(--font-display)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer"}}
                onClick={()=>{ setFiltroAnio("todos"); setFiltroCiudad("todos"); setPrecioMin(""); setPrecioMax(""); setSupMin(""); setFiltroTipo("todos"); setFiltroBarrio("todos"); setFiltroDorm("todos"); setBusqueda(""); setSoloMios(false); }}
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="cmp-spinner"><div className="cmp-spin"/></div>
        ) : filtrados.length === 0 ? (
          <div className="cmp-tabla-wrap"><div className="cmp-empty">{comparables.length===0?"Todavía no hay comparables. ¡Cargá el primero!":"No hay comparables con ese filtro."}</div></div>
        ) : (
          <div className="cmp-tabla-wrap">
            <table className="cmp-tabla">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Dirección</th>
                  <th>Tipo</th>
                  <th>Sup. / Dorm.</th>
                  <th>Precio venta</th>
                  <th>Cotiz. USD</th>
                  <th>Pago</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const esPropio = c.perfil_id === userId;
                  return (
                    <tr key={c.id}>
                      <td style={{whiteSpace:"nowrap",fontSize:11,color:"var(--gfi-text-muted)",fontFamily:"var(--font-mono)",fontWeight:700,fontVariantNumeric:"tabular-nums"}}>
                        {MESES[c.mes-1]?.slice(0,3)} {c.anio}
                      </td>
                      <td>
                        <div className="cmp-direccion">{c.calle}{c.altura ? ` ${c.altura}` : ""}</div>
                        <div className="cmp-sub-info">{[c.barrio,c.ciudad].filter(Boolean).join(" · ")}</div>
                        {esPropio && <div className="cmp-mio">✓ Mi registro</div>}
                      </td>
                      <td><span className="cmp-tipo-badge">{c.tipo_inmueble}</span></td>
                      <td>
                        {c.sup_cubierta && <div style={{fontSize:12}}>{c.sup_cubierta} m²</div>}
                        {c.dormitorios && <div className="cmp-sub-info">{c.dormitorios} dorm. {c.banos ? `· ${c.banos} baños` : ""}</div>}
                        {c.disposicion && <div className="cmp-sub-info">{c.disposicion}</div>}
                      </td>
                      <td>
                        <div className="cmp-precio">{formatUSD(c.precio_venta)}</div>
                        {c.precio_publicacion && c.precio_publicacion !== c.precio_venta && (
                          <div className="cmp-precio-pub">{formatUSD(c.precio_publicacion)}</div>
                        )}
                      </td>
                      <td style={{fontSize:11,color:"var(--gfi-text-muted)",fontFamily:"var(--font-mono)",fontVariantNumeric:"tabular-nums"}}>
                        {c.cotizacion_dolar ? `$${formatNum(c.cotizacion_dolar)}` : "—"}
                      </td>
                      <td style={{fontSize:11,color:"var(--gfi-text-secondary)",maxWidth:120,fontFamily:"var(--font-body)"}}>{c.propuesta_pago ?? "—"}</td>
                      <td>
                        {esPropio && (
                          <div className="cmp-acciones">
                            <button className="cmp-btn-sm cmp-btn-editar" onClick={()=>abrirEditar(c)}>✏ Editar</button>
                            <button className="cmp-btn-sm cmp-btn-eliminar" onClick={()=>eliminar(c.id)}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {mostrarForm && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setMostrarForm(false);setEditandoId(null);}}}>
          <div className="modal">
            <div className="modal-titulo">{editandoId?"Editar":"Cargar"} <span>comparable</span></div>

            <div className="modal-seccion">Período y ubicación</div>
            <div className="modal-grid">
              <div className="field">
                <label>Año *</label>
                <select value={form.anio} onChange={e=>setForm(f=>({...f,anio:parseInt(e.target.value)}))}>
                  {Array.from({length:6},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Mes *</label>
                <select value={form.mes} onChange={e=>setForm(f=>({...f,mes:parseInt(e.target.value)}))}>
                  {MESES.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Ciudad</label>
                <input value={form.ciudad} onChange={e=>setForm(f=>({...f,ciudad:e.target.value}))} />
              </div>
              <div className="field" style={{gridColumn:"1/3"}}>
                <label>Calle *</label>
                <input placeholder="Ej: Córdoba, San Martín, Pellegrini..." value={form.calle} onChange={e=>setForm(f=>({...f,calle:e.target.value}))} />
              </div>
              <div className="field">
                <label>Altura</label>
                <input placeholder="Ej: 1200" value={form.altura} onChange={e=>setForm(f=>({...f,altura:e.target.value}))} />
              </div>
              <div className="field" style={{gridColumn:"1/3"}}>
                <label>Barrio</label>
                <select value={form.barrio} onChange={e=>setForm(f=>({...f,barrio:e.target.value}))}>
                  <option value="">Seleccioná barrio</option>
                  {BARRIOS.map(b=><option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div className="modal-seccion">Características</div>
            <div className="modal-grid">
              <div className="field">
                <label>Tipo *</label>
                <select value={form.tipo_inmueble} onChange={e=>setForm(f=>({...f,tipo_inmueble:e.target.value}))}>
                  <option value="">Tipo</option>
                  {TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Dormitorios</label>
                <input type="number" min="0" max="20" placeholder="0" value={form.dormitorios} onChange={e=>setForm(f=>({...f,dormitorios:e.target.value}))} />
              </div>
              <div className="field">
                <label>Baños</label>
                <input type="number" min="0" max="10" placeholder="0" value={form.banos} onChange={e=>setForm(f=>({...f,banos:e.target.value}))} />
              </div>
              <div className="field">
                <label>Sup. cubierta (m²)</label>
                <input type="number" placeholder="0" value={form.sup_cubierta} onChange={e=>setForm(f=>({...f,sup_cubierta:e.target.value}))} />
              </div>
              <div className="field">
                <label>Sup. terreno (m²)</label>
                <input type="number" placeholder="0" value={form.sup_terreno} onChange={e=>setForm(f=>({...f,sup_terreno:e.target.value}))} />
              </div>
              <div className="field">
                <label>Antigüedad (años)</label>
                <input type="number" min="0" placeholder="0" value={form.antiguedad} onChange={e=>setForm(f=>({...f,antiguedad:e.target.value}))} />
              </div>
              <div className="field">
                <label>Disposición</label>
                <select value={form.disposicion} onChange={e=>setForm(f=>({...f,disposicion:e.target.value}))}>
                  <option value="">S/D</option>
                  {DISPOSICIONES.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="field full">
                <label>Amenities</label>
                <input placeholder="Ej: Pileta, SUM, Gimnasio, Parrilla" value={form.amenities} onChange={e=>setForm(f=>({...f,amenities:e.target.value}))} />
              </div>
              <div className="field full">
                <div className="checks">
                  <label className="check-item"><input type="checkbox" checked={form.balcon} onChange={e=>setForm(f=>({...f,balcon:e.target.checked}))}/> Balcón</label>
                  <label className="check-item"><input type="checkbox" checked={form.patio} onChange={e=>setForm(f=>({...f,patio:e.target.checked}))}/> Patio</label>
                </div>
              </div>
            </div>

            <div className="modal-seccion">Precios</div>
            <div className="modal-grid">
              <div className="field">
                <label>Precio publicación (USD)</label>
                <input type="number" placeholder="0" value={form.precio_publicacion} onChange={e=>setForm(f=>({...f,precio_publicacion:e.target.value}))} />
              </div>
              <div className="field">
                <label>Precio real de venta (USD) *</label>
                <input type="number" placeholder="0" value={form.precio_venta} onChange={e=>setForm(f=>({...f,precio_venta:e.target.value}))} />
              </div>
              <div className="field">
                <label>Cotización dólar (ARS)</label>
                <input type="number" placeholder="0" value={form.cotizacion_dolar} onChange={e=>setForm(f=>({...f,cotizacion_dolar:e.target.value}))} />
                {dolarBlue && <div className="dolar-ref">Blue hoy: <strong>${dolarBlue.toLocaleString("es-AR")}</strong></div>}
              </div>
              <div className="field full">
                <label>Propuesta de pago</label>
                <input placeholder="Ej: 70% efectivo + 30% financiado, todo efectivo, permuta..." value={form.propuesta_pago} onChange={e=>setForm(f=>({...f,propuesta_pago:e.target.value}))} />
              </div>
              <div className="field full">
                <label>Notas internas</label>
                <textarea placeholder="Observaciones, contexto de la venta, detalles relevantes..." value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>{setMostrarForm(false);setEditandoId(null);}}>Cancelar</button>
              <button className="btn-save" onClick={guardar} disabled={guardando||!form.calle||!form.tipo_inmueble}>
                {guardando?"Guardando...":editandoId?"Guardar cambios":"Cargar comparable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
