"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// ── CONSTANTES ──────────────────────────────────────────────────────────
const OPS_OFRECIDO = [
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "temporario", label: "Temporario" },
  { value: "permuta", label: "Permuta" },
  { value: "comercial", label: "Inmueble Comercial" },
  { value: "fondo_comercio", label: "Fondo de Comercio" },
  { value: "campo", label: "Campo / Chacra" },
];

const OPS_BUSQUEDA = [
  { value: "compra", label: "Comprar" },
  { value: "alquiler", label: "Alquilar" },
  { value: "temporario", label: "Temporario" },
  { value: "permuta", label: "Permuta" },
  { value: "comercial", label: "Inmueble Comercial" },
  { value: "fondo_comercio", label: "Fondo de Comercio" },
  { value: "campo", label: "Campo / Chacra" },
];

const MATCH_OP: Record<string, string> = {
  venta: "compra",
  alquiler: "alquiler",
  temporario: "temporario",
  permuta: "permuta",
  comercial: "comercial",
  fondo_comercio: "fondo_comercio",
  campo: "campo",
};

const TIPOS_PROPIEDAD = [
  "Departamento", "Casa", "Terreno o Lote", "Departamento de Pasillo",
  "Cochera", "Oficina", "Local Comercial", "Galpón", "Campo",
  "Negocio o Fondo de Comercio", "Consultorio", "Baulera", "Hotel", "Habitación",
  "Chacra", "Establecimiento Rural", "Inmueble Comercial",
];

const LOCALIDADES = [
  "Rosario", "Roldán", "Funes", "San Lorenzo", "Capitán Bermúdez",
  "Granadero Baigorria", "Pérez", "Soldini", "Ricardone", "Alvear",
  "Villa Gobernador Gálvez", "Pueblo Esther", "General Lagos", "Arroyo Seco",
  "Casilda", "Carcarañá", "Cañada de Gómez", "Villa Constitución",
  "San Jerónimo Norte", "Acebal", "Totoras", "Rufino", "Venado Tuerto",
];

const ANTIGUEDADES = [
  { value: "", label: "Cualquier antigüedad" },
  { value: "a_estrenar", label: "A estrenar" },
  { value: "menos_5", label: "Menos de 5 años" },
  { value: "5_10", label: "5 a 10 años" },
  { value: "10_20", label: "10 a 20 años" },
  { value: "mas_20", label: "Más de 20 años" },
];

const OP_COLOR: Record<string, string> = {
  venta: "#22c55e", compra: "#22c55e",
  alquiler: "#60a5fa",
  temporario: "#eab308",
  permuta: "#c084fc",
  comercial: "#f97316",
  fondo_comercio: "#fb7185",
  campo: "#84cc16",
};

const OP_LABEL: Record<string, string> = {
  venta: "Venta", compra: "Comprar", alquiler: "Alquiler",
  temporario: "Temporario", permuta: "Permuta",
  comercial: "Inmueble Comercial", fondo_comercio: "Fondo de Comercio",
  campo: "Campo / Chacra",
};

// ── TIPOS ───────────────────────────────────────────────────────────────
interface Ofrecido {
  id: string; perfil_id: string; operacion: string; tipo_propiedad: string;
  zona: string | null; ciudad: string; precio: number | null; moneda: string;
  dormitorios: number | null; banos: number | null;
  superficie_cubierta: number | null; superficie_total: number | null;
  antiguedad: string | null;
  apto_credito: boolean; uso_comercial: boolean; barrio_cerrado: boolean;
  con_cochera: boolean; acepta_mascotas: boolean; acepta_bitcoin: boolean;
  descripcion: string | null; activo: boolean; created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; };
}

interface Busqueda {
  id: string; perfil_id: string; operacion: string; tipo_propiedad: string;
  zona: string | null; ciudad: string;
  presupuesto_min: number | null; presupuesto_max: number | null; moneda: string;
  dormitorios_min: number | null; dormitorios_max: number | null;
  banos_min: number | null; banos_max: number | null;
  superficie_min: number | null; superficie_max: number | null;
  tipo_superficie: string;
  antiguedad: string | null;
  apto_credito: boolean; uso_comercial: boolean; con_cochera: boolean;
  barrio_cerrado: boolean; acepta_mascotas: boolean; acepta_bitcoin: boolean;
  descripcion: string | null; activo: boolean; created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null; };
}

interface Match {
  id: string; ofrecido_id: string; busqueda_id: string;
  costo_desbloqueo: number; desbloqueado_ofrecido: boolean; desbloqueado_busqueda: boolean;
  created_at: string;
}

// Filtros de lista
interface FiltroLista {
  operaciones: string[];
  localidades: string[];
  tipos: string[];
  sup_min: string;
  sup_max: string;
  apto_credito: boolean;
  con_cochera: boolean;
  uso_comercial: boolean;
  barrio_cerrado: boolean;
  acepta_mascotas: boolean;
  acepta_bitcoin: boolean;
}

const FILTRO_VACIO: FiltroLista = {
  operaciones: [], localidades: [], tipos: [],
  sup_min: "", sup_max: "",
  apto_credito: false, con_cochera: false, uso_comercial: false,
  barrio_cerrado: false, acepta_mascotas: false, acepta_bitcoin: false,
};

const FORM_O = {
  operacion: "venta", tipo_propiedad: "Departamento",
  zona: "", ciudad: "Rosario", precio: "", moneda: "USD",
  dormitorios: "", banos: "", superficie_cubierta: "", superficie_total: "",
  antiguedad: "",
  apto_credito: false, uso_comercial: false, barrio_cerrado: false,
  con_cochera: false, acepta_mascotas: false, acepta_bitcoin: false,
  descripcion: "",
};

