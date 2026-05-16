"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import IAChatFlotante from "./components/IAChatFlotante";
import AnuncioBanner from "../components/AnuncioBanner";
import BusquedaGlobal from "./components/BusquedaGlobal";

// ── Nav corredor matriculado (acceso completo) ─────────────────────────────
const NAV_CORREDOR = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/actividades", label: "Actividades", icon: "⚡" },
  { href: "/mir", label: "MIR", icon: "🔄" },
  { href: "/red-gfi", label: "Red GFI", icon: "🌐" },
  { href: "/comunidad", label: "Comunidad", icon: "💬" },
  { href: "/foro", label: "Foro", icon: "🗣️" },
  { href: "/encuestas", label: "Encuestas", icon: "📊" },
  { href: "/noticias", label: "Noticias", icon: "📰" },
  { href: "/eventos", label: "Eventos", icon: "📅" },
  { href: "/networking", label: "Networking", icon: "🤝" },
  { href: "/canal-educativo", label: "Canal del Foro", icon: "📡" },
  { href: "/crm", label: "CRM", icon: "👥" },
  { href: "/calculadoras", label: "Calculadoras", icon: "🧮" },
  { href: "/comparables", label: "Comparables", icon: "📈" },
  { href: "/padron-gfi", label: "Padrón", icon: "📋" },
  { href: "/biblioteca", label: "Biblioteca", icon: "📚" },
  { href: "/cotizaciones", label: "Cotizaciones", icon: "💱" },
  { href: "/enlaces", label: "Enlaces", icon: "🔗" },
  { href: "/proveedores", label: "Proveedores", icon: "🏢" },
  { href: "/beneficios", label: "Beneficios", icon: "🎁" },
  { href: "/campanas", label: "Campañas Sponsors", icon: "📢" },
  { href: "/perfil", label: "Mi Perfil", icon: "👤" },
  { href: "/mi-web", label: "Mi Web", icon: "🌐" },
  { href: "/reportes", label: "Reportes", icon: "📉" },
  { href: "/referidos", label: "Referidos", icon: "🤝" },
  { href: "/contratos", label: "Contratos", icon: "📄" },
  { href: "/notificaciones", label: "Notificaciones", icon: "🔔" },
  { href: "/soporte", label: "Soporte", icon: "🛟" },
  { href: "/ideas", label: "Ideas", icon: "💡" },
  { href: "/bolsa-trabajo", label: "Bolsa de Trabajo", icon: "💼" },
  { href: "/foro/memoria", label: "Memoria Colectiva IA", icon: "🧠" },
  { href: "/onboarding", label: "Primeros pasos", icon: "🚀" },
  { href: "/marketplace", label: "Marketplace", icon: "🏪" },
  { href: "/tasaciones", label: "Tasaciones IA", icon: "🏠" },
  { href: "/agenda", label: "Agenda", icon: "📆" },
  { href: "/estadisticas-mercado", label: "Estadísticas", icon: "📊" },
  { href: "/observatorio", label: "Observatorio", icon: "🔭" },
  { href: "/alertas-mercado", label: "Alertas Mercado", icon: "🔔" },
  { href: "/cursos", label: "Cursos", icon: "🎓" },
];

// ── Nav colaborador (funcional a comercialización) ─────────────────────────
const NAV_COLABORADOR = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/mir", label: "MIR", icon: "🔄" },
  { href: "/red-gfi", label: "Red GFI", icon: "🌐" },
  { href: "/crm", label: "CRM", icon: "👥" },
  { href: "/comunidad", label: "Comunidad", icon: "💬" },
  { href: "/perfil", label: "Mi Perfil", icon: "👤" },
];

const NAV_ADMIN = [
  { href: "/admin", label: "Admin", icon: "⚙️" },
  { href: "/moderacion", label: "Moderación", icon: "🛡️" },
];

