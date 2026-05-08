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
  const [stats, setStats] = useState({ busquedas: 0, ofrecidos: 0, matches: 0, miembros: 0 });
  const [miStats, setMiStats] = useState({ cartera: 0, crm: 0, leads: 0, loadingMi: true });
  const [matchesRecientes, setMatchesRecientes] = useState<{ id: string; created_at: string }[]>([]);
  const [proximosEventos, setProximosEventos] = useState<{ id: string; titulo: string; fecha: string; tipo: string; gratuito: boolean }[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const ciudadRef = useRef<HTMLInputElement>(null);

  const fetchClimaPorCoords = async (lat: number, lon: number, gpsActivo: boolean) => {
    setClimaLoading(true); setClimaError(false);
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=es`);
      const d = await r.json();
      if (d.cod && d.cod !== 200) throw new Error(d.message);
      setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: d.weather?.[0]?.icon ?? "01d", sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? "Tu ubicación", lat, lon, gpsActivo });
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
      setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: d.weather?.[0]?.icon ?? "01d", sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? ciudad, lat: d.coord?.lat ?? 0, lon: d.coord?.lon ?? 0, gpsActivo: false });
      localStorage.setItem("gfi_ciudad_clima", ciudad);
      setMostrarCiudadInput(false); setCiudadInput("");
    } catch { setClimaError(true); }
    setClimaLoading(false);
  };

  const cargarGruposColaborador = async () => {
    setLoadingGrupos(true);
    const { data: gruposData } = await supabase
      .from("grupos_chat").select("*").eq("activo", true).eq("solo_matriculado", false).order("orden");
    if (!gruposData) { setLoadingGrupos(false); return; }
    const grupoIds = gruposData.map((g: any) => g.id);
    const { data: ultimos } = await supabase
      .from("mensajes_chat").select("grupo_id, texto, created_at, perfiles(nombre, apellido)")
      .in("grupo_id", grupoIds).order("created_at", { ascending: false }).limit(grupoIds.length * 3);
    const ultimosPorGrupo: Record<string, any> = {};
    (ultimos ?? []).forEach((m: any) => { if (!ultimosPorGrupo[m.grupo_id]) ultimosPorGrupo[m.grupo_id] = m; });
    setGrupos(gruposData.map((g: any) => {
      const u = ultimosPorGrupo[g.id];
      return { ...g, ultimo_mensaje: u?.texto ?? null, ultimo_autor: u?.perfiles ? `${u.perfiles.nombre ?? ""} ${u.perfiles.apellido ?? ""}`.trim() : null, ultimo_at: u?.created_at ?? null };
    }));
    setLoadingGrupos(false);
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
      supabase.from("perfiles").select("tipo").eq("id", uid).single().then(({ data: p }) => {
        const tipo = p?.tipo === "admin" ? "admin" : p?.tipo === "colaborador" ? "colaborador" : "corredor";
        setTipoUsuario(tipo);
        if (tipo === "colaborador") { cargarGruposColaborador(); return; }
        cargarDashboardCompleto(uid);
      });
    });
  }, []);

  const cargarDashboardCompleto = async (uid: string) => {
    // Stats de plataforma
    const [b, o, m, p] = await Promise.all([
      supabase.from("mir_busquedas").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("mir_ofrecidos").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("mir_matches").select("id", { count: "exact", head: true }),
      supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("estado", "activo"),
    ]);
    setStats({ busquedas: b.count ?? 0, ofrecidos: o.count ?? 0, matches: m.count ?? 0, miembros: p.count ?? 0 });

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
              setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: d.weather?.[0]?.icon ?? "01d", sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? ciudad, lat: d.coord?.lat ?? 0, lon: d.coord?.lon ?? 0, gpsActivo: false });
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

  const ACCESOS_MIR = [
    { icon: "🔍", label: "Publicar búsqueda", href: "/mir?nuevo=busqueda", primary: true },
    { icon: "🏠", label: "Publicar ofrecido", href: "/mir?nuevo=ofrecido", primary: true },
    { icon: "💱", label: "Cotizaciones", href: "/cotizaciones", primary: false },
    { icon: "📅", label: "Eventos", href: "/eventos", primary: false },
    { icon: "💬", label: "Foro", href: "/foro", primary: false },
    { icon: "📋", label: "Padrón", href: "/padron-gfi", primary: false },
    { icon: "📚", label: "Biblioteca", href: "/biblioteca", primary: false },
    { icon: "💰", label: "Suscripción", href: "/perfil", primary: false },
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
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
          .colab-titulo { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 4px; }
          .colab-titulo span { color: #cc0000; }
          .colab-sub { font-size: 12px; color: rgba(255,255,255,0.3); margin-bottom: 20px; font-family: 'Inter',sans-serif; }
          .colab-grupos { display: flex; flex-direction: column; gap: 6px; }
          .colab-grupo { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: border-color 0.15s; text-decoration: none; }
          .colab-grupo:hover { border-color: rgba(200,0,0,0.3); background: rgba(200,0,0,0.03); }
          .colab-grupo-ico { width: 44px; height: 44px; border-radius: 10px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
          .colab-grupo-info { flex: 1; min-width: 0; }
          .colab-grupo-nombre { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 3px; }
          .colab-grupo-ultimo { font-size: 11px; color: rgba(255,255,255,0.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .colab-grupo-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
          .colab-grupo-hora { font-size: 9px; color: rgba(255,255,255,0.2); font-family: 'Montserrat',sans-serif; }
          .colab-grupo-autor { font-size: 9px; color: rgba(255,255,255,0.25); font-family: 'Inter',sans-serif; }
          .colab-seccion { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.2); margin: 20px 0 10px; }
          .colab-empty { padding: 32px; text-align: center; color: rgba(255,255,255,0.18); font-size: 12px; font-family: 'Inter',sans-serif; }
        `}</style>

        <div className="colab-titulo">Bienvenido a <span>GFI®</span></div>
        <div className="colab-sub">{hoy}</div>

        <div className="colab-seccion">Grupos de comunidad</div>

        {loadingGrupos ? (
          <div className="colab-empty">Cargando grupos...</div>
        ) : grupos.length === 0 ? (
          <div className="colab-empty">No hay grupos disponibles.</div>
        ) : (
          <div className="colab-grupos">
            {grupos.map(g => (
              <a key={g.id} href={`/comunidad/${g.id}`} className="colab-grupo">
                <div className="colab-grupo-ico">{g.icono || "💬"}</div>
                <div className="colab-grupo-info">
                  <div className="colab-grupo-nombre">{g.nombre}</div>
                  <div className="colab-grupo-ultimo">
                    {g.ultimo_mensaje
                      ? (g.ultimo_autor ? `${g.ultimo_autor}: ` : "") + g.ultimo_mensaje
                      : "Sin mensajes aún"}
                  </div>
                </div>
                <div className="colab-grupo-meta">
                  {g.ultimo_at && <span className="colab-grupo-hora">{fmtUltimoAt(g.ultimo_at)}</span>}
                  {g.va_al_mir && <span style={{fontSize:8,padding:"1px 5px",borderRadius:8,background:"rgba(200,0,0,0.1)",border:"1px solid rgba(200,0,0,0.2)",color:"rgba(200,0,0,0.7)",fontFamily:"Montserrat,sans-serif",fontWeight:700}}>MIR</span>}
                </div>
              </a>
            ))}
          </div>
        )}
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
        .db-clima-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; cursor: pointer; transition: border-color 0.2s; }
        .db-clima-card:hover { border-color: rgba(255,255,255,0.15); }
        .db-clima-main { padding: 16px 18px 10px; display: flex; align-items: center; gap: 10px; }
        .db-clima-icon { width: 64px; height: 64px; flex-shrink: 0; }
        .db-clima-info { flex: 1; min-width: 0; }
        .db-clima-temp { font-family: 'Montserrat', sans-serif; font-size: 40px; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -0.02em; }
        .db-clima-desc { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
        .db-clima-minmax { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; }
        .db-clima-footer { border-top: 1px solid rgba(255,255,255,0.05); padding: 8px 18px; display: flex; align-items: center; justify-content: space-between; }
        .db-clima-detalles { display: flex; gap: 12px; }
        .db-clima-det { font-size: 10px; color: rgba(255,255,255,0.35); }
        .db-clima-ciudad { font-size: 9px; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.2); }
        .db-clima-hora { font-size: 20px; font-family: 'Montserrat', sans-serif; font-weight: 800; color: rgba(255,255,255,0.45); text-align: center; padding: 8px 18px; border-top: 1px solid rgba(255,255,255,0.05); letter-spacing: 0.04em; }
        .db-clima-ciudad-btn { background: none; border: none; color: rgba(200,0,0,0.6); font-size: 10px; cursor: pointer; font-family: 'Inter', sans-serif; text-align: center; padding: 6px 18px; width: 100%; transition: color 0.2s; }
        .db-clima-ciudad-btn:hover { color: #cc0000; }
        .db-ciudad-form { display: flex; gap: 6px; padding: 8px 14px; background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.06); }
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

      <div className="db-fecha">{hoy}</div>

      {/* 1. NOTICIAS */}
      <div style={{ marginBottom: 20 }}>
        <NoticiasWidget />
      </div>

      {/* 2. MI PANEL — stats personales del corredor */}
      <div style={{marginBottom:16}}>
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
      </div>

      {/* 3. ZÓCALO HOY EN GFI */}
      <div style={{
        display:"flex",alignItems:"stretch",
        background:"rgba(14,14,14,0.9)",border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:8,overflow:"hidden",marginBottom:16,
        borderTop:"2px solid #cc0000",flexWrap:"wrap"
      }}>
        {[
          [stats.busquedas.toString(),"Búsquedas activas","🔍"],
          [stats.ofrecidos.toString(),"Ofrecidos activos","🏠"],
          [stats.matches.toString(),"Matches totales","🔗"],
          [stats.miembros.toString(),"Miembros activos","👥"]
        ].map(([n,l,ic],i) => (
          <div key={i} style={{flex:1,minWidth:120,padding:"14px 20px",display:"flex",alignItems:"center",gap:12,borderRight:"1px solid rgba(255,255,255,0.06)"}}>
            <span style={{fontSize:22,flexShrink:0}}>{ic}</span>
            <div>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:800,color:"#cc0000",lineHeight:1}}>{n}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:3,fontFamily:"'Montserrat',sans-serif",letterSpacing:"0.06em"}}>{l}</div>
            </div>
          </div>
        ))}
        <div style={{padding:"14px 20px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div>
            <div style={{fontSize:8,fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.2)",marginBottom:3}}>Hoy en GFI®</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",fontFamily:"'Montserrat',sans-serif",fontWeight:600}}>{new Date().toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"})}</div>
          </div>
        </div>
      </div>

      {/* 3. CLIMA + ACCESOS RÁPIDOS PERSONALES */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 220px",gap:16,marginBottom:20,alignItems:"start"}}>
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

        <div className="db-clima-card" onClick={abrirClima}>
          {climaLoading ? (
            <div className="db-clima-main">
              <div className="skeleton" style={{width:64,height:64,borderRadius:8,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div className="skeleton" style={{width:70,height:40,borderRadius:4,marginBottom:6}}/>
                <div className="skeleton" style={{width:90,height:12,borderRadius:4}}/>
              </div>
            </div>
          ) : climaError || !clima ? (
            <div className="db-clima-main">
              <div style={{fontSize:48,flexShrink:0}}>🌡️</div>
              <div><div className="db-clima-temp" style={{fontSize:18}}>Sin datos</div><div className="db-clima-desc">No disponible</div></div>
            </div>
          ) : (
            <>
              <div className="db-clima-main">
                <img src={`https://openweathermap.org/img/wn/${clima.icon}@2x.png`} alt={climaDesc} className="db-clima-icon" style={{filter:"brightness(1.2) contrast(1.1)"}} />
                <div className="db-clima-info">
                  <div className="db-clima-temp">{clima.temp}°</div>
                  <div className="db-clima-desc">{climaDesc}</div>
                  <div className="db-clima-minmax">↓{clima.tempMin}° · ↑{clima.tempMax}°</div>
                </div>
              </div>
              <div className="db-clima-footer">
                <div className="db-clima-detalles">
                  <span className="db-clima-det">💧 {clima.humedad}%</span>
                  <span className="db-clima-det">💨 {clima.viento}km/h</span>
                  <span className="db-clima-det">🌡 ST {clima.sensacion}°</span>
                </div>
                <span className="db-clima-ciudad">{clima.gpsActivo ? "📍 " : ""}{clima.ciudad}</span>
              </div>
              <div className="db-clima-hora">{hora}</div>
            </>
          )}
          {!mostrarCiudadInput ? (
            <button className="db-clima-ciudad-btn" onClick={e => { e.stopPropagation(); setMostrarCiudadInput(true); }}>
              {clima ? "Cambiar ciudad" : "Ingresar ciudad"}
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
      </div>

      {/* 4. ACCESOS RÁPIDOS */}
      <div className="db-accesos">
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
      </div>

      {/* 5. INDICADORES */}
      <div className="db-indicadores">
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
      </div>

      {/* 6. BOTTOM */}
      <div className="db-bottom-row">
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
      </div>

      <NotificacionesWidget />
    </>
  );
}
