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

function CrmLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabActivo = searchParams.get("s") ?? "dashboard";
  const [abierto, setAbierto] = useState(true);

  function isCoreActivo(s: string) {
    if (pathname !== "/crm") return false;
    return s === "dashboard" ? tabActivo === "dashboard" : tabActivo === s;
  }

  return (
    <>
      <style>{`
        .crm-layout-root { display: flex; height: 100%; overflow: hidden; }
        .crm-layout-sidebar {
          flex-shrink: 0;
          overflow: hidden;
          transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
          background: #0a0a0a;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .crm-layout-inner {
          width: 278px; height: 100%;
          overflow-y: auto; overflow-x: hidden;
          padding: 12px 0 28px;
        }
        .crm-layout-inner::-webkit-scrollbar { width: 3px; }
        .crm-layout-inner::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .crm-layout-header {
          padding: 0 10px 10px;
          font-family: 'Montserrat',sans-serif;
          font-size: 9px; font-weight: 700; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,0.18);
          border-bottom: 1px solid rgba(255,255,255,0.04); margin-bottom: 8px;
        }
        .crm-layout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 0 8px; }
        .crm-layout-item {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 4px; padding: 9px 4px 8px;
          border-radius: 6px; text-decoration: none; text-align: center;
          min-height: 58px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          transition: background 0.13s, border-color 0.13s;
        }
        .crm-layout-item:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.15); }
        .crm-layout-item.activo { background: rgba(204,0,0,0.13); border-color: rgba(204,0,0,0.28); }
        .crm-layout-ico { font-size: 15px; line-height: 1; }
        .crm-layout-lbl { font-family: 'Inter',sans-serif; font-size: 9.5px; font-weight: 500; color: rgba(255,255,255,0.72); line-height: 1.25; }
        .crm-layout-item.activo .crm-layout-lbl { color: #fff; font-weight: 600; }
        .crm-layout-toggle {
          flex-shrink: 0; width: 22px; padding: 0; border: none;
          border-right: 1px solid rgba(255,255,255,0.07);
          background: rgba(7,7,7,0.98); cursor: pointer;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 10px; transition: background 0.15s;
        }
        .crm-layout-toggle:hover { background: rgba(18,18,18,0.98); }
        .crm-layout-dot { width: 4px; height: 4px; border-radius: 50%; background: #cc0000; opacity: 0.7; }
        .crm-layout-txt {
          writing-mode: vertical-lr; transform: rotate(180deg);
          font-family: 'Montserrat',sans-serif; font-size: 7px; font-weight: 700;
          letter-spacing: 0.18em; color: rgba(255,255,255,0.15); user-select: none;
        }
        .crm-layout-arrow { font-size: 8px; color: rgba(204,0,0,0.6); font-weight: 700; }
        .crm-layout-content { flex: 1; min-width: 0; overflow: hidden; }
        .crm-layout-core { display: flex; flex-direction: column; gap: 2px; padding: 0 8px 8px; }
        .crm-layout-core-item {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px;
          border-radius: 6px; text-decoration: none;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          transition: background 0.13s, border-color 0.13s;
        }
        .crm-layout-core-item:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); }
        .crm-layout-core-item.activo { background: rgba(204,0,0,0.12); border-color: rgba(204,0,0,0.28); }
        .crm-layout-core-ico { font-size: 13px; line-height: 1; flex-shrink: 0; }
        .crm-layout-core-lbl { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.72); }
        .crm-layout-core-item.activo .crm-layout-core-lbl { color: #fff; }
        .crm-layout-divider { margin: 4px 8px 8px; border: none; border-top: 1px solid rgba(255,255,255,0.06); }
        @media (max-width: 768px) {
          .crm-layout-sidebar { display: none; }
          .crm-layout-toggle { display: none; }
        }
      `}</style>

      <div className="crm-layout-root">

        {/* ── Sidebar ── */}
        <div className="crm-layout-sidebar" style={{ width: abierto ? 278 : 0 }}>
          <div className="crm-layout-inner">
            <div className="crm-layout-header">CRM GFI®</div>

            {/* ── Secciones principales del CRM ── */}
            <div className="crm-layout-core">
              {CRM_CORE.map(([s, ico, lbl]) => (
                <Link
                  key={s}
                  href={s === "dashboard" ? "/crm" : `/crm?s=${s}`}
                  className={`crm-layout-core-item${isCoreActivo(s) ? " activo" : ""}`}
                >
                  <span className="crm-layout-core-ico">{ico}</span>
                  <span className="crm-layout-core-lbl">{lbl}</span>
                </Link>
              ))}
            </div>

            <hr className="crm-layout-divider" />

            <div className="crm-layout-grid">
              {[...CRM_LINKS].sort(([,,a],[,,b]) => a.localeCompare(b, "es")).map(([href, ico, lbl]) => (
                <Link
                  key={href}
                  href={href}
                  className={`crm-layout-item${pathname === href || (href !== "/crm" && pathname.startsWith(href)) ? " activo" : ""}`}
                >
                  <span className="crm-layout-ico">{ico}</span>
                  <span className="crm-layout-lbl">{lbl}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Pestaña toggle ── */}
        <button
          className="crm-layout-toggle"
          onClick={() => setAbierto(v => !v)}
          aria-expanded={abierto}
          aria-label={abierto ? "Cerrar menú CRM" : "Abrir menú CRM"}
          title={abierto ? "Cerrar menú CRM" : "Abrir menú CRM"}
        >
          <div className="crm-layout-dot" />
          <span className="crm-layout-txt">CRM</span>
          <span className="crm-layout-arrow">{abierto ? "◀" : "▶"}</span>
        </button>

        {/* ── Contenido (page.tsx y sub-rutas) ── */}
        <div className="crm-layout-content">
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
