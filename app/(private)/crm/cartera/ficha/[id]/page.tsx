import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { PrintButton } from "./PrintButton";
import { PostRedesButton } from "./PostRedesButton";
import { PropiaPublicarButton } from "./PropiaPublicarButton";
import { QRLinkButton } from "./QRLinkButton";
import { CalculadoraRentabilidad } from "./CalculadoraRentabilidad";
import { AnalizarPrecioButton } from "./AnalizarPrecioButton";
import { HomeStagingIA } from "./HomeStagingIA";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Props {
  params: Promise<{ id: string }>;
}

interface HistorialPrecio {
  id: string;
  propiedad_id: string;
  precio: number;
  moneda: string;
  tipo: string;
  nota: string | null;
  created_at: string;
}

async function getData(id: string) {
  const { data: prop } = await supabase
    .from("cartera_propiedades")
    .select(`
      id, titulo, descripcion, operacion, tipo, precio, moneda, precio_anterior,
      ciudad, zona, direccion, dormitorios, banos, toilettes,
      superficie_cubierta, superficie_total, estacionamientos, con_cochera, ambientes,
      antiguedad, piso, orientacion, amenities, observaciones,
      fotos, estado, expensas, precio_expensas_moneda,
      video_url, tour_virtual_url, vistas, publicada_web, created_at,
      propia_id, propia_sync_at,
      perfil:perfiles(nombre, apellido, matricula, telefono, email, foto_url, inmobiliaria)
    `)
    .eq("id", id)
    .single();

  const { data: historialPrecios } = await supabase
    .from("historial_precios_cartera")
    .select("id, propiedad_id, precio, moneda, tipo, nota, created_at")
    .eq("propiedad_id", id)
    .order("created_at", { ascending: true });

  return { prop, historialPrecios: (historialPrecios ?? []) as HistorialPrecio[] };
}

const fmtPrecio = (p: number | null, m: string) => {
  if (!p) return "A consultar";
  return m === "USD" ? `USD ${p.toLocaleString("es-AR")}` : `$ ${p.toLocaleString("es-AR")}`;
};

