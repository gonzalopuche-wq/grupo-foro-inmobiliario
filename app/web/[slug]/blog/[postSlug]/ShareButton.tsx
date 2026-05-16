"use client";

import { useState } from "react";

export function ShareButton({ titulo, accent, cardBorder, textMuted }: { titulo: string; accent: string; cardBorder: string; textMuted: string }) {
  const [copiado, setCopiado] = useState(false);

  const compartir = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <button
      onClick={compartir}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px", background: "transparent", border: `1px solid ${cardBorder}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: copiado ? accent : textMuted, cursor: "pointer", fontFamily: "Montserrat,sans-serif", transition: "color 0.2s, border-color 0.2s", marginTop: 12 }}
    >
      <span>{copiado ? "✓" : "🔗"}</span>
      <span>{copiado ? "Enlace copiado" : "Compartir artículo"}</span>
    </button>
  );
}
