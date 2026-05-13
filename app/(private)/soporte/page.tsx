"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Ticket {
  id: string;
  asunto: string;
  descripcion: string;
  estado: "abierto" | "en_proceso" | "resuelto" | "cerrado";
  prioridad: "baja" | "normal" | "alta" | "urgente";
  respuesta: string | null;
  respuesta_ia: string | null;
  created_at: string;
  updated_at: string;
}

const ESTADO_LABEL: Record<string, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};
const ESTADO_COLOR: Record<string, string> = {
  abierto: "rgba(234,179,8,0.15)",
  en_proceso: "rgba(59,130,246,0.15)",
  resuelto: "rgba(34,197,94,0.15)",
  cerrado: "rgba(255,255,255,0.06)",
};
const ESTADO_BORDER: Record<string, string> = {
  abierto: "rgba(234,179,8,0.3)",
  en_proceso: "rgba(59,130,246,0.3)",
  resuelto: "rgba(34,197,94,0.3)",
  cerrado: "rgba(255,255,255,0.15)",
};
const ESTADO_TEXT: Record<string, string> = {
  abierto: "#eab308",
  en_proceso: "#3b82f6",
  resuelto: "#22c55e",
  cerrado: "rgba(255,255,255,0.4)",
};

const ASUNTOS = [
  "No puedo iniciar sesión",
  "Error al cargar una página",
  "No encuentro una función",
  "Problema con notificaciones",
  "Error en el CRM",
  "Problema con mi suscripción",
  "Error al subir fotos",
  "Problema con el MIR",
  "Consulta sobre facturación",
  "Otro",
];

const FORM_VACIO = { asunto: "", descripcion: "" };

