"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import IAChatFlotante from "./components/IAChatFlotante";
import AnuncioBanner from "../components/AnuncioBanner";
import BusquedaGlobal from "./components/BusquedaGlobal";
import SecurityGuard from "./components/SecurityGuard";
import { WindowManagerProvider, useWindowManager } from "./components/WindowManager";
import FloatingWindow from "./components/FloatingWindow";
import TaskBar from "./components/TaskBar";

// ── Nav corredor matriculado (acceso completo) — agrupado por secciones ─────
// El primer grupo (fijo) son los accesos directos significativos: siempre
// visibles, sin desplegable. El resto se consolida en grupos colapsables.
const NAV_GRUPOS_CORREDOR = [
  {
    label: "Directo",
    fijo: true,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "📊" },
      { href: "/crm", label: "CRM", icon: "👥" },
      { href: "/mir", label: "MIR", icon: "🔄" },
      { href: "/red-gfi", label: "Red GFI", icon: "🌐" },
      { href: "/comunidad", label: "Comunidad", icon: "💬" },
      { href: "/foro", label: "Foro", icon: "🗣️" },
      { href: "/eventos", label: "Eventos", icon: "📅" },
      { href: "/noticias", label: "Noticias", icon: "📰" },
      { href: "/agenda", label: "Agenda", icon: "📆" },
    ],
  },
  {
    label: "Herramientas",
    items: [
      { href: "/actividades", label: "Actividades", icon: "⚡" },
      { href: "/tasaciones", label: "Tasaciones IA", icon: "🏠" },
      { href: "/calculadoras", label: "Calculadoras", icon: "🧮" },
      { href: "/comparables", label: "Comparables", icon: "📈" },
      { href: "/marketplace", label: "Marketplace", icon: "🏪" },
      { href: "/cotizaciones", label: "Cotizaciones", icon: "💱" },
      { href: "/estadisticas-mercado", label: "Estadísticas", icon: "📊" },
      { href: "/observatorio", label: "Observatorio", icon: "🔭" },
      { href: "/alertas-mercado", label: "Alertas Mercado", icon: "🔔" },
    ],
  },
  {
    label: "Comunidad",
    items: [
      { href: "/networking", label: "Networking", icon: "🤝" },
      { href: "/encuestas", label: "Encuestas", icon: "📋" },
      { href: "/canal-educativo", label: "Canal del Foro", icon: "📡" },
      { href: "/foro/memoria", label: "Memoria Colectiva IA", icon: "🧠" },
    ],
  },
  {
    label: "Recursos",
    items: [
      { href: "/biblioteca", label: "Biblioteca", icon: "📚" },
      { href: "/padron-gfi", label: "Padrón", icon: "📋" },
      { href: "/proveedores", label: "Proveedores", icon: "🏢" },
      { href: "/enlaces", label: "Enlaces", icon: "🔗" },
      { href: "/cursos", label: "Cursos", icon: "🎓" },
      { href: "/bolsa-trabajo", label: "Bolsa de Trabajo", icon: "💼" },
      { href: "/beneficios", label: "Beneficios", icon: "🎁" },
      { href: "/campanas", label: "Campañas Sponsors", icon: "📢" },
    ],
  },
  {
    label: "Mi cuenta",
    items: [
      { href: "/perfil", label: "Mi Perfil", icon: "👤" },
      { href: "/mi-web", label: "Mi Web", icon: "🌐" },
      { href: "/credencial", label: "Credencial Digital", icon: "🪪" },
      { href: "/reportes", label: "Reportes", icon: "📉" },
      { href: "/referidos", label: "Referidos", icon: "🤝" },
      { href: "/contratos", label: "Contratos", icon: "📄" },
      { href: "/notificaciones", label: "Notificaciones", icon: "🔔" },
    ],
  },
  {
    label: "Ayuda",
    items: [
      { href: "/onboarding", label: "Primeros pasos", icon: "🚀" },
      { href: "/soporte", label: "Soporte", icon: "🛟" },
      { href: "/ideas", label: "Ideas", icon: "💡" },
      { href: "/propia", label: "Propia — Soporte", icon: "🏢" },
    ],
  },
];

