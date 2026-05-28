"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

// ── Estructura de navegación ──────────────────────────────────────────────────

const NAV = [
  {
    id: "inicio",
    icon: "📊",
    label: "Inicio",
    href: "/crm",
    exact: true,
  },
  {
    id: "propiedades",
    icon: "🏠",
    label: "Propiedades",
    children: [
      { href: "/crm/cartera",        label: "Listado" },
      { href: "/crm/busqueda",       label: "Búsquedas" },
      { href: "/crm/autorizaciones", label: "Autorizaciones" },
      { href: "/crm/tasacion",       label: "Tasaciones" },
      { href: "/crm/difusion",       label: "Difusión" },
    ],
  },
  {
    id: "contactos",
    icon: "👥",
    label: "Contactos",
    href: "/crm/contactos",
  },
  {
    id: "negocios",
    icon: "💼",
    label: "Negocios",
    children: [
      { href: "/crm/negocios",        label: "Mis negocios" },
      { href: "/crm/pipeline-kanban", label: "Pipeline" },
      { href: "/crm/seguimiento",     label: "Seguimiento" },
      { href: "/crm/escrituras",      label: "Escrituras" },
    ],
  },
  {
    id: "tareas",
    icon: "✅",
    label: "Tareas",
    href: "/crm/tareas",
  },
  {
    id: "agenda",
    icon: "📅",
    label: "Agenda",
    children: [
      { href: "/crm/hoy",           label: "Hoy" },
      { href: "/agenda",            label: "Calendario" },
      { href: "/crm/visitas",       label: "Visitas" },
      { href: "/crm/vencimientos",  label: "Vencimientos" },
    ],
  },
  {
    id: "notas",
    icon: "📝",
    label: "Notas",
    href: "/crm/notas",
  },
  {
    id: "finanzas",
    icon: "💰",
    label: "Finanzas",
    children: [
      { href: "/crm/honorarios",  label: "Honorarios" },
      { href: "/crm/comisiones",  label: "Comisiones" },
      { href: "/crm/cobranzas",   label: "Cobranzas" },
    ],
  },
  {
    id: "actividad",
    icon: "⚡",
    label: "Actividad",
    href: "/crm/actividad",
  },
  {
    id: "config",
    icon: "⚙️",
    label: "Configuración",
    href: "/crm/configuracion",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function navItemActive(item: typeof NAV[0], pathname: string): boolean {
  if ("href" in item && item.href) return isActive(item.href, pathname, item.exact);
  if ("children" in item && item.children)
    return item.children.some(c => isActive(c.href, pathname));
  return false;
}

// ── Componente sidebar ────────────────────────────────────────────────────────

function Sidebar({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const item of NAV) {
      if ("children" in item && item.children?.some(c => isActive(c.href, pathname))) {
        init[item.id] = true;
      }
    }
    return init;
  });

  function toggle(id: string) {
    setExpanded(p => ({ ...p, [id]: !p[id] }));
  }

  return (
    <div className="crm2-sidebar">
      <div className="crm2-sb-brand">
        <span className="crm2-sb-logo">GFI®</span>
        <span className="crm2-sb-sub">CRM Inmobiliario</span>
      </div>

      <nav className="crm2-sb-nav">
        {NAV.map(item => {
          const active = navItemActive(item, pathname);

          if ("href" in item && item.href && !("children" in item)) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`crm2-nav-item${active ? " act" : ""}`}
                onClick={onNav}
              >
                <span className="crm2-nav-ico">{item.icon}</span>
                <span className="crm2-nav-lbl">{item.label}</span>
              </Link>
            );
          }

          const open = !!expanded[item.id];
          return (
            <div key={item.id}>
              <button
                className={`crm2-nav-item crm2-nav-parent${active ? " act" : ""}`}
                onClick={() => toggle(item.id)}
              >
                <span className="crm2-nav-ico">{item.icon}</span>
                <span className="crm2-nav-lbl">{item.label}</span>
                <span className={`crm2-nav-arrow${open ? " open" : ""}`}>›</span>
              </button>
              {open && (
                <div className="crm2-nav-children">
                  {"children" in item && item.children?.map(c => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className={`crm2-nav-child${isActive(c.href, pathname) ? " act" : ""}`}
                      onClick={onNav}
                    >
                      — {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  // Cerrar drawer al cambiar ruta
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Cerrar al presionar Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (busqueda.trim()) {
      router.push(`/crm/contactos?q=${encodeURIComponent(busqueda.trim())}`);
      setBusqueda("");
    }
  }

  return (
    <>
      <style>{`
        /* ── Reset de layout padre ── */
        .crm2-root {
          display: flex;
          min-height: calc(100vh - 96px);
          margin: -24px -28px;
          background: #080808;
        }

        /* ── Sidebar desktop ── */
        .crm2-sidebar {
          width: 220px;
          flex-shrink: 0;
          background: #0a0a0a;
          border-right: 1px solid rgba(255,255,255,0.07);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .crm2-sidebar::-webkit-scrollbar { width: 3px; }
        .crm2-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }

        .crm2-sb-brand {
          padding: 20px 16px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .crm2-sb-logo {
          font-family: 'Montserrat', sans-serif;
          font-size: 15px; font-weight: 800;
          color: #cc0000; letter-spacing: 0.06em;
        }
        .crm2-sb-sub {
          display: block;
          font-size: 10px; color: rgba(255,255,255,0.3);
          margin-top: 2px; font-family: 'Inter', sans-serif;
        }

        .crm2-sb-nav {
          flex: 1;
          padding: 8px 0 24px;
          display: flex;
          flex-direction: column;
        }

        /* Item de nav */
        .crm2-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 0 16px; height: 38px;
          text-decoration: none; cursor: pointer;
          background: transparent; border: none; width: 100%;
          text-align: left;
          color: rgba(255,255,255,0.65);
          font-family: 'Inter', sans-serif;
          font-size: 13px; font-weight: 500;
          border-left: 2px solid transparent;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .crm2-nav-item:hover {
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.9);
          border-left-color: rgba(255,255,255,0.15);
        }
        .crm2-nav-item.act {
          background: rgba(204,0,0,0.12);
          color: #fff;
          border-left-color: #cc0000;
          font-weight: 600;
        }
        .crm2-nav-ico { font-size: 15px; flex-shrink: 0; width: 20px; text-align: center; }
        .crm2-nav-lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .crm2-nav-arrow {
          font-size: 16px; color: rgba(255,255,255,0.3);
          transition: transform 0.18s;
          line-height: 1;
        }
        .crm2-nav-arrow.open { transform: rotate(90deg); color: rgba(255,255,255,0.5); }

        /* Sub-items */
        .crm2-nav-children { padding-bottom: 2px; }
        .crm2-nav-child {
          display: block;
          padding: 0 16px 0 46px; height: 32px;
          line-height: 32px;
          text-decoration: none;
          font-family: 'Inter', sans-serif; font-size: 12px;
          color: rgba(255,255,255,0.5);
          border-left: 2px solid transparent;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: background 0.1s, color 0.1s, border-color 0.1s;
        }
        .crm2-nav-child:hover {
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.8);
          border-left-color: rgba(255,255,255,0.12);
        }
        .crm2-nav-child.act {
          color: #fff; font-weight: 500;
          border-left-color: rgba(204,0,0,0.6);
          background: rgba(204,0,0,0.07);
        }

        /* ── Header mobile ── */
        .crm2-header {
          display: none;
          align-items: center; gap: 10px;
          padding: 0 12px;
          height: 52px;
          background: #0a0a0a;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky; top: 0; z-index: 40;
        }
        .crm2-hamburger {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          font-size: 16px;
          cursor: pointer; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .crm2-header-search {
          flex: 1;
          display: flex; align-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 0 12px; gap: 8px; height: 36px;
        }
        .crm2-header-search input {
          flex: 1; background: none; border: none; outline: none;
          color: #fff; font-size: 13px; font-family: 'Inter', sans-serif;
        }
        .crm2-header-search input::placeholder { color: rgba(255,255,255,0.3); }
        .crm2-header-search .srch-ico { color: rgba(255,255,255,0.3); font-size: 14px; }
        .crm2-header-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 14px; font-weight: 800;
          color: #cc0000; flex-shrink: 0;
        }

        /* ── Overlay drawer mobile ── */
        .crm2-overlay {
          display: none;
          position: fixed; inset: 0; z-index: 100;
        }
        .crm2-overlay.open { display: block; }
        .crm2-overlay-bg {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.6);
        }
        .crm2-drawer {
          position: absolute; top: 0; left: 0; bottom: 0;
          width: 280px; max-width: 85vw;
          background: #0a0a0a;
          border-right: 1px solid rgba(255,255,255,0.08);
          overflow-y: auto;
          animation: crm2-slide-in 0.22s ease;
        }
        @keyframes crm2-slide-in {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        .crm2-drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 16px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .crm2-drawer-close {
          width: 32px; height: 32px;
          border-radius: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6);
          font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Content ── */
        .crm2-content {
          flex: 1; min-width: 0;
          padding: 24px 28px;
          overflow-y: auto;
        }

        /* ── Desktop: show sidebar, hide header ── */
        @media (min-width: 769px) {
          .crm2-root { display: flex; }
          .crm2-sidebar-wrap { display: contents; }
          .crm2-header { display: none !important; }
          .crm2-overlay { display: none !important; }
        }

        /* ── Mobile: hide sidebar, show header ── */
        @media (max-width: 768px) {
          .crm2-root { flex-direction: column; }
          .crm2-sidebar-wrap { display: none; }
          .crm2-header { display: flex; }
          .crm2-content { padding: 12px; }
          .crm2-drawer .crm2-sb-nav .crm2-nav-item { height: 44px; font-size: 14px; }
          .crm2-drawer .crm2-nav-child { height: 36px; line-height: 36px; font-size: 13px; }
        }
      `}</style>

      {/* Overlay drawer mobile — fixed, DOM position no importa */}
      <div className={`crm2-overlay${drawerOpen ? " open" : ""}`} ref={overlayRef}>
        <div className="crm2-overlay-bg" onClick={() => setDrawerOpen(false)} />
        <div className="crm2-drawer">
          <div className="crm2-drawer-header">
            <div>
              <span className="crm2-sb-logo">GFI®</span>
              <span className="crm2-sb-sub">CRM Inmobiliario</span>
            </div>
            <button className="crm2-drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
          </div>
          <Sidebar pathname={pathname} onNav={() => setDrawerOpen(false)} />
        </div>
      </div>

      <div className="crm2-root">
        {/* Header mobile — dentro de crm2-root para heredar el margin negativo */}
        <header className="crm2-header">
          <button className="crm2-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
            ☰
          </button>
          <span className="crm2-header-title">CRM</span>
          <form className="crm2-header-search" onSubmit={handleBuscar}>
            <span className="srch-ico">🔍</span>
            <input
              placeholder="Buscar contacto, propiedad..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </form>
        </header>

        {/* Sidebar desktop */}
        <div className="crm2-sidebar-wrap">
          <Sidebar pathname={pathname} />
        </div>

        {/* Contenido */}
        <div className="crm2-content">
          {children}
        </div>
      </div>
    </>
  );
}
