"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window { __pwaPrompt?: BeforeInstallPromptEvent; __pwaInstalled?: boolean; }
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [modoIOS, setModoIOS] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // El widget inline en login/registro ya cubre estas páginas
    if (pathname === "/login" || pathname === "/registro") return;
    if (sessionStorage.getItem("pwa-install-dismissed")) return;
    if (isInStandaloneMode()) return;

    if (isIOS()) {
      setModoIOS(true);
      setVisible(true);
      return;
    }

    // Prompt may already be captured by the inline <head> script before React hydrated
    if (window.__pwaPrompt) { setPrompt(window.__pwaPrompt); setVisible(true); return; }

    const onPromptReady = () => {
      if (window.__pwaPrompt) { setPrompt(window.__pwaPrompt!); setVisible(true); }
    };
    const onNativePrompt = (e: Event) => {
      e.preventDefault();
      const pwaEvent = e as BeforeInstallPromptEvent;
      window.__pwaPrompt = pwaEvent;
      setPrompt(pwaEvent);
      setVisible(true);
    };
    window.addEventListener("pwa-prompt-ready", onPromptReady);
    window.addEventListener("beforeinstallprompt", onNativePrompt);
    return () => {
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("beforeinstallprompt", onNativePrompt);
    };
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
    sessionStorage.setItem("pwa-install-dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div id="pwa-install-banner" style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      background: "#141414", border: "1px solid rgba(200,0,0,0.3)",
      borderRadius: 12, padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
      zIndex: 9999, maxWidth: 440, width: "calc(100vw - 40px)",
      animation: "slideUp 0.25s ease",
    }}>
      <style>{`
        @keyframes slideUp{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @media (max-width: 900px) { #pwa-install-banner { bottom: calc(74px + env(safe-area-inset-bottom, 0px)) !important; } }
      `}</style>
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
        {modoIOS ? (
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
            Tocá <strong style={{ color: "rgba(255,255,255,0.6)" }}>Compartir</strong> {" "}
            <span style={{ fontSize: 13 }}>⎋</span>
            {" "}y luego <strong style={{ color: "rgba(255,255,255,0.6)" }}>"Agregar a pantalla de inicio"</strong>
          </p>
        ) : (
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}>
            Acceso rápido desde el escritorio o barra de tareas
          </p>
        )}
      </div>
      {!modoIOS && (
        <button
          onClick={instalar}
          style={{
            background: "#990000", color: "#fff", border: "none",
            borderRadius: 6, padding: "8px 14px",
            fontSize: 12, fontWeight: 700,
            fontFamily: "Montserrat, sans-serif", cursor: "pointer",
            flexShrink: 0, letterSpacing: "0.05em", whiteSpace: "nowrap",
          }}
        >
          Instalar
        </button>
      )}
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
