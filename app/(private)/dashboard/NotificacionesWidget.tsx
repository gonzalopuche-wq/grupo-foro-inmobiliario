"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function NotificacionesWidget() {
  const [userId, setUserId] = useState<string | null>(null);
  const [estado, setEstado] = useState<"cargando" | "no-soportado" | "denegado" | "activo" | "inactivo">("cargando");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("no-soportado");
        return;
      }

      const permission = Notification.permission;
      if (permission === "denied") { setEstado("denegado"); return; }

      // Verificar si ya tiene suscripción activa
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setEstado("activo");
      } else {
        setEstado("inactivo");
      }
    };
    init();
  }, []);

  const activar = async () => {
    if (!userId) return;
    setGuardando(true);
    try {
      // Registrar service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Pedir permiso
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setEstado("denegado"); setGuardando(false); return; }

      // Suscribirse al push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Guardar en Supabase
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), perfil_id: userId, eventos: true }),
      });

      setEstado("activo");
    } catch (err) {
      console.error("Error activando push:", err);
    }
    setGuardando(false);
  };

  const desactivar = async () => {
    if (!userId) return;
    setGuardando(true);
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
      setEstado("inactivo");
    } catch (err) {
      console.error("Error desactivando push:", err);
    }
    setGuardando(false);
  };

  if (estado === "cargando" || estado === "no-soportado") return null;

  return (
    <div style={{
      background: "rgba(14,14,14,0.9)",
      border: `1px solid ${estado === "activo" ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 6,
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap" as const,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{estado === "activo" ? "🔔" : "🔕"}</span>
        <div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 12, fontWeight: 700, color: "#fff" }}>
            Notificaciones push
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
            {estado === "activo"
              ? "Activadas · Recibirás alertas de nuevos eventos"
              : estado === "denegado"
              ? "Bloqueadas en el navegador · Habilitá los permisos manualmente"
              : "Desactivadas · Activá para recibir alertas de eventos"}
          </div>
        </div>
      </div>
      {estado !== "denegado" && (
        <button
          onClick={estado === "activo" ? desactivar : activar}
          disabled={guardando}
          style={{
            padding: "8px 18px",
            background: estado === "activo" ? "transparent" : "#cc0000",
            border: estado === "activo" ? "1px solid rgba(255,255,255,0.15)" : "none",
            borderRadius: 4,
            color: estado === "activo" ? "rgba(255,255,255,0.5)" : "#fff",
            fontFamily: "'Montserrat',sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            cursor: guardando ? "not-allowed" : "pointer",
            opacity: guardando ? 0.6 : 1,
            whiteSpace: "nowrap" as const,
            transition: "all 0.2s",
          }}
        >
          {guardando ? "..." : estado === "activo" ? "Desactivar" : "Activar notificaciones"}
        </button>
      )}
    </div>
  );
}
