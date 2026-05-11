"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

interface Contacto { id: string; nombre: string; apellido: string; email: string | null; }
interface Negocio { id: string; titulo: string; }
interface EmailLog {
  id: string;
  para: string;
  asunto: string;
  cuerpo: string;
  estado: string;
  created_at: string;
  contacto?: { nombre: string; apellido: string } | null;
  negocio?: { titulo: string } | null;
}

const PLANTILLAS_EMAIL = [
  {
    label: "Presentación de propiedad",
    asunto: "Propiedad que puede interesarte",
    cuerpo: "Hola, te escribimos desde GFI® para compartirte una propiedad que creemos puede ser de tu interés.\n\nEstaremos encantados de coordinar una visita cuando lo desees.\n\nSaludos cordiales.",
  },
  {
    label: "Seguimiento post-visita",
    asunto: "¿Qué te pareció la propiedad?",
    cuerpo: "Hola, luego de la visita que realizamos queríamos saber qué te pareció la propiedad y si tenés alguna consulta.\n\nQuedamos a tu disposición.\n\nSaludos.",
  },
  {
    label: "Actualización de precio",
    asunto: "Actualización de precio — oportunidad",
    cuerpo: "Hola, te escribimos porque la propiedad que visitaste ha tenido una actualización de precio que podría ser de tu interés.\n\nEsperamos tu respuesta.\n\nSaludos.",
  },
  {
    label: "Confirmación de turno",
    asunto: "Confirmación de visita",
    cuerpo: "Hola, te confirmamos la visita coordinada. Por favor avisanos si necesitás reagendar.\n\nNos vemos pronto.\n\nSaludos.",
  },
  {
    label: "Cierre / Felicitaciones",
    asunto: "¡Felicitaciones por la operación!",
    cuerpo: "Hola, queremos felicitarte por la concreción de esta operación y agradecerte la confianza depositada en nosotros.\n\nFue un placer trabajar con vos.\n\nSaludos cordiales.",
  },
];

