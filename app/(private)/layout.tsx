"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const NAV_ITEMS = [
  { icon: "⊞", label: "Dashboard", href: "/dashboard", section: null },
  { icon: "◈", label: "Motor MIR", href: "/mir", section: "Operaciones" },
  { icon: "💱", label: "Cotizaciones", href: "/cotizaciones", section: "Operaciones" },
  { icon: "📋", label: "Padrón COCIR", href: "/padron", section: "Comunidad" },
  { icon: "💬", label: "Foro", href: "/foro", section: "Comunidad" },
  { icon: "📅", label: "Eventos", href: "/eventos", section: "Comunidad" },
  { icon: "📚", label: "Biblioteca", href: "/biblioteca", section: "Recursos" },
  { icon: "💰", label: "Suscripción", href: "/suscripcion", section: "Recursos" },
  { icon: "🔗", label: "Enlaces Útiles", href: "/enlaces", section: "Recursos" },
  { icon: "🤝", label: "Proveedores", href: "/proveedores", section: "Recursos" },
  { icon: "👤", label: "Mi perfil", href: "/perfil", section: "Recursos" },
];

const ADMIN_ITEMS = [
  { icon: "⚙", label: "Panel Admin", href: "/admin", section: "Admin" },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function PrivateLayout({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [matricula, setMatricula] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("nombre, apellido, matricula, tipo")
        .eq("id", session.user.id)
        .single();

      if (perfil) {
        setNombre(`${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim());
        setMatricula(perfil.matricula ?? "");
        setEsAdmin(perfil.tipo === "admin");
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const allItems = esAdmin
    ? [...NAV_ITEMS, ...ADMIN_ITEMS]
    : NAV_ITEMS;

  const allSections = allItems.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    const key = item.section ?? "__top__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <div style={{
          width: 32, height: 32, border: "2px solid rgba(200,0,0,0.3)",
          borderTopColor: "#cc0000", borderRadius: "50%",
          animation: "spin 0.7s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Inter:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }

        .gfi-layout { display: flex; min-height: 100vh; background: #0a0a0a; }

        .gfi-sidebar {
          width: ${collapsed ? "64px" : "220px"};
          min-height: 100vh;
          background: #0d0d0d;
          border-right: 1px solid rgba(180,0,0,0.15);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 200;
          transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }

        .gfi-sidebar-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 12px;
          height: 64px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
          text-decoration: none;
          cursor: pointer;
          overflow: hidden;
        }

        .gfi-logo-img {
          width: ${collapsed ? "36px" : "130px"};
          height: auto;
          object-fit: contain;
          transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
          display: block;
          max-height: 52px;
        }

        .gfi-nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px 0; }
        .gfi-nav::-webkit-scrollbar { width: 3px; }
        .gfi-nav::-webkit-scrollbar-track { background: transparent; }
        .gfi-nav::-webkit-scrollbar-thumb { background: rgba(200,0,0,0.2); border-radius: 2px; }

        .gfi-section-label {
          font-family: 'Montserrat', sans-serif;
          font-size: 8px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          padding: 12px 18px 4px;
          white-space: nowrap;
          overflow: hidden;
          opacity: ${collapsed ? "0" : "1"};
          transition: opacity 0.15s;
          height: ${collapsed ? "0" : "auto"};
        }

        .gfi-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 ${collapsed ? "16px" : "14px"};
          height: 40px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s;
          position: relative;
          white-space: nowrap;
          margin: 1px 6px;
          border-radius: 4px;
        }
        .gfi-nav-item:hover { background: rgba(200,0,0,0.08); }
        .gfi-nav-item.active { background: rgba(200,0,0,0.12); }
        .gfi-nav-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 6px; bottom: 6px;
          width: 2px;
          background: #cc0000;
          border-radius: 0 2px 2px 0;
          margin-left: -6px;
        }
        .gfi-nav-icon {
          font-size: 16px;
          width: 20px; height: 20px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: rgba(255,255,255,0.4);
          transition: color 0.15s;
          font-style: normal;
        }
        .gfi-nav-item:hover .gfi-nav-icon,
        .gfi-nav-item.active .gfi-nav-icon { color: #cc0000; }
        .gfi-nav-label {
          font-family: 'Inter', sans-serif;
          font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.5);
          transition: color 0.15s, opacity 0.2s;
          overflow: hidden;
          opacity: ${collapsed ? "0" : "1"};
        }
        .gfi-nav-item:hover .gfi-nav-label,
        .gfi-nav-item.active .gfi-nav-label { color: #fff; }

        .gfi-nav-item[data-tooltip]:hover::after {
          content: attr(data-tooltip);
          position: absolute;
          left: calc(100% + 12px);
          top: 50%; transform: translateY(-50%);
          background: #1a1a1a;
          border: 1px solid rgba(200,0,0,0.2);
          color: #fff;
          font-size: 11px;
          font-family: 'Inter', sans-serif;
          padding: 5px 10px;
          border-radius: 3px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 300;
          display: ${collapsed ? "block" : "none"};
        }

        .gfi-collapse-btn {
          display: flex; align-items: center; justify-content: center;
          height: 40px; width: 100%;
          background: none; border: none; border-top: 1px solid rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.25);
          cursor: pointer; font-size: 14px;
          transition: color 0.2s, background 0.2s;
          flex-shrink: 0;
        }
        .gfi-collapse-btn:hover { color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.03); }

        .gfi-user {
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: ${collapsed ? "12px 16px" : "12px 14px"};
          display: flex; align-items: center; gap: 10px;
          flex-shrink: 0;
          transition: padding 0.25s;
        }
        .gfi-user-avatar {
          width: 32px; height: 32px;
          background: rgba(200,0,0,0.15);
          border: 1px solid rgba(200,0,0,0.3);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Montserrat', sans-serif;
          font-size: 11px; font-weight: 800; color: #cc0000;
          flex-shrink: 0;
        }
        .gfi-user-info {
          flex: 1; overflow: hidden;
          opacity: ${collapsed ? "0" : "1"};
          transition: opacity 0.2s;
          pointer-events: ${collapsed ? "none" : "auto"};
        }
        .gfi-user-name {
          font-size: 11px; font-weight: 600; color: #fff;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .gfi-user-mat {
          font-size: 9px; color: rgba(255,255,255,0.3);
          letter-spacing: 0.06em; margin-top: 1px;
          font-family: 'Montserrat', sans-serif;
        }
        .gfi-logout-btn {
          background: none; border: none;
          color: rgba(255,255,255,0.2); font-size: 14px;
          cursor: pointer; padding: 4px; border-radius: 3px;
          transition: color 0.2s, background 0.2s;
          flex-shrink: 0;
          display: ${collapsed ? "none" : "flex"};
          align-items: center; justify-content: center;
        }
        .gfi-logout-btn:hover { color: #ff4444; background: rgba(200,0,0,0.1); }

        .gfi-main {
          flex: 1;
          margin-left: ${collapsed ? "64px" : "220px"};
          min-height: 100vh;
          display: flex; flex-direction: column;
          transition: margin-left 0.25s cubic-bezier(0.4,0,0.2,1);
        }

        .gfi-topbar {
          height: 56px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px;
          background: rgba(10,10,10,0.98);
          position: sticky; top: 0; z-index: 100;
          flex-shrink: 0;
        }
        .gfi-topbar-left { display: flex; align-items: center; gap: 12px; }
        .gfi-topbar-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 13px; font-weight: 700;
          color: rgba(255,255,255,0.7);
          letter-spacing: 0.04em;
        }
        .gfi-topbar-right { display: flex; align-items: center; gap: 10px; }
        .gfi-topbar-badge {
          padding: 5px 12px;
          background: rgba(200,0,0,0.1);
          border: 1px solid rgba(200,0,0,0.25);
          border-radius: 3px;
          font-family: 'Montserrat', sans-serif;
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: #cc0000;
        }
        .gfi-mobile-menu-btn {
          display: none;
          background: none; border: none;
          color: rgba(255,255,255,0.5); font-size: 18px;
          cursor: pointer; padding: 4px;
        }

        .gfi-page { flex: 1; padding: 28px; overflow-x: hidden; }

        .gfi-mobile-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 150;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .gfi-sidebar {
            transform: translateX(${collapsed || !mobileOpen ? "-100%" : "0"});
            width: 220px !important;
          }
          .gfi-main { margin-left: 0 !important; }
          .gfi-mobile-menu-btn { display: flex; }
          .gfi-mobile-overlay { display: ${mobileOpen ? "block" : "none"}; }
          .gfi-nav-label { opacity: 1 !important; }
          .gfi-logo-img { width: 130px !important; }
          .gfi-user-info { opacity: 1 !important; pointer-events: auto !important; }
          .gfi-logout-btn { display: flex !important; }
          .gfi-section-label { opacity: 1 !important; height: auto !important; }
          .gfi-page { padding: 16px; }
        }
      `}</style>

      <div className="gfi-layout">
        <aside className="gfi-sidebar">
          {/* Logo */}
          <a href="/dashboard" className="gfi-sidebar-logo">
            <img
              src="/Logo.jpg"
              alt="Grupo Foro Inmobiliario"
              className="gfi-logo-img"
            />
          </a>

          {/* Nav */}
          <nav className="gfi-nav">
            {Object.entries(allSections).map(([section, items]) => (
              <div key={section}>
                {section !== "__top__" && (
                  <div className="gfi-section-label">{section}</div>
                )}
                {items.map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`gfi-nav-item${isActive(item.href) ? " active" : ""}`}
                    data-tooltip={item.label}
                  >
                    <span className="gfi-nav-icon">{item.icon}</span>
                    <span className="gfi-nav-label">{item.label}</span>
                  </a>
                ))}
              </div>
            ))}
          </nav>

          {/* Collapse button */}
          <button
            className="gfi-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? "▶" : "◀"}
          </button>

          {/* User */}
          <div className="gfi-user">
            <div className="gfi-user-avatar">
              {nombre ? nombre.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="gfi-user-info">
              <div className="gfi-user-name">{nombre || "Usuario"}</div>
              {matricula && <div className="gfi-user-mat">Mat. {matricula}</div>}
            </div>
            <button className="gfi-logout-btn" onClick={handleLogout} title="Cerrar sesión">
              ⏻
            </button>
          </div>
        </aside>

        <div
          className="gfi-mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />

        <div className="gfi-main">
          <header className="gfi-topbar">
            <div className="gfi-topbar-left">
              <button
                className="gfi-mobile-menu-btn"
                onClick={() => setMobileOpen(o => !o)}
              >
                ☰
              </button>
              <span className="gfi-topbar-title">
                {allItems.find(i => isActive(i.href))?.label ?? "GFI®"}
              </span>
            </div>
            <div className="gfi-topbar-right">
              {esAdmin && (
                <span className="gfi-topbar-badge">Admin</span>
              )}
            </div>
          </header>

          <main className="gfi-page">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