// Rutas bloqueadas para colaboradores — redirigen al dashboard
const RUTAS_SOLO_CORREDOR = [
  "/actividades", "/noticias", "/eventos",
  "/foro",
  "/comparables",  // datos COCIR = solo matriculados
  "/mi-web",
];

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [perfil, setPerfil] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tipoUsuario, setTipoUsuario] = useState<"admin" | "corredor" | "colaborador">("corredor");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suscripcionBlocked, setSuscripcionBlocked] = useState(false);
  const [cbuDatos, setCbuDatos] = useState({ titular: "Gonzalo Leandro Puche", cvu: "0000003100046173873221", alias: "foroinmobiliario.gp", cuit: "20-25750876-6", banco: "Mercado Pago" });
  const [precioUsd, setPrecioUsd] = useState(15);
  const [dolarBlue, setDolarBlue] = useState<number | null>(null);
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoComprobante, setPagoComprobante] = useState("");
  const [pagoCbu, setPagoCbu] = useState("");
  const [pagoEnviando, setPagoEnviando] = useState(false);
  const [pagoEnviado, setPagoEnviado] = useState(false);
  const [pagoError, setPagoError] = useState("");
  const [copiadoBloq, setCopiadoBloq] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }

      setUserId(auth.user.id);

      const { data: p } = await supabase
        .from("perfiles")
        .select("nombre, apellido, matricula, foto_url, tipo")
        .eq("id", auth.user.id)
        .single();

      if (p) {
        setPerfil(p);
        const tipo = (p.tipo === "admin" || p.tipo === "master") ? "admin" : p.tipo === "colaborador" ? "colaborador" : "corredor";
        setTipoUsuario(tipo);

        // Redirigir colaborador si intenta acceder a ruta bloqueada
        if (tipo === "colaborador") {
          const bloqueada = RUTAS_SOLO_CORREDOR.some(r => pathname === r || pathname.startsWith(r + "/"));
          if (bloqueada) { router.replace("/dashboard"); return; }
        }

        // Verificar suscripción bloqueada (solo para no-admin)
        if (tipo !== "admin") {
          const { data: sub } = await supabase
            .from("suscripciones")
            .select("estado")
            .eq("perfil_id", auth.user.id)
            .order("creado_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (sub?.estado && ["vencida", "suspendida", "bloqueado"].includes(sub.estado)) {
            const [{ data: ind }, dolarRes] = await Promise.all([
              supabase.from("indicadores").select("clave, valor"),
              fetch("https://dolarapi.com/v1/dolares/blue").then(r => r.json()).catch(() => null),
            ]);
            if (ind) {
              const get = (k: string) => ind.find((i: any) => i.clave === k)?.valor;
              const precio = Number(get(p.tipo === "colaborador" ? "precio_colaborador_usd" : "precio_corredor_usd") ?? (p.tipo === "colaborador" ? 5 : 15));
              setPrecioUsd(precio);
              setCbuDatos({
                titular: get("cbu_titular") ?? "Gonzalo Leandro Puche",
                cvu: get("cbu_cvu") ?? "0000003100046173873221",
                alias: get("cbu_alias") ?? "foroinmobiliario.gp",
                cuit: get("cbu_cuit") ?? "20-25750876-6",
                banco: get("cbu_banco") ?? "Mercado Pago",
              });
            }
            if (dolarRes?.compra) setDolarBlue(Math.round((dolarRes.compra + dolarRes.venta) / 2));
            setSuscripcionBlocked(true);
          }
        }
      }
      setLoading(false);
    };
    init();
  }, [pathname]);

  const copiarBloq = (valor: string, key: string) => {
    navigator.clipboard.writeText(valor);
    setCopiadoBloq(key);
    setTimeout(() => setCopiadoBloq(null), 2000);
  };

  const declararPago = async () => {
    if (!pagoFecha) { setPagoError("Ingresá la fecha de la transferencia."); return; }
    if (!pagoMonto) { setPagoError("Ingresá el monto transferido."); return; }
    if (!pagoComprobante) { setPagoError("Ingresá el número de comprobante."); return; }
    setPagoEnviando(true);
    setPagoError("");
    const montoNum = parseFloat(pagoMonto.replace(/\./g, "").replace(",", "."));
    const periodo = new Date().toISOString().slice(0, 7);
    const { error: err } = await supabase.from("suscripciones").insert({
      perfil_id: userId,
      tipo: perfil?.tipo ?? "corredor",
      monto_usd: precioUsd,
      monto_ars: dolarBlue ? Math.round(precioUsd * dolarBlue) : null,
      monto_declarado_ars: isNaN(montoNum) ? null : montoNum,
      dolar_ref: dolarBlue,
      estado: "pendiente",
      fecha_pago_declarado: pagoFecha,
      comprobante: pagoComprobante,
      cbu_origen: pagoCbu || null,
      periodo,
    });
    setPagoEnviando(false);
    if (err) { setPagoError("Error al registrar. Intentá de nuevo."); return; }
    setPagoEnviado(true);
  };

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

  if (suscripcionBlocked) {
    const montoArs = dolarBlue ? Math.round(precioUsd * dolarBlue) : null;
    const inp: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "10px 12px", color: "#fff", fontSize: 14, fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box" };
    const row = (label: string, valor: string, key: string): React.ReactNode => (
      <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", minWidth: 80 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#fff", fontFamily: "'Inter',sans-serif", fontWeight: 500 }}>{valor}</span>
        <button onClick={() => copiarBloq(valor, key)} style={{ background: copiadoBloq === key ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, color: copiadoBloq === key ? "#22c55e" : "rgba(255,255,255,0.4)", fontSize: 11, padding: "3px 10px", cursor: "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>
          {copiadoBloq === key ? "✓" : "Copiar"}
        </button>
      </div>
    );
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "'Inter',sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');`}</style>
        <div style={{ width: "100%", maxWidth: 480 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <img src="/logo_gfi.png" alt="GFI" style={{ height: 44, objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>

          {/* Alert */}
          <div style={{ background: "rgba(200,0,0,0.08)", border: "1px solid rgba(200,0,0,0.25)", borderRadius: 8, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🔒</div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: "0.04em", marginBottom: 6 }}>Acceso pausado por falta de pago</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
              Tu suscripción está vencida. Realizá la transferencia y registrala abajo — el equipo GFI confirmará el acceso.
            </div>
          </div>

          {/* Monto */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Cuota mensual</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "'Montserrat',sans-serif" }}>USD {precioUsd}</div>
              {montoArs && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>≈ $ {montoArs.toLocaleString("es-AR")} ARS</div>}
            </div>
          </div>

          {/* CBU */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Datos de transferencia</div>
            {row("Titular", cbuDatos.titular, "titular")}
            {row("CVU / CBU", cbuDatos.cvu, "cvu")}
            {row("Alias", cbuDatos.alias, "alias")}
            {row("CUIT", cbuDatos.cuit, "cuit")}
            {row("Banco", cbuDatos.banco, "banco")}
          </div>

          {/* Formulario */}
          {!pagoEnviado ? (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "18px 18px" }}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Registrar transferencia</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Fecha de transferencia *</label>
                  <input type="date" value={pagoFecha} onChange={e => setPagoFecha(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Monto transferido (ARS) *</label>
                  <input type="text" inputMode="numeric" placeholder="Ej: 150000" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Número de comprobante *</label>
                  <input type="text" placeholder="Ej: 20240516001234" value={pagoComprobante} onChange={e => setPagoComprobante(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>CBU / alias de origen (opcional)</label>
                  <input type="text" placeholder="Tu CBU o alias de homebanking" value={pagoCbu} onChange={e => setPagoCbu(e.target.value)} style={inp} />
                </div>
              </div>
              {pagoError && <div style={{ marginTop: 10, fontSize: 12, color: "#ff6666", fontFamily: "'Inter',sans-serif" }}>{pagoError}</div>}
              <button
                onClick={declararPago}
                disabled={pagoEnviando}
                style={{ marginTop: 16, width: "100%", padding: "12px", background: pagoEnviando ? "rgba(200,0,0,0.4)" : "#cc0000", border: "none", borderRadius: 5, color: "#fff", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: pagoEnviando ? "not-allowed" : "pointer" }}
              >
                {pagoEnviando ? "Enviando..." : "Registrar pago"}
              </button>
            </div>
          ) : (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "24px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 14, color: "#22c55e", marginBottom: 8 }}>Pago registrado</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>El equipo GFI confirmará dentro de las 24hs hábiles. Recibirás acceso completo una vez aprobado.</div>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 12, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }

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

          <BusquedaGlobal />

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
          <AnuncioBanner />
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>
      <IAChatFlotante />
    </>
  );
}
