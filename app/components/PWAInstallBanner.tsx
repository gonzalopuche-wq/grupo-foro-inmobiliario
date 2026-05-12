"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("pwa-install-dismissed")) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const instalar = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setVisible(false);
    setPrompt(null);
    if (outcome === "dismissed") {
      localStorage.setItem("pwa-install-dismissed", "1");
    }
  };

  const cerrar = () => {
    localStorage.setItem("pwa-install-dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      background: "#141414", border: "1px solid rgba(200,0,0,0.3)",
      borderRadius: 12, padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
      zIndex: 9999, maxWidth: 440, width: "calc(100vw - 40px)",
      animation: "slideUp 0.25s ease",
    }}>
      <style>{`@keyframes slideUp{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
      <img
        src="/logo_gfi.png"
        alt="GFI"
        style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, objectFit: "cover" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 700, color: "#fff",
          fontFamily: "Montserrat, sans-serif",
        }}>
          Instalá GFI® como app
        </p>
        <p style={{
          margin: "3px 0 0", fontSize: 11,
          color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif",
        }}>
          Acceso rápido desde el escritorio o barra de tareas
        </p>
      </div>
      <button
        onClick={instalar}
        style={{
          background: "#cc0000", color: "#fff", border: "none",
          borderRadius: 6, padding: "8px 14px",
          fontSize: 12, fontWeight: 700,
          fontFamily: "Montserrat, sans-serif", cursor: "pointer",
          flexShrink: 0, letterSpacing: "0.05em", whiteSpace: "nowrap",
        }}
      >
        Instalar
      </button>
      <button
        onClick={cerrar}
        style={{
          background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", fontSize: 20,
          cursor: "pointer", padding: "0 2px", flexShrink: 0,
          lineHeight: 1, fontWeight: 300,
        }}
        aria-label="Cerrar"
      >
        ×
      </button>
    </div>
  );
}
