"use client";
import { useEffect, useState, useRef } from "react";

const WA_GROUPS = [
  { cat: "Principal", items: [{ name: "Foro Inmobiliario", sub: "1025 Matriculados", url: "https://chat.whatsapp.com/CShHa28oS2P2OWJrotLp3j" }] },
  { cat: "Recursos", items: [
    { name: "Administración de Consorcios", sub: "", url: "https://chat.whatsapp.com/BT6uh5xRvynDorFLc7cIWi" },
    { name: "Cursos y Eventos", sub: "", url: "https://chat.whatsapp.com/EmEFtVgPaJTK508gCbQYlt" },
    { name: "Cotizaciones", sub: "", url: "https://chat.whatsapp.com/F4Tp8bGBZ7670HPmu4RvIn" },
    { name: "Tasaciones", sub: "", url: "https://chat.whatsapp.com/GwtTHC2Qol90kUSZ46HEQk" },
    { name: "Material Colaborativo", sub: "", url: "https://chat.whatsapp.com/KqKZjC2z8iJDmpAusqhzVz" },
    { name: "Bolsa de Trabajo", sub: "", url: "https://chat.whatsapp.com/I4MXAZetJdK9efH4CcPOez" },
  ]},
  { cat: "Ventas", items: [
    { name: "Ventas — Búsqueda", sub: "", url: "https://chat.whatsapp.com/KfqcLrP6GprKPDSzgwd8MG" },
    { name: "Ventas — Ofrecidos", sub: "", url: "https://chat.whatsapp.com/CsqIVRLe2gh33wQYK7qe5p" },
  ]},
  { cat: "Alquileres", items: [
    { name: "Alquileres — Búsqueda", sub: "", url: "https://chat.whatsapp.com/KkfMBkfrgdA8XhQUlWiRLs" },
    { name: "Alquileres — Ofrecidos", sub: "", url: "https://chat.whatsapp.com/FfjzdHlTeCYIHleSuhQJlP" },
    { name: "Temporarios — Búsqueda", sub: "", url: "https://chat.whatsapp.com/JXpvEPtZlm89od3j4VXOxR" },
    { name: "Temporarios — Ofrecidos", sub: "", url: "https://chat.whatsapp.com/CT3FnEX6y04ECYuVDyJByD" },
  ]},
  { cat: "Especiales", items: [
    { name: "Permutas", sub: "", url: "https://chat.whatsapp.com/KISex4iDG2hBcHO55oZbhL" },
    { name: "Inmuebles Comerciales", sub: "", url: "https://chat.whatsapp.com/Etl00bK7A294qaQUZbAhPT" },
    { name: "Campos y Chacras", sub: "", url: "https://chat.whatsapp.com/Krh8xZ4RZrIKWHERMgm4Iu" },
  ]},
];

const TG_GROUPS = [
  { name: "Foro Inmobiliario", sub: "400 Matriculados", url: "https://t.me/foroinmobiliario" },
  { name: "Campos y Chacras", sub: "", url: "https://t.me/Camposchacrasbusquedayofrecidos" },
  { name: "Ventas — Búsqueda", sub: "", url: "https://t.me/ventasbusqueda" },
  { name: "Ventas — Ofrecidos", sub: "", url: "https://t.me/ventasofrecidos" },
  { name: "Alquileres — Búsqueda", sub: "", url: "https://t.me/alquileresbusqueda" },
  { name: "Alquileres — Ofrecidos", sub: "", url: "https://t.me/alquileresofrecidos" },
  { name: "Temporarios — Búsqueda", sub: "", url: "https://t.me/AlquileresTemporariosBusqueda" },
  { name: "Temporarios — Ofrecidos", sub: "", url: "https://t.me/AlquileresTemporariosOfrecidos" },
];

const REDES = [
  { name: "Instagram", handle: "@grupoforoinmobiliario", url: "https://www.instagram.com/grupoforoinmobiliario?igsh=MWxpYjk1N244bjlwZA==", icon: "IG" },
  { name: "Facebook", handle: "Grupo Foro Inmobiliario", url: "https://www.facebook.com/share/17PvDaRSef/", icon: "FB" },
  { name: "Twitter / X", handle: "@ForoInmob", url: "https://x.com/ForoInmob?t=cprs_HeCTgfydn3bNbeuKw&s=09", icon: "X" },
  { name: "YouTube", handle: "@grupoforoinmobiliario", url: "https://youtube.com/@grupoforoinmobiliario?si=hKhmnMOG1ms541zL", icon: "YT" },
  { name: "ChatGPT", handle: "Foro + IA", url: "https://chatgpt.com/gg/v/6951962e0728819eb7b2382db72eaadd?token=3WVyu3kw4ZX0BOnLfhfyIA", icon: "AI" },
];

const PAUTAS = [
  { n:"01", t:"Exclusividad para Matriculados", d:"Los grupos Foro Inmobiliario, Cotizaciones, Tasaciones, Material Colaborativo, Bolsa de Trabajo y Capacitación son exclusivos para profesionales matriculados. Los grupos de Ventas y Alquileres aceptan un colaborador no matriculado avalado por un CI." },
  { n:"02", t:"Identificación Clara", d:"Es obligatorio incluir nombre completo y número de matrícula en los mensajes y perfiles del grupo." },
  { n:"03", t:"Consultas Privadas", d:"Para mantener el orden en los grupos generales, se solicita que las consultas específicas se realicen por privado." },
  { n:"04", t:"Acceso al Grupo Principal", d:"A partir del 1/9/2024, todos los matriculados deben permanecer en el grupo principal «Foro Inmobiliario» para acceder a los demás grupos temáticos." },
  { n:"05", t:"Contenido del Rubro", d:"No se permite la publicación de contenido político o ajeno al sector inmobiliario." },
];

