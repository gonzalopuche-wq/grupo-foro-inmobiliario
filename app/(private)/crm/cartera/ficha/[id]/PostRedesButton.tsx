"use client";

import { useState } from "react";
import { supabase } from "../../../../../lib/supabase";

interface Props {
  propiedadId: string;
}

export function PostRedesButton({ propiedadId }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [red, setRed] = useState<"instagram" | "whatsapp" | "ambos">("ambos");
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<{ instagram?: string; whatsapp?: string } | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const generar = async () => {
    setGenerando(true);
    setResultado(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const resp = await fetch("/api/crm/generar-post", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ propiedad_id: propiedadId, red }),
      });
      const data = await resp.json();
      if (data.ok) setResultado(data);
    } finally {
      setGenerando(false);
    }
  };

  const copiar = async (texto: string, key: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(key);
    setTimeout(() => setCopiado(null), 2000);
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        style={{
          padding: "8px 16px", borderRadius: 5, border: "1px solid rgba(200,0,0,0.35)",
          background: "rgba(200,0,0,0.1)", color: "#fff", cursor: "pointer",
          fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        📱 Post Redes
      </button>

      {abierto && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={e => { if (e.target === e.currentTarget) { setAbierto(false); setResultado(null); } }}>
          <div style={{
            background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
            padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 800, color: "#fff" }}>
                📱 Generador de Posts con IA
              </div>
              <button onClick={() => { setAbierto(false); setResultado(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>Red social</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["ambos", "instagram", "whatsapp"] as const).map(r => (
                  <button key={r} onClick={() => { setRed(r); setResultado(null); }} style={{
                    padding: "8px 16px", borderRadius: 20, border: "1px solid",
                    borderColor: red === r ? "#cc0000" : "rgba(255,255,255,0.12)",
                    background: red === r ? "rgba(200,0,0,0.12)" : "transparent",
                    color: red === r ? "#fff" : "rgba(255,255,255,0.4)",
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}>
                    {r === "ambos" ? "📱 Ambos" : r === "instagram" ? "📸 Instagram" : "💬 WhatsApp"}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={generar} disabled={generando} style={{
              width: "100%", padding: "12px", borderRadius: 6, border: "none",
              background: generando ? "rgba(200,0,0,0.4)" : "#cc0000",
              color: "#fff", cursor: generando ? "not-allowed" : "pointer",
              fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20,
            }}>
              {generando ? "✨ Generando con IA..." : "✨ Generar post"}
            </button>

            {resultado && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {resultado.instagram && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>📸 Instagram</div>
                      <button onClick={() => copiar(resultado.instagram!, "ig")} style={{
                        padding: "5px 12px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)",
                        background: copiado === "ig" ? "rgba(34,197,94,0.15)" : "transparent",
                        color: copiado === "ig" ? "#22c55e" : "rgba(255,255,255,0.5)",
                        cursor: "pointer", fontSize: 10, fontWeight: 700,
                      }}>
                        {copiado === "ig" ? "✓ Copiado" : "Copiar"}
                      </button>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, fontFamily: "Inter,sans-serif" }}>{resultado.instagram}</pre>
                  </div>
                )}

                {resultado.whatsapp && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>💬 WhatsApp</div>
                      <button onClick={() => copiar(resultado.whatsapp!, "wa")} style={{
                        padding: "5px 12px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)",
                        background: copiado === "wa" ? "rgba(34,197,94,0.15)" : "transparent",
                        color: copiado === "wa" ? "#22c55e" : "rgba(255,255,255,0.5)",
                        cursor: "pointer", fontSize: 10, fontWeight: 700,
                      }}>
                        {copiado === "wa" ? "✓ Copiado" : "Copiar"}
                      </button>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, fontFamily: "Inter,sans-serif" }}>{resultado.whatsapp}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
