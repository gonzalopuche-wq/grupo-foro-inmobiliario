"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface CotizacionItem {
  label: string;
  compra: number | null;
  venta: number | null;
  promedio?: number | null;
  destacado?: boolean;
}

interface Proveedor {
  id: string;
  nombre: string;
  contacto_whatsapp: string | null;
  contacto_email: string | null;
  monedas: string[] | null;
  servicios: string[] | null;
}

interface Publicacion {
  id: string;
  perfil_id: string;
  tipo: string;
  moneda: string;
  monto: number;
  precio_referencia: string | null;
  zona: string | null;
  notas: string | null;
  activa: boolean;
  vence_at: string;
  created_at: string;
  perfiles?: { nombre: string; apellido: string; matricula: string | null };
}

const MONEDAS = ["USD", "EUR", "GBP", "BRL", "USDT", "USDC"];
const MONEDA_FLAG: Record<string, string> = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", BRL: "🇧🇷", USDT: "🔷", USDC: "🔷" };

const formatARS = (n: number | null) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n);
};

const promedio = (c: number | null, v: number | null) => c !== null && v !== null ? (c + v) / 2 : null;

const FORM_PUB_VACIO = { tipo: "venta", moneda: "USD", monto: "", precio_referencia: "intermedio", zona: "", notas: "" };