const MODULOS = [
  { ic:"◈", t:"Motor MIR", d:"Match Inmobiliario de Rosario. Cruzá ofrecidos y búsquedas entre colegas en tiempo real.", tag:"r", tl:"Próximamente" },
  { ic:"◉", t:"Cotizaciones", d:"Dólar blue, ICL, IPC, JUS actualizados al instante. Match entre colegas con extracción IA.", tag:"t", tl:"Activo" },
  { ic:"▣", t:"Padrón COCIR", d:"2.189 corredores matriculados. Actualización automática cada lunes desde la fuente oficial.", tag:"t", tl:"Activo" },
  { ic:"◎", t:"Eventos", d:"Desayunos del Foro, mesas de negocios y capacitaciones con inscripción integrada.", tag:"r", tl:"Próximamente" },
  { ic:"◆", t:"Reputación", d:"Sistema de badges por operaciones confirmadas entre colegas. El que aporta, gana.", tag:"r", tl:"Próximamente" },
  { ic:"◐", t:"Herramientas", d:"Calculadora de honorarios, bot de indicadores Telegram y recursos exclusivos para matriculados.", tag:"t", tl:"Activo" },
];

// Heatmap dots simulating property density in Rosario
const HEATMAP_DOTS = [
  // Centro / Pichincha
  {x:52,y:44,r:22,op:0.55,c:"#00BFA5"},{x:54,y:46,r:14,op:0.7,c:"#00E5CC"},
  {x:50,y:43,r:8,op:0.9,c:"#fff"},{x:53,y:45,r:6,op:0.85,c:"#fff"},
  // Norte - Fisherton / Azcuénaga
  {x:38,y:30,r:16,op:0.35,c:"#00BFA5"},{x:40,y:28,r:9,op:0.5,c:"#00BFA5"},
  {x:42,y:32,r:6,op:0.45,c:"#1DE9B6"},
  // Sur - Tablada / Parque Casas
  {x:55,y:62,r:14,op:0.4,c:"#00BFA5"},{x:57,y:64,r:8,op:0.55,c:"#1DE9B6"},
  // Oeste - Arroyito / Las Flores
  {x:35,y:48,r:12,op:0.3,c:"#00BFA5"},{x:33,y:46,r:7,op:0.4,c:"#00BFA5"},
  // Puerto Norte
  {x:58,y:36,r:18,op:0.45,c:"#B71C1C"},{x:60,y:34,r:10,op:0.65,c:"#E53935"},
  {x:59,y:37,r:5,op:0.8,c:"#FF5252"},
  // Belgrano / República de la 6ta
  {x:47,y:55,r:10,op:0.38,c:"#00BFA5"},{x:49,y:57,r:6,op:0.5,c:"#1DE9B6"},
  // Extra scatter
  {x:44,y:40,r:5,op:0.3,c:"#00BFA5"},{x:62,y:50,r:8,op:0.28,c:"#00BFA5"},
  {x:36,y:58,r:6,op:0.22,c:"#00BFA5"},{x:64,y:42,r:5,op:0.25,c:"#B71C1C"},
  {x:48,y:38,r:4,op:0.35,c:"#fff"},{x:56,y:52,r:4,op:0.4,c:"#1DE9B6"},
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Syne+Mono&family=Space+Grotesk:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --cyan:#00E5CC;
          --cyan2:#00BFA5;
          --cyan-glow:rgba(0,229,204,0.12);
          --cyan-bd:rgba(0,229,204,0.22);
          --red:#E53935;
          --red2:#B71C1C;
          --red-glow:rgba(229,57,53,0.15);
          --red-bd:rgba(229,57,53,0.28);
          --bg:#000;
          --s1:#080808;
          --s2:#0e0e0e;
          --s3:#141414;
          --bd:rgba(255,255,255,0.06);
          --bd2:rgba(255,255,255,0.1);
          --t1:#FAFAFA;
          --t2:rgba(250,250,250,0.55);
          --t3:rgba(250,250,250,0.28);
          --t4:rgba(250,250,250,0.12);
        }
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--t1);font-family:'Space Grotesk',sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}

        /* ── NAV ── */
        .nav{position:fixed;top:0;left:0;right:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:22px 52px;transition:all .4s cubic-bezier(.16,1,.3,1)}
        .nav.sc{background:rgba(0,0,0,.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--bd);padding:14px 52px}
        .logo{display:flex;align-items:center;gap:14px;text-decoration:none;user-select:none}
        .logo-gfi{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.01em;line-height:1}
        .logo-sep{width:1px;height:22px;background:var(--bd2);flex-shrink:0}
        .logo-sub{font-family:'Space Grotesk',sans-serif;font-size:10px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:var(--t3);line-height:1.5}
        .nav-links{display:flex;align-items:center;gap:36px}
        .nav-a{font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--t3);text-decoration:none;transition:color .2s;position:relative}
        .nav-a::after{content:'';position:absolute;bottom:-3px;left:0;right:0;height:1px;background:var(--cyan);transform:scaleX(0);transform-origin:left;transition:transform .25s}
        .nav-a:hover{color:var(--t1)}
        .nav-a:hover::after{transform:scaleX(1)}
        .nav-login{padding:9px 24px;background:var(--cyan);color:#000;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border-radius:1px;transition:all .22s;white-space:nowrap}
        .nav-login:hover{background:#fff;transform:translateY(-1px)}

        /* ── HERO ── */
        .hero{position:relative;min-height:100vh;display:flex;align-items:center;overflow:hidden;background:#000}
        
        /* heatmap canvas area */
        .hero-map{position:absolute;right:0;top:0;bottom:0;width:58%;pointer-events:none;overflow:hidden}
        .hero-map-inner{position:relative;width:100%;height:100%}
        
        /* city grid lines */
        .grid-svg{position:absolute;inset:0;width:100%;height:100%;opacity:.18}
        
        /* gradient overlay left fade */
        .hero-fade{position:absolute;inset:0;background:linear-gradient(100deg,#000 28%,rgba(0,0,0,.85) 45%,rgba(0,0,0,.3) 70%,rgba(0,0,0,.1) 100%);pointer-events:none;z-index:2}
        
        /* bottom fade */
        .hero-fade-b{position:absolute;bottom:0;left:0;right:0;height:180px;background:linear-gradient(to top,#000,transparent);pointer-events:none;z-index:3}

        /* ambient glows */
        .glow-cyan{position:absolute;top:20%;right:22%;width:480px;height:480px;background:radial-gradient(circle,rgba(0,229,204,.07) 0%,transparent 70%);pointer-events:none;z-index:1}
        .glow-red{position:absolute;top:5%;right:45%;width:320px;height:320px;background:radial-gradient(circle,rgba(229,57,53,.06) 0%,transparent 70%);pointer-events:none;z-index:1}

        /* hero content */
        .hero-body{position:relative;z-index:10;padding:140px 52px 100px;max-width:680px}
        
        .hero-tag{display:inline-flex;align-items:center;gap:10px;margin-bottom:28px;opacity:0;animation:slideUp .8s .1s forwards}
        .hero-tag-dot{width:6px;height:6px;border-radius:50%;background:var(--cyan);animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,229,204,.4)}50%{box-shadow:0 0 0 8px rgba(0,229,204,0)}}
        .hero-tag-txt{font-size:10px;font-weight:500;letter-spacing:.28em;text-transform:uppercase;color:var(--cyan)}

        h1.hero-title{font-family:'Syne',sans-serif;font-size:clamp(42px,5.8vw,78px);font-weight:800;line-height:.94;letter-spacing:-.03em;color:#fff;text-transform:uppercase;margin-bottom:30px;opacity:0;animation:slideUp .9s .2s forwards}
        h1.hero-title em{font-style:normal;color:var(--cyan)}
        h1.hero-title .strike{position:relative;color:var(--t3)}
        
        .hero-sub{font-size:14px;font-weight:300;line-height:1.8;color:var(--t2);margin-bottom:48px;max-width:420px;opacity:0;animation:slideUp .9s .32s forwards}
        
        .hero-btns{display:flex;gap:12px;flex-wrap:wrap;opacity:0;animation:slideUp .9s .44s forwards}
        .btn-primary{display:inline-flex;flex-direction:column;gap:2px;padding:14px 32px;background:var(--cyan);color:#000;text-decoration:none;border-radius:1px;transition:all .22s}
        .btn-primary:hover{background:#fff;transform:translateY(-2px);box-shadow:0 16px 40px rgba(0,229,204,.2)}
        .btn-primary .bm{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
        .btn-primary .bs{font-size:10px;font-weight:400;opacity:.55;letter-spacing:.06em}
        .btn-secondary{display:inline-flex;flex-direction:column;gap:2px;padding:14px 32px;background:transparent;border:1px solid var(--bd2);color:var(--t1);text-decoration:none;border-radius:1px;transition:all .22s}
        .btn-secondary:hover{border-color:var(--cyan-bd);background:var(--cyan-glow)}
        .btn-secondary .bm{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
        .btn-secondary .bs{font-size:10px;font-weight:400;color:var(--t3);letter-spacing:.06em}

        @keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}

        /* modules quick bar */
        .modules-bar{position:absolute;bottom:0;left:0;right:0;z-index:20;border-top:1px solid var(--bd);background:rgba(0,0,0,.85);backdrop-filter:blur(16px)}
        .modules-inner{display:flex;align-items:center;padding:0 52px;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .modules-inner::-webkit-scrollbar{display:none}
        .mod-label{font-size:9px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:var(--t4);padding:18px 20px 18px 0;border-right:1px solid var(--bd);flex-shrink:0;white-space:nowrap}
        .mod-item{display:flex;align-items:center;gap:8px;padding:16px 22px;border-right:1px solid var(--bd);text-decoration:none;white-space:nowrap;transition:all .2s;cursor:pointer}
        .mod-item:hover{background:var(--cyan-glow)}
        .mod-item:hover .mod-name{color:var(--cyan)}
        .mod-icon{font-size:15px;color:var(--t3)}
        .mod-name{font-family:'Syne',sans-serif;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--t3);transition:color .2s}

        /* ── TICKER ── */
        .ticker{background:var(--red2);padding:0;overflow:hidden;height:36px;display:flex;align-items:center;position:relative}
        .ticker::after{content:'';position:absolute;right:0;top:0;bottom:0;width:120px;background:linear-gradient(90deg,transparent,var(--red2));pointer-events:none;z-index:2}
        .ticker-track{display:flex;gap:0;animation:ticker 30s linear infinite;will-change:transform}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .ticker-item{display:flex;align-items:center;gap:20px;padding:0 32px;white-space:nowrap}
        .ticker-txt{font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.7)}
        .ticker-sep{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.3)}

        /* ── STATS ── */
        .stats-sec{padding:72px 52px;background:var(--s1)}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--bd);border:1px solid var(--bd);border-radius:2px;overflow:hidden;max-width:1080px;margin:0 auto}
        .stat-cell{background:var(--bg);padding:42px 32px;position:relative;overflow:hidden;transition:background .3s}
        .stat-cell:hover{background:var(--s2)}
        .stat-cell::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;opacity:0;transition:opacity .35s}
        .stat-cell:nth-child(1)::after{background:var(--red)}
        .stat-cell:nth-child(2)::after{background:linear-gradient(90deg,var(--red),var(--cyan))}
        .stat-cell:nth-child(3)::after{background:linear-gradient(90deg,var(--cyan),#00E5CC)}
        .stat-cell:nth-child(4)::after{background:var(--cyan)}
        .stat-cell:hover::after{opacity:1}
        .stat-n{font-family:'Syne',sans-serif;font-size:54px;font-weight:800;color:#fff;line-height:1;margin-bottom:6px;letter-spacing:-.03em}
        .stat-n sup{font-size:22px;color:var(--cyan);vertical-align:top;margin-top:8px}
        .stat-l{font-size:10px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--t3)}

        /* ── SECTION BASE ── */
        .sec{padding:96px 52px}
        .sec-alt{background:var(--s1);border-top:1px solid var(--bd);border-bottom:1px solid var(--bd)}
        .sec-label{display:inline-flex;align-items:center;gap:10px;font-size:9px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:var(--cyan);margin-bottom:14px}
        .sec-label::before{content:'';width:18px;height:1px;background:var(--cyan)}
        .sec-title{font-family:'Syne',sans-serif;font-size:clamp(28px,3.8vw,50px);font-weight:800;text-transform:uppercase;line-height:.93;letter-spacing:-.02em;color:#fff;max-width:560px;margin-bottom:56px}

        /* ── COMUNIDAD ── */
        .com-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:start;max-width:1100px}
        .com-desc{font-size:14px;font-weight:300;line-height:1.85;color:var(--t2);margin-bottom:36px}
        .com-pills{display:flex;flex-direction:column;gap:14px}
        .com-pill{display:flex;align-items:flex-start;gap:16px;padding:18px 22px;background:var(--s2);border:1px solid var(--bd);border-radius:2px;transition:border-color .25s,background .25s}
        .com-pill:hover{border-color:var(--cyan-bd);background:var(--s3)}
        .com-pill-icon{width:32px;height:32px;border-radius:1px;background:var(--cyan-glow);border:1px solid var(--cyan-bd);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px}
        .com-pill-t{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;margin-bottom:4px}
        .com-pill-d{font-size:12px;font-weight:300;line-height:1.65;color:var(--t2)}
        .horarios-block{background:var(--s2);border:1px solid var(--bd);border-radius:2px;overflow:hidden}
        .block-head{padding:16px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bd)}
        .block-head-t{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--t3)}
        .block-head-tag{font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);background:var(--cyan-glow);border:1px solid var(--cyan-bd);padding:3px 10px;border-radius:1px}
        .block-body{padding:20px 22px;display:flex;flex-direction:column;gap:14px}
        .hor-row{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:1px solid var(--bd)}
        .hor-row:last-child{border-bottom:none;padding-bottom:0}
        .hor-day{font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--t2)}
        .hor-time{font-family:'Syne Mono',monospace;font-size:13px;font-weight:400;color:var(--cyan);letter-spacing:.04em}
        .eventos-block{background:var(--s2);border:1px solid var(--cyan-bd);border-radius:2px;overflow:hidden;margin-top:16px}
        .ev-item{display:flex;align-items:center;gap:14px;padding:14px 22px;border-bottom:1px solid var(--bd)}
        .ev-item:last-child{border-bottom:none}
        .ev-icon{width:34px;height:34px;background:rgba(0,229,204,.06);border:1px solid var(--cyan-bd);border-radius:1px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .ev-t{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#fff;margin-bottom:2px}
        .ev-d{font-size:11px;font-weight:300;color:var(--t3)}

        /* ── PAUTAS ── */
        .pautas-stack{display:flex;flex-direction:column;gap:1px;background:var(--bd);border:1px solid var(--bd);border-radius:2px;overflow:hidden;max-width:860px}
        .pauta-row{background:var(--s1);padding:28px 34px;display:grid;grid-template-columns:72px 1fr;gap:22px;align-items:start;transition:background .25s;position:relative}
        .pauta-row::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(180deg,var(--red),var(--cyan));opacity:0;transition:opacity .3s}
        .pauta-row:hover{background:var(--s2)}
        .pauta-row:hover::before{opacity:1}
        .pauta-num{font-family:'Syne Mono',monospace;font-size:34px;font-weight:400;color:var(--t4);line-height:1;letter-spacing:-.02em}
        .pauta-t{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;margin-bottom:6px}
        .pauta-d{font-size:12px;font-weight:300;line-height:1.75;color:var(--t2)}
        .pauta-alert{margin-top:22px;padding:16px 20px;background:rgba(229,57,53,.07);border:1px solid var(--red-bd);border-radius:2px;font-size:11px;font-weight:500;color:#FF8A80;letter-spacing:.04em;line-height:1.65}
        .pauta-alert strong{font-weight:700;color:var(--red)}

        /* ── MÓDULOS ── */
        .mods-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--bd);border:1px solid var(--bd);border-radius:2px;overflow:hidden}
        .mod-card{background:var(--s1);padding:38px 32px;position:relative;overflow:hidden;transition:background .3s;cursor:default}
        .mod-card:hover{background:var(--s2)}
        .mod-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
        .mod-card:nth-child(3n+1)::before{background:var(--red)}
        .mod-card:nth-child(3n+2)::before{background:linear-gradient(90deg,var(--red),var(--cyan))}
        .mod-card:nth-child(3n+3)::before{background:var(--cyan)}
        .mod-card-ic{font-size:22px;color:var(--cyan);margin-bottom:18px;display:block;opacity:.7}
        .mod-card-t{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#fff;margin-bottom:10px}
        .mod-card-d{font-size:12px;font-weight:300;line-height:1.72;color:var(--t2);margin-bottom:18px}
        .mod-tag{display:inline-block;padding:3px 10px;border-radius:1px;font-size:9px;font-weight:600;letter-spacing:.2em;text-transform:uppercase}
        .mod-tag.t{background:rgba(0,229,204,.08);border:1px solid var(--cyan-bd);color:var(--cyan)}
        .mod-tag.r{background:rgba(229,57,53,.08);border:1px solid var(--red-bd);color:#FF8A80}

        /* ── GROUPS ── */
        .groups-outer{display:grid;grid-template-columns:1fr 1fr;gap:32px;max-width:1100px}
        .platform-block{}
        .platform-hd{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--bd);margin-bottom:18px}
        .platform-nm{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#fff}
        .platform-ct{font-size:9px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--t4);margin-left:auto}
        .group-cat{margin-bottom:18px}
        .group-cat-lbl{font-size:9px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--t4);margin-bottom:8px}
        .group-link{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:1px;text-decoration:none;margin-bottom:3px;gap:10px;transition:all .18s}
        .group-link:hover{border-color:var(--cyan-bd);background:var(--cyan-glow)}
        .group-link:hover .gl-arrow{color:var(--cyan)}
        .gl-name{font-size:12px;font-weight:400;color:var(--t1);flex:1}
        .gl-sub{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--cyan);flex-shrink:0}
        .gl-arrow{font-size:12px;color:var(--t4);transition:color .18s;flex-shrink:0}
        .group-link.principal{border-color:rgba(0,229,204,.15);background:rgba(0,229,204,.04)}
        .group-link.principal .gl-name{font-family:'Syne',sans-serif;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em}

        /* ── REDES ── */
        .redes-row{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;max-width:1100px;margin-top:48px}
        .red-card{display:flex;flex-direction:column;align-items:center;padding:24px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:2px;text-decoration:none;transition:all .22s;position:relative;overflow:hidden}
        .red-card::after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,var(--red),var(--cyan));opacity:0;transition:opacity .3s}
        .red-card:hover{border-color:var(--bd2);background:var(--s3);transform:translateY(-2px)}
        .red-card:hover::after{opacity:1}
        .red-badge{font-family:'Syne Mono',monospace;font-size:11px;font-weight:400;color:var(--cyan);margin-bottom:10px;letter-spacing:.06em}
        .red-nm{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#fff;margin-bottom:3px}
        .red-handle{font-size:10px;font-weight:300;color:var(--t3);letter-spacing:.03em}

        /* ── PRICING ── */
        .pricing-sec{padding:96px 52px;background:var(--bg)}
        .pricing-hd{text-align:center;margin-bottom:56px}
        .pricing-hd .sec-label{justify-content:center}
        .pricing-hd .sec-title{margin:0 auto;text-align:center}
        .pricing-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:820px;margin:0 auto}
        .p-card{background:var(--s1);border:1px solid var(--bd);border-radius:2px;padding:44px 36px;position:relative;overflow:hidden;transition:border-color .3s}
        .p-card:hover{border-color:var(--bd2)}
        .p-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--red),var(--cyan))}
        .p-card.featured{border-color:var(--cyan-bd);background:linear-gradient(150deg,rgba(0,229,204,.06) 0%,var(--s1) 60%)}
        .p-card.featured::after{content:'RECOMENDADO';position:absolute;top:0;right:28px;background:var(--cyan);color:#000;font-family:'Syne',sans-serif;font-size:8px;font-weight:700;letter-spacing:.2em;padding:4px 12px;border-radius:0 0 2px 2px}
        .p-name{font-size:9px;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:var(--t4);margin-bottom:18px}
        .p-price{font-family:'Syne',sans-serif;font-size:62px;font-weight:800;color:#fff;line-height:1;letter-spacing:-.04em}
        .p-price sup{font-size:18px;vertical-align:top;margin-top:14px;color:var(--t3);font-weight:400;letter-spacing:0}
        .p-per{font-size:10px;color:var(--t4);letter-spacing:.08em;margin:8px 0 28px}
        .p-feats{list-style:none;margin-bottom:32px}
        .p-feats li{font-size:12px;font-weight:300;color:var(--t2);padding:9px 0;border-bottom:1px solid var(--bd);display:flex;align-items:flex-start;gap:10px;line-height:1.5}
        .p-feats li::before{content:'—';color:var(--cyan);font-weight:600;flex-shrink:0;font-family:'Syne Mono',monospace}
        .p-btn{display:block;width:100%;padding:13px;border-radius:1px;text-align:center;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;border:1px solid var(--cyan-bd);color:var(--cyan);background:var(--cyan-glow);transition:all .22s}
        .p-btn:hover{background:var(--cyan);color:#000}
        .p-card.featured .p-btn{background:var(--cyan);border-color:var(--cyan);color:#000}
        .p-card.featured .p-btn:hover{background:#fff}
        .p-note{text-align:center;margin-top:26px;font-family:'Syne Mono',monospace;font-size:10px;color:var(--t4);letter-spacing:.05em}

        /* ── CTA ── */
        .cta-sec{padding:130px 52px;text-align:center;position:relative;overflow:hidden;background:var(--s1);border-top:1px solid var(--bd)}
        .cta-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:400px;background:radial-gradient(ellipse,rgba(0,229,204,.07) 0%,transparent 65%);pointer-events:none}
        .cta-glow2{position:absolute;top:50%;left:38%;transform:translate(-50%,-50%);width:450px;height:300px;background:radial-gradient(ellipse,rgba(229,57,53,.05) 0%,transparent 65%);pointer-events:none}
        .cta-title{font-family:'Syne',sans-serif;font-size:clamp(36px,5.5vw,68px);font-weight:800;text-transform:uppercase;line-height:.93;letter-spacing:-.03em;color:#fff;margin-bottom:22px;position:relative;z-index:1}
        .cta-title em{font-style:normal;color:var(--cyan)}
        .cta-sub{font-size:14px;font-weight:300;color:var(--t2);margin-bottom:44px;position:relative;z-index:1}

        /* ── FOOTER ── */
        .footer{border-top:1px solid var(--bd);padding:26px 52px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;background:var(--bg)}
        .f-copy{font-family:'Syne Mono',monospace;font-size:10px;color:var(--t4);letter-spacing:.06em}
        .f-links{display:flex;gap:20px;flex-wrap:wrap}
        .f-links a{font-size:10px;color:var(--t4);text-decoration:none;letter-spacing:.1em;text-transform:uppercase;transition:color .2s;font-weight:500}
        .f-links a:hover{color:var(--cyan)}

        /* ── RESPONSIVE ── */
        @media(max-width:1100px){
          .com-grid{grid-template-columns:1fr}
          .groups-outer{grid-template-columns:1fr}
          .redes-row{grid-template-columns:repeat(3,1fr)}
        }
        @media(max-width:860px){
          .stats-grid{grid-template-columns:1fr 1fr}
          .mods-grid{grid-template-columns:1fr 1fr}
          .pricing-grid{grid-template-columns:1fr;max-width:400px}
          .redes-row{grid-template-columns:repeat(2,1fr)}
        }
        @media(max-width:600px){
          .nav,.nav.sc{padding:14px 20px}
          .nav-links .nav-a{display:none}
          .hero-body,.sec,.stats-sec,.pricing-sec,.cta-sec{padding-left:20px;padding-right:20px}
          .modules-inner,.ticker{padding-left:20px}
          .hero-map{opacity:.06}
          .stats-grid{grid-template-columns:1fr 1fr}
          .mods-grid{grid-template-columns:1fr}
          .pauta-row{grid-template-columns:44px 1fr;gap:14px}
          .redes-row{grid-template-columns:1fr 1fr}
          .footer{flex-direction:column;align-items:flex-start;padding:20px}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className={`nav${scrolled ? " sc" : ""}`}>
        <a href="/" className="logo">
          <span className="logo-gfi">GFI</span>
          <span className="logo-sep" />
          <span className="logo-sub">Grupo Foro<br/>Inmobiliario</span>
        </a>
        <div className="nav-links">
          <a href="#comunidad" className="nav-a">Comunidad</a>
          <a href="#modulos" className="nav-a">Módulos</a>
          <a href="#grupos" className="nav-a">Grupos</a>
          <a href="#precios" className="nav-a">Precios</a>
          <a href="/login" className="nav-login">Log in</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" ref={heroRef}>
        {/* ambient */}
        <div className="glow-cyan" />
        <div className="glow-red" />

        {/* right side: heatmap */}
        <div className="hero-map">
          <div className="hero-map-inner">
            {/* city grid SVG */}
            <svg className="grid-svg" viewBox="0 0 800 900" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="fadeV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity="0"/>
                  <stop offset="30%" stopColor="white" stopOpacity="1"/>
                  <stop offset="70%" stopColor="white" stopOpacity="1"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </linearGradient>
                <mask id="fadeMask"><rect width="800" height="900" fill="url(#fadeV)"/></mask>
              </defs>
              <g mask="url(#fadeMask)">
                {/* horizontal streets */}
                {Array.from({length:24}).map((_,i)=>(
                  <line key={`h${i}`} x1="0" y1={40+i*36} x2="800" y2={40+i*36}
                    stroke="rgba(0,229,204,0.06)" strokeWidth={i%4===0?"1.2":"0.5"}/>
                ))}
                {/* vertical streets */}
                {Array.from({length:20}).map((_,i)=>(
                  <line key={`v${i}`} x1={20+i*40} y1="0" x2={20+i*40} y2="900"
                    stroke="rgba(0,229,204,0.04)" strokeWidth={i%5===0?"1":"0.4"}/>
                ))}
                {/* diagonal avenue - Av. Pellegrini style */}
                <line x1="180" y1="0" x2="580" y2="900" stroke="rgba(0,229,204,0.08)" strokeWidth="1.5"/>
                <line x1="220" y1="0" x2="620" y2="900" stroke="rgba(0,229,204,0.04)" strokeWidth="0.7"/>
              </g>
            </svg>

            {/* heatmap dots SVG */}
            <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
              <defs>
                {HEATMAP_DOTS.map((d,i)=>(
                  <radialGradient key={i} id={`hg${i}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={d.c} stopOpacity={d.op}/>
                    <stop offset="100%" stopColor={d.c} stopOpacity="0"/>
                  </radialGradient>
                ))}
              </defs>
              {HEATMAP_DOTS.map((d,i)=>(
                <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={`url(#hg${i})`}/>
              ))}
              {/* bright core dots */}
              <circle cx="52" cy="44" r="2.2" fill="rgba(0,229,204,0.9)" filter="url(#blur1)"/>
              <circle cx="58" cy="36" r="1.8" fill="rgba(255,82,82,0.85)"/>
              <circle cx="40" cy="30" r="1.2" fill="rgba(0,229,204,0.6)"/>
              <circle cx="55" cy="62" r="1.4" fill="rgba(0,229,204,0.6)"/>
            </svg>

            {/* Rosario label */}
            <div style={{
              position:'absolute',top:'43%',left:'53%',
              display:'flex',alignItems:'center',gap:8,
              zIndex:5,pointerEvents:'none'
            }}>
              <div style={{
                width:10,height:10,borderRadius:'50%',
                background:'var(--cyan)',
                boxShadow:'0 0 0 4px rgba(0,229,204,.2),0 0 0 8px rgba(0,229,204,.08)'
              }}/>
              <span style={{
                fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:700,
                letterSpacing:'0.22em',textTransform:'uppercase',
                color:'rgba(255,255,255,0.65)'
              }}>Rosario</span>
            </div>
          </div>
        </div>

        {/* left fade overlay */}
        <div className="hero-fade" />
        <div className="hero-fade-b" />

        {/* content */}
        <div className="hero-body">
          <div className="hero-tag">
            <span className="hero-tag-dot"/>
            <span className="hero-tag-txt">Plataforma profesional · Rosario · Desde 2013</span>
          </div>
          <h1 className="hero-title">
            La inteligencia<br/>del mercado<br/>inmobiliario,<br/><em>en un solo lugar.</em>
          </h1>
          <p className="hero-sub">
            Observatorio de Mercado. Valores reales de cierre.<br/>
            Estadísticas confiables. Solo para corredores matriculados COCIR.
          </p>
          <div className="hero-btns">
            <a href="/registro" className="btn-primary">
              <span className="bm">Unirme a la red GFI</span>
              <span className="bs">Inscribite ahora</span>
            </a>
            <a href="/login" className="btn-secondary">
              <span className="bm">Acceder a la plataforma</span>
              <span className="bs">Acceso para miembros</span>
            </a>
          </div>
        </div>

        {/* modules bar */}
        <div className="modules-bar">
          <div className="modules-inner">
            <span className="mod-label">Módulos</span>
            {[["⚙","CRM"],["◈","MIR"],["▣","Padrón"],["◉","Cotizaciones"],["◎","Eventos"],["◆","Tasaciones"],["◐","Honorarios"]].map(([ic,nm])=>(
              <a key={nm} href="#modulos" className="mod-item">
                <span className="mod-icon">{ic}</span>
                <span className="mod-name">{nm}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="ticker">
        <div className="ticker-track">
          {[...Array(2)].map((_,rep)=>(
            ["Corredores matriculados","Rosario · Santa Fe","COCIR","13 años de comunidad","Motor MIR","Observatorio de mercado","Cotizaciones en tiempo real","1.025 miembros WhatsApp","400 miembros Telegram","2.189 en el padrón"].map((t,i)=>(
              <span key={`${rep}-${i}`} className="ticker-item">
                <span className="ticker-txt">{t}</span>
                <span className="ticker-sep"/>
              </span>
            ))
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <section className="stats-sec">
        <div className="stats-grid">
          {[
            {n:"2.189",su:"",l:"Corredores en el padrón"},
            {n:"13",su:"+",l:"Años de comunidad activa"},
            {n:"1.025",su:"",l:"Miembros WhatsApp"},
            {n:"400",su:"+",l:"Miembros Telegram"},
          ].map(({n,su,l})=>(
            <div key={l} className="stat-cell">
              <div className="stat-n">{n}{su&&<sup>{su}</sup>}</div>
              <div className="stat-l">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMUNIDAD ── */}
      <section className="sec" id="comunidad">
        <div className="com-grid">
          <div>
            <div className="sec-label">Sobre el Foro</div>
            <h2 className="sec-title">El espacio donde la comunidad crece.</h2>
            <p className="com-desc">
              Desde 2013, reunimos a profesionales matriculados de Rosario para construir un espacio de apoyo mutuo, capacitación constante y una red de contactos basada en la confianza y la camaradería. Juntos fortalecemos la profesión.
            </p>
            <div className="com-pills">
              {[
                {ic:"◈",t:"Red de contactos clave",d:"Conectá con más de 1.000 corredores activos en los grupos temáticos de WhatsApp y Telegram."},
                {ic:"▣",t:"Recursos exclusivos",d:"Material colaborativo, tasaciones, cotizaciones y herramientas diseñadas para profesionales del sector."},
                {ic:"◆",t:"Colaboración real",d:"Aprendé, compartí experiencias y fortalecé tu carrera junto a colegas comprometidos."},
              ].map(({ic,t,d})=>(
                <div key={t} className="com-pill">
                  <div className="com-pill-icon">{ic}</div>
                  <div><div className="com-pill-t">{t}</div><div className="com-pill-d">{d}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="horarios-block">
              <div className="block-head">
                <span className="block-head-t">Horarios del Foro</span>
                <span className="block-head-tag">Activo</span>
              </div>
              <div className="block-body">
                <div className="hor-row"><span className="hor-day">Lunes a viernes</span><span className="hor-time">07:00 — 20:00</span></div>
                <div className="hor-row"><span className="hor-day">Sábados</span><span className="hor-time">08:00 — 13:00</span></div>
              </div>
            </div>
            <div className="eventos-block">
              <div className="block-head" style={{borderBottomColor:'var(--cyan-bd)'}}>
                <span className="block-head-t" style={{color:'var(--cyan)'}}>Encuentros destacados</span>
              </div>
              {[
                {ic:"☕",t:"Desayunos del Foro",d:"Espacios para aprender e intercambiar experiencias"},
                {ic:"🍹",t:"After Work",d:"Fortalecé lazos con colegas en un entorno distendido"},
                {ic:"◎",t:"Capacitaciones",d:"Formación continua para el corredor moderno"},
              ].map(({ic,t,d})=>(
                <div key={t} className="ev-item">
                  <div className="ev-icon">{ic}</div>
                  <div><div className="ev-t">{t}</div><div className="ev-d">{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PAUTAS ── */}
      <section className="sec sec-alt" id="pautas">
        <div className="sec-label">Pautas generales</div>
        <h2 className="sec-title">Normas de buen funcionamiento.</h2>
        <div className="pautas-stack">
          {PAUTAS.map(({n,t,d})=>(
            <div key={n} className="pauta-row">
              <div className="pauta-num">{n}</div>
              <div>
                <div className="pauta-t">{t}</div>
                <div className="pauta-d">{d}</div>
              </div>
            </div>
          ))}
          <div className="pauta-row" style={{background:'rgba(229,57,53,0.04)'}}>
            <div className="pauta-num" style={{color:'var(--red)',opacity:.5}}>!</div>
            <div>
              <div className="pauta-t" style={{color:'var(--red)'}}>Importante</div>
              <div className="pauta-alert">
                <strong>Hasta que el CI no ingrese y permanezca en el grupo Foro Inmobiliario, no podrá acceder a los demás grupos temáticos.</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULOS ── */}
      <section className="sec" id="modulos">
        <div className="sec-label">Módulos de la plataforma</div>
        <h2 className="sec-title">Todo lo que necesitás,<br/>en un solo lugar.</h2>
        <div className="mods-grid">
          {MODULOS.map(({ic,t,d,tag,tl})=>(
            <div key={t} className="mod-card">
              <span className="mod-card-ic">{ic}</span>
              <div className="mod-card-t">{t}</div>
              <div className="mod-card-d">{d}</div>
              <span className={`mod-tag ${tag}`}>{tl}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── GRUPOS ── */}
      <section className="sec sec-alt" id="grupos">
        <div className="sec-label">Grupos y comunidad</div>
        <h2 className="sec-title">Sumate a los grupos.<br/>Estamos en todos lados.</h2>
        <div className="groups-outer">
          {/* WhatsApp */}
          <div className="platform-block">
            <div className="platform-hd">
              <span style={{fontSize:20}}>💬</span>
              <span className="platform-nm">WhatsApp</span>
              <span className="platform-ct">16 grupos</span>
            </div>
            {WA_GROUPS.map(({cat,items})=>(
              <div key={cat} className="group-cat">
                <div className="group-cat-lbl">{cat}</div>
                {items.map(({name,sub,url})=>(
                  <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                    className={`group-link${cat==="Principal"?" principal":""}`}>
                    <span className="gl-name">{name}</span>
                    {sub&&<span className="gl-sub">{sub}</span>}
                    <span className="gl-arrow">→</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
          {/* Telegram */}
          <div className="platform-block">
            <div className="platform-hd">
              <span style={{fontSize:20}}>✈️</span>
              <span className="platform-nm">Telegram</span>
              <span className="platform-ct">8 grupos</span>
            </div>
            <div className="group-cat">
              <div className="group-cat-lbl">Todos los grupos</div>
              {TG_GROUPS.map(({name,sub,url})=>(
                <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                  className={`group-link${name.includes("Foro Inmobiliario")?" principal":""}`}>
                  <span className="gl-name">{name}</span>
                  {sub&&<span className="gl-sub">{sub}</span>}
                  <span className="gl-arrow">→</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Redes sociales */}
        <div>
          <div className="sec-label" style={{marginTop:56,marginBottom:16}}>Seguinos en redes</div>
          <div className="redes-row">
            {REDES.map(({name,handle,url,icon})=>(
              <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="red-card">
                <span className="red-badge">{icon}</span>
                <div className="red-nm">{name}</div>
                <div className="red-handle">{handle}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="pricing-sec" id="precios">
        <div className="pricing-hd">
          <div className="sec-label">Suscripciones</div>
          <h2 className="sec-title">Elegí tu plan.</h2>
        </div>
        <div className="pricing-grid">
          <div className="p-card">
            <div className="p-name">Colaborador</div>
            <div className="p-price"><sup>USD </sup>5</div>
            <div className="p-per">por mes</div>
            <ul className="p-feats">
              <li>Dashboard de indicadores (dólar, IPC, ICL, JUS)</li>
              <li>Padrón COCIR completo</li>
              <li>Cotizaciones en tiempo real</li>
              <li>Bot de Telegram GFI</li>
            </ul>
            <a href="/suscripcion" className="p-btn">Suscribirme</a>
          </div>
          <div className="p-card featured">
            <div className="p-name">Corredor Inmobiliario</div>
            <div className="p-price"><sup>USD </sup>15</div>
            <div className="p-per">por mes · requiere matrícula COCIR</div>
            <ul className="p-feats">
              <li>Todo lo del plan Colaborador</li>
              <li>Acceso completo al motor MIR</li>
              <li>Pedidos anónimos entre colegas</li>
              <li>Eventos con acceso prioritario</li>
              <li>Directorio profesional verificado</li>
            </ul>
            <a href="/suscripcion" className="p-btn">Suscribirme</a>
          </div>
        </div>
        <p className="p-note">Pago vía transferencia bancaria · CVU 0000003100046173873221 · Alias: foroinmobiliario.gp</p>
      </section>

      {/* ── CTA ── */}
      <section className="cta-sec">
        <div className="cta-glow" />
        <div className="cta-glow2" />
        <h2 className="cta-title">¿Sos corredor<br/>matriculado <em>en Rosario?</em></h2>
        <p className="cta-sub">Formá parte de la red profesional más activa de la ciudad.</p>
        <a href="/registro" className="btn-primary" style={{display:'inline-flex',margin:'0 auto'}}>
          <span className="bm">Unirme al GFI</span>
          <span className="bs">Inscripción abierta</span>
        </a>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="f-copy">© {new Date().getFullYear()} Grupo Foro Inmobiliario · Rosario, Santa Fe · COCIR</div>
        <div className="f-links">
          <a href="#comunidad">Comunidad</a>
          <a href="#grupos">Grupos</a>
          <a href="/login">Ingresar</a>
          <a href="/suscripcion">Suscripción</a>
          <a href="https://www.cocir.org.ar" target="_blank" rel="noopener noreferrer">COCIR</a>
        </div>
      </footer>
    </>
  );
}
