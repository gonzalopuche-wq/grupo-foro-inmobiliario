"use client";

import { useState } from "react";

interface Props {
  titulo: string;
  waLink: string | null;
  waNum: string;
  waMsg: string;
}

export default function FichaAcciones({ titulo, waLink, waNum, waMsg }: Props) {
  const [copiado, setCopiado] = useState(false);

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback for browsers without clipboard API
      const inp = document.createElement("input");
      inp.value = window.location.href;
      document.body.appendChild(inp);
      inp.select();
      document.execCommand("copy");
      document.body.removeChild(inp);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const compartirWa = () => {
    const url = encodeURIComponent(window.location.href);
    const texto = encodeURIComponent(`Te comparto esta propiedad: "${titulo}" ${window.location.href}`);
    window.open(`https://wa.me/?text=${texto}`, "_blank", "noopener,noreferrer");
  };

  const agendarVisita = waNum
    ? () => {
        const msg = encodeURIComponent(`Hola, estoy interesado/a en la propiedad "${titulo}" y me gustaría agendar una visita. ¿Cuándo estaría disponible? ${window.location.href}`);
        window.open(`https://wa.me/${waNum}?text=${msg}`, "_blank", "noopener,noreferrer");
      }
    : null;

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 15px", borderRadius: 6, cursor: "pointer",
    fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", border: "none", textDecoration: "none",
    transition: "background 0.15s",
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button onClick={copiarEnlace} style={{ ...btnBase, background: copiado ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", color: copiado ? "#3abab6" : "rgba(255,255,255,0.6)", border: `1px solid ${copiado ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.12)"}` }}>
        {copiado ? "✓ Enlace copiado" : "🔗 Copiar enlace"}
      </button>
      <button onClick={compartirWa} style={{ ...btnBase, background: "rgba(34,197,94,0.08)", color: "#3abab6", border: "1px solid rgba(34,197,94,0.2)" }}>
        📤 Compartir
      </button>
      {agendarVisita && (
        <button onClick={agendarVisita} style={{ ...btnBase, background: "rgba(74,184,216,0.1)", color: "#4ab8d8", border: "1px solid rgba(74,184,216,0.25)" }}>
          📅 Agendar visita
        </button>
      )}
    </div>
  );
}
