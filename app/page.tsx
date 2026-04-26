"use client";
import { useEffect, useState, useRef } from "react";

const HEATMAP_DOTS = [
  {x:52,y:44,r:22,op:0.55,c:"#cc0000"},{x:54,y:46,r:14,op:0.7,c:"#ff3333"},
  {x:50,y:43,r:8,op:0.9,c:"#fff"},{x:53,y:45,r:6,op:0.85,c:"#fff"},
  {x:38,y:30,r:16,op:0.35,c:"#cc0000"},{x:40,y:28,r:9,op:0.5,c:"#cc0000"},
  {x:42,y:32,r:6,op:0.45,c:"#ff6666"},
  {x:55,y:62,r:14,op:0.4,c:"#cc0000"},{x:57,y:64,r:8,op:0.55,c:"#ff6666"},
  {x:35,y:48,r:12,op:0.3,c:"#cc0000"},{x:33,y:46,r:7,op:0.4,c:"#cc0000"},
  {x:58,y:36,r:18,op:0.45,c:"#990000"},{x:60,y:34,r:10,op:0.65,c:"#cc0000"},
  {x:59,y:37,r:5,op:0.8,c:"#ff4444"},
  {x:47,y:55,r:10,op:0.38,c:"#cc0000"},{x:49,y:57,r:6,op:0.5,c:"#ff6666"},
  {x:44,y:40,r:5,op:0.3,c:"#cc0000"},{x:62,y:50,r:8,op:0.28,c:"#cc0000"},
  {x:36,y:58,r:6,op:0.22,c:"#cc0000"},{x:64,y:42,r:5,op:0.25,c:"#990000"},
  {x:48,y:38,r:4,op:0.35,c:"#fff"},{x:56,y:52,r:4,op:0.4,c:"#ff6666"},
];

const MODULOS = [
  { ic:"◈", t:"Motor MIR", d:"Match Inmobiliario de Rosario. Cruzá ofrecidos y búsquedas entre colegas en tiempo real.", tag:"t", tl:"Activo" },
  { ic:"◉", t:"Cotizaciones", d:"Dólar blue, ICL, IPC, JUS actualizados al instante. Match entre colegas con extracción IA.", tag:"t", tl:"Activo" },
  { ic:"▣", t:"Padrón COCIR", d:"2.189 corredores matriculados. Actualización automática cada lunes desde la fuente oficial.", tag:"t", tl:"Activo" },
  { ic:"◎", t:"Eventos", d:"Desayunos del Foro, mesas de negocios y capacitaciones con inscripción integrada.", tag:"t", tl:"Activo" },
  
  { ic:"◐", t:"Herramientas", d:"Calculadora de honorarios, recursos exclusivos y bot de indicadores para matriculados.", tag:"t", tl:"Activo" },
];

const PAUTAS = [
  { n:"01", t:"Exclusividad para Matriculados", d:"Los grupos Foro Inmobiliario, Cotizaciones, Tasaciones, Material Colaborativo, Bolsa de Trabajo y Capacitación son exclusivos para profesionales matriculados." },
  { n:"02", t:"Identificación Clara", d:"Es obligatorio incluir nombre completo y número de matrícula en los mensajes y perfiles del grupo." },
  { n:"03", t:"Consultas Privadas", d:"Para mantener el orden en los grupos generales, se solicita que las consultas específicas se realicen por privado." },
  { n:"04", t:"Acceso al Grupo Principal", d:"A partir del 1/9/2024, todos los matriculados deben permanecer en el grupo principal para acceder a los demás grupos temáticos." },
  { n:"05", t:"Contenido del Rubro", d:"No se permite la publicación de contenido político o ajeno al sector inmobiliario." },
];

const REDES = [
  { name:"Instagram", handle:"@grupoforoinmobiliario", url:"https://www.instagram.com/grupoforoinmobiliario?igsh=MWxpYjk1N244bjlwZA==", icon:"IG" },
  { name:"Facebook", handle:"Grupo Foro Inmobiliario", url:"https://www.facebook.com/share/17PvDaRSef/", icon:"FB" },
  { name:"Twitter / X", handle:"@ForoInmob", url:"https://x.com/ForoInmob?t=cprs_HeCTgfydn3bNbeuKw&s=09", icon:"X" },
  { name:"YouTube", handle:"@grupoforoinmobiliario", url:"https://youtube.com/@grupoforoinmobiliario?si=hKhmnMOG1ms541zL", icon:"YT" },
  { name:"ChatGPT", handle:"Foro + IA", url:"https://chatgpt.com/gg/v/6951962e0728819eb7b2382db72eaadd?token=3WVyu3kw4ZX0BOnLfhfyIA", icon:"AI" },
];

function useCountUp(target: number, duration: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return val;
}

function StatCell({ n, su, l }: { n: number; su: string; l: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const val = useCountUp(n, 1800, active);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className="stat-cell">
      <div className="stat-n">{val.toLocaleString("es-AR")}{su && <sup>{su}</sup>}</div>
      <div className="stat-l">{l}</div>
    </div>
  );
}

