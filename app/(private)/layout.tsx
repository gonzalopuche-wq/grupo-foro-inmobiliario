"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import IAChatFlotante from "./components/IAChatFlotante";

// ── Nav corredor matriculado (acceso completo) ─────────────────────────────
const NAV_CORREDOR = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/actividades", label: "Actividades", icon: "⚡" },
  { href: "/mir", label: "MIR", icon: "🔄" },
  { href: "/comunidad", label: "Comunidad", icon: "💬" },
  { href: "/foro", label: "Foro", icon: "🗣️" },
  { href: "/noticias", label: "Noticias", icon: "📰" },
  { href: "/eventos", label: "Eventos", icon: "📅" },
  { href: "/canal-educativo", label: "Canal Educativo", icon: "📡" },
  { href: "/crm", label: "CRM", icon: "👥" },
  { href: "/cartera", label: "Cartera", icon: "🏠" },
  { href: "/visitas", label: "Visitas", icon: "🗓" },
  { href: "/emprendimientos", label: "Emprendimientos", icon: "🏗️" },
  { href: "/calculadoras", label: "Calculadoras", icon: "🧮" },
  { href: "/comparables", label: "Comparables", icon: "📈" },
  { href: "/padron-gfi", label: "Padrón", icon: "📋" },
  { href: "/biblioteca", label: "Biblioteca", icon: "📚" },
  { href: "/cotizaciones", label: "Cotizaciones", icon: "💱" },
  { href: "/enlaces", label: "Enlaces", icon: "🔗" },
  { href: "/proveedores", label: "Proveedores", icon: "🏢" },
  { href: "/perfil", label: "Mi Perfil", icon: "👤" },
  { href: "/mi-web", label: "Mi Web", icon: "🌐" },
  { href: "/reportes", label: "Reportes", icon: "📉" },
  { href: "/referidos", label: "Referidos", icon: "🤝" },
  { href: "/contratos", label: "Contratos", icon: "📄" },
  { href: "/notificaciones", label: "Notificaciones", icon: "🔔" },
  { href: "/ideas", label: "Ideas", icon: "💡" },
  { href: "/metas", label: "Metas", icon: "🎯" },
  { href: "/legal", label: "Legal", icon: "⚖️" },
  { href: "/marketplace", label: "Marketplace", icon: "🏪" },
  { href: "/directorios", label: "Directorios", icon: "📒" },
  { href: "/tasaciones", label: "Tasaciones IA", icon: "🏠" },
  { href: "/comisiones", label: "Comisiones", icon: "💰" },
  { href: "/honorarios", label: "Honorarios", icon: "🧾" },
  { href: "/agenda", label: "Agenda", icon: "📆" },
];

// ── Nav colaborador (acceso restringido) ───────────────────────────────────
// No puede acceder a: Comunidad, Foro, CRM, Cartera, Comparables, Mi Web
// Dashboard redirige a vista de solo grupos de comunidad
const NAV_COLABORADOR = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/actividades", label: "Actividades", icon: "⚡" },
  { href: "/mir", label: "MIR", icon: "🔄" },
  { href: "/noticias", label: "Noticias", icon: "📰" },
  { href: "/eventos", label: "Eventos", icon: "📅" },
  { href: "/canal-educativo", label: "Canal Educativo", icon: "📡" },
  { href: "/calculadoras", label: "Calculadoras", icon: "🧮" },
  { href: "/padron-gfi", label: "Padrón", icon: "📋" },
  { href: "/biblioteca", label: "Biblioteca", icon: "📚" },
  { href: "/cotizaciones", label: "Cotizaciones", icon: "💱" },
  { href: "/enlaces", label: "Enlaces", icon: "🔗" },
  { href: "/proveedores", label: "Proveedores", icon: "🏢" },
  { href: "/perfil", label: "Mi Perfil", icon: "👤" },
];

const NAV_ADMIN = [
  { href: "/admin", label: "Admin", icon: "⚙️" },
];

