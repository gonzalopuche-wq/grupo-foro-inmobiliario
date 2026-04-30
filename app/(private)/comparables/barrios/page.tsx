"use client";

import { useState } from "react";

const BARRIOS_DATA = [
  { barrio: "Palermo", zona: "CABA", m2_venta_usd: 2800, m2_alquiler_ars: 1800, tendencia: "estable", demanda: "alta", perfil: "Jóvenes profesionales, familias" },
  { barrio: "Recoleta", zona: "CABA", m2_venta_usd: 3200, m2_alquiler_ars: 2100, tendencia: "alza", demanda: "alta", perfil: "Familias, profesionales AA" },
  { barrio: "Belgrano", zona: "CABA", m2_venta_usd: 2600, m2_alquiler_ars: 1600, tendencia: "estable", demanda: "alta", perfil: "Familias con hijos" },
  { barrio: "Villa Crespo", zona: "CABA", m2_venta_usd: 2100, m2_alquiler_ars: 1400, tendencia: "alza", demanda: "media", perfil: "Jóvenes, artistas, startups" },
  { barrio: "Caballito", zona: "CABA", m2_venta_usd: 1900, m2_alquiler_ars: 1300, tendencia: "estable", demanda: "media", perfil: "Familias clase media" },
  { barrio: "Flores", zona: "CABA", m2_venta_usd: 1600, m2_alquiler_ars: 1100, tendencia: "baja", demanda: "media", perfil: "Familias, comerciantes" },
  { barrio: "San Telmo", zona: "CABA", m2_venta_usd: 2000, m2_alquiler_ars: 1500, tendencia: "alza", demanda: "media", perfil: "Turistas, artistas, expats" },
  { barrio: "Puerto Madero", zona: "CABA", m2_venta_usd: 5500, m2_alquiler_ars: 3500, tendencia: "estable", demanda: "baja", perfil: "Ejecutivos, inversores" },
  { barrio: "Núñez", zona: "CABA", m2_venta_usd: 2400, m2_alquiler_ars: 1550, tendencia: "estable", demanda: "alta", perfil: "Familias, universitarios" },
  { barrio: "Almagro", zona: "CABA", m2_venta_usd: 1800, m2_alquiler_ars: 1200, tendencia: "alza", demanda: "media", perfil: "Jóvenes, estudiantes" },
  { barrio: "Boedo", zona: "CABA", m2_venta_usd: 1700, m2_alquiler_ars: 1150, tendencia: "estable", demanda: "media", perfil: "Familias, clase media" },
  { barrio: "Villa Urquiza", zona: "CABA", m2_venta_usd: 2200, m2_alquiler_ars: 1450, tendencia: "alza", demanda: "alta", perfil: "Familias, residencial tranquilo" },
  { barrio: "Colegiales", zona: "CABA", m2_venta_usd: 2300, m2_alquiler_ars: 1480, tendencia: "alza", demanda: "alta", perfil: "Jóvenes profesionales, estudiantes" },
  { barrio: "Microcentro", zona: "CABA", m2_venta_usd: 1400, m2_alquiler_ars: 900, tendencia: "baja", demanda: "baja", perfil: "Oficinas, inversores" },
  { barrio: "La Boca", zona: "CABA", m2_venta_usd: 1200, m2_alquiler_ars: 800, tendencia: "estable", demanda: "baja", perfil: "Turismo, inversión artística" },
  { barrio: "Tigre Centro", zona: "GBA Norte", m2_venta_usd: 1400, m2_alquiler_ars: 900, tendencia: "alza", demanda: "media", perfil: "Familias, segunda residencia" },
  { barrio: "San Isidro", zona: "GBA Norte", m2_venta_usd: 2800, m2_alquiler_ars: 1700, tendencia: "estable", demanda: "alta", perfil: "Familias AA, ejecutivos" },
  { barrio: "Vicente López", zona: "GBA Norte", m2_venta_usd: 2600, m2_alquiler_ars: 1600, tendencia: "estable", demanda: "alta", perfil: "Familias, profesionales" },
  { barrio: "Olivos", zona: "GBA Norte", m2_venta_usd: 2400, m2_alquiler_ars: 1500, tendencia: "alza", demanda: "alta", perfil: "Familias, diplomaticos" },
  { barrio: "Quilmes Centro", zona: "GBA Sur", m2_venta_usd: 1100, m2_alquiler_ars: 750, tendencia: "baja", demanda: "media", perfil: "Familias clase media/baja" },
  { barrio: "Avellaneda", zona: "GBA Sur", m2_venta_usd: 1000, m2_alquiler_ars: 700, tendencia: "baja", demanda: "media", perfil: "Trabajadores, familias" },
  { barrio: "Lomas de Zamora", zona: "GBA Sur", m2_venta_usd: 900, m2_alquiler_ars: 650, tendencia: "estable", demanda: "media", perfil: "Familias, clase media" },
  { barrio: "Morón", zona: "GBA Oeste", m2_venta_usd: 1200, m2_alquiler_ars: 800, tendencia: "estable", demanda: "media", perfil: "Familias clase media" },
  { barrio: "Ramos Mejía", zona: "GBA Oeste", m2_venta_usd: 1400, m2_alquiler_ars: 920, tendencia: "alza", demanda: "alta", perfil: "Familias, profesionales" },
];

