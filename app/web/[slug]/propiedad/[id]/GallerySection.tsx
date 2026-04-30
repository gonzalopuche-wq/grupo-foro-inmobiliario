"use client";

import { useState } from "react";

export function GallerySection({
  fotos,
  operacion,
  accent,
}: {
  fotos: string[];
  operacion: string;
  accent: string;
}) {
  const [idx, setIdx] = useState(0);

  if (fotos.length === 0) {
    return (
      <div style={{ width: "100%", aspectRatio: "16/7", background: "rgba(20,20,20,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
        🏠
      </div>
    );
  }

  const prev = () => setIdx(i => (i - 1 + fotos.length) % fotos.length);
  const next = () => setIdx(i => (i + 1) % fotos.length);

  return (
    <div style={{ position: "relative" }}>
      {/* Foto principal */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/7", overflow: "hidden", background: "#111" }}>
        <img
          src={fotos[idx]}
          alt={`Foto ${idx + 1}`}
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.2s" }}
        />
        {/* Badge operacion */}
        <div style={{ position: "absolute", top: 16, left: 16, padding: "5px 14px", background: accent, color: "#fff", borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {operacion}
        </div>
        {/* Contador */}
        {fotos.length > 1 && (
          <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontFamily: "Montserrat,sans-serif", backdropFilter: "blur(6px)" }}>
            {idx + 1} / {fotos.length}
          </div>
        )}
        {/* Botones navegación */}
        {fotos.length > 1 && (
          <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 8 }}>
            <button onClick={prev} style={{ padding: "8px 14px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 6, fontSize: 16, cursor: "pointer", backdropFilter: "blur(6px)" }}>‹</button>
            <button onClick={next} style={{ padding: "8px 14px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 6, fontSize: 16, cursor: "pointer", backdropFilter: "blur(6px)" }}>›</button>
          </div>
        )}
      </div>
      {/* Thumbnails */}
      {fotos.length > 1 && (
        <div style={{ display: "flex", gap: 6, padding: "8px 5%", background: "rgba(0,0,0,0.3)", overflowX: "auto" }}>
          {fotos.map((f, i) => (
            <div
              key={i}
              onClick={() => setIdx(i)}
              style={{ width: 72, height: 54, flexShrink: 0, borderRadius: 6, overflow: "hidden", cursor: "pointer", border: `2px solid ${i === idx ? accent : "transparent"}`, transition: "border-color 0.15s" }}
            >
              <img src={f} alt={`thumb ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
