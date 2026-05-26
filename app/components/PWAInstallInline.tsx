"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent;
  }
}

function isInStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function PWAInstallInline() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [instalando, setInstalando] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInStandaloneMode()) { setInstalado(true); return; }

    // Tomar el prompt almacenado globalmente (capturado por PWAInstallBanner)
    if (window.__pwaInstallPrompt) {
      setPrompt(window.__pwaInstallPrompt);
      return;
    }

    // Si no está todavía, esperar el evento
    const handler = (e: Event) => {
      e.preventDefault();
      const pwaEvent = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = pwaEvent;
      setPrompt(pwaEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const instalar = async () => {
    if (!prompt) return;
    setInstalando(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setInstalado(true);
        window.__pwaInstallPrompt = undefined;
      }
    } finally {
      setInstalando(false);
    }
  };

  // Ya instalado: mostrar confirmación breve
  if (instalado) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        marginTop: 20, padding: "10px 16px",
        background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.5)",
        fontFamily: "Inter, sans-serif",
      }}>
        <span style={{ fontSize: 16 }}>✅</span>
        GFI® instalada como app
      </div>
    );
  }

  // Sin prompt disponible: mostrar hint manual de Chrome (siempre en Chrome desktop)
  if (!prompt) {
    // Detectar Chrome desktop sin el prompt (ya instalado o criterio no cumplido aún)
    const isChrome = typeof navigator !== "undefined" &&
      /Chrome/.test(navigator.userAgent) && !/Edg|OPR|SamsungBrowser/.test(navigator.userAgent);
    if (!isChrome) return null;

    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginTop: 20,
        padding: "12px 14px",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
      }}>
        <img src="/logo_gfi.png" alt="GFI" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: "Montserrat, sans-serif" }}>
            Instalá GFI® como app en Chrome
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
            Hacé clic en el ícono <strong style={{ color: "rgba(255,255,255,0.5)" }}>⊕</strong> en la barra de direcciones de Chrome
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, marginTop: 20,
      padding: "12px 14px",
      background: "rgba(204,0,0,0.06)", border: "1px solid rgba(204,0,0,0.2)",
      borderRadius: 8,
    }}>
      <img src="/logo_gfi.png" alt="GFI" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", fontFamily: "Montserrat, sans-serif" }}>
          Instalá GFI® como app
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}>
          Acceso rápido · Sin abrir el navegador
        </p>
      </div>
      <button
        onClick={instalar}
        disabled={instalando}
        style={{
          background: "#cc0000", color: "#fff", border: "none",
          borderRadius: 6, padding: "8px 14px",
          fontSize: 12, fontWeight: 700, fontFamily: "Montserrat, sans-serif",
          cursor: instalando ? "wait" : "pointer", flexShrink: 0,
          letterSpacing: "0.04em", opacity: instalando ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {instalando ? "Instalando…" : "Instalar"}
      </button>
    </div>
  );
}
