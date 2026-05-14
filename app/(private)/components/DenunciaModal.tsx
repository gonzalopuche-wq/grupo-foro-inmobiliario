"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

interface Props {
  tipoContenido: "forum_topic" | "forum_reply" | "perfil" | "comentario";
  contenidoId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const MOTIVOS = [
  { value: "spam",       label: "Spam o publicidad no deseada", icon: "📢" },
  { value: "ofensivo",   label: "Contenido ofensivo o inapropiado", icon: "⚠️" },
  { value: "acoso",      label: "Acoso o comportamiento abusivo", icon: "🚫" },
  { value: "incorrecto", label: "Información falsa o incorrecta", icon: "❌" },
  { value: "otro",       label: "Otro motivo", icon: "💬" },
];

const TIPO_LABELS: Record<string, string> = {
  forum_topic: "tema del foro",
  forum_reply: "respuesta del foro",
  perfil: "perfil de usuario",
  comentario: "comentario",
};

export default function DenunciaModal({ tipoContenido, contenidoId, onClose, onSuccess }: Props) {
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if (!motivo || enviando) return;
    setEnviando(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/denuncias", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_contenido: tipoContenido, contenido_id: contenidoId, motivo, descripcion }),
    });
    const d = res.ok ? await res.json() : { error: true };
    if (!d.error) {
      setEnviado(true);
      onSuccess?.();
    }
    setEnviando(false);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, position: "relative" }}>
        <button style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer" }} onClick={onClose}>&times;</button>

        {enviado ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <h3 style={{ margin: "0 0 8px", fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800 }}>Denuncia enviada</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
              Tu reporte fue recibido. El equipo de moderación GFI® lo revisará a la brevedad.
            </p>
            <button onClick={onClose} style={{ padding: "10px 24px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" }}>Cerrar</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>🚨</div>
              <h3 style={{ margin: "0 0 4px", fontFamily: "Montserrat,sans-serif", fontSize: 16, fontWeight: 800 }}>Denunciar {TIPO_LABELS[tipoContenido] ?? "contenido"}</h3>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                Ayudás a mantener la comunidad GFI® segura y profesional.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Motivo *
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {MOTIVOS.map(m => (
                  <label key={m.value} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: motivo === m.value ? "rgba(200,0,0,0.1)" : "rgba(255,255,255,0.03)", border: "1px solid", borderColor: motivo === m.value ? "rgba(200,0,0,0.4)" : "rgba(255,255,255,0.07)", borderRadius: 8, cursor: "pointer", transition: "all 0.1s" }}>
                    <input type="radio" name="motivo" value={m.value} checked={motivo === m.value} onChange={() => setMotivo(m.value)} style={{ accentColor: "#cc0000" }} />
                    <span style={{ fontSize: 14 }}>{m.icon}</span>
                    <span style={{ fontSize: 13, color: motivo === m.value ? "#fff" : "rgba(255,255,255,0.6)" }}>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                Descripción adicional (opcional)
              </label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Describí el problema con más detalle..."
                rows={3}
                style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={!motivo || enviando}
                style={{ flex: 2, padding: "10px", background: "#cc0000", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: !motivo || enviando ? "not-allowed" : "pointer", opacity: !motivo || enviando ? 0.5 : 1 }}>
                {enviando ? "Enviando..." : "Enviar denuncia"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
