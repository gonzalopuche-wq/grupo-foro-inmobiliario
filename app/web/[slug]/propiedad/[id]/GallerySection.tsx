"use client";

import { useState, useEffect, useCallback } from "react";

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
  const [lightbox, setLightbox] = useState(false);

  const prev = useCallback(() => setIdx(i => (i - 1 + fotos.length) % fotos.length), [fotos.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % fotos.length), [fotos.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, prev, next]);

  if (fotos.length === 0) {
    return (
      <div style={{ width: "100%", aspectRatio: "16/7", background: "rgba(20,20,20,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
        🏠
      </div>
    );
  }

  return (
    <>
      <div style={{ position: "relative" }}>
        {/* Foto principal */}
        <div
          style={{ position: "relative", width: "100%", aspectRatio: "16/7", overflow: "hidden", background: "#111", cursor: "zoom-in" }}
          onClick={() => setLightbox(true)}
        >
          <img
            src={fotos[idx]}
            alt={`Foto ${idx + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.2s" }}
          />
          <div style={{ position: "absolute", top: 16, left: 16, padding: "5px 14px", background: accent, color: "#fff", borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {operacion}
          </div>
          {fotos.length > 1 && (
            <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontFamily: "Montserrat,sans-serif", backdropFilter: "blur(6px)" }}>
              {idx + 1} / {fotos.length}
            </div>
          )}
          {/* Expand hint */}
          <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.55)", color: "#fff", padding: "5px 10px", borderRadius: 6, fontSize: 11, fontFamily: "Montserrat,sans-serif", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 4 }}>
            ⛶ Ver fotos
          </div>
          {fotos.length > 1 && (
            <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
              <button onClick={e => { e.stopPropagation(); prev(); }} style={{ padding: "8px 14px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 6, fontSize: 16, cursor: "pointer", backdropFilter: "blur(6px)" }}>‹</button>
              <button onClick={e => { e.stopPropagation(); next(); }} style={{ padding: "8px 14px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 6, fontSize: 16, cursor: "pointer", backdropFilter: "blur(6px)" }}>›</button>
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

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          onClick={() => setLightbox(false)}
        >
          {/* Close */}
          <button
            onClick={() => setLightbox(false)}
            style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}
          >✕</button>

          {/* Counter */}
          <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Montserrat,sans-serif" }}>
            {idx + 1} / {fotos.length}
          </div>

          {/* Main image */}
          <img
            src={fotos[idx]}
            alt={`Foto ${idx + 1}`}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 4, userSelect: "none" }}
          />

          {/* Nav buttons */}
          {fotos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); prev(); }}
                style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 48, height: 48, borderRadius: "50%", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >‹</button>
              <button
                onClick={e => { e.stopPropagation(); next(); }}
                style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 48, height: 48, borderRadius: "50%", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >›</button>
            </>
          )}

          {/* Thumbnail strip */}
          {fotos.length > 1 && (
            <div
              style={{ position: "absolute", bottom: 16, display: "flex", gap: 6, overflowX: "auto", maxWidth: "90vw", padding: "0 4px" }}
              onClick={e => e.stopPropagation()}
            >
              {fotos.map((f, i) => (
                <div
                  key={i}
                  onClick={() => setIdx(i)}
                  style={{ width: 60, height: 44, flexShrink: 0, borderRadius: 4, overflow: "hidden", cursor: "pointer", border: `2px solid ${i === idx ? "#fff" : "transparent"}`, opacity: i === idx ? 1 : 0.5, transition: "all 0.15s" }}
                >
                  <img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
