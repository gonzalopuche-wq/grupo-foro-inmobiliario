"use client";

import { useState } from "react";

// Compartir contenido (foro / noticias) a redes sociales.
// WhatsApp, Telegram, X y Facebook usan sus URLs de "share intent".
// Instagram NO ofrece una URL para compartir un enlace desde la web, así que
// copiamos el link al portapapeles y abrimos Instagram para que lo pegue.
type Red = "whatsapp" | "telegram" | "twitter" | "facebook" | "instagram";

const ICONOS: Record<Red, { label: string; bg: string; path: string }> = {
  whatsapp: {
    label: "WhatsApp",
    bg: "#25D366",
    path: "M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.02zM12.04 20.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.24-8.23 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z",
  },
  telegram: {
    label: "Telegram",
    bg: "#229ED9",
    path: "M21.94 4.64l-2.86 13.48c-.21.95-.78 1.18-1.58.74l-4.36-3.21-2.1 2.02c-.23.23-.43.43-.88.43l.31-4.45 8.1-7.32c.35-.31-.08-.49-.55-.18l-10.01 6.3-4.31-1.35c-.94-.29-.95-.94.2-1.39l16.85-6.5c.78-.29 1.46.18 1.2 1.1z",
  },
  twitter: {
    label: "X",
    bg: "#000000",
    path: "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93zm-1.29 19.5h2.04L6.49 3.24H4.3z",
  },
  facebook: {
    label: "Facebook",
    bg: "#1877F2",
    path: "M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8v8.44C19.61 23.08 24 18.09 24 12.07z",
  },
  instagram: {
    label: "Instagram",
    bg: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.36 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.8.72 1.47 1.38 2.13.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.3 1.47-.72 2.13-1.38.66-.66 1.08-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.8-.72-1.47-1.38-2.13C20.34 1.36 19.67.94 18.87.63 18.11.33 17.23.13 15.96.07 14.67.01 14.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z",
  },
};

const ORDEN: Red[] = ["whatsapp", "telegram", "twitter", "facebook", "instagram"];

export default function SocialShare({
  url,
  title,
  label = "Compartir",
}: {
  url: string;
  title: string;
  label?: string;
}) {
  const [aviso, setAviso] = useState<string>("");

  const abrir = (link: string) => window.open(link, "_blank", "noopener,noreferrer,width=640,height=640");

  const mostrarAviso = (txt: string) => {
    setAviso(txt);
    setTimeout(() => setAviso(""), 2600);
  };

  const compartir = async (red: Red) => {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title);
    const tu = encodeURIComponent(`${title} ${url}`);
    switch (red) {
      case "whatsapp":
        abrir(`https://wa.me/?text=${tu}`);
        break;
      case "telegram":
        abrir(`https://t.me/share/url?url=${u}&text=${t}`);
        break;
      case "twitter":
        abrir(`https://twitter.com/intent/tweet?url=${u}&text=${t}`);
        break;
      case "facebook":
        abrir(`https://www.facebook.com/sharer/sharer.php?u=${u}`);
        break;
      case "instagram":
        // Instagram no permite compartir un enlace desde la web: copiamos y abrimos IG.
        try {
          await navigator.clipboard.writeText(url);
          mostrarAviso("Link copiado — pegalo en tu historia o post de Instagram");
        } catch {
          mostrarAviso("Copiá el link y pegalo en Instagram");
        }
        abrir("https://www.instagram.com/");
        break;
    }
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      mostrarAviso("Enlace copiado");
    } catch {
      mostrarAviso("No se pudo copiar el enlace");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gfi-text-muted)", fontFamily: "var(--font-display)", marginRight: 2 }}>
          {label}
        </span>
        {ORDEN.map((red) => {
          const ic = ICONOS[red];
          return (
            <button
              key={red}
              onClick={() => compartir(red)}
              aria-label={`Compartir en ${ic.label}`}
              title={ic.label}
              style={{
                width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer",
                background: ic.bg, display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: 0, transition: "transform 0.12s, opacity 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <svg viewBox="0 0 24 24" width={17} height={17} fill="#fff" aria-hidden="true">
                <path d={ic.path} />
              </svg>
            </button>
          );
        })}
        <button
          onClick={copiarLink}
          aria-label="Copiar enlace"
          title="Copiar enlace"
          style={{
            width: 34, height: 34, borderRadius: "50%", cursor: "pointer",
            background: "transparent", border: "1px solid var(--gfi-border)", color: "var(--gfi-text-secondary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
          }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>
      {aviso && (
        <span style={{ fontSize: 11, color: "var(--gfi-teal-text)", fontFamily: "var(--font-body)" }}>{aviso}</span>
      )}
    </div>
  );
}
