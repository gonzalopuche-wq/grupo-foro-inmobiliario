"use client";
import { useState } from "react";

interface Props {
  propiedadId: string;
  titulo: string;
}

export function QRLinkButton({ propiedadId, titulo }: Props) {
  const [linkRastreable, setLinkRastreable] = useState<string | null>(null);
  const [vistas, setVistas] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mostrarQR, setMostrarQR] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const fichaUrl = typeof window !== "undefined"
    ? `${window.location.origin}/crm/cartera/ficha/${propiedadId}`
    : `/crm/cartera/ficha/${propiedadId}`;

  async function generarLink() {
    setLoading(true);
    try {
      const token = document.cookie.match(/sb-[^=]+-auth-token=([^;]+)/)?.[1];
      const res = await fetch("/api/cartera/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ propiedad_id: propiedadId, titulo }),
      });
      const data = await res.json();
      if (data.url) {
        setLinkRastreable(data.url);
        setVistas(data.vistas ?? 0);
        setMostrarQR(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function copiar(text: string) {
    await navigator.clipboard.writeText(text);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const qrUrl = mostrarQR && linkRastreable
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(linkRastreable)}&bgcolor=ffffff&color=0d0d0d&margin=8`
    : `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(fichaUrl)}&bgcolor=ffffff&color=0d0d0d&margin=8`;

  return (
    <div style={{ marginTop: 20 }}>
      <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "20px 0" }} />
      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#999", marginBottom: 14 }}>
        Compartir propiedad
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* QR Code */}
        <div style={{ textAlign: "center" }}>
          <img
            src={qrUrl}
            alt="QR de la propiedad"
            style={{ width: 120, height: 120, borderRadius: 8, border: "1px solid #eee", display: "block" }}
          />
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 4, fontFamily: "Montserrat,sans-serif" }}>
            {mostrarQR && linkRastreable ? "Link rastreable" : "Link directo"}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => copiar(fichaUrl)}
              style={{ padding: "8px 16px", background: "#f0f0f0", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", fontFamily: "Montserrat,sans-serif" }}>
              {copiado ? "✓ ¡Copiado!" : "📋 Copiar link directo"}
            </button>

            {!linkRastreable ? (
              <button
                onClick={generarLink}
                disabled={loading}
                style={{ padding: "8px 16px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "Montserrat,sans-serif", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Generando..." : "🔗 Generar link rastreable"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => copiar(linkRastreable)}
                  style={{ padding: "8px 16px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "left", fontFamily: "Montserrat,sans-serif" }}>
                  {copiado ? "✓ ¡Copiado!" : "🔗 Copiar link rastreable"}
                </button>
                <div style={{ fontSize: 11, color: "#888", padding: "4px 0" }}>
                  👁 {vistas} vista{vistas !== 1 ? "s" : ""} · Te notificamos cada vez que lo abren
                </div>
              </>
            )}

            <a
              href={`https://wa.me/?text=${encodeURIComponent(`📍 *${titulo}*\n\n${linkRastreable ?? fichaUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "8px 16px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#25d366", textDecoration: "none", display: "block", fontFamily: "Montserrat,sans-serif" }}>
              💬 Compartir por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
