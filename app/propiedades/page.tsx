import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PER_PAGE = 24;

const TIPOS_FILTER = [
  "Departamento", "Casa", "PH", "Local", "Oficina",
  "Terreno", "Cochera", "Galpón", "Chalet", "Cabaña",
];

interface SearchParams {
  op?: string; tipo?: string; ciudad?: string;
  dorm?: string; min?: string; max?: string;
  orden?: string; moneda?: string; page?: string;
}

interface Props { searchParams: Promise<SearchParams> }

async function buscar(sp: SearchParams) {
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const from = (page - 1) * PER_PAGE;

  let q = sb
    .from("cartera_propiedades")
    .select(
      "id,titulo,operacion,tipo,precio,precio_anterior,moneda,ocultar_precio,ciudad,zona,dormitorios,superficie_cubierta,fotos,codigo,estado,destacada_web",
      { count: "exact" }
    )
    .in("estado", ["activa", "reservada"]);

  if (sp.op && sp.op !== "todas") q = q.eq("operacion", sp.op);
  if (sp.tipo) q = q.eq("tipo", sp.tipo);
  if (sp.ciudad?.trim()) q = q.ilike("ciudad", `%${sp.ciudad.trim()}%`);
  if (sp.dorm) q = q.gte("dormitorios", parseInt(sp.dorm));
  const mon = sp.moneda ?? "USD";
  if (sp.min) q = q.gte("precio", parseInt(sp.min)).eq("moneda", mon);
  if (sp.max) q = q.lte("precio", parseInt(sp.max)).eq("moneda", mon);

  const ordenCol = sp.orden === "precio_asc" || sp.orden === "precio_desc" ? "precio" : "created_at";
  const asc = sp.orden === "precio_asc";
  if (!sp.orden || sp.orden === "recientes") {
    q = q.order("destacada_web", { ascending: false });
  }
  q = q.order(ordenCol, { ascending: asc, nullsFirst: false });

  q = q.range(from, from + PER_PAGE - 1);

  const { data, count } = await q;
  return { props: (data ?? []) as any[], total: count ?? 0, page };
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Propiedades en venta y alquiler — Grupo Foro Inmobiliario",
    description: "Buscá tu próxima propiedad en Rosario y la región. Departamentos, casas, PH, locales y terrenos en venta y alquiler.",
    openGraph: {
      title: "Propiedades en venta y alquiler — GFI®",
      description: "Buscá entre todas las propiedades publicadas por corredores matriculados del Grupo Foro Inmobiliario.",
      type: "website",
      locale: "es_AR",
    },
  };
}

const fmtNum = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
const fmtPrecio = (p: number | null, mon: string, ocultar: boolean) => {
  if (ocultar || !p) return "A consultar";
  return mon === "USD" ? `USD ${fmtNum(p)}` : `$ ${fmtNum(p)}`;
};
const OP_COLOR: Record<string, string> = {
  Venta: "#22c55e", Alquiler: "#60a5fa", "Alquiler temporal": "#f59e0b",
};

