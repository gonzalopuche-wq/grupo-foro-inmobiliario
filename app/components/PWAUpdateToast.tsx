"use client";

import { useEffect, useState } from "react";

export default function PWAUpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then(reg => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });

      if (reg.waiting && navigator.serviceWorker.controller) {
        setShow(true);
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  const actualizar = () => {
    navigator.serviceWorker.ready.then(reg => {
      reg.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 20,
      background: "#141414", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
      zIndex: 9998, maxWidth: 320,
      animation: "fadeInRight 0.25s ease",
    }}>
      <style>{`@keyframes fadeInRight{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <span style={{ fontSize: 20, flexShrink: 0 }}>⚡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 12, fontWeight: 700,
          color: "#fff", fontFamily: "Montserrat, sans-serif",
        }}>
          Nueva versión disponible
        </p>
        <p style={{
          margin: "2px 0 0", fontSize: 10,
          color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif",
        }}>
          Recargá para obtener las últimas mejoras
        </p>
      </div>
      <button
        onClick={actualizar}
        style={{
          background: "rgba(200,0,0,0.15)", color: "#cc0000",
          border: "1px solid rgba(200,0,0,0.3)", borderRadius: 6,
          padding: "6px 12px", fontSize: 11, fontWeight: 700,
          fontFamily: "Montserrat, sans-serif", cursor: "pointer", flexShrink: 0,
        }}
      >
        Actualizar
      </button>
      <button
        onClick={() => setShow(false)}
        style={{
          background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", fontSize: 18,
          cursor: "pointer", padding: 0, flexShrink: 0,
        }}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  );
}
