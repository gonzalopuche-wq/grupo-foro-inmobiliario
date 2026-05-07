import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { PrintButton } from "./PrintButton";

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
      superficie_cubierta, superficie_total, cocheras, ambientes,
      antiguedad, piso, orientacion, amenities, observaciones,
      fotos, estado, expensas, precio_expensas_moneda,
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
            {prop.cocheras && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.cocheras}</div>
                <div className="ficha-spec-label">Cocheras</div>
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
