"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import NotificacionesWidget from "./NotificacionesWidget";
import NoticiasWidget from "./NoticiasWidget";

interface Dolar { compra: number; venta: number; promedio: number; }
interface Clima {
  temp: number; tempMin: number; tempMax: number;
  desc: string; icon: string; sensacion: number;
  humedad: number; viento: number; ciudad: string;
  lat: number; lon: number; gpsActivo: boolean;
  presion: number; visibilidad: number; nubes: number;
  windDeg: number; precipitacion: number; codIcono: number;
}
interface HistItem { periodo: string; valor: number; }
interface Acum { mensual: number | null; trimestral: number | null; cuatrimestral: number | null; semestral: number | null; }
interface Grupo {
  id: string; nombre: string; icono: string; tipo: string;
  va_al_mir: boolean; solo_matriculado: boolean; orden: number;
  ultimo_mensaje?: string; ultimo_autor?: string; ultimo_at?: string;
}

const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_KEY;

function calcICL(hist: HistItem[]): Acum {
  const s = [...hist].sort((a, b) => b.periodo.localeCompare(a.periodo));
  const v = s[0]?.valor;
  if (!v) return { mensual: null, trimestral: null, cuatrimestral: null, semestral: null };
  const g = (n: number) => s[n]?.valor ? ((v / s[n].valor) - 1) * 100 : null;
  return { mensual: g(1), trimestral: g(3), cuatrimestral: g(4), semestral: g(6) };
}

function calcIPC(hist: HistItem[]): Acum {
  const s = [...hist].sort((a, b) => b.periodo.localeCompare(a.periodo));
  const g = (n: number) => s.length >= n
    ? (s.slice(0, n).reduce((a, h) => a * (1 + h.valor / 100), 1) - 1) * 100
    : null;
  return { mensual: s[0]?.valor ?? null, trimestral: g(3), cuatrimestral: g(4), semestral: g(6) };
}

