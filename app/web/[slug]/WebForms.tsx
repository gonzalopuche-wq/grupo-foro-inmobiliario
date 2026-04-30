"use client";

import { useState } from "react";

interface FormProps {
  slug: string;
  accent: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
}

function useForm(slug: string, tipo: "contacto" | "tasacion") {
  const [nombre, setNombre] = useState("");
  const [email, setEmail]   = useState("");
  const [tel, setTel]       = useState("");
  const [msg, setMsg]       = useState("");
  const [dir, setDir]       = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk]         = useState(false);
  const [err, setErr]       = useState("");

  const enviar = async () => {
    if (!nombre.trim()) { setErr("Ingresá tu nombre"); return; }
    setEnviando(true);
    setErr("");
    try {
      const res = await fetch("/api/web-contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tipo, nombre, email, telefono: tel, mensaje: msg, direccion: dir }),
      });
      if (res.ok) {
        setOk(true);
        setNombre(""); setEmail(""); setTel(""); setMsg(""); setDir("");
      } else {
        setErr("Hubo un error. Intentá de nuevo.");
      }
    } catch {
      setErr("Hubo un error. Intentá de nuevo.");
    }
    setEnviando(false);
  };

  return { nombre, setNombre, email, setEmail, tel, setTel, msg, setMsg, dir, setDir, enviando, ok, err, enviar };
}

export function ContactForm({ slug, accent, card, cardBorder, text, textMuted }: FormProps) {
  const f = useForm(slug, "contacto");

  const inputStyle = {
    padding: "12px 14px", background: card, border: `1px solid ${cardBorder}`,
    borderRadius: 6, color: text, fontSize: 13, fontFamily: "Inter,sans-serif",
    outline: "none", width: "100%", boxSizing: "border-box" as const,
  };
  const taStyle = { ...inputStyle, resize: "vertical" as const, minHeight: 100 };

  if (f.ok) return (
    <div style={{ padding: "40px 20px", textAlign: "center", background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 10 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: text, marginBottom: 6 }}>¡Mensaje enviado!</div>
      <div style={{ fontSize: 13, color: textMuted }}>Me pondré en contacto a la brevedad.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input style={inputStyle} placeholder="Tu nombre *" value={f.nombre} onChange={e => f.setNombre(e.target.value)} />
      <input style={inputStyle} placeholder="Email" type="email" value={f.email} onChange={e => f.setEmail(e.target.value)} />
      <input style={inputStyle} placeholder="Teléfono / WhatsApp" value={f.tel} onChange={e => f.setTel(e.target.value)} />
      <textarea style={taStyle} placeholder="¿En qué puedo ayudarte?" value={f.msg} onChange={e => f.setMsg(e.target.value)} />
      {f.err && <div style={{ fontSize: 12, color: "#ef4444" }}>{f.err}</div>}
      <button
        onClick={f.enviar}
        disabled={f.enviando}
        style={{ padding: 13, background: accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, fontFamily: "Montserrat,sans-serif", cursor: f.enviando ? "not-allowed" : "pointer", opacity: f.enviando ? 0.7 : 1 }}
      >
        {f.enviando ? "Enviando..." : "Enviar mensaje"}
      </button>
    </div>
  );
}

export function TasacionForm({ slug, accent, card, cardBorder, text, textMuted }: FormProps) {
  const f = useForm(slug, "tasacion");

  const inputStyle = {
    padding: "12px 14px", background: card, border: `1px solid ${cardBorder}`,
    borderRadius: 6, color: text, fontSize: 13, fontFamily: "Inter,sans-serif",
    outline: "none", width: "100%", boxSizing: "border-box" as const,
  };
  const taStyle = { ...inputStyle, resize: "vertical" as const, minHeight: 100 };

  if (f.ok) return (
    <div style={{ padding: "40px 20px", textAlign: "center", background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 10, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800, color: text, marginBottom: 6 }}>¡Solicitud recibida!</div>
      <div style={{ fontSize: 13, color: textMuted }}>Te contactaré dentro de las próximas 24 horas con la tasación.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, margin: "0 auto" }}>
      <input style={inputStyle} placeholder="Tu nombre *" value={f.nombre} onChange={e => f.setNombre(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <input style={inputStyle} placeholder="Email" type="email" value={f.email} onChange={e => f.setEmail(e.target.value)} />
        <input style={inputStyle} placeholder="Teléfono / WhatsApp" value={f.tel} onChange={e => f.setTel(e.target.value)} />
      </div>
      <input style={inputStyle} placeholder="Dirección de la propiedad" value={f.dir} onChange={e => f.setDir(e.target.value)} />
      <textarea style={taStyle} placeholder="Contanos más sobre la propiedad (tipo, metros, antigüedad...)" value={f.msg} onChange={e => f.setMsg(e.target.value)} />
      {f.err && <div style={{ fontSize: 12, color: "#ef4444" }}>{f.err}</div>}
      <button
        onClick={f.enviar}
        disabled={f.enviando}
        style={{ padding: 13, background: accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, fontFamily: "Montserrat,sans-serif", cursor: f.enviando ? "not-allowed" : "pointer", opacity: f.enviando ? 0.7 : 1 }}
      >
        {f.enviando ? "Enviando..." : "Solicitar tasación gratuita"}
      </button>
    </div>
  );
}
