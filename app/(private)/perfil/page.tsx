"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  matricula: string | null;
  telefono: string | null;
  email: string | null;
  inmobiliaria: string | null;
  especialidades: string[] | null;
  foto_url: string | null;
  cuit: string | null;
  condicion_iva: string | null;
  iibb: string | null;
  zona_trabajo: string | null;
  anos_experiencia: number | null;
  web_propia: string | null;
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
  whatsapp_negocio: string | null;
  telegram: string | null;
  portal_propio: string | null;
  asociaciones: string | null;
  certificaciones: string | null;
  idiomas: string[] | null;
  descripcion_inmobiliaria: string | null;
  horario_atencion: string | null;
  cant_empleados: number | null;
  cant_administraciones_declaradas: number | null;
  bio: string | null;
  socio_cir: boolean;
  tipo: string;
  estado: string;
  created_at: string;
  insignia_mentor: boolean;
  insignia_tasador: boolean;
  notif_eventos: boolean;
  notif_matches: boolean;
  notif_cotizaciones: boolean;
  notif_comunicados: boolean;
  notif_foro: boolean;
  notif_canal_push: boolean;
  notif_canal_email: boolean;
  notif_canal_whatsapp: boolean;
  celular_oficina: string | null;
  celular_personal: string | null;
  celular_mostrar: "oficina" | "personal" | null;
  modo_silencioso: boolean;
  silencioso_hasta: string | null;
  mfa_habilitado: boolean;
  cocir_estado: string | null;
}

const ESPECIALIDADES_OPCIONES = [
  "Ventas", "Alquileres", "Alquileres temporarios", "Loteos",
  "Comercial", "Fondos de comercio", "Campos", "Tasaciones",
  "Administración de consorcios", "Desarrollos inmobiliarios",
];

// Se guarda el código corto de AFIP en la base; la etiqueta es solo para la UI.
const CONDICIONES_IVA: { code: string; label: string }[] = [
  { code: "RI", label: "Responsable inscripto" },
  { code: "MT", label: "Monotributista" },
  { code: "CF", label: "Consumidor final" },
  { code: "EX", label: "Exento" },
];

const IDIOMAS_OPCIONES = [
  "Español", "Inglés", "Portugués", "Italiano", "Francés", "Alemán", "Chino", "Árabe",
];

