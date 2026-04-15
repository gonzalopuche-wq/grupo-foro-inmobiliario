"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";

interface Dolar { compra: number; venta: number; promedio: number; }
interface Clima {
  temp: number; tempMin: number; tempMax: number;
  desc: string; icon: string; sensacion: number;
  humedad: number; viento: number; ciudad: string;
  lat: number; lon: number; gpsActivo: boolean;
}

const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_KEY;

export default function DashboardPage() {
  const [hora, setHora] = useState("");
  const [clima, setClima] = useState<Clima | null>(null);
  const [climaLoading, setClimaLoading] = useState(true);
  const [climaError, setClimaError] = useState(false);
  const [mostrarCiudadInput, setMostrarCiudadInput] = useState(false);
  const [ciudadInput, setCiudadInput] = useState("");
  const [dolar, setDolar] = useState<Dolar | null>(null);
  const [dolarLoading, setDolarLoading] = useState(true);
  const [icl, setIcl] = useState<{ valor: string; sub: string; loading: boolean }>({ valor: "", sub: "", loading: true });
  const [ipc, setIpc] = useState<{ valor: string; sub: string; loading: boolean }>({ valor: "", sub: "", loading: true });
  const [jus, setJus] = useState<{ valor: string; loading: boolean }>({ valor: "", loading: true });
  const [stats, setStats] = useState({ busquedas: 0, ofrecidos: 0, matches: 0 });
  const ciudadRef = useRef<HTMLInputElement>(null);

  const fetchClimaPorCoords = async (lat: number, lon: number, gpsActivo: boolean) => {
    setClimaLoading(true); setClimaError(false);
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=es`);
      const d = await r.json();
      if (d.cod && d.cod !== 200) throw new Error(d.message);
      const iconCode = d.weather?.[0]?.icon ?? "01d";
      setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`, sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? "Tu ubicación", lat, lon, gpsActivo });
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
      const iconCode = d.weather?.[0]?.icon ?? "01d";
      setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`, sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? ciudad, lat: d.coord?.lat ?? 0, lon: d.coord?.lon ?? 0, gpsActivo: false });
      localStorage.setItem("gfi_ciudad_clima", ciudad);
      setMostrarCiudadInput(false); setCiudadInput("");
    } catch { setClimaError(true); }
    setClimaLoading(false);
  };

  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const interval = setInterval(tick, 1000);

    // Stats MIR
    Promise.all([
      supabase.from("mir_busquedas").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("mir_ofrecidos").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("mir_matches").select("id", { count: "exact", head: true }),
    ]).then(([b, o, m]) => {
      setStats({ busquedas: b.count ?? 0, ofrecidos: o.count ?? 0, matches: m.count ?? 0 });
    });

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
              const iconCode = d.weather?.[0]?.icon ?? "01d";
              setClima({ temp: Math.round(d.main.temp), tempMin: Math.round(d.main.temp_min), tempMax: Math.round(d.main.temp_max), desc: d.weather?.[0]?.description ?? "", icon: `https://openweathermap.org/img/wn/${iconCode}@2x.png`, sensacion: Math.round(d.main.feels_like), humedad: d.main.humidity, viento: Math.round(d.wind.speed * 3.6), ciudad: d.name ?? ciudad, lat: d.coord?.lat ?? 0, lon: d.coord?.lon ?? 0, gpsActivo: false });
              setClimaLoading(false);
            }).catch(() => { setClimaError(true); setClimaLoading(false); });
        }, { timeout: 5000 }
      );
    } else { setClimaError(true); setClimaLoading(false); }

    // Indicadores
    fetch("https://dolarapi.com/v1/dolares/blue")
      .then(r => r.json()).then(d => { const c = parseFloat(d.compra); const v = parseFloat(d.venta); setDolar({ compra: c, venta: v, promedio: Math.round(((c + v) / 2) * 100) / 100 }); setDolarLoading(false); })
      .catch(() => { setDolar(null); setDolarLoading(false); });

    fetch("https://argentinadatos.com/api/v1/finanzas/indices/icl/ultimo")
      .then(r => r.json()).then(d => { const valor = d?.valor ?? null; if (valor !== null) { const fs = d?.fecha ? new Date(d.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; setIcl({ valor: Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }), sub: fs ? `Al ${fs} · BCRA` : "BCRA", loading: false }); } else setIcl({ valor: "Sin datos", sub: "BCRA", loading: false }); })
      .catch(() => setIcl({ valor: "Sin datos", sub: "BCRA", loading: false }));

    fetch("https://argentinadatos.com/api/v1/finanzas/indices/inflacion/ultimo")
      .then(r => r.json()).then(d => { const valor = d?.valor ?? null; if (valor !== null) { const fs = d?.fecha ? new Date(d.fecha).toLocaleDateString("es-AR", { month: "long", year: "numeric" }) : ""; setIpc({ valor: `${Number(valor).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`, sub: fs ? `${fs} · INDEC` : "INDEC", loading: false }); } else setIpc({ valor: "Sin datos", sub: "INDEC", loading: false }); })
      .catch(() => setIpc({ valor: "Sin datos", sub: "INDEC", loading: false }));

    supabase.from("indicadores").select("valor").eq("clave", "valor_jus").single()
      .then(({ data, error }) => {
        if (error || !data?.valor) setJus({ valor: "Sin datos", loading: false });
        else setJus({ valor: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(data.valor), loading: false });
      });

    return () => clearInterval(interval);
  }, []);

  const abrirClima = () => { if (clima) window.open(`https://weather.com/es-AR/tiempo/hoy/l/${clima.lat},${clima.lon}`, "_blank"); };
  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const formatPeso = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
  const climaDesc = clima?.desc ? clima.desc.charAt(0).toUpperCase() + clima.desc.slice(1) : "";

  const ACCESOS = [
    { icon: "🔍", label: "Publicar búsqueda", href: "/mir?nuevo=busqueda", primary: true },
    { icon: "🏠", label: "Publicar ofrecido", href: "/mir?nuevo=ofrecido", primary: true },
    { icon: "💱", label: "Cotizaciones", href: "/cotizaciones", primary: false },
    { icon: "📅", label: "Eventos", href: "/eventos", primary: false },
    { icon: "💬", label: "Foro", href: "/foro", primary: false },
    { icon: "📋", label: "Padrón", href: "/padron", primary: false },
    { icon: "📚", label: "Biblioteca", href: "/biblioteca", primary: false },
    { icon: "💰", label: "Suscripción", href: "/suscripcion", primary: false },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500&display=swap');
        .db-fecha { font-size: 12px; color: rgba(255,255,255,0.3); text-transform: capitalize; margin-bottom: 24px; }
        .db-top-row { display: grid; grid-template-columns: 1fr auto; gap: 20px; margin-bottom: 20px; }
        .db-panel { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 24px; position: relative; overflow: hidden; }
        .db-panel.red-top::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #cc0000, transparent); }
        .db-sec-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 16px; }
        .db-hoy-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
        .db-hoy-num { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 800; color: #cc0000; line-height: 1; }
        .db-hoy-label { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; }
        .db-clima-col { display: flex; flex-direction: column; gap: 8px; min-width: 165px; }
        .db-clima-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; display: flex; flex-direction: column; gap: 3px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
        .db-clima-box:hover { border-color: rgba(255,255,255,0.15); }
        .db-clima-box-static { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; display: flex; flex-direction: column; gap: 3px; text-align: center; }
        .db-clima-icon { width: 52px; height: 52px; margin: 0 auto; }
        .db-clima-temp { font-family: 'Montserrat', sans-serif; font-size: 26px; font-weight: 800; color: #fff; line-height: 1; }
        .db-clima-desc { font-size: 11px; color: rgba(255,255,255,0.5); }
        .db-clima-minmax { font-size: 10px; color: rgba(255,255,255,0.3); }
        .db-clima-detalles { display: flex; justify-content: center; gap: 8px; margin-top: 3px; }
        .db-clima-det { font-size: 10px; color: rgba(255,255,255,0.3); }
        .db-clima-ciudad { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-top: 3px; }
        .db-clima-aviso { font-size: 9px; color: #eab308; margin-top: 3px; }
        .db-clima-hora { font-size: 11px; color: rgba(255,255,255,0.2); margin-top: 3px; }
        .db-ciudad-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
        .db-ciudad-label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
        .db-ciudad-form { display: flex; gap: 6px; }
        .db-ciudad-input { flex: 1; padding: 8px 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .db-ciudad-input:focus { border-color: #cc0000; }
        .db-ciudad-input::placeholder { color: rgba(255,255,255,0.25); }
        .db-ciudad-btn { padding: 8px 14px; background: #cc0000; border: none; border-radius: 3px; color: #fff; font-size: 14px; cursor: pointer; font-weight: 700; }
        .db-ciudad-link { font-size: 10px; color: rgba(200,0,0,0.6); cursor: pointer; background: none; border: none; font-family: 'Inter', sans-serif; text-align: center; padding: 0; width: 100%; }
        .db-ciudad-link:hover { color: #cc0000; }
        .db-accesos { margin-bottom: 20px; }
        .db-accesos-grid { display: grid; grid-template-columns: repeat(8,1fr); gap: 10px; }
        .db-acceso { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 8px; display: flex; flex-direction: column; align-items: center; gap: 7px; cursor: pointer; text-align: center; text-decoration: none; transition: all 0.2s; }
        .db-acceso:hover { border-color: rgba(200,0,0,0.4); background: rgba(200,0,0,0.06); transform: translateY(-2px); }
        .db-acceso.primary { border-color: rgba(200,0,0,0.3); background: rgba(200,0,0,0.07); }
        .db-acceso.primary:hover { background: rgba(200,0,0,0.14); border-color: #cc0000; }
        .db-acceso-icon { font-size: 20px; }
        .db-acceso-label { font-size: 9px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-weight: 600; letter-spacing: 0.04em; line-height: 1.3; }
        .db-acceso.primary .db-acceso-label { color: rgba(255,255,255,0.8); }
        .db-indicadores { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 20px; }
        .db-ind { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; }
        .db-ind-label { font-size: 9px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.25); font-family: 'Montserrat', sans-serif; margin-bottom: 6px; }
        .db-ind-valor { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; line-height: 1; }
        .db-ind-valor.verde { color: #22c55e; }
        .db-ind-sub { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px; }
        .db-ind-cv { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .db-ind-cv b { color: rgba(255,255,255,0.7); }
        .db-bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .db-panel-titulo { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
        .db-link-badge { font-size: 9px; padding: 3px 8px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3); border-radius: 20px; color: #cc0000; text-decoration: none; font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .db-empty { font-size: 13px; color: rgba(255,255,255,0.2); text-align: center; padding: 24px 0; font-style: italic; }
        .skeleton { background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @media (max-width: 900px) {
          .db-top-row { grid-template-columns: 1fr; }
          .db-accesos-grid { grid-template-columns: repeat(4,1fr); }
          .db-bottom-row { grid-template-columns: 1fr; }
          .db-hoy-grid { grid-template-columns: repeat(2,1fr); }
          .db-indicadores { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 600px) {
          .db-accesos-grid { grid-template-columns: repeat(2,1fr); }
        }
      `}</style>

      <div className="db-fecha">{hoy}</div>

      {/* Hoy en GFI + Clima */}
      <div className="db-top-row">
        <div className="db-panel red-top">
          <div className="db-sec-titulo">Hoy en GFI®</div>
          <div className="db-hoy-grid">
            {[
              [stats.busquedas.toString(), "Búsquedas activas"],
              [stats.ofrecidos.toString(), "Ofrecidos activos"],
              [stats.matches.toString(), "Matches totales"],
              ["0", "Miembros activos"],
            ].map(([n,l],i) => (
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
              <div className="db-clima-hora">{hora}</div>
            </div>
          ) : (
            <div className="db-clima-box" onClick={abrirClima}>
              <img className="db-clima-icon" src={clima.icon} alt={clima.desc} />
              <div className="db-clima-temp">{clima.temp}°</div>
              <div className="db-clima-desc">{climaDesc}</div>
              <div className="db-clima-minmax">↓{clima.tempMin}° ↑{clima.tempMax}°</div>
              <div className="db-clima-detalles">
                <span className="db-clima-det">💧{clima.humedad}%</span>
                <span className="db-clima-det">💨{clima.viento}km/h</span>
              </div>
              <div className="db-clima-ciudad">{clima.gpsActivo ? "📍" : "⚠️"} {clima.ciudad}</div>
              <div className="db-clima-hora">{hora}</div>
            </div>
          )}
          {!mostrarCiudadInput ? (
            <button className="db-ciudad-link" onClick={() => setMostrarCiudadInput(true)}>
              {clima ? "Cambiar ciudad" : "Ingresar ciudad"}
            </button>
          ) : (
            <div className="db-ciudad-box">
              <div className="db-ciudad-label">Ciudad</div>
              <div className="db-ciudad-form">
                <input ref={ciudadRef} className="db-ciudad-input" placeholder="Rosario" value={ciudadInput} onChange={e => setCiudadInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") buscarCiudad(); }} autoFocus />
                <button className="db-ciudad-btn" onClick={buscarCiudad}>→</button>
              </div>
              <button className="db-ciudad-link" onClick={() => setMostrarCiudadInput(false)}>Cancelar</button>
            </div>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="db-accesos">
        <div className="db-sec-titulo">Accesos rápidos</div>
        <div className="db-accesos-grid">
          {ACCESOS.map((a, i) => (
            <a key={i} className={`db-acceso${a.primary ? " primary" : ""}`} href={a.href}>
              <span className="db-acceso-icon">{a.icon}</span>
              <span className="db-acceso-label">{a.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Indicadores */}
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

      {/* Bottom */}
      <div className="db-bottom-row">
        <div className="db-panel">
          <div className="db-panel-titulo">
            Matches recientes
            <a href="/mir?vista=matches" className="db-link-badge">Ver todos</a>
          </div>
          <div className="db-empty">No hay matches todavía</div>
        </div>
        <div className="db-panel">
          <div className="db-panel-titulo">
            Próximos eventos
            <a href="/eventos" className="db-link-badge">Ver todos</a>
          </div>
          <div className="db-empty">No hay eventos programados</div>
        </div>
      </div>
    </>
  );
}
