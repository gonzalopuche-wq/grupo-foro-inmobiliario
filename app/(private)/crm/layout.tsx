"use client";

import { useState, useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

const CRM_CORE = [
  { href: "/crm",           icon: "📊", label: "Dashboard" },
  { href: "/crm?s=contactos", icon: "👥", label: "Contactos" },
  { href: "/crm?s=negocios",  icon: "💼", label: "Negocios" },
  { href: "/crm?s=tareas",    icon: "✅", label: "Tareas" },
  { href: "/crm?s=notas",     icon: "📝", label: "Notas" },
];

const CRM_SECTIONS: { id: string; label: string; items: { href: string; icon: string; label: string }[] }[] = [
  {
    id: "agenda", label: "Agenda",
    items: [
      { href: "/crm/hoy",                icon: "🌅", label: "Hoy" },
      { href: "/agenda",                 icon: "📆", label: "Agenda" },
      { href: "/crm/visitas",            icon: "🗓",  label: "Visitas" },
      { href: "/crm/vencimientos",       icon: "📅", label: "Vencimientos" },
      { href: "/crm/recordatorios",      icon: "🔔", label: "Recordatorios" },
      { href: "/crm/campana-cumpleanos", icon: "🎂", label: "Cumpleaños" },
    ],
  },
  {
    id: "propiedades", label: "Propiedades",
    items: [
      { href: "/crm/cartera",            icon: "🏠", label: "Cartera" },
      { href: "/crm/propia",             icon: "🏛️", label: "Propia MLS" },
      { href: "/crm/tasacion",           icon: "🔢", label: "Tasación" },
      { href: "/crm/captacion",          icon: "📝", label: "Captación" },
      { href: "/crm/llaves",             icon: "🔑", label: "Llaves" },
      { href: "/crm/emprendimientos",    icon: "🏗️", label: "Emprendimientos" },
      { href: "/crm/carga-masiva",       icon: "📥", label: "Carga Masiva" },
    ],
  },
  {
    id: "ventas", label: "Ventas",
    items: [
      { href: "/crm/seguimiento",        icon: "📡", label: "Seguimiento" },
      { href: "/crm/embudo",             icon: "🔻", label: "Embudo" },
      { href: "/crm/pipeline-kanban",    icon: "📋", label: "Kanban" },
      { href: "/crm/forecast",           icon: "📊", label: "Forecast" },
      { href: "/crm/negociacion",        icon: "🤝", label: "Negociación" },
      { href: "/crm/checklist-cierre",   icon: "✅", label: "Cierre" },
      { href: "/crm/escrituras",         icon: "⚖️", label: "Escrituras" },
    ],
  },
  {
    id: "marketing", label: "Marketing",
    items: [
      { href: "/crm/smart-match",        icon: "🎯", label: "Smart Match" },
      { href: "/crm/campanas-marketing", icon: "📣", label: "Campañas" },
      { href: "/crm/difusion",           icon: "📡", label: "Difusión" },
      { href: "/crm/plantillas",         icon: "📄", label: "Plantillas" },
      { href: "/crm/listas",             icon: "🔖", label: "Listas" },
      { href: "/crm/busqueda",           icon: "🔍", label: "Búsqueda" },
    ],
  },
  {
    id: "finanzas", label: "Finanzas",
    items: [
      { href: "/crm/honorarios",         icon: "💰", label: "Honorarios" },
      { href: "/crm/comisiones",         icon: "💰", label: "Comisiones" },
      { href: "/crm/cobranzas",          icon: "💳", label: "Cobranzas" },
      { href: "/crm/autorizaciones",     icon: "📋", label: "Autorizaciones" },
    ],
  },
  {
    id: "reportes", label: "Reportes",
    items: [
      { href: "/crm/actividad",               icon: "⚡", label: "Actividad" },
      { href: "/crm/estadisticas-captacion",  icon: "📈", label: "Estadísticas" },
      { href: "/crm/kpi-diario",              icon: "📊", label: "KPI" },
      { href: "/crm/historial",               icon: "📋", label: "Historial" },
    ],
  },
  {
    id: "herramientas", label: "Herramientas",
    items: [
      { href: "/crm/integraciones",      icon: "🛠️", label: "Integraciones" },
      { href: "/crm/api-accesos",        icon: "🔑", label: "API Accesos" },
      { href: "/crm/smart-prospecting",  icon: "🎯", label: "Prospectos" },
      { href: "/crm/webhooks",           icon: "⚡", label: "Webhooks" },
      { href: "/crm/configuracion",      icon: "⚙️", label: "Config." },
    ],
  },
];

function CrmLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabActivo = searchParams.get("s") ?? "dashboard";
  const [abierto, setAbierto] = useState(true);

  function isActivo(href: string) {
    if (href === "/crm") return pathname === "/crm" && tabActivo === "dashboard";
    if (href.startsWith("/crm?s=")) {
      const s = href.match(/[?&]s=([^&]+)/)?.[1] ?? "";
      return pathname === "/crm" && tabActivo === s;
    }
    return pathname === href || (href !== "/crm" && (pathname.startsWith(href + "/") || pathname.startsWith(href)));
  }

  // Detectar qué sección contiene la ruta activa
  function activeSectionId(): string | null {
    for (const sec of CRM_SECTIONS) {
      if (sec.items.some(it => isActivo(it.href))) return sec.id;
    }
    return null;
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const active = CRM_SECTIONS.find(s => s.items.some(it => isActivo(it.href)));
    return active ? { [active.id]: true } : {};
  });

  // Expandir automáticamente la sección al navegar
  useEffect(() => {
    const id = activeSectionId();
    if (id) setExpanded(prev => ({ ...prev, [id]: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tabActivo]);

  function toggleSection(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
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
          padding: 4px 0 20px;
        }
        .crm-sb-scroll::-webkit-scrollbar { width: 3px; }
        .crm-sb-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .crm-sb.close .crm-sb-scroll { display: none; }

        /* Core items block */
        .crm-core-block {
          padding: 6px 8px 6px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        /* Core nav item */
        .crm-core-item {
          display: flex; align-items: center; gap: 8px;
          padding: 0 8px;
          height: 30px;
          text-decoration: none;
          border-radius: 6px;
          white-space: nowrap; overflow: hidden;
          transition: background 0.1s;
        }
        .crm-core-item:hover { background: rgba(255,255,255,0.07); }
        .crm-core-item.act   { background: rgba(204,0,0,0.15); }
        .crm-core-item .crm-nav-ico { font-size: 13px; flex-shrink: 0; width: 18px; text-align: center; }
        .crm-core-item .crm-nav-lbl {
          font-family: 'Inter',sans-serif;
          font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.8);
        }
        .crm-core-item.act .crm-nav-lbl { color: #fff; }

        /* Section header row (clickable) */
        .crm-sec-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 10px 4px 12px;
          cursor: pointer;
          user-select: none;
        }
        .crm-sec-head:hover .crm-sec-lbl { color: rgba(255,255,255,0.55); }
        .crm-sec-lbl {
          font-family: 'Montserrat',sans-serif;
          font-size: 7.5px; font-weight: 700;
          letter-spacing: 0.20em; text-transform: uppercase;
          color: rgba(255,255,255,0.28);
          white-space: nowrap;
          transition: color 0.12s;
        }
        .crm-sec-arrow {
          font-size: 8px;
          color: rgba(255,255,255,0.25);
          transition: transform 0.18s, color 0.12s;
          flex-shrink: 0;
        }
        .crm-sec-head:hover .crm-sec-arrow { color: rgba(255,255,255,0.5); }
        .crm-sec-arrow.open { transform: rotate(90deg); color: rgba(255,255,255,0.4); }

        /* Section items container */
        .crm-sec-items {
          overflow: hidden;
          transition: max-height 0.2s ease, opacity 0.18s ease;
        }
        .crm-sec-items.collapsed { max-height: 0; opacity: 0; }
        .crm-sec-items.open      { max-height: 400px; opacity: 1; }

        /* Nav item */
        .crm-nav-item {
          display: flex; align-items: center; gap: 9px;
          padding: 0 12px;
          height: 30px;
          text-decoration: none;
          border-left: 2px solid transparent;
          white-space: nowrap; overflow: hidden;
          transition: background 0.1s, border-color 0.1s;
        }
        .crm-nav-item:hover { background: rgba(255,255,255,0.04); border-left-color: rgba(255,255,255,0.15); }
        .crm-nav-item.act   { background: rgba(204,0,0,0.10); border-left-color: #cc0000; }

        .crm-nav-ico {
          font-size: 13px; flex-shrink: 0;
          width: 18px; text-align: center;
        }
        .crm-nav-lbl {
          font-family: 'Inter',sans-serif;
          font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.72);
          overflow: hidden; text-overflow: ellipsis;
        }
        .crm-nav-item.act .crm-nav-lbl { color: #fff; font-weight: 600; }

        /* Collapsed sidebar: only icons */
        .crm-sb.close .crm-core-block { padding: 4px 0; }
        .crm-sb.close .crm-core-item  { justify-content: center; padding: 0; border-radius: 0; height: 34px; }
        .crm-sb.close .crm-core-item .crm-nav-ico { width: 36px; font-size: 15px; }
        .crm-sb.close .crm-core-item .crm-nav-lbl { display: none; }
        .crm-sb.close .crm-sec-head,
        .crm-sb.close .crm-sec-items { display: none; }

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
          .crm-sb.open .crm-core-item { justify-content: center; padding: 0; }
          .crm-sb.open .crm-core-item .crm-nav-ico { width: 44px; font-size: 15px; }
          .crm-sb.open .crm-core-item .crm-nav-lbl { display: none; }
          .crm-sb.open .crm-sec-head,
          .crm-sb.open .crm-sec-items { display: none; }
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
            {/* Items principales siempre visibles */}
            <div className="crm-core-block">
              {CRM_CORE.map(item => (
                <Link key={item.href} href={item.href} className={`crm-core-item${isActivo(item.href) ? " act" : ""}`}>
                  <span className="crm-nav-ico">{item.icon}</span>
                  <span className="crm-nav-lbl">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Secciones colapsables */}
            {CRM_SECTIONS.map(sec => {
              const isOpen = !!expanded[sec.id];
              return (
                <div key={sec.id}>
                  <div className="crm-sec-head" onClick={() => toggleSection(sec.id)} role="button" aria-expanded={isOpen}>
                    <span className="crm-sec-lbl">{sec.label}</span>
                    <span className={`crm-sec-arrow${isOpen ? " open" : ""}`}>▶</span>
                  </div>
                  <div className={`crm-sec-items${isOpen ? " open" : " collapsed"}`}>
                    {sec.items.map(item => (
                      <Link key={item.href} href={item.href} className={`crm-nav-item${isActivo(item.href) ? " act" : ""}`}>
                        <span className="crm-nav-ico">{item.icon}</span>
                        <span className="crm-nav-lbl">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
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