const ZONAS = ["Todos", "CABA", "GBA Norte", "GBA Sur", "GBA Oeste"];

type SortKey = "m2_venta_usd_asc" | "m2_venta_usd_desc" | "m2_alquiler_ars_asc" | "m2_alquiler_ars_desc" | "demanda";

function TendenciaIcon({ t }: { t: string }) {
  if (t === "alza")   return <span style={{ color: "#22c55e", fontWeight: 700 }}>↑ alza</span>;
  if (t === "baja")   return <span style={{ color: "#ef4444", fontWeight: 700 }}>↓ baja</span>;
  return <span style={{ color: "#eab308", fontWeight: 700 }}>→ estable</span>;
}

function DemandaBadge({ d }: { d: string }) {
  const estilos: Record<string, { bg: string; border: string; color: string }> = {
    alta:  { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)",  color: "#22c55e" },
    media: { bg: "rgba(234,179,8,0.1)",  border: "rgba(234,179,8,0.3)",  color: "#eab308" },
    baja:  { bg: "rgba(120,120,120,0.1)", border: "rgba(120,120,120,0.3)", color: "#888" },
  };
  const s = estilos[d] ?? estilos.baja;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 9px",
      borderRadius: 12,
      fontSize: 10,
      fontFamily: "Montserrat,sans-serif",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "capitalize",
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
    }}>
      {d}
    </span>
  );
}

const DEMANDA_ORD: Record<string, number> = { alta: 0, media: 1, baja: 2 };

