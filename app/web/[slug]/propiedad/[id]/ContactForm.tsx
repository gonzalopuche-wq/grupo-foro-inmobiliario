"use client";
import { useState } from "react";

interface Props {
  slug: string;
  propiedadId: string;
  propiedadTitulo: string;
  accentColor: string;
  textColor: string;
  cardBorder: string;
  textMuted: string;
}

export default function ContactForm({ slug, propiedadId, propiedadTitulo, accentColor, textColor, cardBorder, textMuted }: Props) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setEstado("enviando");
    try {
      const res = await fetch("/api/web-contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          tipo: "contacto",
          nombre,
          telefono: telefono || null,
          mensaje: mensaje || `Me interesa la propiedad: ${propiedadTitulo}`,
          propiedad_id: propiedadId,
        }),
      });
      setEstado(res.ok ? "ok" : "error");
    } catch {
      setEstado("error");
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", background: "rgba(0,0,0,0.15)",
    border: `1px solid ${cardBorder}`, borderRadius: 6, color: textColor,
    fontSize: 13, fontFamily: "Inter,sans-serif", outline: "none", boxSizing: "border-box",
  };

  if (estado === "ok") return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
      <div style={{ fontSize: 14, color: textColor, fontWeight: 600 }}>¡Mensaje enviado!</div>
      <div style={{ fontSize: 12, color: textMuted, marginTop: 4 }}>El corredor se pondrá en contacto con vos pronto.</div>
    </div>
  );

  return (
    <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Consultá por esta propiedad</div>
      <input style={inp} placeholder="Tu nombre *" value={nombre} onChange={e => setNombre(e.target.value)} required aria-label="Nombre" />
      <input style={inp} placeholder="Tu teléfono / WhatsApp" value={telefono} onChange={e => setTelefono(e.target.value)} aria-label="Teléfono" />
      <textarea style={{ ...inp, resize: "vertical", minHeight: 80 }} placeholder="Tu mensaje (opcional)" value={mensaje} onChange={e => setMensaje(e.target.value)} aria-label="Mensaje" />
      {estado === "error" && <div style={{ fontSize: 12, color: "#ef4444" }}>Error al enviar. Intentá de nuevo.</div>}
      <button type="submit" disabled={estado === "enviando" || !nombre.trim()}
        style={{ padding: "11px", background: accentColor, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, fontFamily: "Montserrat,sans-serif", cursor: "pointer", opacity: (estado === "enviando" || !nombre.trim()) ? 0.6 : 1 }}>
        {estado === "enviando" ? "Enviando..." : "📩 Enviar consulta"}
      </button>
    </form>
  );
}