// Lista plana derivada (para utilidades que necesitan todos los ítems)
const NAV_CORREDOR = NAV_GRUPOS_CORREDOR.flatMap(g => g.items);

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
  return (
    <WindowManagerProvider>
      <LayoutContent>{children}</LayoutContent>
    </WindowManagerProvider>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  // Modo ventana flotante: sin sidebar ni topbar (iframe interno)
  const [isVentana] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("ventana") === "1";
  });
  const pathname = usePathname();
  const router = useRouter();
  const [perfil, setPerfil] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tipoUsuario, setTipoUsuario] = useState<"admin" | "corredor" | "colaborador">("corredor");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suscripcionBlocked, setSuscripcionBlocked] = useState(false);
  const [suscripcionWarning, setSuscripcionWarning] = useState<"gracia" | "pendiente" | null>(null);
  const [cbuDatos, setCbuDatos] = useState({ titular: "Gonzalo Leandro Puche", cvu: "0000003100046173873221", alias: "foroinmobiliario.gp", cuit: "20-25750876-6", banco: "Mercado Pago" });
  const [precioUsd, setPrecioUsd] = useState(15);
  const [cantColabs, setCantColabs] = useState(0);
  const [dolarBlue, setDolarBlue] = useState<number | null>(null);
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoComprobante, setPagoComprobante] = useState("");
  const [pagoCbu, setPagoCbu] = useState("");
  const [pagoEnviando, setPagoEnviando] = useState(false);
  const [pagoEnviado, setPagoEnviado] = useState(false);
  const [pagoError, setPagoError] = useState("");
  const [copiadoBloq, setCopiadoBloq] = useState<string | null>(null);
  const [leadsNoLeidos, setLeadsNoLeidos] = useState(0);
  const [notifsNoLeidas, setNotifsNoLeidas] = useState(0);
  const [crmPendientes, setCrmPendientes] = useState(0);
  const { windows, openWindow } = useWindowManager();
  const [navGruposAbiertos, setNavGruposAbiertos] = useState<Record<string, boolean>>({});

  // Tracking de visitas (fire-and-forget)
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      fetch("/api/track-visit", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ruta: pathname }),
      }).catch(() => {});
    });
  }, [pathname]);

  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }

      setUserId(auth.user.id);
      const uid = auth.user.id;

      const { data: p } = await supabase
        .from("perfiles")
        .select("id, nombre, apellido, matricula, foto_url, tipo")
        .eq("id", uid)
        .single();

      if (!p) { setLoading(false); return; }

      setPerfil(p);
      const tipo = (p.tipo === "admin" || p.tipo === "master") ? "admin" : p.tipo === "colaborador" ? "colaborador" : "corredor";
      setTipoUsuario(tipo);
      // Mostrar la app apenas tenemos el perfil. Lo demás (badges, suscripción)
      // carga en segundo plano sin bloquear el render.
      setLoading(false);

      // ── Badges (no bloquean) ──────────────────────────────────────────────
      if (tipo !== "colaborador") {
        supabase.from("web_leads").select("id", { count: "exact", head: true })
          .eq("perfil_id", uid).eq("leido", false)
          .then(({ count }) => setLeadsNoLeidos(count ?? 0), () => {});
      }
      supabase.from("notificaciones").select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("leida", false)
        .then(({ count }) => setNotifsNoLeidas(count ?? 0), () => {});

      const hoy = new Date().toISOString().slice(0, 10);
      Promise.all([
        supabase.from("crm_tareas").select("id", { count: "exact", head: true })
          .eq("perfil_id", uid).eq("estado", "pendiente")
          .lte("fecha_vencimiento", hoy).not("fecha_vencimiento", "is", null),
        supabase.from("crm_recordatorios").select("id", { count: "exact", head: true })
          .eq("perfil_id", uid).eq("completado", false)
          .lte("fecha_recordatorio", new Date().toISOString()),
      ]).then(([tareasRes, recsRes]) => setCrmPendientes((tareasRes.count ?? 0) + (recsRes.count ?? 0)))
        .catch(() => {});

      // ── Verificar suscripción (no bloquea; el overlay aparece al resolver) ─
      if (tipo !== "admin") {
        (async () => {
          const { data: sub } = await supabase
            .from("suscripciones")
            .select("estado, fecha_vencimiento")
            .eq("perfil_id", uid)
            .order("creado_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const estadoSub = sub?.estado ?? null;
          const bloqueado = estadoSub && ["vencida", "suspendida", "bloqueado"].includes(estadoSub);
          const enGracia = estadoSub === "activa" && sub?.fecha_vencimiento && sub.fecha_vencimiento < new Date().toISOString().slice(0, 10);
          const enPendiente = estadoSub === "pendiente";

          if (bloqueado || enGracia) {
            const [{ data: ind }, dolarRes] = await Promise.all([
              supabase.from("indicadores").select("clave, valor"),
              fetch("https://dolarapi.com/v1/dolares/blue").then(r => r.json()).catch(() => null),
            ]);
            if (ind) {
              const get = (k: string) => ind.find((i: any) => i.clave === k)?.valor;
              const precioBase = Number(get("precio_corredor_usd") ?? 15);
              const precioColab = Number(get("precio_colaborador_usd") ?? 5);
              if (p.tipo === "colaborador") {
                setPrecioUsd(0);
              } else {
                const { count: nColabs } = await supabase
                  .from("colaboradores")
                  .select("id", { count: "exact", head: true })
                  .eq("corredor_id", p.id)
                  .eq("estado", "activo");
                const n = nColabs ?? 0;
                setCantColabs(n);
                setPrecioUsd(precioBase + n * precioColab);
              }
              setCbuDatos({
                titular: get("cbu_titular") ?? "Gonzalo Leandro Puche",
                cvu: get("cbu_cvu") ?? "0000003100046173873221",
                alias: get("cbu_alias") ?? "foroinmobiliario.gp",
                cuit: get("cbu_cuit") ?? "20-25750876-6",
                banco: get("cbu_banco") ?? "Mercado Pago",
              });
            }
            if (dolarRes?.compra) setDolarBlue(Math.round((dolarRes.compra + dolarRes.venta) / 2));
            if (bloqueado) setSuscripcionBlocked(true);
            else setSuscripcionWarning("gracia");
          } else if (enPendiente) {
            setSuscripcionWarning("pendiente");
          }
        })();
      }
    };
    init();
    // Corre una sola vez (antes dependía de [pathname] y recargaba todo en cada navegación).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard de rutas para colaboradores — corre en cada navegación con el tipo ya cargado.
  useEffect(() => {
    if (tipoUsuario === "colaborador") {
      const bloqueada = RUTAS_SOLO_CORREDOR.some(r => pathname === r || pathname.startsWith(r + "/"));
      if (bloqueada) router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tipoUsuario]);

  // Clear leads badge when user is viewing the mi-web section
  useEffect(() => {
    if (pathname.startsWith("/mi-web") && leadsNoLeidos > 0) {
      setLeadsNoLeidos(0);
    }
    if (pathname === "/notificaciones" && notifsNoLeidas > 0) {
      setNotifsNoLeidas(0);
    }
    if (pathname.startsWith("/crm") && crmPendientes > 0) {
      setCrmPendientes(0);
    }
  }, [pathname]);

  // Sincronización de sesión entre pestañas: si se cierra sesión en cualquier pestaña,
  // todas las demás redirigen a login automáticamente
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Si el cierre tuvo un motivo (ej: sesión tomada en otro dispositivo),
        // lo propagamos para mostrar el mensaje y que todas las pestañas coincidan.
        let motivo: string | null = null;
        try { motivo = localStorage.getItem("gfi_logout_motivo"); } catch { /* ignore */ }
        router.replace(motivo ? `/login?motivo=${motivo}` : "/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Re-verificar auth cuando la pestaña vuelve a estar visible
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getUser().then(({ data }) => {
          if (!data.user) router.replace("/login");
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId]);

  // ── Sesión única por dispositivo ──────────────────────────────────────────
  // Si el corredor inicia sesión en otro dispositivo, perfiles.sesion_activa_id
  // cambia y este equipo (con un id local distinto) se desconecta. Se valida al
  // montar, cada 20s y al volver a enfocar la pestaña.
  useEffect(() => {
    // Solo corredores/colaboradores: el admin puede usar varios dispositivos.
    // Se espera a que el perfil cargue para conocer el tipo real y no validar de más.
    if (!userId || !perfil || tipoUsuario === "admin") return;
    let desplazado = false;

    const validar = async () => {
      if (desplazado) return;
      const localId = localStorage.getItem("gfi_sesion_id");
      const { data, error } = await supabase
        .from("perfiles").select("sesion_activa_id").eq("id", userId).single();
      if (error || !data || desplazado) return;
      const dbId = (data as { sesion_activa_id: string | null }).sesion_activa_id;

      // Nadie reclamó la sesión todavía (primer uso / cuentas previas a esta
      // función): este dispositivo la toma sin desconectar a nadie.
      if (!dbId) {
        const nuevo = localId ?? ((typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        try { localStorage.setItem("gfi_sesion_id", nuevo); } catch { /* storage no disponible */ }
        await supabase.from("perfiles")
          .update({ sesion_activa_id: nuevo, sesion_activa_at: new Date().toISOString() })
          .eq("id", userId);
        return;
      }

      // El id activo en la BD no es el de este dispositivo → fue desplazado.
      if (!localId || localId !== dbId) {
        desplazado = true;
        try {
          localStorage.removeItem("gfi_sesion_id");
          localStorage.setItem("gfi_logout_motivo", "otro_dispositivo");
        } catch { /* storage no disponible */ }
        await supabase.auth.signOut();
        router.replace("/login?motivo=otro_dispositivo");
      }
    };

    validar();
    const interval = setInterval(validar, 20000);
    const onVisible = () => { if (document.visibilityState === "visible") validar(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [userId, perfil, tipoUsuario]);

  // Real-time badge for new notifications
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`notifs_badge_${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificaciones", filter: `user_id=eq.${userId}` },
        () => setNotifsNoLeidas(n => n + 1))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notificaciones", filter: `user_id=eq.${userId}` },
        () => {
          supabase.from("notificaciones").select("id", { count: "exact", head: true })
            .eq("user_id", userId).eq("leida", false)
            .then(({ count }) => setNotifsNoLeidas(count ?? 0));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const copiarBloq = (valor: string, key: string) => {
    navigator.clipboard.writeText(valor);
    setCopiadoBloq(key);
    setTimeout(() => setCopiadoBloq(null), 2000);
  };

  const declararPago = async () => {
    if (!pagoFecha) { setPagoError("Ingresá la fecha de la transferencia."); return; }
    if (!pagoMonto) { setPagoError("Ingresá el monto transferido."); return; }
    const montoLimpio = pagoMonto.replace(/\./g, "").replace(",", ".");
    const montoNum = parseFloat(montoLimpio);
    if (isNaN(montoNum) || montoNum <= 0) { setPagoError("Ingresá un monto válido."); return; }
    if (!pagoComprobante) { setPagoError("Ingresá el número de comprobante."); return; }
    setPagoEnviando(true);
    setPagoError("");
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
    // Liberar la sesión única antes de salir (limpio para el próximo login)
    if (userId) {
      await supabase.from("perfiles").update({ sesion_activa_id: null }).eq("id", userId).then(() => {}, () => {});
    }
    if (typeof window !== "undefined") localStorage.removeItem("gfi_sesion_id");
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/crm") return pathname.startsWith("/crm");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const navItems = tipoUsuario === "colaborador" ? NAV_COLABORADOR : NAV_CORREDOR;
  const isAdmin = tipoUsuario === "admin";

  // Grupos del sidebar (corredor/admin usan secciones; colaborador, lista simple)
  const navGrupos = tipoUsuario === "colaborador"
    ? [{ label: "Plataforma", items: NAV_COLABORADOR }]
    : NAV_GRUPOS_CORREDOR;
  const grupoTieneActivo = (g: { items: { href: string }[] }) => g.items.some(it => isActive(it.href));
  // Un grupo arranca abierto si contiene la ruta activa (el grupo "Directo" es fijo y se maneja aparte).
  const grupoDefaultAbierto = (g: { label: string; items: { href: string }[] }) =>
    grupoTieneActivo(g);
  const grupoAbierto = (g: { label: string; items: { href: string }[] }) =>
    navGruposAbiertos[g.label] ?? grupoDefaultAbierto(g);
  const toggleGrupo = (label: string, g: { label: string; items: { href: string }[] }) =>
    setNavGruposAbiertos(prev => ({ ...prev, [label]: !(prev[label] ?? grupoDefaultAbierto(g)) }));

  // Renderiza un ítem de nav (con badges + botón ventana flotante)
  const renderNavItem = (item: { href: string; label: string; icon: string }) => (
    <div key={item.href} className="nav-item-row" style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Link
        href={item.href}
        className={`nav-item${isActive(item.href) ? " active" : ""}`}
        onClick={() => setMenuAbierto(false)}
        style={{ flex: 1 }}
      >
        <span className="nav-item-icon">{item.icon}</span>
        <span className="nav-item-text">{item.label}</span>
        {item.href === "/mi-web" && leadsNoLeidos > 0 && (
          <span className="nav-badge nav-badge--red">
            {leadsNoLeidos > 99 ? "99+" : leadsNoLeidos}
          </span>
        )}
        {item.href === "/notificaciones" && notifsNoLeidas > 0 && (
          <span className="nav-badge nav-badge--red">
            {notifsNoLeidas > 99 ? "99+" : notifsNoLeidas}
          </span>
        )}
        {item.href === "/crm" && crmPendientes > 0 && (
          <span className="nav-badge nav-badge--orange">
            {crmPendientes > 99 ? "99+" : crmPendientes}
          </span>
        )}
      </Link>
      <button
        className="nav-open-win"
        onClick={() => openWindow(item.label, item.icon, item.href)}
        title={`Abrir ${item.label} en ventana flotante`}
        style={{
          position: "absolute", right: 6,
          width: 20, height: 20, borderRadius: 4,
          background: "var(--gfi-border-subtle)",
          border: "1px solid #252a35",
          color: "#8892a4", cursor: "pointer",
          fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center",
          transition: "opacity 0.15s",
          flexShrink: 0,
        }}
      >
        ⊞
      </button>
    </div>
  );

  // Modo iframe interno: layout mínimo sin chrome
  if (isVentana) {
    if (loading) return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid rgba(200,0,0,0.3)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <SecurityGuard>
          <div style={{ padding: "16px 20px" }}>{children}</div>
        </SecurityGuard>
      </div>
    );
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080a0c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ width: 36, height: 36, border: "2px solid rgba(153,0,0,0.2)", borderTopColor: "#990000", borderRadius: "50%", animation: "spin 0.7s linear infinite", boxShadow: "0 0 20px rgba(153,0,0,0.15)" }} />
      <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#4a5568" }}>GFI® Cargando</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (suscripcionBlocked) {
    const montoArs = dolarBlue ? Math.round(precioUsd * dolarBlue) : null;
    const inp: React.CSSProperties = { width: "100%", background: "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 4, padding: "10px 12px", color: "#fff", fontSize: 14, fontFamily: "var(--font-body)", outline: "none", boxSizing: "border-box" };
    const row = (label: string, valor: string, key: string): React.ReactNode => (
      <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--gfi-border-subtle)" }}>
        <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", minWidth: 80 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#fff", fontFamily: "var(--font-body)", fontWeight: 500 }}>{valor}</span>
        <button onClick={() => copiarBloq(valor, key)} style={{ background: copiadoBloq === key ? "rgba(34,197,94,0.15)" : "var(--gfi-border-subtle)", border: "1px solid var(--gfi-border)", borderRadius: 4, color: copiadoBloq === key ? "#3abab6" : "var(--gfi-text-muted)", fontSize: 11, padding: "3px 10px", cursor: "pointer", fontFamily: "var(--font-body)", flexShrink: 0 }}>
          {copiadoBloq === key ? "✓" : "Copiar"}
        </button>
      </div>
    );
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "var(--font-body)" }}>
        <style>{``}</style>
        <div style={{ width: "100%", maxWidth: 480 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <img src="/logo_gfi.png" alt="GFI" style={{ height: 44, objectFit: "contain" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>

          {/* Alert */}
          <div style={{ background: "rgba(200,0,0,0.08)", border: "1px solid rgba(200,0,0,0.25)", borderRadius: 8, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🔒</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: "0.04em", marginBottom: 6 }}>Acceso pausado por falta de pago</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
              Tu suscripción está vencida. Realizá la transferencia y registrala abajo — el equipo GFI confirmará el acceso.
            </div>
          </div>

          {/* Monto — solo CI paga */}
          {tipoUsuario === "colaborador" ? (
            <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "16px 18px", marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "#d4960c", marginBottom: 6 }}>Tu acceso es gestionado por tu corredor</div>
              <div style={{ fontSize: 12, color: "var(--gfi-text-secondary)", lineHeight: 1.5 }}>El pago de tu suscripción lo realiza el corredor al que estás vinculado. Contactalo para regularizar el acceso.</div>
            </div>
          ) : (
            <div style={{ background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 8, padding: "14px 18px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: cantColabs > 0 ? 10 : 0 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: "var(--gfi-text-muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Cuota mensual</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "var(--font-display)" }}>USD {precioUsd}</div>
                  {montoArs && <div style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>≈ $ {montoArs.toLocaleString("es-AR")} ARS</div>}
                </div>
              </div>
              {cantColabs > 0 && (
                <div style={{ fontSize: 11, color: "var(--gfi-text-muted)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                  USD 15 (CI) + USD {cantColabs * 5} ({cantColabs} colaborador{cantColabs > 1 ? "es" : ""} × USD 5)
                </div>
              )}
            </div>
          )}

          {/* CBU */}
          <div style={{ background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 8, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10, color: "var(--gfi-text-muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Datos de transferencia</div>
            {row("Titular", cbuDatos.titular, "titular")}
            {row("CVU / CBU", cbuDatos.cvu, "cvu")}
            {row("Alias", cbuDatos.alias, "alias")}
            {row("CUIT", cbuDatos.cuit, "cuit")}
            {row("Banco", cbuDatos.banco, "banco")}
          </div>

          {/* Formulario */}
          {!pagoEnviado ? (
            <div style={{ background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 8, padding: "18px 18px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10, color: "var(--gfi-text-muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Registrar transferencia</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--gfi-text-muted)", display: "block", marginBottom: 4 }}>Fecha de transferencia *</label>
                  <input type="date" value={pagoFecha} onChange={e => setPagoFecha(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--gfi-text-muted)", display: "block", marginBottom: 4 }}>Monto transferido (ARS) *</label>
                  <input type="text" inputMode="numeric" placeholder="Ej: 150000" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--gfi-text-muted)", display: "block", marginBottom: 4 }}>Número de comprobante *</label>
                  <input type="text" placeholder="Ej: 20240516001234" value={pagoComprobante} onChange={e => setPagoComprobante(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--gfi-text-muted)", display: "block", marginBottom: 4 }}>CBU / alias de origen (opcional)</label>
                  <input type="text" placeholder="Tu CBU o alias de homebanking" value={pagoCbu} onChange={e => setPagoCbu(e.target.value)} style={inp} />
                </div>
              </div>
              {pagoError && <div style={{ marginTop: 10, fontSize: 12, color: "#ff6666", fontFamily: "var(--font-body)" }}>{pagoError}</div>}
              <button
                onClick={declararPago}
                disabled={pagoEnviando}
                style={{ marginTop: 16, width: "100%", padding: "12px", background: pagoEnviando ? "rgba(200,0,0,0.4)" : "#990000", border: "none", borderRadius: 5, color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: pagoEnviando ? "not-allowed" : "pointer" }}
              >
                {pagoEnviando ? "Enviando..." : "Registrar pago"}
              </button>
            </div>
          ) : (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "24px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: "#3abab6", marginBottom: 8 }}>Pago registrado</div>
              <div style={{ fontSize: 13, color: "var(--gfi-text-secondary)", lineHeight: 1.6 }}>El equipo GFI confirmará dentro de las 24hs hábiles. Recibirás acceso completo una vez aprobado.</div>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "var(--gfi-text-dim)", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-body)" }}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        
        * { box-sizing: border-box; }
        body { margin: 0; background: #080a0c; }

        /* ── Layout wrap ── */
        .layout-wrap { display: flex; min-height: 100vh; }

        /* ── Sidebar ── */
        .sidebar {
          width: 240px; flex-shrink: 0;
          background: linear-gradient(180deg, #080a0c 0%, #0c1018 60%, #0f1219 100%);
          border-right: 1px solid #252a35;
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; height: 100vh;
          z-index: 50; transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }

        /* Logo area */
        .sidebar-logo {
          padding: 16px 18px 0;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column;
        }
        .sidebar-logo-separator {
          width: calc(100% - 36px); height: 1px; margin: 12px 18px 0;
          background: linear-gradient(90deg, #990000 0%, rgba(153,0,0,0.2) 50%, transparent 100%);
        }
        .sidebar-logo-txt { font-family: var(--font-display); font-size: 14px; font-weight: 900; color: #f0f4f8; letter-spacing: 0.06em; }
        .sidebar-logo-txt span { color: #990000; }
        .sidebar-logo-sub { font-size: 8px; color: #4a5568; margin-top: 1px; font-family: var(--font-display); letter-spacing: 0.18em; text-transform: uppercase; }

        /* Nav */
        .sidebar-nav { flex: 1; overflow-y: auto; padding: 8px 0 4px; }
        .sidebar-nav::-webkit-scrollbar { width: 2px; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(153,0,0,0.3); border-radius: 1px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }

        .sidebar-section-label {
          padding: 12px 18px 4px;
          font-size: 8px; font-weight: 700; letter-spacing: 0.20em;
          text-transform: uppercase; color: #4a5568;
          font-family: var(--font-display);
        }

        /* Grupos colapsables del nav */
        .nav-group { margin-bottom: 2px; }
        .nav-group--fijo {
          padding-bottom: 8px; margin-bottom: 6px;
          border-bottom: 1px solid #1c2030;
        }
        .nav-group-toggle {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          background: none; border: none; cursor: pointer; text-align: left;
          margin: 0; -webkit-tap-highlight-color: transparent;
          transition: color 0.15s;
        }
        .nav-group-toggle:hover { color: #8892a4; }
        .nav-group-toggle.has-active { color: #ef4444; }
        .nav-group-chevron {
          font-size: 9px; transition: transform 0.18s ease; opacity: 0.6;
          transform: rotate(0deg);
        }
        .nav-group-chevron.open { transform: rotate(90deg); }

        /* Nav item */
        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 18px 8px 15px;
          color: #8892a4;
          font-size: 12.5px; font-family: var(--font-body); font-weight: 500;
          text-decoration: none;
          transition: all 0.15s;
          border-left: 3px solid transparent;
          position: relative;
        }
        .nav-item:hover {
          color: #f0f4f8;
          background: var(--gfi-border-subtle);
          border-left-color: #252a35;
        }
        .nav-item:hover .nav-item-text { transform: translateX(2px); }
        .nav-item.active {
          color: #f0f4f8;
          background: rgba(153,0,0,0.10);
          border-left-color: #990000;
          font-weight: 600;
          box-shadow: inset 4px 0 12px rgba(153,0,0,0.08);
        }
        .nav-item-icon {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0;
          font-size: 14px;
          background: var(--gfi-border-subtle);
          border: 1px solid #252a35;
          transition: all 0.15s;
        }
        .nav-item.active .nav-item-icon {
          background: rgba(153,0,0,0.15);
          border-color: rgba(153,0,0,0.30);
        }
        .nav-item:hover .nav-item-icon { background: var(--gfi-border-subtle); }
        .nav-item-text { transition: transform 0.15s; }

        /* Role badge */
        .sidebar-rol-badge {
          margin: 4px 14px 8px;
          padding: 4px 12px; border-radius: 20px;
          font-size: 8px; font-family: var(--font-display); font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; text-align: center;
          background: rgba(196,74,0,0.10); border: 1px solid rgba(196,74,0,0.25);
          color: #c44a00;
        }

        /* User profile */
        .sidebar-perfil {
          padding: 12px 14px;
          border-top: 1px solid #252a35;
          display: flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, var(--gfi-bg-secondary) 0%, transparent 100%);
        }
        .sidebar-avatar {
          width: 34px; height: 34px; border-radius: 8px;
          background: rgba(153,0,0,0.12); border: 2px solid rgba(153,0,0,0.30);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 11px; font-weight: 800;
          color: #990000; flex-shrink: 0; overflow: hidden;
          box-shadow: 0 0 12px rgba(153,0,0,0.15);
        }
        .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sidebar-perfil-info { flex: 1; min-width: 0; }
        .sidebar-perfil-nombre { font-size: 12px; font-weight: 600; color: #f0f4f8; font-family: var(--font-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-perfil-mat { font-size: 9px; color: #4a5568; font-family: 'JetBrains Mono','Courier New',monospace; letter-spacing: 0.05em; }
        .sidebar-logout {
          padding: 6px 7px; background: none; border: 1px solid #252a35;
          border-radius: 6px; color: #4a5568; cursor: pointer; font-size: 14px;
          transition: all 0.15s; flex-shrink: 0;
        }
        .sidebar-logout:hover { color: #990000; border-color: rgba(153,0,0,0.3); background: rgba(153,0,0,0.08); }

        /* Main content */
        .main-content { margin-left: 240px; flex: 1; min-height: 100vh; display: flex; flex-direction: column; padding-bottom: 44px; }

        /* Topbar — mobile */
        .topbar {
          display: none; height: 56px;
          background: rgba(8,10,12,0.88);
          border-bottom: 1px solid #1c2030;
          padding: 0 14px; align-items: center; gap: 12px;
          position: sticky; top: 0; z-index: 40;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .topbar::after {
          content: '';
          position: absolute; bottom: -1px; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, #990000 0%, transparent 40%);
        }
        .topbar-logo {
          font-family: var(--font-display); font-size: 15px; font-weight: 900;
          color: #f0f4f8; flex: 1; text-align: center; letter-spacing: 0.05em;
          text-shadow: 0 0 20px rgba(153,0,0,0.3);
        }
        .topbar-logo span { color: #990000; }
        .topbar-menu-btn {
          background: none; border: 1px solid #252a35; border-radius: 7px;
          color: #8892a4; font-size: 18px; cursor: pointer; padding: 5px 9px;
          line-height: 1; flex-shrink: 0; transition: all 0.15s;
        }
        .topbar-menu-btn:hover { border-color: #990000; color: #f0f4f8; }

        /* Page content */
        .page-content { flex: 1; padding: 24px 28px; }

        /* Overlay */
        .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 45; backdrop-filter: blur(4px); }
        .sidebar-overlay.visible { display: block; }

        /* Open-in-window button */
        .nav-item-row .nav-open-win { opacity: 0; }
        .nav-item-row:hover .nav-open-win { opacity: 1 !important; }

        /* Bottom nav — mobile island */
        .bottom-nav {
          display: none; position: fixed; bottom: 0; left: 0; right: 0;
          z-index: 50; padding: 0 8px 0;
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .bottom-nav-inner {
          display: flex; height: 64px; align-items: stretch;
          background: #111318;
          border: 1px solid #252a35;
          border-bottom: none;
          border-radius: 16px 16px 0 0;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          overflow: hidden;
          box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
        }
        .bnav-item {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 3px;
          background: none; border: none; color: #4a5568;
          font-family: var(--font-display); font-size: 8px; font-weight: 700;
          letter-spacing: 0.05em; cursor: pointer; text-decoration: none;
          transition: all 0.15s; position: relative;
          -webkit-tap-highlight-color: transparent; padding: 0; min-height: 44px;
        }
        .bnav-item.active { color: #990000; }
        .bnav-item.active::after {
          content: '';
          position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
          width: 20px; height: 2px; border-radius: 2px; background: #990000;
          box-shadow: 0 0 8px rgba(153,0,0,0.6);
        }
        .bnav-icon { font-size: 20px; line-height: 1; display: block; }
        .bnav-badge {
          position: absolute; top: 8px; right: calc(50% - 18px);
          background: #990000; color: #fff; font-size: 7px; font-weight: 800;
          min-width: 14px; height: 14px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px; font-family: var(--font-body);
          box-shadow: 0 2px 6px rgba(153,0,0,0.4);
        }

        /* Topbar bell */
        .topbar-bell {
          position: relative; display: flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; background: none;
          border: 1px solid #252a35; border-radius: 7px;
          color: #8892a4; font-size: 18px; text-decoration: none;
          flex-shrink: 0; -webkit-tap-highlight-color: transparent;
          transition: all 0.15s;
        }
        .topbar-bell:hover { border-color: rgba(153,0,0,0.4); color: #f0f4f8; }
        .topbar-bell-badge {
          position: absolute; top: 2px; right: 2px;
          background: #990000; color: #fff; font-size: 7px; font-weight: 800;
          min-width: 13px; height: 13px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 2px; font-family: var(--font-body);
        }

        /* Badge pills in nav */
        .nav-badge {
          margin-left: auto; padding: 1px 6px; border-radius: 10px;
          font-size: 8px; font-weight: 800; font-family: var(--font-body);
          line-height: 16px; min-width: 16px; text-align: center; flex-shrink: 0;
        }
        .nav-badge--red { background: #990000; color: #fff; box-shadow: 0 1px 4px rgba(153,0,0,0.4); }
        .nav-badge--orange { background: rgba(196,74,0,0.85); color: #fff; }

        @media (max-width: 900px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.abierto { transform: translateX(0); box-shadow: 4px 0 40px rgba(0,0,0,0.7); }
          .main-content { margin-left: 0; }
          .topbar { display: flex; }
          .page-content { padding: 14px 14px calc(80px + env(safe-area-inset-bottom, 0px)); }
          .bottom-nav { display: block; }
        }
      `}</style>

      <div className="layout-wrap">
        <div className={`sidebar-overlay${menuAbierto ? " visible" : ""}`} onClick={() => setMenuAbierto(false)} />

        <aside className={`sidebar${menuAbierto ? " abierto" : ""}`}>
          <div className="sidebar-logo">
            <img src="/logo_gfi.png" alt="GFI® Grupo Foro Inmobiliario"
              style={{width:"100%",maxWidth:168,height:"auto",objectFit:"contain",filter:"brightness(1.2) contrast(1.05)"}}
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
          <div className="sidebar-logo-separator" />

          <BusquedaGlobal />

          <nav className="sidebar-nav">
            {tipoUsuario === "colaborador" && (
              <div className="sidebar-rol-badge">Colaborador</div>
            )}
            {navGrupos.map(grupo => {
              const esFijo = "fijo" in grupo && (grupo as { fijo?: boolean }).fijo === true;
              // Los accesos directos (grupo fijo) van siempre visibles, sin desplegable.
              if (esFijo) {
                return (
                  <div key={grupo.label} className="nav-group nav-group--fijo">
                    {grupo.items.map(item => renderNavItem(item))}
                  </div>
                );
              }
              const abierto = navGrupos.length === 1 ? true : grupoAbierto(grupo);
              const tieneActivo = grupoTieneActivo(grupo);
              return (
                <div key={grupo.label} className="nav-group">
                  <button
                    type="button"
                    className={`sidebar-section-label nav-group-toggle${tieneActivo ? " has-active" : ""}`}
                    onClick={() => toggleGrupo(grupo.label, grupo)}
                    aria-expanded={abierto}
                  >
                    <span>{grupo.label}</span>
                    <span className={`nav-group-chevron${abierto ? " open" : ""}`}>▸</span>
                  </button>
                  {abierto && grupo.items.map(item => renderNavItem(item))}
                </div>
              );
            })}

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
                    <span className="nav-item-text">{item.label}</span>
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
            <button className="topbar-menu-btn" onClick={() => setMenuAbierto(true)}>☰</button>
            <div className="topbar-logo">GFI<span>®</span></div>
            <Link href="/notificaciones" className="topbar-bell">
              🔔
              {notifsNoLeidas > 0 && (
                <span className="topbar-bell-badge">{notifsNoLeidas > 9 ? "9+" : notifsNoLeidas}</span>
              )}
            </Link>
          </div>
          {suscripcionWarning === "gracia" && (
            <div style={{ background: "rgba(196,74,0,0.08)", borderBottom: "1px solid rgba(196,74,0,0.20)", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 12, color: "#d4960c", fontFamily: "var(--font-body)" }}>
                Tu suscripción venció. Período de gracia activo — realizá el pago para mantener el acceso.
              </span>
              <a href="/suscripcion" style={{ flexShrink: 0, background: "rgba(196,74,0,0.85)", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 5, textDecoration: "none" }}>Pagar ahora</a>
            </div>
          )}
          {suscripcionWarning === "pendiente" && (
            <div style={{ background: "rgba(10,37,64,0.60)", borderBottom: "1px solid rgba(30,74,122,0.30)", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "#4ab8d8", fontFamily: "var(--font-body)" }}>
                Tu pago está siendo verificado. El acceso se mantiene mientras el equipo GFI confirma la transferencia.
              </span>
            </div>
          )}
          <AnuncioBanner />
          <div className="page-content">
            <SecurityGuard>{children}</SecurityGuard>
          </div>
        </main>
      </div>

      {/* ── Bottom navigation (mobile only) ───────────────────────────────── */}
      <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
        <div className="bottom-nav-inner">
          <Link href="/dashboard" className={`bnav-item${isActive("/dashboard") ? " active" : ""}`}>
            <span className="bnav-icon">🏠</span>
            <span>Inicio</span>
          </Link>
          <Link href="/crm" className={`bnav-item${isActive("/crm") ? " active" : ""}`}>
            <span className="bnav-icon">👥</span>
            <span>CRM</span>
            {crmPendientes > 0 && (
              <span className="bnav-badge">{crmPendientes > 9 ? "9+" : crmPendientes}</span>
            )}
          </Link>
          <Link href="/mir" className={`bnav-item${isActive("/mir") ? " active" : ""}`}>
            <span className="bnav-icon">🔄</span>
            <span>MIR</span>
          </Link>
          <Link href="/comunidad" className={`bnav-item${isActive("/comunidad") ? " active" : ""}`}>
            <span className="bnav-icon">💬</span>
            <span>Comunidad</span>
            {leadsNoLeidos > 0 && (
              <span className="bnav-badge">{leadsNoLeidos > 9 ? "9+" : leadsNoLeidos}</span>
            )}
          </Link>
          <button className="bnav-item" onClick={() => setMenuAbierto(true)}>
            <span className="bnav-icon">☰</span>
            <span>Más</span>
          </button>
          <button
            className="bnav-item"
            onClick={() => {
              const current = navItems.find(n => isActive(n.href));
              if (current) openWindow(current.label, current.icon, current.href);
            }}
            title="Abrir en ventana flotante"
          >
            <span className="bnav-icon">⊞</span>
            <span>Ventana</span>
            {windows.length > 0 && (
              <span className="bnav-badge">{windows.length}</span>
            )}
          </button>
        </div>
      </nav>

      <IAChatFlotante />

      {/* ── Ventanas flotantes + barra de tareas ────────────────────────── */}
      {windows.map(win => <FloatingWindow key={win.id} win={win} />)}
      <TaskBar />
    </>
  );
}