function RevealSection({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={ref} className={className} id={id}
      style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(32px)", transition: "opacity 0.7s ease, transform 0.7s ease" }}>
      {children}
    </section>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [parallaxY, setParallaxY] = useState(0);
  const [cursorX, setCursorX] = useState(-100);
  const [cursorY, setCursorY] = useState(-100);
  const [cursorLag, setCursorLag] = useState({ x: -100, y: -100 });
  const [typedText, setTypedText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const lagRef = useRef({ x: -100, y: -100 });
  const rafRef = useRef<number>(0);

  const TYPING_TEXT = "en un solo lugar.";

  // Parallax + scroll
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      setParallaxY(window.scrollY * 0.3);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cursor lag
  useEffect(() => {
    const onMove = (e: MouseEvent) => { setCursorX(e.clientX); setCursorY(e.clientY); };
    window.addEventListener("mousemove", onMove);
    const animate = () => {
      lagRef.current.x += (cursorX - lagRef.current.x) * 0.12;
      lagRef.current.y += (cursorY - lagRef.current.y) * 0.12;
      setCursorLag({ x: lagRef.current.x, y: lagRef.current.y });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(rafRef.current); };
  }, [cursorX, cursorY]);

  // Typing effect
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedText(TYPING_TEXT.slice(0, i));
      if (i >= TYPING_TEXT.length) clearInterval(timer);
    }, 65);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Syne+Mono&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --red:#cc0000;--red2:#990000;--red3:#ff3333;
          --red-glow:rgba(204,0,0,0.12);--red-bd:rgba(204,0,0,0.22);
          --bg:#000;--s1:#080808;--s2:#0e0e0e;--s3:#141414;
          --bd:rgba(255,255,255,0.06);--bd2:rgba(255,255,255,0.1);
          --t1:#FAFAFA;--t2:rgba(250,250,250,0.55);--t3:rgba(250,250,250,0.28);--t4:rgba(250,250,250,0.12);
        }
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--t1);font-family:'DM Sans',sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased;cursor:none}
        a{text-decoration:none;color:inherit}

        /* CURSOR */
        .cursor-dot{position:fixed;width:8px;height:8px;background:var(--red);border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);transition:transform .08s,background .2s}
        .cursor-ring{position:fixed;width:32px;height:32px;border:1px solid rgba(204,0,0,0.5);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);transition:width .2s,height .2s,opacity .2s}
        body:hover .cursor-dot{transform:translate(-50%,-50%) scale(1)}
        a:hover ~ .cursor-dot, button:hover ~ .cursor-dot{transform:translate(-50%,-50%) scale(2)}

        /* NAV */
        .nav{position:fixed;top:0;left:0;right:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:22px 52px;transition:all .4s cubic-bezier(.16,1,.3,1)}
        .nav.sc{background:rgba(0,0,0,.94);backdrop-filter:blur(20px);border-bottom:1px solid var(--bd);padding:14px 52px}
        .logo{display:flex;align-items:center;gap:14px;user-select:none;cursor:none}
        .logo-gfi{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.01em}
        .logo-sep{width:1px;height:22px;background:var(--bd2);flex-shrink:0}
        .logo-sub{font-size:10px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:var(--t3);line-height:1.5}
        .nav-links{display:flex;align-items:center;gap:36px}
        .nav-a{font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--t3);transition:color .2s;position:relative;cursor:none}
        .nav-a::after{content:'';position:absolute;bottom:-3px;left:0;right:0;height:1px;background:var(--red);transform:scaleX(0);transform-origin:left;transition:transform .25s}
        .nav-a:hover{color:var(--t1)}
        .nav-a:hover::after{transform:scaleX(1)}
        .nav-login{padding:9px 24px;background:var(--red);color:#fff;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;border-radius:1px;transition:all .22s;white-space:nowrap;cursor:none}
        .nav-login:hover{background:#fff;color:#000;transform:translateY(-1px)}

        /* HERO */
        .hero{position:relative;min-height:100vh;display:flex;align-items:center;overflow:hidden;background:#000}
        .hero-map{position:absolute;right:0;top:0;bottom:0;width:58%;pointer-events:none;overflow:hidden}
        .hero-map-inner{position:relative;width:100%;height:100%}
        .grid-svg{position:absolute;inset:0;width:100%;height:100%;opacity:.15}
        .hero-fade{position:absolute;inset:0;background:linear-gradient(100deg,#000 28%,rgba(0,0,0,.85) 45%,rgba(0,0,0,.3) 70%,rgba(0,0,0,.05) 100%);pointer-events:none;z-index:2}
        .hero-fade-b{position:absolute;bottom:0;left:0;right:0;height:200px;background:linear-gradient(to top,#000,transparent);pointer-events:none;z-index:3}
        .glow-red{position:absolute;top:20%;right:22%;width:500px;height:500px;background:radial-gradient(circle,rgba(204,0,0,.08) 0%,transparent 70%);pointer-events:none;z-index:1}
        .glow-red2{position:absolute;top:5%;right:45%;width:340px;height:340px;background:radial-gradient(circle,rgba(204,0,0,.04) 0%,transparent 70%);pointer-events:none;z-index:1}
        .hero-body{position:relative;z-index:10;padding:140px 52px 100px;max-width:680px}
        .hero-tag{display:inline-flex;align-items:center;gap:10px;margin-bottom:28px;opacity:0;animation:slideUp .8s .1s forwards}
        .hero-tag-dot{width:6px;height:6px;border-radius:50%;background:var(--red);animation:pulseRed 2s infinite}
        @keyframes pulseRed{0%,100%{box-shadow:0 0 0 0 rgba(204,0,0,.5)}50%{box-shadow:0 0 0 10px rgba(204,0,0,0)}}
        .hero-tag-txt{font-size:10px;font-weight:500;letter-spacing:.28em;text-transform:uppercase;color:var(--red)}
        h1.hero-title{font-family:'Syne',sans-serif;font-size:clamp(42px,5.8vw,78px);font-weight:800;line-height:.94;letter-spacing:-.03em;color:#fff;text-transform:uppercase;margin-bottom:30px;opacity:0;animation:slideUp .9s .2s forwards}
        h1.hero-title em{font-style:normal;color:var(--red)}
        .hero-cursor{display:inline-block;width:3px;height:.9em;background:var(--red);margin-left:2px;animation:blink 1s infinite;vertical-align:-.05em}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        .hero-sub{font-size:14px;font-weight:300;line-height:1.8;color:var(--t2);margin-bottom:48px;max-width:420px;opacity:0;animation:slideUp .9s .32s forwards}
        .hero-btns{display:flex;gap:12px;flex-wrap:wrap;opacity:0;animation:slideUp .9s .44s forwards}
        .btn-primary{display:inline-flex;flex-direction:column;gap:2px;padding:14px 32px;background:var(--red);color:#fff;border-radius:1px;transition:all .22s;cursor:none}
        .btn-primary:hover{background:#fff;color:#000;transform:translateY(-2px);box-shadow:0 16px 40px rgba(204,0,0,.25)}
        .btn-primary .bm{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
        .btn-primary .bs{font-size:10px;font-weight:400;opacity:.65;letter-spacing:.06em}
        .btn-secondary{display:inline-flex;flex-direction:column;gap:2px;padding:14px 32px;background:transparent;border:1px solid var(--bd2);color:var(--t1);border-radius:1px;transition:all .22s;cursor:none}
        .btn-secondary:hover{border-color:var(--red-bd);background:var(--red-glow)}
        .btn-secondary .bm{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
        .btn-secondary .bs{font-size:10px;font-weight:400;color:var(--t3);letter-spacing:.06em}
        @keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}

        /* MODULES BAR */
        .modules-bar{position:absolute;bottom:0;left:0;right:0;z-index:20;border-top:1px solid var(--bd);background:rgba(0,0,0,.88);backdrop-filter:blur(16px)}
        .modules-inner{display:flex;align-items:center;padding:0 52px;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .modules-inner::-webkit-scrollbar{display:none}
        .mod-label{font-size:9px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:var(--t4);padding:18px 20px 18px 0;border-right:1px solid var(--bd);flex-shrink:0;white-space:nowrap}
        .mod-item{display:flex;align-items:center;gap:8px;padding:16px 22px;border-right:1px solid var(--bd);text-decoration:none;white-space:nowrap;transition:all .2s;cursor:none}
        .mod-item:hover{background:var(--red-glow)}
        .mod-item:hover .mod-name{color:var(--red)}
        .mod-icon{font-size:14px;color:var(--t3)}
        .mod-name{font-family:'Syne',sans-serif;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--t3);transition:color .2s}

        /* TICKER */
        .ticker{background:var(--red2);overflow:hidden;height:36px;display:flex;align-items:center;position:relative}
        .ticker::after{content:'';position:absolute;right:0;top:0;bottom:0;width:120px;background:linear-gradient(90deg,transparent,var(--red2));pointer-events:none;z-index:2}
        .ticker-track{display:flex;animation:ticker 28s linear infinite;will-change:transform}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .ticker-item{display:flex;align-items:center;gap:20px;padding:0 32px;white-space:nowrap}
        .ticker-txt{font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.7)}
        .ticker-sep{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.3)}

        /* STATS */
        .stats-sec{padding:72px 52px;background:var(--s1)}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--bd);border:1px solid var(--bd);border-radius:2px;overflow:hidden;max-width:1080px;margin:0 auto}
        .stat-cell{background:var(--bg);padding:42px 32px;position:relative;overflow:hidden;transition:background .3s}
        .stat-cell:hover{background:var(--s2)}
        .stat-cell::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--red);opacity:0;transition:opacity .35s}
        .stat-cell:hover::after{opacity:1}
        .stat-n{font-family:'Syne',sans-serif;font-size:54px;font-weight:800;color:#fff;line-height:1;margin-bottom:6px;letter-spacing:-.03em}
        .stat-n sup{font-size:22px;color:var(--red);vertical-align:top;margin-top:8px}
        .stat-l{font-size:10px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--t3)}

        /* SECTIONS */
        .sec{padding:96px 52px}
        .sec-alt{background:var(--s1);border-top:1px solid var(--bd);border-bottom:1px solid var(--bd)}
        .sec-label{display:inline-flex;align-items:center;gap:10px;font-size:9px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:var(--red);margin-bottom:14px}
        .sec-label::before{content:'';width:18px;height:1px;background:var(--red)}
        .sec-title{font-family:'Syne',sans-serif;font-size:clamp(28px,3.8vw,50px);font-weight:800;text-transform:uppercase;line-height:.93;letter-spacing:-.02em;color:#fff;max-width:560px;margin-bottom:56px}

        /* COMUNIDAD */
        .com-grid{display:grid;grid-template-columns:1fr;gap:40px;max-width:720px}
        .com-desc{font-size:14px;font-weight:300;line-height:1.85;color:var(--t2);margin-bottom:36px}
        .com-pills{display:flex;flex-direction:column;gap:14px}
        .com-pill{display:flex;align-items:flex-start;gap:16px;padding:18px 22px;background:var(--s2);border:1px solid var(--bd);border-radius:2px;transition:border-color .25s,background .25s,transform .25s}
        .com-pill:hover{border-color:var(--red-bd);background:var(--s3);transform:translateX(4px)}
        .com-pill-icon{width:32px;height:32px;border-radius:1px;background:var(--red-glow);border:1px solid var(--red-bd);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px}
        .com-pill-t{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;margin-bottom:4px}
        .com-pill-d{font-size:12px;font-weight:300;line-height:1.65;color:var(--t2)}
        .horarios-block{background:var(--s2);border:1px solid var(--bd);border-radius:2px;overflow:hidden}
        .block-head{padding:16px 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bd)}
        .block-head-t{font-family:'Syne',sans-serif;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--t3)}
        .block-head-tag{font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--red);background:var(--red-glow);border:1px solid var(--red-bd);padding:3px 10px;border-radius:1px}
        .block-body{padding:20px 22px;display:flex;flex-direction:column;gap:14px}
        .hor-row{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:1px solid var(--bd)}
        .hor-row:last-child{border-bottom:none;padding-bottom:0}
        .hor-day{font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--t2)}
        .hor-time{font-family:'Syne Mono',monospace;font-size:13px;color:var(--red);letter-spacing:.04em}
        .eventos-block{background:var(--s2);border:1px solid var(--red-bd);border-radius:2px;overflow:hidden;margin-top:16px}
        .ev-item{display:flex;align-items:center;gap:14px;padding:14px 22px;border-bottom:1px solid var(--bd)}
        .ev-item:last-child{border-bottom:none}
        .ev-icon{width:34px;height:34px;background:var(--red-glow);border:1px solid var(--red-bd);border-radius:1px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .ev-t{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#fff;margin-bottom:2px}
        .ev-d{font-size:11px;font-weight:300;color:var(--t3)}

        /* PAUTAS */
        .pautas-stack{display:flex;flex-direction:column;gap:1px;background:var(--bd);border:1px solid var(--bd);border-radius:2px;overflow:hidden;max-width:860px}
        .pauta-row{background:var(--s1);padding:28px 34px;display:grid;grid-template-columns:72px 1fr;gap:22px;align-items:start;transition:background .25s;position:relative}
        .pauta-row::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--red);opacity:0;transition:opacity .3s}
        .pauta-row:hover{background:var(--s2)}
        .pauta-row:hover::before{opacity:1}
        .pauta-num{font-family:'Syne Mono',monospace;font-size:34px;font-weight:400;color:var(--t4);line-height:1;letter-spacing:-.02em}
        .pauta-t{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;margin-bottom:6px}
        .pauta-d{font-size:12px;font-weight:300;line-height:1.75;color:var(--t2)}
        .pauta-alert{margin-top:22px;padding:16px 20px;background:rgba(204,0,0,.07);border:1px solid var(--red-bd);border-radius:2px;font-size:11px;font-weight:500;color:#ff8a80;letter-spacing:.04em;line-height:1.65}
        .pauta-alert strong{font-weight:700;color:var(--red)}

        /* MÓDULOS */
        .mods-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--bd);border:1px solid var(--bd);border-radius:2px;overflow:hidden}
        .mod-card{background:var(--s1);padding:38px 32px;position:relative;overflow:hidden;transition:background .3s,transform .3s}
        .mod-card:hover{background:var(--s2);transform:scale(1.01)}
        .mod-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--red)}
        .mod-card-ic{font-size:22px;color:var(--red);margin-bottom:18px;display:block;opacity:.8}
        .mod-card-t{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#fff;margin-bottom:10px}
        .mod-card-d{font-size:12px;font-weight:300;line-height:1.72;color:var(--t2);margin-bottom:18px}
        .mod-tag{display:inline-block;padding:3px 10px;border-radius:1px;font-size:9px;font-weight:600;letter-spacing:.2em;text-transform:uppercase}
        .mod-tag.t{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);color:#4ade80}
        .mod-tag.r{background:rgba(204,0,0,.08);border:1px solid var(--red-bd);color:#ff8a80}

        /* GRUPOS */
        .grupos-banner{background:linear-gradient(135deg,rgba(204,0,0,.08) 0%,rgba(0,0,0,0) 60%);border:1px solid var(--red-bd);border-radius:2px;padding:40px 48px;margin-bottom:40px;position:relative;overflow:hidden}
        .grupos-banner::before{content:'';position:absolute;top:-1px;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--red),transparent)}
        .grupos-banner-title{font-family:'Syne',sans-serif;font-size:clamp(20px,2.5vw,32px);font-weight:800;text-transform:uppercase;color:#fff;margin-bottom:10px;letter-spacing:-.02em}
        .grupos-banner-sub{font-size:13px;font-weight:300;color:var(--t2);margin-bottom:28px;max-width:520px;line-height:1.7}
        .grupos-cta{display:inline-flex;align-items:center;gap:10px;padding:13px 28px;background:var(--red);color:#fff;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;border-radius:1px;transition:all .22s;cursor:none}
        .grupos-cta:hover{background:#fff;color:#000;transform:translateY(-2px);box-shadow:0 12px 32px rgba(204,0,0,.3)}
        .grupos-outer{display:grid;grid-template-columns:1fr 1fr;gap:32px;max-width:1100px}
        .platform-block{}
        .platform-hd{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--bd);margin-bottom:18px}
        .platform-nm{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#fff}
        .platform-ct{font-size:9px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--t4);margin-left:auto;background:var(--red-glow);border:1px solid var(--red-bd);padding:3px 8px;border-radius:1px;color:var(--red)}
        .group-cat{margin-bottom:18px}
        .group-cat-lbl{font-size:9px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--t4);margin-bottom:8px}
        .group-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:1px;margin-bottom:3px;gap:10px;transition:all .18s;position:relative;overflow:hidden}
        .group-item::before{content:'';position:absolute;left:0;top:0;bottom:0;width:0;background:var(--red);opacity:.06;transition:width .25s}
        .group-item:hover{border-color:var(--red-bd)}
        .group-item:hover::before{width:100%}
        .gi-name{font-size:12px;font-weight:400;color:var(--t1);flex:1;position:relative;z-index:1}
        .group-item.principal .gi-name{font-family:'Syne',sans-serif;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em}
        .gi-lock{font-size:11px;color:var(--t4);flex-shrink:0;position:relative;z-index:1}
        .grupos-nota{margin-top:32px;padding:16px 20px;background:var(--red-glow);border:1px solid var(--red-bd);border-radius:2px;font-size:12px;color:rgba(255,138,128,.9);line-height:1.6}
        .grupos-nota strong{color:var(--red);font-weight:700}

        /* REDES */
        .redes-row{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;max-width:1100px;margin-top:48px}
        .red-card{display:flex;flex-direction:column;align-items:center;padding:24px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:2px;text-decoration:none;transition:all .22s;position:relative;overflow:hidden;cursor:none}
        .red-card::after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--red);opacity:0;transition:opacity .3s}
        .red-card:hover{border-color:var(--red-bd);background:var(--s3);transform:translateY(-3px);box-shadow:0 8px 24px rgba(204,0,0,.1)}
        .red-card:hover::after{opacity:1}
        .red-badge{font-family:'Syne Mono',monospace;font-size:11px;color:var(--red);margin-bottom:10px;letter-spacing:.06em}
        .red-nm{font-family:'Syne',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#fff;margin-bottom:3px}
        .red-handle{font-size:10px;font-weight:300;color:var(--t3);letter-spacing:.03em}

        /* PRICING */
        .pricing-sec{padding:96px 52px;background:var(--bg)}
        .pricing-hd{text-align:center;margin-bottom:56px}
        .pricing-hd .sec-label{justify-content:center}
        .pricing-hd .sec-title{margin:0 auto;text-align:center}
        .pricing-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:820px;margin:0 auto}
        .p-card{background:var(--s1);border:1px solid var(--bd);border-radius:2px;padding:44px 36px;position:relative;overflow:hidden;transition:border-color .3s,transform .3s}
        .p-card:hover{border-color:var(--bd2);transform:translateY(-4px)}
        .p-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--red)}
        .p-card.featured{border-color:var(--red-bd);background:linear-gradient(150deg,rgba(204,0,0,.06) 0%,var(--s1) 60%)}
        .p-card.featured::after{content:'RECOMENDADO';position:absolute;top:0;right:28px;background:var(--red);color:#fff;font-family:'Syne',sans-serif;font-size:8px;font-weight:700;letter-spacing:.2em;padding:4px 12px;border-radius:0 0 2px 2px}
        .p-name{font-size:9px;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:var(--t4);margin-bottom:18px}
        .p-price{font-family:'Syne',sans-serif;font-size:62px;font-weight:800;color:#fff;line-height:1;letter-spacing:-.04em}
        .p-price sup{font-size:18px;vertical-align:top;margin-top:14px;color:var(--t3);font-weight:400;letter-spacing:0}
        .p-per{font-size:10px;color:var(--t4);letter-spacing:.08em;margin:8px 0 28px}
        .p-feats{list-style:none;margin-bottom:32px}
        .p-feats li{font-size:12px;font-weight:300;color:var(--t2);padding:9px 0;border-bottom:1px solid var(--bd);display:flex;align-items:flex-start;gap:10px;line-height:1.5}
        .p-feats li::before{content:'—';color:var(--red);font-weight:600;flex-shrink:0;font-family:'Syne Mono',monospace}
        .p-btn{display:block;width:100%;padding:13px;border-radius:1px;text-align:center;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;border:1px solid var(--red-bd);color:var(--red);background:var(--red-glow);transition:all .22s;cursor:none}
        .p-btn:hover{background:var(--red);color:#fff}
        .p-card.featured .p-btn{background:var(--red);border-color:var(--red);color:#fff}
        .p-card.featured .p-btn:hover{background:#fff;color:#000}
        .p-note{text-align:center;margin-top:26px;font-family:'Syne Mono',monospace;font-size:10px;color:var(--t4);letter-spacing:.05em}

        /* CTA */
        .cta-sec{padding:130px 52px;text-align:center;position:relative;overflow:hidden;background:var(--s1);border-top:1px solid var(--bd)}
        .cta-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:400px;background:radial-gradient(ellipse,rgba(204,0,0,.08) 0%,transparent 65%);pointer-events:none;animation:glowPulse 4s ease-in-out infinite}
        @keyframes glowPulse{0%,100%{opacity:.6;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}}
        .cta-title{font-family:'Syne',sans-serif;font-size:clamp(36px,5.5vw,68px);font-weight:800;text-transform:uppercase;line-height:.93;letter-spacing:-.03em;color:#fff;margin-bottom:22px;position:relative;z-index:1}
        .cta-title em{font-style:normal;color:var(--red)}
        .cta-sub{font-size:14px;font-weight:300;color:var(--t2);margin-bottom:44px;position:relative;z-index:1}

        /* FOOTER */
        .footer{border-top:1px solid var(--bd);padding:26px 52px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;background:var(--bg)}
        .f-copy{font-family:'Syne Mono',monospace;font-size:10px;color:var(--t4);letter-spacing:.06em}
        .f-links{display:flex;gap:20px;flex-wrap:wrap}
        .f-links a{font-size:10px;color:var(--t4);letter-spacing:.1em;text-transform:uppercase;transition:color .2s;font-weight:500;cursor:none}
        .f-links a:hover{color:var(--red)}

        @media(max-width:1100px){.com-grid,.grupos-outer{grid-template-columns:1fr}.redes-row{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:860px){.stats-grid{grid-template-columns:1fr 1fr}.mods-grid{grid-template-columns:1fr 1fr}.pricing-grid{grid-template-columns:1fr;max-width:400px}.redes-row{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){
          .nav,.nav.sc{padding:14px 20px}.nav-links .nav-a{display:none}
          .hero-body,.sec,.stats-sec,.pricing-sec,.cta-sec{padding-left:20px;padding-right:20px}
          .modules-inner{padding-left:20px}.hero-map{opacity:.05}
          .stats-grid{grid-template-columns:1fr 1fr}.mods-grid{grid-template-columns:1fr}
          .pauta-row{grid-template-columns:44px 1fr;gap:14px}
          .redes-row{grid-template-columns:1fr 1fr}.footer{flex-direction:column;align-items:flex-start;padding:20px}
          .grupos-banner{padding:24px}.cursor-dot,.cursor-ring{display:none}
          body{cursor:auto}
        }
      `}</style>

      {/* CURSOR */}
      <div className="cursor-dot" style={{ left: cursorX, top: cursorY }} />
      <div className="cursor-ring" style={{ left: cursorLag.x, top: cursorLag.y }} />

      {/* NAV */}
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

      {/* HERO */}
      <section className="hero" ref={heroRef}>
        <div className="glow-red" />
        <div className="glow-red2" />

        <div className="hero-map">
          <div className="hero-map-inner" style={{ transform: `translateY(${parallaxY * 0.4}px)` }}>
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
                {Array.from({length:24}).map((_,i)=>(
                  <line key={`h${i}`} x1="0" y1={40+i*36} x2="800" y2={40+i*36}
                    stroke="rgba(204,0,0,0.06)" strokeWidth={i%4===0?"1.2":"0.5"}/>
                ))}
                {Array.from({length:20}).map((_,i)=>(
                  <line key={`v${i}`} x1={20+i*40} y1="0" x2={20+i*40} y2="900"
                    stroke="rgba(204,0,0,0.04)" strokeWidth={i%5===0?"1":"0.4"}/>
                ))}
                <line x1="180" y1="0" x2="580" y2="900" stroke="rgba(204,0,0,0.1)" strokeWidth="1.5"/>
                <line x1="220" y1="0" x2="620" y2="900" stroke="rgba(204,0,0,0.05)" strokeWidth="0.7"/>
              </g>
            </svg>

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
              <circle cx="52" cy="44" r="2.2" fill="rgba(204,0,0,0.9)"/>
              <circle cx="58" cy="36" r="1.8" fill="rgba(255,82,82,0.85)"/>
              <circle cx="40" cy="30" r="1.2" fill="rgba(204,0,0,0.6)"/>
              <circle cx="55" cy="62" r="1.4" fill="rgba(204,0,0,0.6)"/>
            </svg>

            <div style={{position:'absolute',top:'43%',left:'53%',display:'flex',alignItems:'center',gap:8,zIndex:5,pointerEvents:'none'}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:'#cc0000',boxShadow:'0 0 0 4px rgba(204,0,0,.2),0 0 0 8px rgba(204,0,0,.08)'}}/>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:700,letterSpacing:'0.22em',textTransform:'uppercase',color:'rgba(255,255,255,0.65)'}}>Rosario</span>
            </div>
          </div>
        </div>

        <div className="hero-fade" />
        <div className="hero-fade-b" />

        <div className="hero-body">
          <div className="hero-tag">
            <span className="hero-tag-dot"/>
            <span className="hero-tag-txt">Plataforma profesional · Rosario · Desde 2013</span>
          </div>
          <h1 className="hero-title">
            La inteligencia<br/>del mercado<br/>inmobiliario,<br/>
            <em>{typedText}<span className="hero-cursor"/></em>
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

      {/* TICKER */}
      <div className="ticker">
        <div className="ticker-track">
          {[...Array(2)].map((_,rep)=>(
            ["Corredores matriculados","Rosario · Santa Fe","COCIR","13 años de comunidad","Motor MIR","Observatorio de mercado","Cotizaciones en tiempo real","1.025 miembros activos","2.189 en el padrón","El que aporta, gana"].map((t,i)=>(
              <span key={`${rep}-${i}`} className="ticker-item">
                <span className="ticker-txt">{t}</span>
                <span className="ticker-sep"/>
              </span>
            ))
          ))}
        </div>
      </div>

      {/* STATS */}
      <section className="stats-sec">
        <div className="stats-grid">
          <StatCell n={2189} su="" l="Corredores en el padrón"/>
          <StatCell n={13} su="+" l="Años de comunidad activa"/>
          <StatCell n={1025} su="" l="Miembros activos"/>
          <StatCell n={24} su="" l="Grupos temáticos"/>
        </div>
      </section>

      {/* COMUNIDAD */}
      <RevealSection className="sec" id="comunidad">
        <div className="com-grid">
          <div>
            <div className="sec-label">Sobre el Foro</div>
            <h2 className="sec-title">El espacio donde la comunidad crece.</h2>
            <p className="com-desc">
              Desde 2013, reunimos a profesionales matriculados de Rosario para construir un espacio de apoyo mutuo, capacitación constante y una red de contactos basada en la confianza y la camaradería. Juntos fortalecemos la profesión.
            </p>
            <div className="com-pills">
              {[
                {ic:"◈",t:"Red de contactos clave",d:"Conectá con más de 1.000 corredores activos en los grupos temáticos de la plataforma GFI."},
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
      </RevealSection>

      {/* MÓDULOS */}
      <RevealSection className="sec" id="modulos">
        <div className="sec-label">Módulos de la plataforma</div>
        <h2 className="sec-title">Todo lo que necesitás,<br/>en un solo lugar.</h2>
        <div className="mods-grid">
          {[
            {ic:"◈",t:"Motor MIR",d:"Match Inmobiliario de Rosario. Cruzá ofrecidos y búsquedas entre colegas en tiempo real. Parser IA que clasifica mensajes automáticamente.",tag:"t",tl:"Activo"},
            {ic:"◉",t:"Cotizaciones",d:"Dólar blue, ICL, IPC, JUS, USDT actualizados al instante. Match de compra/venta entre colegas con extracción IA.",tag:"t",tl:"Activo"},
            {ic:"▣",t:"Padrón COCIR",d:"2.189 corredores matriculados. Búsqueda por nombre, matrícula o zona. Actualización automática cada lunes.",tag:"t",tl:"Activo"},
            {ic:"◎",t:"Eventos",d:"Desayunos del Foro, mesas de negocios y capacitaciones. Inscripción integrada con control de acceso por QR.",tag:"t",tl:"Activo"},
            {ic:"⚙",t:"CRM Inmobiliario",d:"Gestión privada de contactos y clientes. Smart Prospecting: el sistema alerta cuando hay propiedades compatibles con tus clientes.",tag:"t",tl:"Activo"},
            {ic:"◐",t:"Calculadoras",d:"ICL, IPC, Casa Propia, CAC, CER, JUS. Calculá actualizaciones de alquileres y exportá en PDF.",tag:"t",tl:"Activo"},
            {ic:"▤",t:"Tasador IA",d:"Tasá propiedades con comparables reales del mercado. 3 escenarios: conservador, medio y agresivo. Informe PDF con firma.",tag:"r",tl:"Próximamente"},
            {ic:"◑",t:"Comparables",d:"Valores reales de cierre de ventas en Rosario. Solo colegas matriculados. Base que crece con cada operación.",tag:"t",tl:"Activo"},
            {ic:"◆",t:"Biblioteca",d:"Documentos, modelos de contratos y guías prácticas. Subí material y ganás descuento en tu suscripción.",tag:"t",tl:"Activo"},
            {ic:"◍",t:"Web del Corredor",d:"Tu propio sitio web con subdominio GFI. Se actualiza automáticamente con tu cartera. Leads directo al CRM.",tag:"r",tl:"Próximamente"},
            {ic:"◬",t:"Foro Técnico",d:"Consulta técnica y debate profesional. Respuestas destacadas por Mentores GFI. Canal educativo semanal en vivo.",tag:"t",tl:"Activo"},
            {ic:"◌",t:"IA del Foro",d:"La IA analiza debates y genera documentos de referencia permanentes. Base de conocimiento colectiva que crece con el tiempo.",tag:"t",tl:"Activo"},
          ].map(({ic,t,d,tag,tl})=>(
            <div key={t} className="mod-card">
              <span className="mod-card-ic">{ic}</span>
              <div className="mod-card-t">{t}</div>
              <div className="mod-card-d">{d}</div>
              <span className={`mod-tag ${tag}`}>{tl}</span>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* GRUPOS */}
      <RevealSection className="sec sec-alt" id="grupos">
        <div className="sec-label">Comunidad GFI®</div>
        <h2 className="sec-title">24 grupos temáticos.<br/>Todo en la plataforma.</h2>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:32,maxWidth:1100,marginBottom:32}}>
          {/* WhatsApp */}
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:14,borderBottom:"1px solid var(--bd)",marginBottom:18}}>
              <div style={{width:32,height:32,background:"var(--red-glow)",border:"1px solid var(--red-bd)",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💬</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"#fff"}}>WhatsApp</div>
                <div style={{fontSize:9,color:"var(--red)",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:".14em",textTransform:"uppercase"}}>16 grupos</div>
              </div>
            </div>
            {[
              {cat:"Principal",items:["Foro Inmobiliario — 1.025 matriculados"]},
              {cat:"Recursos",items:["Administración de Consorcios","Cursos y Eventos","Cotizaciones","Tasaciones","Material Colaborativo","Bolsa de Trabajo"]},
              {cat:"Ventas",items:["Ventas — Búsqueda","Ventas — Ofrecidos"]},
              {cat:"Alquileres",items:["Alquileres — Búsqueda","Alquileres — Ofrecidos","Temporarios — Búsqueda","Temporarios — Ofrecidos"]},
              {cat:"Especiales",items:["Permutas","Inmuebles Comerciales","Campos y Chacras"]},
            ].map(({cat,items})=>(
              <div key={cat} style={{marginBottom:16}}>
                <div style={{fontSize:9,fontWeight:600,letterSpacing:".24em",textTransform:"uppercase",color:"var(--t4)",marginBottom:7}}>{cat}</div>
                {items.map(name=>(
                  <div key={name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:1,marginBottom:3,gap:10}}>
                    <span style={{fontSize:12,color:"var(--t1)",flex:1,fontFamily:cat==="Principal"?"'Syne',sans-serif":"inherit",fontWeight:cat==="Principal"?700:400}}>{name}</span>
                    <span style={{fontSize:10,color:"var(--red)",opacity:.5}}>🔒</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Telegram */}
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:14,borderBottom:"1px solid var(--bd)",marginBottom:18}}>
              <div style={{width:32,height:32,background:"var(--red-glow)",border:"1px solid var(--red-bd)",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✈️</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"#fff"}}>Telegram</div>
                <div style={{fontSize:9,color:"var(--red)",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:".14em",textTransform:"uppercase"}}>8 grupos</div>
              </div>
            </div>
            {["Foro Inmobiliario — 400 matriculados","Campos y Chacras","Ventas — Búsqueda","Ventas — Ofrecidos","Alquileres — Búsqueda","Alquileres — Ofrecidos","Temporarios — Búsqueda","Temporarios — Ofrecidos"].map(name=>(
              <div key={name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:1,marginBottom:3,gap:10}}>
                <span style={{fontSize:12,color:"var(--t1)",flex:1,fontFamily:name.startsWith("Foro")?"'Syne',sans-serif":"inherit",fontWeight:name.startsWith("Foro")?700:400}}>{name}</span>
                <span style={{fontSize:10,color:"var(--red)",opacity:.5}}>🔒</span>
              </div>
            ))}

            {/* Beneficios extra */}
            <div style={{marginTop:28,padding:"20px 22px",background:"var(--red-glow)",border:"1px solid var(--red-bd)",borderRadius:2}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"var(--red)",marginBottom:12}}>Con tu suscripción también accedés a</div>
              {[
                "📰 Noticias del sector inmobiliario",
                "📋 Padrón COCIR con 2.189 matriculados",
                "💱 Cotizaciones y match de monedas",
                "📚 Biblioteca de documentos y contratos",
                "📅 Eventos con inscripción integrada",
                "🧮 Calculadoras ICL, IPC, JUS y más",
                "👥 CRM inmobiliario con Smart Prospecting",
                "🏆 Sistema de reputación y badges GFI®",
                "🤖 IA del Foro — base de conocimiento colectiva",
                "🔗 Bot de Telegram con indicadores en tiempo real",
              ].map(b=>(
                <div key={b} style={{fontSize:12,color:"var(--t2)",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",lineHeight:1.5}}>{b}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="grupos-banner" style={{marginBottom:0}}>
          <div className="grupos-banner-title">Accedé a todo desde la plataforma</div>
          <p className="grupos-banner-sub">
            Todos los grupos están integrados en GFI®. Historial, búsqueda, match automático, parser IA y notificaciones.
            Sin límite de 1.024 miembros. La red crece sin techo.
          </p>
          <a href="/registro" className="grupos-cta">
            Suscribirme y acceder →
          </a>
        </div>

        {/* Redes */}
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
      </RevealSection>

      {/* PRICING */}
      <RevealSection className="pricing-sec" id="precios">
        <div className="pricing-hd">
          <div className="sec-label">Suscripciones</div>
          <h2 className="sec-title">Un solo plan. Todo incluido.</h2>
        </div>
        <div className="pricing-grid">
          <div className="p-card">
            <div className="p-name">Colaborador</div>
            <div className="p-price"><sup>USD </sup>5</div>
            <div className="p-per">por mes · referido por un corredor matriculado</div>
            <ul className="p-feats">
              <li>Dashboard de indicadores (dólar, IPC, ICL, JUS)</li>
              <li>Padrón COCIR completo con 2.189 matriculados</li>
              <li>Cotizaciones en tiempo real</li>
              <li>Acceso a grupos de Ventas y Alquileres</li>
            </ul>
            <a href="/registro" className="p-btn">Suscribirme</a>
          </div>
          <div className="p-card featured">
            <div className="p-name">Corredor Matriculado</div>
            <div className="p-price"><sup>USD </sup>15</div>
            <div className="p-per">por mes · requiere matrícula COCIR</div>
            <ul className="p-feats">
              <li>Acceso completo a los 24 grupos temáticos</li>
              <li>Motor MIR — match de ofrecidos y búsquedas</li>
              <li>Comparables de mercado con valores reales</li>
              <li>Eventos con acceso prioritario e inscripción</li>
              <li>Sistema de reputación y badges GFI®</li>
              <li>El que aporta, gana — bonificaciones por colaboración</li>
            </ul>
            <a href="/registro" className="p-btn">Suscribirme</a>
          </div>
        </div>
        <p className="p-note">Pago vía transferencia bancaria · CVU 0000003100046173873221 · Alias: foroinmobiliario.gp</p>
      </RevealSection>

      {/* CTA */}
      <section className="cta-sec">
        <div className="cta-glow" />
        <h2 className="cta-title">¿Sos corredor<br/>matriculado <em>en Rosario?</em></h2>
        <p className="cta-sub">Formá parte de la red profesional más activa de la ciudad.</p>
        <a href="/registro" className="btn-primary" style={{display:'inline-flex',margin:'0 auto',cursor:'none'}}>
          <span className="bm">Unirme al GFI</span>
          <span className="bs">Inscripción abierta</span>
        </a>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="f-copy">© {new Date().getFullYear()} Grupo Foro Inmobiliario® · Rosario, Santa Fe · COCIR</div>
        <div className="f-links">
          <a href="#comunidad">Comunidad</a>
          <a href="#grupos">Grupos</a>
          <a href="/login">Ingresar</a>
          <a href="/registro">Suscripción</a>
          <a href="https://www.cocir.org.ar" target="_blank" rel="noopener noreferrer">COCIR</a>
        </div>
      </footer>
    </>
  );
}
