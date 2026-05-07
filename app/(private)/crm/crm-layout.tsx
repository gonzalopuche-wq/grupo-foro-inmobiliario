"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const CRM_NAV = [
  { href: "/crm", label: "Contactos", icon: "👥", exact: true },
  { href: "/crm/negocios", label: "Negocios", icon: "🤝", exact: false },
  { href: "/crm/tareas", label: "Tareas", icon: "✅", exact: false },
  { href: "/crm/notas", label: "Notas", icon: "📝", exact: false },
  { href: "/crm/smart-prospecting", label: "Prospectos", icon: "🎯", exact: false },
  { href: "/crm/cartera", label: "Cartera", icon: "🏠", exact: false },
  { href: "/crm/visitas", label: "Visitas", icon: "🗓", exact: false },
  { href: "/crm/busqueda", label: "Búsqueda", icon: "🔍", exact: false },
  { href: "/crm/listas", label: "Listas", icon: "🔖", exact: false },
  { href: "/crm/difusion", label: "Difusión", icon: "📣", exact: false },
  { href: "/crm/recordatorios", label: "Recordatorios", icon: "🔔", exact: false },
  { href: "/crm/plantillas", label: "Plantillas", icon: "📋", exact: false },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      {/* Nav lateral CRM */}
      <div style={{
        width: 180, flexShrink: 0,
        background: "rgba(8,8,8,0.95)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        padding: "16px 0",
      }}>
        <div style={{
          padding: "0 16px 14px",
          fontFamily: "Montserrat,sans-serif",
          fontSize: 10, fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.25)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          marginBottom: 8,
        }}>
          CRM GFI®
        </div>
        {CRM_NAV.map(item => {
          const activo = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 16px",
              fontFamily: "Inter,sans-serif",
              fontSize: 13, fontWeight: activo ? 600 : 400,
              color: activo ? "#fff" : "rgba(255,255,255,0.45)",
              background: activo ? "rgba(200,0,0,0.08)" : "transparent",
              borderLeft: activo ? "2px solid #cc0000" : "2px solid transparent",
              textDecoration: "none",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        {children}
      </div>
    </div>
  );
}