export default async function FichaPage({ params }: Props) {
  const { id } = await params;
  const { prop, historialPrecios } = await getData(id);
  if (!prop) return notFound();

  const perfil = (prop.perfil as any) ?? {};
  const fotos: string[] = prop.fotos ?? [];

  // Build effective historial — use DB data, or synthesise from precio_anterior if empty
  const precioAnterior = (prop as any).precio_anterior as number | null | undefined;
  let historialEfectivo: HistorialPrecio[] = historialPrecios;
  if (historialEfectivo.length === 0 && precioAnterior && prop.precio) {
    historialEfectivo = [
      {
        id: "sintetico-1",
        propiedad_id: prop.id,
        precio: precioAnterior,
        moneda: prop.moneda ?? "USD",
        tipo: "inicial",
        nota: "Precio original",
        created_at: prop.created_at ?? new Date().toISOString(),
      },
      {
        id: "sintetico-2",
        propiedad_id: prop.id,
        precio: prop.precio,
        moneda: prop.moneda ?? "USD",
        tipo: prop.precio < precioAnterior ? "reduccion" : "aumento",
        nota: "Precio actual",
        created_at: new Date().toISOString(),
      },
    ];
  }

  return (
    <>
      <style>{`
        /* ── Cartera Ficha GFI ── */
        a { text-decoration: none; color: inherit; }

        .toolbar {
          padding: 0 0 18px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .toolbar-back {
          color: var(--gfi-text-muted); font-size: 9px; font-family: var(--font-display);
          font-weight: 700; letter-spacing: 0.18em; text-decoration: none;
          text-transform: uppercase; transition: var(--gfi-transition);
        }
        .toolbar-back:hover { color: var(--gfi-text-secondary); }
        .toolbar-crumb {
          color: var(--gfi-text-dim); font-size: 10px;
          font-family: var(--font-display); letter-spacing: 0.12em; text-transform: uppercase;
        }
        .toolbar-actions { display: flex; gap: 8px; align-items: center; }

        /* Ficha container */
        .ficha {
          max-width: 820px; margin: 0 auto 64px;
          background: var(--gfi-bg-card);
          border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-xl);
          overflow: hidden;
          box-shadow: var(--gfi-shadow-lg);
        }

        /* Photo gallery */
        .ficha-fotos { position: relative; height: 340px; background: var(--gfi-bg-secondary); overflow: hidden; }
        .ficha-foto-main { width: 100%; height: 100%; object-fit: cover; }
        .ficha-foto-placeholder {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
          font-size: 64px; background: var(--gfi-bg-elevated);
          color: var(--gfi-text-dim);
        }
        .ficha-op-badge {
          position: absolute; top: 16px; left: 16px;
          background: var(--gfi-red-gradient); color: #fff;
          padding: 5px 14px; border-radius: var(--gfi-radius-sm);
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          box-shadow: var(--gfi-shadow-red);
        }
        .ficha-tipo-badge {
          position: absolute; top: 16px; left: 104px;
          background: rgba(0,0,0,0.65); color: var(--gfi-text-secondary);
          padding: 5px 14px; border-radius: var(--gfi-radius-sm);
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          border: 1px solid var(--gfi-border);
        }
        .ficha-fotos-strip { position: absolute; bottom: 12px; right: 12px; display: flex; gap: 6px; }
        .ficha-foto-thumb {
          width: 64px; height: 48px; object-fit: cover;
          border-radius: var(--gfi-radius-sm); border: 2px solid var(--gfi-text-dim);
          opacity: 0.85; transition: opacity 0.15s;
        }
        .ficha-foto-thumb:hover { opacity: 1; }

        /* Body */
        .ficha-body { padding: 28px 32px; }

        /* Price header */
        .ficha-precio-block { margin-bottom: 12px; }
        .ficha-precio {
          font-family: var(--font-mono); font-size: 32px; font-weight: 700;
          color: var(--gfi-green-text); line-height: 1; letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .ficha-precio-ars {
          font-family: var(--font-mono); font-size: 32px; font-weight: 700;
          color: #d4960c; line-height: 1; letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .ficha-precio-consultar {
          font-family: var(--font-display); font-size: 20px; font-weight: 800;
          color: var(--gfi-text-secondary);
        }
        .ficha-expensas {
          font-size: 12px; color: var(--gfi-text-muted); margin-top: 5px;
          font-family: var(--font-mono);
        }
        .ficha-titulo {
          font-family: var(--font-display); font-size: 18px; font-weight: 800;
          color: var(--gfi-text-primary); margin-bottom: 5px; margin-top: 10px;
        }
        .ficha-ubicacion {
          font-size: 13px; color: var(--gfi-text-secondary);
          display: flex; align-items: center; gap: 6px; margin-bottom: 18px;
        }

        /* Meta badges row */
        .ficha-meta-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; align-items: center; }

        /* Specs grid */
        .ficha-specs {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(110px,1fr));
          gap: 10px; margin-bottom: 22px;
        }
        .ficha-spec {
          background: var(--gfi-bg-elevated); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md); padding: 12px 14px;
          transition: var(--gfi-transition);
        }
        .ficha-spec:hover { border-color: var(--gfi-border-bright); }
        .ficha-spec-val {
          font-family: var(--font-mono); font-size: 20px; font-weight: 700;
          color: var(--gfi-text-primary); font-variant-numeric: tabular-nums;
        }
        .ficha-spec-label {
          font-size: 9px; color: var(--gfi-text-muted);
          text-transform: uppercase; letter-spacing: 0.14em;
          font-family: var(--font-display); font-weight: 700; margin-top: 3px;
        }

        /* Section divider */
        .ficha-divider {
          border: none; border-top: 1px solid var(--gfi-border-subtle); margin: 20px 0;
        }
        .ficha-section-title {
          font-family: var(--font-display); font-size: 9px; font-weight: 800;
          letter-spacing: 0.24em; text-transform: uppercase; color: var(--gfi-text-muted);
          margin-bottom: 12px; display: flex; align-items: center; gap: 12px;
        }
        .ficha-section-title::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, var(--gfi-border) 0%, transparent 100%);
        }

        /* Description */
        .ficha-desc { font-size: 13px; color: var(--gfi-text-secondary); line-height: 1.75; white-space: pre-line; }

        /* Amenities */
        .ficha-amenities { display: flex; flex-wrap: wrap; gap: 7px; }
        .ficha-amenity {
          padding: 4px 12px; background: var(--gfi-bg-elevated);
          border: 1px solid var(--gfi-border); border-radius: 20px;
          font-size: 11px; color: var(--gfi-text-secondary); font-weight: 600;
        }

        /* Portal links */
        .portal-link {
          padding: 6px 14px; background: rgba(74,184,216,0.08);
          border: 1px solid rgba(74,184,216,0.22); border-radius: var(--gfi-radius-md);
          font-size: 11px; font-weight: 700; color: #4ab8d8;
          font-family: var(--font-display); text-decoration: none;
          transition: var(--gfi-transition);
        }
        .portal-link:hover { background: rgba(74,184,216,0.14); }

        /* Map */
        .ficha-mapa {
          margin-top: 20px; border-radius: var(--gfi-radius-md); overflow: hidden;
          border: 1px solid var(--gfi-border);
        }
        .ficha-mapa iframe { display: block; width: 100%; height: 230px; border: 0; }

        /* Tour */
        .ficha-tour {
          margin-top: 20px; border-radius: var(--gfi-radius-md); overflow: hidden;
          border: 2px solid var(--gfi-red-border);
        }
        .ficha-tour-label {
          font-family: var(--font-display); font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: var(--gfi-red);
          padding: 10px 0 6px; display: flex; align-items: center; gap: 6px;
        }
        .ficha-tour iframe { display: block; width: 100%; height: 400px; border: 0; }

        /* Historial de precios */
        .hist-container { margin-top: 0; }
        .hist-grafico {
          background: var(--gfi-bg-elevated); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-md); padding: 16px; margin-bottom: 14px;
        }
        .hist-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .hist-table th {
          text-align: left; padding: 7px 12px;
          font-family: var(--font-display); font-size: 9px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--gfi-text-muted);
          border-bottom: 1px solid var(--gfi-border);
        }
        .hist-table td {
          padding: 9px 12px; border-bottom: 1px solid var(--gfi-border-subtle);
          color: var(--gfi-text-secondary); vertical-align: middle;
        }
        .hist-table tr:last-child td { border-bottom: none; }
        .hist-table tbody tr:hover { background: var(--gfi-bg-secondary); }
        .hist-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; }
        .hist-badge-reduccion { background: rgba(58,186,182,0.12); color: var(--gfi-green-text); border: 1px solid rgba(58,186,182,0.25); }
        .hist-badge-aumento   { background: var(--gfi-red-soft); color: var(--gfi-red); border: 1px solid var(--gfi-red-border); }
        .hist-badge-inicial   { background: var(--gfi-border-subtle); color: var(--gfi-text-muted); border: 1px solid var(--gfi-border); }
        .hist-badge-actualizacion { background: rgba(167,139,250,0.10); color: #a78bfa; border: 1px solid rgba(167,139,250,0.25); }
        .hist-empty { font-size: 12px; color: var(--gfi-text-muted); font-style: italic; padding: 8px 0; }

        /* Calculadora */
        .calc-section {
          background: var(--gfi-bg-elevated); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg); padding: 20px 24px; margin-top: 0;
        }

        /* Corredor card */
        .ficha-corredor {
          display: flex; align-items: center; gap: 16px;
          background: var(--gfi-bg-elevated); border: 1px solid var(--gfi-border);
          border-radius: var(--gfi-radius-lg); padding: 20px 24px; margin-top: 22px;
          position: relative; overflow: hidden;
        }
        .ficha-corredor::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, var(--gfi-red) 0%, rgba(153,0,0,0.1) 60%, transparent 100%);
        }
        .ficha-corredor-avatar {
          width: 56px; height: 56px; border-radius: var(--gfi-radius-md);
          background: rgba(153,0,0,0.10); border: 1px solid var(--gfi-red-border);
          flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 16px; font-weight: 900;
          color: var(--gfi-red); overflow: hidden;
        }
        .ficha-corredor-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ficha-corredor-info { flex: 1; }
        .ficha-corredor-nombre {
          font-family: var(--font-display); font-size: 15px; font-weight: 800;
          color: var(--gfi-text-primary);
        }
        .ficha-corredor-mat {
          font-size: 11px; color: var(--gfi-text-muted);
          font-family: var(--font-display); letter-spacing: 0.06em; margin-top: 2px;
        }
        .ficha-corredor-contacto { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
        .ficha-corredor-link {
          font-size: 12px; color: var(--gfi-text-secondary);
          padding: 5px 12px; background: var(--gfi-border-subtle);
          border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-sm);
          transition: var(--gfi-transition);
        }
        .ficha-corredor-link:hover { background: var(--gfi-bg-hover); color: var(--gfi-text-primary); border-color: var(--gfi-border-bright); }

        .ficha-gfi {
          text-align: center; margin-top: 18px;
          font-size: 9px; color: var(--gfi-text-dim);
          font-family: var(--font-display); letter-spacing: 0.2em; text-transform: uppercase;
        }

        @media (max-width: 640px) {
          .ficha-body { padding: 18px 16px; }
          .ficha-fotos { height: 220px; }
          .ficha-corredor { flex-direction: column; align-items: flex-start; }
          .ficha-precio { font-size: 24px; }
        }

        @media print {
          .toolbar { display: none; }
          .ficha { margin: 0; box-shadow: none; border-radius: 0; max-width: 100%; background: #fff; border: none; }
          .ficha-body { color: #000; }
          .ficha-titulo, .ficha-precio { color: #000; }
          .ficha-spec { background: #f8f8f8; border-color: #ddd; }
          .ficha-spec-val { color: #000; }
          .ficha-corredor { background: #f0f0f0; border-color: #ddd; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="toolbar">
        <a href="/cartera" className="toolbar-back">← Volver a mi cartera</a>
        <div className="toolbar-crumb">Ficha de propiedad</div>
        <div className="toolbar-actions">
          <PropiaPublicarButton
            propiedadId={prop.id}
            propiaId={(prop as any).propia_id ?? null}
            propiaSyncAt={(prop as any).propia_sync_at ?? null}
            titulo={prop.titulo ?? ""}
            operacion={prop.operacion ?? "Venta"}
            precio={prop.precio ?? null}
            moneda={prop.moneda ?? "USD"}
            descripcion={prop.descripcion ?? null}
            direccion={prop.direccion ?? null}
            ciudad={prop.ciudad ?? null}
            zona={prop.zona ?? null}
            ambientes={prop.ambientes ?? null}
            dormitorios={prop.dormitorios ?? null}
            banos={prop.banos ?? null}
            superficieTotal={prop.superficie_total ?? null}
            superficieCubierta={prop.superficie_cubierta ?? null}
            fotos={prop.fotos ?? []}
          />
          <PostRedesButton propiedadId={prop.id} />
          <PrintButton />
        </div>
      </div>

      <div className="ficha">
        {/* Fotos */}
        <div className="ficha-fotos">
          {fotos.length > 0
            ? <img src={fotos[0]} alt={prop.titulo} className="ficha-foto-main" referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            : <div className="ficha-foto-placeholder">🏠</div>}
          <div className="ficha-op-badge">{prop.operacion}</div>
          <div className="ficha-tipo-badge">{prop.tipo}</div>
          {fotos.length > 1 && (
            <div className="ficha-fotos-strip">
              {fotos.slice(1, 4).map((f, i) => (
                <img key={i} src={f} alt="" className="ficha-foto-thumb" referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="ficha-body">
          {/* Precio */}
          <div className="ficha-precio-block">
            {!prop.precio ? (
              <div className="ficha-precio-consultar">A consultar</div>
            ) : (prop.moneda ?? "USD") === "USD" ? (
              <div className="ficha-precio">{fmtPrecio(prop.precio, prop.moneda ?? "USD")}</div>
            ) : (
              <div className="ficha-precio-ars">{fmtPrecio(prop.precio, prop.moneda ?? "ARS")}</div>
            )}
            {prop.expensas && (
              <div className="ficha-expensas">
                + Expensas: {fmtPrecio(prop.expensas, prop.precio_expensas_moneda ?? "ARS")}
              </div>
            )}
          </div>

          <div className="ficha-titulo">{prop.titulo}</div>

          {/* Meta badges */}
          <div className="ficha-meta-row">
            {(prop as any).publicada_web && (
              <span className="gfi-badge gfi-badge--green gfi-badge--dot">
                Publicada en web
              </span>
            )}
            {(prop as any).vistas > 0 && (
              <span className="gfi-badge gfi-badge--blue">
                👁 {(prop as any).vistas} vista{(prop as any).vistas !== 1 ? "s" : ""}
              </span>
            )}
            {(prop as any).created_at && (
              <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "var(--font-mono)" }}>
                {new Date((prop as any).created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            )}
          </div>

          <div className="ficha-ubicacion">
            <span>📍</span>
            <span>{[prop.direccion, prop.zona, prop.ciudad].filter(Boolean).join(", ")}</span>
          </div>

          {/* Specs */}
          <div className="ficha-specs">
            {prop.superficie_cubierta && (
              <div className="ficha-spec">
                <div className="ficha-spec-val">{prop.superficie_cubierta} m²</div>
                <div className="ficha-spec-label">Cubierta</div>
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
              <p className="ficha-desc" style={{ color: "var(--gfi-text-muted)", fontStyle: "italic" }}>{prop.observaciones}</p>
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
                  <iframe src={`https://www.youtube.com/embed/${m[1]}`} allowFullScreen title="Video de la propiedad" />
                </div>
              </>
            );
          })()}

          {/* Tour Virtual */}
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

          {/* Portal links */}
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
                    <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="portal-link">
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
                <div className="ficha-section-title">Ubicación en mapa</div>
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

          {/* Historial de precios */}
          <hr className="ficha-divider" />
          <div className="ficha-section-title">Historial de precios</div>
          <div className="hist-container">
            {historialEfectivo.length === 0 ? (
              <div className="hist-empty">Sin historial de cambios de precio</div>
            ) : (() => {
              const precios = historialEfectivo.map(h => h.precio);
              const minP = Math.min(...precios);
              const maxP = Math.max(...precios);
              const rango = maxP - minP || 1;
              const W = 600;
              const n = historialEfectivo.length;
              const barH = Math.min(26, Math.floor((100 - (n + 1) * 6) / n));
              const totalH = n * (barH + 6) + 6 + 20;
              const pad = 32;
              return (
                <>
                  <div className="hist-grafico">
                    <svg width="100%" viewBox={`0 0 ${W} ${totalH}`} style={{ display: "block", overflow: "visible" }}>
                      {historialEfectivo.map((h, i) => {
                        const barW = rango === 0
                          ? W - pad * 2
                          : ((h.precio - minP) / rango) * (W - pad * 2 - 80) + 40;
                        const y = 20 + i * (barH + 6);
                        const isLast = i === historialEfectivo.length - 1;
                        const color = h.tipo === "reduccion" ? "#3abab6"
                          : h.tipo === "aumento" ? "#990000"
                          : h.tipo === "inicial" ? "#4a5568"
                          : "#a78bfa";
                        const label = h.moneda === "USD"
                          ? `USD ${h.precio.toLocaleString("es-AR")}`
                          : `$ ${h.precio.toLocaleString("es-AR")}`;
                        return (
                          <g key={h.id}>
                            <rect x={pad} y={y} width={Math.max(barW, 4)} height={barH} rx={4}
                              fill={isLast ? "#990000" : color} opacity={isLast ? 1 : 0.55} />
                            <text x={pad + Math.max(barW, 4) + 8} y={y + barH / 2 + 4}
                              fontSize={11} fill={isLast ? "#990000" : "#8892a4"}
                              fontFamily="JetBrains Mono, monospace" fontWeight={isLast ? "700" : "500"}>
                              {label}
                            </text>
                          </g>
                        );
                      })}
                      {historialEfectivo.map((h, i) => {
                        const y = 20 + i * (barH + 6);
                        const fecha = new Date(h.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
                        return (
                          <text key={`lbl-${h.id}`} x={pad} y={y - 4} fontSize={9}
                            fill="#4a5568" fontFamily="Montserrat, sans-serif">{fecha}</text>
                        );
                      })}
                    </svg>
                  </div>
                  <table className="hist-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Precio</th>
                        <th>Tipo</th>
                        <th>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...historialEfectivo].reverse().map(h => (
                        <tr key={h.id}>
                          <td style={{ whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                            {new Date(h.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--gfi-text-primary)", fontSize: 13 }}>
                            {h.moneda === "USD"
                              ? `USD ${h.precio.toLocaleString("es-AR")}`
                              : `$ ${h.precio.toLocaleString("es-AR")}`}
                          </td>
                          <td>
                            <span className={`gfi-badge hist-badge hist-badge-${h.tipo}`}>
                              {h.tipo === "reduccion" ? "↓ Reducción"
                                : h.tipo === "aumento" ? "↑ Aumento"
                                : h.tipo === "inicial" ? "Inicial"
                                : "Actualización"}
                            </span>
                          </td>
                          <td style={{ color: "var(--gfi-text-muted)", fontStyle: h.nota ? "normal" : "italic", fontSize: 12 }}>
                            {h.nota ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()}
          </div>

          {/* Análisis de precio vs mercado */}
          <hr className="ficha-divider" />
          <div className="ficha-section-title">Análisis de precio vs mercado</div>
          <AnalizarPrecioButton propiedadId={prop.id} moneda={prop.moneda ?? "USD"} />

          {/* Home staging con IA */}
          <hr className="ficha-divider" />
          <div className="ficha-section-title">Home staging con IA</div>
          <HomeStagingIA propiedadId={prop.id} fotos={fotos} />

          {/* Calculadora de rentabilidad */}
          <hr className="ficha-divider" />
          <div className="ficha-section-title">Calculadora de rentabilidad</div>
          <div className="calc-section">
            <CalculadoraRentabilidad
              precioVenta={prop.precio ?? null}
              moneda={prop.moneda ?? "USD"}
              precioAlquiler={prop.operacion === "alquiler" ? (prop.precio ?? null) : null}
            />
          </div>

          {/* QR */}
          <QRLinkButton propiedadId={prop.id} titulo={prop.titulo ?? "Propiedad GFI"} />

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

          <div className="ficha-gfi">GFI® · Grupo Foro Inmobiliario · Rosario, Argentina</div>
        </div>
      </div>
    </>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { prop } = await getData(id);
  if (!prop) return {};
  return {
    title: `${prop.titulo} · GFI®`,
    robots: { index: false },
  };
}
