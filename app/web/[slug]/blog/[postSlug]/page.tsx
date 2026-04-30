import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEMAS: Record<string, { bg: string; bgAlt: string; header: string; footer: string; accent: string; text: string; textMuted: string; card: string; cardBorder: string; fontH: string }> = {
  "rosario-classic":  { bg:"#0a0a0a", bgAlt:"#111", header:"rgba(8,8,8,0.98)", footer:"#080808", accent:"#cc0000", text:"#fff", textMuted:"rgba(255,255,255,0.5)", card:"rgba(20,20,20,0.95)", cardBorder:"rgba(255,255,255,0.08)", fontH:"Montserrat,sans-serif" },
  "blanco-moderno":   { bg:"#fff", bgAlt:"#f8f9fa", header:"#fff", footer:"#111", accent:"#111", text:"#111", textMuted:"#666", card:"#fff", cardBorder:"#e5e7eb", fontH:"Montserrat,sans-serif" },
  "grand-estate":     { bg:"#0d0d0d", bgAlt:"#141414", header:"#0a0a0a", footer:"#080808", accent:"#c9a84c", text:"#f5f0e8", textMuted:"rgba(245,240,232,0.5)", card:"rgba(25,20,10,0.95)", cardBorder:"rgba(201,168,76,0.15)", fontH:"'Georgia',serif" },
  "ciudad-viva":      { bg:"#f0f4f8", bgAlt:"#e8edf2", header:"#1a2332", footer:"#1a2332", accent:"#3b82f6", text:"#1a2332", textMuted:"#64748b", card:"#fff", cardBorder:"#e2e8f0", fontH:"Montserrat,sans-serif" },
  "campo-verde":      { bg:"#f0f7f0", bgAlt:"#e8f5e8", header:"#1a3a2a", footer:"#1a3a2a", accent:"#22863a", text:"#1a2a1a", textMuted:"#4a6a4a", card:"#fff", cardBorder:"#d4edda", fontH:"Montserrat,sans-serif" },
  "coral":            { bg:"#fff8f5", bgAlt:"#fff0ea", header:"#fff", footer:"#2d1a14", accent:"#e05c3a", text:"#1a0f0a", textMuted:"#8b5e52", card:"#fff", cardBorder:"#fde8e0", fontH:"Montserrat,sans-serif" },
  "noche-portena":    { bg:"#0f1923", bgAlt:"#141f2e", header:"#0a1220", footer:"#080e18", accent:"#60a5fa", text:"#e2e8f0", textMuted:"#64748b", card:"rgba(20,30,45,0.95)", cardBorder:"rgba(96,165,250,0.12)", fontH:"Montserrat,sans-serif" },
  "sol-norte":        { bg:"#fffbf0", bgAlt:"#fff7e6", header:"#fff", footer:"#1a1000", accent:"#f97316", text:"#1a1000", textMuted:"#92400e", card:"#fff", cardBorder:"#fed7aa", fontH:"Montserrat,sans-serif" },
  "plata":            { bg:"#f8f9fa", bgAlt:"#f0f2f5", header:"#fff", footer:"#1f2937", accent:"#374151", text:"#111827", textMuted:"#6b7280", card:"#fff", cardBorder:"#e5e7eb", fontH:"Montserrat,sans-serif" },
  "brick":            { bg:"#1c1410", bgAlt:"#231a14", header:"#150f0a", footer:"#0f0a06", accent:"#d97706", text:"#f5f0e8", textMuted:"rgba(245,240,232,0.5)", card:"rgba(35,26,20,0.95)", cardBorder:"rgba(217,119,6,0.2)", fontH:"'Georgia',serif" },
  "zen":              { bg:"#faf8f5", bgAlt:"#f5f0e8", header:"#faf8f5", footer:"#2d2420", accent:"#92775a", text:"#2d2d2d", textMuted:"#8b7355", card:"#fff", cardBorder:"#e8e0d0", fontH:"'Georgia',serif" },
  "digital-pro":      { bg:"#0f0f23", bgAlt:"#13132e", header:"rgba(10,10,20,0.98)", footer:"#080818", accent:"#8b5cf6", text:"#e2e8f0", textMuted:"rgba(226,232,240,0.5)", card:"rgba(20,20,40,0.95)", cardBorder:"rgba(139,92,246,0.15)", fontH:"Montserrat,sans-serif" },
};
const DARK_THEMES = ["rosario-classic","grand-estate","noche-portena","brick","digital-pro"];

