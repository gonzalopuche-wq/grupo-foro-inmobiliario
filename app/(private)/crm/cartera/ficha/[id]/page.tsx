import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { PrintButton } from "./PrintButton";
import { PostRedesButton } from "./PostRedesButton";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Props {
  params: Promise<{ id: string }>;
}

async function getData(id: string) {
  const { data: prop } = await supabase
    .from("cartera_propiedades")
    .select(`
      id, titulo, descripcion, operacion, tipo, precio, moneda,
      ciudad, zona, direccion, dormitorios, banos, toilettes,
      superficie_cubierta, superficie_total, estacionamientos, con_cochera, ambientes,
      antiguedad, piso, orientacion, amenities, observaciones,
      fotos, estado, expensas, precio_expensas_moneda,
      video_url, tour_virtual_url, vistas, publicada_web, created_at,
      perfil:perfiles(nombre, apellido, matricula, telefono, email, foto_url, inmobiliaria)
    `)
    .eq("id", id)
    .single();

  return prop;
}

const fmtPrecio = (p: number | null, m: string) => {
  if (!p) return "A consultar";
  return m === "USD" ? `USD ${p.toLocaleString("es-AR")}` : `$ ${p.toLocaleString("es-AR")}`;
};

export default async function FichaPage({ params }: Props) {
  const { id } = await params;
  const prop = await getData(id);
  if (!prop) return notFound();

  const perfil = (prop.perfil as any) ?? {};
  const fotos: string[] = prop.fotos ?? [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { background: #f5f5f5; }
        body { font-family: 'Inter', sans-serif; }
        a { text-decoration: none; color: inherit; }

        .toolbar { padding: 0 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .toolbar-back { color: rgba(255,255,255,0.4); font-size: 12px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.08em; text-decoration: none; transition: color 0.15s; }
        .toolbar-back:hover { color: #fff; }
        .toolbar-title { color: rgba(255,255,255,0.25); font-size: 11px; font-family: 'Montserrat',sans-serif; letter-spacing: 0.12em; text-transform: uppercase; }
        .toolbar-actions { display: flex; gap: 10px; align-items: center; }

        .ficha { max-width: 800px; margin: 0 auto 64px; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 40px rgba(0,0,0,0.15); }

        /* Photo gallery */
        .ficha-fotos { position: relative; height: 340px; background: #e5e5e5; overflow: hidden; }
        .ficha-foto-main { width: 100%; height: 100%; object-fit: cover; }
        .ficha-foto-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 64px; background: #e8e8e8; }
        .ficha-op-badge { position: absolute; top: 16px; left: 16px; background: #cc0000; color: #fff; padding: 5px 14px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .ficha-tipo-badge { position: absolute; top: 16px; left: 90px; background: rgba(0,0,0,0.6); color: #fff; padding: 5px 14px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; }
        .ficha-fotos-strip { position: absolute; bottom: 12px; right: 12px; display: flex; gap: 6px; }
        .ficha-foto-thumb { width: 64px; height: 48px; object-fit: cover; border-radius: 4px; border: 2px solid #fff; opacity: 0.85; }

        /* Body */
        .ficha-body { padding: 28px 32px; }
        .ficha-precio { font-family: 'Montserrat',sans-serif; font-size: 28px; font-weight: 800; color: #cc0000; margin-bottom: 6px; }
        .ficha-expensas { font-size: 13px; color: #666; margin-bottom: 4px; }
        .ficha-titulo { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 700; color: #111; margin-bottom: 4px; }
        .ficha-ubicacion { font-size: 13px; color: #666; display: flex; align-items: center; gap: 6px; margin-bottom: 20px; }

        /* Specs grid */
        .ficha-specs { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .ficha-spec { background: #f8f8f8; border: 1px solid #eee; border-radius: 8px; padding: 12px 14px; }
        .ficha-spec-val { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #111; }
        .ficha-spec-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'Montserrat',sans-serif; font-weight: 700; margin-top: 2px; }

        /* Divider */
        .ficha-divider { border: none; border-top: 1px solid #eee; margin: 20px 0; }

        /* Description */
        .ficha-section-title { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #999; margin-bottom: 10px; }
        .ficha-desc { font-size: 13px; color: #444; line-height: 1.75; white-space: pre-line; }

        /* Amenities */
        .ficha-amenities { display: flex; flex-wrap: wrap; gap: 8px; }
        .ficha-amenity { padding: 5px 12px; background: #f0f0f0; border-radius: 20px; font-size: 11px; color: #555; font-weight: 600; }

        /* Corredor card */
        .ficha-corredor { display: flex; align-items: center; gap: 16px; background: #0a0a0a; color: #fff; border-radius: 10px; padding: 20px 24px; margin-top: 24px; }
        .ficha-corredor-avatar { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.25); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #cc0000; overflow: hidden; }
        .ficha-corredor-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ficha-corredor-info { flex: 1; }
        .ficha-corredor-nombre { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; }
        .ficha-corredor-mat { font-size: 11px; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; letter-spacing: 0.08em; margin-top: 2px; }
        .ficha-corredor-contacto { display: flex; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
        .ficha-corredor-link { font-size: 12px; color: rgba(255,255,255,0.6); padding: 5px 12px; background: rgba(255,255,255,0.07); border-radius: 5px; transition: background 0.15s; }
        .ficha-corredor-link:hover { background: rgba(255,255,255,0.12); }
        .ficha-gfi { text-align: center; margin-top: 20px; font-size: 10px; color: #bbb; font-family: 'Montserrat',sans-serif; letter-spacing: 0.12em; }

        /* Google Maps embed */
        .ficha-mapa { margin-top: 24px; border-radius: 10px; overflow: hidden; border: 1px solid #eee; }
        .ficha-mapa iframe { display: block; width: 100%; height: 240px; border: 0; }
        .ficha-mapa-label { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #999; padding: 10px 0 6px; }

        /* Tour virtual 360° */
        .ficha-tour { margin-top: 24px; border-radius: 10px; overflow: hidden; border: 2px solid #cc0000; position: relative; }
        .ficha-tour-label { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #cc0000; padding: 10px 0 6px; display: flex; align-items: center; gap: 6px; }
        .ficha-tour iframe { display: block; width: 100%; height: 400px; border: 0; }

        @media (max-width: 640px) {
          .ficha-body { padding: 20px 16px; }
          .ficha-fotos { height: 240px; }
          .ficha-corredor { flex-direction: column; align-items: flex-start; }
        }

        @media print {
          .toolbar { display: none; }
          html, body { background: #fff; }
          .ficha { margin: 0; box-shadow: none; border-radius: 0; max-width: 100%; }
          .ficha-corredor-link { background: #eee !important; color: #333 !important; }
        }
      `}</style>

      {/* Toolbar (non-print) */}
      <div className="toolbar">
        <a href="/cartera" className="toolbar-back">← Volver a mi cartera</a>
        <div className="toolbar-title">Ficha de propiedad</div>
        <div className="toolbar-actions">
          <PostRedesButton propiedadId={prop.id} />
          <PrintButton />
        </div>
      </div>

      <div className="ficha">
        {/* Fotos */}
        <div className="ficha-fotos">
          {fotos.length > 0
            ? <img src={fotos[0]} alt={prop.titulo} className="ficha-foto-main" />
            : <div className="ficha-foto-placeholder">🏠</div>}
          <div className="ficha-op-badge">{prop.operacion}</div>
          <div className="ficha-tipo-badge">{prop.tipo}</div>
          {fotos.length > 1 && (
            <div className="ficha-fotos-strip">
              {fotos.slice(1, 4).map((f, i) => (
                <img key={i} src={f} alt="" className="ficha-foto-thumb" />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="ficha-body">
          <div className="ficha-precio">{fmtPrecio(prop.precio, prop.moneda)}</div>
          {prop.expensas && (
            <div className="ficha-expensas">
              + Expensas: {fmtPrecio(prop.expensas, prop.precio_expensas_moneda ?? "ARS")}
            </div>
          )}
          <div className="ficha-titulo">{prop.titulo}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            {(prop as any).publicada_web && (
              <span style={{ fontSize: 11, padding: "2px 10px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4, color: "#22c55e", fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>
                🌐 Publicada en web
              </span>
            )}
            {(prop as any).vistas > 0 && (
              <span style={{ fontSize: 11, padding: "2px 10px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 4, color: "#a78bfa", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
                👁 {(prop as any).vistas} vista{(prop as any).vistas !== 1 ? "s" : ""}
              </span>
            )}
            {(prop as any).created_at && (
              <span style={{ fontSize: 11, color: "#aaa" }}>
                Cargada el {new Date((prop as any).created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <div className="ficha-ubicacion">
            <span>📍</span>
            {[prop.direccion, prop.zona, prop.ciudad].filter(Boolean).join(", ")}
          </div>

          {/* Specs */}
          <div className="ficha-specs">
            {prop.superficie_cubierta && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.superficie_cubierta} m²</div>
                <div className="ficha-spec-label">Cub.</div>
              </div>
            )}
            {prop.superficie_total && prop.superficie_total !== prop.superficie_cubierta && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.superficie_total} m²</div>
                <div className="ficha-spec-label">Total</div>
              </div>
            )}
            {prop.ambientes && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.ambientes}</div>
                <div className="ficha-spec-label">Ambientes</div>
              </div>
            )}
            {prop.dormitorios && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.dormitorios}</div>
                <div className="ficha-spec-label">Dormitorios</div>
              </div>
            )}
            {prop.banos && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.banos}</div>
                <div className="ficha-spec-label">Baños</div>
              </div>
            )}
            {(prop.con_cochera || prop.estacionamientos) && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.estacionamientos ?? 1}</div>
                <div className="ficha-spec-label">Cochera{(prop.estacionamientos ?? 1) > 1 ? "s" : ""}</div>
              </div>
            )}
            {prop.piso && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.piso}°</div>
                <div className="ficha-spec-label">Piso</div>
              </div>
            )}
            {prop.antiguedad !== null && prop.antiguedad !== undefined && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.antiguedad === 0 ? "A ★" : `${prop.antiguedad}a`}</div>
                <div className="ficha-spec-label">Antigüedad</div>
              </div>
            )}
          </div>

          {/* Descripción */}
          {prop.descripcion && (
            <>
              <hr className="ficha-divider" />
              <div className="ficha-section-title">Descripción</div>
              <p className="ficha-desc">{prop.descripcion}</p>
            </>
          )}

          {/* Amenities */}
          {prop.amenities && (prop.amenities as string[]).length > 0 && (
            <>
              <hr className="ficha-divider" />
              <div className="ficha-section-title">Amenities</div>
              <div className="ficha-amenities">
                {(prop.amenities as string[]).map((a: string) => (
                  <span key={a} className="ficha-amenity">{a}</span>
                ))}
              </div>
            </>
          )}

          {/* Observaciones */}
          {prop.observaciones && (
            <>
              <hr className="ficha-divider" />
              <div className="ficha-section-title">Observaciones internas</div>
              <p className="ficha-desc" style={{ color: "#888", fontStyle: "italic" }}>{prop.observaciones}</p>
            </>
          )}

          {/* Video YouTube */}
          {prop.video_url && (() => {
            const m = prop.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
            if (!m) return null;
            return (
              <>
                <hr className="ficha-divider" />
                <div className="ficha-tour-label">🎬 Video de la propiedad</div>
                <div className="ficha-tour">
                  <iframe
                    src={`https://www.youtube.com/embed/${m[1]}`}
                    allowFullScreen
                    title="Video de la propiedad"
                  />
                </div>
              </>
            );
          })()}

          {/* Tour Virtual 360° */}
          {(prop as any).tour_virtual_url && (
            <>
              <hr className="ficha-divider" />
              <div className="ficha-tour-label">🔮 Recorrida Virtual 360°</div>
              <div className="ficha-tour">
                <iframe
                  src={(prop as any).tour_virtual_url}
                  allowFullScreen
                  title="Tour virtual 360°"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </>
          )}

          {/* Links de portales */}
          {(() => {
            const p = prop as any;
            const links = [
              p.link_zonaprop && { label: "ZonaProp", url: p.link_zonaprop },
              p.link_argenprop && { label: "Argenprop", url: p.link_argenprop },
              p.link_mercadolibre && { label: "MercadoLibre", url: p.link_mercadolibre },
              p.link_tokko && { label: "Tokko Broker", url: p.link_tokko },
            ].filter(Boolean) as { label: string; url: string }[];
            if (!links.length) return null;
            return (
              <>
                <hr className="ficha-divider" />
                <div className="ficha-section-title">Publicada en portales</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {links.map(l => (
                    <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                      style={{ padding: "6px 14px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 6, fontSize: 12, fontWeight: 700, color: "#60a5fa", fontFamily: "Montserrat,sans-serif", textDecoration: "none" }}>
                      🔗 {l.label}
                    </a>
                  ))}
                </div>
              </>
            );
          })()}

          {/* Google Maps */}
          {(prop.direccion || prop.ciudad) && (() => {
            const q = encodeURIComponent([prop.direccion, prop.zona, prop.ciudad, "Argentina"].filter(Boolean).join(", "));
            return (
              <>
                <hr className="ficha-divider" />
                <div className="ficha-mapa-label">Ubicación en mapa</div>
                <div className="ficha-mapa">
                  <iframe
                    src={`https://maps.google.com/maps?q=${q}&output=embed&z=15`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación de la propiedad"
                  />
                </div>
              </>
            );
          })()}

          {/* Corredor */}
          <div className="ficha-corredor">
            <div className="ficha-corredor-avatar">
              {perfil.foto_url
                ? <img src={perfil.foto_url} alt={perfil.nombre} />
                : `${perfil.nombre?.charAt(0) ?? ""}${perfil.apellido?.charAt(0) ?? ""}`}
            </div>
            <div className="ficha-corredor-info">
              <div className="ficha-corredor-nombre">{perfil.nombre} {perfil.apellido}</div>
              <div className="ficha-corredor-mat">
                {perfil.inmobiliaria && `${perfil.inmobiliaria} · `}
                {perfil.matricula ? `Mat. ${perfil.matricula} · COCIR` : "Corredor Inmobiliario · COCIR"}
              </div>
              <div className="ficha-corredor-contacto">
                {perfil.telefono && (
                  <a href={`https://wa.me/${(perfil.telefono as string).replace(/\D/g, "")}`} className="ficha-corredor-link">
                    💬 {perfil.telefono}
                  </a>
                )}
                {perfil.email && (
                  <a href={`mailto:${perfil.email}`} className="ficha-corredor-link">
                    ✉️ {perfil.email}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="ficha-gfi">GFI® GRUPO FORO INMOBILIARIO · Rosario, Argentina</div>
        </div>
      </div>
    </>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const prop = await getData(id);
  if (!prop) return {};
  return {
    title: `${prop.titulo} · GFI®`,
    robots: { index: false },
  };
}