const FORM_B = {
  operacion: "compra", tipo_propiedad: "Departamento",
  zona: "", ciudad: "Rosario",
  presupuesto_min: "", presupuesto_max: "", moneda: "USD",
  dormitorios_min: "", dormitorios_max: "", banos_min: "", banos_max: "",
  superficie_min: "", superficie_max: "", tipo_superficie: "total",
  antiguedad: "",
  apto_credito: false, uso_comercial: false, con_cochera: false,
  barrio_cerrado: false, acepta_mascotas: false, acepta_bitcoin: false,
  descripcion: "",
};

// ── HELPERS ──────────────────────────────────────────────────────────────
const n = (v: string) => v ? parseFloat(v) : null;
const ni = (v: string) => v ? parseInt(v) : null;
const formatPeso = (v: number, m = "ARS") =>
  m === "USD" ? `USD ${v.toLocaleString("es-AR")}` :
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v);
const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onChange(!value)}>
    <div style={{ width: 38, height: 22, borderRadius: 11, background: value ? "#cc0000" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: value ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{label}</span>
  </div>
);

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────
export default function MirPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [vista, setVista] = useState<"ofrecidos" | "busquedas" | "matches">("ofrecidos");
  const [ofrecidos, setOfrecidos] = useState<Ofrecido[]>([]);
  const [busquedas, setBusquedas] = useState<Busqueda[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [costoMatch, setCostoMatch] = useState(5000);
  const [loading, setLoading] = useState(true);
  const [mostrarFormO, setMostrarFormO] = useState(false);
  const [mostrarFormB, setMostrarFormB] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [formO, setFormO] = useState(FORM_O);
  const [formB, setFormB] = useState(FORM_B);
  const [filtro, setFiltro] = useState<FiltroLista>(FILTRO_VACIO);
  const [filtroTemp, setFiltroTemp] = useState<FiltroLista>(FILTRO_VACIO);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      const params = new URLSearchParams(window.location.search);
      const nuevo = params.get("nuevo");
      const vistaParam = params.get("vista");
      if (nuevo === "ofrecido") setMostrarFormO(true);
      else if (nuevo === "busqueda") { setVista("busquedas"); setMostrarFormB(true); }
      else if (vistaParam === "matches") setVista("matches");
    };
    init();
    supabase.from("indicadores").select("valor").eq("clave", "costo_match_mir").single()
      .then(({ data }) => { if (data?.valor) setCostoMatch(data.valor); });
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: of }, { data: bu }, { data: ma }] = await Promise.all([
      supabase.from("mir_ofrecidos").select("*, perfiles(nombre,apellido,matricula)").eq("activo", true).order("created_at", { ascending: false }),
      supabase.from("mir_busquedas").select("*, perfiles(nombre,apellido,matricula)").eq("activo", true).order("created_at", { ascending: false }),
      supabase.from("mir_matches").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setOfrecidos((of as unknown as Ofrecido[]) ?? []);
    setBusquedas((bu as unknown as Busqueda[]) ?? []);
    setMatches((ma as unknown as Match[]) ?? []);
    setLoading(false);
  };

  // Aplicar filtros localmente
  const aplicarFiltros = <T extends Ofrecido | Busqueda>(items: T[]): T[] => {
    return items.filter(item => {
      const op = "precio" in item ? item.operacion : item.operacion;
      if (filtro.operaciones.length > 0 && !filtro.operaciones.includes(op)) return false;
      if (filtro.localidades.length > 0 && !filtro.localidades.some(l => item.ciudad.toLowerCase().includes(l.toLowerCase()))) return false;
      if (filtro.tipos.length > 0 && !filtro.tipos.includes(item.tipo_propiedad)) return false;
      if (filtro.apto_credito && !item.apto_credito) return false;
      if (filtro.uso_comercial && !item.uso_comercial) return false;
      if (filtro.barrio_cerrado && !item.barrio_cerrado) return false;
      if (filtro.acepta_mascotas && !item.acepta_mascotas) return false;
      if (filtro.acepta_bitcoin && !item.acepta_bitcoin) return false;
      if (filtro.con_cochera && !("con_cochera" in item && item.con_cochera)) return false;
      return true;
    });
  };

  const matchearOfrecido = async (of: Ofrecido) => {
    const opBusqueda = MATCH_OP[of.operacion];
    if (!opBusqueda) return;
    const { data: busqs } = await supabase.from("mir_busquedas").select("*")
      .eq("activo", true).eq("operacion", opBusqueda).eq("tipo_propiedad", of.tipo_propiedad).neq("perfil_id", of.perfil_id);
    for (const b of (busqs as Busqueda[]) ?? []) {
      if (cumpleMatch(of, b)) {
        await supabase.from("mir_matches").upsert(
          { ofrecido_id: of.id, busqueda_id: b.id, costo_desbloqueo: costoMatch },
          { onConflict: "ofrecido_id,busqueda_id" }
        );
      }
    }
  };

  const matchearBusqueda = async (bu: Busqueda) => {
    const opOfrecido = Object.entries(MATCH_OP).find(([, v]) => v === bu.operacion)?.[0];
    if (!opOfrecido) return;
    const { data: ofrs } = await supabase.from("mir_ofrecidos").select("*")
      .eq("activo", true).eq("operacion", opOfrecido).eq("tipo_propiedad", bu.tipo_propiedad).neq("perfil_id", bu.perfil_id);
    for (const o of (ofrs as Ofrecido[]) ?? []) {
      if (cumpleMatch(o, bu)) {
        await supabase.from("mir_matches").upsert(
          { ofrecido_id: o.id, busqueda_id: bu.id, costo_desbloqueo: costoMatch },
          { onConflict: "ofrecido_id,busqueda_id" }
        );
      }
    }
  };

  const cumpleMatch = (of: Ofrecido, bu: Busqueda): boolean => {
    const ciudadOk = bu.ciudad.toLowerCase() === of.ciudad.toLowerCase();
    const zonaOk = !bu.zona || !of.zona || of.zona.toLowerCase().includes(bu.zona.toLowerCase());
    const precioOk = !bu.presupuesto_max || !of.precio || of.precio <= bu.presupuesto_max;
    const precioMinOk = !bu.presupuesto_min || !of.precio || of.precio >= bu.presupuesto_min;
    const dormOk = !bu.dormitorios_min || !of.dormitorios || of.dormitorios >= bu.dormitorios_min;
    const dormMaxOk = !bu.dormitorios_max || !of.dormitorios || of.dormitorios <= bu.dormitorios_max;
    const banosOk = !bu.banos_min || !of.banos || of.banos >= bu.banos_min;
    const supOk = !bu.superficie_min || !of.superficie_total || of.superficie_total >= bu.superficie_min;
    const supMaxOk = !bu.superficie_max || !of.superficie_total || of.superficie_total <= bu.superficie_max;
    const creditoOk = !bu.apto_credito || of.apto_credito;
    const mascotasOk = !bu.acepta_mascotas || of.acepta_mascotas;
    const cocheraOk = !bu.con_cochera || of.con_cochera;
    return ciudadOk && zonaOk && precioOk && precioMinOk && dormOk && dormMaxOk && banosOk && supOk && supMaxOk && creditoOk && mascotasOk && cocheraOk;
  };

  const guardarOfrecido = async () => {
    if (!userId || !formO.ciudad) return;
    setGuardando(true);
    const { data: nuevo, error } = await supabase.from("mir_ofrecidos").insert({
      perfil_id: userId, operacion: formO.operacion, tipo_propiedad: formO.tipo_propiedad,
      zona: formO.zona || null, ciudad: formO.ciudad,
      precio: n(formO.precio), moneda: formO.moneda,
      dormitorios: ni(formO.dormitorios), banos: ni(formO.banos),
      superficie_cubierta: n(formO.superficie_cubierta), superficie_total: n(formO.superficie_total),
      antiguedad: formO.antiguedad || null,
      apto_credito: formO.apto_credito, uso_comercial: formO.uso_comercial,
      barrio_cerrado: formO.barrio_cerrado, con_cochera: formO.con_cochera,
      acepta_mascotas: formO.acepta_mascotas, acepta_bitcoin: formO.acepta_bitcoin,
      descripcion: formO.descripcion || null,
    }).select().single();
    if (error) { console.error("Error:", error); setGuardando(false); return; }
    if (nuevo) await matchearOfrecido(nuevo as Ofrecido);
    setGuardando(false); setMostrarFormO(false); setFormO(FORM_O); cargarDatos();
  };

  const guardarBusqueda = async () => {
    if (!userId || !formB.ciudad) return;
    setGuardando(true);
    const { data: nueva, error } = await supabase.from("mir_busquedas").insert({
      perfil_id: userId, operacion: formB.operacion, tipo_propiedad: formB.tipo_propiedad,
      zona: formB.zona || null, ciudad: formB.ciudad,
      presupuesto_min: n(formB.presupuesto_min), presupuesto_max: n(formB.presupuesto_max),
      moneda: formB.moneda,
      dormitorios_min: ni(formB.dormitorios_min), dormitorios_max: ni(formB.dormitorios_max),
      banos_min: ni(formB.banos_min), banos_max: ni(formB.banos_max),
      superficie_min: n(formB.superficie_min), superficie_max: n(formB.superficie_max),
      tipo_superficie: formB.tipo_superficie,
      antiguedad: formB.antiguedad || null,
      apto_credito: formB.apto_credito, uso_comercial: formB.uso_comercial,
      con_cochera: formB.con_cochera, barrio_cerrado: formB.barrio_cerrado,
      acepta_mascotas: formB.acepta_mascotas, acepta_bitcoin: formB.acepta_bitcoin,
      descripcion: formB.descripcion || null,
    }).select().single();
    if (error) { console.error("Error:", error); setGuardando(false); return; }
    if (nueva) await matchearBusqueda(nueva as Busqueda);
    setGuardando(false); setMostrarFormB(false); setFormB(FORM_B); cargarDatos();
  };

  const desactivar = async (tabla: string, id: string) => {
    await supabase.from(tabla).update({ activo: false }).eq("id", id);
    cargarDatos();
  };

  const ofsFilt = aplicarFiltros(ofrecidos);
  const busFilt = aplicarFiltros(busquedas);
  const matchesPropios = matches.filter(m =>
    ofrecidos.find(o => o.id === m.ofrecido_id)?.perfil_id === userId ||
    busquedas.find(b => b.id === m.busqueda_id)?.perfil_id === userId
  );

  const cantFiltrosActivos = filtro.operaciones.length + filtro.localidades.length + filtro.tipos.length +
    [filtro.apto_credito, filtro.con_cochera, filtro.uso_comercial, filtro.barrio_cerrado, filtro.acepta_mascotas, filtro.acepta_bitcoin].filter(Boolean).length;

  const toggleFiltroItem = (key: "operaciones" | "localidades" | "tipos", val: string) => {
    setFiltroTemp(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val]
    }));
  };

  const Card = ({ children, propia }: { children: React.ReactNode; propia: boolean }) => (
    <div className={`mir-card${propia ? " propia" : ""}`}>{children}</div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .mir-tabs { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
        .mir-tab { padding: 9px 22px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; position: relative; }
        .mir-tab.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .mir-tab-badge { position: absolute; top: -6px; right: -6px; background: #cc0000; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 10px; min-width: 16px; text-align: center; }
        .mir-barra { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .mir-barra-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .mir-btn-pub { padding: 9px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
        .mir-btn-pub:hover { background: #e60000; }
        .mir-btn-filtrar { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.55); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .mir-btn-filtrar:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .mir-btn-filtrar.activo { border-color: #cc0000; background: rgba(200,0,0,0.08); color: #fff; }
        .mir-filtro-badge { background: #cc0000; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 10px; }
        .mir-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
        .mir-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; transition: border-color 0.2s; }
        .mir-card:hover { border-color: rgba(200,0,0,0.2); }
        .mir-card.propia { border-color: rgba(200,0,0,0.2); background: rgba(200,0,0,0.03); }
        .mir-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .mir-card-titulo { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .mir-op-badge { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; flex-shrink: 0; }
        .mir-precio { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; color: #22c55e; }
        .mir-zona { font-size: 12px; color: rgba(255,255,255,0.5); }
        .mir-detalles { display: flex; gap: 8px; flex-wrap: wrap; }
        .mir-det { font-size: 11px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 3px; }
        .mir-extras { display: flex; gap: 6px; flex-wrap: wrap; }
        .mir-extra { font-size: 9px; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 10px; }
        .mir-desc { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5; }
        .mir-card-footer { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 2px; }
        .mir-corredor { font-size: 11px; color: rgba(255,255,255,0.4); }
        .mir-corredor b { color: rgba(255,255,255,0.7); }
        .mir-fecha { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 2px; }
        .mir-btn-baja { padding: 4px 10px; background: transparent; border: 1px solid rgba(200,0,0,0.3); border-radius: 3px; color: rgba(200,0,0,0.6); font-size: 9px; cursor: pointer; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .mir-btn-baja:hover { background: rgba(200,0,0,0.1); color: #ff4444; }
        .mir-empty { padding: 64px 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        .mir-match-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(200,0,0,0.2); border-radius: 6px; padding: 16px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .mir-match-lados { display: flex; gap: 16px; flex: 1; flex-wrap: wrap; }
        .mir-match-lado { flex: 1; min-width: 160px; }
        .mir-match-lado-titulo { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 5px; }
        .mir-match-info { font-size: 13px; color: #fff; font-weight: 600; }
        .mir-match-sub { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 3px; }
        .mir-match-sep { width: 1px; background: rgba(255,255,255,0.07); align-self: stretch; }
        .mir-btn-desbloquear { padding: 8px 14px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.3); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .mir-btn-desbloquear:hover { background: rgba(200,0,0,0.2); color: #fff; }
        .mir-costo { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 4px; text-align: center; }
        .mir-nota { font-size: 11px; color: rgba(255,255,255,0.25); text-align: center; padding: 8px 16px; background: rgba(200,0,0,0.04); border: 1px solid rgba(200,0,0,0.1); border-radius: 4px; }

        /* MODAL FILTROS */
        .filtro-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 300; display: flex; justify-content: flex-end; }
        .filtro-panel { width: 420px; max-width: 100vw; background: #111; border-left: 1px solid rgba(255,255,255,0.1); height: 100vh; overflow-y: auto; display: flex; flex-direction: column; animation: slideIn 0.25s ease; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .filtro-panel::-webkit-scrollbar { width: 4px; }
        .filtro-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        .filtro-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; background: #111; z-index: 10; }
        .filtro-title { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .filtro-close { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 20px; cursor: pointer; padding: 4px; line-height: 1; }
        .filtro-close:hover { color: #fff; }
        .filtro-body { flex: 1; padding: 20px 22px; display: flex; flex-direction: column; gap: 22px; }
        .filtro-section-title { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #fff; margin-bottom: 12px; }
        .filtro-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .filtro-chip { padding: 7px 14px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.55); font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; }
        .filtro-chip:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.85); }
        .filtro-chip.activo { border-color: #cc0000; background: rgba(200,0,0,0.12); color: #fff; }
        .filtro-localidades { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-height: 220px; overflow-y: auto; }
        .filtro-localidades::-webkit-scrollbar { width: 3px; }
        .filtro-localidades::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        .filtro-check { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 0; }
        .filtro-check input[type="checkbox"] { width: 15px; height: 15px; accent-color: #cc0000; cursor: pointer; }
        .filtro-check-label { font-size: 12px; color: rgba(255,255,255,0.6); cursor: pointer; }
        .filtro-check:hover .filtro-check-label { color: #fff; }
        .filtro-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .filtro-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .filtro-input:focus { border-color: rgba(200,0,0,0.45); }
        .filtro-input::placeholder { color: rgba(255,255,255,0.2); }
        .filtro-toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .filtro-footer { padding: 16px 22px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 10px; position: sticky; bottom: 0; background: #111; }
        .filtro-btn-limpiar { flex: 1; padding: 11px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .filtro-btn-aplicar { flex: 2; padding: 11px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .filtro-btn-aplicar:hover { background: #e60000; }

        /* MODALES PUBLICAR */
        .fn-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: flex-start; justify-content: center; z-index: 200; padding: 24px; overflow-y: auto; }
        .fn-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 28px 32px; width: 100%; max-width: 580px; position: relative; margin: auto; }
        .fn-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .fn-modal h2 { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 20px; }
        .fn-modal h2 span { color: #cc0000; }
        .fn-field { margin-bottom: 12px; }
        .fn-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 5px; font-family: 'Montserrat', sans-serif; }
        .fn-input { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter', sans-serif; }
        .fn-input:focus { border-color: rgba(200,0,0,0.5); }
        .fn-input::placeholder { color: rgba(255,255,255,0.2); }
        .fn-select { width: 100%; padding: 9px 12px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .fn-textarea { width: 100%; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 70px; font-family: 'Inter', sans-serif; }
        .fn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .fn-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .fn-chips { display: flex; gap: 7px; flex-wrap: wrap; }
        .fn-chip { padding: 6px 13px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .fn-chip.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .fn-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 14px 0; }
        .fn-toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fn-modal-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
        .fn-btn-cancelar { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-guardar { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-guardar:hover { background: #e60000; }
        .fn-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
        .fn-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 6px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fn-sup-tipos { display: flex; gap: 6px; margin-top: 6px; }
        .fn-sup-tipo { padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 10px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; }
        .fn-sup-tipo.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        @media (max-width: 700px) { .mir-grid { grid-template-columns: 1fr; } .fn-row3 { grid-template-columns: 1fr 1fr; } .filtro-panel { width: 100vw; } }
      `}</style>

      {/* ── TABS ── */}
      <div className="mir-tabs">
        <button className={`mir-tab${vista === "ofrecidos" ? " activo" : ""}`} onClick={() => setVista("ofrecidos")}>
          🏠 Ofrecidos {ofrecidos.length > 0 && <span className="mir-tab-badge">{ofrecidos.length}</span>}
        </button>
        <button className={`mir-tab${vista === "busquedas" ? " activo" : ""}`} onClick={() => setVista("busquedas")}>
          🔍 Búsquedas {busquedas.length > 0 && <span className="mir-tab-badge">{busquedas.length}</span>}
        </button>
        <button className={`mir-tab${vista === "matches" ? " activo" : ""}`} onClick={() => setVista("matches")}>
          🔗 Mis matches {matchesPropios.length > 0 && <span className="mir-tab-badge" style={{background:"#22c55e"}}>{matchesPropios.length}</span>}
        </button>
      </div>

      {/* ── BARRA ── */}
      {vista !== "matches" && (
        <div className="mir-barra">
          <div className="mir-barra-left">
            <button
              className={`mir-btn-filtrar${cantFiltrosActivos > 0 ? " activo" : ""}`}
              onClick={() => { setFiltroTemp({...filtro}); setMostrarFiltros(true); }}
            >
              ⚙ Filtrar
              {cantFiltrosActivos > 0 && <span className="mir-filtro-badge">{cantFiltrosActivos}</span>}
            </button>
            {cantFiltrosActivos > 0 && (
              <button style={{background:"none",border:"none",color:"rgba(200,0,0,0.7)",fontSize:11,cursor:"pointer",fontFamily:"'Montserrat',sans-serif",fontWeight:700}} onClick={() => setFiltro(FILTRO_VACIO)}>
                × Limpiar filtros
              </button>
            )}
          </div>
          <button className="mir-btn-pub" onClick={() => vista === "ofrecidos" ? setMostrarFormO(true) : setMostrarFormB(true)}>
            {vista === "ofrecidos" ? "+ Publicar ofrecido" : "+ Publicar búsqueda"}
          </button>
        </div>
      )}

      {/* ── OFRECIDOS ── */}
      {vista === "ofrecidos" && (
        loading ? <div className="mir-empty">Cargando...</div> :
        ofsFilt.length === 0 ? <div className="mir-empty">No hay ofrecidos{cantFiltrosActivos > 0 ? " con esos filtros" : " publicados todavía"}.</div> :
        <div className="mir-grid">
          {ofsFilt.map(o => {
            const color = OP_COLOR[o.operacion] ?? "#fff";
            const extras = [o.apto_credito && "Apto crédito", o.uso_comercial && "Uso comercial", o.barrio_cerrado && "B. cerrado", o.con_cochera && "Cochera", o.acepta_mascotas && "Mascotas", o.acepta_bitcoin && "Bitcoin"].filter(Boolean) as string[];
            return (
              <Card key={o.id} propia={o.perfil_id === userId}>
                <div className="mir-card-top">
                  <div className="mir-card-titulo">{o.tipo_propiedad}</div>
                  <span className="mir-op-badge" style={{background:`${color}20`,border:`1px solid ${color}50`,color}}>{OP_LABEL[o.operacion]}</span>
                </div>
                {o.precio && <div className="mir-precio">{formatPeso(o.precio, o.moneda)}</div>}
                <div className="mir-zona">📍 {[o.zona, o.ciudad].filter(Boolean).join(" · ")}</div>
                <div className="mir-detalles">
                  {o.dormitorios && <span className="mir-det">🛏 {o.dormitorios} dorm.</span>}
                  {o.banos && <span className="mir-det">🚿 {o.banos} baños</span>}
                  {o.superficie_cubierta && <span className="mir-det">📐 {o.superficie_cubierta}m² cub.</span>}
                  {o.superficie_total && <span className="mir-det">📏 {o.superficie_total}m² tot.</span>}
                  {o.antiguedad && <span className="mir-det">🏗 {o.antiguedad.replace(/_/g," ")}</span>}
                </div>
                {extras.length > 0 && <div className="mir-extras">{extras.map((e,i) => <span key={i} className="mir-extra">{e}</span>)}</div>}
                {o.descripcion && <div className="mir-desc">{o.descripcion}</div>}
                <div className="mir-card-footer">
                  <div>
                    {o.perfil_id === userId ? <span className="mir-corredor">📌 Tu publicación</span> : <span className="mir-corredor">C.I. <b>{o.perfiles?.apellido}, {o.perfiles?.nombre}</b> · Mat. {o.perfiles?.matricula ?? "—"}</span>}
                    <div className="mir-fecha">{formatFecha(o.created_at)}</div>
                  </div>
                  {o.perfil_id === userId && <button className="mir-btn-baja" onClick={() => desactivar("mir_ofrecidos", o.id)}>Dar de baja</button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── BÚSQUEDAS ── */}
      {vista === "busquedas" && (
        loading ? <div className="mir-empty">Cargando...</div> :
        busFilt.length === 0 ? <div className="mir-empty">No hay búsquedas{cantFiltrosActivos > 0 ? " con esos filtros" : " publicadas todavía"}.</div> :
        <div className="mir-grid">
          {busFilt.map(b => {
            const color = OP_COLOR[b.operacion] ?? "#fff";
            const extras = [b.apto_credito && "Apto crédito", b.uso_comercial && "Uso comercial", b.con_cochera && "Con cochera", b.barrio_cerrado && "B. cerrado", b.acepta_mascotas && "Mascotas", b.acepta_bitcoin && "Bitcoin"].filter(Boolean) as string[];
            return (
              <Card key={b.id} propia={b.perfil_id === userId}>
                <div className="mir-card-top">
                  <div className="mir-card-titulo">{b.tipo_propiedad}</div>
                  <span className="mir-op-badge" style={{background:`${color}20`,border:`1px solid ${color}50`,color}}>{OP_LABEL[b.operacion]}</span>
                </div>
                {(b.presupuesto_min || b.presupuesto_max) && (
                  <div className="mir-precio">
                    {b.presupuesto_min && b.presupuesto_max ? `${formatPeso(b.presupuesto_min, b.moneda)} – ${formatPeso(b.presupuesto_max, b.moneda)}` :
                     b.presupuesto_max ? `Hasta ${formatPeso(b.presupuesto_max, b.moneda)}` :
                     `Desde ${formatPeso(b.presupuesto_min!, b.moneda)}`}
                  </div>
                )}
                <div className="mir-zona">📍 {[b.zona, b.ciudad].filter(Boolean).join(" · ")}</div>
                <div className="mir-detalles">
                  {b.dormitorios_min && <span className="mir-det">🛏 {b.dormitorios_min}{b.dormitorios_max ? `–${b.dormitorios_max}` : "+"} dorm.</span>}
                  {b.banos_min && <span className="mir-det">🚿 {b.banos_min}+ baños</span>}
                  {b.superficie_min && <span className="mir-det">📐 {b.superficie_min}{b.superficie_max ? `–${b.superficie_max}` : "+"}m²</span>}
                  {b.antiguedad && <span className="mir-det">🏗 {b.antiguedad.replace(/_/g," ")}</span>}
                </div>
                {extras.length > 0 && <div className="mir-extras">{extras.map((e,i) => <span key={i} className="mir-extra">{e}</span>)}</div>}
                {b.descripcion && <div className="mir-desc">{b.descripcion}</div>}
                <div className="mir-card-footer">
                  <div>
                    {b.perfil_id === userId ? <span className="mir-corredor">📌 Tu publicación</span> : <span className="mir-corredor">C.I. <b>{b.perfiles?.apellido}, {b.perfiles?.nombre}</b> · Mat. {b.perfiles?.matricula ?? "—"}</span>}
                    <div className="mir-fecha">{formatFecha(b.created_at)}</div>
                  </div>
                  {b.perfil_id === userId && <button className="mir-btn-baja" onClick={() => desactivar("mir_busquedas", b.id)}>Dar de baja</button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── MATCHES ── */}
      {vista === "matches" && (
        <>
          <div className="mir-nota">💡 Ambos pagan {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(costoMatch)} para revelar los datos de contacto.</div>
          {loading ? <div className="mir-empty">Cargando...</div> :
           matchesPropios.length === 0 ? <div className="mir-empty">No tenés matches todavía.</div> :
           <div style={{display:"flex",flexDirection:"column",gap:12}}>
             {matchesPropios.map(m => {
               const of = ofrecidos.find(o => o.id === m.ofrecido_id);
               const bu = busquedas.find(b => b.id === m.busqueda_id);
               const esDuenioOf = of?.perfil_id === userId;
               const desbloqueado = esDuenioOf ? m.desbloqueado_ofrecido : m.desbloqueado_busqueda;
               return (
                 <div key={m.id} className="mir-match-card">
                   <div className="mir-match-lados">
                     <div className="mir-match-lado">
                       <div className="mir-match-lado-titulo">🏠 Ofrecido</div>
                       <div className="mir-match-info">{of?.tipo_propiedad} · {of?.ciudad}</div>
                       <div className="mir-match-sub">{OP_LABEL[of?.operacion ?? ""]}{of?.precio ? ` · ${formatPeso(of.precio, of.moneda)}` : ""}</div>
                       {esDuenioOf && <div className="mir-match-sub" style={{color:"#cc0000",marginTop:4}}>📌 Es tuyo</div>}
                     </div>
                     <div className="mir-match-sep"/>
                     <div className="mir-match-lado">
                       <div className="mir-match-lado-titulo">🔍 Búsqueda</div>
                       <div className="mir-match-info">{bu?.tipo_propiedad} · {bu?.ciudad}</div>
                       <div className="mir-match-sub">{OP_LABEL[bu?.operacion ?? ""]}{bu?.presupuesto_max ? ` · hasta ${formatPeso(bu.presupuesto_max, bu.moneda)}` : ""}</div>
                       {!esDuenioOf && <div className="mir-match-sub" style={{color:"#cc0000",marginTop:4}}>📌 Es tuya</div>}
                     </div>
                   </div>
                   <div style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:4,flexShrink:0}}>
                     {desbloqueado ? <div style={{fontSize:12,color:"#22c55e",fontWeight:700}}>✅ Desbloqueado</div> : (
                       <>
                         <button className="mir-btn-desbloquear">Desbloquear contacto</button>
                         <div className="mir-costo">{new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(costoMatch)}</div>
                       </>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
          }
        </>
      )}

      {/* ── PANEL FILTROS ── */}
      {mostrarFiltros && (
        <div className="filtro-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFiltros(false); }}>
          <div className="filtro-panel">
            <div className="filtro-header">
              <span className="filtro-title">Filtrar {vista}</span>
              <button className="filtro-close" onClick={() => setMostrarFiltros(false)}>×</button>
            </div>
            <div className="filtro-body">
              {/* Operación */}
              <div>
                <div className="filtro-section-title">Operación</div>
                <div className="filtro-chips">
                  {(vista === "ofrecidos" ? OPS_OFRECIDO : OPS_BUSQUEDA).map(op => (
                    <button key={op.value} className={`filtro-chip${filtroTemp.operaciones.includes(op.value) ? " activo" : ""}`} onClick={() => toggleFiltroItem("operaciones", op.value)}>{op.label}</button>
                  ))}
                </div>
              </div>
              {/* Localidades */}
              <div>
                <div className="filtro-section-title">Ubicación</div>
                <div className="filtro-localidades">
                  {LOCALIDADES.map(loc => (
                    <label key={loc} className="filtro-check">
                      <input type="checkbox" checked={filtroTemp.localidades.includes(loc)} onChange={() => toggleFiltroItem("localidades", loc)} />
                      <span className="filtro-check-label">{loc}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Tipo propiedad */}
              <div>
                <div className="filtro-section-title">Tipo de propiedad</div>
                <div className="filtro-localidades">
                  {TIPOS_PROPIEDAD.map(t => (
                    <label key={t} className="filtro-check">
                      <input type="checkbox" checked={filtroTemp.tipos.includes(t)} onChange={() => toggleFiltroItem("tipos", t)} />
                      <span className="filtro-check-label">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Superficie */}
              <div>
                <div className="filtro-section-title">Superficie (m²)</div>
                <div className="filtro-row">
                  <input className="filtro-input" type="number" placeholder="Mínimo" value={filtroTemp.sup_min} onChange={e => setFiltroTemp(f => ({...f, sup_min: e.target.value}))} />
                  <input className="filtro-input" type="number" placeholder="Máximo" value={filtroTemp.sup_max} onChange={e => setFiltroTemp(f => ({...f, sup_max: e.target.value}))} />
                </div>
              </div>
              {/* Filtros adicionales */}
              <div>
                <div className="filtro-section-title">Filtros adicionales</div>
                <div className="filtro-toggles">
                  <Toggle label="Apto crédito" value={filtroTemp.apto_credito} onChange={v => setFiltroTemp(f => ({...f, apto_credito: v}))} />
                  <Toggle label="Con cochera" value={filtroTemp.con_cochera} onChange={v => setFiltroTemp(f => ({...f, con_cochera: v}))} />
                  <Toggle label="Uso comercial" value={filtroTemp.uso_comercial} onChange={v => setFiltroTemp(f => ({...f, uso_comercial: v}))} />
                  <Toggle label="Barrio cerrado" value={filtroTemp.barrio_cerrado} onChange={v => setFiltroTemp(f => ({...f, barrio_cerrado: v}))} />
                  <Toggle label="Acepta mascotas" value={filtroTemp.acepta_mascotas} onChange={v => setFiltroTemp(f => ({...f, acepta_mascotas: v}))} />
                  <Toggle label="Acepta Bitcoin" value={filtroTemp.acepta_bitcoin} onChange={v => setFiltroTemp(f => ({...f, acepta_bitcoin: v}))} />
                </div>
              </div>
            </div>
            <div className="filtro-footer">
              <button className="filtro-btn-limpiar" onClick={() => setFiltroTemp(FILTRO_VACIO)}>Limpiar todo</button>
              <button className="filtro-btn-aplicar" onClick={() => { setFiltro(filtroTemp); setMostrarFiltros(false); }}>
                Ver resultados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL OFRECIDO ── */}
      {mostrarFormO && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormO(false); }}>
          <div className="fn-modal">
            <h2>Publicar <span>ofrecido</span></h2>
            <div className="fn-field">
              <label className="fn-label">Operación *</label>
              <div className="fn-chips">
                {OPS_OFRECIDO.map(op => <button key={op.value} type="button" className={`fn-chip${formO.operacion === op.value ? " activo" : ""}`} onClick={() => setFormO(p => ({...p, operacion: op.value}))}>{op.label}</button>)}
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Tipo de propiedad *</label>
              <select className="fn-select" value={formO.tipo_propiedad} onChange={e => setFormO(p => ({...p, tipo_propiedad: e.target.value}))}>
                {TIPOS_PROPIEDAD.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Localidad *</label>
                <select className="fn-select" value={formO.ciudad} onChange={e => setFormO(p => ({...p, ciudad: e.target.value}))}>
                  {LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="fn-field">
                <label className="fn-label">Zona / Barrio</label>
                <input className="fn-input" placeholder="Ej: Fisherton" value={formO.zona} onChange={e => setFormO(p => ({...p, zona: e.target.value}))} />
              </div>
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Precio</label>
                <input className="fn-input" type="number" placeholder="150000" value={formO.precio} onChange={e => setFormO(p => ({...p, precio: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Moneda</label>
                <div className="fn-chips">
                  <button type="button" className={`fn-chip${formO.moneda === "USD" ? " activo" : ""}`} onClick={() => setFormO(p => ({...p, moneda: "USD"}))}>USD</button>
                  <button type="button" className={`fn-chip${formO.moneda === "ARS" ? " activo" : ""}`} onClick={() => setFormO(p => ({...p, moneda: "ARS"}))}>ARS</button>
                </div>
              </div>
            </div>
            <div className="fn-row3">
              <div className="fn-field">
                <label className="fn-label">Dormitorios</label>
                <input className="fn-input" type="number" placeholder="2" value={formO.dormitorios} onChange={e => setFormO(p => ({...p, dormitorios: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Baños</label>
                <input className="fn-input" type="number" placeholder="1" value={formO.banos} onChange={e => setFormO(p => ({...p, banos: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Antigüedad</label>
                <select className="fn-select" value={formO.antiguedad} onChange={e => setFormO(p => ({...p, antiguedad: e.target.value}))}>
                  {ANTIGUEDADES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Sup. total m²</label>
                <input className="fn-input" type="number" placeholder="80" value={formO.superficie_total} onChange={e => setFormO(p => ({...p, superficie_total: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Sup. cubierta m²</label>
                <input className="fn-input" type="number" placeholder="60" value={formO.superficie_cubierta} onChange={e => setFormO(p => ({...p, superficie_cubierta: e.target.value}))} />
              </div>
            </div>
            <div className="fn-divider"/>
            <div className="fn-field">
              <label className="fn-label">Características</label>
              <div className="fn-toggles">
                <Toggle label="Apto crédito" value={formO.apto_credito} onChange={v => setFormO(p => ({...p, apto_credito: v}))} />
                <Toggle label="Con cochera" value={formO.con_cochera} onChange={v => setFormO(p => ({...p, con_cochera: v}))} />
                <Toggle label="Uso comercial" value={formO.uso_comercial} onChange={v => setFormO(p => ({...p, uso_comercial: v}))} />
                <Toggle label="Barrio cerrado" value={formO.barrio_cerrado} onChange={v => setFormO(p => ({...p, barrio_cerrado: v}))} />
                <Toggle label="Acepta mascotas" value={formO.acepta_mascotas} onChange={v => setFormO(p => ({...p, acepta_mascotas: v}))} />
                <Toggle label="Acepta Bitcoin" value={formO.acepta_bitcoin} onChange={v => setFormO(p => ({...p, acepta_bitcoin: v}))} />
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Descripción</label>
              <textarea className="fn-textarea" placeholder="Detalles adicionales..." value={formO.descripcion} onChange={e => setFormO(p => ({...p, descripcion: e.target.value}))} />
            </div>
            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => setMostrarFormO(false)}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={guardarOfrecido} disabled={guardando || !formO.ciudad}>
                {guardando && <span className="fn-spinner"/>}{guardando ? "Publicando..." : "Publicar ofrecido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL BÚSQUEDA ── */}
      {mostrarFormB && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarFormB(false); }}>
          <div className="fn-modal">
            <h2>Publicar <span>búsqueda</span></h2>
            <div className="fn-field">
              <label className="fn-label">Operación *</label>
              <div className="fn-chips">
                {OPS_BUSQUEDA.map(op => <button key={op.value} type="button" className={`fn-chip${formB.operacion === op.value ? " activo" : ""}`} onClick={() => setFormB(p => ({...p, operacion: op.value}))}>{op.label}</button>)}
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Tipo de propiedad *</label>
              <select className="fn-select" value={formB.tipo_propiedad} onChange={e => setFormB(p => ({...p, tipo_propiedad: e.target.value}))}>
                {TIPOS_PROPIEDAD.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Localidad *</label>
                <select className="fn-select" value={formB.ciudad} onChange={e => setFormB(p => ({...p, ciudad: e.target.value}))}>
                  {LOCALIDADES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="fn-field">
                <label className="fn-label">Zona / Barrio</label>
                <input className="fn-input" placeholder="Ej: Norte, Fisherton..." value={formB.zona} onChange={e => setFormB(p => ({...p, zona: e.target.value}))} />
              </div>
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Presupuesto mín.</label>
                <input className="fn-input" type="number" placeholder="50000" value={formB.presupuesto_min} onChange={e => setFormB(p => ({...p, presupuesto_min: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Presupuesto máx.</label>
                <input className="fn-input" type="number" placeholder="200000" value={formB.presupuesto_max} onChange={e => setFormB(p => ({...p, presupuesto_max: e.target.value}))} />
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Moneda</label>
              <div className="fn-chips">
                <button type="button" className={`fn-chip${formB.moneda === "USD" ? " activo" : ""}`} onClick={() => setFormB(p => ({...p, moneda: "USD"}))}>USD</button>
                <button type="button" className={`fn-chip${formB.moneda === "ARS" ? " activo" : ""}`} onClick={() => setFormB(p => ({...p, moneda: "ARS"}))}>ARS</button>
              </div>
            </div>
            <div className="fn-row3">
              <div className="fn-field">
                <label className="fn-label">Dorm. mín.</label>
                <input className="fn-input" type="number" placeholder="2" value={formB.dormitorios_min} onChange={e => setFormB(p => ({...p, dormitorios_min: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Dorm. máx.</label>
                <input className="fn-input" type="number" placeholder="4" value={formB.dormitorios_max} onChange={e => setFormB(p => ({...p, dormitorios_max: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Baños mín.</label>
                <input className="fn-input" type="number" placeholder="1" value={formB.banos_min} onChange={e => setFormB(p => ({...p, banos_min: e.target.value}))} />
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Superficie m²</label>
              <div className="fn-row">
                <input className="fn-input" type="number" placeholder="Mínimo" value={formB.superficie_min} onChange={e => setFormB(p => ({...p, superficie_min: e.target.value}))} />
                <input className="fn-input" type="number" placeholder="Máximo" value={formB.superficie_max} onChange={e => setFormB(p => ({...p, superficie_max: e.target.value}))} />
              </div>
              <div className="fn-sup-tipos">
                {[["total","Total"],["cubierta","Cubierta"],["terreno","Del terreno"]].map(([v,l]) => (
                  <button key={v} type="button" className={`fn-sup-tipo${formB.tipo_superficie === v ? " activo" : ""}`} onClick={() => setFormB(p => ({...p, tipo_superficie: v}))}>{l}</button>
                ))}
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Antigüedad</label>
              <select className="fn-select" value={formB.antiguedad} onChange={e => setFormB(p => ({...p, antiguedad: e.target.value}))}>
                {ANTIGUEDADES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="fn-divider"/>
            <div className="fn-field">
              <label className="fn-label">Filtros adicionales</label>
              <div className="fn-toggles">
                <Toggle label="Apto crédito" value={formB.apto_credito} onChange={v => setFormB(p => ({...p, apto_credito: v}))} />
                <Toggle label="Con cochera" value={formB.con_cochera} onChange={v => setFormB(p => ({...p, con_cochera: v}))} />
                <Toggle label="Uso comercial" value={formB.uso_comercial} onChange={v => setFormB(p => ({...p, uso_comercial: v}))} />
                <Toggle label="Barrio cerrado" value={formB.barrio_cerrado} onChange={v => setFormB(p => ({...p, barrio_cerrado: v}))} />
                <Toggle label="Acepta mascotas" value={formB.acepta_mascotas} onChange={v => setFormB(p => ({...p, acepta_mascotas: v}))} />
                <Toggle label="Acepta Bitcoin" value={formB.acepta_bitcoin} onChange={v => setFormB(p => ({...p, acepta_bitcoin: v}))} />
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Descripción</label>
              <textarea className="fn-textarea" placeholder="Requisitos específicos del cliente..." value={formB.descripcion} onChange={e => setFormB(p => ({...p, descripcion: e.target.value}))} />
            </div>
            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => setMostrarFormB(false)}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={guardarBusqueda} disabled={guardando || !formB.ciudad}>
                {guardando && <span className="fn-spinner"/>}{guardando ? "Publicando..." : "Publicar búsqueda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
