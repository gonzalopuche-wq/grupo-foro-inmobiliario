"use client";

import { useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

const CRM_MENU: { section?: string; href: string; icon: string; label: string }[] = [
  // ── Core ──
  { href: "/crm",                    icon: "📊", label: "Dashboard" },
  { href: "/crm?s=contactos",        icon: "👥", label: "Contactos" },
  { href: "/crm?s=negocios",         icon: "💼", label: "Negocios" },
  { href: "/crm?s=tareas",           icon: "✅", label: "Tareas" },
  { href: "/crm?s=notas",            icon: "📝", label: "Notas" },

  // ── Agenda ──
  { section: "Agenda", href: "/crm/hoy",               icon: "🌅", label: "Hoy" },
  { href: "/agenda",                                    icon: "📆", label: "Agenda" },
  { href: "/crm/visitas",                               icon: "🗓", label: "Visitas" },
  { href: "/crm/vencimientos",                          icon: "📅", label: "Vencimientos" },
  { href: "/crm/recordatorios",                         icon: "🔔", label: "Recordatorios" },
  { href: "/crm/campana-cumpleanos",                    icon: "🎂", label: "Cumpleaños" },

  // ── Propiedades ──
  { section: "Propiedades", href: "/crm/cartera",       icon: "🏠", label: "Cartera" },
  { href: "/crm/propia",                                icon: "🏛️", label: "Propia MLS" },
  { href: "/crm/tasacion",                              icon: "🔢", label: "Tasación" },
  { href: "/crm/captacion",                             icon: "📝", label: "Captación" },
  { href: "/crm/llaves",                                icon: "🔑", label: "Llaves" },
  { href: "/crm/emprendimientos",                       icon: "🏗️", label: "Emprendimientos" },
  { href: "/crm/carga-masiva",                          icon: "📥", label: "Carga Masiva" },

  // ── Ventas ──
  { section: "Ventas", href: "/crm/seguimiento",        icon: "📡", label: "Seguimiento" },
  { href: "/crm/embudo",                                icon: "🔻", label: "Embudo" },
  { href: "/crm/pipeline-kanban",                       icon: "📋", label: "Kanban" },
  { href: "/crm/forecast",                              icon: "📊", label: "Forecast" },
  { href: "/crm/negociacion",                           icon: "🤝", label: "Negociación" },
  { href: "/crm/checklist-cierre",                      icon: "✅", label: "Cierre" },
  { href: "/crm/escrituras",                            icon: "⚖️", label: "Escrituras" },

  // ── Marketing ──
  { section: "Marketing", href: "/crm/smart-match",     icon: "🎯", label: "Smart Match" },
  { href: "/crm/campanas-marketing",                    icon: "📣", label: "Campañas" },
  { href: "/crm/difusion",                              icon: "📣", label: "Difusión" },
  { href: "/crm/plantillas",                            icon: "📄", label: "Plantillas" },
  { href: "/crm/listas",                                icon: "🔖", label: "Listas" },
  { href: "/crm/busqueda",                              icon: "🔍", label: "Búsqueda" },

  // ── Finanzas ──
  { section: "Finanzas", href: "/crm/honorarios",       icon: "💰", label: "Honorarios" },
  { href: "/crm/comisiones",                            icon: "💰", label: "Comisiones" },
  { href: "/crm/cobranzas",                             icon: "💳", label: "Cobranzas" },
  { href: "/crm/autorizaciones",                        icon: "📋", label: "Autorizaciones" },

  // ── Reportes ──
  { section: "Reportes", href: "/crm/actividad",        icon: "⚡", label: "Actividad" },
  { href: "/crm/estadisticas-captacion",                icon: "📈", label: "Estadísticas" },
  { href: "/crm/kpi-diario",                            icon: "📊", label: "KPI" },
  { href: "/crm/historial",                             icon: "📋", label: "Historial" },

  // ── Herramientas ──
  { section: "Herramientas", href: "/crm/integraciones",icon: "🛠️", label: "Herramientas" },
  { href: "/crm/api-accesos",                           icon: "🔑", label: "API Accesos" },
  { href: "/crm/smart-prospecting",                     icon: "🎯", label: "Prospectos" },
  { href: "/crm/webhooks",                              icon: "⚡", label: "Webhooks" },
  { href: "/crm/configuracion",                         icon: "⚙️", label: "Config." },
];

function CrmLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabActivo = searchParams.get("s") ?? "dashboard";
  const [abierto, setAbierto] = useState(true);

  function isActivo(href: string) {
    if (href === "/crm") return pathname === "/crm" && tabActivo === "dashboard";
    if (href.startsWith("/crm?s=")) {
      const s = href.split("s=")[1];
      return pathname === "/crm" && tabActivo === s;
    }
    return pathname === href || (href !== "/crm" && pathname.startsWith(href + "/") || pathname.startsWith(href));
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
        .crm-sb.open  { width: 200px; }
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

        /* Scroll area */
        .crm-sb-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px 0 20px;
        }
        .crm-sb-scroll::-webkit-scrollbar { width: 3px; }
        .crm-sb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .crm-sb.close .crm-sb-scroll { display: none; }

        /* Section label */
        .crm-section {
          padding: 10px 12px 3px;
          font-family: 'Montserrat',sans-serif;
          font-size: 7.5px; font-weight: 700;
          letter-spacing: 0.20em; text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          white-space: nowrap;
        }
        .crm-div {
          height: 1px;
          background: rgba(255,255,255,0.05);
          margin: 4px 10px 2px;
        }

        /* Nav item */
        .crm-nav-item {
          display: flex; align-items: center; gap: 9px;
          padding: 0 12px;
          height: 32px;
          text-decoration: none;
          border-left: 2px solid transparent;
          white-space: nowrap; overflow: hidden;
          transition: background 0.1s, border-color 0.1s;
        }
        .crm-nav-item:hover { background: rgba(255,255,255,0.05); border-left-color: rgba(255,255,255,0.18); }
        .crm-nav-item.act   { background: rgba(204,0,0,0.12); border-left-color: #cc0000; }

        .crm-nav-ico {
          font-size: 14px; flex-shrink: 0;
          width: 20px; text-align: center;
        }
        .crm-nav-lbl {
          font-family: 'Inter',sans-serif;
          font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.75);
          overflow: hidden; text-overflow: ellipsis;
        }
        .crm-nav-item.act .crm-nav-lbl { color: #fff; font-weight: 600; }

        /* Collapsed: show only icon, centered */
        .crm-sb.close .crm-nav-item {
          justify-content: center;
          padding: 0;
          border-left: none;
          height: 34px;
        }
        .crm-sb.close .crm-nav-lbl,
        .crm-sb.close .crm-section,
        .crm-sb.close .crm-div { display: none; }
        .crm-sb.close .crm-nav-ico { width: 36px; font-size: 15px; }
        .crm-sb.close .crm-nav-item.act { background: rgba(204,0,0,0.14); }

        /* Content */
        .crm-content {
          flex: 1;
          min-width: 0;
          padding: 24px 28px;
          overflow-y: auto;
        }

        @media (max-width: 900px) {
          .crm-sb.open { width: 180px; }
          .crm-content { padding: 16px; }
        }
        @media (max-width: 640px) {
          .crm-sb.open { width: 44px; }
          .crm-sb.open .crm-nav-lbl,
          .crm-sb.open .crm-section,
          .crm-sb.open .crm-div { display: none; }
          .crm-sb.open .crm-nav-item { justify-content: center; padding: 0; border-left: none; }
          .crm-sb.open .crm-nav-ico { width: 44px; font-size: 16px; }
          .crm-sb-head { justify-content: center; padding: 0; }
          .crm-sb-head-lbl { display: none; }
          .crm-content { padding: 12px; }
        }
      `}</style>

      <div className="crm-root">

        <nav className={`crm-sb ${abierto ? "open" : "close"}`} aria-label="Menú CRM">
          <div className="crm-sb-head">
            {abierto && <span className="crm-sb-head-lbl">CRM GFI®</span>}
            <button
              className="crm-toggle"
              onClick={() => setAbierto(v => !v)}
              title={abierto ? "Colapsar" : "Expandir"}
              aria-label={abierto ? "Colapsar menú CRM" : "Expandir menú CRM"}
            >
              {abierto ? "◀" : "▶"}
            </button>
          </div>

          <div className="crm-sb-scroll">
            {CRM_MENU.map((item, i) => (
              item.section !== undefined ? (
                <div key={`sec-${i}`}>
                  {i > 0 && <div className="crm-div" />}
                  <div className="crm-section">{item.section}</div>
                  <Link href={item.href} className={`crm-nav-item${isActivo(item.href) ? " act" : ""}`}>
                    <span className="crm-nav-ico">{item.icon}</span>
                    <span className="crm-nav-lbl">{item.label}</span>
                  </Link>
                </div>
              ) : (
                <Link key={item.href + i} href={item.href} className={`crm-nav-item${isActivo(item.href) ? " act" : ""}`}>
                  <span className="crm-nav-ico">{item.icon}</span>
                  <span className="crm-nav-lbl">{item.label}</span>
                </Link>
              )
            ))}
          </div>
        </nav>

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