export default function BarriosPage() {
  const [busqueda, setBusqueda] = useState("");
  const [zona, setZona] = useState("Todos");
  const [orden, setOrden] = useState<SortKey>("m2_venta_usd_desc");
  const [expandido, setExpandido] = useState<string | null>(null);

  const filtrados = BARRIOS_DATA
    .filter(b => {
      if (zona !== "Todos" && b.zona !== zona) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        return b.barrio.toLowerCase().includes(q) || b.zona.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      switch (orden) {
        case "m2_venta_usd_asc":  return a.m2_venta_usd - b.m2_venta_usd;
        case "m2_venta_usd_desc": return b.m2_venta_usd - a.m2_venta_usd;
        case "m2_alquiler_ars_asc":  return a.m2_alquiler_ars - b.m2_alquiler_ars;
        case "m2_alquiler_ars_desc": return b.m2_alquiler_ars - a.m2_alquiler_ars;
        case "demanda": return (DEMANDA_ORD[a.demanda] ?? 2) - (DEMANDA_ORD[b.demanda] ?? 2);
        default: return 0;
      }
    });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .bar-wrap { display: flex; flex-direction: column; gap: 20px; }
        .bar-header { }
        .bar-titulo { font-family: 'Montserrat',sans-serif; font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; }
        .bar-titulo span { color: #cc0000; }
        .bar-sub { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .bar-controles { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .bar-search { flex: 1; min-width: 180px; padding: 9px 12px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .bar-search:focus { border-color: rgba(200,0,0,0.4); }
        .bar-search::placeholder { color: rgba(255,255,255,0.2); }
        .bar-select { padding: 9px 10px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; outline: none; font-family: 'Inter',sans-serif; cursor: pointer; }
        .bar-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .bar-chip { padding: 6px 14px; border-radius: 20px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); transition: all 0.2s; }
        .bar-chip.activo { background: rgba(200,0,0,0.1); border-color: rgba(200,0,0,0.4); color: #ff6666; }
        .bar-chip:hover:not(.activo) { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
        .bar-count { font-size: 11px; color: rgba(255,255,255,0.25); white-space: nowrap; align-self: center; }
        /* Tabla */
        .bar-tabla-wrap { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: auto; }
        .bar-tabla { width: 100%; border-collapse: collapse; min-width: 700px; }
        .bar-tabla thead tr { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); }
        .bar-tabla th { padding: 11px 14px; text-align: left; font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.25); white-space: nowrap; }
        .bar-tabla tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; cursor: pointer; }
        .bar-tabla tbody tr:last-child { border-bottom: none; }
        .bar-tabla tbody tr:hover { background: rgba(255,255,255,0.025); }
        .bar-tabla tbody tr.expandido-row { background: rgba(200,0,0,0.04); border-bottom: none; }
        .bar-tabla td { padding: 12px 14px; font-size: 13px; color: rgba(255,255,255,0.75); vertical-align: middle; }
        .bar-barrio-name { font-family: 'Montserrat',sans-serif; font-weight: 700; color: #fff; font-size: 13px; }
        .bar-zona-badge { font-family: 'Montserrat',sans-serif; font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); }
        .bar-precio { font-family: 'Montserrat',sans-serif; font-weight: 700; color: #60a5fa; }
        .bar-precio-alq { font-family: 'Montserrat',sans-serif; font-weight: 700; color: #a78bfa; }
        /* Detail card */
        .bar-detail-row td { padding: 0 14px 14px; }
        .bar-detail { background: rgba(200,0,0,0.04); border: 1px solid rgba(200,0,0,0.15); border-radius: 6px; padding: 14px 18px; display: flex; flex-direction: column; gap: 6px; }
        .bar-detail-label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 2px; }
        .bar-detail-value { font-size: 13px; color: rgba(255,255,255,0.7); }
        .bar-empty { padding: 60px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; }
        @media (max-width: 768px) {
          .bar-filters { flex-wrap: wrap; }
          .bar-tabla-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .bar-tabla th, .bar-tabla td { padding: 10px 8px; font-size: 11px; white-space: nowrap; }
        }
      `}</style>

      <div className="bar-wrap">
        {/* Header */}
        <div className="bar-header">
          <div className="bar-titulo">
            <span>📍</span>
            Consulta de <span>Barrios</span>
          </div>
          <div className="bar-sub" style={{ marginTop: 4 }}>
            Valores de referencia de mercado para Buenos Aires — datos orientativos
          </div>
        </div>

        {/* Controles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="bar-controles">
            <input
              className="bar-search"
              placeholder="Buscar barrio..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <select className="bar-select" value={orden} onChange={e => setOrden(e.target.value as SortKey)}>
              <option value="m2_venta_usd_desc">Precio venta ↓</option>
              <option value="m2_venta_usd_asc">Precio venta ↑</option>
              <option value="m2_alquiler_ars_desc">Precio alquiler ↓</option>
              <option value="m2_alquiler_ars_asc">Precio alquiler ↑</option>
              <option value="demanda">Demanda</option>
            </select>
            <span className="bar-count">{filtrados.length} barrio{filtrados.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="bar-chips">
            {ZONAS.map(z => (
              <button
                key={z}
                className={`bar-chip${zona === z ? " activo" : ""}`}
                onClick={() => setZona(z)}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="bar-tabla-wrap">
          {filtrados.length === 0 ? (
            <div className="bar-empty">No hay barrios con ese filtro.</div>
          ) : (
            <table className="bar-tabla">
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th>Zona</th>
                  <th>Venta USD/m²</th>
                  <th>Alquiler ARS/m²</th>
                  <th>Tendencia</th>
                  <th>Demanda</th>
                  <th>Perfil</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(b => {
                  const isOpen = expandido === b.barrio;
                  return (
                    <>
                      <tr
                        key={b.barrio}
                        className={isOpen ? "expandido-row" : ""}
                        onClick={() => setExpandido(isOpen ? null : b.barrio)}
                        title="Click para ver detalle"
                      >
                        <td>
                          <span className="bar-barrio-name">
                            {isOpen ? "▼ " : "▶ "}{b.barrio}
                          </span>
                        </td>
                        <td><span className="bar-zona-badge">{b.zona}</span></td>
                        <td>
                          <span className="bar-precio">
                            USD {b.m2_venta_usd.toLocaleString("es-AR")}
                          </span>
                        </td>
                        <td>
                          <span className="bar-precio-alq">
                            ARS {b.m2_alquiler_ars.toLocaleString("es-AR")}
                          </span>
                        </td>
                        <td><TendenciaIcon t={b.tendencia} /></td>
                        <td><DemandaBadge d={b.demanda} /></td>
                        <td style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.perfil}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${b.barrio}-detail`} className="bar-detail-row">
                          <td colSpan={7}>
                            <div className="bar-detail">
                              <div>
                                <div className="bar-detail-label">Perfil del barrio</div>
                                <div className="bar-detail-value">{b.perfil}</div>
                              </div>
                              <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginTop: 6 }}>
                                <div>
                                  <div className="bar-detail-label">Zona</div>
                                  <div className="bar-detail-value">{b.zona}</div>
                                </div>
                                <div>
                                  <div className="bar-detail-label">Precio venta</div>
                                  <div className="bar-detail-value" style={{ color: "#60a5fa" }}>USD {b.m2_venta_usd.toLocaleString("es-AR")} /m²</div>
                                </div>
                                <div>
                                  <div className="bar-detail-label">Precio alquiler</div>
                                  <div className="bar-detail-value" style={{ color: "#a78bfa" }}>ARS {b.m2_alquiler_ars.toLocaleString("es-AR")} /m²</div>
                                </div>
                                <div>
                                  <div className="bar-detail-label">Tendencia</div>
                                  <div className="bar-detail-value"><TendenciaIcon t={b.tendencia} /></div>
                                </div>
                                <div>
                                  <div className="bar-detail-label">Demanda</div>
                                  <div className="bar-detail-value"><DemandaBadge d={b.demanda} /></div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Disclaimer */}
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontStyle: "italic", textAlign: "center" }}>
          Datos de referencia orientativos. Los valores reales varían según ubicación exacta, estado y características del inmueble.
        </div>
      </div>
    </>
  );
}
