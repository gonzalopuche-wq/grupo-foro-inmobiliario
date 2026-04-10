"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const accesosRapidos = [
  { icon: "🔍", label: "Publicar búsqueda", href: "#", primary: true },
  { icon: "🏠", label: "Publicar ofrecido", href: "#", primary: true },
  { icon: "💵", label: "Cotizaciones", href: "/cotizaciones", primary: false },
  { icon: "📅", label: "Eventos", href: "/eventos", primary: false },
  { icon: "💬", label: "Foro", href: "#", primary: false },
  { icon: "📋", label: "Tasar", href: "#", primary: false },
  { icon: "📄", label: "Generar ficha", href: "#", primary: false },
  { icon: "📚", label: "Biblioteca", href: "#", primary: false },
];

interface Dolar { compra: number; venta: number; promedio: number; }
interface Clima {
  temp: number; tempMin: number; tempMax: number;
  desc: string; icon: string; sensacion: number;
  humedad: number; viento: number; ciudad: string;
  lat: number; lon: number; gpsActivo: boolean;
}

const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_KEY;

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [hora, setHora] = useState("");
  const [clima, setClima] = useState<Clima | null>(null);
  const [climaLoading, setClimaLoading] = useState(true);
  const [climaError, setClimaError] = useState(false);
  const [mostrarCiudadInput, setMostrarCiudadInput] = useState(false);
  const [ciudadInput, setCiudadInput] = useState("");
  const [dolar, setDolar] = useState<Dolar | null>(null);
  const [dolarLoading, setDolarLoading] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [icl, setIcl] = useState<{ valor: string; sub: string; loading: boolean }>({ valor: "", sub: "", loading: true });
  const [ipc, setIpc] = useState<{ valor: string; sub: string; loading: boolean }>({ valor: "", sub: "", loading: true });
  const [jus, setJus] = useState<{ valor: string; loading: boolean }>({ valor: "", loading: true });
  const ciudadRef = useRef<HTMLInputElement>(null);

  const fetchClimaPorCoords = async (lat: number, lon: number, gpsActivo: boolean) => {
    setClimaLoading(true);
    setClimaError(false);
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=es`);
      const d = await r.json();
      if (d.cod && d.cod !== 200) throw new Error(d.message);
      const iconCode = d.weather?.[0]?.icon ?? "01d";
      setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`, sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? "Tu ubicación", lat, lon, gpsActivo });
      setClimaError(false);
    } catch { setClimaError(true); }
    setClimaLoading(false);
  };

  const buscarCiudad = async () => {
    const ciudad = ciudadRef.current?.value?.trim() ?? ciudadInput.trim();
    if (!ciudad) return;
    setClimaLoading(true);
    setClimaError(false);
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ciudad)}&appid=${OWM_KEY}&units=metric&lang=es`);
      const d = await r.json();
      if (d.cod && d.cod !== 200) throw new Error(d.message);
      const iconCode = d.weather?.[0]?.icon ?? "01d";
      setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`, sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? ciudad, lat: d.coord?.lat ?? 0, lon: d.coord?.lon ?? 0, gpsActivo: false });
      localStorage.setItem("gfi_ciudad_clima", ciudad);
      setMostrarCiudadInput(false);
      setCiudadInput("");
    } catch { setClimaError(true); }
    setClimaLoading(false);
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/"; return; }
      setEmail(session.user.email ?? "");
      const n = session.user.email?.split("@")[0] ?? "";
      setNombre(n.charAt(0).toUpperCase() + n.slice(1));
      const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", session.user.id).single();
      if (perfil?.tipo === "admin") setEsAdmin(true);
    };
    getUser();

    const tick = () => setHora(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const interval = setInterval(tick, 1000);

    const ciudadGuardada = localStorage.getItem("gfi_ciudad_clima");

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchClimaPorCoords(pos.coords.latitude, pos.coords.longitude, true),
        () => {
          const ciudad = ciudadGuardada ?? "Rosario,AR";
          fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ciudad)}&appid=${OWM_KEY}&units=metric&lang=es`)
            .then(r => r.json())
            .then(d => {
              if (d.cod && d.cod !== 200) { setClimaError(true); setClimaLoading(false); return; }
              const iconCode = d.weather?.[0]?.icon ?? "01d";
              setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`, sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? ciudad, lat: d.coord?.lat ?? 0, lon: d.coord?.lon ?? 0, gpsActivo: false });
              setClimaLoading(false);
            })
            .catch(() => { setClimaError(true); setClimaLoading(false); });
        },
        { timeout: 5000 }
      );
    } else {
      setClimaError(true);
      setClimaLoading(false);
    }

    fetch("https://dolarapi.com/v1/dolares/blue")
      .then(r => r.json())
      .then(d => { const c = parseFloat(d.compra); const v = parseFloat(d.venta); setDolar({ compra: c, venta: v, promedio: Math.round(((c + v) / 2) * 100) / 100 }); setDolarLoading(false); })
      .catch(() => { setDolar(null); setDolarLoading(false); });

    fetch("https://argentinadatos.com/api/v1/finanzas/indices/icl/ultimo")
      .then(r => r.json())
      .then(d => { const valor = d?.valor ?? null; if (valor !== null) { const fs = d?.fecha ? new Date(d.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; setIcl({ valor: Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }), sub: fs ? `Al ${fs} · BCRA` : "BCRA", loading: false }); } else setIcl({ valor: "Sin datos", sub: "BCRA", loading: false }); })
      .catch(() => setIcl({ valor: "Sin datos", sub: "BCRA", loading: false }));

    fetch("https://argentinadatos.com/api/v1/finanzas/indices/inflacion/ultimo")
      .then(r => r.json())
      .then(d => { const valor = d?.valor ?? null; if (valor !== null) { const fs = d?.fecha ? new Date(d.fecha).toLocaleDateString("es-AR", { month: "long", year: "numeric" }) : ""; setIpc({ valor: `${Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`, sub: fs ? `${fs} · INDEC` : "INDEC", loading: false }); } else setIpc({ valor: "Sin datos", sub: "INDEC", loading: false }); })
      .catch(() => setIpc({ valor: "Sin datos", sub: "INDEC", loading: false }));

    supabase.from("indicadores").select("valor").eq("clave", "valor_jus").single()
      .then(({ data }) => { if (data?.valor) setJus({ valor: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(data.valor), loading: false }); else setJus({ valor: "Sin datos", loading: false }); })
      .catch(() => setJus({ valor: "Sin datos", loading: false }));

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/"; };
  const abrirClima = () => { if (clima) window.open(`https://weather.com/es-AR/tiempo/hoy/l/${clima.lat},${clima.lon}`, "_blank"); };
  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const formatPeso = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
  const climaDesc = clima?.desc ? clima.desc.charAt(0).toUpperCase() + clima.desc.slice(1) : "";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
        .db-root { min-height: 100vh; background: #0a0a0a; display: flex; flex-direction: column; }
        .db-topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 60px; background: rgba(14,14,14,0.98); border-bottom: 1px solid rgba(180,0,0,0.2); position: sticky; top: 0; z-index: 100; }
        .db-topbar-logo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
        .db-topbar-logo span { color: #cc0000; }
        .db-topbar-right { display: flex; align-items: center; gap: 12px; }
        .db-topbar-email { font-size: 12px; color: rgba(255,255,255,0.35); }
        .db-admin-btn { padding: 7px 16px; background: rgba(200,0,0,0.12); border: 1px solid rgba(200,0,0,0.35); border-radius: 3px; color: #cc0000; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; text-decoration: none; transition: all 0.2s; }
        .db-admin-btn:hover { background: rgba(200,0,0,0.22); color: #fff; }
        .db-logout { padding: 7px 18px; background: transparent; border: 1px solid rgba(200,0,0,0.35); border-radius: 3px; color: rgba(200,0,0,0.7); font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .db-logout:hover { background: rgba(200,0,0,0.1); color: #fff; }
        .db-content { flex: 1; padding: 32px; max-width: 1200px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
        .db-bienvenida { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 12px; animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .db-bienvenida h1 { font-family: 'Montserrat', sans-serif; font-size: 26px; font-weight: 800; }
        .db-bienvenida h1 span { color: #cc0000; }
        .db-fecha { font-size: 12px; color: rgba(255,255,255,0.3); text-transform: capitalize; }
        .db-top-row { display: grid; grid-template-columns: 1fr auto; gap: 20px; animation: fadeUp 0.5s 0.05s cubic-bezier(0.22,1,0.36,1) both; }
        .db-panel-base { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 24px; position: relative; overflow: hidden; }
        .db-panel-base.red-top::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #cc0000, transparent); }
        .db-seccion-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 16px; }
        .db-hoy-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
        .db-hoy-num { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; color: #cc0000; line-height: 1; }
        .db-hoy-label { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; }
        .db-clima-col { display: flex; flex-direction: column; gap: 8px; min-width: 170px; }
        .db-clima-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; display: flex; flex-direction: column; gap: 3px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .db-clima-box:hover { border-color: rgba(255,255,255,0.15); }
        .db-clima-box-static { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; display: flex; flex-direction: column; gap: 3px; text-align: center; }
        .db-clima-icon-wrap { display: flex; justify-content: center; }
        .db-clima-icon { width: 56px; height: 56px; }
        .db-clima-temp { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; line-height: 1; color: #fff; }
        .db-clima-desc { font-size: 11px; color: rgba(255,255,255,0.5); }
        .db-clima-minmax { font-size: 10px; color: rgba(255,255,255,0.3); }
        .db-clima-detalles { display: flex; justify-content: center; gap: 8px; margin-top: 3px; }
        .db-clima-det { font-size: 10px; color: rgba(255,255,255,0.3); }
        .db-clima-ciudad { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-top: 3px; }
        .db-clima-aviso { font-size: 9px; color: #eab308; margin-top: 3px; line-height: 1.4; }
        .db-clima-ver-mas { font-size: 9px; color: rgba(255,255,255,0.2); margin-top: 2px; }
        .db-clima-hora { font-size: 11px; color: rgba(255,255,255,0.2); margin-top: 3px; }
        .db-ciudad-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
        .db-ciudad-label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .db-ciudad-form { display: flex; gap: 6px; }
        .db-ciudad-input { flex: 1; padding: 8px 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .db-ciudad-input:focus { border-color: #cc0000; }
        .db-ciudad-input::placeholder { color: rgba(255,255,255,0.25); }
        .db-ciudad-btn { padding: 8px 14px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-size: 14px; cursor: pointer; font-weight: 700; flex-shrink: 0; }
        .db-ciudad-btn:hover { background: #e60000; }
        .db-ciudad-link { font-size: 10px; color: rgba(200,0,0,0.6); cursor: pointer; background: none; border: none; font-family: 'Inter', sans-serif; text-align: left; padding: 0; }
        .db-ciudad-link:hover { color: #cc0000; }
        .db-accesos { animation: fadeUp 0.5s 0.1s cubic-bezier(0.22,1,0.36,1) both; }
        .db-accesos-grid { display: grid; grid-template-columns: repeat(8,1fr); gap: 12px; }
        .db-acceso-btn { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 8px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; }
        .db-acceso-btn:hover { border-color: rgba(200,0,0,0.4); background: rgba(200,0,0,0.06); transform: translateY(-2px); }
        .db-acceso-btn.primary { border-color: rgba(200,0,0,0.3); background: rgba(200,0,0,0.07); }
        .db-acceso-btn.primary:hover { background: rgba(200,0,0,0.14); border-color: #cc0000; }
        .db-acceso-icon { font-size: 22px; }
        .db-acceso-label { font-size: 10px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-weight: 600; letter-spacing: 0.04em; line-height: 1.3; }
        .db-acceso-btn.primary .db-acceso-label { color: rgba(255,255,255,0.8); }
        .db-indicadores { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; animation: fadeUp 0.5s 0.15s cubic-bezier(0.22,1,0.36,1) both; }
        .db-ind { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; }
        .db-ind-label { font-size: 9px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.25); font-family: 'Montserrat', sans-serif; margin-bottom: 6px; }
        .db-ind-valor { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1; }
        .db-ind-valor.verde { color: #22c55e; }
        .db-ind-sub { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px; }
        .db-ind-cv { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .db-ind-cv b { color: rgba(255,255,255,0.7); }
        .db-bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; animation: fadeUp 0.5s 0.2s cubic-bezier(0.22,1,0.36,1) both; }
        .db-panel-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
        .db-link-badge { font-size: 9px; padding: 3px 8px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3); border-radius: 20px; color: #cc0000; text-decoration: none; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .db-empty { font-size: 13px; color: rgba(255,255,255,0.2); text-align: center; padding: 24px 0; font-style: italic; }
        .skeleton { background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 900px) { .db-top-row { grid-template-columns: 1fr; } .db-accesos-grid { grid-template-columns: repeat(4,1fr); } .db-bottom-row { grid-template-columns: 1fr; } .db-hoy-grid { grid-template-columns: repeat(2,1fr); } .db-indicadores { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 600px) { .db-content { padding: 16px; } .db-accesos-grid { grid-template-columns: repeat(2,1fr); } }
      `}</style>

      <div className="db-root">
        <header className="db-topbar">
          <div className="db-topbar-logo"><span>GFI</span>®</div>
          <div className="db-topbar-right">
            <span className="db-topbar-email">{email}</span>
            {esAdmin && <a className="db-admin-btn" href="/admin">Panel Admin</a>}
            <button className="db-logout" onClick={handleLogout}>Salir</button>
          </div>
        </header>

        <main className="db-content">
          <div className="db-bienvenida">
            <h1>Bienvenido, <span>{nombre}</span></h1>
            <span className="db-fecha">{hoy}</span>
          </div>

          <div className="db-top-row">
            <div className="db-panel-base red-top">
              <div className="db-seccion-titulo">Hoy en GFI®</div>
              <div className="db-hoy-grid">
                {[["0","Búsquedas nuevas"],["0","Ofrecidos nuevos"],["0","Matches"],["0","Miembros activos"]].map(([n,l],i) => (
                  <div key={i}>
                    <div className="db-hoy-num">{n}</div>
                    <div className="db-hoy-label">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="db-clima-col">
              {climaLoading ? (
                <div className="db-clima-box-static">
                  <div style={{fontSize:28}}>⏳</div>
                  <div className="db-clima-temp" style={{fontSize:16}}>Cargando...</div>
                  <div className="db-clima-hora">{hora}</div>
                </div>
              ) : climaError || !clima ? (
                <div className="db-clima-box-static">
                  <div style={{fontSize:28}}>🌡️</div>
                  <div className="db-clima-temp" style={{fontSize:14}}>Sin datos</div>
                  <div className="db-clima-aviso">La clave del clima se activa en 1-2hs</div>
                  <div className="db-clima-hora">{hora}</div>
                </div>
              ) : (
                <div className="db-clima-box" onClick={abrirClima} title="Ver más en Weather.com">
                  <div className="db-clima-icon-wrap">
                    <img className="db-clima-icon" src={clima.icon} alt={clima.desc} />
                  </div>
                  <div className="db-clima-temp">{clima.temp}°</div>
                  <div className="db-clima-desc">{climaDesc}</div>
                  <div className="db-clima-minmax">↓{clima.tempMin}° ↑{clima.tempMax}°</div>
                  <div className="db-clima-detalles">
                    <span className="db-clima-det">💧{clima.humedad}%</span>
                    <span className="db-clima-det">💨{clima.viento}km/h</span>
                    <span className="db-clima-det">ST {clima.sensacion}°</span>
                  </div>
                  <div className="db-clima-ciudad">{clima.gpsActivo ? "📍" : "⚠️"} {clima.ciudad}</div>
                  {!clima.gpsActivo && <div className="db-clima-aviso">Ubicación no disponible</div>}
                  <div className="db-clima-ver-mas">↗ Ver más</div>
                  <div className="db-clima-hora">{hora}</div>
                </div>
              )}

              {!mostrarCiudadInput ? (
                <button
                  className="db-ciudad-link"
                  style={{textAlign:"center", padding:"4px 0", color:"rgba(200,0,0,0.5)", fontSize:10, cursor:"pointer", background:"none", border:"none", width:"100%"}}
                  onClick={() => setMostrarCiudadInput(true)}
                >
                  {clima ? "Cambiar ciudad" : "Ingresar ciudad"}
                </button>
              ) : (
                <div className="db-ciudad-box">
                  <div className="db-ciudad-label">Ciudad del clima</div>
                  <div className="db-ciudad-form">
                    <input
                      ref={ciudadRef}
                      className="db-ciudad-input"
                      placeholder="Ej: Rosario"
                      value={ciudadInput}
                      onChange={e => setCiudadInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") buscarCiudad(); }}
                      autoFocus
                    />
                    <button className="db-ciudad-btn" type="button" onClick={buscarCiudad}>→</button>
                  </div>
                  <button className="db-ciudad-link" onClick={() => setMostrarCiudadInput(false)}>Cancelar</button>
                </div>
              )}
            </div>
          </div>

          <div className="db-accesos">
            <div className="db-seccion-titulo">Accesos rápidos</div>
            <div className="db-accesos-grid">
              {accesosRapidos.map((a, i) => (
                <a key={i} className={`db-acceso-btn${a.primary ? " primary" : ""}`} href={a.href}>
                  <span className="db-acceso-icon">{a.icon}</span>
                  <span className="db-acceso-label">{a.label}</span>
                </a>
              ))}
            </div>
          </div>

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
              <div className="db-ind-label">ICL Diario</div>
              {icl.loading ? <div className="skeleton" style={{height:28,width:100,marginTop:6}} /> : <div className={`db-ind-valor${icl.valor !== "Sin datos" ? " verde" : ""}`}>{icl.valor}</div>}
              <div className="db-ind-sub">{icl.sub || "Índice Contratos Locación · BCRA"}</div>
            </div>
            <div className="db-ind">
              <div className="db-ind-label">IPC Mensual</div>
              {ipc.loading ? <div className="skeleton" style={{height:28,width:80,marginTop:6}} /> : <div className="db-ind-valor">{ipc.valor}</div>}
              <div className="db-ind-sub">{ipc.sub || "Inflación mensual · INDEC"}</div>
            </div>
            <div className="db-ind">
              <div className="db-ind-label">Valor JUS</div>
              {jus.loading ? <div className="skeleton" style={{height:28,width:100,marginTop:6}} /> : <div className="db-ind-valor">{jus.valor}</div>}
              <div className="db-ind-sub">COCIR 2da Circ. · Ley 13.154</div>
            </div>
          </div>

          <div className="db-bottom-row">
            <div className="db-panel-base">
              <div className="db-panel-titulo">
                Matches recientes
                <span style={{fontSize:9,padding:"3px 8px",background:"rgba(200,0,0,0.15)",border:"1px solid rgba(200,0,0,0.3)",borderRadius:"20px",color:"#cc0000",fontFamily:"'Montserrat',sans-serif",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase" as const}}>0 nuevos</span>
              </div>
              <div className="db-empty">No hay matches todavía</div>
            </div>
            <div className="db-panel-base">
              <div className="db-panel-titulo">
                Próximos eventos
                <a href="/eventos" className="db-link-badge">Ver todos</a>
              </div>
              <div className="db-empty">No hay eventos programados</div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}