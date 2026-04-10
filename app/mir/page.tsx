"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const OPS_OFRECIDO = [
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "temporario", label: "Temporario" },
  { value: "permuta", label: "Permuta" },
];

const OPS_BUSQUEDA = [
  { value: "compra", label: "Comprar" },
  { value: "alquiler", label: "Alquilar" },
  { value: "temporario", label: "Temporario" },
  { value: "permuta", label: "Permuta" },
];

// Match: venta↔compra, alquiler↔alquiler, temporario↔temporario, permuta↔permuta
const MATCH_OP: Record<string, string> = {
  venta: "compra", alquiler: "alquiler", temporario: "temporario", permuta: "permuta",
};

const TIPOS_PROPIEDAD = [
  "Departamento", "Casa", "Terreno o Lote", "Departamento de Pasillo",
  "Cochera", "Oficina", "Local Comercial", "Galpón", "Campo",
  "Negocio o Fondo de Comercio", "Consultorio", "Baulera", "Hotel", "Habitación",
];

const OP_COLOR: Record<string, string> = {
  venta: "#22c55e", compra: "#22c55e",
  alquiler: "#60a5fa",
  temporario: "#eab308",
  permuta: "#c084fc",
};

const OP_LABEL: Record<string, string> = {
  venta: "Venta", compra: "Comprar", alquiler: "Alquiler",
  temporario: "Temporario", permuta: "Permuta",
};

