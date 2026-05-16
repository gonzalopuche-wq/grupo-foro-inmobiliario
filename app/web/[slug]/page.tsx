import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ContactForm, TasacionForm } from "./WebForms";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Config {
  id: string; perfil_id: string; slug: string; dominio_propio: string | null;
  plantilla: string; activa: boolean; logo_url: string | null;
  cover_url: string | null; foto_sobre_mi_url: string | null;
  color_primario: string; color_secundario: string;
  color_texto: string; color_fondo: string;
  titulo_sitio: string | null; subtitulo: string | null;
  descripcion_profesional: string | null; anos_experiencia: number | null;
  mostrar_formulario_contacto: boolean; mostrar_formulario_tasacion: boolean;
  mostrar_propiedades_destacadas: boolean; mostrar_sobre_mi: boolean;
  mostrar_testimonios: boolean;
  seo_titulo: string | null; seo_descripcion: string | null;
  instagram: string | null; facebook: string | null;
  twitter: string | null; linkedin: string | null; tiktok: string | null; whatsapp: string | null;
  limite_propiedades_home: number;
  google_analytics: string | null;
}

interface Perfil {
  nombre: string; apellido: string; matricula: string | null;
  telefono: string | null; email: string | null;
  inmobiliaria: string | null; foto_url: string | null;
  especialidades: string[] | null;
}

interface Propiedad {
  id: string; titulo: string; descripcion: string | null;
  operacion: string; tipo: string; precio: number | null; moneda: string;
  ciudad: string; zona: string | null; dormitorios: number | null;
  banos: number | null; superficie_cubierta: number | null;
  fotos: string[] | null; estado: string;
}

// ── Server Component ────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getData(slug: string) {
  const { data: cfg } = await supabase
    .from("web_corredor_config")
    .select("*")
    .eq("slug", slug)
    .eq("activa", true)
    .single();

  if (!cfg) return null;

  const [{ data: perfil }, { data: props }] = await Promise.all([
    supabase.from("perfiles").select("nombre,apellido,matricula,telefono,email,inmobiliaria,foto_url,especialidades").eq("id", cfg.perfil_id).single(),
    supabase.from("cartera_propiedades").select("id,titulo,descripcion,operacion,tipo,precio,moneda,ciudad,zona,dormitorios,banos,superficie_cubierta,fotos,estado").eq("perfil_id", cfg.perfil_id).eq("publicada_web", true).eq("estado", "activa").limit(cfg.limite_propiedades_home ?? 6),
  ]);

  return { cfg: cfg as Config, perfil: perfil as Perfil, propiedades: (props as Propiedad[]) ?? [] };
}

// ── Plantillas ──────────────────────────────────────────────────────────────

