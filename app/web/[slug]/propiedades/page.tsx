import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

interface Config {
  id: string; perfil_id: string; slug: string;
  plantilla: string; activa: boolean; logo_url: string | null;
  color_primario: string; color_secundario: string;
  color_texto: string; color_fondo: string;
  titulo_sitio: string | null; subtitulo: string | null;
  mostrar_propiedades_destacadas: boolean;
  seo_titulo: string | null; seo_descripcion: string | null;
  instagram: string | null; facebook: string | null;
  twitter: string | null; linkedin: string | null; whatsapp: string | null;
  google_analytics: string | null;
}

interface Perfil {
  nombre: string; apellido: string; matricula: string | null;
  telefono: string | null; email: string | null;
}

interface Propiedad {
  id: string; titulo: string; descripcion: string | null;
  operacion: string; tipo: string; precio: number | null; moneda: string;
  ciudad: string; zona: string | null; dormitorios: number | null;
  banos: number | null; superficie_cubierta: number | null;
  fotos: string[] | null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getData(slug: string, operacion?: string) {
  const { data: cfg } = await supabase
    .from("web_corredor_config")
    .select("*")
    .eq("slug", slug)
    .eq("activa", true)
    .single();

  if (!cfg) return null;

  const [{ data: perfil }, { data: props }] = await Promise.all([
    supabase.from("perfiles").select("nombre,apellido,matricula,telefono,email").eq("id", cfg.perfil_id).single(),
    (() => {
      let q = supabase
        .from("cartera_propiedades")
        .select("id,titulo,descripcion,operacion,tipo,precio,moneda,ciudad,zona,dormitorios,banos,superficie_cubierta,fotos")
        .eq("perfil_id", cfg.perfil_id)
        .eq("publicada_web", true)
        .eq("estado", "activa")
        .order("created_at", { ascending: false });
      if (operacion && operacion !== "todas") q = q.eq("operacion", operacion);
      return q;
    })(),
  ]);

  return { cfg: cfg as Config, perfil: perfil as Perfil, propiedades: (props as Propiedad[]) ?? [] };
}

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

export default async function PropiedadesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ operacion?: string }>;
}) {
  const { slug } = await params;
  const { operacion } = await searchParams;
  const data = await getData(slug, operacion);
  if (!data) return notFound();

  const { cfg, perfil, propiedades } = data;
  const t = TEMAS[cfg.plantilla] ?? TEMAS["rosario-classic"];
  const isDark = DARK_THEMES.includes(cfg.plantilla);
  const nombre = `${perfil.nombre} ${perfil.apellido}`;
  const titulo = cfg.titulo_sitio || nombre;
  const wa = cfg.whatsapp || perfil.telefono;
  const filtroActivo = operacion || "todas";

  const ventas = propiedades.filter(p => p.operacion === "venta").length;
  const alquileres = propiedades.filter(p => p.operacion === "alquiler").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500;600&family=Georgia&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${t.bg}; color: ${t.text}; font-family: 'Inter',sans-serif; }
        a { text-decoration: none; color: inherit; }
        .w-header { position: sticky; top: 0; z-index: 100; background: ${t.header}; border-bottom: 1px solid ${t.cardBorder}; padding: 0 5%; height: 68px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(10px); }
        .w-logo { font-family: ${t.fontH}; font-size: 20px; font-weight: 800; color: ${t.text}; }
        .w-logo span { color: ${t.accent}; }
        .w-nav { display: flex; gap: 24px; align-items: center; }
        .w-nav a { font-size: 13px; color: ${t.textMuted}; font-weight: 500; transition: color 0.2s; }
        .w-nav a:hover { color: ${t.accent}; }
        .w-btn-wa { padding: 9px 18px; background: ${t.accent}; color: #fff; border-radius: 6px; font-size: 12px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.05em; transition: opacity 0.2s; }
        .w-btn-wa:hover { opacity: 0.85; }
        .page-hero { padding: 48px 5% 32px; background: ${t.bgAlt}; border-bottom: 1px solid ${t.cardBorder}; }
        .page-breadcrumb { font-size: 12px; color: ${t.textMuted}; margin-bottom: 12px; }
        .page-breadcrumb a { color: ${t.accent}; }
        .page-title { font-family: ${t.fontH}; font-size: clamp(22px,3vw,36px); font-weight: 800; color: ${t.text}; margin-bottom: 6px; }
        .page-subtitle { font-size: 14px; color: ${t.textMuted}; }
        .filters { display: flex; gap: 8px; padding: 20px 5%; background: ${t.bg}; border-bottom: 1px solid ${t.cardBorder}; flex-wrap: wrap; align-items: center; }
        .filters-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: ${t.textMuted}; font-family: 'Montserrat',sans-serif; margin-right: 4px; }
        .filter-btn { padding: 7px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'Montserrat',sans-serif; border: 1px solid ${t.cardBorder}; background: transparent; color: ${t.textMuted}; cursor: pointer; transition: all 0.15s; text-decoration: none; display: inline-block; }
        .filter-btn:hover { border-color: ${t.accent}; color: ${t.accent}; }
        .filter-btn.active { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
        .results-count { margin-left: auto; font-size: 12px; color: ${t.textMuted}; }
        .content { padding: 32px 5% 64px; }
        .props-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .prop-card { background: ${t.card}; border: 1px solid ${t.cardBorder}; border-radius: 10px; overflow: hidden; transition: all 0.2s; cursor: pointer; display: block; }
        .prop-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.2); border-color: ${t.accent}40; }
        .prop-img { height: 200px; background: ${t.bgAlt}; position: relative; overflow: hidden; }
        .prop-img img { width: 100%; height: 100%; object-fit: cover; }
        .prop-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px; color: ${t.textMuted}; }
        .prop-op-badge { position: absolute; top: 10px; left: 10px; padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.1em; text-transform: uppercase; background: ${t.accent}; color: #fff; }
        .prop-body { padding: 16px; }
        .prop-titulo { font-family: ${t.fontH}; font-size: 15px; font-weight: 700; color: ${t.text}; margin-bottom: 4px; }
        .prop-zona { font-size: 12px; color: ${t.textMuted}; margin-bottom: 10px; }
        .prop-precio { font-family: ${t.fontH}; font-size: 18px; font-weight: 800; color: ${t.accent}; margin-bottom: 10px; }
        .prop-detalles { display: flex; gap: 8px; flex-wrap: wrap; }
        .prop-det { font-size: 11px; color: ${t.textMuted}; background: ${t.bgAlt}; padding: 3px 8px; border-radius: 4px; border: 1px solid ${t.cardBorder}; }
        .empty { text-align: center; padding: 80px 0; color: ${t.textMuted}; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .empty-text { font-size: 15px; font-family: ${t.fontH}; font-weight: 700; color: ${t.text}; margin-bottom: 8px; }
        .empty-sub { font-size: 13px; }
        .w-footer { background: ${t.footer}; color: ${isDark ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.6)"}; padding: 32px 5%; text-align: center; font-size: 12px; font-family: 'Montserrat',sans-serif; }
        .w-footer-logo { font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .w-footer-logo span { color: ${t.accent}; }
        .w-footer-gfi { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: rgba(255,255,255,0.25); }
        @media (max-width: 768px) {
          .w-nav { display: none; }
          .props-grid { grid-template-columns: 1fr; }
          .page-hero, .filters, .content { padding-left: 4%; padding-right: 4%; }
        }
      `}</style>

      {/* HEADER */}
      <header className="w-header">
        <a href={`/web/${cfg.slug}`} className="w-logo">
          {cfg.logo_url
            ? <img src={cfg.logo_url} alt={titulo} style={{ height: 40, maxWidth: 160, objectFit: "contain" }} />
            : <>{titulo.split(" ")[0]}<span>.</span></>}
        </a>
        <nav className="w-nav">
          <a href={`/web/${cfg.slug}`}>Inicio</a>
          <a href={`/web/${cfg.slug}/propiedades`} style={{ color: t.accent, fontWeight: 700 }}>Propiedades</a>
          <a href={`/web/${cfg.slug}#contacto`}>Contacto</a>
        </nav>
        {wa && (
          <a href={`https://wa.me/${wa.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="w-btn-wa">
            💬 WhatsApp
          </a>
        )}
      </header>

      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="page-breadcrumb">
          <a href={`/web/${cfg.slug}`}>Inicio</a> / Propiedades
        </div>
        <h1 className="page-title">Propiedades disponibles</h1>
        <p className="page-subtitle">
          {ventas > 0 && `${ventas} en venta`}
          {ventas > 0 && alquileres > 0 && " · "}
          {alquileres > 0 && `${alquileres} en alquiler`}
          {propiedades.length === 0 && "Sin resultados para el filtro seleccionado"}
        </p>
      </div>

      {/* FILTERS */}
      <div className="filters">
        <span className="filters-label">Filtrar:</span>
        <a href={`/web/${cfg.slug}/propiedades`} className={`filter-btn${filtroActivo === "todas" ? " active" : ""}`}>
          Todas
        </a>
        <a href={`/web/${cfg.slug}/propiedades?operacion=venta`} className={`filter-btn${filtroActivo === "venta" ? " active" : ""}`}>
          Venta
        </a>
        <a href={`/web/${cfg.slug}/propiedades?operacion=alquiler`} className={`filter-btn${filtroActivo === "alquiler" ? " active" : ""}`}>
          Alquiler
        </a>
        <span className="results-count">{propiedades.length} resultado{propiedades.length !== 1 ? "s" : ""}</span>
      </div>

      {/* GRID */}
      <div className="content">
        {propiedades.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏠</div>
            <div className="empty-text">No hay propiedades disponibles</div>
            <p className="empty-sub">Probá con otro filtro o volvé a la página principal.</p>
          </div>
        ) : (
          <div className="props-grid">
            {propiedades.map(p => (
              <a key={p.id} href={`/web/${cfg.slug}/propiedad/${p.id}`} className="prop-card">
                <div className="prop-img">
                  {p.fotos && p.fotos.length > 0
                    ? <img src={p.fotos[0]} alt={p.titulo} loading="lazy" />
                    : <div className="prop-img-placeholder">🏠</div>}
                  <div className="prop-op-badge">{p.operacion}</div>
                </div>
                <div className="prop-body">
                  <div className="prop-titulo">{p.titulo}</div>
                  <div className="prop-zona">📍 {[p.zona, p.ciudad].filter(Boolean).join(", ")}</div>
                  {p.precio && <div className="prop-precio">{formatPrecio(p.precio, p.moneda)}</div>}
                  <div className="prop-detalles">
                    {p.dormitorios && <span className="prop-det">🛏 {p.dormitorios}</span>}
                    {p.banos && <span className="prop-det">🚿 {p.banos}</span>}
                    {p.superficie_cubierta && <span className="prop-det">📐 {p.superficie_cubierta}m²</span>}
                    <span className="prop-det">{p.tipo}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="w-footer">
        <div className="w-footer-logo">
          {titulo.split(" ")[0]}<span>.</span>
        </div>
        <div>{nombre} · Corredor Inmobiliario Matriculado</div>
        <div className="w-footer-gfi">
          Sitio creado con <strong>GFI® Grupo Foro Inmobiliario</strong> · Rosario, Argentina
        </div>
      </footer>

      {cfg.google_analytics && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${cfg.google_analytics}`} />
          <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${cfg.google_analytics}');` }} />
        </>
      )}
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return {};
  const { cfg, perfil } = data;
  const nombre = `${perfil.nombre} ${perfil.apellido}`;
  return {
    title: `Propiedades · ${cfg.seo_titulo || cfg.titulo_sitio || nombre}`,
    description: `Todas las propiedades disponibles de ${nombre}. Venta y alquiler en Rosario y zona.`,
  };
}
