"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import NotificacionesWidget from "./NotificacionesWidget";
import NoticiasWidget from "./NoticiasWidget";
import TendenciasWidget from "./TendenciasWidget";

interface Dolar { compra: number; venta: number; promedio: number; }
interface Clima {
  temp: number; tempMin: number; tempMax: number;
  desc: string; icon: string; sensacion: number;
  humedad: number; viento: number; ciudad: string;
  lat: number; lon: number; gpsActivo: boolean;
  presion: number; visibilidad: number; nubes: number;
  windDeg: number; precipitacion: number; codIcono: number;
}
interface PronosticoItem {
  hora: string; // "14:00"
  temp: number;
  icon: string; // código OWM como "02d"
  desc: string;
  precipitacion: number;
  codIcono: number;
}
interface DailyForecast {
  dia: string; diaNombre: string; fecha: string;
  codIcono: number; icon: string;
  tempMax: number; tempMin: number; precipitacion: number;
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
  const [pronostico, setPronostico] = useState<PronosticoItem[]>([]);
  const [dailyForecast, setDailyForecast] = useState<DailyForecast[]>([]);
  const [mostrarCiudadInput, setMostrarCiudadInput] = useState(false);
  const [ciudadInput, setCiudadInput] = useState("");
  const [dolar, setDolar] = useState<Dolar | null>(null);
  const [dolarLoading, setDolarLoading] = useState(true);
  const [iclData, setIclData] = useState<{ acum: Acum; periodo: string; loading: boolean }>({ acum: { mensual: null, trimestral: null, cuatrimestral: null, semestral: null }, periodo: "", loading: true });
  const [ipcData, setIpcData] = useState<{ acum: Acum; periodo: string; loading: boolean }>({ acum: { mensual: null, trimestral: null, cuatrimestral: null, semestral: null }, periodo: "", loading: true });
  const [jus, setJus] = useState<{ valor: string; loading: boolean }>({ valor: "", loading: true });
  const [stats, setStats] = useState({ busquedas: 0, ofrecidos: 0, matches: 0, miembros: 0, enLinea: 0 });
  const [miStats, setMiStats] = useState({ cartera: 0, crm: 0, leads: 0, negocios: 0, tareas: 0, vistas: 0, loadingMi: true });
  const [matchesRecientes, setMatchesRecientes] = useState<{ id: string; created_at: string }[]>([]);
  const [proximosEventos, setProximosEventos] = useState<{ id: string; titulo: string; fecha: string; tipo: string; gratuito: boolean }[]>([]);
  const [socialPostsRecientes, setSocialPostsRecientes] = useState<{ id: string; red: string; contenido_tipo: string; created_at: string }[]>([]);
  const [loadingSocialPosts, setLoadingSocialPosts] = useState(true);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [colabStats, setColabStats] = useState({ cartera: 0, contactos: 0, mirBusq: 0, redGfi: 0, loading: true });
  const [cocirEstado, setCocirEstado] = useState<string | null>(null);
  const [agendaHoy, setAgendaHoy] = useState<{
    tareas: { id: string; titulo: string; tipo: string; prioridad: string }[];
    visitas: { id: string; cliente_nombre: string; fecha_visita: string | null; propiedad?: { titulo: string } | null }[];
    recordatorios: { id: string; descripcion: string; contacto?: { nombre: string; apellido: string | null } | null }[];
    loading: boolean;
  }>({ tareas: [], visitas: [], recordatorios: [], loading: true });
  const ciudadRef = useRef<HTMLInputElement>(null);

  const WIDGET_LABELS: Record<string, string> = {
    noticias: "Noticias", mipanel: "Mi Panel", tendencias: "Pipeline & Tendencias", agenda: "Agenda de hoy", zocalo: "Actividad GFI", acciones: "Clima & Acciones", accesos: "Accesos rápidos", indicadores: "Indicadores económicos", bottom: "Matches & Eventos", socialPosts: "Publicaciones sociales",
  };
  const [dashUid, setDashUid] = useState("");
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