export default function CotizacionesPage() {
  const [vista, setVista] = useState<"mercado" | "proveedores" | "match">("mercado");
  const [userId, setUserId] = useState<string | null>(null);
  const [ultimaAct, setUltimaAct] = useState("");

  // Mercado
  const [dolares, setDolares] = useState<CotizacionItem[]>([]);
  const [euro, setEuro] = useState<CotizacionItem | null>(null);
  const [brl, setBrl] = useState<CotizacionItem | null>(null);
  const [cripto, setCripto] = useState<CotizacionItem[]>([]);
  const [loadingMercado, setLoadingMercado] = useState(true);

  // Proveedores
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProv, setLoadingProv] = useState(true);

  // Match
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formPub, setFormPub] = useState(FORM_PUB_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [costoMatch, setCostoMatch] = useState(5000);
  const [filtroMoneda, setFiltroMoneda] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/"; return; }
      setUserId(data.user.id);
    };
    init();
    cargarMercado();
    cargarProveedores();
    cargarPublicaciones();

    supabase.from("indicadores").select("valor").eq("clave", "costo_match_divisas").single()
      .then(({ data }) => { if (data?.valor) setCostoMatch(data.valor); });

    const interval = setInterval(cargarMercado, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const cargarMercado = async () => {
    setLoadingMercado(true);
    setUltimaAct(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));

    await Promise.allSettled([
      fetch("https://dolarapi.com/v1/dolares").then(r => r.json()).then((data: any[]) => {
        const orden = ["oficial", "blue", "bolsa", "contadoconliqui", "tarjeta", "mayorista", "cripto"];
        const labels: Record<string, string> = { oficial: "Oficial", blue: "Blue ★", bolsa: "MEP / Bolsa", contadoconliqui: "CCL", tarjeta: "Tarjeta / Qatar", mayorista: "Mayorista", cripto: "Cripto (USDT)" };
        const items = data.sort((a, b) => {
          const ia = orden.indexOf(a.nombre?.toLowerCase() ?? "");
          const ib = orden.indexOf(b.nombre?.toLowerCase() ?? "");
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        }).map(d => ({ label: labels[d.nombre?.toLowerCase() ?? ""] ?? d.nombre, compra: d.compra, venta: d.venta, promedio: promedio(d.compra, d.venta), destacado: d.nombre?.toLowerCase() === "blue" }));
        setDolares(items);
      }),
      fetch("https://dolarapi.com/v1/cotizaciones/eur").then(r => r.json()).then((d: any) => setEuro({ label: "EUR/ARS", compra: d.compra, venta: d.venta, promedio: promedio(d.compra, d.venta) })),
      fetch("https://dolarapi.com/v1/cotizaciones/brl").then(r => r.json()).then((d: any) => setBrl({ label: "BRL/ARS", compra: d.compra, venta: d.venta, promedio: promedio(d.compra, d.venta) })),
      fetch("https://dolarapi.com/v1/dolares/cripto").then(r => r.json()).then((d: any) => {
        setCripto([
          { label: "USDT/ARS", compra: d.compra, venta: d.venta, promedio: promedio(d.compra, d.venta), destacado: true },
          { label: "USDC/ARS (swap +0.25%)", compra: d.compra ? d.compra * 1.0025 : null, venta: d.venta ? d.venta * 1.0025 : null },
        ]);
      }),
    ]);
    setLoadingMercado(false);
  };

  const cargarProveedores = async () => {
    setLoadingProv(true);
    const { data } = await supabase.from("divisas_proveedores").select("*").eq("activo", true).order("orden");
    setProveedores(data ?? []);
    setLoadingProv(false);
  };

  const cargarPublicaciones = async () => {
    setLoadingMatch(true);
    const { data } = await supabase.from("divisas_publicaciones")
      .select("*, perfiles(nombre, apellido, matricula)")
      .eq("activa", true)
      .gt("vence_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setPublicaciones((data as unknown as Publicacion[]) ?? []);
    setLoadingMatch(false);
  };

  const publicar = async () => {
    if (!userId || !formPub.monto) return;
    setGuardando(true);
    await supabase.from("divisas_publicaciones").insert({
      perfil_id: userId,
      tipo: formPub.tipo,
      moneda: formPub.moneda,
      monto: parseFloat(formPub.monto),
      precio_referencia: formPub.precio_referencia || null,
      zona: formPub.zona || null,
      notas: formPub.notas || null,
      vence_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    setGuardando(false);
    setMostrarForm(false);
    setFormPub(FORM_PUB_VACIO);
    cargarPublicaciones();
  };

  const eliminarPublicacion = async (id: string) => {
    await supabase.from("divisas_publicaciones").update({ activa: false }).eq("id", id);
    cargarPublicaciones();
  };

  const pubsFiltradas = publicaciones.filter(p => {
    if (filtroMoneda !== "todas" && p.moneda !== filtroMoneda) return false;
    if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
    return true;
  });

  const ventas = pubsFiltradas.filter(p => p.tipo === "venta");
  const compras = pubsFiltradas.filter(p => p.tipo === "compra");

  const formatFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + " · " + d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .cot-root { min-height: 100vh; display: flex; flex-direction: column; }
        .cot-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .cot-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; }
        .cot-topbar-logo span { color: #cc0000; }
        .cot-topbar-right { display: flex; gap: 12px; align-items: center; }
        .cot-btn-back { padding: 7px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; color: rgba(255,255,255,0.4); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; text-decoration: none; transition: all 0.2s; }
        .cot-btn-back:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .cot-actualizar { padding: 7px 14px; background: transparent; border: 1px solid rgba(200,0,0,0.3); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .cot-actualizar:hover { background: rgba(200,0,0,0.1); }
        .cot-hora { font-size: 11px; color: rgba(255,255,255,0.25); }

        .cot-content { flex: 1; padding: 32px; max-width: 1100px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
        .cot-header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .cot-header h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 800; }
        .cot-header h1 span { color: #cc0000; }
        .cot-header p { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }

        .cot-tabs { display: flex; gap: 10px; }
        .cot-tab { padding: 9px 22px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .cot-tab:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .cot-tab.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }

        /* MERCADO */
        .cot-seccion { display: flex; flex-direction: column; gap: 12px; }
        .cot-seccion-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 8px; }
        .cot-seccion-titulo::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }

        .cot-tabla-wrap { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .cot-tabla { width: 100%; border-collapse: collapse; }
        .cot-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .cot-tabla th { padding: 11px 16px; text-align: left; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .cot-tabla th:not(:first-child) { text-align: right; }
        .cot-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; }
        .cot-tabla tbody tr:last-child { border-bottom: none; }
        .cot-tabla tbody tr:hover { background: rgba(255,255,255,0.02); }
        .cot-tabla tbody tr.destacado { background: rgba(200,0,0,0.04); }
        .cot-tabla td { padding: 13px 16px; font-size: 13px; }
        .cot-tabla td:not(:first-child) { text-align: right; font-family: 'Montserrat', sans-serif; font-weight: 700; }
        .cot-nombre { font-weight: 600; color: #fff; }
        .td-c { color: #60a5fa; }
        .td-v { color: #f87171; }
        .td-p { color: #22c55e; }

        .cot-grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .cot-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; }
        .cot-card-label { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.7); margin-bottom: 12px; }
        .cot-vals { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .cot-val-label { font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); font-family: 'Montserrat', sans-serif; }
        .cot-val-num { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; margin-top: 3px; }

        /* PROVEEDORES */
        .prov-grid { display: flex; flex-direction: column; gap: 12px; }
        .prov-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; transition: border-color 0.2s; }
        .prov-card:hover { border-color: rgba(200,0,0,0.2); }
        .prov-info { display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .prov-nombre { font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .prov-monedas { display: flex; gap: 6px; flex-wrap: wrap; }
        .prov-moneda-tag { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; padding: 3px 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; color: rgba(255,255,255,0.6); }
        .prov-servicios { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5; }
        .prov-acciones { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
        .prov-btn-wa { padding: 8px 18px; background: rgba(37,211,102,0.12); border: 1px solid rgba(37,211,102,0.3); border-radius: 3px; color: #25d366; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; transition: all 0.2s; }
        .prov-btn-wa:hover { background: rgba(37,211,102,0.2); }
        .prov-empty { padding: 48px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }

        /* MATCH */
        .match-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .match-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
        .match-filtro { padding: 6px 14px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; }
        .match-filtro:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .match-filtro.activo { border-color: #cc0000; color: #fff; background: rgba(200,0,0,0.08); }
        .match-btn-pub { padding: 9px 20px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .match-btn-pub:hover { background: #e60000; }

        .match-columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .match-col-titulo { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; padding: 10px 16px; border-radius: 4px 4px 0 0; }
        .match-col-titulo.venta { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); border-bottom: none; }
        .match-col-titulo.compra { background: rgba(200,0,0,0.08); color: #cc0000; border: 1px solid rgba(200,0,0,0.2); border-bottom: none; }

        .match-lista { display: flex; flex-direction: column; gap: 8px; }
        .match-pub { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 0 0 6px 6px; padding: 14px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .match-pub + .match-pub { border-radius: 6px; margin-top: 0; }
        .match-pub.propia { border-color: rgba(200,0,0,0.25); background: rgba(200,0,0,0.04); }
        .match-pub-info { flex: 1; }
        .match-pub-monto { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; color: #fff; }
        .match-pub-monto span { color: #cc0000; }
        .match-pub-meta { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; line-height: 1.5; }
        .match-pub-corredor { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 6px; font-weight: 500; }
        .match-pub-precio { font-size: 11px; color: #eab308; margin-top: 2px; }
        .match-btn-contactar { padding: 6px 14px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.3); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .match-btn-contactar:hover { background: rgba(200,0,0,0.2); color: #fff; }
        .match-btn-eliminar { padding: 6px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.3); font-size: 11px; cursor: pointer; transition: all 0.2s; }
        .match-btn-eliminar:hover { border-color: rgba(200,0,0,0.4); color: #ff4444; }
        .match-costo { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 4px; text-align: right; }
        .match-empty { padding: 24px 16px; text-align: center; color: rgba(255,255,255,0.2); font-size: 12px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 0 0 6px 6px; }

        .match-nota { font-size: 11px; color: rgba(255,255,255,0.2); text-align: center; padding: 8px; background: rgba(200,0,0,0.05); border: 1px solid rgba(200,0,0,0.1); border-radius: 4px; }

        /* MODAL */
        .fn-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; }
        .fn-modal { background: #0f0f0f; border: 1px solid rgba(180,0,0,0.25); border-radius: 6px; padding: 36px; width: 100%; max-width: 460px; position: relative; }
        .fn-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, #cc0000, transparent); border-radius: 6px 6px 0 0; }
        .fn-modal h2 { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 800; margin-bottom: 20px; }
        .fn-modal h2 span { color: #cc0000; }
        .fn-field { margin-bottom: 14px; }
        .fn-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-family: 'Montserrat', sans-serif; }
        .fn-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter', sans-serif; }
        .fn-input:focus { border-color: rgba(200,0,0,0.5); }
        .fn-input::placeholder { color: rgba(255,255,255,0.2); }
        .fn-select { width: 100%; padding: 10px 14px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .fn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .fn-modal-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
        .fn-btn-cancelar { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-guardar { padding: 10px 24px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-guardar:hover { background: #e60000; }
        .fn-btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }

        .skeleton { background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite; display: inline-block; }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        .cot-nota { font-size: 11px; color: rgba(255,255,255,0.2); text-align: center; font-style: italic; }

        @media (max-width: 900px) { .cot-grid3 { grid-template-columns: 1fr 1fr; } .match-columnas { grid-template-columns: 1fr; } }
        @media (max-width: 600px) { .cot-content { padding: 16px; } .cot-grid3 { grid-template-columns: 1fr; } }
      `}</style>

      <div className="cot-root">
        <header className="cot-topbar">
          <div className="cot-topbar-logo"><span>GFI</span>® · Cotizaciones</div>
          <div className="cot-topbar-right">
            <span className="cot-hora">Act: {ultimaAct}</span>
            <button className="cot-actualizar" onClick={cargarMercado}>↻</button>
            <a className="cot-btn-back" href="/dashboard">← Dashboard</a>
          </div>
        </header>

        <main className="cot-content">
          <div className="cot-header">
            <div>
              <h1>Cotizaciones <span>GFI®</span></h1>
              <p>Mercado de referencia · Proveedores de confianza · Match entre colegas</p>
            </div>
          </div>

          <div className="cot-tabs">
            <button className={`cot-tab${vista === "mercado" ? " activo" : ""}`} onClick={() => setVista("mercado")}>📊 Mercado</button>
            <button className={`cot-tab${vista === "proveedores" ? " activo" : ""}`} onClick={() => setVista("proveedores")}>🏢 Proveedores</button>
            <button className={`cot-tab${vista === "match" ? " activo" : ""}`} onClick={() => setVista("match")}>🔄 Match entre colegas</button>
          </div>

          {/* MERCADO */}
          {vista === "mercado" && (
            <>
              <div className="cot-seccion">
                <div className="cot-seccion-titulo">🇺🇸 Dólar / ARS</div>
                <div className="cot-tabla-wrap">
                  <table className="cot-tabla">
                    <thead><tr><th>Tipo</th><th>Compra</th><th>Venta</th><th>Promedio GFI®</th></tr></thead>
                    <tbody>
                      {loadingMercado ? [1,2,3,4,5].map(i => (
                        <tr key={i}><td><span className="skeleton" style={{width:80,height:14}} /></td><td><span className="skeleton" style={{width:70,height:14}} /></td><td><span className="skeleton" style={{width:70,height:14}} /></td><td><span className="skeleton" style={{width:70,height:14}} /></td></tr>
                      )) : dolares.map((d, i) => (
                        <tr key={i} className={d.destacado ? "destacado" : ""}>
                          <td><span className="cot-nombre">{d.label}</span></td>
                          <td className="td-c">{formatARS(d.compra)}</td>
                          <td className="td-v">{formatARS(d.venta)}</td>
                          <td className="td-p">{formatARS(d.promedio ?? null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="cot-seccion">
                <div className="cot-seccion-titulo">🌍 Otras divisas / ARS</div>
                <div className="cot-grid3">
                  {[{ data: euro, flag: "🇪🇺", label: "Euro" }, { data: brl, flag: "🇧🇷", label: "Real Brasileño" }].map(({ data, flag, label }, i) => (
                    <div key={i} className="cot-card">
                      <div className="cot-card-label">{flag} {label}</div>
                      <div className="cot-vals">
                        {[{ l: "Compra", v: data?.compra ?? null, c: "td-c" }, { l: "Venta", v: data?.venta ?? null, c: "td-v" }, { l: "Promedio", v: data?.promedio ?? null, c: "td-p" }].map(({ l, v, c }, j) => (
                          <div key={j}><div className="cot-val-label">{l}</div><div className={`cot-val-num ${c}`}>{loadingMercado ? <span className="skeleton" style={{width:55,height:16}} /> : formatARS(v)}</div></div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {cripto.map((c, i) => (
                    <div key={i} className="cot-card">
                      <div className="cot-card-label">🔷 {c.label}</div>
                      <div className="cot-vals">
                        {[{ l: "Compra", v: c.compra, cl: "td-c" }, { l: "Venta", v: c.venta, cl: "td-v" }, { l: "Promedio", v: c.promedio ?? null, cl: "td-p" }].map(({ l, v, cl }, j) => (
                          <div key={j}><div className="cot-val-label">{l}</div><div className={`cot-val-num ${cl}`}>{loadingMercado ? <span className="skeleton" style={{width:55,height:16}} /> : formatARS(v)}</div></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cot-nota">Datos provistos por DolarApi.com · Se actualizan cada 5 min · Solo referencia</div>
            </>
          )}

          {/* PROVEEDORES */}
          {vista === "proveedores" && (
            <div className="prov-grid">
              {loadingProv ? (
                <div className="prov-empty">Cargando proveedores...</div>
              ) : proveedores.length === 0 ? (
                <div className="prov-empty">No hay proveedores cargados todavía. El administrador los agrega desde el panel.</div>
              ) : proveedores.map(p => (
                <div key={p.id} className="prov-card">
                  <div className="prov-info">
                    <div className="prov-nombre">{p.nombre}</div>
                    {p.monedas && p.monedas.length > 0 && (
                      <div className="prov-monedas">
                        {p.monedas.map((m, i) => <span key={i} className="prov-moneda-tag">{MONEDA_FLAG[m] ?? ""} {m}</span>)}
                      </div>
                    )}
                    {p.servicios && p.servicios.length > 0 && (
                      <div className="prov-servicios">{p.servicios.join(" · ")}</div>
                    )}
                  </div>
                  <div className="prov-acciones">
                    {p.contacto_whatsapp && (
                      <a className="prov-btn-wa" href={`https://wa.me/${p.contacto_whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer">
                        📱 WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
              <div className="cot-nota">Proveedores verificados por GFI® · Consultá antes de cerrar una operación · Las cotizaciones pueden variar</div>
            </div>
          )}

          {/* MATCH */}
          {vista === "match" && (
            <>
              <div className="match-header">
                <div className="match-filtros">
                  <button className={`match-filtro${filtroTipo === "todos" ? " activo" : ""}`} onClick={() => setFiltroTipo("todos")}>Todos</button>
                  <button className={`match-filtro${filtroTipo === "venta" ? " activo" : ""}`} onClick={() => setFiltroTipo("venta")}>Venden</button>
                  <button className={`match-filtro${filtroTipo === "compra" ? " activo" : ""}`} onClick={() => setFiltroTipo("compra")}>Compran</button>
                  <span style={{width:1,background:"rgba(255,255,255,0.1)",margin:"0 4px"}} />
                  {["todas", ...MONEDAS].map(m => (
                    <button key={m} className={`match-filtro${filtroMoneda === m ? " activo" : ""}`} onClick={() => setFiltroMoneda(m)}>
                      {m === "todas" ? "Todas" : `${MONEDA_FLAG[m]} ${m}`}
                    </button>
                  ))}
                </div>
                <button className="match-btn-pub" onClick={() => setMostrarForm(true)}>+ Publicar</button>
              </div>

              <div className="match-nota">
                💡 Cuando encontrés un match, contactá al colega. Ambos pagan {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(costoMatch)} por transferencia para revelar los datos de contacto. Las publicaciones vencen a las 24hs.
              </div>

              <div className="match-columnas">
                <div>
                  <div className="match-col-titulo venta">✅ Venden ({ventas.length})</div>
                  {loadingMatch ? (
                    <div className="match-empty">Cargando...</div>
                  ) : ventas.length === 0 ? (
                    <div className="match-empty">No hay ofertas de venta ahora</div>
                  ) : ventas.map(p => (
                    <div key={p.id} className={`match-pub${p.perfil_id === userId ? " propia" : ""}`} style={{marginTop:8,borderRadius:6}}>
                      <div className="match-pub-info">
                        <div className="match-pub-monto">{MONEDA_FLAG[p.moneda]} {p.monto.toLocaleString("es-AR")} <span>{p.moneda}</span></div>
                        {p.precio_referencia && <div className="match-pub-precio">Al {p.precio_referencia}</div>}
                        {p.zona && <div className="match-pub-meta">📍 {p.zona}</div>}
                        {p.notas && <div className="match-pub-meta">💬 {p.notas}</div>}
                        <div className="match-pub-corredor">
                          {p.perfil_id === userId ? "📌 Tu publicación" : `C.I. ${p.perfiles?.apellido ?? ""}, ${p.perfiles?.nombre ?? ""} · Mat. ${p.perfiles?.matricula ?? "—"}`}
                        </div>
                        <div className="match-pub-meta">{formatFecha(p.created_at)}</div>
                      </div>
                      {p.perfil_id === userId ? (
                        <button className="match-btn-eliminar" onClick={() => eliminarPublicacion(p.id)}>✕</button>
                      ) : (
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                          <button className="match-btn-contactar">Contactar</button>
                          <div className="match-costo">Costo: {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(costoMatch)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <div className="match-col-titulo compra">🔴 Compran ({compras.length})</div>
                  {loadingMatch ? (
                    <div className="match-empty">Cargando...</div>
                  ) : compras.length === 0 ? (
                    <div className="match-empty">No hay pedidos de compra ahora</div>
                  ) : compras.map(p => (
                    <div key={p.id} className={`match-pub${p.perfil_id === userId ? " propia" : ""}`} style={{marginTop:8,borderRadius:6}}>
                      <div className="match-pub-info">
                        <div className="match-pub-monto">{MONEDA_FLAG[p.moneda]} {p.monto.toLocaleString("es-AR")} <span>{p.moneda}</span></div>
                        {p.precio_referencia && <div className="match-pub-precio">Al {p.precio_referencia}</div>}
                        {p.zona && <div className="match-pub-meta">📍 {p.zona}</div>}
                        {p.notas && <div className="match-pub-meta">💬 {p.notas}</div>}
                        <div className="match-pub-corredor">
                          {p.perfil_id === userId ? "📌 Tu publicación" : `C.I. ${p.perfiles?.apellido ?? ""}, ${p.perfiles?.nombre ?? ""} · Mat. ${p.perfiles?.matricula ?? "—"}`}
                        </div>
                        <div className="match-pub-meta">{formatFecha(p.created_at)}</div>
                      </div>
                      {p.perfil_id === userId ? (
                        <button className="match-btn-eliminar" onClick={() => eliminarPublicacion(p.id)}>✕</button>
                      ) : (
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                          <button className="match-btn-contactar">Contactar</button>
                          <div className="match-costo">Costo: {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(costoMatch)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODAL PUBLICAR */}
      {mostrarForm && (
        <div className="fn-modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="fn-modal">
            <h2>Publicar <span>divisa</span></h2>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Tipo</label>
                <select className="fn-select" value={formPub.tipo} onChange={e => setFormPub(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="venta">Vendo</option>
                  <option value="compra">Compro</option>
                </select>
              </div>
              <div className="fn-field">
                <label className="fn-label">Moneda</label>
                <select className="fn-select" value={formPub.moneda} onChange={e => setFormPub(p => ({ ...p, moneda: e.target.value }))}>
                  {MONEDAS.map(m => <option key={m} value={m}>{MONEDA_FLAG[m]} {m}</option>)}
                </select>
              </div>
            </div>
            <div className="fn-row">
              <div className="fn-field">
                <label className="fn-label">Monto *</label>
                <input className="fn-input" type="number" placeholder="500" value={formPub.monto} onChange={e => setFormPub(p => ({ ...p, monto: e.target.value }))} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Precio referencia</label>
                <input className="fn-input" placeholder="intermedio" value={formPub.precio_referencia} onChange={e => setFormPub(p => ({ ...p, precio_referencia: e.target.value }))} />
              </div>
            </div>
            <div className="fn-field">
              <label className="fn-label">Zona</label>
              <input className="fn-input" placeholder="zona centro, me puedo acercar..." value={formPub.zona} onChange={e => setFormPub(p => ({ ...p, zona: e.target.value }))} />
            </div>
            <div className="fn-field">
              <label className="fn-label">Notas adicionales</label>
              <input className="fn-input" placeholder="recibo transferencia, efectivo..." value={formPub.notas} onChange={e => setFormPub(p => ({ ...p, notas: e.target.value }))} />
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:8}}>
              ⏱ La publicación vence en 24 horas automáticamente.
            </div>
            <div className="fn-modal-actions">
              <button className="fn-btn-cancelar" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="fn-btn-guardar" onClick={publicar} disabled={guardando || !formPub.monto}>
                {guardando ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