export default function SoportePage() {
  const [userId, setUserId] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [ticketVer, setTicketVer] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = (msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
    });
  }, []);

  const cargar = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("soporte_tickets")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  const guardar = async () => {
    if (!form.asunto || !form.descripcion.trim()) return showToast("Completá asunto y descripción", "err");
    setGuardando(true);
    const { error } = await supabase.from("soporte_tickets").insert({
      user_id: userId,
      asunto: form.asunto,
      descripcion: form.descripcion.trim(),
    });
    setGuardando(false);
    if (error) return showToast("Error al enviar ticket", "err");
    showToast("Ticket enviado — te responderemos pronto ✓");
    setForm(FORM_VACIO);
    setMostrarForm(false);
    await cargar(userId);
  };

  const cerrarTicket = async (id: string) => {
    if (!confirm("¿Cerrar este ticket?")) return;
    await supabase.from("soporte_tickets").update({ estado: "cerrado" }).eq("id", id);
    setTicketVer(null);
    await cargar(userId);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 0 64px" }}>
      <style>{`
        .sp-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:10px; font-family:'Montserrat',sans-serif; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; }
        .sp-card { background:rgba(14,14,14,0.9); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:16px 20px; cursor:pointer; transition:border-color 0.15s; }
        .sp-card:hover { border-color:rgba(255,255,255,0.14); }
        .sp-form-input { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:7px; color:#fff; padding:10px 14px; font-size:13px; font-family:'Inter',sans-serif; outline:none; box-sizing:border-box; }
        .sp-form-input:focus { border-color:rgba(204,0,0,0.5); }
        .sp-form-textarea { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:7px; color:#fff; padding:10px 14px; font-size:13px; font-family:'Inter',sans-serif; outline:none; resize:vertical; min-height:120px; box-sizing:border-box; }
        .sp-form-textarea:focus { border-color:rgba(204,0,0,0.5); }
        .sp-form-select { width:100%; background:rgba(20,20,20,0.95); border:1px solid rgba(255,255,255,0.1); border-radius:7px; color:#fff; padding:10px 14px; font-size:13px; font-family:'Inter',sans-serif; outline:none; }
        .sp-form-select:focus { border-color:rgba(204,0,0,0.5); }
        .sp-label { font-size:11px; font-family:'Montserrat',sans-serif; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.4); margin-bottom:6px; display:block; }
        .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
        .modal-box { background:#0f0f0f; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:24px; width:100%; max-width:600px; max-height:85vh; overflow-y:auto; }
        .sp-respuesta-box { background:rgba(34,197,94,0.06); border:1px solid rgba(34,197,94,0.2); border-radius:8px; padding:14px 18px; margin-top:16px; }
        .sp-respuesta-label { font-size:10px; font-family:'Montserrat',sans-serif; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#22c55e; margin-bottom:8px; }
        .sp-respuesta-texto { font-size:13px; color:rgba(255,255,255,0.8); line-height:1.7; white-space:pre-wrap; }
      `}</style>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.tipo === "err" ? "#7f1d1d" : "#111", border: `1px solid ${toast.tipo === "err" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 600, zIndex: 999 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>Módulo soporte</div>
          <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>Soporte Técnico</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Reportá un problema y te respondemos lo antes posible</p>
        </div>
        <button
          onClick={() => setMostrarForm(true)}
          style={{ padding: "10px 20px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          + Nuevo ticket
        </button>
      </div>

      {/* Info box */}
      <div style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "12px 18px", marginBottom: 24, fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
        📋 Describí el problema con el mayor detalle posible — captura de pantalla, mensaje de error, página donde ocurre. Respondemos en el día hábil.
      </div>

      {/* Ticket list */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "48px 0" }}>Cargando...</div>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,0.2)", fontFamily: "Montserrat,sans-serif" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Sin tickets abiertos</div>
          <div style={{ fontSize: 12 }}>Todo funcionando bien por ahora</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tickets.map(t => (
            <div key={t.id} className="sp-card" onClick={() => setTicketVer(t)}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{t.asunto}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
                    {t.descripcion}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span className="sp-badge" style={{ background: ESTADO_COLOR[t.estado], border: `1px solid ${ESTADO_BORDER[t.estado]}`, color: ESTADO_TEXT[t.estado] }}>
                    {ESTADO_LABEL[t.estado]}
                  </span>
                  {t.respuesta && <span style={{ fontSize: 11, color: "#22c55e" }}>✓ Respondido</span>}
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                {new Date(t.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo ticket */}
      {mostrarForm && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setMostrarForm(false); }}>
          <div className="modal-box">
            <h2 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 17, fontWeight: 800, color: "#fff", margin: "0 0 20px" }}>
              Nuevo ticket de <span style={{ color: "#cc0000" }}>soporte</span>
            </h2>
            <div style={{ marginBottom: 14 }}>
              <label className="sp-label">Asunto *</label>
              <select className="sp-form-select" value={form.asunto} onChange={e => setForm(p => ({ ...p, asunto: e.target.value }))}>
                <option value="">— Seleccioná el tipo de problema —</option>
                {ASUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="sp-label">Descripción del problema *</label>
              <textarea
                className="sp-form-textarea"
                placeholder="Describí el problema con detalle: qué estabas haciendo, qué mensaje de error apareció, en qué página ocurrió..."
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setMostrarForm(false); setForm(FORM_VACIO); }} style={{ padding: "10px 18px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "none", borderRadius: 7, fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando} style={{ padding: "10px 22px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 7, fontFamily: "Montserrat,sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.6 : 1 }}>
                {guardando ? "Enviando..." : "Enviar ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ver ticket */}
      {ticketVer && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setTicketVer(null); }}>
          <div className="modal-box">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Ticket de soporte</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{ticketVer.asunto}</div>
              </div>
              <span className="sp-badge" style={{ background: ESTADO_COLOR[ticketVer.estado], border: `1px solid ${ESTADO_BORDER[ticketVer.estado]}`, color: ESTADO_TEXT[ticketVer.estado], flexShrink: 0 }}>
                {ESTADO_LABEL[ticketVer.estado]}
              </span>
            </div>

            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
              Abierto el {new Date(ticketVer.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>Tu descripción</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{ticketVer.descripcion}</div>
            </div>

            {ticketVer.respuesta ? (
              <div className="sp-respuesta-box">
                <div className="sp-respuesta-label">✓ Respuesta del equipo GFI®</div>
                <div className="sp-respuesta-texto">{ticketVer.respuesta}</div>
              </div>
            ) : (
              <div style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "rgba(234,179,8,0.7)" }}>
                ⏳ Tu ticket está en cola — respondemos en el próximo día hábil
              </div>
            )}

            <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "space-between" }}>
              {ticketVer.estado !== "cerrado" && ticketVer.respuesta && (
                <button
                  onClick={() => cerrarTicket(ticketVer.id)}
                  style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "none", borderRadius: 7, fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  ✓ Marcar como resuelto
                </button>
              )}
              <button onClick={() => setTicketVer(null)} style={{ marginLeft: "auto", padding: "8px 16px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "none", borderRadius: 7, fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