  const fetchPronostico = async (lat: number, lon: number) => {
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=es&cnt=40`);
      const d = await r.json();
      if (!d.list) return;

      // Carrusel horario — primeros 8 slots = ~24 hs
      const items: PronosticoItem[] = d.list.slice(0, 8).map((item: any) => ({
        hora: new Date(item.dt * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }),
        temp: Math.round(item.main.temp),
        icon: item.weather?.[0]?.icon ?? "01d",
        desc: item.weather?.[0]?.description ?? "",
        precipitacion: Math.round(((item.rain?.["3h"] ?? item.snow?.["3h"] ?? 0)) * 10) / 10,
        codIcono: item.weather?.[0]?.id ?? 800,
      }));
      setPronostico(items);

      // Pronóstico diario — agrupa por fecha, saltea hoy, toma 3 días
      const DIAS_C = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
      const hoyStr = new Date().toDateString();
      const byDate: Record<string, any[]> = {};
      for (const item of d.list) {
        const fd = new Date(item.dt * 1000);
        const key = fd.toDateString();
        if (key === hoyStr) continue;
        (byDate[key] = byDate[key] || []).push({ item, fd });
      }
      const daily: DailyForecast[] = Object.values(byDate).slice(0, 3).map((slots) => {
        const { fd } = slots[0];
        const temps = slots.map(s => Math.round(s.item.main.temp));
        const mid = slots[Math.floor(slots.length / 2)];
        const precip = slots.reduce((a, s) => a + (s.item.rain?.["3h"] ?? s.item.snow?.["3h"] ?? 0), 0);
        return {
          dia: DIAS_C[fd.getDay()],
          diaNombre: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][fd.getDay()],
          fecha: `${String(fd.getDate()).padStart(2,"0")}/${String(fd.getMonth()+1).padStart(2,"0")}`,
          codIcono: mid.item.weather?.[0]?.id ?? 800,
          icon: mid.item.weather?.[0]?.icon ?? "01d",
          tempMax: Math.max(...temps),
          tempMin: Math.min(...temps),
          precipitacion: Math.round(precip * 10) / 10,
        };
      });
      setDailyForecast(daily);
    } catch { /* silencioso */ }
  };

  const fetchClimaPorCoords = async (lat: number, lon: number, gpsActivo: boolean) => {
    setClimaLoading(true); setClimaError(false);
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=es`);
      const d = await r.json();
      if (d.cod && d.cod !== 200) throw new Error(d.message);
      setClima(parseClima(d, lat, lon, gpsActivo));
      await fetchPronostico(lat, lon);
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
      await fetchPronostico(d.coord?.lat ?? 0, d.coord?.lon ?? 0);
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
    const tick = () => setHora(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const uid = data.user.id;
      setDashUid(uid);
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
    const [cartera, crm, leads, negocios, tareas, vistasRes] = await Promise.all([
      supabase.from("cartera_propiedades").select("id", { count: "exact", head: true }).eq("perfil_id", uid).eq("estado", "activa"),
      supabase.from("crm_contactos").select("id", { count: "exact", head: true }).eq("perfil_id", uid).neq("estado", "archivado"),
      supabase.from("web_leads").select("id", { count: "exact", head: true }).eq("perfil_id", uid).eq("leido", false),
      supabase.from("crm_negocios").select("id", { count: "exact", head: true }).eq("perfil_id", uid).eq("archivado", false).not("etapa", "in", '("cerrado","perdido")'),
      supabase.from("crm_tareas").select("id", { count: "exact", head: true }).eq("perfil_id", uid).eq("estado", "pendiente"),
      supabase.from("cartera_propiedades").select("vistas").eq("perfil_id", uid).eq("publicada_web", true),
    ]);
    const totalVistas = (vistasRes.data ?? []).reduce((s: number, p: any) => s + (p.vistas ?? 0), 0);
    setMiStats({ cartera: cartera.count ?? 0, crm: crm.count ?? 0, leads: leads.count ?? 0, negocios: negocios.count ?? 0, tareas: tareas.count ?? 0, vistas: totalVistas, loadingMi: false });

    // Agenda de hoy
    const hoyStr = new Date().toISOString().split("T")[0];
    const [tareasHoy, visitasHoy, recordatoriosHoy] = await Promise.all([
      supabase.from("crm_tareas").select("id, titulo, tipo, prioridad").eq("perfil_id", uid).eq("estado", "pendiente").lte("fecha_vencimiento", hoyStr).order("prioridad").limit(5),
      supabase.from("cartera_visitas").select("id, cliente_nombre, fecha_visita, propiedad:cartera_propiedades(titulo)").eq("perfil_id", uid).eq("estado", "pendiente").gte("fecha_visita", hoyStr + "T00:00:00").lte("fecha_visita", hoyStr + "T23:59:59").order("fecha_visita").limit(5),
      supabase.from("crm_recordatorios").select("id, descripcion, contacto:crm_contactos(nombre, apellido)").eq("perfil_id", uid).eq("completado", false).gte("fecha_recordatorio", hoyStr).lte("fecha_recordatorio", hoyStr + "T23:59:59").order("fecha_recordatorio").limit(5),
    ]);
    setAgendaHoy({ tareas: tareasHoy.data as any ?? [], visitas: visitasHoy.data as any ?? [], recordatorios: recordatoriosHoy.data as any ?? [], loading: false });

    // Matches y eventos
    supabase.from("mir_matches").select("id, created_at").order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setMatchesRecientes(data ?? []));
    supabase.from("eventos").select("id, titulo, fecha, tipo, gratuito")
      .eq("estado", "publicado").gte("fecha", new Date().toISOString().split("T")[0])
      .order("fecha", { ascending: true }).limit(3)
      .then(({ data }) => setProximosEventos(data ?? []));