export default async function PropiedadesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { props, total, page } = await buscar(sp);
  const totalPages = Math.ceil(total / PER_PAGE);

  const buildUrl = (overrides: Partial<SearchParams>) => {
    const merged = { ...sp, ...overrides };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    const s = params.toString();
    return `/propiedades${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { background: #0a0a0a; }
        body { font-family: 'Inter', sans-serif; color: #fff; }
        .page { max-width: 1100px; margin: 0 auto; padding: 0 16px 80px; }
        .navbar { padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); max-width: 1100px; margin: 0 auto; }
        .nav-logo { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -0.02em; text-decoration: none; }
        .nav-logo span { color: #cc0000; }
        .filters { background: #111; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 18px 20px; margin: 20px 0; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
        .f-group { display: flex; flex-direction: column; gap: 5px; min-width: 130px; }
        .f-label { font-size: 9px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .f-select, .f-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-family: 'Inter',sans-serif; font-size: 13px; padding: 8px 10px; outline: none; height: 36px; }
        .f-select option { background: #1a1a1a; }
        .f-btn { padding: 8px 20px; background: #cc0000; border: none; border-radius: 6px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; cursor: pointer; height: 36px; white-space: nowrap; }
        .f-btn-clear { padding: 8px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.5); font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; cursor: pointer; height: 36px; text-decoration: none; display: inline-flex; align-items: center; }
        .results-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .results-count { font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4); }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
        .card { background: #111; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; text-decoration: none; display: block; transition: border-color 0.15s, transform 0.15s; }
        .card:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
        .card-img { height: 160px; background: #1a1a1a; overflow: hidden; position: relative; }
        .card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .card-img-placeholder { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 40px; }
        .card-reservada { position: absolute; top: 8px; left: 8px; background: rgba(245,158,11,0.9); color: #000; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; padding: 3px 8px; border-radius: 3px; }
        .card-body { padding: 12px 14px; }
        .card-badges { display: flex; gap: 5px; margin-bottom: 7px; flex-wrap: wrap; }
        .card-badge { padding: 2px 8px; border-radius: 12px; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; }
        .card-title { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
        .card-loc { font-size: 11px; color: rgba(255,255,255,0.4); margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .card-precio-ant { font-size: 11px; color: rgba(255,255,255,0.3); text-decoration: line-through; font-family: 'Montserrat',sans-serif; margin-bottom: 1px; }
        .card-precio { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #22c55e; }
        .card-specs { display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
        .card-spec { font-size: 11px; color: rgba(255,255,255,0.4); }
        .pagination { display: flex; gap: 6px; justify-content: center; margin-top: 32px; flex-wrap: wrap; }
        .pag-btn { padding: 8px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.6); font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; text-decoration: none; }
        .pag-btn.active { background: #cc0000; border-color: #cc0000; color: #fff; }
        .pag-btn.disabled { opacity: 0.3; pointer-events: none; }
        .empty { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); }
        .empty-ico { font-size: 48px; margin-bottom: 16px; }
        .empty-txt { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 700; }
        @media (max-width: 640px) {
          .filters { gap: 8px; }
          .f-group { min-width: calc(50% - 5px); }
          .grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .card-img { height: 120px; }
        }
      `}</style>

      <nav style={{ background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="navbar">
          <a href="/" className="nav-logo">Grupo Foro <span>Inmobiliario</span></a>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
            {total > 0 ? `${fmtNum(total)} propiedades` : "Búsqueda"}
          </span>
        </div>
      </nav>

      <main className="page">
        <div style={{ paddingTop: 24 }}>
          <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            Propiedades
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
            Venta y alquiler en Rosario y la región
          </p>
        </div>

        {/* Filtros */}
        <form method="GET" action="/propiedades" className="filters">
          <div className="f-group">
            <label className="f-label">Operación</label>
            <select name="op" className="f-select" defaultValue={sp.op ?? ""}>
              <option value="">Todas</option>
              <option value="Venta">Venta</option>
              <option value="Alquiler">Alquiler</option>
              <option value="Alquiler temporal">Alquiler temporal</option>
            </select>
          </div>
          <div className="f-group">
            <label className="f-label">Tipo</label>
            <select name="tipo" className="f-select" defaultValue={sp.tipo ?? ""}>
              <option value="">Todos</option>
              {TIPOS_FILTER.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="f-group">
            <label className="f-label">Ciudad</label>
            <input name="ciudad" className="f-input" placeholder="Ej: Rosario" defaultValue={sp.ciudad ?? ""} style={{ width: "100%" }} />
          </div>
          <div className="f-group" style={{ minWidth: 90 }}>
            <label className="f-label">Dormitorios</label>
            <select name="dorm" className="f-select" defaultValue={sp.dorm ?? ""}>
              <option value="">Todos</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </div>
          <div className="f-group" style={{ minWidth: 80 }}>
            <label className="f-label">Moneda</label>
            <select name="moneda" className="f-select" defaultValue={sp.moneda ?? "USD"}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div className="f-group" style={{ minWidth: 110 }}>
            <label className="f-label">Precio mín</label>
            <input name="min" type="number" className="f-input" placeholder="50000" defaultValue={sp.min ?? ""} />
          </div>
          <div className="f-group" style={{ minWidth: 110 }}>
            <label className="f-label">Precio máx</label>
            <input name="max" type="number" className="f-input" placeholder="200000" defaultValue={sp.max ?? ""} />
          </div>
          <div className="f-group" style={{ minWidth: 130 }}>
            <label className="f-label">Ordenar</label>
            <select name="orden" className="f-select" defaultValue={sp.orden ?? "recientes"}>
              <option value="recientes">Más recientes</option>
              <option value="precio_asc">Precio: menor a mayor</option>
              <option value="precio_desc">Precio: mayor a menor</option>
            </select>
          </div>
          <button type="submit" className="f-btn">Buscar</button>
          {Object.values(sp).some(Boolean) && (
            <a href="/propiedades" className="f-btn-clear">Limpiar</a>
          )}
        </form>

        {/* Resultados */}
        <div className="results-header">
          <span className="results-count">
            {total === 0 ? "Sin resultados" : `${fmtNum(total)} propiedad${total !== 1 ? "es" : ""}`}
            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
          </span>
        </div>

        {props.length === 0 ? (
          <div className="empty">
            <div className="empty-ico">🔍</div>
            <div className="empty-txt">No encontramos propiedades con esos filtros</div>
            <a href="/propiedades" style={{ display: "inline-block", marginTop: 16, fontSize: 12, color: "#cc0000", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
              Ver todas las propiedades
            </a>
          </div>
        ) : (
          <div className="grid">
            {props.map((p: any) => {
              const opColor = OP_COLOR[p.operacion] ?? "#fff";
              return (
                <a key={p.id} href={`/inmueble/${p.id}`} className="card">
                  <div className="card-img">
                    {p.fotos?.[0]
                      ? <img src={p.fotos[0]} alt="" loading="lazy" />
                      : <div className="card-img-placeholder">🏠</div>}
                    {p.estado === "reservada" && <span className="card-reservada">RESERVADA</span>}
                    {p.destacada_web && p.estado !== "reservada" && (
                      <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(234,179,8,0.92)", color: "#000", fontFamily: "Montserrat,sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 3 }}>
                        ⭐ DESTACADA
                      </span>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="card-badges">
                      <span className="card-badge" style={{ background: `${opColor}20`, border: `1px solid ${opColor}50`, color: opColor }}>
                        {p.operacion}
                      </span>
                      <span className="card-badge" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                        {p.tipo}
                      </span>
                    </div>
                    <div className="card-title">{p.titulo}</div>
                    <div className="card-loc">
                      {[p.zona, p.ciudad].filter(Boolean).join(", ")}
                    </div>
                    {p.precio_anterior && !p.ocultar_precio && p.precio && p.precio_anterior > p.precio && (
                      <div className="card-precio-ant">{fmtPrecio(p.precio_anterior, p.moneda, false)}</div>
                    )}
                    <div className="card-precio">{fmtPrecio(p.precio, p.moneda, p.ocultar_precio)}</div>
                    {(p.dormitorios != null || p.superficie_cubierta != null) && (
                      <div className="card-specs">
                        {p.dormitorios != null && <span className="card-spec">🛏 {p.dormitorios} dorm.</span>}
                        {p.superficie_cubierta != null && <span className="card-spec">📐 {p.superficie_cubierta} m²</span>}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="pagination">
            <a href={buildUrl({ page: String(page - 1) })} className={`pag-btn${page <= 1 ? " disabled" : ""}`}>
              ← Anterior
            </a>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <a key={p} href={buildUrl({ page: String(p) })} className={`pag-btn${p === page ? " active" : ""}`}>
                  {p}
                </a>
              );
            })}
            <a href={buildUrl({ page: String(page + 1) })} className={`pag-btn${page >= totalPages ? " disabled" : ""}`}>
              Siguiente →
            </a>
          </div>
        )}

        <div style={{ marginTop: 48, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "Inter,sans-serif" }}>
          Grupo Foro Inmobiliario · Rosario
        </div>
      </main>
    </>
  );
}
