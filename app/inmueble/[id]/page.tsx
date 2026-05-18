import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import GaleriaFotos from "./GaleriaFotos";
import FichaAcciones from "./FichaAcciones";
import FichaContacto from "./FichaContacto";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Props { params: Promise<{ id: string }> }

async function getSimilares(id: string, tipo: string, operacion: string, ciudad: string | null, precio: number | null, moneda: string | null) {
  let q = sb
    .from("cartera_propiedades")
    .select("id, titulo, tipo, operacion, precio, moneda, ocultar_precio, ciudad, zona, superficie_cubierta, dormitorios, fotos, codigo")
    .neq("id", id)
    .eq("tipo", tipo)
    .eq("operacion", operacion)
    .in("estado", ["activa", "reservada"])
    .limit(4);
  if (ciudad) q = q.eq("ciudad", ciudad);
  if (precio && moneda) {
    q = q.gte("precio", precio * 0.6).lte("precio", precio * 1.4).eq("moneda", moneda);
  }
  const { data } = await q.order("created_at", { ascending: false });
  return data ?? [];
}

async function getProp(id: string) {
  const { data } = await sb
    .from("cartera_propiedades")
    .select(`
      id, titulo, descripcion, operacion, tipo, precio, moneda, expensas, moneda_expensas,
      ciudad, zona, direccion, direccion_orientativa,
      latitud, longitud, ocultar_precio, ocultar_ubicacion,
      dormitorios, banos, banos_servicio, ambientes, estacionamientos,
      superficie_cubierta, superficie_total, sup_semicubierta,
      sup_balcon, sup_patio_terraza, metros_frente, metros_fondo,
      antiguedad, condicion, disposicion, orientacion, luminosidad,
      piso, numero_unidad, pisos_edificio, anio_construccion,
      apto_credito, con_cochera, amoblado, acepta_mascotas,
      barrio_cerrado, uso_comercial, acepta_permuta,
      amb_balcon, amb_terraza, amb_patio, amb_jardin, amb_parrilla, amb_living,
      amb_comedor, amb_comedor_diario, amb_cocina, amb_estudio, amb_vestidor,
      amb_lavadero, amb_sotano, amb_roof_garden, amb_playroom, amb_dep_servicio, amb_dorm_suite,
      com_pileta, com_gimnasio, com_sum, com_salon_fiestas, com_sala_juegos,
      com_solarium, com_hidromasaje, com_jacuzzi, com_ascensor, com_seguridad,
      com_internet, com_aire_acondicionado, com_calefaccion, com_cowork,
      com_cancha_tenis, com_cancha_paddle, com_cancha_futbol, com_lavanderia,
      com_juegos_infantiles, com_estac_visitantes, com_quincho,
      tipo_piso, tipo_calefaccion, tipo_gas, tipo_vista, tipo_edificio, tipo_agua_caliente,
      tipo_cochera, situacion, tipo_cielorraso, tipo_acceso,
      uso_profesional, financia_vendedor,
      fotos, video_url, tour_virtual_url, planos, estado, codigo, created_at,
      perfil:perfiles(nombre, apellido, foto_url, matricula, telefono, email, instagram, inmobiliaria, whatsapp_negocio)
    `)
    .eq("id", id)
    .in("estado", ["activa", "reservada"])
    .single();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const prop = await getProp(id);
  if (!prop) return { title: "Propiedad no encontrada" };
  const p = prop as any;
  return {
    title: `${p.titulo} — ${p.tipo} en ${p.operacion}`,
    description: p.descripcion?.slice(0, 150) ?? `${p.tipo} en ${p.operacion} · ${p.ciudad}`,
    openGraph: {
      title: p.titulo,
      description: p.descripcion?.slice(0, 150) ?? `${p.tipo} en ${p.operacion}`,
      images: p.fotos?.[0] ? [p.fotos[0]] : [],
    },
  };
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function matterportId(url: string): string | null {
  const m = url.match(/my\.matterport\.com\/show\/\?m=([A-Za-z0-9]+)/);
  return m?.[1] ?? null;
}

const fmtNum = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
const fmtPrecio = (precio: number | null, moneda: string, ocultar: boolean) => {
  if (ocultar || !precio) return "A consultar";
  return moneda === "USD" ? `USD ${fmtNum(precio)}` : `$ ${fmtNum(precio)}`;
};

const OP_COLOR: Record<string, string> = { Venta: "#22c55e", Alquiler: "#60a5fa", "Alquiler temporal": "#f59e0b" };

const AMB_KEYS: [string, string][] = [
  ["amb_balcon","Balcón"], ["amb_terraza","Terraza"], ["amb_patio","Patio"], ["amb_jardin","Jardín"],
  ["amb_parrilla","Parrilla"], ["amb_living","Living"], ["amb_comedor","Comedor"],
  ["amb_comedor_diario","Comedor diario"], ["amb_cocina","Cocina"], ["amb_estudio","Estudio"],
  ["amb_vestidor","Vestidor"], ["amb_lavadero","Lavadero"], ["amb_sotano","Sótano"],
  ["amb_roof_garden","Roof garden"], ["amb_playroom","Playroom"], ["amb_dep_servicio","Dep. de servicio"],
  ["amb_dorm_suite","Dormitorio en suite"],
];
const COM_KEYS: [string, string][] = [
  ["com_pileta","Pileta"], ["com_gimnasio","Gimnasio"], ["com_sum","SUM"],
  ["com_salon_fiestas","Salón de fiestas"], ["com_sala_juegos","Sala de juegos"],
  ["com_solarium","Solarium"], ["com_hidromasaje","Hidromasaje"], ["com_jacuzzi","Jacuzzi"],
  ["com_ascensor","Ascensor"], ["com_seguridad","Seguridad"], ["com_internet","WiFi"],
  ["com_aire_acondicionado","Aire acondicionado"], ["com_calefaccion","Calefacción"],
  ["com_cowork","Cowork"], ["com_cancha_tenis","Cancha tenis"], ["com_cancha_paddle","Cancha paddle"],
  ["com_cancha_futbol","Cancha fútbol"], ["com_lavanderia","Lavandería"],
  ["com_juegos_infantiles","Juegos infantiles"], ["com_quincho","Quincho"],
];

export default async function InmueblePage({ params }: Props) {
  const { id } = await params;
  const prop = await getProp(id);
  if (!prop) return notFound();
  const p = prop as any;
  const similares = await getSimilares(id, p.tipo, p.operacion, p.ciudad, p.precio, p.moneda);

  const fotos: string[] = p.fotos ?? [];
  const perfil = p.perfil ?? {};

  const waRaw = perfil.whatsapp_negocio || perfil.telefono || "";
  const waNum = waRaw.replace(/\D/g, "");
  const waFull = waNum.startsWith("54") ? waNum : waNum ? `54${waNum}` : "";
  const waMsg = encodeURIComponent(`Hola, vi la propiedad "${p.titulo}" y me gustaría más información.`);
  const waLink = waFull ? `https://wa.me/${waFull}?text=${waMsg}` : null;

  const ubicacion = p.ocultar_ubicacion
    ? [p.direccion_orientativa, p.zona, p.ciudad].filter(Boolean).join(" · ")
    : [p.direccion, p.zona, p.ciudad].filter(Boolean).join(", ");

  const ambientes = AMB_KEYS.filter(([k]) => p[k]).map(([, l]) => l);
  const comodidades = COM_KEYS.filter(([k]) => p[k]).map(([, l]) => l);

  const specs: { label: string; value: string | number }[] = [
    p.ambientes != null && { label: "Ambientes", value: p.ambientes },
    p.dormitorios != null && { label: "Dormitorios", value: p.dormitorios },
    p.banos != null && { label: "Baños", value: p.banos },
    p.banos_servicio != null && { label: "Baños de servicio", value: p.banos_servicio },
    p.estacionamientos != null && { label: "Cocheras", value: p.estacionamientos },
    p.superficie_cubierta != null && { label: "Sup. cubierta", value: `${p.superficie_cubierta} m²` },
    p.superficie_total != null && { label: "Sup. total", value: `${p.superficie_total} m²` },
    p.sup_balcon != null && { label: "Balcón", value: `${p.sup_balcon} m²` },
    p.sup_patio_terraza != null && { label: "Patio/terraza", value: `${p.sup_patio_terraza} m²` },
    p.metros_frente != null && { label: "Frente", value: `${p.metros_frente} m` },
    p.metros_fondo != null && { label: "Fondo", value: `${p.metros_fondo} m` },
    p.piso && { label: "Piso", value: p.piso + (p.numero_unidad ? ` · Unidad ${p.numero_unidad}` : "") },
    p.pisos_edificio != null && { label: "Pisos en edificio", value: p.pisos_edificio },
    p.orientacion && { label: "Orientación", value: p.orientacion },
    p.disposicion && { label: "Disposición", value: p.disposicion },
    p.luminosidad && { label: "Luminosidad", value: p.luminosidad },
    p.condicion && { label: "Condición", value: p.condicion },
    p.antiguedad && { label: "Antigüedad", value: p.antiguedad.replace(/_/g, " ") },
    p.anio_construccion != null && { label: "Año", value: p.anio_construccion },
    p.tipo_piso && { label: "Tipo de piso", value: p.tipo_piso },
    p.tipo_calefaccion && { label: "Calefacción", value: p.tipo_calefaccion },
    p.tipo_agua_caliente && { label: "Agua caliente", value: p.tipo_agua_caliente },
    p.tipo_gas && { label: "Gas", value: p.tipo_gas },
    p.tipo_vista && { label: "Vista", value: p.tipo_vista },
    p.tipo_edificio && { label: "Tipo edificio", value: p.tipo_edificio },
    p.tipo_cochera && { label: "Cochera", value: p.tipo_cochera },
    p.situacion && { label: "Situación", value: p.situacion },
    p.tipo_cielorraso && { label: "Cielorraso", value: p.tipo_cielorraso },
    p.tipo_acceso && { label: "Acceso", value: p.tipo_acceso },
  ].filter(Boolean) as { label: string; value: string | number }[];

  const tags = [
    p.apto_credito && "Apto crédito",
    p.con_cochera && "Cochera",
    p.amoblado && "Amoblado",
    p.acepta_mascotas && "Acepta mascotas",
    p.barrio_cerrado && "Barrio cerrado",
    p.uso_comercial && "Uso comercial",
    p.uso_profesional && "Uso profesional",
    p.financia_vendedor && "Financia el vendedor",
    p.acepta_permuta && "Acepta permuta",
  ].filter(Boolean) as string[];

  const opColor = OP_COLOR[p.operacion] ?? "#fff";
  const reservada = p.estado === "reservada";

  const mapSrc = !p.ocultar_ubicacion && p.latitud && p.longitud
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${p.longitud - 0.008},${p.latitud - 0.005},${p.longitud + 0.008},${p.latitud + 0.005}&layer=mapnik&marker=${p.latitud},${p.longitud}`
    : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { background: #0a0a0a; }
        body { font-family: 'Inter', sans-serif; color: #fff; }
        .page { max-width: 960px; margin: 0 auto; padding: 0 16px 80px; }
        .ficha { background: #111; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; margin-top: 24px; }
        .ficha-body { padding: 28px 32px; }
        .ficha-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
        .ficha-titulo { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; color: #fff; line-height: 1.2; }
        .ficha-ubicacion { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 6px; display: flex; align-items: center; gap: 5px; }
        .ficha-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
        .badge { padding: 4px 12px; border-radius: 20px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
        .ficha-precio { font-family: 'Montserrat',sans-serif; font-size: 30px; font-weight: 800; color: #22c55e; margin-bottom: 4px; }
        .ficha-precio-reservada { font-size: 13px; color: #f59e0b; margin-top: 4px; }
        .ficha-expensas { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .ficha-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 22px 0; }
        .specs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
        .spec-item { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 10px 14px; }
        .spec-label { font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 4px; }
        .spec-value { font-size: 15px; font-family: 'Montserrat',sans-serif; font-weight: 800; color: #fff; }
        .section-title { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 14px; }
        .descripcion { font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.7; white-space: pre-wrap; }
        .tags { display: flex; gap: 8px; flex-wrap: wrap; }
        .tag { padding: 5px 13px; border-radius: 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); font-size: 11px; color: rgba(255,255,255,0.6); font-family: 'Montserrat',sans-serif; font-weight: 700; }
        .tag-v { border-color: rgba(34,197,94,0.3); color: #22c55e; background: rgba(34,197,94,0.06); }
        .chips { display: flex; gap: 7px; flex-wrap: wrap; }
        .chip { padding: 5px 12px; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); font-size: 11px; color: rgba(255,255,255,0.6); font-family: 'Inter',sans-serif; }
        .mapa-wrap { border-radius: 8px; overflow: hidden; margin-top: 16px; border: 1px solid rgba(255,255,255,0.1); }
        .mapa-wrap iframe { display: block; width: 100%; height: 280px; border: none; filter: invert(0.85) hue-rotate(180deg); }
        .agente-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px 24px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .agente-foto { width: 60px; height: 60px; border-radius: 10px; object-fit: cover; background: rgba(200,0,0,0.15); border: 2px solid rgba(200,0,0,0.2); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; overflow: hidden; }
        .agente-info { flex: 1; min-width: 0; }
        .agente-nombre { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .agente-sub { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 3px; }
        .agente-acciones { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn-wa { padding: 10px 20px; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); border-radius: 6px; color: #22c55e; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; text-decoration: none; letter-spacing: 0.1em; transition: all 0.15s; display: inline-block; }
        .btn-wa:hover { background: rgba(34,197,94,0.2); }
        .btn-email { padding: 10px 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: rgba(255,255,255,0.7); font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; text-decoration: none; letter-spacing: 0.1em; transition: all 0.15s; display: inline-block; }
        .btn-email:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .btn-tel { padding: 10px 20px; background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2); border-radius: 6px; color: #60a5fa; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; text-decoration: none; letter-spacing: 0.1em; display: inline-block; }
        .navbar { padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); max-width: 960px; margin: 0 auto; }
        .nav-logo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
        .nav-logo span { color: #cc0000; }
        .codigo-badge { font-size: 10px; color: rgba(255,255,255,0.2); font-family: 'Montserrat',sans-serif; font-weight: 700; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 4px; }
        @media (max-width: 640px) {
          .ficha-body { padding: 18px 16px; }
          .ficha-titulo { font-size: 17px; }
          .ficha-precio { font-size: 24px; }
          .specs-grid { grid-template-columns: repeat(2, 1fr); }
          .agente-card { padding: 14px; }
        }
      `}</style>

      <nav style={{ background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="navbar">
          <span className="nav-logo">Grupo Foro <span>Inmobiliario</span></span>
          {p.codigo && <span className="codigo-badge">#{p.codigo}</span>}
        </div>
      </nav>

      <main className="page">
        <div className="ficha">
          <GaleriaFotos fotos={fotos} />

          <div className="ficha-body">
            {/* Header */}
            <div className="ficha-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ficha-badges">
                  <span className="badge" style={{ background: `${opColor}20`, border: `1px solid ${opColor}50`, color: opColor }}>
                    {p.operacion}
                  </span>
                  <span className="badge" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                    {p.tipo}
                  </span>
                  {reservada && (
                    <span className="badge" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" }}>
                      RESERVADA
                    </span>
                  )}
                </div>
                <h1 className="ficha-titulo">{p.titulo}</h1>
                {ubicacion && <div className="ficha-ubicacion">📍 {ubicacion}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="ficha-precio">{fmtPrecio(p.precio, p.moneda, p.ocultar_precio)}</div>
                {p.expensas && !p.ocultar_precio && (
                  <div className="ficha-expensas">
                    + Expensas {p.moneda_expensas ?? "ARS"} {fmtNum(p.expensas)}/mes
                  </div>
                )}
              </div>
            </div>

            {/* Specs */}
            {specs.length > 0 && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Características</div>
                <div className="specs-grid">
                  {specs.map(s => (
                    <div key={s.label} className="spec-item">
                      <div className="spec-label">{s.label}</div>
                      <div className="spec-value">{s.value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Tags generales */}
            {tags.length > 0 && (
              <>
                <div style={{ marginTop: 16 }}>
                  <div className="tags">
                    {tags.map(t => <span key={t} className="tag tag-v">{t}</span>)}
                  </div>
                </div>
              </>
            )}

            {/* Ambientes / espacios */}
            {ambientes.length > 0 && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Espacios</div>
                <div className="chips">
                  {ambientes.map(a => <span key={a} className="chip">{a}</span>)}
                </div>
              </>
            )}

            {/* Comodidades */}
            {comodidades.length > 0 && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Comodidades</div>
                <div className="chips">
                  {comodidades.map(c => <span key={c} className="chip">{c}</span>)}
                </div>
              </>
            )}

            {/* Descripción */}
            {p.descripcion && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Descripción</div>
                <p className="descripcion">{p.descripcion}</p>
              </>
            )}

            {/* Video */}
            {p.video_url && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Video</div>
                {youtubeId(p.video_url) ? (
                  <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId(p.video_url)}`}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Video de la propiedad"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <a href={p.video_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textDecoration: "none" }}>
                    ▶ Ver video
                  </a>
                )}
              </>
            )}

            {/* Planos */}
            {p.planos && p.planos.length > 0 && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Planos</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                  {(p.planos as string[]).map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <img src={url} alt={`Plano ${i + 1}`}
                        style={{ width: "100%", display: "block", background: "#1a1a1a" }}
                        loading="lazy" />
                    </a>
                  ))}
                </div>
              </>
            )}

            {/* Tour virtual */}
            {p.tour_virtual_url && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Tour virtual 360°</div>
                {matterportId(p.tour_virtual_url) ? (
                  <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <iframe
                      src={`https://my.matterport.com/show/?m=${matterportId(p.tour_virtual_url)}`}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                      allowFullScreen
                      title="Tour virtual"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <a href={p.tour_virtual_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 6, color: "#60a5fa", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textDecoration: "none" }}>
                    🔭 Ver tour virtual
                  </a>
                )}
              </>
            )}

            {/* Mapa */}
            {mapSrc && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Ubicación</div>
                <div className="mapa-wrap">
                  <iframe src={mapSrc} loading="lazy" title="Mapa" />
                </div>
              </>
            )}

            {/* Agente */}
            {(perfil.nombre || perfil.apellido) && (
              <>
                <div className="ficha-divider" />
                <div className="section-title">Corredor a cargo</div>
                <div className="agente-card">
                  <div className="agente-foto">
                    {perfil.foto_url ? (
                      <img src={perfil.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : "👤"}
                  </div>
                  <div className="agente-info">
                    <div className="agente-nombre">{perfil.nombre} {perfil.apellido}</div>
                    <div className="agente-sub">
                      {perfil.inmobiliaria && <span>{perfil.inmobiliaria} · </span>}
                      {perfil.matricula && <span>Mat. {perfil.matricula}</span>}
                    </div>
                  </div>
                  <div className="agente-acciones">
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-wa">
                        💬 Consultar
                      </a>
                    )}
                    {waFull && (
                      <a href={`https://wa.me/${waFull}?text=${encodeURIComponent(`Hola, estoy interesado/a en la propiedad "${p.titulo}" y me gustaría agendar una visita. ¿Cuándo estaría disponible?`)}`} target="_blank" rel="noopener noreferrer" className="btn-tel">
                        📅 Agendar visita
                      </a>
                    )}
                    {perfil.email && (
                      <a href={`mailto:${perfil.email}`} className="btn-email">
                        ✉ Email
                      </a>
                    )}
                    {perfil.telefono && !waFull && (
                      <a href={`tel:${perfil.telefono}`} className="btn-tel">
                        📞 Llamar
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

        {/* Formulario de contacto */}
        <div style={{ marginTop: 20 }}>
          <FichaContacto propiedadId={p.id} titulo={p.titulo} />
        </div>

        {/* Compartir */}
        <div style={{ marginTop: 16, padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <FichaAcciones
            titulo={p.titulo}
            waLink={waLink}
            waNum={waFull}
            waMsg={waMsg}
          />
        </div>

        {/* Propiedades similares */}
        {similares.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
              Propiedades similares
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
              {similares.map((s: any) => {
                const sf = s as any;
                const sprecio = sf.ocultar_precio || !sf.precio ? "A consultar"
                  : sf.moneda === "USD" ? `USD ${sf.precio.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                  : `$ ${sf.precio.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
                return (
                  <a key={sf.id} href={`/inmueble/${sf.id}`}
                    style={{ display: "block", background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden", textDecoration: "none", transition: "border-color 0.15s" }}>
                    <div style={{ height: 120, background: "#1a1a1a", overflow: "hidden" }}>
                      {sf.fotos?.[0]
                        ? <img src={sf.fotos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🏠</div>}
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sf.titulo}</div>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 800, color: "#22c55e" }}>{sprecio}</div>
                      {(sf.superficie_cubierta || sf.dormitorios) && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                          {sf.dormitorios != null && `${sf.dormitorios} dorm.`}
                          {sf.dormitorios != null && sf.superficie_cubierta != null && " · "}
                          {sf.superficie_cubierta != null && `${sf.superficie_cubierta} m²`}
                        </div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif" }}>
          Grupo Foro Inmobiliario · Rosario
        </div>
      </main>
    </>
  );
}
