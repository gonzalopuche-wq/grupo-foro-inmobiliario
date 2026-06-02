"use client";

import { useState } from "react";

export default function GaleriaFotos({ fotos }: { fotos: string[] }) {
  const [idx, setIdx] = useState(0);

  if (!fotos.length) {
    return (
      <div style={{ height: 320, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, borderRadius: "12px 12px 0 0" }}>🏠</div>
    );
  }

  const prev = () => setIdx(i => (i - 1 + fotos.length) % fotos.length);
  const next = () => setIdx(i => (i + 1) % fotos.length);

  return (
    <div style={{ background: "#111", borderRadius: "12px 12px 0 0", overflow: "hidden", userSelect: "none" }}>
      {/* Foto principal */}
      <div style={{ position: "relative", height: 420 }}>
        <img src={fotos[idx]} alt={`Foto ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {fotos.length > 1 && (
          <>
            <button onClick={prev} aria-label="Anterior"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: "50%", cursor: "pointer", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>‹</button>
            <button onClick={next} aria-label="Siguiente"
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", width: 44, height: 44, borderRadius: "50%", cursor: "pointer", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>›</button>
            <span style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "4px 11px", borderRadius: 20 }}>
              {idx + 1} / {fotos.length}
            </span>
          </>
        )}
      </div>
      {/* Tiras de thumbnails */}
      {fotos.length > 1 && (
        <div style={{ display: "flex", gap: 3, padding: "4px", overflowX: "auto", background: "#0a0a0a" }}>
          {fotos.map((f, i) => (
            <img key={i} src={f} alt="" onClick={() => setIdx(i)}
              style={{ width: 70, height: 50, objectFit: "cover", borderRadius: 3, flexShrink: 0, cursor: "pointer", border: `2px solid ${i === idx ? "#990000" : "transparent"}`, opacity: i === idx ? 1 : 0.6, transition: "all 0.15s" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
