"use client";

import { useState } from "react";

interface Props {
  propiedadId: string;
  titulo: string;
}

type Estado = "idle" | "enviando" | "ok" | "error";

export default function FichaContacto({ propiedadId, titulo }: Props) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [errMsg, setErrMsg] = useState("");

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setEstado("enviando");
    setErrMsg("");
    try {
      const res = await fetch("/api/ficha-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedad_id: propiedadId, nombre, email, telefono, mensaje }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error ?? "Error al enviar");
        setEstado("error");
      } else {
        setEstado("ok");
      }
    } catch {
      setErrMsg("No se pudo conectar. Revisá tu conexión e intentá de nuevo.");
      setEstado("error");
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6, color: "#fff",
    fontFamily: "Inter,sans-serif", fontSize: 13,
    outline: "none", boxSizing: "border-box",
  };

  if (estado === "ok") {
    return (
      <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: "24px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
        <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 15, color: "#22c55e", marginBottom: 6 }}>
          ¡Consulta enviada!
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          El corredor va a contactarte a la brevedad.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "24px 28px" }}>
      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", marginBottom: 18 }}>
        Consultar sobre esta propiedad
      </div>

      <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 5, textTransform: "uppercase" as const }}>
              Nombre *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Tu nombre"
              required
              style={inp}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 5, textTransform: "uppercase" as const }}>
              Teléfono
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="Ej: 341 555-0000"
              style={inp}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 5, textTransform: "uppercase" as const }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            style={inp}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 5, textTransform: "uppercase" as const }}>
            Mensaje
          </label>
          <textarea
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            placeholder={`Hola, me interesa la propiedad "${titulo}"...`}
            rows={3}
            style={{ ...inp, resize: "vertical", minHeight: 80 }}
          />
        </div>

        {estado === "error" && (
          <div style={{ fontSize: 12, color: "#f87171", padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 5, border: "1px solid rgba(248,113,113,0.2)" }}>
            {errMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={estado === "enviando" || !nombre.trim()}
          style={{
            padding: "12px 24px",
            background: estado === "enviando" ? "rgba(204,0,0,0.4)" : "#cc0000",
            border: "none", borderRadius: 6, cursor: estado === "enviando" ? "default" : "pointer",
            color: "#fff", fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
            transition: "background 0.15s", opacity: !nombre.trim() ? 0.5 : 1,
          }}
        >
          {estado === "enviando" ? "Enviando..." : "Enviar consulta"}
        </button>
      </form>
    </div>
  );
}