const TEMAS: Record<string, { bg: string; bgAlt: string; header: string; footer: string; accent: string; text: string; textMuted: string; card: string; cardBorder: string; fontH: string; }> = {
  "rosario-classic":   { bg:"#0a0a0a", bgAlt:"#111", header:"rgba(8,8,8,0.98)", footer:"#080808", accent:"#cc0000", text:"#fff", textMuted:"rgba(255,255,255,0.5)", card:"rgba(20,20,20,0.95)", cardBorder:"rgba(255,255,255,0.08)", fontH:"Montserrat,sans-serif" },
  "blanco-moderno":    { bg:"#fff", bgAlt:"#f8f9fa", header:"#fff", footer:"#111", accent:"#111", text:"#111", textMuted:"#666", card:"#fff", cardBorder:"#e5e7eb", fontH:"Montserrat,sans-serif" },
  "grand-estate":      { bg:"#0d0d0d", bgAlt:"#141414", header:"#0a0a0a", footer:"#080808", accent:"#c9a84c", text:"#f5f0e8", textMuted:"rgba(245,240,232,0.5)", card:"rgba(25,20,10,0.95)", cardBorder:"rgba(201,168,76,0.15)", fontH:"'Georgia',serif" },
  "ciudad-viva":       { bg:"#f0f4f8", bgAlt:"#e8edf2", header:"#1a2332", footer:"#1a2332", accent:"#3b82f6", text:"#1a2332", textMuted:"#64748b", card:"#fff", cardBorder:"#e2e8f0", fontH:"Montserrat,sans-serif" },
  "campo-verde":       { bg:"#f0f7f0", bgAlt:"#e8f5e8", header:"#1a3a2a", footer:"#1a3a2a", accent:"#22863a", text:"#1a2a1a", textMuted:"#4a6a4a", card:"#fff", cardBorder:"#d4edda", fontH:"Montserrat,sans-serif" },
  "coral":             { bg:"#fff8f5", bgAlt:"#fff0ea", header:"#fff", footer:"#2d1a14", accent:"#e05c3a", text:"#1a0f0a", textMuted:"#8b5e52", card:"#fff", cardBorder:"#fde8e0", fontH:"Montserrat,sans-serif" },
  "noche-portena":     { bg:"#0f1923", bgAlt:"#141f2e", header:"#0a1220", footer:"#080e18", accent:"#60a5fa", text:"#e2e8f0", textMuted:"#64748b", card:"rgba(20,30,45,0.95)", cardBorder:"rgba(96,165,250,0.12)", fontH:"Montserrat,sans-serif" },
  "sol-norte":         { bg:"#fffbf0", bgAlt:"#fff7e6", header:"#fff", footer:"#1a1000", accent:"#f97316", text:"#1a1000", textMuted:"#92400e", card:"#fff", cardBorder:"#fed7aa", fontH:"Montserrat,sans-serif" },
  "plata":             { bg:"#f8f9fa", bgAlt:"#f0f2f5", header:"#fff", footer:"#1f2937", accent:"#374151", text:"#111827", textMuted:"#6b7280", card:"#fff", cardBorder:"#e5e7eb", fontH:"Montserrat,sans-serif" },
  "brick":             { bg:"#1c1410", bgAlt:"#231a14", header:"#150f0a", footer:"#0f0a06", accent:"#d97706", text:"#f5f0e8", textMuted:"rgba(245,240,232,0.5)", card:"rgba(35,26,20,0.95)", cardBorder:"rgba(217,119,6,0.2)", fontH:"'Georgia',serif" },
  "zen":               { bg:"#faf8f5", bgAlt:"#f5f0e8", header:"#faf8f5", footer:"#2d2420", accent:"#92775a", text:"#2d2d2d", textMuted:"#8b7355", card:"#fff", cardBorder:"#e8e0d0", fontH:"'Georgia',serif" },
  "digital-pro":       { bg:"#0f0f23", bgAlt:"#13132e", header:"rgba(10,10,20,0.98)", footer:"#080818", accent:"#8b5cf6", text:"#e2e8f0", textMuted:"rgba(226,232,240,0.5)", card:"rgba(20,20,40,0.95)", cardBorder:"rgba(139,92,246,0.15)", fontH:"Montserrat,sans-serif" },
};

const DARK_THEMES = ["rosario-classic","grand-estate","noche-portena","brick","digital-pro"];

const formatPrecio = (p: number, m: string) =>
  m === "USD" ? `USD ${p.toLocaleString("es-AR")}` : `$ ${p.toLocaleString("es-AR")}`;

// ── Template Component ────────────────────────────────────────────────────