const fmtFecha = (s: string) =>
  new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function EmailsContent() {
  const searchParams = useSearchParams();
  const paraParam = searchParams.get("para") ?? "";
  const contactoParam = searchParams.get("contacto") ?? "";

  const [userId, setUserId] = useState<string | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    para: paraParam,
    contacto_id: contactoParam,
    negocio_id: "",
    asunto: "",
    cuerpo: "",
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const cargar = async (uid: string) => {
    const [{ data: con }, { data: neg }, { data: log }] = await Promise.all([
      supabase.from("crm_contactos").select("id,nombre,apellido,email").eq("perfil_id", uid).neq("estado", "archivado").not("email", "is", null).order("apellido").limit(100),
      supabase.from("crm_negocios").select("id,titulo").eq("perfil_id", uid).eq("archivado", false).order("updated_at", { ascending: false }).limit(50),
      supabase.from("crm_emails").select("id,para,asunto,cuerpo,estado,created_at, contacto:contacto_id(nombre,apellido), negocio:negocio_id(titulo)").eq("perfil_id", uid).order("created_at", { ascending: false }).limit(50),
    ]);
    setContactos((con ?? []) as Contacto[]);
    setNegocios((neg ?? []) as Negocio[]);
    setEmails((log ?? []) as unknown as EmailLog[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      setLoading(false);
      if (paraParam) setModal(true);
    })();
  }, []);

  const abrirNuevo = () => {
    setForm({ para: "", contacto_id: "", negocio_id: "", asunto: "", cuerpo: "" });
    setModal(true);
  };

  const seleccionarContacto = (id: string) => {
    const c = contactos.find(x => x.id === id);
    setForm(p => ({ ...p, contacto_id: id, para: c?.email ?? p.para }));
  };

  const aplicarPlantilla = (pl: typeof PLANTILLAS_EMAIL[0]) => {
    setForm(p => ({ ...p, asunto: pl.asunto, cuerpo: pl.cuerpo }));
  };

  const enviar = async () => {
    if (!userId || !form.para.trim() || !form.asunto.trim() || !form.cuerpo.trim()) return;
    setEnviando(true);

    const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const htmlCuerpo = escapeHtml(form.cuerpo).replace(/\n/g, "<br/>");
    const html = `<div style="font-family:Inter,sans-serif;font-size:15px;color:#1e293b;max-width:600px;margin:0 auto;padding:32px 24px">
      ${htmlCuerpo}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0"/>
      <p style="font-size:12px;color:#94a3b8">Enviado desde GFI® CRM · <a href="https://foroinmobiliario.com.ar" style="color:#6366f1">foroinmobiliario.com.ar</a></p>
    </div>`;

    let estado = "enviado";
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: form.para.trim(), subject: form.asunto.trim(), html }),
      });
      if (!res.ok) estado = "error";
    } catch {
      estado = "error";
    }

    const contactoRef = contactos.find(c => c.id === form.contacto_id);
    const negocioRef = negocios.find(n => n.id === form.negocio_id);

    const { data: nuevo } = await supabase.from("crm_emails").insert({
      perfil_id: userId,
      contacto_id: form.contacto_id || null,
      negocio_id: form.negocio_id || null,
      para: form.para.trim(),
      asunto: form.asunto.trim(),
      cuerpo: form.cuerpo.trim(),
      estado,
    }).select("id,para,asunto,cuerpo,estado,created_at").single();

    if (nuevo) {
      const registro: EmailLog = {
        ...nuevo,
        contacto: contactoRef ? { nombre: contactoRef.nombre, apellido: contactoRef.apellido } : null,
        negocio: negocioRef ? { titulo: negocioRef.titulo } : null,
      };
      setEmails(prev => [registro, ...prev]);
    }
    setModal(false);
    setEnviando(false);
    showToast(estado === "enviado" ? "Email enviado correctamente" : "Error al enviar — guardado en historial");
  };

  const eliminar = async (id: string) => {
    if (!userId || !confirm("¿Eliminar este registro de email?")) return;
    await supabase.from("crm_emails").delete().eq("id", id);
    setEmails(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.includes("Error") ? "#ef4444" : "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>{toast}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>✉️ Emails enviados</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Historial de comunicaciones por email con tus contactos</p>
        </div>
        <button
          onClick={abrirNuevo}
          style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
        >
          + Redactar email
        </button>
      </div>

      {emails.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b", background: "#1e293b", borderRadius: 14, border: "1px solid #334155" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Sin emails enviados</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Los emails que envíes desde el CRM aparecerán aquí</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {emails.map(e => {
            const con = e.contacto;
            const neg = e.negocio;
            return (
              <div key={e.id} style={{ background: "#1e293b", borderRadius: 12, padding: "16px 20px", border: "1px solid #334155", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{e.estado === "error" ? "⚠️" : "✉️"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>{e.asunto}</span>
                    {e.estado === "error" && <span style={{ fontSize: 10, background: "#ef444422", color: "#ef4444", padding: "2px 7px", borderRadius: 6, fontWeight: 700 }}>Error</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Para: {e.para}{con ? ` · ${con.apellido ? `${con.apellido}, ${con.nombre}` : con.nombre}` : ""}{neg ? ` · ${neg.titulo}` : ""}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{fmtFecha(e.created_at)}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, whiteSpace: "pre-line", borderLeft: "2px solid #334155", paddingLeft: 10 }}>
                    {e.cuerpo.length > 200 ? e.cuerpo.slice(0, 200) + "…" : e.cuerpo}
                  </div>
                </div>
                <button onClick={() => eliminar(e.id)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 16, padding: "2px 4px", flexShrink: 0 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal redactar */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, border: "1px solid #1e293b", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 700, color: "#f8fafc" }}>✉️ Redactar email</h2>

            {/* Plantillas rápidas */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Plantillas rápidas</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PLANTILLAS_EMAIL.map(pl => (
                  <button key={pl.label} onClick={() => aplicarPlantilla(pl)}
                    style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
                    {pl.label}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Contacto (opcional)</label>
            <select value={form.contacto_id} onChange={e => seleccionarContacto(e.target.value)}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}>
              <option value="">— Sin contacto —</option>
              {contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre} · {c.email}</option>)}
            </select>

            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Para (email) *</label>
            <input type="email" value={form.para} onChange={e => setForm(p => ({ ...p, para: e.target.value }))} placeholder="destinatario@email.com"
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }} />

            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Negocio (opcional)</label>
            <select value={form.negocio_id} onChange={e => setForm(p => ({ ...p, negocio_id: e.target.value }))}
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}>
              <option value="">— Sin negocio —</option>
              {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
            </select>

            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Asunto *</label>
            <input value={form.asunto} onChange={e => setForm(p => ({ ...p, asunto: e.target.value }))} placeholder="Asunto del email"
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }} />

            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Mensaje *</label>
            <textarea value={form.cuerpo} onChange={e => setForm(p => ({ ...p, cuerpo: e.target.value }))} rows={7} placeholder="Escribí tu mensaje aquí..."
              style={{ width: "100%", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 20, boxSizing: "border-box", resize: "vertical" }} />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 20px", cursor: "pointer" }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando || !form.para.trim() || !form.asunto.trim() || !form.cuerpo.trim()}
                style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, cursor: "pointer", opacity: (enviando || !form.para.trim() || !form.asunto.trim() || !form.cuerpo.trim()) ? 0.7 : 1 }}>
                {enviando ? "Enviando..." : "✉️ Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmailsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>}>
      <EmailsContent />
    </Suspense>
  );
}