interface Ofrecido {
  id: string; perfil_id: string; operacion: string; tipo_propiedad: string;
  zona: string | null; ciudad: string; precio: number | null; moneda: string;
  dormitorios: number | null; banos: number | null;
  superficie_cubierta: number | null; superficie_total: number | null;
  apto_credito: boolean; uso_comercial: boolean; barrio_cerrado: boolean;
  acepta_mascotas: boolean; acepta_bitcoin: boolean;
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

const FORM_O = {
  operacion: "venta", tipo_propiedad: "Departamento",
  zona: "", ciudad: "", precio: "", moneda: "USD",
  dormitorios: "", banos: "", superficie_cubierta: "", superficie_total: "",
  apto_credito: false, uso_comercial: false, barrio_cerrado: false,
  acepta_mascotas: false, acepta_bitcoin: false, descripcion: "",
};

const FORM_B = {
  operacion: "compra", tipo_propiedad: "Departamento",
  zona: "", ciudad: "", presupuesto_min: "", presupuesto_max: "", moneda: "USD",
  dormitorios_min: "", dormitorios_max: "", banos_min: "", banos_max: "",
  superficie_min: "", superficie_max: "",
  apto_credito: false, uso_comercial: false, con_cochera: false,
  barrio_cerrado: false, acepta_mascotas: false, acepta_bitcoin: false,
  descripcion: "",
};

const n = (v: string) => v ? parseFloat(v) : null;
const ni = (v: string) => v ? parseInt(v) : null;

const formatPeso = (v: number, m = "ARS") =>
  m === "USD" ? `USD ${v.toLocaleString("es-AR")}` :
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v);

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => onChange(!value)}>
    <div style={{ width: 36, height: 20, borderRadius: 10, background: value ? "#cc0000" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
    </div>
    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{label}</span>
  </div>
);

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
  const [formO, setFormO] = useState(FORM_O);
  const [formB, setFormB] = useState(FORM_B);
  const [guardando, setGuardando] = useState(false);
  const [filtroOp, setFiltroOp] = useState("todas");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      setUserId(data.user.id);
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

  const matchearOfrecido = async (of: Ofrecido) => {
    const opBusqueda = MATCH_OP[of.operacion];
    if (!opBusqueda) return;
    const { data: busqs } = await supabase.from("mir_busquedas").select("*")
      .eq("activo", true).eq("operacion", opBusqueda).eq("tipo_propiedad", of.tipo_propiedad)
      .neq("perfil_id", of.perfil_id);
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
      .eq("activo", true).eq("operacion", opOfrecido).eq("tipo_propiedad", bu.tipo_propiedad)
      .neq("perfil_id", bu.perfil_id);
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
    return ciudadOk && zonaOk && precioOk && precioMinOk && dormOk && dormMaxOk && banosOk && supOk && supMaxOk && creditoOk && mascotasOk;
  };

  const guardarOfrecido = async () => {
    if (!userId || !formO.ciudad) return;
    setGuardando(true);
    const { data: nuevo } = await supabase.from("mir_ofrecidos").insert({
      perfil_id: userId, operacion: formO.operacion, tipo_propiedad: formO.tipo_propiedad,
      zona: formO.zona || null, ciudad: formO.ciudad,
      precio: n(formO.precio), moneda: formO.moneda,
      dormitorios: ni(formO.dormitorios), banos: ni(formO.banos),
      superficie_cubierta: n(formO.superficie_cubierta), superficie_total: n(formO.superficie_total),
      apto_credito: formO.apto_credito, uso_comercial: formO.uso_comercial,
      barrio_cerrado: formO.barrio_cerrado, acepta_mascotas: formO.acepta_mascotas,
      acepta_bitcoin: formO.acepta_bitcoin, descripcion: formO.descripcion || null,
    }).select().single();
    if (nuevo) await matchearOfrecido(nuevo as Ofrecido);
    setGuardando(false);
    setMostrarFormO(false);
    setFormO(FORM_O);
    cargarDatos();
  };

  const guardarBusqueda = async () => {
    if (!userId || !formB.ciudad) return;
    setGuardando(true);
    const { data: nueva } = await supabase.from("mir_busquedas").insert({
      perfil_id: userId, operacion: formB.operacion, tipo_propiedad: formB.tipo_propiedad,
      zona: formB.zona || null, ciudad: formB.ciudad,
      presupuesto_min: n(formB.presupuesto_min), presupuesto_max: n(formB.presupuesto_max),
      moneda: formB.moneda,
      dormitorios_min: ni(formB.dormitorios_min), dormitorios_max: ni(formB.dormitorios_max),
      banos_min: ni(formB.banos_min), banos_max: ni(formB.banos_max),
      superficie_min: n(formB.superficie_min), superficie_max: n(formB.superficie_max),
      apto_credito: formB.apto_credito, uso_comercial: formB.uso_comercial,
      con_cochera: formB.con_cochera, barrio_cerrado: formB.barrio_cerrado,
      acepta_mascotas: formB.acepta_mascotas, acepta_bitcoin: formB.acepta_bitcoin,
      descripcion: formB.descripcion || null,
    }).select().single();
    if (nueva) await matchearBusqueda(nueva as Busqueda);
    setGuardando(false);
    setMostrarFormB(false);
    setFormB(FORM_B);
    cargarDatos();
  };

  const desactivar = async (tabla: string, id: string) => {
    await supabase.from(tabla).update({ activo: false }).eq("id", id);
    cargarDatos();
  };

  const OPS_FILTRO_OF = [{ value: "todas", label: "Todas" }, ...OPS_OFRECIDO];
  const OPS_FILTRO_BU = [{ value: "todas", label: "Todas" }, ...OPS_BUSQUEDA];

  const ofsFilt = ofrecidos.filter(o => filtroOp === "todas" || o.operacion === filtroOp);
  const busFilt = busquedas.filter(b => filtroOp === "todas" || b.operacion === filtroOp);
  const matchesPropios = matches.filter(m =>
    ofrecidos.find(o => o.id === m.ofrecido_id)?.perfil_id === userId ||
    busquedas.find(b => b.id === m.busqueda_id)?.perfil_id === userId
  );

  const Card = ({ children, propia }: { children: React.ReactNode; propia: boolean }) => (
    <div className={`mir-card${propia ? " propia" : ""}`}>{children}</div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .mir-root { min-height: 100vh; display: flex; flex-direction: column; }
        .mir-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .mir-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .mir-topbar-logo span { color: #cc0000; }
        .mir-btn-back { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .mir-btn-back:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
        .mir-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        .mir-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .mir-header h1 span { color: #cc0000; }
        .mir-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .mir-tabs { display: flex; gap: 10px; flex-wrap: wrap; }
        .mir-tab { padding: 9px 22px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; position: relative; }
        .mir-tab.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .mir-tab-badge { position: absolute; top: -6px; right: -6px; background: #cc0000; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 10px; min-width: 16px; text-align: center; }
        .mir-barra { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .mir-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
        .mir-filtro { padding: 6px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .mir-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .mir-btn-pub { padding: 9px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
        .mir-btn-pub:hover { background: #e60000; }
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
        .fn-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: flex-start; justify-content: center; z-index: 200; padding: 24px; overflow-y: auto; }
        .fn-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 28px 32px; width: 100%; max-width: 560px; position: relative; margin: auto; }
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
        .fn-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .fn-chip { padding: 7px 14px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .fn-chip.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .fn-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 12px 0; }
        .fn-toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fn-modal-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
        .fn-btn-cancelar { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-guardar { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-guardar:hover { background: #e60000; }
        .fn-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 700px) { .mir-content { padding: 16px; } .mir-grid { grid-template-columns: 1fr; } .fn-row3 { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <div className="mir-root">
        <header className="mir-topbar">
          <div className="mir-topbar-logo"><span>GFI</span>® · Motor Inmobiliario</div>
          <a className="mir-btn-back" href="/dashboard">← Dashboard</a>
        </header>

        <main className="mir-content">
          <div className="mir-header">
            <h1>Motor <span>Inmobiliario</span></h1>
            <p>Publicá ofrecidos y búsquedas — el sistema cruza y notifica cuando hay match</p>
          </div>

          <div className="mir-tabs">
            <button className={`mir-tab${vista === "ofrecidos" ? " activo" : ""}`} onClick={() => { setVista("ofrecidos"); setFiltroOp("todas"); }}>
              🏠 Ofrecidos {ofrecidos.length > 0 && <span className="mir-tab-badge">{ofrecidos.length}</span>}
            </button>
            <button className={`mir-tab${vista === "busquedas" ? " activo" : ""}`} onClick={() => { setVista("busquedas"); setFiltroOp("todas"); }}>
              🔍 Búsquedas {busquedas.length > 0 && <span className="mir-tab-badge">{busquedas.length}</span>}
            </button>
            <button className={`mir-tab${vista === "matches" ? " activo" : ""}`} onClick={() => setVista("matches")}>
              🔗 Mis matches {matchesPropios.length > 0 && <span className="mir-tab-badge" style={{background:"#22c55e"}}>{matchesPropios.length}</span>}
            </button>
          </div>

          {vista !== "matches" && (
            <div className="mir-barra">
              <div className="mir-filtros">
                {(vista === "ofrecidos" ? OPS_FILTRO_OF : OPS_FILTRO_BU).map(op => (
                  <button key={op.value} className={`mir-filtro${filtroOp === op.value ? " activo" : ""}`} onClick={() => setFiltroOp(op.value)}>{op.label}</button>
                ))}
              </div>
              <button className="mir-btn-pub" onClick={() => vista === "ofrecidos" ? setMostrarFormO(true) : setMostrarFormB(true)}>
                {vista === "ofrecidos" ? "+ Publicar ofrecido" : "+ Publicar búsqueda"}
              </button>
            </div>
          )}

          {/* OFRECIDOS */}
          {vista === "ofrecidos" && (
            loading ? <div className="mir-empty">Cargando...</div> :
            ofsFilt.length === 0 ? <div className="mir-empty">No hay ofrecidos publicados todavía.</div> :
            <div className="mir-grid">
              {ofsFilt.map(o => {
                const color = OP_COLOR[o.operacion] ?? "#fff";
                const extras = [o.apto_credito && "Apto crédito", o.uso_comercial && "Uso comercial", o.barrio_cerrado && "B. cerrado", o.acepta_mascotas && "Mascotas", o.acepta_bitcoin && "Bitcoin"].filter(Boolean) as string[];
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
                    </div>
                    {extras.length > 0 && <div className="mir-extras">{extras.map((e, i) => <span key={i} className="mir-extra">{e}</span>)}</div>}
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

          {/* BÚSQUEDAS */}
          {vista === "busquedas" && (
            loading ? <div className="mir-empty">Cargando...</div> :
            busFilt.length === 0 ? <div className="mir-empty">No hay búsquedas publicadas todavía.</div> :
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
                    </div>
                    {extras.length > 0 && <div className="mir-extras">{extras.map((e, i) => <span key={i} className="mir-extra">{e}</span>)}</div>}
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

          {/* MATCHES */}
          {vista === "matches" && (
            <>
              <div className="mir-nota">💡 Cuando hay match contactá al colega. Ambos pagan {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(costoMatch)} para revelar los datos de contacto.</div>
              {loading ? <div className="mir-empty">Cargando...</div> :
               matchesPropios.length === 0 ? <div className="mir-empty">No tenés matches todavía. Publicá ofrecidos o búsquedas para comenzar.</div> :
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
                         <div className="mir-match-sep" />
                         <div className="mir-match-lado">
                           <div className="mir-match-lado-titulo">🔍 Búsqueda</div>
                           <div className="mir-match-info">{bu?.tipo_propiedad} · {bu?.ciudad}</div>
                           <div className="mir-match-sub">{OP_LABEL[bu?.operacion ?? ""]}{bu?.presupuesto_max ? ` · hasta ${formatPeso(bu.presupuesto_max, bu.moneda)}` : ""}</div>
                           {!esDuenioOf && <div className="mir-match-sub" style={{color:"#cc0000",marginTop:4}}>📌 Es tuya</div>}
                         </div>
                       </div>
                       <div style={{display:"flex",flexDirection:"column" as const,alignItems:"flex-end",gap:4,flexShrink:0}}>
                         {desbloqueado ? (
                           <div style={{fontSize:12,color:"#22c55e",fontWeight:700}}>✅ Desbloqueado</div>
                         ) : (
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
        </main>
      </div>

      {/* MODAL OFRECIDO */}
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
                <label className="fn-label">Ciudad *</label>
                <input className="fn-input" placeholder="Rosario" value={formO.ciudad} onChange={e => setFormO(p => ({...p, ciudad: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Zona / Barrio</label>
                <input className="fn-input" placeholder="Ej: Fisherton (opcional)" value={formO.zona} onChange={e => setFormO(p => ({...p, zona: e.target.value}))} />
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
                <label className="fn-label">Sup. total m²</label>
                <input className="fn-input" type="number" placeholder="80" value={formO.superficie_total} onChange={e => setFormO(p => ({...p, superficie_total: e.target.value}))} />
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Sup. cubierta m²</label>
              <input className="fn-input" type="number" placeholder="60" value={formO.superficie_cubierta} onChange={e => setFormO(p => ({...p, superficie_cubierta: e.target.value}))} />
            </div>
            <div className="fn-divider" />
            <div className="fn-field">
              <label className="fn-label">Características</label>
              <div className="fn-toggles">
                <Toggle label="Apto crédito" value={formO.apto_credito} onChange={v => setFormO(p => ({...p, apto_credito: v}))} />
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
                {guardando ? "Publicando..." : "Publicar ofrecido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BÚSQUEDA */}
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
                <label className="fn-label">Ciudad *</label>
                <input className="fn-input" placeholder="Rosario" value={formB.ciudad} onChange={e => setFormB(p => ({...p, ciudad: e.target.value}))} />
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
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Superficie mín. m²</label>
                <input className="fn-input" type="number" placeholder="50" value={formB.superficie_min} onChange={e => setFormB(p => ({...p, superficie_min: e.target.value}))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Superficie máx. m²</label>
                <input className="fn-input" type="number" placeholder="150" value={formB.superficie_max} onChange={e => setFormB(p => ({...p, superficie_max: e.target.value}))} />
              </div>
            </div>
            <div className="fn-divider" />
            <div className="fn-field">
              <label className="fn-label">Filtros</label>
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
                {guardando ? "Publicando..." : "Publicar búsqueda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
