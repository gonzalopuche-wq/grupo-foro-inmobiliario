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
}

const ESPECIALIDADES_OPCIONES = [
  "Ventas", "Alquileres", "Alquileres temporarios", "Loteos",
  "Comercial", "Fondos de comercio", "Campos", "Tasaciones",
  "Administración de consorcios", "Desarrollos inmobiliarios",
];

const CONDICIONES_IVA = [
  "Responsable inscripto", "Monotributista", "Exento", "No responsable",
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
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [seccion, setSeccion] = useState("personal");
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [pushActivo, setPushActivo] = useState(false);
  const [pushCargando, setPushCargando] = useState(false);
  const [cambioPassword, setCambioPassword] = useState({ actual: "", nueva: "", confirmar: "" });
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [repStats, setRepStats] = useState({ docs: 0, comparables: 0, meses: 0, tasaciones: 0 });

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      const { data: p } = await supabase.from("perfiles").select("*").eq("id", data.user.id).single();
      if (p) {
        setPerfil(p as Perfil);
        const meses = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30));
        const [{ count: docs }, { count: comparables }, tasRes] = await Promise.all([
          supabase.from("biblioteca").select("id", { count: "exact", head: true }).eq("perfil_id", data.user.id).eq("estado", "aprobado"),
          supabase.from("comparables").select("id", { count: "exact", head: true }).eq("perfil_id", data.user.id),
          supabase.from("tasaciones").select("id", { count: "exact", head: true }).eq("perfil_id", data.user.id).then(r => r).catch(() => ({ count: 0 })),
        ]);
        setRepStats({ docs: docs ?? 0, comparables: comparables ?? 0, meses, tasaciones: (tasRes as any).count ?? 0 });
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

  const activarPush = async () => {
    if (!userId) return;
    setPushCargando(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { mostrarToast("Permiso denegado", "err"); setPushCargando(false); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
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
    if (!cambioPassword.nueva || cambioPassword.nueva !== cambioPassword.confirmar) {
      mostrarToast("Las contraseñas no coinciden", "err"); return;
    }
    if (cambioPassword.nueva.length < 8) {
      mostrarToast("La contraseña debe tener al menos 8 caracteres", "err"); return;
    }
    setCambiandoPassword(true);
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
      <div style={{ width: 28, height: 28, border: "2px solid rgba(200,0,0,0.2)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!perfil) return null;

  const iniciales = `${perfil.nombre?.charAt(0) ?? ""}${perfil.apellido?.charAt(0) ?? ""}`.toUpperCase();
  const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .pf-wrap { display: flex; gap: 24px; align-items: flex-start; }
        .pf-sidebar { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 84px; }
        .pf-avatar-box { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 20px 16px; text-align: center; margin-bottom: 8px; }
        .pf-avatar { width: 72px; height: 72px; border-radius: 12px; background: rgba(200,0,0,0.15); border: 2px solid rgba(200,0,0,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 24px; font-weight: 800; color: #cc0000; margin: 0 auto 12px; overflow: hidden; }
        .pf-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .pf-avatar-nombre { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 800; color: #fff; }
        .pf-avatar-mat { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px; font-family: 'Montserrat',sans-serif; }
        .pf-avatar-tipo { display: inline-block; margin-top: 8px; padding: 3px 10px; background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); border-radius: 20px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #cc0000; font-family: 'Montserrat',sans-serif; }
        .pf-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 4px; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; }
        .pf-nav-item:hover { background: rgba(255,255,255,0.04); }
        .pf-nav-item.activo { background: rgba(200,0,0,0.08); border-color: rgba(200,0,0,0.2); }
        .pf-nav-icon { font-size: 16px; width: 20px; text-align: center; }
        .pf-nav-label { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.5); font-family: 'Inter',sans-serif; }
        .pf-nav-item.activo .pf-nav-label { color: #fff; }
        .pf-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; }
        .pf-section { background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 24px 28px; }
        .pf-section-title { font-family: 'Montserrat',sans-serif; font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 10px; }
        .pf-section-title span { color: #cc0000; }
        .pf-section-sub { font-size: 12px; color: rgba(255,255,255,0.3); margin-bottom: 20px; }
        .pf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .pf-grid.full { grid-template-columns: 1fr; }
        .pf-grid .span2 { grid-column: 1 / -1; }
        .pf-field { display: flex; flex-direction: column; gap: 6px; }
        .pf-label { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
        .pf-input { padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; transition: border-color 0.2s; }
        .pf-input:focus { border-color: rgba(200,0,0,0.4); }
        .pf-input::placeholder { color: rgba(255,255,255,0.2); }
        .pf-input:disabled { opacity: 0.5; cursor: not-allowed; }
        .pf-select { padding: 10px 13px; background: #0f0f0f; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .pf-select:focus { border-color: rgba(200,0,0,0.4); }
        .pf-textarea { padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; resize: vertical; min-height: 90px; transition: border-color 0.2s; }
        .pf-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .pf-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .esp-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        .esp-tag { padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'Montserrat',sans-serif; }
        .esp-tag:hover { border-color: rgba(200,0,0,0.3); color: rgba(255,255,255,0.7); }
        .esp-tag.activo { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .toggle-row:last-child { border-bottom: none; }
        .toggle-info { display: flex; flex-direction: column; gap: 3px; }
        .toggle-label { font-size: 13px; color: #fff; font-weight: 500; }
        .toggle-sub { font-size: 11px; color: rgba(255,255,255,0.35); }
        .toggle-btn { width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .toggle-btn.on { background: #cc0000; }
        .toggle-btn.off { background: rgba(255,255,255,0.12); }
        .toggle-knob { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.2s; }
        .toggle-btn.on .toggle-knob { left: 23px; }
        .toggle-btn.off .toggle-knob { left: 3px; }
        .notif-canal { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
        .canal-btn { padding: 7px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s; font-family: 'Montserrat',sans-serif; letter-spacing: 0.08em; display: flex; align-items: center; gap: 6px; }
        .canal-btn.on { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .push-status { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; margin-top: 8px; }
        .push-status.activo { border-color: rgba(34,197,94,0.25); background: rgba(34,197,94,0.04); }
        .push-info { display: flex; flex-direction: column; gap: 3px; }
        .push-label { font-size: 13px; color: #fff; font-weight: 500; }
        .push-sub { font-size: 11px; color: rgba(255,255,255,0.35); }
        .push-btn { padding: 8px 18px; border-radius: 4px; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; border: 1px solid; white-space: nowrap; }
        .push-btn.activar { background: #cc0000; border-color: #cc0000; color: #fff; }
        .push-btn.activar:hover { background: #e60000; }
        .push-btn.desactivar { background: transparent; border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.5); }
        .push-btn.desactivar:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .push-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .seg-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 16px 0; }
        .rep-badges { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
        .rep-badge { padding: 8px 16px; border-radius: 20px; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.6); font-family: 'Montserrat',sans-serif; display: flex; align-items: center; gap: 6px; }
        .rep-stat { display: flex; flex-direction: column; gap: 4px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; }
        .rep-stat-val { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; color: #cc0000; }
        .rep-stat-label { font-size: 11px; color: rgba(255,255,255,0.4); }
        .sus-plan { background: rgba(200,0,0,0.06); border: 1px solid rgba(200,0,0,0.2); border-radius: 6px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .sus-plan-nombre { font-family: 'Montserrat',sans-serif; font-size: 15px; font-weight: 800; color: #fff; }
        .sus-plan-precio { font-family: 'Montserrat',sans-serif; font-size: 22px; font-weight: 800; color: #cc0000; }
        .sus-plan-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .pf-save-bar { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.07); }
        .btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .btn-save { padding: 10px 24px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .btn-save:hover:not(:disabled) { background: #e60000; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .cir-toggle { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .cir-toggle:hover { border-color: rgba(255,255,255,0.12); }
        .cir-toggle.activo { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.06); }
        .cir-label { font-size: 13px; color: rgba(255,255,255,0.7); flex: 1; }
        .cir-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; font-family: 'Montserrat',sans-serif; }
        .cir-badge.on { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #818cf8; }
        .cir-badge.off { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; border-radius: 5px; font-family: 'Montserrat',sans-serif; font-size: 12px; font-weight: 700; z-index: 999; animation: toastIn 0.3s ease; }
        .toast.ok { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #22c55e; }
        .toast.err { background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.35); color: #ff6666; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
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
            <div className="pf-avatar-tipo">{perfil.tipo === "admin" ? "⚙ Admin" : "Corredor"}</div>
            {perfil.estado && (
              <div style={{ marginTop: 6, fontSize: 10, color: perfil.estado === "activo" ? "#22c55e" : "#ff4444", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>
                {perfil.estado === "activo" ? "✓ Activo" : perfil.estado}
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
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
                    {CONDICIONES_IVA.map(c => <option key={c} value={c}>{c}</option>)}
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
                          border: `1px solid ${perfil.celular_mostrar === op ? "#cc0000" : "rgba(255,255,255,0.12)"}`,
                          background: perfil.celular_mostrar === op ? "rgba(200,0,0,0.1)" : "transparent",
                          color: perfil.celular_mostrar === op ? "#fff" : "rgba(255,255,255,0.4)",
                          fontFamily: "'Montserrat',sans-serif",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {op === "personal" ? "📱 Personal" : "🏢 Oficina"}
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
              <div className="pf-section-sub">Tu presencia profesional en la red GFI®</div>
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
                  <input className="pf-input" type="number" placeholder="Ej: 10" value={perfil.anos_experiencia ?? ""} onChange={e => set("anos_experiencia", parseInt(e.target.value) || null)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Web propia</label>
                  <input className="pf-input" placeholder="https://tuweb.com.ar" value={perfil.web_propia ?? ""} onChange={e => set("web_propia", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Instagram</label>
                  <input className="pf-input" placeholder="@tuusuario" value={perfil.instagram ?? ""} onChange={e => set("instagram", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">LinkedIn</label>
                  <input className="pf-input" placeholder="linkedin.com/in/..." value={perfil.linkedin ?? ""} onChange={e => set("linkedin", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Facebook</label>
                  <input className="pf-input" placeholder="facebook.com/..." value={perfil.facebook ?? ""} onChange={e => set("facebook", e.target.value)} />
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
              <div className="pf-save-bar">
                <button className="btn-save" onClick={guardar} disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
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
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
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
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
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

              {/* Tipos de notificación */}
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
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

              <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
                Cambiar contraseña
              </div>
              <div className="pf-grid">
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
                <button className="btn-save" onClick={cambiarContrasena} disabled={cambiandoPassword || !cambioPassword.nueva || !cambioPassword.confirmar}>
                  {cambiandoPassword ? "Cambiando..." : "Cambiar contraseña"}
                </button>
              </div>

              <div className="seg-divider" />

              <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
                Información de cuenta
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Tipo de cuenta", val: perfil.tipo === "admin" ? "Administrador" : "Corredor matriculado" },
                  { label: "Estado", val: perfil.estado ?? "—" },
                  { label: "Miembro desde", val: formatFecha(perfil.created_at) },
                  { label: "Sesión única", val: "1 dispositivo activo a la vez" },
                  { label: "2FA", val: "Obligatorio — SMS o app autenticadora" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 4, border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{item.val}</span>
                  </div>
                ))}
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
                  <div className="sus-plan-precio">USD {perfil.tipo === "colaborador" ? "5" : "15"}<span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>/mes</span></div>
                  <div className="sus-plan-sub">Equivalente en ARS al tipo de cambio del día</div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Documentos en Biblioteca", ico: "📚", pts: "Bonifica suscripción" },
                  { label: "Aportes en el Foro", ico: "💬", pts: "Bonifica suscripción" },
                  { label: "Comparables cargados", ico: "📊", pts: "Bonifica suscripción" },
                  { label: "Seniority GFI", ico: "⭐", pts: "Bonifica suscripción" },
                  { label: "Referidos suscriptos", ico: "👥", pts: "Bonifica suscripción" },
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6 }}>
                    <span style={{ fontSize: 18 }}>{b.ico}</span>
                    <div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{b.label}</div>
                      <div style={{ fontSize: 10, color: "rgba(200,0,0,0.7)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700 }}>{b.pts}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                💳 El pago se realiza por <strong style={{ color: "rgba(255,255,255,0.7)" }}>transferencia bancaria</strong>. El admin verifica el mismo día hábil. 3 días de gracia ante vencimiento.
              </div>
            </div>
          )}

          {/* REPUTACIÓN */}
          {seccion === "reputacion" && (
            <div className="pf-section">
              <div className="pf-section-title">⭐ <span>Reputación</span></div>
              <div className="pf-section-sub">Tu puntaje y reconocimientos en la red GFI®</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { val: (repStats.docs * 10 + repStats.comparables * 5 + repStats.tasaciones * 8).toString(), label: "Puntos acumulados" },
                  { val: repStats.docs.toString(), label: "Documentos aportados" },
                  { val: repStats.comparables.toString(), label: "Comparables cargados" },
                ].map((s, i) => (
                  <div key={i} className="rep-stat">
                    <div className="rep-stat-val">{s.val}</div>
                    <div className="rep-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                Insignias
              </div>
              <div className="rep-badges">
                {[
                  { ico: "📍", label: "Referente de Zona", desc: "Zona de trabajo + especialidades registradas", earned: (perfil.especialidades?.length ?? 0) > 0 && !!perfil.zona_trabajo },
                  { ico: "📊", label: "Aportante del Observatorio", desc: "20+ comparables cargados", earned: repStats.comparables >= 20 },
                  { ico: "📚", label: "Aportante Biblioteca", desc: "5+ documentos aprobados", earned: repStats.docs >= 5 },
                  { ico: "⚖️", label: "Tasador Experto", desc: "10+ tasaciones realizadas o designado por admin", earned: repStats.tasaciones >= 10 || perfil.insignia_tasador },
                  { ico: "🏆", label: "Corredor Senior", desc: "+5 años en GFI®", earned: repStats.meses >= 60 },
                  { ico: "🎓", label: "Mentor GFI®", desc: "Designado por el admin", earned: perfil.insignia_mentor },
                ].map((b, i) => (
                  <div key={i} className="rep-badge" style={{ opacity: b.earned ? 1 : 0.35, border: b.earned ? "1px solid rgba(200,0,0,0.4)" : undefined, background: b.earned ? "rgba(200,0,0,0.1)" : undefined }}>
                    <span>{b.ico}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: b.earned ? "#fff" : undefined }}>{b.label}</div>
                      <div style={{ fontSize: 10, fontWeight: 400, color: b.earned ? "rgba(200,0,0,0.8)" : "rgba(255,255,255,0.4)" }}>{b.earned ? "✓ Obtenida" : b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                Las insignias se otorgan automáticamente o por designación del admin. El lema es: <strong style={{ color: "rgba(200,0,0,0.6)" }}>El que aporta, gana.</strong>
              </div>
            </div>
          )}

        </div>
      </div>

      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
    </>
  );
}
