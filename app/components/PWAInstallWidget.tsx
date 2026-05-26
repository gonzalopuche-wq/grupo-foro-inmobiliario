"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window { __pwaPrompt?: BeforeInstallPromptEvent; __pwaInstalled?: boolean; }
}

type Plataforma =
  | "cargando"
  | "instalada"
  | "android-chrome"
  | "desktop-chrome"
  | "edge"
  | "ios-safari"
  | "ios-chrome"
  | "samsung"
  | "otro";

function detectar(): Plataforma {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "cargando";
  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  if (standalone) return "instalada";

  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg\/|EdgA|OPR\/|SamsungBrowser/.test(ua);
  const isEdge = /Edg\/|EdgA/.test(ua);
  const isSamsung = /SamsungBrowser/.test(ua);

  if (isIOS && isChrome) return "ios-chrome";
  if (isIOS) return "ios-safari";
  if (isAndroid && isSamsung) return "samsung";
  if (isAndroid && isChrome) return "android-chrome";
  if (isEdge) return "edge";
  if (isChrome) return "desktop-chrome";
  return "otro";
}

export default function PWAInstallWidget() {
  const [plataforma, setPlataforma] = useState<Plataforma>("cargando");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalando, setInstalando] = useState(false);
  const [instalada, setInstalada] = useState(false);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPlataforma(detectar());

    // Prompt may already be captured by the inline <head> script before React hydrated
    if ((window as any).__pwaInstalled) { setInstalada(true); return; }
    if (window.__pwaPrompt) { setPrompt(window.__pwaPrompt); return; }

    const onPromptReady = () => { if (window.__pwaPrompt) setPrompt(window.__pwaPrompt!); };
    const onInstalled = () => setInstalada(true);
    const onNativePrompt = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      window.__pwaPrompt = ev;
      setPrompt(ev);
    };

    window.addEventListener("pwa-prompt-ready", onPromptReady);
    window.addEventListener("pwa-installed", onInstalled);
    window.addEventListener("beforeinstallprompt", onNativePrompt);
    return () => {
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("pwa-installed", onInstalled);
      window.removeEventListener("beforeinstallprompt", onNativePrompt);
    };
  }, []);

  const instalar = async () => {
    if (!prompt) return;
    setInstalando(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setInstalada(true);
        window.__pwaPrompt = undefined;
      }
    } finally {
      setInstalando(false);
    }
  };

  if (plataforma === "cargando") return null;
  if (plataforma === "instalada" || instalada) {
    return (
      <div style={styles.card}>
        <span style={{ fontSize: 20 }}>✅</span>
        <span style={styles.textoOk}>GFI® instalada — abrila desde tu pantalla de inicio</span>
      </div>
    );
  }

  // Chrome (desktop o Android) con prompt disponible → instalación directa
  if ((plataforma === "desktop-chrome" || plataforma === "android-chrome") && prompt) {
    return (
      <div style={styles.card}>
        <img src="/logo_gfi.png" alt="GFI" style={styles.logo} />
        <div style={{ flex: 1 }}>
          <p style={styles.titulo}>Instalá GFI® como app</p>
          <p style={styles.subtitulo}>
            {plataforma === "android-chrome"
              ? "En tu pantalla de inicio · Sin abrir el navegador"
              : "En tu escritorio o barra de tareas"}
          </p>
        </div>
        <button onClick={instalar} disabled={instalando} style={styles.btnRojo}>
          {instalando ? "Instalando…" : "Instalar"}
        </button>
      </div>
    );
  }

  // Chrome desktop sin prompt (Chrome lo posterga) → hint barra de direcciones
  if (plataforma === "desktop-chrome") {
    return (
      <div style={styles.card}>
        <img src="/logo_gfi.png" alt="GFI" style={styles.logo} />
        <div style={{ flex: 1 }}>
          <p style={styles.titulo}>Instalá GFI® en tu PC</p>
          <p style={styles.subtitulo}>
            En Chrome, hacé clic en el ícono{" "}
            <strong style={{ color: "#fff" }}>⊕</strong>{" "}
            en la barra de direcciones
          </p>
        </div>
      </div>
    );
  }

  // Chrome Android sin prompt → instrucciones menú
  if (plataforma === "android-chrome") {
    return (
      <div style={styles.card}>
        <img src="/logo_gfi.png" alt="GFI" style={styles.logo} />
        <div style={{ flex: 1 }}>
          <p style={styles.titulo}>Instalá GFI® en tu Android</p>
          {!expandido ? (
            <button onClick={() => setExpandido(true)} style={styles.btnTexto}>
              Ver cómo instalar ▾
            </button>
          ) : (
            <ol style={styles.pasos}>
              <li>Tocá el menú <strong>⋮</strong> (tres puntos arriba a la derecha)</li>
              <li>Seleccioná <strong>"Agregar a pantalla de inicio"</strong></li>
              <li>Confirmá tocando <strong>"Agregar"</strong></li>
            </ol>
          )}
        </div>
      </div>
    );
  }

  // iOS Safari → instrucciones compartir
  if (plataforma === "ios-safari") {
    return (
      <div style={styles.card}>
        <img src="/logo_gfi.png" alt="GFI" style={styles.logo} />
        <div style={{ flex: 1 }}>
          <p style={styles.titulo}>Instalá GFI® en tu iPhone / iPad</p>
          {!expandido ? (
            <button onClick={() => setExpandido(true)} style={styles.btnTexto}>
              Ver cómo instalar ▾
            </button>
          ) : (
            <ol style={styles.pasos}>
              <li>Tocá el botón <strong>Compartir</strong> <span style={{ fontSize: 15 }}>⎋</span> (abajo en Safari)</li>
              <li>Deslizá y tocá <strong>"Agregar a pantalla de inicio"</strong></li>
              <li>Tocá <strong>"Agregar"</strong> arriba a la derecha</li>
            </ol>
          )}
        </div>
      </div>
    );
  }

  // iOS Chrome → usar Safari
  if (plataforma === "ios-chrome") {
    return (
      <div style={styles.card}>
        <img src="/logo_gfi.png" alt="GFI" style={styles.logo} />
        <div style={{ flex: 1 }}>
          <p style={styles.titulo}>Instalá GFI® en tu iPhone</p>
          <p style={styles.subtitulo}>
            Abrí esta página en <strong style={{ color: "#fff" }}>Safari</strong> y luego tocá Compartir →{" "}
            <strong style={{ color: "#fff" }}>Agregar a pantalla de inicio</strong>
          </p>
        </div>
      </div>
    );
  }

  // Edge desktop/Android
  if (plataforma === "edge") {
    return (
      <div style={styles.card}>
        <img src="/logo_gfi.png" alt="GFI" style={styles.logo} />
        <div style={{ flex: 1 }}>
          <p style={styles.titulo}>Instalá GFI® en Edge</p>
          {!expandido ? (
            <button onClick={() => setExpandido(true)} style={styles.btnTexto}>
              Ver cómo instalar ▾
            </button>
          ) : (
            <ol style={styles.pasos}>
              <li>Hacé clic en el menú <strong>⋯</strong> (tres puntos, arriba a la derecha)</li>
              <li>Seleccioná <strong>"Aplicaciones"</strong></li>
              <li>Hacé clic en <strong>"Instalar este sitio como aplicación"</strong></li>
            </ol>
          )}
        </div>
      </div>
    );
  }

  // Samsung Internet
  if (plataforma === "samsung") {
    return (
      <div style={styles.card}>
        <img src="/logo_gfi.png" alt="GFI" style={styles.logo} />
        <div style={{ flex: 1 }}>
          <p style={styles.titulo}>Instalá GFI® en Samsung Internet</p>
          {!expandido ? (
            <button onClick={() => setExpandido(true)} style={styles.btnTexto}>
              Ver cómo instalar ▾
            </button>
          ) : (
            <ol style={styles.pasos}>
              <li>Tocá el menú <strong>☰</strong> (abajo a la derecha)</li>
              <li>Seleccioná <strong>"Agregar página a"</strong></li>
              <li>Tocá <strong>"Pantalla de inicio"</strong></li>
            </ol>
          )}
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  card: {
    display: "flex" as const,
    alignItems: "flex-start" as const,
    gap: 12,
    marginTop: 20,
    padding: "14px 14px",
    background: "rgba(204,0,0,0.06)",
    border: "1px solid rgba(204,0,0,0.2)",
    borderRadius: 10,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 9,
    objectFit: "cover" as const,
    flexShrink: 0,
    marginTop: 1,
  },
  titulo: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Montserrat, sans-serif",
    lineHeight: 1.4,
  },
  subtitulo: {
    margin: "4px 0 0",
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter, sans-serif",
    lineHeight: 1.6,
  },
  textoOk: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter, sans-serif",
    lineHeight: 1.5,
    margin: 0,
  },
  btnRojo: {
    background: "#cc0000",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "Montserrat, sans-serif",
    cursor: "pointer",
    flexShrink: 0,
    letterSpacing: "0.04em",
    alignSelf: "center" as const,
  },
  btnTexto: {
    background: "none",
    border: "none",
    color: "#cc0000",
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "Inter, sans-serif",
    cursor: "pointer",
    padding: "4px 0 0",
    margin: 0,
    letterSpacing: "0.03em",
  },
  pasos: {
    margin: "6px 0 0 16px",
    padding: 0,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Inter, sans-serif",
    lineHeight: 1.9,
  },
};