// Rutas bloqueadas para colaboradores — redirigen al dashboard
const RUTAS_SOLO_CORREDOR = [
  "/comunidad", "/foro", "/crm", "/cartera", "/comparables", "/mi-web",
];

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [perfil, setPerfil] = useState<any>(null);
  const [tipoUsuario, setTipoUsuario] = useState<"admin" | "corredor" | "colaborador">("corredor");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }

      const { data: p } = await supabase
        .from("perfiles")
        .select("nombre, apellido, matricula, foto_url, tipo")
        .eq("id", auth.user.id)
        .single();

      if (p) {
        setPerfil(p);
        const tipo = p.tipo === "admin" ? "admin" : p.tipo === "colaborador" ? "colaborador" : "corredor";
        setTipoUsuario(tipo);

        // Redirigir colaborador si intenta acceder a ruta bloqueada
        if (tipo === "colaborador") {
          const bloqueada = RUTAS_SOLO_CORREDOR.some(r => pathname === r || pathname.startsWith(r + "/"));
          if (bloqueada) { router.replace("/dashboard"); return; }
        }
      }
      setLoading(false);
    };
    init();
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/crm") return pathname.startsWith("/crm");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const navItems = tipoUsuario === "colaborador" ? NAV_COLABORADOR : NAV_CORREDOR;
  const isAdmin = tipoUsuario === "admin";

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #0a0a0a; }
        .layout-wrap { display: flex; min-height: 100vh; }
        .sidebar { width: 220px; flex-shrink: 0; background: rgba(6,6,6,0.98); border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; height: 100vh; z-index: 50; transition: transform 0.25s; }
        .sidebar-logo { padding: 18px 20px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .sidebar-logo-txt { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.05em; }
        .sidebar-logo-txt span { color: #cc0000; }
        .sidebar-logo-sub { font-size: 9px; color: rgba(255,255,255,0.25); margin-top: 2px; font-family: 'Montserrat',sans-serif; letter-spacing: 0.12em; text-transform: uppercase; }
        .sidebar-nav { flex: 1; overflow-y: auto; padding: 10px 0; }
        .sidebar-nav::-webkit-scrollbar { width: 2px; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .sidebar-section-label { padding: 10px 20px 4px; font-size: 8px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.2); font-family: 'Montserrat',sans-serif; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 20px; color: rgba(255,255,255,0.45); font-size: 13px; font-family: 'Inter',sans-serif; font-weight: 400; text-decoration: none; transition: all 0.15s; border-left: 2px solid transparent; }
        .nav-item:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.03); }
        .nav-item.active { color: #fff; background: rgba(200,0,0,0.08); border-left-color: #cc0000; font-weight: 500; }
        .nav-item-icon { font-size: 15px; flex-shrink: 0; width: 20px; text-align: center; }
        .sidebar-rol-badge { margin: 0 16px 8px; padding: 4px 10px; border-radius: 10px; font-size: 8px; font-family: 'Montserrat',sans-serif; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; text-align: center; background: rgba(255,165,0,0.1); border: 1px solid rgba(255,165,0,0.2); color: rgba(255,165,0,0.7); }
        .sidebar-perfil { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 10px; }
        .sidebar-avatar { width: 32px; height: 32px; border-radius: 8px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.25); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 800; color: #cc0000; flex-shrink: 0; overflow: hidden; }
        .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-perfil-info { flex: 1; min-width: 0; }
        .sidebar-perfil-nombre { font-size: 12px; font-weight: 600; color: #fff; font-family: 'Inter',sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-perfil-mat { font-size: 10px; color: rgba(255,255,255,0.3); }
        .sidebar-logout { padding: 4px 6px; background: none; border: none; color: rgba(255,255,255,0.25); cursor: pointer; font-size: 14px; transition: color 0.15s; }
        .sidebar-logout:hover { color: #cc0000; }
        .main-content { margin-left: 220px; flex: 1; min-height: 100vh; display: flex; flex-direction: column; }
        .topbar { display: none; height: 56px; background: rgba(6,6,6,0.98); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 0 16px; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 40; }
        .topbar-logo { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; }
        .topbar-logo span { color: #cc0000; }
        .topbar-menu-btn { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 20px; cursor: pointer; padding: 6px; }
        .page-content { flex: 1; padding: 24px 28px; }
        .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 45; }
        @media (max-width: 900px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.abierto { transform: translateX(0); }
          .main-content { margin-left: 0; }
          .topbar { display: flex; }
          .sidebar-overlay.visible { display: block; }
          .page-content { padding: 16px; }
        }
      `}</style>

      <div className="layout-wrap">
        <div className={`sidebar-overlay${menuAbierto ? " visible" : ""}`} onClick={() => setMenuAbierto(false)} />

        <aside className={`sidebar${menuAbierto ? " abierto" : ""}`}>
          <div className="sidebar-logo" style={{padding:"12px 16px 10px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <img src="/logo_gfi.png" alt="GFI® Grupo Foro Inmobiliario"
              style={{width:"100%",maxWidth:160,height:"auto",objectFit:"contain",filter:"brightness(1.15) contrast(1.1)"}}
              onError={e=>{
                const el = e.target as HTMLImageElement;
                el.style.display="none";
                const fallback = el.nextSibling as HTMLElement;
                if(fallback) fallback.style.display="block";
              }}
            />
            <div style={{display:"none"}}>
              <div className="sidebar-logo-txt">GFI<span>®</span></div>
              <div className="sidebar-logo-sub">Grupo Foro Inmobiliario</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {tipoUsuario === "colaborador" && (
              <div className="sidebar-rol-badge">Colaborador</div>
            )}
            <div className="sidebar-section-label">Plataforma</div>
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? " active" : ""}`}
                onClick={() => setMenuAbierto(false)}
              >
                <span className="nav-item-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}

            {isAdmin && (
              <>
                <div className="sidebar-section-label" style={{ marginTop: 8 }}>Administración</div>
                {NAV_ADMIN.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${isActive(item.href) ? " active" : ""}`}
                    onClick={() => setMenuAbierto(false)}
                  >
                    <span className="nav-item-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </>
            )}
          </nav>

          {perfil && (
            <div className="sidebar-perfil">
              <div className="sidebar-avatar">
                {perfil.foto_url
                  ? <img src={perfil.foto_url} alt={perfil.nombre} />
                  : `${perfil.nombre?.charAt(0) ?? ""}${perfil.apellido?.charAt(0) ?? ""}`.toUpperCase()
                }
              </div>
              <div className="sidebar-perfil-info">
                <div className="sidebar-perfil-nombre">{perfil.nombre} {perfil.apellido}</div>
                <div className="sidebar-perfil-mat">
                  {perfil.matricula ? `Mat. ${perfil.matricula}` : tipoUsuario === "colaborador" ? "Colaborador" : "Sin matrícula"}
                </div>
              </div>
              <button className="sidebar-logout" onClick={handleLogout} title="Cerrar sesión">↩</button>
            </div>
          )}
        </aside>

        <main className="main-content">
          <div className="topbar">
            <div className="topbar-logo">GFI<span>®</span></div>
            <button className="topbar-menu-btn" onClick={() => setMenuAbierto(true)}>☰</button>
          </div>
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>
      <IAChatFlotante />
    </>
  );
}