const SECCIONES = [
  { id: "personal", label: "Datos personales", icon: "👤" },
  { id: "profesional", label: "Datos profesionales", icon: "🏢" },
  { id: "notificaciones", label: "Notificaciones", icon: "🔔" },
  { id: "seguridad", label: "Seguridad", icon: "🔒" },
  { id: "suscripcion", label: "Suscripción", icon: "💰" },
  { id: "reputacion", label: "Reputación", icon: "⭐" },
];

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [seccion, setSeccion] = useState("personal");
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [pushActivo, setPushActivo] = useState(false);
  const [pushCargando, setPushCargando] = useState(false);
  const [cambioPassword, setCambioPassword] = useState({ actual: "", nueva: "", confirmar: "" });
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [repStats, setRepStats] = useState({ docs: 0, comparables: 0, meses: 0, tasaciones: 0, propiedades: 0, negocios: 0, networking: 0, foro: 0, referidos: 0 });
  const [bonConfig, setBonConfig] = useState<{ accion: string; label: string; descuento_usd: number; activo: boolean }[]>([]);
  const [bonHistorial, setBonHistorial] = useState<{ accion: string; mes: string; descuento_aplicado: number }[]>([]);
  const [cocirSyncState, setCocirSyncState] = useState<"idle" | "loading" | "preview" | "applying">("idle");
  const [cocirSyncData, setCocirSyncData] = useState<{ telefono: string | null; email: string | null; inmobiliaria: string | null } | null>(null);
  const [cocirSyncError, setCocirSyncError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      setUserEmail(data.user.email ?? null);
      const { data: p } = await supabase.from("perfiles").select("*").eq("id", data.user.id).single();
      if (p) {
        setPerfil(p as Perfil);
        const meses = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30));
        const sc = async (q: Promise<{ count: number | null }>) => { try { const r = await q; return r.count ?? 0; } catch { return 0; } };
        const [docs, comparables, tasaciones, propiedades, negocios, networking, foro, referidos] = await Promise.all([
          sc(supabase.from("biblioteca").select("id", { count: "exact", head: true }).eq("perfil_id", data.user.id).eq("estado", "aprobado") as any),
          sc(supabase.from("comparables").select("id", { count: "exact", head: true }).eq("perfil_id", data.user.id) as any),
          sc(supabase.from("tasaciones_historial").select("id", { count: "exact", head: true }).eq("usuario_id", data.user.id) as any),
          sc(supabase.from("cartera_propiedades").select("id", { count: "exact", head: true }).eq("perfil_id", data.user.id) as any),
          sc(supabase.from("crm_negocios").select("id", { count: "exact", head: true }).eq("perfil_id", data.user.id).eq("etapa", "cerrado") as any),
          sc(supabase.from("networking_posts").select("id", { count: "exact", head: true }).eq("user_id", data.user.id) as any),
          sc(supabase.from("forum_replies").select("id", { count: "exact", head: true }).eq("author_id", data.user.id) as any),
          sc(supabase.from("referidos").select("id", { count: "exact", head: true }).eq("referidor_id", data.user.id) as any),
        ]);
        setRepStats({ docs, comparables, meses, tasaciones, propiedades, negocios, networking, foro, referidos });
        const mesCurrent = new Date().toISOString().slice(0, 7);
        const [{ data: bc }, { data: bh }] = await Promise.all([
          supabase.from("bonificaciones_config").select("accion,label,descuento_usd,activo").eq("activo", true),
          supabase.from("bonificaciones_historial").select("accion,mes,descuento_aplicado").eq("perfil_id", data.user.id).eq("mes", mesCurrent),
        ]);
        if (bc) setBonConfig(bc as { accion: string; label: string; descuento_usd: number; activo: boolean }[]);
        if (bh) setBonHistorial(bh as { accion: string; mes: string; descuento_aplicado: number }[]);
      }
      setLoading(false);

      // Verificar push
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushActivo(!!sub);
      }
    };
    init();
  }, []);

  const mostrarToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const sincronizarCOCIR = async () => {
    setCocirSyncState("loading");
    setCocirSyncError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setCocirSyncState("idle"); return; }
    const res = await fetch("/api/cocir/sync-profile", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) { setCocirSyncError(json.error ?? "Error al consultar COCIR."); setCocirSyncState("idle"); return; }
    setCocirSyncData(json.cocir);
    setCocirSyncState("preview");
  };

  const aplicarCOCIR = () => {
    if (!cocirSyncData || !perfil) return;
    const updates: Partial<Perfil> = {};
    if (cocirSyncData.telefono && !perfil.telefono) updates.telefono = cocirSyncData.telefono;
    if (cocirSyncData.email && !perfil.email) updates.email = cocirSyncData.email;
    if (cocirSyncData.inmobiliaria && !perfil.inmobiliaria) updates.inmobiliaria = cocirSyncData.inmobiliaria;
    setPerfil(prev => prev ? { ...prev, ...updates } : prev);
    setCocirSyncState("idle");
    setCocirSyncData(null);
    mostrarToast("Datos de COCIR aplicados. Guardá para confirmar.");
  };

  const guardar = async () => {
    if (!perfil || !userId) return;
    setGuardando(true);
    const { error } = await supabase.from("perfiles").update({
      nombre: perfil.nombre,
      apellido: perfil.apellido,
      dni: perfil.dni,
      telefono: perfil.telefono,
      email: perfil.email,
      inmobiliaria: perfil.inmobiliaria,
      especialidades: perfil.especialidades,
      foto_url: perfil.foto_url,
      cuit: perfil.cuit,
      condicion_iva: perfil.condicion_iva,
      iibb: perfil.iibb,
      zona_trabajo: perfil.zona_trabajo,
      anos_experiencia: perfil.anos_experiencia,
      web_propia: perfil.web_propia,
      instagram: perfil.instagram,
      linkedin: perfil.linkedin,
      facebook: perfil.facebook,
      tiktok: perfil.tiktok,
      youtube: perfil.youtube,
      whatsapp_negocio: perfil.whatsapp_negocio,
      telegram: perfil.telegram,
      portal_propio: perfil.portal_propio,
      asociaciones: perfil.asociaciones,
      certificaciones: perfil.certificaciones,
      idiomas: perfil.idiomas,
      descripcion_inmobiliaria: perfil.descripcion_inmobiliaria,
      horario_atencion: perfil.horario_atencion,
      cant_empleados: perfil.cant_empleados,
      cant_administraciones_declaradas: perfil.cant_administraciones_declaradas,
      bio: perfil.bio,
      socio_cir: perfil.socio_cir,
      notif_eventos: perfil.notif_eventos,
      notif_matches: perfil.notif_matches,
      notif_cotizaciones: perfil.notif_cotizaciones,
      notif_comunicados: perfil.notif_comunicados,
      notif_foro: perfil.notif_foro,
      notif_canal_push: perfil.notif_canal_push,
      notif_canal_email: perfil.notif_canal_email,
      notif_canal_whatsapp: perfil.notif_canal_whatsapp,
      celular_oficina: perfil.celular_oficina,
      celular_personal: perfil.celular_personal,
      celular_mostrar: perfil.celular_mostrar,
      modo_silencioso: perfil.modo_silencioso,
      silencioso_hasta: perfil.silencioso_hasta ?? null,
    }).eq("id", userId);
    setGuardando(false);
    if (error) { mostrarToast("Error al guardar", "err"); return; }
    mostrarToast("Perfil guardado");
  };

  const toggleEspecialidad = (esp: string) => {
    if (!perfil) return;
    const actual = perfil.especialidades ?? [];
    const nueva = actual.includes(esp)
      ? actual.filter(e => e !== esp)
      : [...actual, esp];
    setPerfil({ ...perfil, especialidades: nueva });
  };

  const toggleIdioma = (idioma: string) => {
    if (!perfil) return;
    const actual = perfil.idiomas ?? [];
    const nueva = actual.includes(idioma)
      ? actual.filter(e => e !== idioma)
      : [...actual, idioma];
    setPerfil({ ...perfil, idiomas: nueva });
  };

  const activarPush = async () => {
    if (!userId) return;
    setPushCargando(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { mostrarToast("Permiso denegado", "err"); setPushCargando(false); return; }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { mostrarToast("Push no configurado (clave VAPID ausente)", "err"); setPushCargando(false); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), perfil_id: userId, eventos: true }),
      });
      setPushActivo(true);
      mostrarToast("Notificaciones push activadas");
    } catch { mostrarToast("Error activando push", "err"); }
    setPushCargando(false);
  };

  const desactivarPush = async () => {
    if (!userId) return;
    setPushCargando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perfil_id: userId, endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushActivo(false);
      mostrarToast("Notificaciones push desactivadas");
    } catch { mostrarToast("Error desactivando push", "err"); }
    setPushCargando(false);
  };

  const cambiarContrasena = async () => {
    if (!cambioPassword.actual) {
      mostrarToast("Ingresá tu contraseña actual", "err"); return;
    }
    if (!cambioPassword.nueva || cambioPassword.nueva !== cambioPassword.confirmar) {
      mostrarToast("Las contraseñas no coinciden", "err"); return;
    }
    if (cambioPassword.nueva.length < 8) {
      mostrarToast("La contraseña debe tener al menos 8 caracteres", "err"); return;
    }
    if (!userEmail) { mostrarToast("Error de sesión, volvé a iniciar", "err"); return; }
    setCambiandoPassword(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: userEmail, password: cambioPassword.actual });
    if (authError) {
      setCambiandoPassword(false);
      mostrarToast("La contraseña actual es incorrecta", "err"); return;
    }
    const { error } = await supabase.auth.updateUser({ password: cambioPassword.nueva });
    setCambiandoPassword(false);
    if (error) { mostrarToast("Error al cambiar contraseña", "err"); return; }
    mostrarToast("Contraseña actualizada");
    setCambioPassword({ actual: "", nueva: "", confirmar: "" });
  };

  const set = (campo: keyof Perfil, valor: any) => {
    if (!perfil) return;
    setPerfil({ ...perfil, [campo]: valor });
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64 }}>
      <div style={{ width: 28, height: 28, border: "2px solid var(--gfi-red-soft)", borderTopColor: "var(--gfi-red)", borderRadius: "50%", animation: "gfi-spin 0.7s linear infinite" }} />
    </div>
  );

  if (!perfil) return null;

  const iniciales = `${perfil.nombre?.charAt(0) ?? ""}${perfil.apellido?.charAt(0) ?? ""}`.toUpperCase();
  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <style>{`
        .pf-wrap { display: flex; gap: 24px; align-items: flex-start; }
        .pf-sidebar { width: 228px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 84px; }
        .pf-avatar-box { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); padding: 20px 16px; text-align: center; margin-bottom: 8px; position: relative; overflow: hidden; }
        .pf-avatar-box::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--gfi-red) 0%, rgba(153,0,0,0.1) 70%, transparent 100%); }
        .pf-avatar { width: 76px; height: 76px; border-radius: 50%; background: var(--gfi-red-soft); border: 2px solid var(--gfi-red-border); box-shadow: 0 0 0 3px var(--gfi-bg-card), 0 0 0 5px var(--gfi-red-border); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 26px; font-weight: 800; color: var(--gfi-red); margin: 0 auto 14px; overflow: hidden; }
        .pf-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .pf-avatar-nombre { font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--gfi-text-primary); }
        .pf-avatar-mat { font-size: 11px; font-family: var(--font-mono); color: var(--gfi-red); margin-top: 4px; letter-spacing: 0.04em; }
        .pf-avatar-tipo { display: inline-block; margin-top: 8px; padding: 3px 10px; background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); border-radius: 20px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gfi-red); font-family: var(--font-display); }
        .pf-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--gfi-radius-md); cursor: pointer; transition: var(--gfi-transition); border: 1px solid transparent; }
        .pf-nav-item:hover { background: var(--gfi-bg-hover); }
        .pf-nav-item.activo { background: var(--gfi-red-soft); border-color: var(--gfi-red-border); }
        .pf-nav-icon { font-size: 15px; width: 20px; text-align: center; }
        .pf-nav-label { font-size: 12px; font-weight: 500; color: var(--gfi-text-secondary); font-family: var(--font-body); }
        .pf-nav-item.activo .pf-nav-label { color: var(--gfi-text-primary); }
        .pf-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; }
        .pf-section { background: var(--gfi-bg-card); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-lg); padding: 24px 28px; position: relative; overflow: hidden; }
        .pf-section::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,0.012) 0%, transparent 60%); pointer-events: none; }
        .pf-section-title { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--gfi-text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
        .pf-section-title span { color: var(--gfi-red); }
        .pf-section-sub { font-size: 12px; color: var(--gfi-text-secondary); margin-bottom: 20px; }
        .pf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .pf-grid.full { grid-template-columns: 1fr; }
        .pf-grid .span2 { grid-column: 1 / -1; }
        .pf-field { display: flex; flex-direction: column; gap: 6px; }
        .pf-label { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gfi-text-muted); }
        .pf-input { padding: 10px 13px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); transition: var(--gfi-transition); width: 100%; }
        .pf-input:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .pf-input::placeholder { color: var(--gfi-text-muted); }
        .pf-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .pf-select { padding: 10px 13px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); width: 100%; }
        .pf-select:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .pf-textarea { padding: 10px 13px; background: var(--gfi-bg-input); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-primary); font-size: 13px; outline: none; font-family: var(--font-body); resize: vertical; min-height: 90px; transition: var(--gfi-transition); width: 100%; }
        .pf-textarea:focus { border-color: var(--gfi-red); box-shadow: 0 0 0 3px var(--gfi-red-soft); }
        .pf-textarea::placeholder { color: var(--gfi-text-muted); }
        .pf-subsection-title { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gfi-text-muted); margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid var(--gfi-border-subtle); }
        .esp-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        .esp-tag { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-secondary); font-size: 11px; font-weight: 600; cursor: pointer; transition: var(--gfi-transition); font-family: var(--font-display); }
        .esp-tag:hover { border-color: var(--gfi-red-border); color: var(--gfi-text-primary); }
        .esp-tag.activo { border-color: var(--gfi-red); background: var(--gfi-red-soft); color: var(--gfi-text-primary); }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--gfi-border-subtle); }
        .toggle-row:last-child { border-bottom: none; }
        .toggle-info { display: flex; flex-direction: column; gap: 3px; }
        .toggle-label { font-size: 13px; color: var(--gfi-text-primary); font-weight: 500; }
        .toggle-sub { font-size: 11px; color: var(--gfi-text-secondary); }
        .toggle-btn { width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .toggle-btn.on { background: var(--gfi-red); }
        .toggle-btn.off { background: var(--gfi-border); }
        .toggle-knob { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.2s; }
        .toggle-btn.on .toggle-knob { left: 23px; }
        .toggle-btn.off .toggle-knob { left: 3px; }
        .notif-canal { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
        .canal-btn { padding: 7px 16px; border-radius: 20px; border: 1px solid var(--gfi-border); background: transparent; color: var(--gfi-text-secondary); font-size: 11px; font-weight: 700; cursor: pointer; transition: var(--gfi-transition); font-family: var(--font-display); letter-spacing: 0.08em; display: flex; align-items: center; gap: 6px; }
        .canal-btn.on { border-color: var(--gfi-red); background: var(--gfi-red-soft); color: var(--gfi-text-primary); }
        .push-status { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--gfi-bg-secondary); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); margin-top: 8px; }
        .push-status.activo { border-color: rgba(58,186,182,0.25); background: var(--gfi-green-soft); }
        .push-info { display: flex; flex-direction: column; gap: 3px; }
        .push-label { font-size: 13px; color: var(--gfi-text-primary); font-weight: 500; }
        .push-sub { font-size: 11px; color: var(--gfi-text-secondary); }
        .push-btn { padding: 8px 18px; border-radius: var(--gfi-radius-md); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); border: 1px solid; white-space: nowrap; }
        .push-btn.activar { background: var(--gfi-red-gradient); border-color: transparent; color: #fff; box-shadow: var(--gfi-shadow-red); }
        .push-btn.activar:hover { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }
        .push-btn.desactivar { background: transparent; border-color: var(--gfi-border); color: var(--gfi-text-secondary); }
        .push-btn.desactivar:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .push-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
        .seg-divider { height: 1px; background: linear-gradient(90deg, var(--gfi-border) 0%, transparent 100%); margin: 16px 0; }
        .rep-badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 10px; margin-top: 8px; }
        .rep-badge { padding: 12px 14px; border-radius: var(--gfi-radius-md); background: var(--gfi-bg-secondary); border: 1px solid var(--gfi-border); font-size: 12px; font-weight: 600; color: var(--gfi-text-secondary); font-family: var(--font-display); display: flex; align-items: flex-start; gap: 10px; transition: var(--gfi-transition); }
        .rep-badge.earned { background: var(--gfi-red-soft); border-color: var(--gfi-red-border); color: var(--gfi-text-primary); }
        .rep-badge.gold { background: rgba(180,140,40,0.08); border-color: rgba(180,140,40,0.3); }
        .rep-badge.silver { background: rgba(148,163,184,0.08); border-color: rgba(148,163,184,0.25); }
        .rep-badge.bronze { background: rgba(180,120,60,0.08); border-color: rgba(180,120,60,0.25); }
        .rep-badge-ico { font-size: 22px; line-height: 1; flex-shrink: 0; filter: grayscale(1); opacity: 0.4; }
        .rep-badge.earned .rep-badge-ico { filter: none; opacity: 1; }
        .rep-badge-body { flex: 1; min-width: 0; }
        .rep-badge-name { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 3px; color: inherit; }
        .rep-badge-desc { font-size: 10px; font-weight: 400; color: var(--gfi-text-secondary); line-height: 1.4; }
        .rep-badge.earned .rep-badge-desc { color: var(--gfi-red); }
        .rep-badge-prog { margin-top: 5px; height: 3px; background: var(--gfi-border); border-radius: 2px; overflow: hidden; }
        .rep-badge-prog-fill { height: 100%; background: var(--gfi-red); border-radius: 2px; transition: width 0.5s; }
        .rep-badge.gold .rep-badge-prog-fill { background: #b8a028; }
        .rep-badge.silver .rep-badge-prog-fill { background: #94a3b8; }
        .rep-badge.bronze .rep-badge-prog-fill { background: #b47c3c; }
        .rep-stat { display: flex; flex-direction: column; gap: 4px; background: var(--gfi-bg-elevated); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); padding: 14px 18px; }
        .rep-stat-val { font-family: var(--font-display); font-size: 24px; font-weight: 900; color: var(--gfi-red); line-height: 1; font-variant-numeric: tabular-nums; }
        .rep-stat-label { font-size: 11px; color: var(--gfi-text-secondary); margin-top: 4px; }
        .rep-tier-label { font-family: var(--font-display); font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; margin: 16px 0 8px; padding: 4px 10px; border-radius: var(--gfi-radius-sm); display: inline-block; }
        .rep-tier-label.bronce { background: rgba(180,120,60,0.12); color: rgba(180,120,60,0.8); }
        .rep-tier-label.plata { background: rgba(148,163,184,0.12); color: rgba(148,163,184,0.8); }
        .rep-tier-label.oro { background: rgba(180,140,40,0.12); color: rgba(180,140,40,0.8); }
        .rep-tier-label.especial { background: var(--gfi-red-soft); color: var(--gfi-red); }
        .sus-plan { background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); border-radius: var(--gfi-radius-md); padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .sus-plan-nombre { font-family: var(--font-display); font-size: 15px; font-weight: 800; color: var(--gfi-text-primary); }
        .sus-plan-precio { font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: var(--gfi-red); font-variant-numeric: tabular-nums; }
        .sus-plan-sub { font-size: 11px; color: var(--gfi-text-secondary); margin-top: 2px; }
        .pf-save-bar { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; margin-top: 4px; border-top: 1px solid var(--gfi-border-subtle); }
        .btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); color: var(--gfi-text-secondary); font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: var(--gfi-transition); }
        .btn-cancel:hover { border-color: var(--gfi-border-bright); color: var(--gfi-text-primary); }
        .btn-save { padding: 10px 24px; background: var(--gfi-red-gradient); border: none; border-radius: var(--gfi-radius-md); color: #fff; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: var(--gfi-shadow-red); transition: var(--gfi-transition); }
        .btn-save:hover:not(:disabled) { box-shadow: var(--gfi-shadow-red-lg); transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
        .cir-toggle { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--gfi-bg-secondary); border: 1px solid var(--gfi-border); border-radius: var(--gfi-radius-md); cursor: pointer; transition: var(--gfi-transition); }
        .cir-toggle:hover { border-color: var(--gfi-border-bright); }
        .cir-toggle.activo { border-color: var(--gfi-red-border); background: var(--gfi-red-soft); }
        .cir-label { font-size: 13px; color: var(--gfi-text-secondary); flex: 1; }
        .cir-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; font-family: var(--font-display); }
        .cir-badge.on { background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); color: var(--gfi-red); }
        .cir-badge.off { background: var(--gfi-border-subtle); border: 1px solid var(--gfi-border); color: var(--gfi-text-muted); }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: var(--gfi-radius-md); font-family: var(--font-display); font-size: 12px; font-weight: 700; z-index: 999; animation: gfi-fade-in 0.3s ease; }
        .toast.ok { background: rgba(10,61,46,0.6); border: 1px solid rgba(58,186,182,0.35); color: var(--gfi-green-text); }
        .toast.err { background: var(--gfi-red-soft); border: 1px solid var(--gfi-red-border); color: #ff6666; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .pf-wrap { flex-direction: column; }
          .pf-sidebar { width: 100%; position: static; flex-direction: row; flex-wrap: wrap; }
          .pf-grid { grid-template-columns: 1fr; }
          .pf-grid .span2 { grid-column: 1; }
        }
      `}</style>

      <div className="pf-wrap">
        {/* Sidebar */}
        <div className="pf-sidebar">
          <div className="pf-avatar-box">
            <div className="pf-avatar">
              {perfil.foto_url ? <img src={perfil.foto_url} alt="Foto" /> : iniciales}
            </div>
            <div className="pf-avatar-nombre">{perfil.apellido}, {perfil.nombre}</div>
            {perfil.matricula && <div className="pf-avatar-mat">Mat. {perfil.matricula}</div>}
            <div className="pf-avatar-tipo">{perfil.tipo === "master" ? "★ Máster" : perfil.tipo === "admin" ? "⚙ Admin" : "Corredor"}</div>
            {perfil.estado && (
              <div style={{ marginTop: 8 }}>
                <span className={`gfi-badge gfi-badge--dot ${perfil.estado === "activo" ? "gfi-badge--green" : "gfi-badge--red"}`}>
                  {perfil.estado === "activo" ? "Activo" : perfil.estado}
                </span>
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--gfi-text-muted)", fontFamily: "var(--font-body)" }}>
              Desde {formatFecha(perfil.created_at)}
            </div>
          </div>

          {SECCIONES.map(s => (
            <div
              key={s.id}
              className={`pf-nav-item${seccion === s.id ? " activo" : ""}`}
              onClick={() => setSeccion(s.id)}
            >
              <span className="pf-nav-icon">{s.icon}</span>
              <span className="pf-nav-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Contenido */}
        <div className="pf-content">

          {/* DATOS PERSONALES */}
          {seccion === "personal" && (
            <div className="pf-section">
              <div className="pf-section-title">👤 Datos <span>personales</span></div>
              <div className="pf-section-sub">Información básica de tu cuenta y datos fiscales</div>
              <div className="pf-grid">
                <div className="pf-field">
                  <label className="pf-label">Nombre *</label>
                  <input className="pf-input" value={perfil.nombre ?? ""} onChange={e => set("nombre", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Apellido *</label>
                  <input className="pf-input" value={perfil.apellido ?? ""} onChange={e => set("apellido", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">DNI</label>
                  <input className="pf-input" placeholder="12345678" value={perfil.dni ?? ""} onChange={e => set("dni", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Matrícula COCIR</label>
                  <input className="pf-input" value={perfil.matricula ?? ""} disabled />
                  {perfil.matricula && (
                    <div style={{ marginTop: 8 }}>
                      {cocirSyncState === "idle" && (
                        <button onClick={sincronizarCOCIR} style={{ background: "var(--gfi-red-soft)", border: "1px solid var(--gfi-red-border)", borderRadius: "var(--gfi-radius-md)", color: "var(--gfi-red)", fontSize: 11, fontWeight: 700, padding: "5px 12px", cursor: "pointer", fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          <span>↻</span> Sincronizar con COCIR
                        </button>
                      )}
                      {cocirSyncState === "loading" && (
                        <span style={{ fontSize: 11, color: "var(--gfi-text-muted)", fontStyle: "italic" }}>Consultando COCIR…</span>
                      )}
                      {cocirSyncError && (
                        <span style={{ fontSize: 11, color: "var(--gfi-red)" }}>{cocirSyncError}</span>
                      )}
                      {cocirSyncState === "preview" && cocirSyncData && (
                        <div style={{ background: "var(--gfi-bg-elevated)", border: "1px solid var(--gfi-red-border)", borderRadius: "var(--gfi-radius-md)", padding: "10px 14px", marginTop: 4 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--gfi-red)", fontFamily: "var(--font-display)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>Datos en COCIR</div>
                          {[
                            { label: "Teléfono", val: cocirSyncData.telefono },
                            { label: "Email", val: cocirSyncData.email },
                            { label: "Inmobiliaria", val: cocirSyncData.inmobiliaria },
                          ].filter(f => f.val).map(f => (
                            <div key={f.label} style={{ fontSize: 12, color: "var(--gfi-text-primary)", marginBottom: 3 }}>
                              <span style={{ color: "var(--gfi-text-secondary)", width: 80, display: "inline-block" }}>{f.label}:</span> {f.val}
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button onClick={aplicarCOCIR} style={{ padding: "5px 14px", background: "var(--gfi-red-gradient)", border: "none", borderRadius: "var(--gfi-radius-md)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-display)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Aplicar campos vacíos</button>
                            <button onClick={() => { setCocirSyncState("idle"); setCocirSyncData(null); }} style={{ padding: "5px 10px", background: "none", border: "1px solid var(--gfi-border)", borderRadius: "var(--gfi-radius-md)", color: "var(--gfi-text-secondary)", fontSize: 11, cursor: "pointer" }}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="pf-field">
                  <label className="pf-label">Teléfono / WhatsApp</label>
                  <input className="pf-input" placeholder="3412345678" value={perfil.telefono ?? ""} onChange={e => set("telefono", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Email</label>
                  <input className="pf-input" type="email" placeholder="correo@ejemplo.com" value={perfil.email ?? ""} onChange={e => set("email", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">CUIT</label>
                  <input className="pf-input" placeholder="20-12345678-9" value={perfil.cuit ?? ""} onChange={e => set("cuit", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Condición IVA</label>
                  <select className="pf-select" value={perfil.condicion_iva ?? ""} onChange={e => set("condicion_iva", e.target.value)}>
                    <option value="">Seleccioná</option>
                    {CONDICIONES_IVA.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                <div className="pf-field">
                  <label className="pf-label">IIBB (Ingresos Brutos)</label>
                  <input className="pf-input" placeholder="Nro. de IIBB" value={perfil.iibb ?? ""} onChange={e => set("iibb", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Foto de perfil (URL)</label>
                  <input className="pf-input" placeholder="https://..." value={perfil.foto_url ?? ""} onChange={e => set("foto_url", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Celular oficina</label>
                  <input className="pf-input" placeholder="3412345678" value={perfil.celular_oficina ?? ""} onChange={e => set("celular_oficina", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Celular personal</label>
                  <input className="pf-input" placeholder="3412345678" value={perfil.celular_personal ?? ""} onChange={e => set("celular_personal", e.target.value)} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">Celular público (el que ven otros usuarios)</label>
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    {(["personal", "oficina"] as const).map(op => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => set("celular_mostrar", op)}
                        style={{
                          padding: "7px 18px",
                          borderRadius: 20,
                          border: `1px solid ${perfil.celular_mostrar === op ? "var(--gfi-red)" : "var(--gfi-border)"}`,
                          background: perfil.celular_mostrar === op ? "var(--gfi-red-soft)" : "transparent",
                          color: perfil.celular_mostrar === op ? "var(--gfi-text-primary)" : "var(--gfi-text-secondary)",
                          fontFamily: "var(--font-display)",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          textTransform: "capitalize",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {op === "personal" ? "Personal" : "Oficina"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Socio CIR */}
                <div className="span2">
                  <div
                    className={`cir-toggle${perfil.socio_cir ? " activo" : ""}`}
                    onClick={() => set("socio_cir", !perfil.socio_cir)}
                  >
                    <span style={{ fontSize: 18 }}>🏛️</span>
                    <span className="cir-label">Socio del CIR (Cámara Inmobiliaria de Rosario)</span>
                    <span className={`cir-badge ${perfil.socio_cir ? "on" : "off"}`}>
                      {perfil.socio_cir ? "Sí, soy socio" : "No soy socio"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pf-save-bar">
                <button className="btn-save" onClick={guardar} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          )}

          {/* DATOS PROFESIONALES */}
          {seccion === "profesional" && (
            <div className="pf-section">
              <div className="pf-section-title">🏢 Datos <span>profesionales</span></div>
              <div className="pf-section-sub">Tu presencia profesional en la red GFI® — más datos = más visibilidad</div>

              {/* Inmobiliaria */}
              <div className="pf-subsection-title" style={{ marginTop: 4 }}>
                Datos de la inmobiliaria
              </div>
              <div className="pf-grid">
                <div className="pf-field">
                  <label className="pf-label">Inmobiliaria / Empresa</label>
                  <input className="pf-input" placeholder="Nombre de tu inmobiliaria" value={perfil.inmobiliaria ?? ""} onChange={e => set("inmobiliaria", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Zona de trabajo</label>
                  <input className="pf-input" placeholder="Ej: Norte, Centro, Fisherton..." value={perfil.zona_trabajo ?? ""} onChange={e => set("zona_trabajo", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Años de experiencia</label>
                  <input className="pf-input" type="number" min="0" max="60" placeholder="Ej: 10" value={perfil.anos_experiencia ?? ""} onChange={e => set("anos_experiencia", parseInt(e.target.value) || null)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Cantidad de empleados</label>
                  <input className="pf-input" type="number" min="1" placeholder="Ej: 5" value={perfil.cant_empleados ?? ""} onChange={e => set("cant_empleados", parseInt(e.target.value) || null)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Administraciones / Consorcios gestionados</label>
                  <input className="pf-input" type="number" min="1" placeholder="Ej: 80" value={perfil.cant_administraciones_declaradas ?? ""} onChange={e => set("cant_administraciones_declaradas", parseInt(e.target.value) || null)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Horario de atención</label>
                  <input className="pf-input" placeholder="Ej: Lun-Vie 9-18 / Sáb 9-13" value={perfil.horario_atencion ?? ""} onChange={e => set("horario_atencion", e.target.value)} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">Descripción de la inmobiliaria</label>
                  <textarea className="pf-textarea" placeholder="Describí tu inmobiliaria: servicios, valores, diferencial frente a otras..." value={perfil.descripcion_inmobiliaria ?? ""} onChange={e => set("descripcion_inmobiliaria", e.target.value)} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">Bio profesional</label>
                  <textarea className="pf-textarea" placeholder="Contá brevemente tu perfil profesional, tu especialidad, qué ofrecés a tus clientes..." value={perfil.bio ?? ""} onChange={e => set("bio", e.target.value)} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">Especialidades</label>
                  <div className="esp-grid">
                    {ESPECIALIDADES_OPCIONES.map(esp => (
                      <button
                        key={esp}
                        className={`esp-tag${(perfil.especialidades ?? []).includes(esp) ? " activo" : ""}`}
                        onClick={() => toggleEspecialidad(esp)}
                      >
                        {esp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Presencia digital */}
              <div className="pf-subsection-title" style={{ marginTop: 24 }}>
                Presencia digital y redes sociales
              </div>
              <div className="pf-grid">
                <div className="pf-field">
                  <label className="pf-label">🌐 Web propia</label>
                  <input className="pf-input" placeholder="https://tuweb.com.ar" value={perfil.web_propia ?? ""} onChange={e => set("web_propia", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">🏠 Portal inmobiliario propio</label>
                  <input className="pf-input" placeholder="https://tuportal.com.ar" value={perfil.portal_propio ?? ""} onChange={e => set("portal_propio", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">📸 Instagram</label>
                  <input className="pf-input" placeholder="@tuusuario" value={perfil.instagram ?? ""} onChange={e => set("instagram", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">💼 LinkedIn</label>
                  <input className="pf-input" placeholder="linkedin.com/in/..." value={perfil.linkedin ?? ""} onChange={e => set("linkedin", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">👥 Facebook</label>
                  <input className="pf-input" placeholder="facebook.com/tupagina" value={perfil.facebook ?? ""} onChange={e => set("facebook", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">🎵 TikTok</label>
                  <input className="pf-input" placeholder="@tuusuario" value={perfil.tiktok ?? ""} onChange={e => set("tiktok", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">▶️ YouTube</label>
                  <input className="pf-input" placeholder="youtube.com/@tucanal" value={perfil.youtube ?? ""} onChange={e => set("youtube", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">💬 Telegram</label>
                  <input className="pf-input" placeholder="@tuusuario" value={perfil.telegram ?? ""} onChange={e => set("telegram", e.target.value)} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">📲 WhatsApp de negocio</label>
                  <input className="pf-input" placeholder="Ej: 5493412345678 (con código de país)" value={perfil.whatsapp_negocio ?? ""} onChange={e => set("whatsapp_negocio", e.target.value)} />
                </div>
              </div>

              {/* Formación y asociaciones */}
              <div className="pf-subsection-title" style={{ marginTop: 24 }}>
                Formación y trayectoria
              </div>
              <div className="pf-grid">
                <div className="pf-field span2">
                  <label className="pf-label">Asociaciones / Colegios profesionales</label>
                  <input className="pf-input" placeholder="Ej: COCIR, CIR, CUCICBA, Cámara de..." value={perfil.asociaciones ?? ""} onChange={e => set("asociaciones", e.target.value)} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">Certificaciones y capacitaciones</label>
                  <textarea className="pf-textarea" style={{ minHeight: 70 }} placeholder="Ej: Tasador UTDT, Certificado IUCEA, Posgrado en negocios inmobiliarios..." value={perfil.certificaciones ?? ""} onChange={e => set("certificaciones", e.target.value)} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">Idiomas</label>
                  <div className="esp-grid">
                    {IDIOMAS_OPCIONES.map(idioma => (
                      <button
                        key={idioma}
                        className={`esp-tag${(perfil.idiomas ?? []).includes(idioma) ? " activo" : ""}`}
                        onClick={() => toggleIdioma(idioma)}
                      >
                        {idioma}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pf-save-bar">
                <button className="btn-save" onClick={guardar} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          )}

          {/* TARJETA DIGITAL Y QR */}
          {seccion === "profesional" && perfil.matricula && (
            <div className="pf-section" style={{ marginTop: 16 }}>
              <div className="pf-section-title">📇 Tarjeta <span>digital</span></div>
              <div className="pf-section-sub">Tu tarjeta profesional y QR para compartir con clientes</div>

              {/* Preview tarjeta */}
              <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-red-border)", borderRadius: "var(--gfi-radius-lg)", padding: "20px 24px", marginBottom: 16, maxWidth: 380 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                  {perfil.foto_url ? (
                    <img src={perfil.foto_url} alt="Foto" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 10, background: "rgba(153,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "#990000" }}>
                      {perfil.nombre?.charAt(0)}{perfil.apellido?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "#fff" }}>{perfil.nombre} {perfil.apellido}</div>
                    {perfil.inmobiliaria && <div style={{ fontSize: 11, color: "var(--gfi-text-secondary)", marginTop: 2 }}>{perfil.inmobiliaria}</div>}
                    <div style={{ fontSize: 10, color: "#990000", marginTop: 2, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.06em" }}>Mat. {perfil.matricula} · COCIR</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {perfil.telefono && (
                    <span style={{ fontSize: 11, color: "var(--gfi-text-secondary)", background: "var(--gfi-border-subtle)", padding: "3px 10px", borderRadius: 4 }}>📞 {perfil.telefono}</span>
                  )}
                  {perfil.instagram && (
                    <span style={{ fontSize: 11, color: "var(--gfi-text-secondary)", background: "var(--gfi-border-subtle)", padding: "3px 10px", borderRadius: 4 }}>📷 @{perfil.instagram}</span>
                  )}
                </div>
              </div>

              {/* QR + botones */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://wa.me/${(perfil.telefono ?? "").replace(/\D/g, "")}`)}&bgcolor=0a0a0a&color=ffffff&margin=10`}
                    alt="QR WhatsApp"
                    style={{ width: 120, height: 120, borderRadius: 8, border: "1px solid var(--gfi-border)" }}
                  />
                  <div style={{ fontSize: 10, color: "var(--gfi-text-muted)", marginTop: 4, fontFamily: "var(--font-display)" }}>QR WhatsApp</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {perfil.telefono && (
                    <a
                      href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://wa.me/${(perfil.telefono).replace(/\D/g, "")}`)}&bgcolor=0a0a0a&color=ffffff&margin=10`}
                      download={`QR-${perfil.apellido}-GFI.png`}
                      target="_blank" rel="noreferrer"
                      style={{ padding: "8px 16px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#25d366", textDecoration: "none", fontFamily: "var(--font-display)" }}>
                      ⬇ Descargar QR
                    </a>
                  )}
                  <button
                    onClick={() => {
                      const vcard = [
                        "BEGIN:VCARD", "VERSION:3.0",
                        `FN:${perfil.nombre} ${perfil.apellido}`,
                        `N:${perfil.apellido};${perfil.nombre};;;`,
                        perfil.inmobiliaria ? `ORG:${perfil.inmobiliaria}` : "",
                        perfil.telefono ? `TEL;TYPE=CELL:${perfil.telefono}` : "",
                        `NOTE:Corredor Inmobiliario - Matrícula ${perfil.matricula} COCIR`,
                        "END:VCARD"
                      ].filter(Boolean).join("\n");
                      const blob = new Blob([vcard], { type: "text/vcard" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `${perfil.apellido}-GFI.vcf`; a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{ padding: "8px 16px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#818cf8", cursor: "pointer", fontFamily: "var(--font-display)" }}>
                    📱 Exportar vCard
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICACIONES */}
          {seccion === "notificaciones" && (
            <div className="pf-section">
              <div className="pf-section-title">🔔 <span>Notificaciones</span></div>
              <div className="pf-section-sub">Configurá qué alertas querés recibir y por qué canal</div>

              {/* Canal push */}
              <div style={{ marginBottom: 20 }}>
                <div className="pf-subsection-title" style={{ marginBottom: 10 }}>
                  Canal push (navegador)
                </div>
                <div className={`push-status${pushActivo ? " activo" : ""}`}>
                  <div className="push-info">
                    <div className="push-label">{pushActivo ? "🔔 Notificaciones push activadas" : "🔕 Notificaciones push desactivadas"}</div>
                    <div className="push-sub">
                      {pushActivo
                        ? "Recibirás alertas en este dispositivo aunque no tengas la web abierta"
                        : "Activá para recibir alertas en este dispositivo"}
                    </div>
                  </div>
                  <button
                    className={`push-btn ${pushActivo ? "desactivar" : "activar"}`}
                    onClick={pushActivo ? desactivarPush : activarPush}
                    disabled={pushCargando}
                  >
                    {pushCargando ? "..." : pushActivo ? "Desactivar" : "Activar push"}
                  </button>
                </div>
              </div>

              {/* Canales */}
              <div style={{ marginBottom: 20 }}>
                <div className="pf-subsection-title" style={{ marginBottom: 10 }}>
                  Canales activos
                </div>
                <div className="notif-canal">
                  {[
                    { key: "notif_canal_push", label: "🔔 Push", val: perfil.notif_canal_push },
                    { key: "notif_canal_email", label: "✉️ Email", val: perfil.notif_canal_email },
                    { key: "notif_canal_whatsapp", label: "📱 WhatsApp", val: perfil.notif_canal_whatsapp },
                  ].map(c => (
                    <button
                      key={c.key}
                      className={`canal-btn${c.val ? " on" : ""}`}
                      onClick={() => set(c.key as keyof Perfil, !c.val)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modo silencioso */}
              <div style={{ background: perfil.modo_silencioso ? "var(--gfi-red-soft)" : "var(--gfi-bg-secondary)", border: `1px solid ${perfil.modo_silencioso ? "var(--gfi-red-border)" : "var(--gfi-border)"}`, borderRadius: "var(--gfi-radius-md)", padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: perfil.modo_silencioso ? 12 : 0 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: perfil.modo_silencioso ? "var(--gfi-red)" : "var(--gfi-text-primary)", fontSize: 14 }}>Modo silencioso</div>
                    <div style={{ color: "var(--gfi-text-secondary)", fontSize: 12, marginTop: 2 }}>Pausá todas las notificaciones temporalmente</div>
                  </div>
                  <button className={`toggle-btn ${perfil.modo_silencioso ? "on" : "off"}`} onClick={() => set("modo_silencioso", !perfil.modo_silencioso)}>
                    <div className="toggle-knob" />
                  </button>
                </div>
                {perfil.modo_silencioso && (
                  <div>
                    <div style={{ color: "var(--gfi-text-secondary)", fontSize: 12, marginBottom: 6 }}>Silencioso hasta:</div>
                    <input type="datetime-local" value={perfil.silencioso_hasta?.slice(0, 16) ?? ""} onChange={e => set("silencioso_hasta", e.target.value || null)}
                      className="pf-input" />
                  </div>
                )}
              </div>

              {/* Tipos de notificación */}
              <div className="pf-subsection-title" style={{ marginBottom: 10 }}>
                Qué querés recibir
              </div>
              {[
                { key: "notif_eventos", label: "📅 Nuevos eventos", sub: "Desayunos, after office, webinars, capacitaciones", val: perfil.notif_eventos },
                { key: "notif_matches", label: "🔗 Matches del MIR", sub: "Cuando una propiedad coincide con una búsqueda tuya", val: perfil.notif_matches },
                { key: "notif_cotizaciones", label: "💱 Alertas de cotizaciones", sub: "Variaciones importantes en el dólar y divisas", val: perfil.notif_cotizaciones },
                { key: "notif_comunicados", label: "📢 Comunicados COCIR / CIR", sub: "Novedades institucionales y normativas", val: perfil.notif_comunicados },
                { key: "notif_foro", label: "💬 Actividad en el Foro", sub: "Respuestas a tus posts y menciones", val: perfil.notif_foro },
              ].map(n => (
                <div key={n.key} className="toggle-row">
                  <div className="toggle-info">
                    <div className="toggle-label">{n.label}</div>
                    <div className="toggle-sub">{n.sub}</div>
                  </div>
                  <button
                    className={`toggle-btn ${n.val ? "on" : "off"}`}
                    onClick={() => set(n.key as keyof Perfil, !n.val)}
                  >
                    <div className="toggle-knob" />
                  </button>
                </div>
              ))}

              <div className="pf-save-bar">
                <button className="btn-save" onClick={guardar} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar preferencias"}
                </button>
              </div>
            </div>
          )}

          {/* SEGURIDAD */}
          {seccion === "seguridad" && (
            <div className="pf-section">
              <div className="pf-section-title">🔒 <span>Seguridad</span></div>
              <div className="pf-section-sub">Contraseña y configuración de acceso</div>

              <div className="pf-subsection-title" style={{ marginBottom: 14, fontSize: 10 }}>
                Cambiar contraseña
              </div>
              <div className="pf-grid">
                <div className="pf-field span2">
                  <label className="pf-label">Contraseña actual</label>
                  <input className="pf-input" type="password" placeholder="Tu contraseña actual" value={cambioPassword.actual} onChange={e => setCambioPassword(p => ({ ...p, actual: e.target.value }))} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">Nueva contraseña</label>
                  <input className="pf-input" type="password" placeholder="Mínimo 8 caracteres" value={cambioPassword.nueva} onChange={e => setCambioPassword(p => ({ ...p, nueva: e.target.value }))} />
                </div>
                <div className="pf-field span2">
                  <label className="pf-label">Confirmar nueva contraseña</label>
                  <input className="pf-input" type="password" placeholder="Repetí la nueva contraseña" value={cambioPassword.confirmar} onChange={e => setCambioPassword(p => ({ ...p, confirmar: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn-save" onClick={cambiarContrasena} disabled={cambiandoPassword || !cambioPassword.actual || !cambioPassword.nueva || !cambioPassword.confirmar}>
                  {cambiandoPassword ? "Cambiando..." : "Cambiar contraseña"}
                </button>
              </div>

              <div className="seg-divider" />

              <div className="pf-subsection-title" style={{ marginBottom: 14, fontSize: 10 }}>
                Información de cuenta
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Tipo de cuenta", val: perfil.tipo === "master" ? "Máster GFI®" : perfil.tipo === "admin" ? "Administrador" : "Corredor matriculado" },
                  { label: "Estado", val: perfil.estado ?? "—" },
                  { label: "Miembro desde", val: formatFecha(perfil.created_at) },
                  { label: "Sesión única", val: "1 dispositivo activo a la vez" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--gfi-bg-secondary)", borderRadius: "var(--gfi-radius-sm)", border: "1px solid var(--gfi-border)" }}>
                    <span style={{ fontSize: 12, color: "var(--gfi-text-secondary)" }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: "var(--gfi-text-primary)", fontWeight: 600 }}>{item.val}</span>
                  </div>
                ))}
                {/* 2FA */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--gfi-bg-secondary)", borderRadius: "var(--gfi-radius-sm)", border: `1px solid ${perfil.mfa_habilitado ? "rgba(58,186,182,0.3)" : "var(--gfi-red-border)"}` }}>
                  <div>
                    <span style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>2FA — Doble autenticación</span>
                    {!perfil.mfa_habilitado && (
                      <div style={{ fontSize: 10, color: "var(--gfi-red)", marginTop: 2 }}>No configurado — requerido para corredores GFI®</div>
                    )}
                  </div>
                  {perfil.mfa_habilitado ? (
                    <span className="gfi-badge gfi-badge--green">✓ Activo</span>
                  ) : (
                    <a href="/configurar-2fa" style={{ fontSize: 11, color: "#fff", fontWeight: 700, background: "var(--gfi-red-gradient)", padding: "5px 12px", borderRadius: "var(--gfi-radius-md)", textDecoration: "none", fontFamily: "var(--font-display)", letterSpacing: "0.06em", textTransform: "uppercase", boxShadow: "var(--gfi-shadow-red)" }}>
                      Configurar →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUSCRIPCIÓN */}
          {seccion === "suscripcion" && (
            <div className="pf-section">
              <div className="pf-section-title">💰 <span>Suscripción</span></div>
              <div className="pf-section-sub">Plan activo y bonificaciones acumuladas</div>

              <div className="sus-plan">
                <div>
                  <div className="sus-plan-nombre">Plan GFI® — {perfil.tipo === "colaborador" ? "Colaborador" : "Corredor Matriculado"}</div>
                  <div className="sus-plan-sub">Acceso completo a todos los módulos</div>
                </div>
                <div>
                  <div className="sus-plan-precio">USD {perfil.tipo === "colaborador" ? "5" : "15"}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--gfi-text-muted)" }}>/mes</span></div>
                  <div className="sus-plan-sub">{perfil.tipo === "colaborador" ? "Gestionado por tu corredor" : "Equivalente en ARS al tipo de cambio del día"}</div>
                </div>
              </div>

              {/* MI ABONO INTELIGENTE — bonificaciones reales */}
              {(() => {
                const icoMap: Record<string, string> = { biblioteca: "📚", foro: "💬", comparables: "📊", seniority: "⭐", referidos: "👥" };
                const totalDescuento = bonHistorial.reduce((sum, h) => sum + (h.descuento_aplicado ?? 0), 0);
                const precioBase = perfil.tipo === "colaborador" ? 5 : 15;
                const precioFinal = Math.max(0, precioBase - totalDescuento);
                return (
                  <>
                    {bonConfig.length > 0 && (
                      <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(153,0,0,0.06)", border: "1px solid rgba(153,0,0,0.15)", borderRadius: 8 }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 800, color: "#990000", letterSpacing: "0.12em", marginBottom: 8 }}>MI ABONO INTELIGENTE — ESTE MES</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "#fff" }}>USD {precioFinal.toFixed(2)}</span>
                          {totalDescuento > 0 && (
                            <span style={{ fontSize: 12, color: "var(--gfi-text-muted)", textDecoration: "line-through" }}>USD {precioBase}</span>
                          )}
                          {totalDescuento > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#3abab6", fontFamily: "var(--font-display)" }}>−USD {totalDescuento.toFixed(2)}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--gfi-text-muted)" }}>
                          {totalDescuento > 0 ? `Bonificación activa: USD ${totalDescuento.toFixed(2)} este mes por tu colaboración` : "Contribuí para reducir tu abono mensual"}
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {bonConfig.map((b) => {
                        const aplicado = bonHistorial.find(h => h.accion === b.accion);
                        return (
                          <div key={b.accion} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: aplicado ? "rgba(34,197,94,0.06)" : "var(--gfi-bg-card)", border: `1px solid ${aplicado ? "rgba(34,197,94,0.2)" : "var(--gfi-border-subtle)"}`, borderRadius: 6 }}>
                            <span style={{ fontSize: 18 }}>{icoMap[b.accion] ?? "🎯"}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: "var(--gfi-text-primary)", fontWeight: 500 }}>{b.label}</div>
                              <div style={{ fontSize: 10, fontFamily: "var(--font-display)", fontWeight: 700, color: aplicado ? "#3abab6" : "rgba(153,0,0,0.7)" }}>
                                {aplicado ? `✓ −USD ${aplicado.descuento_aplicado.toFixed(2)} aplicado` : `Bonifica USD ${b.descuento_usd.toFixed(2)}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {bonConfig.length === 0 && [
                        { label: "Documentos en Biblioteca", ico: "📚" },
                        { label: "Aportes en el Foro", ico: "💬" },
                        { label: "Comparables cargados", ico: "📊" },
                        { label: "Seniority GFI", ico: "⭐" },
                        { label: "Referidos suscriptos", ico: "👥" },
                      ].map((b, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 6 }}>
                          <span style={{ fontSize: 18 }}>{b.ico}</span>
                          <div>
                            <div style={{ fontSize: 12, color: "var(--gfi-text-primary)", fontWeight: 500 }}>{b.label}</div>
                            <div style={{ fontSize: 10, color: "rgba(200,0,0,0.7)", fontFamily: "var(--font-display)", fontWeight: 700 }}>Bonifica suscripción</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--gfi-bg-card)", border: "1px solid var(--gfi-border-subtle)", borderRadius: 6, fontSize: 12, color: "var(--gfi-text-muted)", lineHeight: 1.6 }}>
                💳 El pago se realiza por <strong style={{ color: "var(--gfi-text-primary)" }}>transferencia bancaria</strong>. El admin verifica el mismo día hábil. 3 días de gracia ante vencimiento.
              </div>
            </div>
          )}

          {/* REPUTACIÓN */}
          {seccion === "reputacion" && (
            <div className="pf-section">
              <div className="pf-section-title">⭐ <span>Reputación e Insignias</span></div>
              <div className="pf-section-sub">Tu puntaje y reconocimientos en la red GFI®. El lema: <strong style={{color:"rgba(200,0,0,0.7)"}}>El que aporta, gana.</strong></div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  { val: (repStats.docs * 10 + repStats.comparables * 5 + repStats.tasaciones * 8 + repStats.propiedades * 3 + repStats.negocios * 15 + repStats.networking * 4 + repStats.foro * 2 + repStats.referidos * 20).toString(), label: "Puntos totales" },
                  { val: repStats.propiedades.toString(), label: "Propiedades en cartera" },
                  { val: repStats.negocios.toString(), label: "Negocios cerrados" },
                  { val: repStats.comparables.toString(), label: "Comparables" },
                  { val: repStats.docs.toString(), label: "Docs aprobados" },
                  { val: repStats.referidos.toString(), label: "Referidos" },
                ].map((s, i) => (
                  <div key={i} className="rep-stat">
                    <div className="rep-stat-val">{s.val}</div>
                    <div className="rep-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Tier: Bronce */}
              <div className="rep-tier-label bronce">🥉 Bronce — Primeros pasos</div>
              <div className="rep-badges">
                {[
                  {
                    ico: "✅", label: "Perfil Completo", tier: "bronze",
                    desc: "Foto, bio, zona, especialidades e inmobiliaria",
                    goal: 5,
                    current: [!!perfil.foto_url, !!perfil.bio, !!perfil.zona_trabajo, (perfil.especialidades?.length ?? 0) > 0, !!perfil.inmobiliaria].filter(Boolean).length,
                    earned: !!perfil.foto_url && !!perfil.bio && !!perfil.zona_trabajo && (perfil.especialidades?.length ?? 0) > 0 && !!perfil.inmobiliaria,
                  },
                  {
                    ico: "🏠", label: "Primera Propiedad", tier: "bronze",
                    desc: "1+ propiedad en cartera",
                    goal: 1, current: Math.min(repStats.propiedades, 1),
                    earned: repStats.propiedades >= 1,
                  },
                  {
                    ico: "📍", label: "Referente de Zona", tier: "bronze",
                    desc: "Zona + especialidades registradas",
                    goal: 2, current: [(perfil.especialidades?.length ?? 0) > 0, !!perfil.zona_trabajo].filter(Boolean).length,
                    earned: (perfil.especialidades?.length ?? 0) > 0 && !!perfil.zona_trabajo,
                  },
                  {
                    ico: "💬", label: "Voz del Foro", tier: "bronze",
                    desc: "5+ publicaciones en el foro",
                    goal: 5, current: Math.min(repStats.foro, 5),
                    earned: repStats.foro >= 5,
                  },
                ].map((b, i) => (
                  <div key={i} className={`rep-badge bronze${b.earned ? " earned" : ""}`}>
                    <span className="rep-badge-ico">{b.ico}</span>
                    <div className="rep-badge-body">
                      <div className="rep-badge-name">{b.label}</div>
                      <div className="rep-badge-desc">{b.earned ? "✓ Obtenida" : `${b.current}/${b.goal} — ${b.desc}`}</div>
                      {!b.earned && <div className="rep-badge-prog"><div className="rep-badge-prog-fill" style={{width:`${Math.min(100,Math.round(b.current/b.goal*100))}%`}} /></div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tier: Plata */}
              <div className="rep-tier-label plata">🥈 Plata — Corredor activo</div>
              <div className="rep-badges">
                {[
                  {
                    ico: "🏘️", label: "Portafolio Activo", tier: "silver",
                    desc: "5+ propiedades en cartera",
                    goal: 5, current: Math.min(repStats.propiedades, 5),
                    earned: repStats.propiedades >= 5,
                  },
                  {
                    ico: "🤝", label: "Primer Cierre", tier: "silver",
                    desc: "1+ negocio cerrado registrado",
                    goal: 1, current: Math.min(repStats.negocios, 1),
                    earned: repStats.negocios >= 1,
                  },
                  {
                    ico: "🌐", label: "Networker", tier: "silver",
                    desc: "3+ publicaciones en Networking",
                    goal: 3, current: Math.min(repStats.networking, 3),
                    earned: repStats.networking >= 3,
                  },
                  {
                    ico: "📊", label: "Aportante Observatorio", tier: "silver",
                    desc: "10+ comparables cargados",
                    goal: 10, current: Math.min(repStats.comparables, 10),
                    earned: repStats.comparables >= 10,
                  },
                  {
                    ico: "📚", label: "Aportante Biblioteca", tier: "silver",
                    desc: "5+ documentos aprobados",
                    goal: 5, current: Math.min(repStats.docs, 5),
                    earned: repStats.docs >= 5,
                  },
                  {
                    ico: "🔗", label: "Embajador", tier: "silver",
                    desc: "1+ referido exitoso",
                    goal: 1, current: Math.min(repStats.referidos, 1),
                    earned: repStats.referidos >= 1,
                  },
                ].map((b, i) => (
                  <div key={i} className={`rep-badge silver${b.earned ? " earned" : ""}`}>
                    <span className="rep-badge-ico">{b.ico}</span>
                    <div className="rep-badge-body">
                      <div className="rep-badge-name">{b.label}</div>
                      <div className="rep-badge-desc">{b.earned ? "✓ Obtenida" : `${b.current}/${b.goal} — ${b.desc}`}</div>
                      {!b.earned && <div className="rep-badge-prog"><div className="rep-badge-prog-fill" style={{width:`${Math.min(100,Math.round(b.current/b.goal*100))}%`}} /></div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tier: Oro */}
              <div className="rep-tier-label oro">🥇 Oro — Élite GFI®</div>
              <div className="rep-badges">
                {[
                  {
                    ico: "💰", label: "Operador Top", tier: "gold",
                    desc: "5+ negocios cerrados",
                    goal: 5, current: Math.min(repStats.negocios, 5),
                    earned: repStats.negocios >= 5,
                  },
                  {
                    ico: "⭐", label: "Observatorio Elite", tier: "gold",
                    desc: "20+ comparables cargados",
                    goal: 20, current: Math.min(repStats.comparables, 20),
                    earned: repStats.comparables >= 20,
                  },
                  {
                    ico: "🏆", label: "Corredor Senior", tier: "gold",
                    desc: "+5 años en GFI®",
                    goal: 60, current: Math.min(repStats.meses, 60),
                    earned: repStats.meses >= 60,
                  },
                  {
                    ico: "⚖️", label: "Tasador Experto", tier: "gold",
                    desc: "10+ tasaciones o designado por admin",
                    goal: 10, current: Math.min(repStats.tasaciones, 10),
                    earned: repStats.tasaciones >= 10 || perfil.insignia_tasador,
                  },
                ].map((b, i) => (
                  <div key={i} className={`rep-badge gold${b.earned ? " earned" : ""}`}>
                    <span className="rep-badge-ico">{b.ico}</span>
                    <div className="rep-badge-body">
                      <div className="rep-badge-name">{b.label}</div>
                      <div className="rep-badge-desc">{b.earned ? "✓ Obtenida" : `${b.current}/${b.goal} — ${b.desc}`}</div>
                      {!b.earned && <div className="rep-badge-prog"><div className="rep-badge-prog-fill" style={{width:`${Math.min(100,Math.round(b.current/b.goal*100))}%`}} /></div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Especiales */}
              <div className="rep-tier-label especial">🎖️ Especiales — Designadas por admin</div>
              <div className="rep-badges">
                {[
                  { ico: "🎓", label: "Mentor GFI®", desc: "Reconocimiento por trayectoria y aportes a la comunidad", earned: perfil.insignia_mentor },
                ].map((b, i) => (
                  <div key={i} className={`rep-badge${b.earned ? " earned" : ""}`}>
                    <span className="rep-badge-ico">{b.ico}</span>
                    <div className="rep-badge-body">
                      <div className="rep-badge-name">{b.label}</div>
                      <div className="rep-badge-desc">{b.earned ? "✓ Obtenida" : b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