function WebTemplate({ cfg, perfil, propiedades }: { cfg: Config; perfil: Perfil; propiedades: Propiedad[] }) {
  const t = TEMAS[cfg.plantilla] ?? TEMAS["rosario-classic"];
  const isDark = DARK_THEMES.includes(cfg.plantilla);
  const nombre = `${perfil.nombre} ${perfil.apellido}`;
  const titulo = cfg.titulo_sitio || nombre;
  const subtitulo = cfg.subtitulo || (perfil.matricula ? `Corredor Inmobiliario · Mat. ${perfil.matricula}` : "Corredor Inmobiliario");
  const wa = cfg.whatsapp || perfil.telefono;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500;600&family=Georgia&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${t.bg}; color: ${t.text}; font-family: 'Inter',sans-serif; }
        a { text-decoration: none; color: inherit; }
        /* Header */
        .w-header { position: sticky; top: 0; z-index: 100; background: ${t.header}; border-bottom: 1px solid ${t.cardBorder}; padding: 0 5%; height: 68px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(10px); }
        .w-logo { font-family: ${t.fontH}; font-size: 20px; font-weight: 800; color: ${t.text}; }
        .w-logo span { color: ${t.accent}; }
        .w-nav { display: flex; gap: 24px; align-items: center; }
        .w-nav a { font-size: 13px; color: ${t.textMuted}; font-weight: 500; transition: color 0.2s; }
        .w-nav a:hover { color: ${t.accent}; }
        .w-btn-wa { padding: 9px 18px; background: ${t.accent}; color: #fff; border-radius: 6px; font-size: 12px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.05em; transition: opacity 0.2s; white-space: nowrap; }
        .w-btn-wa:hover { opacity: 0.85; }
        .w-header-redes { display: flex; gap: 6px; align-items: center; }
        .w-header-red { width: 30px; height: 30px; border-radius: 6px; background: ${t.cardBorder}; border: 1px solid ${t.cardBorder}; display: flex; align-items: center; justify-content: center; color: ${t.textMuted}; transition: background 0.15s, color 0.15s; }
        .w-header-red:hover { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
        /* Hero */
        .w-hero { min-height: 520px; display: flex; align-items: center; position: relative; padding: 60px 5%; background: ${cfg.cover_url ? `url(${cfg.cover_url}) center/cover no-repeat` : `linear-gradient(135deg, ${t.bgAlt}, ${t.bg})`}; overflow: hidden; }
        .w-hero::before { content: ''; position: absolute; inset: 0; background: ${isDark ? "rgba(0,0,0,0.6)" : cfg.cover_url ? "rgba(0,0,0,0.4)" : "transparent"}; }
        .w-hero-content { position: relative; z-index: 1; max-width: 600px; }
        .w-hero-tag { display: inline-block; padding: 5px 14px; background: ${t.accent}20; border: 1px solid ${t.accent}40; border-radius: 20px; font-size: 11px; font-weight: 700; color: ${t.accent}; font-family: 'Montserrat',sans-serif; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 16px; }
        .w-hero-h1 { font-family: ${t.fontH}; font-size: clamp(28px,4vw,48px); font-weight: 800; color: ${cfg.cover_url || isDark ? "#fff" : t.text}; line-height: 1.15; margin-bottom: 12px; }
        .w-hero-sub { font-size: 16px; color: ${cfg.cover_url || isDark ? "rgba(255,255,255,0.75)" : t.textMuted}; margin-bottom: 28px; line-height: 1.6; }
        .w-hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
        .w-btn-primary { padding: 13px 28px; background: ${t.accent}; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.06em; transition: opacity 0.2s; border: none; cursor: pointer; }
        .w-btn-primary:hover { opacity: 0.85; }
        .w-btn-outline { padding: 13px 28px; background: transparent; color: ${cfg.cover_url || isDark ? "#fff" : t.text}; border-radius: 6px; font-size: 13px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.06em; border: 2px solid ${cfg.cover_url || isDark ? "rgba(255,255,255,0.4)" : t.cardBorder}; transition: all 0.2s; cursor: pointer; }
        .w-btn-outline:hover { border-color: ${t.accent}; color: ${t.accent}; }
        /* Stats */
        .w-stats { display: flex; gap: 0; background: ${t.card}; border: 1px solid ${t.cardBorder}; border-radius: 12px; overflow: hidden; margin: 0 5%; transform: translateY(-30px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
        .w-stat { flex: 1; padding: 20px 24px; text-align: center; border-right: 1px solid ${t.cardBorder}; }
        .w-stat:last-child { border-right: none; }
        .w-stat-val { font-family: ${t.fontH}; font-size: 26px; font-weight: 800; color: ${t.accent}; }
        .w-stat-label { font-size: 11px; color: ${t.textMuted}; margin-top: 3px; font-family: 'Montserrat',sans-serif; letter-spacing: 0.1em; text-transform: uppercase; }
        /* Sections */
        .w-section { padding: 60px 5%; }
        .w-section.alt { background: ${t.bgAlt}; }
        .w-section-tag { font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${t.accent}; font-family: 'Montserrat',sans-serif; margin-bottom: 8px; }
        .w-section-h2 { font-family: ${t.fontH}; font-size: clamp(22px,3vw,32px); font-weight: 800; color: ${t.text}; margin-bottom: 6px; }
        .w-section-desc { font-size: 14px; color: ${t.textMuted}; max-width: 560px; line-height: 1.6; margin-bottom: 36px; }
        /* Propiedades grid */
        .w-props-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .w-prop-card { background: ${t.card}; border: 1px solid ${t.cardBorder}; border-radius: 10px; overflow: hidden; transition: all 0.2s; cursor: pointer; }
        .w-prop-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.2); border-color: ${t.accent}40; }
        .w-prop-img { height: 200px; background: ${t.bgAlt}; position: relative; overflow: hidden; }
        .w-prop-img img { width: 100%; height: 100%; object-fit: cover; }
        .w-prop-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px; color: ${t.textMuted}; }
        .w-prop-op-badge { position: absolute; top: 10px; left: 10px; padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.1em; text-transform: uppercase; background: ${t.accent}; color: #fff; }
        .w-prop-body { padding: 16px; }
        .w-prop-titulo { font-family: ${t.fontH}; font-size: 15px; font-weight: 700; color: ${t.text}; margin-bottom: 4px; }
        .w-prop-zona { font-size: 12px; color: ${t.textMuted}; margin-bottom: 10px; }
        .w-prop-precio { font-family: ${t.fontH}; font-size: 18px; font-weight: 800; color: ${t.accent}; margin-bottom: 10px; }
        .w-prop-detalles { display: flex; gap: 10px; flex-wrap: wrap; }
        .w-prop-det { font-size: 11px; color: ${t.textMuted}; background: ${t.bgAlt}; padding: 3px 8px; border-radius: 4px; border: 1px solid ${t.cardBorder}; }
        /* Sobre mi */
        .w-sobre-mi { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
        .w-sobre-img { border-radius: 12px; overflow: hidden; aspect-ratio: 4/3; background: ${t.bgAlt}; border: 1px solid ${t.cardBorder}; }
        .w-sobre-img img { width: 100%; height: 100%; object-fit: cover; }
        .w-sobre-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 64px; }
        .w-sobre-nombre { font-family: ${t.fontH}; font-size: 26px; font-weight: 800; color: ${t.text}; margin-bottom: 4px; }
        .w-sobre-mat { font-size: 12px; color: ${t.accent}; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px; }
        .w-sobre-desc { font-size: 14px; color: ${t.textMuted}; line-height: 1.8; margin-bottom: 20px; }
        .w-sobre-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .w-sobre-chip { padding: 6px 14px; background: ${t.accent}15; border: 1px solid ${t.accent}30; border-radius: 20px; font-size: 11px; font-weight: 600; color: ${t.accent}; }
        /* Contacto */
        .w-contacto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
        .w-form { display: flex; flex-direction: column; gap: 12px; }
        .w-form-input { padding: 12px 14px; background: ${t.card}; border: 1px solid ${t.cardBorder}; border-radius: 6px; color: ${t.text}; font-size: 13px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; }
        .w-form-input:focus { border-color: ${t.accent}; }
        .w-form-input::placeholder { color: ${t.textMuted}; opacity: 0.6; }
        .w-form-textarea { padding: 12px 14px; background: ${t.card}; border: 1px solid ${t.cardBorder}; border-radius: 6px; color: ${t.text}; font-size: 13px; font-family: 'Inter',sans-serif; outline: none; resize: vertical; min-height: 100px; }
        .w-form-textarea:focus { border-color: ${t.accent}; }
        .w-form-textarea::placeholder { color: ${t.textMuted}; opacity: 0.6; }
        .w-form-btn { padding: 13px; background: ${t.accent}; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 700; font-family: 'Montserrat',sans-serif; cursor: pointer; transition: opacity 0.2s; }
        .w-form-btn:hover { opacity: 0.85; }
        .w-contacto-info { display: flex; flex-direction: column; gap: 16px; }
        .w-contacto-item { display: flex; gap: 14px; align-items: flex-start; }
        .w-contacto-icon { width: 40px; height: 40px; border-radius: 8px; background: ${t.accent}15; border: 1px solid ${t.accent}30; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .w-contacto-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; color: ${t.textMuted}; font-family: 'Montserrat',sans-serif; margin-bottom: 3px; }
        .w-contacto-val { font-size: 14px; color: ${t.text}; font-weight: 500; }
        /* Footer */
        .w-footer { background: ${t.footer}; color: ${isDark ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.6)"}; padding: 32px 5%; text-align: center; font-size: 12px; font-family: 'Montserrat',sans-serif; }
        .w-footer-logo { font-size: 16px; font-weight: 800; color: ${isDark ? "#fff" : "#fff"}; margin-bottom: 8px; }
        .w-footer-logo span { color: ${t.accent}; }
        .w-footer-redes { display: flex; gap: 10px; justify-content: center; margin: 14px 0; }
        .w-footer-red { width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.6); text-decoration: none; transition: background 0.18s, color 0.18s, border-color 0.18s; }
        .w-footer-red:hover { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
        .w-footer-gfi { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: rgba(255,255,255,0.25); }
        @media (max-width: 768px) {
          .w-stats { flex-direction: column; margin: 0 3%; }
          .w-stat { border-right: none; border-bottom: 1px solid ${t.cardBorder}; }
          .w-sobre-mi { grid-template-columns: 1fr; }
          .w-contacto-grid { grid-template-columns: 1fr; }
          .w-nav { display: none; }
          .w-section { padding: 40px 4%; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className="w-header">
        <div className="w-logo">
          {cfg.logo_url
            ? <img src={cfg.logo_url} alt={titulo} style={{ height: 40, maxWidth: 160, objectFit: "contain" }} />
            : <>{titulo.split(" ")[0]}<span>.</span></>}
        </div>
        <nav className="w-nav">
          <a href={`/web/${cfg.slug}/propiedades`}>Propiedades</a>
          {cfg.mostrar_sobre_mi && <a href="#sobre-mi">Sobre mí</a>}
          {cfg.mostrar_formulario_tasacion && <a href="#tasacion">Tasación</a>}
          <a href="#contacto">Contacto</a>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(cfg.instagram || cfg.facebook || cfg.twitter || cfg.linkedin || cfg.tiktok) && (
            <div className="w-header-redes">
              {cfg.instagram && (
                <a href={cfg.instagram} target="_blank" rel="noopener noreferrer" className="w-header-red" aria-label="Instagram">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              )}
              {cfg.facebook && (
                <a href={cfg.facebook} target="_blank" rel="noopener noreferrer" className="w-header-red" aria-label="Facebook">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {cfg.twitter && (
                <a href={cfg.twitter} target="_blank" rel="noopener noreferrer" className="w-header-red" aria-label="X / Twitter">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              )}
              {cfg.linkedin && (
                <a href={cfg.linkedin} target="_blank" rel="noopener noreferrer" className="w-header-red" aria-label="LinkedIn">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              )}
              {cfg.tiktok && (
                <a href={cfg.tiktok} target="_blank" rel="noopener noreferrer" className="w-header-red" aria-label="TikTok">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.01-.04z"/></svg>
                </a>
              )}
            </div>
          )}
          {wa && (
            <a href={`https://wa.me/${wa.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="w-btn-wa">
              💬 WhatsApp
            </a>
          )}
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="w-hero">
        <div className="w-hero-content">
          <div className="w-hero-tag">Corredor Inmobiliario · 2da Circ. COCIR</div>
          <h1 className="w-hero-h1">{titulo}</h1>
          <p className="w-hero-sub">{subtitulo}</p>
          <div className="w-hero-btns">
            <a href="#propiedades" className="w-btn-primary">Ver propiedades</a>
            <a href="#contacto" className="w-btn-outline">Contactarme</a>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="w-stats">
        {cfg.anos_experiencia && (
          <div className="w-stat">
            <div className="w-stat-val">{cfg.anos_experiencia}+</div>
            <div className="w-stat-label">Años de experiencia</div>
          </div>
        )}
        <div className="w-stat">
          <div className="w-stat-val">{propiedades.length}+</div>
          <div className="w-stat-label">Propiedades activas</div>
        </div>
        <div className="w-stat">
          <div className="w-stat-val">COCIR</div>
          <div className="w-stat-label">Matrícula verificada</div>
        </div>
        <div className="w-stat">
          <div className="w-stat-val">GFI®</div>
          <div className="w-stat-label">Miembro verificado</div>
        </div>
      </div>

      {/* ── PROPIEDADES ── */}
      {cfg.mostrar_propiedades_destacadas && propiedades.length > 0 && (
        <section className="w-section" id="propiedades">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 36, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="w-section-tag">Propiedades</div>
              <h2 className="w-section-h2" style={{ marginBottom: 6 }}>Disponibles ahora</h2>
              <p className="w-section-desc" style={{ marginBottom: 0 }}>Explorá las propiedades que tengo disponibles. Todas verificadas y listas para mostrarte.</p>
            </div>
            <a href={`/web/${cfg.slug}/propiedades`} style={{ padding: "10px 20px", border: `2px solid ${t.accent}`, borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: "Montserrat,sans-serif", color: t.accent, letterSpacing: "0.06em", whiteSpace: "nowrap", flexShrink: 0 }}>
              Ver todas →
            </a>
          </div>
          <div className="w-props-grid">
            {propiedades.map(p => (
              <a key={p.id} href={`/web/${cfg.slug}/propiedad/${p.id}`} className="w-prop-card">
                <div className="w-prop-img">
                  {p.fotos && p.fotos.length > 0
                    ? <img src={p.fotos[0]} alt={p.titulo} loading="lazy" />
                    : <div className="w-prop-img-placeholder">🏠</div>}
                  <div className="w-prop-op-badge">{p.operacion}</div>
                </div>
                <div className="w-prop-body">
                  <div className="w-prop-titulo">{p.titulo}</div>
                  <div className="w-prop-zona">📍 {[p.zona, p.ciudad].filter(Boolean).join(", ")}</div>
                  {p.precio && <div className="w-prop-precio">{formatPrecio(p.precio, p.moneda)}</div>}
                  <div className="w-prop-detalles">
                    {p.dormitorios && <span className="w-prop-det">🛏 {p.dormitorios}</span>}
                    {p.banos && <span className="w-prop-det">🚿 {p.banos}</span>}
                    {p.superficie_cubierta && <span className="w-prop-det">📐 {p.superficie_cubierta}m²</span>}
                    <span className="w-prop-det">{p.tipo}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── SOBRE MÍ ── */}
      {cfg.mostrar_sobre_mi && (
        <section className="w-section alt" id="sobre-mi">
          <div className="w-sobre-mi">
            <div className="w-sobre-img">
              {cfg.foto_sobre_mi_url
                ? <img src={cfg.foto_sobre_mi_url} alt={nombre} />
                : <div className="w-sobre-placeholder">👤</div>}
            </div>
            <div>
              <div className="w-section-tag">Sobre mí</div>
              <div className="w-sobre-nombre">{nombre}</div>
              <div className="w-sobre-mat">
                {perfil.matricula && `Mat. ${perfil.matricula} · `}Corredor Inmobiliario
              </div>
              <p className="w-sobre-desc">
                {cfg.descripcion_profesional || "Corredor inmobiliario matriculado en la 2da Circunscripción de COCIR. Con experiencia en el mercado de Rosario y zona, te ayudo a encontrar la propiedad ideal o a vender/alquilar la tuya al mejor precio."}
              </p>
              {perfil.especialidades && perfil.especialidades.length > 0 && (
                <div className="w-sobre-chips">
                  {perfil.especialidades.map(e => <span key={e} className="w-sobre-chip">{e}</span>)}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── FORMULARIO TASACIÓN ── */}
      {cfg.mostrar_formulario_tasacion && (
        <section className="w-section" id="tasacion" style={{ background: `linear-gradient(135deg, ${t.accent}10, ${t.bgAlt})` }}>
          <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
            <div className="w-section-tag">Tasación gratuita</div>
            <h2 className="w-section-h2">¿Cuánto vale tu propiedad?</h2>
            <p className="w-section-desc" style={{ margin: "0 auto 28px" }}>
              Solicitá una tasación profesional sin cargo. Respondemos en menos de 24 horas.
            </p>
            <TasacionForm slug={cfg.slug} accent={t.accent} card={t.card} cardBorder={t.cardBorder} text={t.text} textMuted={t.textMuted} />
          </div>
        </section>
      )}

      {/* ── CONTACTO ── */}
      {cfg.mostrar_formulario_contacto && (
        <section className="w-section alt" id="contacto">
          <div className="w-section-tag">Contacto</div>
          <h2 className="w-section-h2">Hablemos</h2>
          <p className="w-section-desc">Tengo disponibilidad para atenderte. Completá el formulario o escribime por WhatsApp.</p>
          <div className="w-contacto-grid">
            <ContactForm slug={cfg.slug} accent={t.accent} card={t.card} cardBorder={t.cardBorder} text={t.text} textMuted={t.textMuted} />
            <div className="w-contacto-info">
              {(cfg.whatsapp || perfil.telefono) && (
                <a href={`https://wa.me/${(cfg.whatsapp || perfil.telefono || "").replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="w-contacto-item" style={{ textDecoration:"none" }}>
                  <div className="w-contacto-icon">💬</div>
                  <div>
                    <div className="w-contacto-label">WhatsApp</div>
                    <div className="w-contacto-val">{cfg.whatsapp || perfil.telefono}</div>
                  </div>
                </a>
              )}
              {perfil.email && (
                <a href={`mailto:${perfil.email}`} className="w-contacto-item" style={{ textDecoration:"none" }}>
                  <div className="w-contacto-icon">✉️</div>
                  <div>
                    <div className="w-contacto-label">Email</div>
                    <div className="w-contacto-val">{perfil.email}</div>
                  </div>
                </a>
              )}
              {perfil.matricula && (
                <div className="w-contacto-item">
                  <div className="w-contacto-icon">🏛️</div>
                  <div>
                    <div className="w-contacto-label">Matrícula COCIR</div>
                    <div className="w-contacto-val">N° {perfil.matricula} — 2da Circunscripción</div>
                  </div>
                </div>
              )}
              {perfil.inmobiliaria && (
                <div className="w-contacto-item">
                  <div className="w-contacto-icon">🏢</div>
                  <div>
                    <div className="w-contacto-label">Inmobiliaria</div>
                    <div className="w-contacto-val">{perfil.inmobiliaria}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="w-footer">
        <div className="w-footer-logo">
          {titulo.split(" ")[0]}<span>.</span>
        </div>
        {(cfg.instagram || cfg.facebook || cfg.twitter || cfg.linkedin || cfg.tiktok) && (
          <div className="w-footer-redes">
            {cfg.instagram && (
              <a href={cfg.instagram} target="_blank" rel="noopener noreferrer" className="w-footer-red" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            )}
            {cfg.facebook && (
              <a href={cfg.facebook} target="_blank" rel="noopener noreferrer" className="w-footer-red" aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            )}
            {cfg.twitter && (
              <a href={cfg.twitter} target="_blank" rel="noopener noreferrer" className="w-footer-red" aria-label="X / Twitter">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            )}
            {cfg.linkedin && (
              <a href={cfg.linkedin} target="_blank" rel="noopener noreferrer" className="w-footer-red" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            )}
            {cfg.tiktok && (
              <a href={cfg.tiktok} target="_blank" rel="noopener noreferrer" className="w-footer-red" aria-label="TikTok">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.01-.04z"/></svg>
              </a>
            )}
          </div>
        )}
        <div>{nombre} · Corredor Inmobiliario Matriculado</div>
        <div className="w-footer-gfi">
          Sitio creado con <strong>GFI® Grupo Foro Inmobiliario</strong> · Rosario, Argentina
        </div>
      </footer>

      {/* Google Analytics */}
      {cfg.google_analytics && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${cfg.google_analytics}`} />
          <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${cfg.google_analytics}');` }} />
        </>
      )}
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function WebCorredorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return notFound();
  return <WebTemplate {...data} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return {};
  const { cfg, perfil } = data;
  const title = cfg.seo_titulo || cfg.titulo_sitio || `${perfil.nombre} ${perfil.apellido} · Corredor Inmobiliario`;
  const description = cfg.seo_descripcion || `Corredor inmobiliario matriculado en Rosario. Compra, venta y alquiler de propiedades.`;
  const url = `https://foroinmobiliario.com.ar/web/${slug}`;
  const image = cfg.cover_url || cfg.logo_url || null;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
