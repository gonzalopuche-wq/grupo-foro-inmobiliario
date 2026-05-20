"use client";

import { useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

const CRM_LINKS: [string, string, string][] = [
  ["/crm/cartera",                "🏠", "Cartera"],
  ["/crm/portales",               "🔗", "Portales"],
  ["/crm/hoy",                    "🌅", "Hoy"],
  ["/crm/actividad",              "⚡", "Actividad"],
  ["/crm/llaves",                 "🔑", "Llaves"],
  ["/crm/visitas",                "🗓", "Visitas"],
  ["/crm/metas",                  "🎯", "Metas"],
  ["/crm/tasacion",               "🏠", "Tasación"],
  ["/crm/seguimiento",            "📡", "Seguimiento"],
  ["/crm/conversion",             "📊", "Conversión"],
  ["/crm/post-cierre",            "📋", "Post-cierre"],
  ["/crm/escrituras",             "⚖️", "Escrituras"],
  ["/crm/alianzas",               "🤝", "Alianzas"],
  ["/crm/firma",                  "✍️", "Firma"],
  ["/crm/emails",                 "✉️", "Emails"],
  ["/agenda",                     "📆", "Agenda"],
  ["/crm/proyeccion-ingresos",    "💰", "Proyección"],
  ["/crm/smart-match",            "🎯", "Smart Match"],
  ["/crm/pipeline-velocity",      "⚡", "Velocity"],
  ["/crm/whatsapp-templates",     "💬", "Templates WA"],
  ["/crm/agenda-semanal",         "📅", "Ag. Semanal"],
  ["/crm/comparador",             "🔍", "Comparador"],
  ["/crm/comisiones",             "💰", "Comisiones"],
  ["/crm/zona",                   "📍", "Análisis Zona"],
  ["/crm/documentos",             "📋", "Documentos"],
  ["/crm/performance",            "📈", "Performance"],
  ["/crm/scripts",                "📞", "Scripts"],
  ["/crm/analisis-captacion",     "🎣", "Captación"],
  ["/crm/mapa-calor",             "🗺️", "Mapa Calor"],
  ["/crm/forecast",               "📊", "Forecast"],
  ["/crm/retencion",              "🔄", "Retención"],
  ["/crm/onboarding",             "✅", "Onboarding"],
  ["/crm/negociacion",            "🤝", "Negociación"],
  ["/crm/clientes-vip",           "💎", "VIP"],
  ["/crm/competencia",            "🔎", "Competencia"],
  ["/crm/reporte-semanal",        "📋", "Rep. Semanal"],
  ["/crm/alertas",                "🚨", "Alertas"],
  ["/crm/embudo",                 "🔻", "Embudo"],
  ["/crm/historial",              "📋", "Historial"],
  ["/crm/win-loss",               "📊", "Win/Loss"],
  ["/crm/referidos",              "🤝", "Referidos"],
  ["/crm/gastos",                 "💸", "Gastos"],
  ["/crm/objetivos",              "🎯", "Objetivos"],
  ["/crm/scoring",                "⭐", "Scoring"],
  ["/crm/cobranzas",              "💳", "Cobranzas"],
  ["/crm/duplicados",             "🔍", "Duplicados"],
  ["/crm/campana-reactivacion",   "📣", "Reactivación"],
  ["/crm/match-clientes",         "🎯", "Match"],
  ["/crm/vencimientos",           "📅", "Vencimientos"],
  ["/crm/comisiones-pendientes",  "💰", "Com. Pend."],
  ["/crm/pipeline-visual",        "🗂️", "Pipe. Visual"],
  ["/crm/forecast-pipeline",      "📈", "Fore. Pipe"],
  ["/crm/checklist-cierre",       "✅", "Checklist"],
  ["/crm/revenue",                "💰", "Revenue"],
  ["/crm/descuentos",             "📉", "Descuentos"],
  ["/crm/produccion",             "🏆", "Producción"],
  ["/crm/agenda-tasaciones",      "📅", "Ag. Tasaciones"],
  ["/crm/expediente",             "📁", "Expediente"],
  ["/crm/metas-personales",       "🎯", "Metas Pers."],
  ["/crm/contratos-activos",      "📋", "Contratos"],
  ["/crm/kpi-diario",             "📊", "KPI Diario"],
  ["/crm/propuesta-comercial",    "📄", "Propuesta"],
  ["/crm/seguimiento-post-venta", "🤝", "Post-Venta"],
  ["/crm/tiempo-venta",           "⏱️", "T. Mercado"],
  ["/crm/campana-cumpleanos",     "🎂", "Cumpleaños"],
  ["/crm/carga-masiva",           "📥", "Carga Masiva"],
  ["/crm/scorecard-semanal",      "🏆", "Scorecard"],
  ["/crm/pipeline-kanban",        "📋", "Kanban"],
  ["/crm/base-conocimiento",      "📚", "Base Conoc."],
  ["/crm/gestion-honorarios",     "💰", "Honorarios"],
  ["/crm/recordatorios",          "🔔", "Recordatorios"],
  ["/crm/analisis-zona",          "📍", "An. Zona"],
  ["/crm/reporte-mensual",        "📑", "Rep. Mensual"],
  ["/crm/simulador-negociacion",  "🤝", "Simulador"],
  ["/crm/buscador",               "🔍", "Buscador"],
  ["/crm/configuracion",          "⚙️", "Config."],
  ["/crm/estadisticas-captacion", "🎣", "Est. Captación"],
  ["/crm/agenda-visitas",         "📅", "Ag. Visitas"],
  ["/crm/seguimiento-ofertas",    "🤝", "Seg. Ofertas"],
  ["/crm/objetivos-mensuales",    "🎯", "Obj. Mens."],
  ["/crm/historial-operaciones",  "📋", "Hist. Oper."],
  ["/crm/gestion-documentos",     "📁", "Gest. Docs"],
  ["/crm/reportes-propietarios",  "📑", "Rep. Propiet."],
  ["/crm/red-contactos",          "🕸️", "Red Contactos"],
  ["/crm/campanas-marketing",     "📣", "Marketing"],
  ["/crm/comisiones-split",       "💰", "Com. Split"],
  ["/crm/plantillas-mensajes",    "💬", "Plantillas"],
  ["/crm/gestion-tareas",         "✅", "Gest. Tareas"],
  ["/crm/presupuesto-anual",      "💸", "Presupuesto"],
  ["/crm/analisis-competencia",   "🔎", "An. Compet."],
  ["/crm/ficha-propiedad",        "🏠", "Ficha Prop."],
  ["/crm/captacion",              "📝", "Captación"],
  ["/crm/integraciones",          "🔗", "Integraciones"],
  ["/emprendimientos",            "🏗️", "Emprendim."],
];

const CRM_CORE: [string, string, string][] = [
  ["dashboard",   "📊", "Dashboard"],
  ["contactos",   "👥", "Contactos"],
  ["negocios",    "💼", "Negocios"],
  ["tareas",      "✅", "Tareas"],
  ["notas",       "📝", "Notas"],
];

const SORTED_LINKS = [...CRM_LINKS].sort(([,,a],[,,b]) => a.localeCompare(b, "es"));

function CrmLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabActivo = searchParams.get("s") ?? "dashboard";
  const [abierto, setAbierto] = useState(true);

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
          background: rgba(6,6,6,0.98);
          border-right: 1px solid rgba(255,255,255,0.07);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
          position: sticky;
          top: 0;
          height: calc(100vh - 0px);
          max-height: 100vh;
        }
        .crm-sb.open  { width: 230px; }
        .crm-sb.close { width: 48px; }

        /* Header del sidebar */
        .crm-sb-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          height: 44px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .crm-sb-head-lbl {
          font-family: 'Montserrat',sans-serif;
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          white-space: nowrap; overflow: hidden;
          transition: opacity 0.15s, width 0.15s;
        }
        .crm-sb.close .crm-sb-head-lbl { opacity: 0; width: 0; }

        /* Toggle button */
        .crm-toggle {
          flex-shrink: 0;
          width: 28px; height: 28px;
          border-radius: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.55);
          font-size: 11px; line-height: 1;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.13s, color 0.13s;
          flex-shrink: 0;
        }
        .crm-toggle:hover { background: rgba(204,0,0,0.15); color: #cc0000; border-color: rgba(204,0,0,0.3); }

        /* Scroll area */
        .crm-sb-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 0 16px;
        }
        .crm-sb-scroll::-webkit-scrollbar { width: 3px; }
        .crm-sb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }

        /* Sección label */
        .crm-section-lbl {
          padding: 10px 12px 4px;
          font-family: 'Montserrat',sans-serif;
          font-size: 8px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          white-space: nowrap; overflow: hidden;
          transition: opacity 0.12s;
        }
        .crm-sb.close .crm-section-lbl { opacity: 0; height: 0; padding: 0; }

        /* Ítems del menú */
        .crm-item {
          display: flex; align-items: center; gap: 9px;
          padding: 0 10px;
          height: 34px;
          text-decoration: none;
          border-radius: 0;
          border-left: 2px solid transparent;
          transition: background 0.12s, border-color 0.12s;
          white-space: nowrap; overflow: hidden;
          position: relative;
        }
        .crm-item:hover { background: rgba(255,255,255,0.07); border-left-color: rgba(255,255,255,0.2); }
        .crm-item.act { background: rgba(204,0,0,0.12); border-left-color: #cc0000; }

        .crm-item-ico {
          font-size: 14px; flex-shrink: 0;
          width: 24px; text-align: center; line-height: 1;
        }
        .crm-item-lbl {
          font-family: 'Montserrat',sans-serif;
          font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.82);
          overflow: hidden; text-overflow: ellipsis;
          transition: opacity 0.12s, width 0.12s;
        }
        .crm-item.act .crm-item-lbl { color: #fff; }

        /* Ocultar labels cuando cerrado */
        .crm-sb.close .crm-item { padding: 0; justify-content: center; }
        .crm-sb.close .crm-item-lbl { opacity: 0; width: 0; }
        .crm-sb.close .crm-item { border-left: 2px solid transparent; }
        .crm-sb.close .crm-item:hover { background: rgba(255,255,255,0.07); border-left-color: transparent; }
        .crm-sb.close .crm-item.act { border-left-color: transparent; }

        /* Tooltip en estado cerrado */
        .crm-sb.close .crm-item[title]:hover::after {
          content: attr(title);
          position: absolute;
          left: 52px;
          background: rgba(18,18,18,0.97);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          font-family: 'Montserrat',sans-serif;
          font-size: 10px; font-weight: 700;
          padding: 4px 10px; border-radius: 5px;
          white-space: nowrap; pointer-events: none;
          z-index: 100;
        }

        /* Divider */
        .crm-div {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 6px 10px;
        }
        .crm-sb.close .crm-div { margin: 6px 6px; }

        /* Ítems core (más destacados) */
        .crm-core-item {
          display: flex; align-items: center; gap: 9px;
          padding: 0 10px;
          height: 38px;
          text-decoration: none;
          border-left: 2px solid transparent;
          transition: background 0.12s, border-color 0.12s;
          white-space: nowrap; overflow: hidden;
          position: relative;
        }
        .crm-core-item:hover { background: rgba(255,255,255,0.08); border-left-color: rgba(255,255,255,0.25); }
        .crm-core-item.act { background: rgba(204,0,0,0.15); border-left-color: #cc0000; }
        .crm-core-ico { font-size: 16px; flex-shrink: 0; width: 24px; text-align: center; line-height: 1; }
        .crm-core-lbl {
          font-family: 'Montserrat',sans-serif;
          font-size: 11px; font-weight: 800;
          letter-spacing: 0.05em; text-transform: uppercase;
          color: rgba(255,255,255,0.9);
          transition: opacity 0.12s, width 0.12s;
          overflow: hidden;
        }
        .crm-core-item.act .crm-core-lbl { color: #fff; }
        .crm-sb.close .crm-core-item { padding: 0; justify-content: center; }
        .crm-sb.close .crm-core-lbl { opacity: 0; width: 0; }
        .crm-sb.close .crm-core-item[title]:hover::after {
          content: attr(title);
          position: absolute;
          left: 52px;
          background: rgba(18,18,18,0.97);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          font-family: 'Montserrat',sans-serif;
          font-size: 10px; font-weight: 700;
          padding: 4px 10px; border-radius: 5px;
          white-space: nowrap; pointer-events: none;
          z-index: 100;
        }

        /* Área de contenido */
        .crm-content {
          flex: 1;
          min-width: 0;
          padding: 24px 28px;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .crm-root { margin: -16px; min-height: calc(100vh - 70px); }
          .crm-sb.open { width: 200px; position: fixed; left: 220px; top: 54px; height: calc(100vh - 54px); z-index: 30; }
          .crm-sb.close { width: 0; }
          .crm-content { padding: 16px; }
        }
      `}</style>

      <div className="crm-root">

        {/* ── Sidebar ── */}
        <nav className={`crm-sb ${abierto ? "open" : "close"}`} aria-label="Menú CRM">

          {/* Header con toggle */}
          <div className="crm-sb-head">
            <span className="crm-sb-head-lbl">CRM GFI®</span>
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

            {/* Core items */}
            <div className="crm-section-lbl">Principal</div>
            {CRM_CORE.map(([s, ico, lbl]) => (
              <Link
                key={s}
                href={s === "dashboard" ? "/crm" : `/crm?s=${s}`}
                className={`crm-core-item${isCoreActivo(s) ? " act" : ""}`}
                title={lbl}
              >
                <span className="crm-core-ico">{ico}</span>
                <span className="crm-core-lbl">{lbl}</span>
              </Link>
            ))}

            <div className="crm-div" />

            {/* All CRM tools sorted alphabetically */}
            <div className="crm-section-lbl">Herramientas</div>
            {SORTED_LINKS.map(([href, ico, lbl]) => (
              <Link
                key={href}
                href={href}
                className={`crm-item${isLinkActivo(href) ? " act" : ""}`}
                title={lbl}
              >
                <span className="crm-item-ico">{ico}</span>
                <span className="crm-item-lbl">{lbl}</span>
              </Link>
            ))}
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