const fmtAcum = (n: number | null) => n !== null
  ? `${n >= 0 ? "+" : ""}${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
  : "—";

const fmtPeriodo = (p: string) => {
  if (!p) return "";
  const [a, m] = p.split("-");
  return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][parseInt(m)-1] + " " + a;
};

const fmtUltimoAt = (iso: string) => {
  const d = new Date(iso);
  const ahora = new Date();
  const diff = Math.floor((ahora.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};

export default function DashboardPage() {
  const router = useRouter();
  const [tipoUsuario, setTipoUsuario] = useState<"admin"|"corredor"|"colaborador">("corredor");
  const [hora, setHora] = useState("");
  const [clima, setClima] = useState<Clima | null>(null);
  const [climaLoading, setClimaLoading] = useState(true);
  const [climaError, setClimaError] = useState(false);
  const [mostrarCiudadInput, setMostrarCiudadInput] = useState(false);
  const [ciudadInput, setCiudadInput] = useState("");
  const [dolar, setDolar] = useState<Dolar | null>(null);
  const [dolarLoading, setDolarLoading] = useState(true);
  const [iclData, setIclData] = useState<{ acum: Acum; periodo: string; loading: boolean }>({ acum: { mensual: null, trimestral: null, cuatrimestral: null, semestral: null }, periodo: "", loading: true });
  const [ipcData, setIpcData] = useState<{ acum: Acum; periodo: string; loading: boolean }>({ acum: { mensual: null, trimestral: null, cuatrimestral: null, semestral: null }, periodo: "", loading: true });
  const [jus, setJus] = useState<{ valor: string; loading: boolean }>({ valor: "", loading: true });
  const [stats, setStats] = useState({ busquedas: 0, ofrecidos: 0, matches: 0, miembros: 0, enLinea: 0 });
  const [miStats, setMiStats] = useState({ cartera: 0, crm: 0, leads: 0, loadingMi: true });
  const [matchesRecientes, setMatchesRecientes] = useState<{ id: string; created_at: string }[]>([]);
  const [proximosEventos, setProximosEventos] = useState<{ id: string; titulo: string; fecha: string; tipo: string; gratuito: boolean }[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [colabStats, setColabStats] = useState({ cartera: 0, contactos: 0, mirBusq: 0, redGfi: 0, loading: true });
  const [cocirEstado, setCocirEstado] = useState<string | null>(null);
  const ciudadRef = useRef<HTMLInputElement>(null);

  const WIDGET_LABELS: Record<string, string> = {
    noticias: "Noticias", mipanel: "Mi Panel", zocalo: "Actividad GFI", acciones: "Clima & Acciones", accesos: "Accesos rápidos", indicadores: "Indicadores económicos", bottom: "Matches & Eventos",
  };
  const [widgetsActivos, setWidgetsActivos] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return Object.fromEntries(Object.keys(WIDGET_LABELS).map(k => [k, true]));
    try {
      const saved = JSON.parse(localStorage.getItem("gfi_dashboard_widgets") ?? "{}");
      return Object.fromEntries(Object.keys(WIDGET_LABELS).map(k => [k, saved[k] !== false]));
    } catch { return Object.fromEntries(Object.keys(WIDGET_LABELS).map(k => [k, true])); }
  });
  const [mostrarPersonalizar, setMostrarPersonalizar] = useState(false);

  const toggleWidget = (key: string) => {
    setWidgetsActivos(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("gfi_dashboard_widgets", JSON.stringify(next));
      return next;
    });
  };

  const parseClima = (d: any, lat: number, lon: number, gpsActivo: boolean, ciudadFallback?: string): Clima => ({
    temp: Math.round(d.main.temp),
    tempMin: Math.round(d.main.temp_min),
    tempMax: Math.round(d.main.temp_max),
    desc: d.weather?.[0]?.description ?? "",
    icon: d.weather?.[0]?.icon ?? "01d",
    codIcono: d.weather?.[0]?.id ?? 800,
    sensacion: Math.round(d.main.feels_like),
    humedad: d.main.humidity,
    viento: Math.round((d.wind?.speed ?? 0) * 3.6),
    windDeg: d.wind?.deg ?? 0,
    ciudad: d.name ?? ciudadFallback ?? "Tu ubicación",
    lat, lon, gpsActivo,
    presion: d.main.pressure ?? 1013,
    visibilidad: Math.round((d.visibility ?? 10000) / 1000),
    nubes: d.clouds?.all ?? 0,
    precipitacion: Math.round(((d.rain?.["1h"] ?? d.snow?.["1h"] ?? 0)) * 10) / 10,
  });

  const fetchClimaPorCoords = async (lat: number, lon: number, gpsActivo: boolean) => {
    setClimaLoading(true); setClimaError(false);
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=es`);
      const d = await r.json();
      if (d.cod && d.cod !== 200) throw new Error(d.message);
      setClima(parseClima(d, lat, lon, gpsActivo));
    } catch { setClimaError(true); }
    setClimaLoading(false);
  };

  const buscarCiudad = async () => {
    const ciudad = ciudadRef.current?.value?.trim() ?? ciudadInput.trim();
    if (!ciudad) return;
    setClimaLoading(true); setClimaError(false);
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ciudad)}&appid=${OWM_KEY}&units=metric&lang=es`);
      const d = await r.json();
      if (d.cod && d.cod !== 200) throw new Error(d.message);
      setClima(parseClima(d, d.coord?.lat ?? 0, d.coord?.lon ?? 0, false, ciudad));
      localStorage.setItem("gfi_ciudad_clima", ciudad);
      setMostrarCiudadInput(false); setCiudadInput("");
    } catch { setClimaError(true); }
    setClimaLoading(false);
  };

  const cargarDashboardColaborador = async (uid: string) => {
    const { data: colab } = await supabase
      .from("colaboradores").select("corredor_id").eq("user_id", uid).single();
    const corredor_id = colab?.corredor_id ?? uid;
    const [cartera, contactos, mirB, redG] = await Promise.all([
      supabase.from("cartera_propiedades").select("id", { count: "exact", head: true }).eq("perfil_id", corredor_id).eq("estado", "activa"),
      supabase.from("crm_contactos").select("id", { count: "exact", head: true }).eq("perfil_id", uid).neq("estado", "archivado"),
      supabase.from("mir_busquedas").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("mir_ofrecidos").select("id", { count: "exact", head: true }).eq("activo", true),
    ]);
    setColabStats({ cartera: cartera.count ?? 0, contactos: contactos.count ?? 0, mirBusq: mirB.count ?? 0, redGfi: redG.count ?? 0, loading: false });
  };

  // Reloj — useEffect propio para que el cleanup funcione correctamente
  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const uid = data.user.id;
      supabase.from("perfiles").select("tipo, cocir_estado").eq("id", uid).single().then(({ data: p }) => {
        const tipo = (p?.tipo === "admin" || p?.tipo === "master") ? "admin" : p?.tipo === "colaborador" ? "colaborador" : "corredor";
        setTipoUsuario(tipo);
        if (p?.cocir_estado && p.cocir_estado !== "activo") setCocirEstado(p.cocir_estado);
        if (tipo === "colaborador") { cargarDashboardColaborador(uid); return; }
        cargarDashboardCompleto(uid);
      });
    });
  }, []);

  const cargarDashboardCompleto = async (uid: string) => {
    // Marcar usuario como en línea
    supabase.from("perfiles").update({ ultimo_acceso: new Date().toISOString() }).eq("id", uid).then(() => {});

    // Stats de plataforma
    const quinceMinsAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [b, o, m, p, en] = await Promise.all([
      supabase.from("mir_busquedas").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("mir_ofrecidos").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("mir_matches").select("id", { count: "exact", head: true }),
      supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("estado", "activo"),
      supabase.from("perfiles").select("id", { count: "exact", head: true }).gte("ultimo_acceso", quinceMinsAtras),
    ]);
    setStats({ busquedas: b.count ?? 0, ofrecidos: o.count ?? 0, matches: m.count ?? 0, miembros: p.count ?? 0, enLinea: en.count ?? 0 });

    // Stats personales del corredor
    const [cartera, crm, leads] = await Promise.all([
      supabase.from("cartera_propiedades").select("id", { count: "exact", head: true }).eq("perfil_id", uid).eq("estado", "activa"),
      supabase.from("crm_contactos").select("id", { count: "exact", head: true }).eq("perfil_id", uid).neq("estado", "archivado"),
      supabase.from("web_leads").select("id", { count: "exact", head: true }).eq("perfil_id", uid).eq("leido", false),
    ]);
    setMiStats({ cartera: cartera.count ?? 0, crm: crm.count ?? 0, leads: leads.count ?? 0, loadingMi: false });

    // Matches y eventos
    supabase.from("mir_matches").select("id, created_at").order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setMatchesRecientes(data ?? []));
    supabase.from("eventos").select("id, titulo, fecha, tipo, gratuito")
      .eq("estado", "publicado").gte("fecha", new Date().toISOString().split("T")[0])
      .order("fecha", { ascending: true }).limit(3)
      .then(({ data }) => setProximosEventos(data ?? []));

    // Clima
    const ciudadGuardada = localStorage.getItem("gfi_ciudad_clima");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchClimaPorCoords(pos.coords.latitude, pos.coords.longitude, true),
        () => {
          const ciudad = ciudadGuardada ?? "Rosario,AR";
          fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ciudad)}&appid=${OWM_KEY}&units=metric&lang=es`)
            .then(r => r.json()).then(d => {
              if (d.cod && d.cod !== 200) { setClimaError(true); setClimaLoading(false); return; }
              setClima(parseClima(d, d.coord?.lat ?? 0, d.coord?.lon ?? 0, false, ciudad));
              setClimaLoading(false);
            }).catch(() => { setClimaError(true); setClimaLoading(false); });
        }, { timeout: 5000 }
      );
    } else { setClimaError(true); setClimaLoading(false); }

    // Dólar
    supabase.from("divisas_proveedores").select("nombre, compra_usd, venta_usd").eq("activo", true)
      .then(({ data }) => {
        const provs = (data || []).filter((p: any) => p.compra_usd !== null && p.venta_usd !== null);
        if (provs.length > 0) {
          const mejor = provs.reduce((max: any, p: any) => ((p.compra_usd + p.venta_usd) / 2) > ((max.compra_usd + max.venta_usd) / 2) ? p : max);
          setDolar({ compra: mejor.compra_usd, venta: mejor.venta_usd, promedio: Math.round(((mejor.compra_usd + mejor.venta_usd) / 2) * 100) / 100 });
        } else {
          fetch("https://dolarapi.com/v1/dolares/blue").then(r => r.json()).then(d => {
            const c = parseFloat(d.compra); const v = parseFloat(d.venta);
            setDolar({ compra: c, venta: v, promedio: Math.round(((c + v) / 2) * 100) / 100 });
          }).catch(() => setDolar(null));
        }
        setDolarLoading(false);
      });

    // Índices
    const hace7 = new Date(); hace7.setMonth(hace7.getMonth() - 7);
    const desde = hace7.toISOString().substring(0, 7);
    supabase.from("indicadores_historial").select("valor, periodo").eq("clave", "icl").gte("periodo", desde).order("periodo", { ascending: false })
      .then(({ data }) => { const hist = (data || []).map((h: any) => ({ periodo: h.periodo, valor: Number(h.valor) })); setIclData({ acum: calcICL(hist), periodo: hist[0]?.periodo ?? "", loading: false }); });
    supabase.from("indicadores_historial").select("valor, periodo").eq("clave", "ipc").gte("periodo", desde).order("periodo", { ascending: false })
      .then(({ data }) => { const hist = (data || []).map((h: any) => ({ periodo: h.periodo, valor: Number(h.valor) })); setIpcData({ acum: calcIPC(hist), periodo: hist[0]?.periodo ?? "", loading: false }); });
    supabase.from("indicadores").select("valor").eq("clave", "valor_jus").single()
      .then(({ data }) => setJus({ valor: data?.valor ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(data.valor) : "Sin datos", loading: false }));
  };

  const abrirClima = () => { if (clima) window.open(`https://weather.com/es-AR/tiempo/hoy/l/${clima.lat},${clima.lon}`, "_blank"); };
  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const formatPeso = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
  const climaDesc = clima?.desc ? clima.desc.charAt(0).toUpperCase() + clima.desc.slice(1) : "";
  const colorAcum = (n: number | null) => n !== null ? (n > 0 ? "#f87171" : "#22c55e") : "rgba(255,255,255,0.3)";

  // Weather helpers
  const windDirStr = (deg: number) => { const dirs = ["N","NE","E","SE","S","SO","O","NO"]; return dirs[Math.round(deg / 45) % 8]; };
  const climaGradient = (t: number) => {
    if (t < 5)  return "linear-gradient(135deg, #0f2744 0%, #1a3a5c 100%)";
    if (t < 15) return "linear-gradient(135deg, #0e2d3d 0%, #164e63 100%)";
    if (t < 22) return "linear-gradient(135deg, #0a2a1f 0%, #134e2c 100%)";
    if (t < 28) return "linear-gradient(135deg, #2a1e00 0%, #4a3300 100%)";
    if (t < 33) return "linear-gradient(135deg, #3a1200 0%, #6b2800 100%)";
    return "linear-gradient(135deg, #4a0900 0%, #7a0f00 100%)";
  };
  const climaTempColor = (t: number) => {
    if (t < 5)  return "#60a5fa";
    if (t < 15) return "#22d3ee";
    if (t < 22) return "#34d399";
    if (t < 28) return "#fbbf24";
    if (t < 33) return "#f97316";
    return "#ef4444";
  };
  const climaCalidad = (c: Clima) => {
    const malo = c.precipitacion > 0 || c.viento > 50 || [200,201,202,210,211,212,221,230,231,232,300,301,302,310,311,312,313,314,321,500,501,502,503,504,511,520,521,522,531,600,601,602,611,612,613,615,616,620,621,622,701,711,721,731,741,751,761,762,771,781].includes(c.codIcono);
    const regular = c.viento > 30 || c.visibilidad < 5 || c.humedad > 85 || c.nubes > 80;
    if (malo) return { label: "⛈ No ideal para visitas", color: "#ef4444", bg: "rgba(239,68,68,0.12)" };
    if (regular) return { label: "⛅ Condiciones regulares", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
    return { label: "✓ Buen día para mostrar", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  };
  const climaEmoji = (cod: number, icon: string): string => {
    const night = icon?.endsWith("n");
    if (cod >= 200 && cod < 300) return "⛈";
    if (cod >= 300 && cod < 400) return "🌧";
    if (cod >= 500 && cod < 510) return cod === 500 ? "🌦" : "🌧";
    if (cod >= 510 && cod < 600) return "🌧";
    if (cod >= 600 && cod < 700) return "❄️";
    if (cod === 701 || cod === 711 || cod === 721) return "🌫";
    if (cod >= 700 && cod < 800) return "🌪";
    if (cod === 800) return night ? "🌙" : "☀️";
    if (cod === 801) return night ? "🌙" : "🌤";
    if (cod === 802) return "⛅";
    if (cod >= 803) return "☁️";
    return "🌡";
  };

  const ACCESOS_MIR = [
    { icon: "🔍", label: "Publicar búsqueda", href: "/mir?nuevo=busqueda", primary: true },
    { icon: "🏠", label: "Publicar ofrecido", href: "/mir?nuevo=ofrecido", primary: true },
    { icon: "💱", label: "Cotizaciones", href: "/cotizaciones", primary: false },
    { icon: "📅", label: "Eventos", href: "/eventos", primary: false },
    { icon: "🤝", label: "Networking", href: "/networking", primary: false },
    { icon: "💬", label: "Foro", href: "/foro", primary: false },
    { icon: "📋", label: "Padrón", href: "/padron-gfi", primary: false },
    { icon: "📚", label: "Biblioteca", href: "/biblioteca", primary: false },
    { icon: "💰", label: "Suscripción", href: "/suscripcion", primary: false },
  ];

  const ACCESOS_MI = [
    { icon: "🏘️", label: "Mi cartera", href: "/crm/cartera", primary: true },
    { icon: "👥", label: "CRM", href: "/crm", primary: true },
    { icon: "🌐", label: "Mi web", href: "/mi-web", primary: false },
    { icon: "📬", label: "Leads", href: "/mi-web/leads", primary: false, badge: miStats.leads > 0 ? miStats.leads : 0 },
    { icon: "🎯", label: "Prospectos", href: "/crm/smart-prospecting", primary: false },
    { icon: "📊", label: "Tasador IA", href: "/comparables/tasador", primary: false },
    { icon: "⚙️", label: "Parámetros", href: "/crm/cartera/parametros", primary: false },
  ];

  // ── VISTA COLABORADOR ─────────────────────────────────────────────────────
  if (tipoUsuario === "colaborador") {
    const ACCESOS_COLAB = [
      { icon: "🔄", label: "MIR", href: "/mir", desc: "Búsquedas y ofrecidos" },
      { icon: "🏘️", label: "Cartera", href: "/crm/cartera", desc: "Propiedades del corredor" },
      { icon: "👥", label: "CRM", href: "/crm", desc: "Mis contactos" },
      { icon: "🌐", label: "Red GFI", href: "/red-gfi", desc: "Red de corredores" },
      { icon: "💬", label: "Comunidad", href: "/comunidad", desc: "Grupos de mi sector" },
    ];
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
          .colab-header { margin-bottom: 24px; }
          .colab-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 3px; }
          .colab-titulo span { color: #cc0000; }
          .colab-sub { font-size: 12px; color: rgba(255,255,255,0.28); font-family: 'Inter',sans-serif; text-transform: capitalize; }
          .colab-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 28px; }
          .colab-stat { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 16px 18px; }
          .colab-stat-val { font-family: 'Montserrat',sans-serif; font-size: 26px; font-weight: 800; color: #cc0000; line-height: 1; }
          .colab-stat-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 5px; font-family: 'Montserrat',sans-serif; text-transform: uppercase; letter-spacing: 0.1em; }
          .colab-seccion { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.2); margin-bottom: 12px; }
          .colab-accesos { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; }
          .colab-acceso { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 18px 14px; text-align: center; text-decoration: none; transition: border-color 0.15s, background 0.15s; display: flex; flex-direction: column; align-items: center; gap: 8px; }
          .colab-acceso:hover { border-color: rgba(200,0,0,0.35); background: rgba(200,0,0,0.04); }
          .colab-acceso-ico { font-size: 24px; }
          .colab-acceso-label { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: #fff; }
          .colab-acceso-desc { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Inter',sans-serif; }
          @media (max-width: 700px) { .colab-stats { grid-template-columns: repeat(2,1fr); } .colab-accesos { grid-template-columns: repeat(2,1fr); } }
        `}</style>

        <div className="colab-header">
          <div className="colab-titulo">Bienvenido a <span>GFI®</span></div>
          <div className="colab-sub">{hoy}</div>
        </div>

        <div className="colab-stats">
          {[
            { val: colabStats.loading ? "…" : colabStats.cartera, label: "Propiedades activas" },
            { val: colabStats.loading ? "…" : colabStats.contactos, label: "Mis contactos CRM" },
            { val: colabStats.loading ? "…" : colabStats.mirBusq, label: "Búsquedas MIR" },
            { val: colabStats.loading ? "…" : colabStats.redGfi, label: "En Red GFI" },
          ].map(s => (
            <div key={s.label} className="colab-stat">
              <div className="colab-stat-val">{s.val}</div>
              <div className="colab-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="colab-seccion">Accesos rápidos</div>
        <div className="colab-accesos">
          {ACCESOS_COLAB.map(a => (
            <a key={a.href} href={a.href} className="colab-acceso">
              <span className="colab-acceso-ico">{a.icon}</span>
              <span className="colab-acceso-label">{a.label}</span>
              <span className="colab-acceso-desc">{a.desc}</span>
            </a>
          ))}
        </div>
      </>
    );
  }

  // ── VISTA CORREDOR / ADMIN (dashboard completo) ───────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500&display=swap');
        .db-fecha { font-size: 12px; color: rgba(255,255,255,0.3); text-transform: capitalize; margin-bottom: 20px; }
        .db-top-row { display: grid; grid-template-columns: 1fr 220px; gap: 16px; margin-bottom: 20px; }
        .db-panel { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 20px 24px; position: relative; overflow: hidden; }
        .db-panel.red-top::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #cc0000, transparent); }
        .db-sec-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 16px; }
        .db-hoy-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
        .db-hoy-num { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; color: #cc0000; line-height: 1; }
        .db-hoy-label { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; }
        .db-clima-card { border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; cursor: pointer; transition: all 0.25s; border: 1px solid rgba(255,255,255,0.08); }
        .db-clima-card:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-1px); }
        .db-clima-top { padding: 14px 16px 0; display: flex; align-items: center; justify-content: space-between; }
        .db-clima-ciudad { font-size: 9px; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
        .db-clima-hora { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.35); }
        .db-clima-centro { padding: 10px 16px 8px; text-align: center; }
        .db-clima-emoji { font-size: 40px; line-height: 1; display: block; margin-bottom: 4px; }
        .db-clima-temp { font-family: 'Montserrat', sans-serif; font-size: 42px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
        .db-clima-desc { font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 4px; font-style: italic; }
        .db-clima-minmax { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 5px; display: flex; gap: 8px; justify-content: center; }
        .db-clima-minmax .up { color: #fca5a5; }
        .db-clima-minmax .dn { color: #93c5fd; }
        .db-clima-calidad { margin: 0 12px 10px; padding: 5px 10px; border-radius: 20px; font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.05em; text-align: center; }
        .db-clima-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 0; border-top: 1px solid rgba(255,255,255,0.08); }
        .db-clima-stat { padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; border-right: 1px solid rgba(255,255,255,0.06); }
        .db-clima-stat:last-child { border-right: none; }
        .db-clima-stat-val { font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 800; }
        .db-clima-stat-label { font-size: 7px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .db-clima-ciudad-btn { background: none; border: none; border-top: 1px solid rgba(255,255,255,0.05); color: rgba(200,0,0,0.6); font-size: 10px; cursor: pointer; font-family: 'Inter', sans-serif; text-align: center; padding: 7px 18px; width: 100%; transition: color 0.2s; }
        .db-clima-ciudad-btn:hover { color: #cc0000; }
        .db-ciudad-form { display: flex; gap: 6px; padding: 8px 14px; border-top: 1px solid rgba(255,255,255,0.06); }
        .db-ciudad-input { flex: 1; padding: 7px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; font-size: 12px; outline: none; font-family: 'Inter', sans-serif; }
        .db-ciudad-input:focus { border-color: #cc0000; }
        .db-ciudad-input::placeholder { color: rgba(255,255,255,0.25); }
        .db-ciudad-btn { padding: 7px 12px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-size: 13px; cursor: pointer; font-weight: 700; }
        .db-accesos { margin-bottom: 20px; }
        .db-accesos-grid { display: grid; grid-template-columns: repeat(8,1fr); gap: 10px; }
        .db-acceso { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 14px 8px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; text-align: center; text-decoration: none; transition: all 0.2s; }
        .db-acceso:hover { border-color: rgba(200,0,0,0.4); background: rgba(200,0,0,0.06); transform: translateY(-2px); }
        .db-acceso.primary { border-color: rgba(200,0,0,0.3); background: rgba(200,0,0,0.07); }
        .db-acceso.primary:hover { background: rgba(200,0,0,0.14); border-color: #cc0000; }
        .db-acceso-icon { font-size: 22px; }
        .db-acceso-label { font-size: 9px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-weight: 600; letter-spacing: 0.04em; line-height: 1.3; }
        .db-acceso.primary .db-acceso-label { color: rgba(255,255,255,0.8); }
        .db-indicadores { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .db-ind { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 16px 20px; }
        .db-ind-label { font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.25); font-family: 'Montserrat', sans-serif; margin-bottom: 8px; }
        .db-ind-valor { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1; }
        .db-ind-valor.verde { color: #22c55e; }
        .db-ind-sub { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px; }
        .db-ind-cv { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .db-ind-cv b { color: rgba(255,255,255,0.7); }
        .db-acums { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; }
        .db-acum-item { text-align: center; }
        .db-acum-label { font-size: 7px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.2); margin-bottom: 3px; }
        .db-acum-val { font-size: 11px; font-family: 'Montserrat',sans-serif; font-weight: 800; }
        .db-bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .db-panel-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
        .db-link-badge { font-size: 9px; padding: 3px 8px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3); border-radius: 20px; color: #cc0000; text-decoration: none; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .db-empty { font-size: 13px; color: rgba(255,255,255,0.2); text-align: center; padding: 24px 0; font-style: italic; }
        .skeleton { background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @media (max-width: 1100px) {
          .db-accesos-grid { grid-template-columns: repeat(4,1fr) !important; }
        }
        @media (max-width: 900px) {
          .db-top-row { grid-template-columns: 1fr; }
          .db-accesos-grid { grid-template-columns: repeat(4,1fr) !important; }
          .db-bottom-row { grid-template-columns: 1fr; }
          .db-hoy-grid { grid-template-columns: repeat(2,1fr); }
          .db-indicadores { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 600px) { .db-accesos-grid { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="db-fecha" style={{ marginBottom: 0 }}>{hoy}</div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMostrarPersonalizar(v => !v)}
            title="Personalizar dashboard"
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(255,255,255,0.35)", fontSize: 13, padding: "4px 10px", cursor: "pointer", fontFamily: "Inter,sans-serif", display: "flex", alignItems: "center", gap: 5, transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
          >⚙️ <span style={{ fontSize: 11 }}>Personalizar</span></button>
          {mostrarPersonalizar && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#161616", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 14px", minWidth: 210, zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>MOSTRAR WIDGETS</div>
              {Object.entries(WIDGET_LABELS).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <input type="checkbox" checked={widgetsActivos[key]} onChange={() => toggleWidget(key)} style={{ accentColor: "#cc0000", width: 14, height: 14, cursor: "pointer" }} />
                  <span style={{ fontSize: 12, color: widgetsActivos[key] ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", userSelect: "none" }}>{label}</span>
                </label>
              ))}
              <button onClick={() => setMostrarPersonalizar(false)} style={{ marginTop: 10, width: "100%", padding: "5px 0", background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.25)", borderRadius: 5, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em" }}>LISTO</button>
            </div>
          )}
        </div>
      </div>

      {/* 1. NOTICIAS */}
      {widgetsActivos.noticias && <div style={{ marginBottom: 20 }}>
        <NoticiasWidget />
      </div>}

      {/* BADGE COCIR — solo cuando validación está pendiente */}
      {cocirEstado && cocirEstado !== "activo" && tipoUsuario !== "admin" && (
        <a href="/padron-gfi" style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.25)", borderRadius:8, padding:"10px 16px", marginBottom:16, textDecoration:"none" }}>
          <span style={{ fontSize:18 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#f97316", fontFamily:"'Montserrat',sans-serif", letterSpacing:"0.06em" }}>
              {cocirEstado === "suspendido" ? "Matrícula suspendida en COCIR" : cocirEstado === "no_encontrado" ? "Matrícula no encontrada en COCIR" : "Validación COCIR en curso"}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
              {cocirEstado === "suspendido" ? "Tu matrícula figura como suspendida en el padrón COCIR. Contactá al administrador." : "Tu matrícula está siendo verificada. Se actualiza automáticamente cada noche."}
            </div>
          </div>
          <span style={{ fontSize:11, color:"rgba(249,115,22,0.7)", fontFamily:"'Montserrat',sans-serif", flexShrink:0 }}>Ver padrón →</span>
        </a>
      )}

      {/* 2. MI PANEL — stats personales del corredor */}
      {widgetsActivos.mipanel && <div style={{marginBottom:16}}>
        <div className="db-sec-titulo">Mi panel</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[
            { n: miStats.loadingMi ? "…" : miStats.cartera.toString(), l: "Propiedades activas", ic: "🏘️", href: "/crm/cartera", color: "#cc0000" },
            { n: miStats.loadingMi ? "…" : miStats.crm.toString(), l: "Contactos CRM", ic: "👥", href: "/crm", color: "#3b82f6" },
            { n: miStats.loadingMi ? "…" : miStats.leads.toString(), l: "Leads sin leer", ic: "📬", href: "/mi-web/leads", color: miStats.leads > 0 ? "#f59e0b" : "rgba(255,255,255,0.3)" },
          ].map(({ n, l, ic, href, color }) => (
            <a key={l} href={href} style={{background:"rgba(14,14,14,0.9)",border:`1px solid rgba(255,255,255,0.07)`,borderRadius:8,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,textDecoration:"none",transition:"border-color 0.2s"}}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}>
              <span style={{fontSize:26,flexShrink:0}}>{ic}</span>
              <div>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:28,fontWeight:800,color,lineHeight:1}}>{n}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:4,fontFamily:"'Montserrat',sans-serif",letterSpacing:"0.06em"}}>{l}</div>
              </div>
            </a>
          ))}
        </div>
      </div>}

      {/* 3. ZÓCALO HOY EN GFI */}
      {widgetsActivos.zocalo && <div style={{
        display:"flex",alignItems:"stretch",
        background:"rgba(14,14,14,0.9)",border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:8,overflow:"hidden",marginBottom:16,
        borderTop:"2px solid #cc0000",flexWrap:"wrap"
      }}>
        {[
          [stats.busquedas.toString(),"Búsquedas activas","🔍"],
          [stats.ofrecidos.toString(),"Ofrecidos activos","🏠"],
          [stats.matches.toString(),"Matches totales","🔗"],
        ].map(([n,l,ic],i) => (
          <div key={i} style={{flex:1,minWidth:120,padding:"14px 20px",display:"flex",alignItems:"center",gap:12,borderRight:"1px solid rgba(255,255,255,0.06)"}}>
            <span style={{fontSize:22,flexShrink:0}}>{ic}</span>
            <div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:800,color:"#cc0000",lineHeight:1}}>{n}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:3,fontFamily:"'Montserrat',sans-serif",letterSpacing:"0.06em"}}>{l}</div>
            </div>
          </div>
        ))}
        {/* Miembros: activos + en línea */}
        <div style={{flex:1,minWidth:120,padding:"14px 20px",display:"flex",alignItems:"center",gap:12,borderRight:"1px solid rgba(255,255,255,0.06)"}}>
          <span style={{fontSize:22,flexShrink:0}}>👥</span>
          <div>
            <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:800,color:"#cc0000",lineHeight:1}}>{stats.miembros}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:3,fontFamily:"'Montserrat',sans-serif",letterSpacing:"0.06em"}}>Miembros activos</div>
            <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",flexShrink:0,boxShadow:"0 0 4px #22c55e"}} />
              <span style={{fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:700,color:"#22c55e"}}>{stats.enLinea} en línea</span>
            </div>
          </div>
        </div>
        <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div>
            <div style={{fontSize:8,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.2)",marginBottom:3}}>Hoy en GFI®</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{new Date().toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"})}</div>
          </div>
        </div>
      </div>}

      {/* 3. CLIMA + ACCESOS RÁPIDOS PERSONALES */}
      {widgetsActivos.acciones && <div style={{display:"grid",gridTemplateColumns:"1fr 220px",gap:16,marginBottom:20,alignItems:"start"}}>
        <div style={{background:"rgba(14,14,14,0.9)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"16px 20px"}}>
          <div style={{fontSize:9,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)",marginBottom:14}}>Acciones rápidas</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {[
              {label:"Nueva propiedad",href:"/crm/cartera",color:"#cc0000"},
              {label:"Nuevo contacto",href:"/crm",color:"#3b82f6"},
              {label:"Nueva tarea",href:"/crm/tareas",color:"#f59e0b"},
              {label:"Nuevo negocio",href:"/crm/negocios",color:"#22c55e"},
              {label:"Publicar en MIR",href:"/mir?nuevo=ofrecido",color:"rgba(255,255,255,0.3)"},
              {label:"Nueva búsqueda MIR",href:"/mir?nuevo=busqueda",color:"rgba(255,255,255,0.3)"},
            ].map(a => (
              <a key={a.href} href={a.href} style={{padding:"7px 14px",borderRadius:6,border:`1px solid ${a.color}33`,background:`${a.color}11`,color:a.color === "rgba(255,255,255,0.3)" ? "rgba(255,255,255,0.5)" : a.color,fontSize:11,fontWeight:700,fontFamily:"'Montserrat',sans-serif",textDecoration:"none",letterSpacing:"0.04em",transition:"all 0.15s"}}>
                {a.label}
              </a>
            ))}
          </div>
        </div>

        <div className="db-clima-card"
          style={{ background: clima ? climaGradient(clima.temp) : "rgba(14,14,14,0.9)" }}
          onClick={abrirClima}>
          {climaLoading ? (
            <div style={{padding:"24px 16px",textAlign:"center"}}>
              <div className="skeleton" style={{width:40,height:40,borderRadius:20,margin:"0 auto 10px"}}/>
              <div className="skeleton" style={{width:80,height:40,borderRadius:6,margin:"0 auto 8px"}}/>
              <div className="skeleton" style={{width:100,height:12,borderRadius:4,margin:"0 auto"}}/>
            </div>
          ) : climaError || !clima ? (
            <div style={{padding:"30px 16px",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:8}}>🌡️</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>Sin datos</div>
            </div>
          ) : ((() => {
            const calidad = climaCalidad(clima);
            const tc = climaTempColor(clima.temp);
            return (
              <>
                <div className="db-clima-top">
                  <span className="db-clima-ciudad">{clima.gpsActivo ? "📍 " : ""}{clima.ciudad}</span>
                  <span className="db-clima-hora">{hora}</span>
                </div>
                <div className="db-clima-centro">
                  <span className="db-clima-emoji">{climaEmoji(clima.codIcono, clima.icon)}</span>
                  <div className="db-clima-temp" style={{color:tc}}>{clima.temp}°<span style={{fontSize:18,fontWeight:400,opacity:0.5}}>C</span></div>
                  <div className="db-clima-desc">{climaDesc}</div>
                  <div className="db-clima-minmax">
                    <span className="dn">↓ {clima.tempMin}°</span>
                    <span className="up">↑ {clima.tempMax}°</span>
                    <span>ST {clima.sensacion}°</span>
                  </div>
                </div>
                <div className="db-clima-calidad" style={{color:calidad.color, background:calidad.bg}}>
                  {calidad.label}
                </div>
                <div className="db-clima-stats">
                  <div className="db-clima-stat">
                    <span className="db-clima-stat-val" style={{color:"#60a5fa"}}>{clima.humedad}%</span>
                    <span className="db-clima-stat-label">💧 Humedad</span>
                  </div>
                  <div className="db-clima-stat">
                    <span className="db-clima-stat-val" style={{color:"#a5f3fc"}}>{clima.viento} <span style={{fontSize:9}}>km/h</span></span>
                    <span className="db-clima-stat-label">💨 Viento</span>
                  </div>
                  <div className="db-clima-stat">
                    <span className="db-clima-stat-val" style={{color: clima.precipitacion > 0 ? "#7dd3fc" : "rgba(255,255,255,0.3)"}}>{clima.precipitacion > 0 ? `${clima.precipitacion}mm` : `${clima.nubes}%`}</span>
                    <span className="db-clima-stat-label">{clima.precipitacion > 0 ? "🌧 Lluvia" : "☁️ Nubos."}</span>
                  </div>
                </div>
              </>
            );
          })())}
          {!mostrarCiudadInput ? (
            <button className="db-clima-ciudad-btn" onClick={e => { e.stopPropagation(); setMostrarCiudadInput(true); }}>
              {clima ? "📍 Cambiar ciudad" : "Ingresar ciudad"}
            </button>
          ) : (
            <div className="db-ciudad-form" onClick={e => e.stopPropagation()}>
              <input ref={ciudadRef} className="db-ciudad-input" placeholder="Rosario" value={ciudadInput}
                onChange={e => setCiudadInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") buscarCiudad(); }} autoFocus />
              <button className="db-ciudad-btn" onClick={buscarCiudad}>→</button>
            </div>
          )}
        </div>
      </div>}

      {/* 4. ACCESOS RÁPIDOS */}
      {widgetsActivos.accesos && <div className="db-accesos">
        <div className="db-sec-titulo">Mis herramientas</div>
        <div className="db-accesos-grid" style={{gridTemplateColumns:"repeat(7,1fr)"}}>
          {ACCESOS_MI.map((a, i) => (
            <a key={i} className={`db-acceso${a.primary ? " primary" : ""}`} href={a.href} style={{position:"relative"}}>
              <span className="db-acceso-icon">{a.icon}</span>
              <span className="db-acceso-label">{a.label}</span>
              {(a.badge ?? 0) > 0 && (
                <span style={{position:"absolute",top:8,right:8,background:"#f59e0b",color:"#000",fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:10,fontFamily:"'Montserrat',sans-serif"}}>
                  {a.badge}
                </span>
              )}
            </a>
          ))}
        </div>

        <div className="db-sec-titulo" style={{marginTop:20}}>Comunidad GFI</div>
        <div className="db-accesos-grid">
          {ACCESOS_MIR.map((a, i) => (
            <a key={i} className={`db-acceso${a.primary ? " primary" : ""}`} href={a.href}>
              <span className="db-acceso-icon">{a.icon}</span>
              <span className="db-acceso-label">{a.label}</span>
            </a>
          ))}
        </div>
      </div>}

      {/* 5. INDICADORES */}
      {widgetsActivos.indicadores && <div className="db-indicadores">
        <div className="db-ind">
          <div className="db-ind-label">USD Blue — Promedio</div>
          {dolarLoading ? <div className="skeleton" style={{height:28,width:120,marginTop:6}} /> : dolar ? (
            <>
              <div className="db-ind-valor verde">{formatPeso(dolar.promedio)}</div>
              <div style={{display:"flex",gap:12,marginTop:6}}>
                <span className="db-ind-cv">C: <b>{formatPeso(dolar.compra)}</b></span>
                <span className="db-ind-cv">V: <b>{formatPeso(dolar.venta)}</b></span>
              </div>
            </>
          ) : <div className="db-ind-valor">Sin datos</div>}
          <div className="db-ind-sub">Dólar blue · Tiempo real</div>
        </div>
        <div className="db-ind">
          <div className="db-ind-label">ICL — Contratos Locación</div>
          {iclData.loading ? <div className="skeleton" style={{height:28,width:100,marginTop:6}} /> : (
            <>
              <div className="db-ind-valor" style={{color:colorAcum(iclData.acum.mensual)}}>{fmtAcum(iclData.acum.mensual)}</div>
              <div className="db-ind-sub">{iclData.periodo ? `Mensual · ${fmtPeriodo(iclData.periodo)} · BCRA` : "BCRA"}</div>
              <div className="db-acums">
                {[{l:"1M",v:iclData.acum.mensual},{l:"3M",v:iclData.acum.trimestral},{l:"4M",v:iclData.acum.cuatrimestral},{l:"6M",v:iclData.acum.semestral}].map(({l,v}) => (
                  <div key={l} className="db-acum-item">
                    <div className="db-acum-label">{l}</div>
                    <div className="db-acum-val" style={{color:colorAcum(v)}}>{fmtAcum(v)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="db-ind">
          <div className="db-ind-label">IPC — Inflación Mensual</div>
          {ipcData.loading ? <div className="skeleton" style={{height:28,width:80,marginTop:6}} /> : (
            <>
              <div className="db-ind-valor" style={{color:colorAcum(ipcData.acum.mensual)}}>{fmtAcum(ipcData.acum.mensual)}</div>
              <div className="db-ind-sub">{ipcData.periodo ? `Mensual · ${fmtPeriodo(ipcData.periodo)} · INDEC` : "INDEC"}</div>
              <div className="db-acums">
                {[{l:"1M",v:ipcData.acum.mensual},{l:"3M",v:ipcData.acum.trimestral},{l:"4M",v:ipcData.acum.cuatrimestral},{l:"6M",v:ipcData.acum.semestral}].map(({l,v}) => (
                  <div key={l} className="db-acum-item">
                    <div className="db-acum-label">{l}</div>
                    <div className="db-acum-val" style={{color:colorAcum(v)}}>{fmtAcum(v)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="db-ind">
          <div className="db-ind-label">Valor JUS</div>
          {jus.loading ? <div className="skeleton" style={{height:28,width:100,marginTop:6}} /> : <div className="db-ind-valor">{jus.valor}</div>}
          <div className="db-ind-sub">COCIR 2da Circ. · Ley 13.154</div>
        </div>
      </div>}

      {/* 6. BOTTOM */}
      {widgetsActivos.bottom && <div className="db-bottom-row">
        <div className="db-panel">
          <div className="db-panel-titulo">Matches recientes<a href="/mir?vista=matches" className="db-link-badge">Ver todos</a></div>
          {matchesRecientes.length === 0
            ? <div className="db-empty">No hay matches todavía</div>
            : matchesRecientes.map((m, i) => (
              <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom: i < matchesRecientes.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:16 }}>🔗</span>
                  <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>Nuevo match generado</span>
                </div>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)", fontFamily:"'Montserrat',sans-serif" }}>
                  {new Date(m.created_at).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"})}
                </span>
              </div>
            ))
          }
        </div>
        <div className="db-panel">
          <div className="db-panel-titulo">Próximos eventos<a href="/eventos" className="db-link-badge">Ver todos</a></div>
          {proximosEventos.length === 0
            ? <div className="db-empty">No hay eventos programados</div>
            : proximosEventos.map((e, i) => {
              const TIPO_COLOR: Record<string,string> = { gfi:"#cc0000", cocir:"#f97316", cir:"#818cf8", comercial:"#eab308" };
              return (
                <a key={e.id} href="/eventos" style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom: i < proximosEventos.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none", textDecoration:"none" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background: TIPO_COLOR[e.tipo] ?? "rgba(255,255,255,0.3)", flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.titulo}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>
                      {new Date(e.fecha).toLocaleDateString("es-AR",{day:"2-digit",month:"long"})} · {e.gratuito ? "Gratuito" : "Con entrada"}
                    </div>
                  </div>
                </a>
              );
            })
          }
        </div>
      </div>}

      <NotificacionesWidget />
    </>
  );
}
