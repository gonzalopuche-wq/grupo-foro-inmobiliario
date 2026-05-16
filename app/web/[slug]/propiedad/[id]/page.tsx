import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import VistaTracker from "./VistaTracker";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Propiedad {
  id: string; perfil_id: string; titulo: string; descripcion: string | null;
  operacion: string; tipo: string; precio: number | null; moneda: string;
  ciudad: string; zona: string | null; barrio: string | null;
  dormitorios: number | null; banos: number | null;
  superficie_cubierta: number | null; superficie_total: number | null;
  antiguedad: string | null; estado_conservacion: string | null;
  amenities: string[] | null; fotos: string[] | null;
  direccion: string | null; piso: string | null; cochera: boolean | null;
  expensas: number | null; estado: string;
}

interface WebConfig {
  slug: string; plantilla: string; activa: boolean;
  color_primario: string; color_secundario: string;
  color_texto: string; color_fondo: string;
  titulo_sitio: string | null; whatsapp: string | null;
  logo_url: string | null;
}

interface Perfil {
  nombre: string; apellido: string; telefono: string | null;
  email: string | null; matricula: string | null;
}

const TEMAS: Record<string, { bg: string; bgAlt: string; header: string; footer: string; accent: string; text: string; textMuted: string; card: string; cardBorder: string; fontH: string }> = {
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

async function getData(slug: string, propId: string) {
  const { data: cfg } = await supabase
    .from("web_corredor_config")
    .select("slug,plantilla,activa,color_primario,color_secundario,color_texto,color_fondo,titulo_sitio,whatsapp,logo_url,perfil_id")
    .eq("slug", slug)
    .eq("activa", true)
    .single();

  if (!cfg) return null;

  const [{ data: prop }, { data: perfil }] = await Promise.all([
    supabase.from("cartera_propiedades")
      .select("*")
      .eq("id", propId)
      .eq("perfil_id", cfg.perfil_id)
      .eq("publicada_web", true)
      .eq("estado", "activa")
      .single(),
    supabase.from("perfiles")
      .select("nombre,apellido,telefono,email,matricula")
      .eq("id", cfg.perfil_id)
      .single(),
  ]);

  if (!prop) return null;
  return { cfg: cfg as WebConfig, prop: prop as Propiedad, perfil: perfil as Perfil };
}

export default async function PropiedadDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const data = await getData(slug, id);
  if (!data) return notFound();

  const { cfg, prop, perfil } = data;
  const t = TEMAS[cfg.plantilla] ?? TEMAS["rosario-classic"];
  const isDark = DARK_THEMES.includes(cfg.plantilla);
  const wa = cfg.whatsapp || perfil.telefono;
  const corredorNombre = `${perfil.nombre} ${perfil.apellido}`;
  const tituloSitio = cfg.titulo_sitio || corredorNombre;

  const fotos = prop.fotos?.filter(Boolean) ?? [];
  const ubicacion = [prop.zona, prop.ciudad].filter(Boolean).join(", ");

  return (
    <>
      <VistaTracker propiedadId={prop.id} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${t.bg}; color: ${t.text}; font-family: 'Inter',sans-serif; }
        a { text-decoration: none; color: inherit; }
        .p-header { position: sticky; top: 0; z-index: 100; background: ${t.header}; border-bottom: 1px solid ${t.cardBorder}; padding: 0 5%; height: 64px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(10px); }
        .p-logo { font-family: ${t.fontH}; font-size: 18px; font-weight: 800; color: ${t.text}; }
        .p-logo span { color: ${t.accent}; }
        .p-back { display: flex; align-items: center; gap: 6px; font-size: 13px; color: ${t.textMuted}; transition: color 0.2s; }
        .p-back:hover { color: ${t.accent}; }
        .p-btn-wa { padding: 8px 16px; background: ${t.accent}; color: #fff; border-radius: 6px; font-size: 12px; font-weight: 700; font-family: 'Montserrat',sans-serif; }
        /* Gallery */
        .p-gallery { position: relative; width: 100%; aspect-ratio: 16/7; background: ${t.bgAlt}; overflow: hidden; }
        .p-gallery img { width: 100%; height: 100%; object-fit: cover; }
        .p-gallery-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 64px; }
        .p-gallery-nav { position: absolute; bottom: 16px; right: 16px; display: flex; gap: 8px; }
        .p-gallery-btn { padding: 8px 14px; background: rgba(0,0,0,0.6); color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; backdrop-filter: blur(6px); }
        .p-gallery-counter { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6); color: #fff; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-family: 'Montserrat',sans-serif; backdrop-filter: blur(6px); }
        .p-badge-op { position: absolute; top: 16px; left: 16px; padding: 5px 14px; background: ${t.accent}; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 700; font-family: 'Montserrat',sans-serif; letter-spacing: 0.1em; text-transform: uppercase; }
        /* Body layout */
        .p-body { max-width: 1100px; margin: 0 auto; padding: 40px 5%; display: grid; grid-template-columns: 1fr 320px; gap: 32px; }
        /* Info */
        .p-tipo { font-size: 11px; color: ${t.accent}; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 8px; }
        .p-titulo { font-family: ${t.fontH}; font-size: clamp(22px,3vw,32px); font-weight: 800; color: ${t.text}; line-height: 1.2; margin-bottom: 8px; }
        .p-ubicacion { font-size: 14px; color: ${t.textMuted}; margin-bottom: 16px; }
        .p-precio { font-family: ${t.fontH}; font-size: 28px; font-weight: 800; color: ${t.accent}; margin-bottom: 8px; }
        .p-expensas { font-size: 13px; color: ${t.textMuted}; margin-bottom: 24px; }
        /* Detalles chips */
        .p-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
        .p-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: ${t.card}; border: 1px solid ${t.cardBorder}; border-radius: 8px; font-size: 13px; color: ${t.text}; }
        .p-chip-icon { font-size: 16px; }
        /* Secciones */
        .p-section { margin-bottom: 28px; }
        .p-section-titulo { font-family: ${t.fontH}; font-size: 15px; font-weight: 700; color: ${t.text}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid ${t.cardBorder}; }
        .p-descripcion { font-size: 14px; color: ${t.textMuted}; line-height: 1.8; white-space: pre-wrap; }
        .p-amenities { display: flex; flex-wrap: wrap; gap: 8px; }
        .p-amenity { padding: 5px 12px; background: ${t.accent}12; border: 1px solid ${t.accent}25; border-radius: 20px; font-size: 12px; color: ${t.accent}; font-weight: 600; }
        /* Sidebar */
        .p-sidebar { display: flex; flex-direction: column; gap: 16px; }
        .p-card { background: ${t.card}; border: 1px solid ${t.cardBorder}; border-radius: 10px; padding: 20px; }
        .p-corredor-nombre { font-family: ${t.fontH}; font-size: 15px; font-weight: 800; color: ${t.text}; margin-bottom: 3px; }
        .p-corredor-mat { font-size: 11px; color: ${t.accent}; font-family: 'Montserrat',sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; }
        .p-contact-btn { display: block; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 700; font-family: 'Montserrat',sans-serif; text-align: center; margin-bottom: 10px; transition: opacity 0.2s; }
        .p-contact-btn:hover { opacity: 0.85; }
        .p-contact-btn.wa { background: #25d366; color: #fff; }
        .p-contact-btn.email { background: ${t.accent}; color: #fff; }
        .p-contact-btn.call { background: ${t.card}; color: ${t.text}; border: 1px solid ${t.cardBorder}; }
        /* Mini galería thumbs */
        .p-thumbs { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; margin-top: 12px; }
        .p-thumb { aspect-ratio: 1; border-radius: 6px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s; }
        .p-thumb.activo { border-color: ${t.accent}; }
        .p-thumb img { width: 100%; height: 100%; object-fit: cover; }
        /* Footer */
        .p-footer { background: ${t.footer}; color: ${isDark ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.6)"}; padding: 24px 5%; text-align: center; font-size: 12px; font-family: 'Montserrat',sans-serif; margin-top: 40px; }
        @media (max-width: 768px) {
          .p-body { grid-template-columns: 1fr; }
          .p-sidebar { order: -1; }
          .p-gallery { aspect-ratio: 4/3; }
        }
      `}</style>

      {/* Header */}
      <header className="p-header">
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href={`/web/${slug}`} className="p-back">
            ← Volver
          </Link>
          <div className="p-logo">
            {cfg.logo_url
              ? <img src={cfg.logo_url} alt={tituloSitio} style={{ height: 36, maxWidth: 140, objectFit: "contain" }} />
              : <>{tituloSitio.split(" ")[0]}<span>.</span></>}
          </div>
        </div>
        {wa && (
          <a href={`https://wa.me/${wa.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, me interesa la propiedad: ${prop.titulo}`)}`}
            target="_blank" rel="noopener noreferrer" className="p-btn-wa">
            💬 Consultar
          </a>
        )}
      </header>

      {/* Galería principal */}
      <GallerySection fotos={fotos} operacion={prop.operacion} accent={t.accent} />

      {/* Body */}
      <div className="p-body">
        {/* Columna principal */}
        <div>
          <div className="p-tipo">{prop.tipo} · {prop.operacion}</div>
          <h1 className="p-titulo">{prop.titulo}</h1>
          {ubicacion && <div className="p-ubicacion">📍 {ubicacion}</div>}
          {prop.precio && <div className="p-precio">{formatPrecio(prop.precio, prop.moneda)}</div>}
          {prop.expensas && <div className="p-expensas">+ Expensas: ${prop.expensas.toLocaleString("es-AR")}/mes</div>}

          {/* Chips de características */}
          <div className="p-chips">
            {prop.dormitorios != null && (
              <div className="p-chip"><span className="p-chip-icon">🛏</span> {prop.dormitorios} dorm.</div>
            )}
            {prop.banos != null && (
              <div className="p-chip"><span className="p-chip-icon">🚿</span> {prop.banos} baño{prop.banos !== 1 ? "s" : ""}</div>
            )}
            {prop.superficie_cubierta != null && (
              <div className="p-chip"><span className="p-chip-icon">📐</span> {prop.superficie_cubierta}m² cubiertos</div>
            )}
            {prop.superficie_total != null && prop.superficie_total !== prop.superficie_cubierta && (
              <div className="p-chip"><span className="p-chip-icon">📏</span> {prop.superficie_total}m² totales</div>
            )}
            {(prop as any).con_cochera && (
              <div className="p-chip"><span className="p-chip-icon">🚗</span> Cochera</div>
            )}
            {(prop as any).apto_credito && (
              <div className="p-chip"><span className="p-chip-icon">🏦</span> Apto crédito</div>
            )}
            {prop.piso && (
              <div className="p-chip"><span className="p-chip-icon">🏢</span> Piso {prop.piso}</div>
            )}
            {prop.antiguedad && (
              <div className="p-chip"><span className="p-chip-icon">📅</span> {prop.antiguedad}</div>
            )}
            {prop.estado_conservacion && (
              <div className="p-chip"><span className="p-chip-icon">✨</span> {prop.estado_conservacion}</div>
            )}
          </div>

          {/* Descripción */}
          {prop.descripcion && (
            <div className="p-section">
              <div className="p-section-titulo">Descripción</div>
              <p className="p-descripcion">{prop.descripcion}</p>
            </div>
          )}

          {/* Amenities */}
          {prop.amenities && prop.amenities.length > 0 && (
            <div className="p-section">
              <div className="p-section-titulo">Amenities</div>
              <div className="p-amenities">
                {prop.amenities.map(a => <span key={a} className="p-amenity">{a}</span>)}
              </div>
            </div>
          )}

          {/* Video YouTube */}
          {(prop as any).video_url && (() => {
            const url: string = (prop as any).video_url;
            const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
            if (!m) return null;
            return (
              <div className="p-section">
                <div className="p-section-titulo">🎬 Video de la propiedad</div>
                <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${t.cardBorder}`, aspectRatio: "16/9" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${m[1]}`}
                    style={{ display: "block", width: "100%", height: "100%", border: 0 }}
                    allowFullScreen
                    title="Video de la propiedad"
                  />
                </div>
              </div>
            );
          })()}

          {/* Tour Virtual 360° */}
          {(prop as any).tour_virtual_url && (
            <div className="p-section">
              <div className="p-section-titulo">🔮 Recorrida Virtual 360°</div>
              <div style={{ borderRadius: 10, overflow: "hidden", border: `2px solid ${t.accent}` }}>
                <iframe
                  src={(prop as any).tour_virtual_url}
                  style={{ display: "block", width: "100%", height: 400, border: 0 }}
                  allowFullScreen
                  title="Tour virtual 360°"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </div>
          )}

          {/* Dirección */}
          {prop.direccion && (
            <div className="p-section">
              <div className="p-section-titulo">Ubicación</div>
              <div style={{ fontSize: 14, color: t.textMuted }}>📍 {prop.direccion}</div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="p-sidebar">
          <div className="p-card">
            <div className="p-corredor-nombre">{corredorNombre}</div>
            <div className="p-corredor-mat">
              {perfil.matricula ? `Mat. ${perfil.matricula} · ` : ""}Corredor Inmobiliario
            </div>
            {wa && (
              <a href={`https://wa.me/${wa.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, me interesa la propiedad: ${prop.titulo}`)}`}
                target="_blank" rel="noopener noreferrer" className="p-contact-btn wa">
                💬 Escribir por WhatsApp
              </a>
            )}
            {perfil.email && (
              <a href={`mailto:${perfil.email}?subject=${encodeURIComponent(`Consulta por: ${prop.titulo}`)}`}
                className="p-contact-btn email">
                ✉️ Enviar email
              </a>
            )}
            {perfil.telefono && (
              <a href={`tel:${perfil.telefono}`} className="p-contact-btn call">
                📞 Llamar
              </a>
            )}
          </div>

          {/* Card info básica */}
          <div className="p-card">
            <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: t.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Datos clave</div>
            {[
              { label: "Operación", val: prop.operacion },
              { label: "Tipo", val: prop.tipo },
              { label: "Ciudad", val: prop.ciudad },
              { label: "Zona", val: prop.zona },
              prop.precio ? { label: "Precio", val: formatPrecio(prop.precio, prop.moneda) } : null,
            ].filter(Boolean).map(r => r && (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.cardBorder}`, fontSize: 13 }}>
                <span style={{ color: t.textMuted }}>{r.label}</span>
                <span style={{ color: t.text, fontWeight: 600 }}>{r.val}</span>
              </div>
            ))}
          </div>

          <Link href={`/web/${slug}`} style={{ display: "block", textAlign: "center", fontSize: 12, color: t.textMuted, padding: "8px 0" }}>
            ← Ver todas las propiedades
          </Link>
        </aside>
      </div>

      {/* Footer */}
      <footer className="p-footer">
        <div style={{ marginBottom: 6 }}>{tituloSitio.split(" ")[0]}. · Corredor Inmobiliario</div>
        <div style={{ fontSize: 10, color: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.4)" }}>
          Sitio creado con GFI® Grupo Foro Inmobiliario · Rosario, Argentina
        </div>
      </footer>
    </>
  );
}

// Gallery con navegación (client component incrustado)
import { GallerySection } from "./GallerySection";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const data = await getData(slug, id);
  if (!data) return {};
  const { prop, cfg, perfil } = data;
  const title = `${prop.titulo} · ${cfg.titulo_sitio || `${perfil.nombre} ${perfil.apellido}`}`;
  const description = prop.descripcion?.slice(0, 160) ?? `${prop.tipo} en ${prop.operacion} en ${prop.ciudad}.`;
  const url = `https://foroinmobiliario.com.ar/web/${slug}/propiedad/${id}`;
  const image = prop.fotos?.[0] ?? null;
  return {
    title,
    description,
    openGraph: {
      title, description, url, type: "website" as const,
      ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image" as const, title, description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