    // Últimas publicaciones sociales
    supabase.from("social_posts").select("id, red, contenido_tipo, created_at")
      .eq("estado", "success").order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => { setSocialPostsRecientes(data ?? []); setLoadingSocialPosts(false); });
    setLoadingSocialPosts(false);

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
  const colorAcum = (n: number | null) => n !== null ? (n > 0 ? "#f87171" : "#3abab6") : "var(--gfi-text-muted)";

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
    if (t < 5)  return "#4ab8d8";
    if (t < 15) return "#22d3ee";
    if (t < 22) return "#34d399";
    if (t < 28) return "#d4960c";
    if (t < 33) return "#d4960c";
    return "#b80000";
  };
  const climaCalidad = (c: Clima) => {
    const malo = c.precipitacion > 0 || c.viento > 50 || [200,201,202,210,211,212,221,230,231,232,300,301,302,310,311,312,313,314,321,500,501,502,503,504,511,520,521,522,531,600,601,602,611,612,613,615,616,620,621,622,701,711,721,731,741,751,761,762,771,781].includes(c.codIcono);
    const regular = c.viento > 30 || c.visibilidad < 5 || c.humedad > 85 || c.nubes > 80;
    if (malo) return { label: "⛈ No ideal para visitas", color: "#b80000", bg: "rgba(239,68,68,0.12)" };
    if (regular) return { label: "⛅ Condiciones regulares", color: "#d4960c", bg: "rgba(245,158,11,0.12)" };
    return { label: "✓ Buen día para mostrar", color: "#3abab6", bg: "rgba(34,197,94,0.12)" };
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
    { icon: "🗺️", label: "Mapa", href: "/crm/cartera/mapa", primary: false },
    { icon: "🌐", label: "Mi web", href: "/mi-web", primary: false },
    { icon: "📬", label: "Leads", href: "/mi-web/leads", primary: false, badge: miStats.leads > 0 ? miStats.leads : 0 },
    { icon: "🎯", label: "Prospectos", href: "/crm/smart-prospecting", primary: false },
    { icon: "📊", label: "Tasador IA", href: "/comparables/tasador", primary: false },
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
          .colab-titulo { font-family: var(--font-display); font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 3px; }
          .colab-titulo span { color: #990000; }
          .colab-sub { font-size: 12px; color: rgba(255,255,255,0.28); font-family: var(--font-body); text-transform: capitalize; }
          .colab-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 28px; }
          .colab-stat { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; padding: 16px 18px; }
          .colab-stat-val { font-family: var(--font-display); font-size: 26px; font-weight: 800; color: #990000; line-height: 1; }
          .colab-stat-label { font-size: 10px; color: var(--gfi-text-muted); margin-top: 5px; font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.1em; }
          .colab-seccion { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gfi-text-dim); margin-bottom: 12px; }
          .colab-accesos { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; }
          .colab-acceso { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border-subtle); border-radius: 8px; padding: 18px 14px; text-align: center; text-decoration: none; transition: border-color 0.15s, background 0.15s; display: flex; flex-direction: column; align-items: center; gap: 8px; }
          .colab-acceso:hover { border-color: rgba(200,0,0,0.35); background: rgba(200,0,0,0.04); }
          .colab-acceso-ico { font-size: 24px; }
          .colab-acceso-label { font-family: var(--font-display); font-size: 11px; font-weight: 700; color: #fff; }
          .colab-acceso-desc { font-size: 10px; color: var(--gfi-text-muted); font-family: var(--font-body); }
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
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        /* ── Design Tokens ── */
        :root {
          --db-bg:        #080a0c;
          --db-card:      #111318;
          --db-s1:        rgba(255,255,255,0.020);
          --db-s2:        rgba(255,255,255,0.035);
          --db-bd:        #252a35;
          --db-bd2:       #333b4d;
          --db-red:       #990000;
          --db-red-g:     linear-gradient(135deg, #990000 0%, #b80000 100%);
          --db-red-soft:  rgba(153,0,0,0.09);
          --db-red-bd:    rgba(153,0,0,0.28);
          --db-txt:       #f0f4f8;
          --db-txt2:      #8892a4;
          --db-txt3:      #4a5568;
          --db-mono:      'JetBrains Mono', 'Courier New', monospace;
        }

        /* ── Date header ── */
        .db-fecha {
          font-size: 10px; color: var(--db-txt3); text-transform: capitalize;
          margin-bottom: 20px; font-family: var(--font-display);
          font-weight: 700; letter-spacing: 0.12em;
        }

        /* ── Panels ── */
        .db-panel {
          background: var(--db-card);
          border: 1px solid var(--db-bd);
          border-radius: 12px;
          padding: 22px 26px;
          position: relative; overflow: hidden;
        }
        .db-panel::before {
          content: '';
          position: absolute; inset: 0; border-radius: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,0.012) 0%, transparent 55%);
          pointer-events: none;
        }
        .db-panel.red-top::after {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, var(--db-red) 0%, rgba(153,0,0,0.12) 60%, transparent 100%);
        }

        /* ── Section title ── */
        .db-sec-titulo {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.26em; text-transform: uppercase;
          color: var(--db-txt3);
          margin-bottom: 14px;
          display: flex; align-items: center; gap: 10px;
        }
        .db-sec-titulo::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, var(--db-bd) 0%, transparent 100%);
        }

        /* ── Clima ── */
        .db-top-row { display: grid; grid-template-columns: 1fr 224px; gap: 14px; margin-bottom: 18px; }
        .db-hoy-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        .db-hoy-num {
          font-family: var(--db-mono); font-size: 30px; font-weight: 700;
          color: var(--db-red); line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .db-hoy-label { font-size: 9px; color: var(--db-txt3); margin-top: 6px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; }

        /* ── Clima widget ── */
        @keyframes db-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        @keyframes db-glow-sun { 0%,100%{filter:drop-shadow(0 0 10px rgba(255,210,80,.5))} 50%{filter:drop-shadow(0 0 28px rgba(255,210,80,.9)) drop-shadow(0 0 60px rgba(255,180,20,.35))} }
        @keyframes db-glow-rain { 0%,100%{filter:drop-shadow(0 0 8px rgba(100,180,255,.4))} 50%{filter:drop-shadow(0 0 22px rgba(100,180,255,.8))} }
        @keyframes db-glow-storm { 0%,100%{filter:drop-shadow(0 0 8px rgba(200,160,255,.4))} 50%{filter:drop-shadow(0 0 26px rgba(200,160,255,.9))} }
        @keyframes db-glow-moon { 0%,100%{filter:drop-shadow(0 0 10px rgba(150,200,255,.4))} 50%{filter:drop-shadow(0 0 24px rgba(150,200,255,.7))} }
        @keyframes db-rain-drop { 0%{transform:translateY(-8px);opacity:0} 20%{opacity:.55} 100%{transform:translateY(28px);opacity:0} }
        @keyframes db-slide-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

        .db-clima-card {
          border-radius: 14px; display: flex; flex-direction: column; overflow: hidden;
          cursor: pointer; transition: transform 0.22s, box-shadow 0.22s; border: 1px solid rgba(255,255,255,0.07);
        }
        .db-clima-card:hover { transform: translateY(-2px); box-shadow: 0 16px 48px rgba(0,0,0,.65); }

        .db-wt-header { padding: 14px 16px 10px; display: flex; align-items: flex-start; justify-content: space-between; }
        .db-wt-ciudad { font-size: 9px; font-family: var(--font-display); font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: rgba(255,255,255,.55); margin-bottom: 3px; }
        .db-wt-dia { font-size: 11px; font-family: var(--font-display); font-weight: 700; color: rgba(255,255,255,.75); letter-spacing: .04em; }
        .db-wt-reloj { font-family: var(--db-mono); font-size: 26px; font-weight: 700; color: #fff; letter-spacing: -.02em; line-height: 1; font-variant-numeric: tabular-nums; }

        .db-wt-main { padding: 0 16px 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .db-wt-left {}
        .db-wt-temp { font-family: var(--db-mono); font-size: 52px; font-weight: 700; line-height: 1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
        .db-wt-temp-unit { font-size: 20px; font-weight: 400; opacity: .45; }
        .db-wt-minmax { font-size: 11px; color: rgba(255,255,255,.6); font-family: var(--db-mono); margin-top: 3px; display: flex; gap: 8px; }
        .db-wt-minmax .up { color: #fca5a5; } .db-wt-minmax .dn { color: #93c5fd; }
        .db-wt-desc { font-size: 11px; color: rgba(255,255,255,.5); margin-top: 4px; font-style: italic; text-transform: capitalize; }
        .db-wt-emoji { font-size: 68px; line-height: 1; display: block; }
        .db-wt-emoji-sun  { animation: db-float 3s ease-in-out infinite, db-glow-sun 3s ease-in-out infinite; }
        .db-wt-emoji-rain { animation: db-float 2.5s ease-in-out infinite, db-glow-rain 2.5s ease-in-out infinite; }
        .db-wt-emoji-storm{ animation: db-float 2s ease-in-out infinite, db-glow-storm 2s ease-in-out infinite; }
        .db-wt-emoji-moon { animation: db-float 4s ease-in-out infinite, db-glow-moon 4s ease-in-out infinite; }
        .db-wt-emoji-cloud { animation: db-float 3.5s ease-in-out infinite; }

        .db-wt-stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 0; border-top: 1px solid rgba(255,255,255,.07); border-bottom: 1px solid rgba(255,255,255,.07); }
        .db-wt-stat { padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; border-right: 1px solid rgba(255,255,255,.06); }
        .db-wt-stat:last-child { border-right: none; }
        .db-wt-stat-val { font-family: var(--db-mono); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .db-wt-stat-label { font-size: 7px; color: rgba(255,255,255,.38); text-transform: uppercase; letter-spacing: .12em; font-family: var(--font-display); font-weight: 700; }

        .db-wt-calidad { margin: 8px 14px; padding: 4px 10px; border-radius: 20px; font-size: 8px; font-family: var(--font-display); font-weight: 800; letter-spacing: .08em; text-align: center; }

        .db-wt-forecast { display: flex; overflow-x: auto; gap: 0; scrollbar-width: none; border-top: 1px solid rgba(255,255,255,.07); }
        .db-wt-forecast::-webkit-scrollbar { display: none; }
        .db-wt-fitem { flex: 0 0 auto; min-width: 52px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 2px; border-right: 1px solid rgba(255,255,255,.06); animation: db-slide-in .3s ease both; }
        .db-wt-fitem:last-child { border-right: none; }
        .db-wt-fhora { font-size: 8px; font-family: var(--db-mono); color: rgba(255,255,255,.45); letter-spacing: .04em; }
        .db-wt-ftemp { font-size: 12px; font-family: var(--db-mono); font-weight: 700; color: #fff; }
        .db-wt-frain { font-size: 8px; color: #7dd3fc; font-family: var(--db-mono); font-weight: 600; }

        .db-wt-daily { display: grid; grid-template-columns: repeat(3,1fr); border-top: 1px solid rgba(255,255,255,.07); }
        .db-wt-ditem { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; border-right: 1px solid rgba(255,255,255,.06); animation: db-slide-in .4s ease both; }
        .db-wt-ditem:last-child { border-right: none; }
        .db-wt-ddia { font-size: 9px; font-family: var(--font-display); font-weight: 800; letter-spacing: .1em; color: rgba(255,255,255,.5); text-transform: uppercase; }
        .db-wt-dfecha { font-size: 8px; color: rgba(255,255,255,.3); font-family: var(--db-mono); }
        .db-wt-dtemp { font-size: 11px; font-family: var(--db-mono); font-weight: 700; color: rgba(255,255,255,.85); }
        .db-wt-dtemp .dn { color: #93c5fd; font-weight: 400; font-size: 10px; }

        .db-clima-ciudad-btn { background: none; border: none; border-top: 1px solid rgba(255,255,255,.06); color: rgba(153,0,0,.5); font-size: 10px; cursor: pointer; font-family: var(--font-body); text-align: center; padding: 7px 18px; width: 100%; transition: color 0.15s; }
        .db-clima-ciudad-btn:hover { color: var(--db-red); }
        .db-ciudad-form { display: flex; gap: 6px; padding: 8px 14px; border-top: 1px solid rgba(255,255,255,.06); }
        .db-ciudad-input { flex: 1; padding: 7px 10px; background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.1); border-radius: 6px; color: #fff; font-size: 12px; outline: none; font-family: var(--font-body); transition: border-color 0.15s; }
        .db-ciudad-input:focus { border-color: rgba(153,0,0,.6); }
        .db-ciudad-input::placeholder { color: rgba(255,255,255,.25); }
        .db-ciudad-btn { padding: 7px 12px; background: var(--db-red-g); border: none; border-radius: 6px; color: #fff; font-size: 13px; cursor: pointer; font-weight: 700; }

        /* ── Quick access grid ── */
        .db-accesos { margin-bottom: 18px; }
        .db-accesos-grid { display: grid; grid-template-columns: repeat(8,1fr); gap: 8px; }
        .db-acceso {
          background: var(--db-card); border: 1px solid var(--db-bd);
          border-radius: 10px; padding: 15px 8px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer; text-align: center; text-decoration: none;
          transition: all 0.16s; position: relative; overflow: hidden;
        }
        .db-acceso::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.014) 0%, transparent 100%); pointer-events: none; }
        .db-acceso:hover { border-color: var(--db-red-bd); background: var(--db-red-soft); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(153,0,0,0.10); }
        .db-acceso.primary { border-color: var(--db-red-bd); background: var(--db-red-soft); }
        .db-acceso.primary:hover { background: rgba(153,0,0,0.13); border-color: var(--db-red); box-shadow: 0 8px 24px rgba(153,0,0,0.18); }
        .db-acceso-icon { font-size: 20px; }
        .db-acceso-label { font-size: 8px; color: var(--db-txt2); font-family: var(--font-display); font-weight: 700; letter-spacing: 0.05em; line-height: 1.4; text-transform: uppercase; }
        .db-acceso.primary .db-acceso-label { color: var(--db-txt); }

        /* ── Economic indicators ── */
        .db-indicadores { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px; }
        .db-ind {
          background: var(--db-card); border: 1px solid var(--db-bd);
          border-radius: 12px; padding: 18px 20px;
          position: relative; overflow: hidden; transition: border-color 0.16s;
        }
        .db-ind:hover { border-color: var(--db-bd2); box-shadow: 0 6px 20px rgba(0,0,0,0.35); }
        .db-ind::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, transparent 100%); }
        .db-ind-label { font-size: 8px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--db-txt3); font-family: var(--font-display); margin-bottom: 10px; }
        .db-ind-valor { font-family: var(--db-mono); font-size: 22px; font-weight: 700; color: var(--db-txt); line-height: 1; font-variant-numeric: tabular-nums; }
        .db-ind-valor.verde { color: #3abab6; }
        .db-ind-sub { font-size: 10px; color: var(--db-txt3); margin-top: 5px; font-family: var(--font-body); }
        .db-ind-cv { font-size: 11px; color: var(--db-txt2); margin-top: 3px; font-family: var(--db-mono); }
        .db-ind-cv b { color: var(--db-txt); font-weight: 600; }
        .db-acums { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; margin-top: 12px; border-top: 1px solid var(--gfi-border-subtle); padding-top: 10px; }
        .db-acum-item { text-align: center; }
        .db-acum-label { font-size: 7px; font-family: var(--font-display); font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--db-txt3); margin-bottom: 4px; }
        .db-acum-val { font-size: 12px; font-family: var(--db-mono); font-weight: 700; font-variant-numeric: tabular-nums; }

        /* ── Bottom row ── */
        .db-bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
        .db-panel-titulo {
          font-family: var(--font-display); font-size: 9px; font-weight: 800;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--db-txt3); margin-bottom: 14px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .db-link-badge {
          font-size: 8px; padding: 3px 9px;
          background: var(--db-red-soft); border: 1px solid var(--db-red-bd);
          border-radius: 20px; color: var(--db-red);
          text-decoration: none; font-family: var(--font-display);
          font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase;
          transition: background 0.15s;
        }
        .db-link-badge:hover { background: rgba(153,0,0,0.16); }
        .db-empty { font-size: 12px; color: var(--db-txt3); text-align: center; padding: 28px 0; font-family: var(--font-body); }

        /* ── Skeleton ── */
        .skeleton { background: rgba(255,255,255,0.045); border-radius: 5px; animation: db-pulse 1.8s ease-in-out infinite; }
        @keyframes db-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.80; } }

        /* ── Mi panel stat cards ── */
        .db-mi-card {
          background: var(--db-card); border: 1px solid var(--db-bd);
          border-radius: 10px; padding: 16px 18px;
          display: flex; align-items: center; gap: 14px;
          text-decoration: none; transition: all 0.16s;
          position: relative; overflow: hidden;
        }
        .db-mi-card::after {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, var(--gfi-border-subtle) 0%, transparent 100%);
          pointer-events: none;
        }
        .db-mi-card:hover { border-color: var(--db-bd2); transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.40); }

        /* ── Stat numbers use monospace ── */
        .db-mi-num {
          font-family: var(--db-mono) !important;
          font-variant-numeric: tabular-nums;
          font-size: 30px !important; font-weight: 700 !important;
          line-height: 1 !important; letter-spacing: -0.01em !important;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) { .db-accesos-grid { grid-template-columns: repeat(4,1fr) !important; } }
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
            style={{ background: "none", border: "1px solid var(--gfi-border)", borderRadius: 6, color: "var(--gfi-text-muted)", fontSize: 13, padding: "4px 10px", cursor: "pointer", fontFamily: "Inter,sans-serif", display: "flex", alignItems: "center", gap: 5, transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--gfi-text-dim)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--gfi-border)"}
          >⚙️ <span style={{ fontSize: 11 }}>Personalizar</span></button>
          {mostrarPersonalizar && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#161616", border: "1px solid var(--gfi-border)", borderRadius: 8, padding: "12px 14px", minWidth: 210, zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.14em", color: "var(--gfi-text-muted)", marginBottom: 10 }}>MOSTRAR WIDGETS</div>
              {Object.entries(WIDGET_LABELS).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", cursor: "pointer", borderBottom: "1px solid var(--gfi-border-subtle)" }}>
                  <input type="checkbox" checked={widgetsActivos[key]} onChange={() => toggleWidget(key)} style={{ accentColor: "#990000", width: 14, height: 14, cursor: "pointer" }} />
                  <span style={{ fontSize: 12, color: widgetsActivos[key] ? "var(--gfi-text-primary)" : "var(--gfi-text-muted)", fontFamily: "Inter,sans-serif", userSelect: "none" }}>{label}</span>
                </label>
              ))}
              <button onClick={() => setMostrarPersonalizar(false)} style={{ marginTop: 10, width: "100%", padding: "5px 0", background: "rgba(153,0,0,0.12)", border: "1px solid rgba(153,0,0,0.25)", borderRadius: 5, color: "#990000", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em" }}>LISTO</button>
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
            <div style={{ fontSize:12, fontWeight:700, color:"#d4960c", fontFamily:"var(--font-display)", letterSpacing:"0.06em" }}>
              {cocirEstado === "suspendido" ? "Matrícula suspendida en COCIR" : cocirEstado === "no_encontrado" ? "Matrícula no encontrada en COCIR" : "Validación COCIR en curso"}
            </div>
            <div style={{ fontSize:11, color:"var(--gfi-text-muted)", marginTop:2 }}>
              {cocirEstado === "suspendido" ? "Tu matrícula figura como suspendida en el padrón COCIR. Contactá al administrador." : "Tu matrícula está siendo verificada. Se actualiza automáticamente cada noche."}
            </div>
          </div>
          <span style={{ fontSize:11, color:"rgba(249,115,22,0.7)", fontFamily:"var(--font-display)", flexShrink:0 }}>Ver padrón →</span>
        </a>
      )}

      {/* 2. MI PANEL — stats personales del corredor */}
      {widgetsActivos.mipanel && <div style={{marginBottom:16}}>
        <div className="db-sec-titulo">Mi panel</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          {[
            { n: miStats.loadingMi ? "…" : miStats.cartera.toString(), l: "Propiedades activas", ic: "🏘️", href: "/crm/cartera", color: "#990000" },
            { n: miStats.loadingMi ? "…" : miStats.crm.toString(), l: "Contactos CRM", ic: "👥", href: "/crm", color: "#3b82f6" },
            { n: miStats.loadingMi ? "…" : miStats.negocios.toString(), l: "Negocios activos", ic: "🤝", href: "/crm/negocios", color: miStats.negocios > 0 ? "#3abab6" : "var(--gfi-text-muted)" },
            { n: miStats.loadingMi ? "…" : miStats.tareas.toString(), l: "Tareas pendientes", ic: "📋", href: "/crm/tareas", color: miStats.tareas > 0 ? "#d4960c" : "var(--gfi-text-muted)" },
            { n: miStats.loadingMi ? "…" : miStats.leads.toString(), l: "Leads sin leer", ic: "📬", href: "/mi-web/leads", color: miStats.leads > 0 ? "#e879f9" : "var(--gfi-text-muted)" },
            { n: miStats.loadingMi ? "…" : miStats.vistas.toString(), l: "Vistas web", ic: "👁", href: "/crm/estadisticas", color: miStats.vistas > 0 ? "#a78bfa" : "var(--gfi-text-muted)" },
          ].map(({ n, l, ic, href, color }) => (
            <a key={l} href={href} className="db-mi-card">
              <span style={{fontSize:22,flexShrink:0,opacity:0.85}}>{ic}</span>
              <div style={{minWidth:0}}>
                <div className="db-mi-num" style={{color}}>{n}</div>
                <div style={{fontSize:9,color:"#4a5568",marginTop:5,fontFamily:"var(--font-display)",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:700}}>{l}</div>
              </div>
            </a>
          ))}
        </div>
      </div>}

      {/* 2b. TENDENCIAS — pipeline + leads vs cierres */}
      {widgetsActivos.tendencias && dashUid && (
        <TendenciasWidget uid={dashUid} />
      )}

      {/* 3. AGENDA DE HOY */}
      {widgetsActivos.agenda && (() => {
        const totalAgenda = agendaHoy.tareas.length + agendaHoy.visitas.length + agendaHoy.recordatorios.length;
        if (!agendaHoy.loading && totalAgenda === 0) return null;
        const prioColor: Record<string, string> = { urgente: "#b80000", alta: "#d4960c", normal: "#3b82f6", baja: "#6b7280" };
        const tipoIcon: Record<string, string> = { llamar: "📞", whatsapp: "💬", email: "✉️", visita: "🏠", documentacion: "📄", tasacion: "🏷️", publicar: "📢", seguimiento: "🔄", general: "✓" };
        return (
          <div style={{ marginBottom: 16 }}>
            <div className="db-sec-titulo">Agenda de hoy</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>

              {/* Tareas */}
              {agendaHoy.tareas.length > 0 && (
                <a href="/crm/tareas" style={{ textDecoration: "none", background: "var(--gfi-bg-card)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, padding: "14px 16px", display: "block" }}>
                  <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(168,85,247,0.7)", textTransform: "uppercase", marginBottom: 10 }}>Tareas vencidas / hoy ({agendaHoy.tareas.length})</div>
                  {agendaHoy.tareas.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 14 }}>{tipoIcon[t.tipo] ?? "✓"}</span>
                      <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titulo}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: prioColor[t.prioridad] ?? "#6b7280", flexShrink: 0 }}>{t.prioridad.toUpperCase()}</span>
                    </div>
                  ))}
                </a>
              )}

              {/* Visitas */}
              {agendaHoy.visitas.length > 0 && (
                <a href="/crm/visitas" style={{ textDecoration: "none", background: "var(--gfi-bg-card)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "14px 16px", display: "block" }}>
                  <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(34,197,94,0.7)", textTransform: "uppercase", marginBottom: 10 }}>Visitas de hoy ({agendaHoy.visitas.length})</div>
                  {agendaHoy.visitas.map(v => (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 14 }}>🏠</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.cliente_nombre}</div>
                        {v.propiedad && <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(v.propiedad as any).titulo}</div>}
                      </div>
                      {v.fecha_visita && (() => { const d = new Date(v.fecha_visita); return !isNaN(d.getTime()) ? <span style={{ fontSize: 10, color: "rgba(34,197,94,0.7)", flexShrink: 0 }}>{d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span> : null; })()}
                    </div>
                  ))}
                </a>
              )}

              {/* Recordatorios */}
              {agendaHoy.recordatorios.length > 0 && (
                <a href="/crm/recordatorios" style={{ textDecoration: "none", background: "var(--gfi-bg-card)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "14px 16px", display: "block" }}>
                  <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.14em", color: "rgba(245,158,11,0.7)", textTransform: "uppercase", marginBottom: 10 }}>Recordatorios de hoy ({agendaHoy.recordatorios.length})</div>
                  {agendaHoy.recordatorios.map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 14 }}>🔔</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descripcion}</div>
                        {r.contacto && <div style={{ fontSize: 10, color: "var(--gfi-text-muted)" }}>{(r.contacto as any).nombre} {(r.contacto as any).apellido ?? ""}</div>}
                      </div>
                    </div>
                  ))}
                </a>
              )}

            </div>
          </div>
        );
      })()}

      {/* 4. ZÓCALO HOY EN GFI */}
      {widgetsActivos.zocalo && <div style={{
        display:"flex",alignItems:"stretch",
        background:"#111318",
        border:"1px solid #252a35",
        borderTop:"1px solid rgba(153,0,0,0.35)",
        borderRadius:10,overflow:"hidden",marginBottom:16,
        flexWrap:"wrap",
        boxShadow:"0 0 0 1px var(--gfi-bg-secondary) inset",
      }}>
        {[
          [stats.busquedas.toString(),"Búsquedas activas","🔍"],
          [stats.ofrecidos.toString(),"Ofrecidos activos","🏠"],
          [stats.matches.toString(),"Matches totales","🔗"],
        ].map(([n,l,ic],i) => (
          <div key={i} style={{flex:1,minWidth:120,padding:"14px 20px",display:"flex",alignItems:"center",gap:12,borderRight:"1px solid #1c2030"}}>
            <span style={{fontSize:20,flexShrink:0,opacity:0.85}}>{ic}</span>
            <div>
              <div style={{fontFamily:"'JetBrains Mono','Courier New',monospace",fontSize:24,fontWeight:700,color:"#990000",lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{n}</div>
              <div style={{fontSize:9,color:"#4a5568",marginTop:4,fontFamily:"var(--font-display)",letterSpacing:"0.08em",fontWeight:700,textTransform:"uppercase"}}>{l}</div>
            </div>
          </div>
        ))}
        {/* Miembros: activos + en línea */}
        <div style={{flex:1,minWidth:120,padding:"14px 20px",display:"flex",alignItems:"center",gap:12,borderRight:"1px solid #1c2030"}}>
          <span style={{fontSize:20,flexShrink:0,opacity:0.85}}>👥</span>
          <div>
            <div style={{fontFamily:"'JetBrains Mono','Courier New',monospace",fontSize:24,fontWeight:700,color:"#990000",lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{stats.miembros}</div>
            <div style={{fontSize:9,color:"#4a5568",marginTop:4,fontFamily:"var(--font-display)",letterSpacing:"0.08em",fontWeight:700,textTransform:"uppercase"}}>Miembros activos</div>
            <div style={{display:"flex",alignItems:"center",gap:4,marginTop:5}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"#3abab6",flexShrink:0,boxShadow:"0 0 5px #3abab6"}} />
              <span style={{fontFamily:"'JetBrains Mono','Courier New',monospace",fontSize:10,fontWeight:600,color:"#3abab6"}}>{stats.enLinea} en línea</span>
            </div>
          </div>
        </div>
        <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div>
            <div style={{fontSize:8,fontFamily:"var(--font-display)",fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:"#2d3748",marginBottom:4}}>Hoy en GFI®</div>
            <div style={{fontSize:11,color:"#8892a4",fontFamily:"'JetBrains Mono','Courier New',monospace",fontWeight:500}}>{new Date().toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"})}</div>
          </div>
        </div>
      </div>}

      {/* 3. CLIMA + ACCESOS RÁPIDOS PERSONALES */}
      {widgetsActivos.acciones && <div style={{display:"grid",gridTemplateColumns:"1fr 220px",gap:16,marginBottom:20,alignItems:"start"}}>
        <div style={{background:"var(--gfi-bg-card)",border:"1px solid var(--gfi-border-subtle)",borderRadius:8,padding:"16px 20px"}}>
          <div style={{fontSize:9,fontFamily:"var(--font-display)",fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"var(--gfi-text-dim)",marginBottom:14}}>Acciones rápidas</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {[
              {label:"Nueva propiedad",href:"/crm/cartera",color:"#990000"},
              {label:"Nuevo contacto",href:"/crm",color:"#3b82f6"},
              {label:"Nueva tarea",href:"/crm/tareas",color:"#d4960c"},
              {label:"Nuevo negocio",href:"/crm/negocios",color:"#3abab6"},
              {label:"Publicar en MIR",href:"/mir?nuevo=ofrecido",color:"var(--gfi-text-muted)"},
              {label:"Nueva búsqueda MIR",href:"/mir?nuevo=busqueda",color:"var(--gfi-text-muted)"},
            ].map(a => (
              <a key={a.href} href={a.href} style={{padding:"7px 14px",borderRadius:6,border:`1px solid ${a.color}33`,background:`${a.color}11`,color:a.color === "var(--gfi-text-muted)" ? "var(--gfi-text-secondary)" : a.color,fontSize:11,fontWeight:700,fontFamily:"var(--font-display)",textDecoration:"none",letterSpacing:"0.04em",transition:"all 0.15s"}}>
                {a.label}
              </a>
            ))}
          </div>
        </div>

        <div className="db-clima-card"
          style={{ background: clima ? climaGradient(clima.temp) : "linear-gradient(135deg,#0d1117 0%,#111827 100%)" }}
          onClick={abrirClima}>
          {climaLoading ? (
            <div style={{padding:"28px 16px",textAlign:"center"}}>
              <div className="skeleton" style={{width:44,height:44,borderRadius:22,margin:"0 auto 10px"}}/>
              <div className="skeleton" style={{width:90,height:44,borderRadius:6,margin:"0 auto 8px"}}/>
              <div className="skeleton" style={{width:110,height:12,borderRadius:4,margin:"0 auto"}}/>
            </div>
          ) : climaError || !clima ? (
            <div style={{padding:"36px 16px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:8}}>🌡️</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>Sin datos de clima</div>
            </div>
          ) : ((() => {
            const calidad = climaCalidad(clima);
            const tc = climaTempColor(clima.temp);
            const emoji = climaEmoji(clima.codIcono, clima.icon);
            const night = clima.icon?.endsWith("n");
            const emojiCls = clima.codIcono >= 200 && clima.codIcono < 300 ? "db-wt-emoji-storm"
              : clima.codIcono >= 300 && clima.codIcono < 700 ? "db-wt-emoji-rain"
              : clima.codIcono === 800 ? (night ? "db-wt-emoji-moon" : "db-wt-emoji-sun")
              : "db-wt-emoji-cloud";
            const ahora = new Date();
            const DIAS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
            const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
            const diaNombreHoy = DIAS_ES[ahora.getDay()];
            const fechaHoy = `${String(ahora.getDate()).padStart(2,"0")} ${MESES_ES[ahora.getMonth()]}`;
            return (
              <>
                {/* Header: ciudad + día + fecha */}
                <div className="db-wt-header">
                  <div>
                    <div className="db-wt-ciudad">{clima.gpsActivo ? "📍 " : ""}{clima.ciudad}</div>
                    <div className="db-wt-dia">{diaNombreHoy} · {fechaHoy}</div>
                    <div className="db-wt-reloj">{hora}</div>
                  </div>
                  {/* Emoji animado — derecha del header */}
                  <span className={`db-wt-emoji ${emojiCls}`}>{emoji}</span>
                </div>

                {/* Temperatura principal */}
                <div className="db-wt-main">
                  <div className="db-wt-left">
                    <div className="db-wt-temp" style={{color:tc}}>
                      {clima.temp}°<span className="db-wt-temp-unit">C</span>
                    </div>
                    <div className="db-wt-minmax">
                      <span className="dn">↓{clima.tempMin}°</span>
                      <span className="up">↑{clima.tempMax}°</span>
                      <span style={{color:"rgba(255,255,255,.5)"}}>ST {clima.sensacion}°</span>
                    </div>
                    <div className="db-wt-desc">{climaDesc}</div>
                  </div>
                </div>

                {/* Badge calidad */}
                <div className="db-wt-calidad" style={{color:calidad.color, background:calidad.bg}}>
                  {calidad.label}
                </div>

                {/* Stats */}
                <div className="db-wt-stats">
                  <div className="db-wt-stat">
                    <span className="db-wt-stat-val" style={{color:"#4ab8d8"}}>{clima.humedad}%</span>
                    <span className="db-wt-stat-label">💧 Humedad</span>
                  </div>
                  <div className="db-wt-stat">
                    <span className="db-wt-stat-val" style={{color:"#a5f3fc"}}>{clima.viento}<span style={{fontSize:9}}> km/h</span></span>
                    <span className="db-wt-stat-label">💨 Viento</span>
                  </div>
                  <div className="db-wt-stat">
                    <span className="db-wt-stat-val" style={{color: clima.precipitacion > 0 ? "#7dd3fc" : "rgba(255,255,255,.35)"}}>
                      {clima.precipitacion > 0 ? `${clima.precipitacion}mm` : `${clima.nubes}%`}
                    </span>
                    <span className="db-wt-stat-label">{clima.precipitacion > 0 ? "🌧 Lluvia" : "☁️ Nubes"}</span>
                  </div>
                </div>

                {/* Carrusel horario */}
                {pronostico.length > 0 && (
                  <div className="db-wt-forecast">
                    {pronostico.map((item, i) => (
                      <div key={i} className="db-wt-fitem" style={{animationDelay:`${i*40}ms`}}>
                        <span className="db-wt-fhora">{item.hora}</span>
                        <span style={{fontSize:20,lineHeight:1}}>{climaEmoji(item.codIcono, item.icon)}</span>
                        <span className="db-wt-ftemp">{item.temp}°</span>
                        {item.precipitacion > 0 && <span className="db-wt-frain">{item.precipitacion}mm</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pronóstico 3 días */}
                {dailyForecast.length > 0 && (
                  <div className="db-wt-daily">
                    {dailyForecast.map((d, i) => (
                      <div key={i} className="db-wt-ditem" style={{animationDelay:`${i*60}ms`}}>
                        <span className="db-wt-ddia">{d.dia}</span>
                        <span className="db-wt-dfecha">{d.fecha}</span>
                        <span style={{fontSize:28,lineHeight:1,margin:"4px 0"}}>{climaEmoji(d.codIcono, d.icon)}</span>
                        <span className="db-wt-dtemp">
                          {d.tempMax}° / <span className="dn">{d.tempMin}°</span>
                        </span>
                        {d.precipitacion > 0 && (
                          <span style={{fontSize:8,color:"#7dd3fc",fontFamily:"var(--db-mono)"}}>{d.precipitacion.toFixed(1)}mm</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
                <span style={{position:"absolute",top:8,right:8,background:"#d4960c",color:"#000",fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:10,fontFamily:"var(--font-display)"}}>
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
              <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom: i < matchesRecientes.length-1 ? "1px solid var(--gfi-border-subtle)" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:16 }}>🔗</span>
                  <span style={{ fontSize:12, color:"var(--gfi-text-secondary)" }}>Nuevo match generado</span>
                </div>
                <span style={{ fontSize:10, color:"var(--gfi-text-dim)", fontFamily:"var(--font-display)" }}>
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
              const TIPO_COLOR: Record<string,string> = { gfi:"#990000", cocir:"#d4960c", cir:"#818cf8", comercial:"#d4960c" };
              return (
                <a key={e.id} href="/eventos" style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom: i < proximosEventos.length-1 ? "1px solid var(--gfi-border-subtle)" : "none", textDecoration:"none" }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background: TIPO_COLOR[e.tipo] ?? "var(--gfi-text-muted)", flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:"var(--gfi-text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.titulo}</div>
                    <div style={{ fontSize:10, color:"var(--gfi-text-muted)", marginTop:2 }}>
                      {new Date(e.fecha).toLocaleDateString("es-AR",{day:"2-digit",month:"long"})} · {e.gratuito ? "Gratuito" : "Con entrada"}
                    </div>
                  </div>
                </a>
              );
            })
          }
        </div>
      </div>}

      {/* WIDGET PUBLICACIONES SOCIALES */}
      {widgetsActivos.socialPosts && tipoUsuario === "admin" && (
        <div className="db-panel" style={{background:"var(--gfi-bg-card)",border:"1px solid var(--gfi-border-subtle)",borderRadius:8,padding:"18px 20px",marginTop:0}}>
          <div className="db-panel-titulo" style={{fontFamily:"var(--font-display)",fontSize:11,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--gfi-text-muted)",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            Últimas publicaciones sociales
            <a href="/noticias" style={{fontSize:9,fontWeight:700,color:"rgba(200,0,0,0.7)",textDecoration:"none",letterSpacing:"0.1em",textTransform:"uppercase",padding:"3px 8px",border:"1px solid rgba(200,0,0,0.2)",borderRadius:3}}>Ver noticias</a>
          </div>
          {loadingSocialPosts ? (
            <div style={{color:"var(--gfi-text-dim)",fontSize:12,fontStyle:"italic"}}>Cargando...</div>
          ) : socialPostsRecientes.length === 0 ? (
            <div style={{color:"var(--gfi-text-dim)",fontSize:12,fontStyle:"italic",padding:"12px 0"}}>No hay publicaciones sociales todavía</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {socialPostsRecientes.map((sp, i) => {
                const RED_ICONS: Record<string, string> = { facebook: "FB", instagram: "IG", linkedin: "LK", twitter: "X", todas: "ALL" };
                const RED_COLORS: Record<string, string> = { facebook: "#1877f2", instagram: "#e1306c", linkedin: "#0077b5", twitter: "#1da1f2", todas: "#990000" };
                const color = RED_COLORS[sp.red] ?? "#990000";
                return (
                  <div key={sp.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i < socialPostsRecientes.length - 1 ? "1px solid var(--gfi-border-subtle)" : "none"}}>
                    <span style={{width:28,height:28,borderRadius:6,background:`${color}18`,border:`1px solid ${color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color,fontFamily:"var(--font-display)",flexShrink:0}}>
                      {RED_ICONS[sp.red] ?? sp.red.slice(0, 2).toUpperCase()}
                    </span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:"var(--gfi-text-primary)",textTransform:"capitalize"}}>{sp.contenido_tipo}</div>
                      <div style={{fontSize:10,color:"var(--gfi-text-muted)",marginTop:2}}>{new Date(sp.created_at).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</div>
                    </div>
                    <span style={{fontSize:9,fontFamily:"var(--font-display)",fontWeight:700,color,letterSpacing:"0.06em",textTransform:"uppercase"}}>{sp.red}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <NotificacionesWidget />
    </>
  );
}
