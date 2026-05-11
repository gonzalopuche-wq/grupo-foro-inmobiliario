"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ActivarNotificaciones({ userId }: { userId: string }) {
  const [estado, setEstado] = useState<"desconocido" | "activo" | "denegado" | "cargando">("desconocido");

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setEstado("denegado");
      return;
    }
    if (Notification.permission === "granted") setEstado("activo");
    else if (Notification.permission === "denied") setEstado("denegado");
    else setEstado("desconocido");
  }, [userId]);

  const activar = async () => {
    setEstado("cargando");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") { setEstado("denegado"); return; }

      const registro = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setEstado("denegado"); return; }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subscription: suscripcion.toJSON() }),
      });

      setEstado("activo");
    } catch (err) {
      console.error("Error activando notificaciones:", err);
      setEstado("denegado");
    }
  };

  const desactivar = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const registro = await navigator.serviceWorker.getRegistration("/sw.js");
      if (registro) {
        const sub = await registro.pushManager.getSubscription();
        if (sub) {
          if (session) {
            await fetch("/api/push/subscribe", {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
          }
          await sub.unsubscribe();
        }
      }
      setEstado("desconocido");
    } catch (err) {
      console.error("Error desactivando:", err);
    }
  };

  if (estado === "activo") return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "Inter, sans-serif" }}>
        ✓ Notificaciones activadas en este dispositivo
      </span>
      <button onClick={desactivar} style={{
        background: "none", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer",
        padding: "4px 10px", borderRadius: 4, fontFamily: "Inter, sans-serif",
      }}>
        Desactivar
      </button>
    </div>
  );

  if (estado === "denegado") return (
    <p style={{ fontSize: 11, color: "rgba(255,100,100,0.8)", fontFamily: "Inter, sans-serif" }}>
      Notificaciones bloqueadas. Habilitá los permisos en la configuración del navegador.
    </p>
  );

  return (
    <button onClick={activar} disabled={estado === "cargando"} style={{
      background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.3)",
      color: "#fff", fontSize: 12, cursor: "pointer", padding: "8px 16px",
      borderRadius: 6, fontFamily: "Inter, sans-serif", fontWeight: 500,
      display: "flex", alignItems: "center", gap: 8,
      opacity: estado === "cargando" ? 0.6 : 1,
    }}>
      🔔 {estado === "cargando" ? "Activando..." : "Activar notificaciones en este dispositivo"}
    </button>
  );
}


  if (estado === "activo") return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12, color: "#4ade80", fontFamily: "Inter, sans-serif" }}>
        ✓ Notificaciones activadas en este dispositivo
      </span>
      <button onClick={desactivar} style={{
        background: "none", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer",
        padding: "4px 10px", borderRadius: 4, fontFamily: "Inter, sans-serif",
      }}>
        Desactivar
      </button>
    </div>
  );

  if (estado === "denegado") return (
    <p style={{ fontSize: 11, color: "rgba(255,100,100,0.8)", fontFamily: "Inter, sans-serif" }}>
      Notificaciones bloqueadas. Habilitá los permisos en la configuración del navegador.
    </p>
  );

  return (
    <button onClick={activar} disabled={estado === "cargando"} style={{
      background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.3)",
      color: "#fff", fontSize: 12, cursor: "pointer", padding: "8px 16px",
      borderRadius: 6, fontFamily: "Inter, sans-serif", fontWeight: 500,
      display: "flex", alignItems: "center", gap: 8,
      opacity: estado === "cargando" ? 0.6 : 1,
    }}>
      🔔 {estado === "cargando" ? "Activando..." : "Activar notificaciones en este dispositivo"}
    </button>
  );
}
