"use client";

import { useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

/* ── Ítems core (siempre arriba) ── */
const CRM_CORE: [string, string, string][] = [
  ["dashboard", "📊", "Dashboard"],
  ["contactos", "👥", "Contactos"],
  ["negocios",  "💼", "Negocios"],
  ["tareas",    "✅", "Tareas"],
  ["notas",     "📝", "Notas"],
];

/* ── Grupos temáticos ── */
const CRM_GRUPOS: { titulo: string; items: [string, string, string][] }[] = [
  {
    titulo: "Agenda",
    items: [
      ["/crm/hoy",              "🌅", "Hoy"],
      ["/agenda",               "📆", "Agenda"],
      ["/crm/agenda-semanal",   "📅", "Agenda Semanal"],
      ["/crm/agenda-visitas",   "📅", "Agenda Visitas"],
      ["/crm/agenda-tasaciones","📅", "Agenda Tasaciones"],
      ["/crm/visitas",          "🗓", "Visitas"],
      ["/crm/vencimientos",     "📅", "Vencimientos"],
      ["/crm/recordatorios",    "🔔", "Recordatorios"],
      ["/crm/campana-cumpleanos","🎂", "Cumpleaños"],
    ],
  },
  {
    titulo: "Propiedades",
    items: [
      ["/crm/cartera",          "🏠", "Cartera"],
      ["/crm/portales",         "🔗", "Portales"],
      ["/crm/propia",           "🏛️", "Propia MLS"],
      ["/crm/llaves",           "🔑", "Llaves"],
      ["/crm/tasacion",         "🏠", "Tasación"],
      ["/crm/ficha-propiedad",  "🏠", "Ficha Propiedad"],
      ["/crm/captacion",        "📝", "Captación"],
      ["/crm/analisis-captacion","🎣","Análisis Captación"],
      ["/crm/carga-masiva",     "📥", "Carga Masiva"],
      ["/crm/duplicados",       "🔍", "Duplicados"],
      ["/crm/emprendimientos",  "🏗️", "Emprendimientos"],
    ],
  },
  {
    titulo: "Ventas & Pipeline",
    items: [
      ["/crm/seguimiento",         "📡", "Seguimiento"],
      ["/crm/embudo",              "🔻", "Embudo"],
      ["/crm/pipeline-visual",     "🗂️", "Pipeline Visual"],
      ["/crm/pipeline-kanban",     "📋", "Kanban"],
      ["/crm/pipeline-velocity",   "⚡", "Velocity"],
      ["/crm/forecast",            "📊", "Forecast"],
      ["/crm/forecast-pipeline",   "📈", "Forecast Pipeline"],
      ["/crm/conversion",          "📊", "Conversión"],
      ["/crm/negociacion",         "🤝", "Negociación"],
      ["/crm/simulador-negociacion","🤝","Simulador"],
      ["/crm/checklist-cierre",    "✅", "Checklist Cierre"],
      ["/crm/post-cierre",         "📋", "Post-cierre"],
      ["/crm/escrituras",          "⚖️", "Escrituras"],
      ["/crm/contratos-activos",   "📋", "Contratos"],
      ["/crm/expediente",          "📁", "Expediente"],
      ["/crm/seguimiento-post-venta","🤝","Post-Venta"],
      ["/crm/seguimiento-ofertas", "🤝", "Seg. Ofertas"],
      ["/crm/win-loss",            "📊", "Win/Loss"],
      ["/crm/tiempo-venta",        "⏱️", "T. Mercado"],
    ],
  },
  {
    titulo: "Marketing",
    items: [
      ["/crm/smart-match",           "🎯", "Smart Match"],
      ["/crm/match-clientes",        "🎯", "Match Clientes"],
      ["/crm/campana-reactivacion",  "📣", "Reactivación"],
      ["/crm/campanas-marketing",    "📣", "Campañas"],
      ["/crm/whatsapp-templates",    "💬", "Templates WA"],
      ["/crm/plantillas-mensajes",   "💬", "Plantillas"],
      ["/crm/propuesta-comercial",   "📄", "Propuesta Comercial"],
      ["/crm/scripts",               "📞", "Scripts"],
      ["/crm/emails",                "✉️", "Emails"],
      ["/crm/firma",                 "✍️", "Firma"],
    ],
  },
  {
    titulo: "Clientes",
    items: [
      ["/crm/clientes-vip",        "💎", "VIP"],
      ["/crm/referidos",           "🤝", "Referidos"],
      ["/crm/alianzas",            "🤝", "Alianzas"],
      ["/crm/scoring",             "⭐", "Scoring"],
      ["/crm/red-contactos",       "🕸️", "Red Contactos"],
      ["/crm/retencion",           "🔄", "Retención"],
      ["/crm/onboarding",          "✅", "Onboarding"],
      ["/crm/competencia",         "🔎", "Competencia"],
      ["/crm/analisis-competencia","🔎", "Análisis Compet."],
    ],
  },
  {
    titulo: "Finanzas",
    items: [
      ["/crm/comisiones",           "💰", "Comisiones"],
      ["/crm/comisiones-split",     "💰", "Com. Split"],
      ["/crm/comisiones-pendientes","💰", "Com. Pendientes"],
      ["/crm/gestion-honorarios",   "💰", "Honorarios"],
      ["/crm/cobranzas",            "💳", "Cobranzas"],
      ["/crm/gastos",               "💸", "Gastos"],
      ["/crm/presupuesto-anual",    "💸", "Presupuesto"],
      ["/crm/revenue",              "💰", "Revenue"],
      ["/crm/proyeccion-ingresos",  "💰", "Proyección"],
      ["/crm/descuentos",           "📉", "Descuentos"],
    ],
  },
  {
    titulo: "Metas",
    items: [
      ["/crm/metas",             "🎯", "Metas"],
      ["/crm/metas-personales",  "🎯", "Metas Personales"],
      ["/crm/objetivos",         "🎯", "Objetivos"],
      ["/crm/objetivos-mensuales","🎯","Obj. Mensuales"],
      ["/crm/produccion",        "🏆", "Producción"],
      ["/crm/scorecard-semanal", "🏆", "Scorecard"],
    ],
  },
  {
    titulo: "Reportes",
    items: [
      ["/crm/actividad",              "⚡", "Actividad"],
      ["/crm/performance",            "📈", "Performance"],
      ["/crm/kpi-diario",             "📊", "KPI Diario"],
      ["/crm/reporte-semanal",        "📋", "Rep. Semanal"],
      ["/crm/reporte-mensual",        "📑", "Rep. Mensual"],
      ["/crm/reportes-propietarios",  "📑", "Rep. Propietarios"],
      ["/crm/estadisticas-captacion", "🎣", "Est. Captación"],
      ["/crm/mapa-calor",             "🗺️", "Mapa Calor"],
      ["/crm/analisis-zona",          "📍", "Análisis Zona"],
      ["/crm/zona",                   "📍", "Zona"],
      ["/crm/historial",              "📋", "Historial"],
      ["/crm/historial-operaciones",  "📋", "Hist. Operaciones"],
    ],
  },
  {
    titulo: "Documentos",
    items: [
      ["/crm/documentos",        "📋", "Documentos"],
      ["/crm/gestion-documentos","📁", "Gestión Docs"],
      ["/crm/base-conocimiento", "📚", "Base Conocimiento"],
    ],
  },
  {
    titulo: "Herramientas",
    items: [
      ["/crm/buscador",          "🔍", "Buscador"],
      ["/crm/comparador",        "🔍", "Comparador"],
      ["/crm/gestion-tareas",    "✅", "Gestión Tareas"],
      ["/crm/integraciones",     "🔗", "Integraciones"],
      ["/crm/configuracion",     "⚙️", "Configuración"],
    ],
  },
];

function CrmLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabActivo = searchParams.get("s") ?? "dashboard";
  const [abierto, setAbierto] = useState(true);

  // Detectar qué grupo tiene un ítem activo (para autoexpandir)
  const grupoActivo = CRM_GRUPOS.findIndex(g =>
    g.items.some(([href]) => pathname === href || (href !== "/crm" && pathname.startsWith(href)))
  );
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    if (grupoActivo >= 0) init[grupoActivo] = true;
    return init;
  });

  function toggleGrupo(idx: number) {
    setGruposAbiertos(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  function isCoreActivo(s: string) {
    if (pathname !== "/crm") return false;
    return s === "dashboard" ? tabActivo === "dashboard" : tabActivo === s;
  }

  function isLinkActivo(href: string) {
    return pathname === href || (href !== "/crm" && pathname.startsWith(href));
  }

  return (
    <>
      <style>{`
        .crm-root {
          display: flex;
          min-height: calc(100vh - 96px);
          margin: -24px -28px;
        }

        /* ── Sidebar ── */
        .crm-sb {
          flex-shrink: 0;
          background: rgba(5,5,5,0.99);
          border-right: 1px solid rgba(255,255,255,0.07);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: width 0.2s cubic-bezier(0.4,0,0.2,1);
          position: sticky;
          top: 0;
          height: 100vh;
          max-height: 100vh;
        }
        .crm-sb.open  { width: 224px; }
        .crm-sb.close { width: 36px; }

        /* Header */
        .crm-sb-head {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px 0 12px;
          height: 44px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .crm-sb.close .crm-sb-head { justify-content: center; padding: 0; }

        .crm-sb-head-lbl {
          font-family: 'Montserrat',sans-serif;
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          white-space: nowrap;
        }

        /* Toggle */
        .crm-toggle {
          flex-shrink: 0;
          width: 26px; height: 26px;
          border-radius: 5px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(255,255,255,0.5);
          font-size: 10px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.12s, color 0.12s;
        }
        .crm-toggle:hover { background: rgba(204,0,0,0.18); color: #cc0000; border-color: rgba(204,0,0,0.35); }

        /* Scroll área */
        .crm-sb-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px 0 20px;
        }
        .crm-sb-scroll::-webkit-scrollbar { width: 3px; }
        .crm-sb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .crm-sb.close .crm-sb-scroll { display: none; }

        /* ── Ítems core ── */
        .crm-core-item {
          display: flex; align-items: center; gap: 9px;
          padding: 0 12px;
          height: 36px;
          text-decoration: none;
          border-left: 2px solid transparent;
          white-space: nowrap; overflow: hidden;
          transition: background 0.1s, border-color 0.1s;
        }
        .crm-core-item:hover { background: rgba(255,255,255,0.06); border-left-color: rgba(255,255,255,0.2); }
        .crm-core-item.act   { background: rgba(204,0,0,0.14); border-left-color: #cc0000; }

        .crm-core-ico { font-size: 15px; flex-shrink: 0; width: 20px; text-align: center; }
        .crm-core-lbl {
          font-family: 'Montserrat',sans-serif;
          font-size: 11px; font-weight: 800;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: rgba(255,255,255,0.88);
          overflow: hidden; text-overflow: ellipsis;
        }
        .crm-core-item.act .crm-core-lbl { color: #fff; }

        /* ── Divisor ── */
        .crm-div {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 5px 10px;
        }

        /* ── Grupo (accordion) ── */
        .crm-grupo-btn {
          display: flex; align-items: center; gap: 7px;
          width: 100%; padding: 0 12px;
          height: 30px;
          background: none; border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }
        .crm-grupo-btn:hover { background: rgba(255,255,255,0.04); }
        .crm-grupo-titulo {
          font-family: 'Montserrat',sans-serif;
          font-size: 8.5px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.32);
          flex: 1;
          white-space: nowrap; overflow: hidden;
        }
        .crm-grupo-arrow {
          font-size: 8px;
          color: rgba(255,255,255,0.22);
          transition: transform 0.15s;
          flex-shrink: 0;
        }
        .crm-grupo-arrow.open { transform: rotate(90deg); }

        /* ── Ítems normales ── */
        .crm-item {
          display: flex; align-items: center; gap: 8px;
          padding: 0 12px 0 22px;
          height: 32px;
          text-decoration: none;
          border-left: 2px solid transparent;
          white-space: nowrap; overflow: hidden;
          transition: background 0.1s, border-color 0.1s;
        }
        .crm-item:hover { background: rgba(255,255,255,0.05); border-left-color: rgba(255,255,255,0.15); }
        .crm-item.act   { background: rgba(204,0,0,0.1); border-left-color: #cc0000; }

        .crm-item-ico { font-size: 13px; flex-shrink: 0; width: 18px; text-align: center; }
        .crm-item-lbl {
          font-family: 'Inter','Helvetica',sans-serif;
          font-size: 11.5px; font-weight: 500;
          color: rgba(255,255,255,0.75);
          overflow: hidden; text-overflow: ellipsis;
        }
        .crm-item.act .crm-item-lbl { color: #fff; font-weight: 600; }

        /* ── Contenido ── */
        .crm-content {
          flex: 1;
          min-width: 0;
          padding: 24px 28px;
          overflow-y: auto;
        }

        @media (max-width: 900px) {
          .crm-sb.open { width: 200px; }
          .crm-content { padding: 16px; }
        }
      `}</style>

      <div className="crm-root">

        {/* ── Sidebar ── */}
        <nav className={`crm-sb ${abierto ? "open" : "close"}`} aria-label="Menú CRM">

          {/* Header */}
          <div className="crm-sb-head">
            {abierto && <span className="crm-sb-head-lbl">CRM GFI®</span>}
            <button
              className="crm-toggle"
              onClick={() => setAbierto(v => !v)}
              title={abierto ? "Colapsar menú" : "Expandir menú"}
              aria-label={abierto ? "Colapsar menú CRM" : "Expandir menú CRM"}
            >
              {abierto ? "◀" : "▶"}
            </button>
          </div>

          {/* Scroll con ítems */}
          <div className="crm-sb-scroll">

            {/* Ítems core */}
            {CRM_CORE.map(([s, ico, lbl]) => (
              <Link
                key={s}
                href={s === "dashboard" ? "/crm" : `/crm?s=${s}`}
                className={`crm-core-item${isCoreActivo(s) ? " act" : ""}`}
              >
                <span className="crm-core-ico">{ico}</span>
                <span className="crm-core-lbl">{lbl}</span>
              </Link>
            ))}

            <div className="crm-div" />

            {/* Grupos accordion */}
            {CRM_GRUPOS.map((grupo, idx) => {
              const expanded = !!gruposAbiertos[idx];
              return (
                <div key={grupo.titulo}>
                  <button
                    className="crm-grupo-btn"
                    onClick={() => toggleGrupo(idx)}
                    aria-expanded={expanded}
                  >
                    <span className="crm-grupo-titulo">{grupo.titulo}</span>
                    <span className={`crm-grupo-arrow${expanded ? " open" : ""}`}>▶</span>
                  </button>

                  {expanded && grupo.items.map(([href, ico, lbl]) => (
                    <Link
                      key={href}
                      href={href}
                      className={`crm-item${isLinkActivo(href) ? " act" : ""}`}
                    >
                      <span className="crm-item-ico">{ico}</span>
                      <span className="crm-item-lbl">{lbl}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </nav>

        {/* ── Contenido ── */}
        <div className="crm-content">
          {children}
        </div>

      </div>
    </>
  );
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <CrmLayoutInner>{children}</CrmLayoutInner>
    </Suspense>
  );
}