export default async function PostPublicoPage({ params }: { params: Promise<{ slug: string; postSlug: string }> }) {
  const { slug, postSlug } = await params;

  const { data: cfg } = await supabase
    .from("web_corredor_config")
    .select("perfil_id, plantilla, titulo_sitio, activa, mostrar_blog, whatsapp")
    .eq("slug", slug)
    .eq("activa", true)
    .single();

  if (!cfg || !cfg.mostrar_blog) return notFound();

  const [{ data: perfil }, { data: post }] = await Promise.all([
    supabase.from("perfiles").select("nombre, apellido, matricula, telefono").eq("id", cfg.perfil_id).single(),
    supabase
      .from("mi_web_posts")
      .select("*")
      .eq("perfil_id", cfg.perfil_id)
      .eq("slug", postSlug)
      .eq("publicado", true)
      .single(),
  ]);

  if (!post) return notFound();

  const t = TEMAS[cfg.plantilla] ?? TEMAS["rosario-classic"];
  const isDark = DARK_THEMES.includes(cfg.plantilla);
  const nombre = perfil ? `${perfil.nombre} ${perfil.apellido}` : cfg.titulo_sitio ?? "Corredor";
  const titulo = cfg.titulo_sitio || nombre;
  const wa = cfg.whatsapp || perfil?.telefono;

  // Render contenido: newlines → párrafos
  const parrafos = post.contenido.split(/\n\n+/).filter(Boolean);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${t.bg}; color: ${t.text}; font-family: 'Inter',sans-serif; }
        a { text-decoration: none; color: inherit; }
        .w-header { position: sticky; top: 0; z-index: 100; background: ${t.header}; border-bottom: 1px solid ${t.cardBorder}; padding: 0 5%; height: 68px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(10px); }
        .w-logo { font-family: ${t.fontH}; font-size: 20px; font-weight: 800; color: ${t.text}; }
        .w-logo span { color: ${t.accent}; }
        .w-nav { display: flex; gap: 24px; align-items: center; }
        .w-nav a { font-size: 13px; color: ${t.textMuted}; font-weight: 500; transition: color 0.2s; }
        .w-nav a:hover { color: ${t.accent}; }
        .post-hero { padding: 48px 5% 32px; background: ${t.bgAlt}; border-bottom: 1px solid ${t.cardBorder}; }
        .post-breadcrumb { font-size: 12px; color: ${t.textMuted}; margin-bottom: 16px; display: flex; gap: 6px; align-items: center; }
        .post-breadcrumb a { color: ${t.accent}; }
        .post-titulo { font-family: ${t.fontH}; font-size: clamp(24px,4vw,42px); font-weight: 800; color: ${t.text}; line-height: 1.2; margin-bottom: 12px; }
        .post-fecha { font-size: 12px; color: ${t.textMuted}; font-family: 'Montserrat',sans-serif; }
        .post-imagen { width: 100%; max-height: 420px; object-fit: cover; margin-bottom: 0; }
        .post-body { max-width: 720px; margin: 0 auto; padding: 48px 5%; }
        .post-resumen { font-size: 17px; color: ${t.textMuted}; line-height: 1.7; margin-bottom: 28px; font-style: italic; border-left: 3px solid ${t.accent}; padding-left: 16px; }
        .post-parrafo { font-size: 15px; color: ${t.text}; line-height: 1.8; margin-bottom: 20px; }
        .post-autor { margin-top: 48px; padding: 24px; background: ${t.card}; border: 1px solid ${t.cardBorder}; border-radius: 12px; display: flex; gap: 16px; align-items: center; }
        .post-autor-avatar { width: 56px; height: 56px; border-radius: 50%; background: ${t.accent}20; border: 2px solid ${t.accent}40; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .post-autor-nombre { font-family: ${t.fontH}; font-size: 16px; font-weight: 700; color: ${t.text}; }
        .post-autor-mat { font-size: 11px; color: ${t.accent}; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
        .post-wa { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; padding: 9px 18px; background: ${t.accent}; color: #fff; border-radius: 6px; font-size: 12px; font-weight: 700; font-family: 'Montserrat',sans-serif; }
        .post-back { display: inline-flex; align-items: center; gap: 6px; margin-top: 32px; font-size: 13px; color: ${t.accent}; font-weight: 600; }
        .w-footer { background: ${t.footer}; color: ${isDark ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.6)"}; padding: 28px 5%; text-align: center; font-size: 12px; font-family: 'Montserrat',sans-serif; }
        .w-footer-logo { font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .w-footer-logo span { color: ${t.accent}; }
        .w-footer-gfi { margin-top: 12px; font-size: 10px; color: rgba(255,255,255,0.2); }
        @media (max-width: 768px) { .w-nav { display: none; } .post-body { padding: 32px 4%; } }
      `}</style>

      <header className="w-header">
        <div className="w-logo">{titulo.split(" ")[0]}<span>.</span></div>
        <nav className="w-nav">
          <Link href={`/web/${slug}`}>Inicio</Link>
          <Link href={`/web/${slug}#propiedades`}>Propiedades</Link>
          <Link href={`/web/${slug}/blog`}>Blog</Link>
          <Link href={`/web/${slug}#contacto`}>Contacto</Link>
        </nav>
      </header>

      <div className="post-hero">
        <div className="post-breadcrumb">
          <Link href={`/web/${slug}`}>{titulo}</Link>
          <span>›</span>
          <Link href={`/web/${slug}/blog`}>Blog</Link>
          <span>›</span>
          <span>{post.titulo}</span>
        </div>
        <h1 className="post-titulo">{post.titulo}</h1>
        <div className="post-fecha">
          {new Date(post.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
        </div>
      </div>

      {post.imagen_url && (
        <img src={post.imagen_url} alt={post.titulo} className="post-imagen" />
      )}

      <div className="post-body">
        {post.resumen && <p className="post-resumen">{post.resumen}</p>}

        {parrafos.map((p: string, i: number) => (
          <p key={i} className="post-parrafo">{p}</p>
        ))}

        <div className="post-autor">
          <div className="post-autor-avatar">👤</div>
          <div>
            <div className="post-autor-nombre">{nombre}</div>
            {perfil?.matricula && (
              <div className="post-autor-mat">Mat. {perfil.matricula} · COCIR 2da Circ.</div>
            )}
            {wa && (
              <a href={`https://wa.me/${wa.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="post-wa">
                💬 Consultarme
              </a>
            )}
          </div>
        </div>

        <Link href={`/web/${slug}/blog`} className="post-back">
          ← Volver al blog
        </Link>
      </div>

      <footer className="w-footer">
        <div className="w-footer-logo">{titulo.split(" ")[0]}<span>.</span></div>
        <div>{nombre} · Corredor Inmobiliario Matriculado</div>
        <div className="w-footer-gfi">Sitio creado con <strong>GFI® Grupo Foro Inmobiliario</strong> · Rosario, Argentina</div>
      </footer>
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; postSlug: string }> }) {
  const { slug, postSlug } = await params;
  const { data: cfg } = await supabase.from("web_corredor_config").select("perfil_id, titulo_sitio").eq("slug", slug).single();
  if (!cfg) return {};
  const { data: post } = await supabase.from("mi_web_posts").select("titulo, resumen").eq("perfil_id", cfg.perfil_id).eq("slug", postSlug).single();
  return {
    title: post?.titulo ?? "Artículo",
    description: post?.resumen ?? "",
  };
}
