"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SponsorPortalLayout({ children }: { children: React.ReactNode }) {
  const [sponsor, setSponsor] = useState<{ nombre: string; logo_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      const { data: prov } = await supabase
        .from("red_proveedores")
        .select("nombre, logo_url")
        .eq("portal_user_id", data.user.id)
        .maybeSingle();
      if (!prov) {
        const { data: perfil } = await supabase.from("perfiles").select("tipo").eq("id", data.user.id).single();
        if (perfil?.tipo !== "admin") { window.location.href = "/dashboard"; return; }
      }
      setSponsor(prov ?? { nombre: "Admin", logo_url: null });
      setLoading(false);
    };
    init();
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#080808" }}>
      <div style={{ width: 24, height: 24, border: "2px solid rgba(200,0,0,.2)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const NAV = [
    { href: "/sponsors/portal", label: "Dashboard", icon: "📊" },
    { href: "/sponsors/portal/campanas", label: "Campañas", icon: "📢" },
    { href: "/sponsors/portal/beneficios", label: "Beneficios", icon: "🎁" },
    { href: "/sponsors/portal/saldo", label: "Saldo", icon: "💰" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "rgba(8,8,8,.98)", borderBottom: "1px solid rgba(255,255,255,.07)", padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {sponsor?.logo_url
            ? <img src={sponsor.logo_url} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain", background: "rgba(255,255,255,.06)" }} alt="" />
            : <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(200,0,0,.12)", border: "1px solid rgba(200,0,0,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏢</div>
          }
          <div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, fontWeight: 800, color: "#fff" }}>{sponsor?.nombre}</div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,.3)" }}>Portal Sponsor · GFI®</div>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.href = "/login")}
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,.1)", borderRadius: 4, color: "rgba(255,255,255,.4)", padding: "6px 14px", cursor: "pointer", fontSize: 12, fontFamily: "'Montserrat',sans-serif" }}>
          Salir
        </button>
      </div>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0, background: "rgba(10,10,10,.8)", borderRight: "1px solid rgba(255,255,255,.06)", padding: "16px 0" }}>
          {NAV.map(item => {
            const activo = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: activo ? 600 : 400,
                color: activo ? "#fff" : "rgba(255,255,255,.4)",
                background: activo ? "rgba(200,0,0,.08)" : "transparent",
                borderLeft: activo ? "2px solid #cc0000" : "2px solid transparent",
                textDecoration: "none", transition: "all .15s",
              }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
