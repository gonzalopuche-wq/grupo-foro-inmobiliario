"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #fff; font-family: 'Inter', sans-serif; }
      `}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "Montserrat,sans-serif", marginBottom: 10 }}>Ocurrió un error</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32, maxWidth: 380, lineHeight: 1.6 }}>
          Algo salió mal. Podés intentar recargar la página o volver al inicio.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={reset}
            style={{ padding: "11px 24px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "Montserrat,sans-serif", cursor: "pointer" }}
          >
            Reintentar
          </button>
          <a href="/dashboard" style={{ padding: "11px 24px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "Montserrat,sans-serif", textDecoration: "none" }}>
            Ir al dashboard
          </a>
        </div>
        {error.digest && (
          <p style={{ marginTop: 24, fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>
            ref: {error.digest}
          </p>
        )}
        <div style={{ marginTop: 48, fontSize: 11, color: "rgba(255,255,255,0.15)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em" }}>
          GFI® GRUPO FORO INMOBILIARIO
        </div>
      </div>
    </>
  );
}
