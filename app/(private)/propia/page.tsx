"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Reporte {
  id: string; created_at: string; updated_at: string; perfil_id: string;
  nombre: string; email: string; matricula: string | null;
  tipo: string; urgencia: string; descripcion: string;
  estado: string; notas_admin: string | null;
}

interface PropiaConfig {
  propia_tel_1: string;       propia_tel_1_label: string;
  propia_tel_2: string;       propia_tel_2_label: string;
  propia_tel_3: string;       propia_tel_3_label: string;
  propia_email: string;
  propia_reglamento_url: string;
  propia_reglamento_nombre: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────
const TIPOS = [
  { value: "portal_lento",   label: "Portal caído / muy lento",           icon: "🌐" },
  { value: "publicar_prop",  label: "Error al publicar propiedad",         icon: "🏠" },
  { value: "imagenes",       label: "Problemas con imágenes / fotos",      icon: "🖼️" },
  { value: "contratos",      label: "Contratos y documentos",              icon: "📄" },
  { value: "pagos",          label: "Pagos y facturación",                 icon: "💳" },
  { value: "leads",          label: "Leads / consultas no llegan",         icon: "📨" },
  { value: "integracion",    label: "Integración con CRM / portales",      icon: "🔗" },
  { value: "acceso_cuenta",  label: "Acceso a mi cuenta",                  icon: "🔑" },
  { value: "carga_datos",    label: "Carga o sincronización de datos",     icon: "🔄" },
  { value: "otro",           label: "Otro",                                icon: "📝" },
];

const URGENCIAS = [
  { value: "baja",    label: "Baja",    desc: "No bloquea mi trabajo",       color: "#3abab6", bg: "rgba(58,186,182,0.10)"  },
  { value: "media",   label: "Media",   desc: "Me dificulta el trabajo",     color: "#d4960c", bg: "rgba(212,150,12,0.10)"  },
  { value: "alta",    label: "Alta",    desc: "Bloquea parte de mi trabajo", color: "#e85c0a", bg: "rgba(232,92,10,0.10)"   },
  { value: "critica", label: "Crítica", desc: "No puedo operar",             color: "#dc2626", bg: "rgba(220,38,38,0.12)"   },
];

const ESTADOS = [
  { value: "pendiente",       label: "Pendiente",        color: "#888",    icon: "⏳" },
  { value: "en_seguimiento",  label: "En seguimiento",   color: "#4ab8d8", icon: "🔄" },
  { value: "resuelto",        label: "Resuelto",         color: "#3abab6", icon: "✅" },
  { value: "no_reproducible", label: "No reproducible",  color: "#d4960c", icon: "❓" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const ticketNum = (id: string) => "#" + id.slice(0, 8).toUpperCase();
const urgInfo   = (v: string) => URGENCIAS.find(u => u.value === v) ?? URGENCIAS[1];
const estInfo   = (v: string) => ESTADOS.find(e => e.value === v)   ?? ESTADOS[0];
const tipoLabel = (v: string) => TIPOS.find(t => t.value === v)?.label ?? v;
const tipoIcon  = (v: string) => TIPOS.find(t => t.value === v)?.icon  ?? "📝";
const cleanPhone = (p: string) => p.replace(/[\s\-\(\)]/g, "");
const waLink     = (p: string) => `https://wa.me/${cleanPhone(p).replace("+", "")}`;
const telLink    = (p: string) => `tel:${cleanPhone(p)}`;

// ── PDF export ────────────────────────────────────────────────────────────────
function exportarPDF(r: Reporte) {
  const win = window.open("", "_blank");
  if (!win) return;
  const urg = urgInfo(r.urgencia);
  const est = estInfo(r.estado);
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Propia ${ticketNum(r.id)}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px 28px;color:#1a1a1a;line-height:1.5}.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;margin-bottom:28px;border-bottom:3px solid #990000}.header-left h1{margin:0 0 4px;font-size:22px}.header-right{text-align:right}.ticket-id{font-size:24px;font-weight:800;color:#990000;font-family:monospace}.ticket-fecha{font-size:11px;color:#777;margin-top:4px}.section{margin-bottom:22px}.section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#999;margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid #eee}.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.field-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:2px}.field-value{font-size:14px;color:#1a1a1a;font-weight:500}.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700}.badge-urg{background:${urg.bg};color:${urg.color};border:1px solid ${urg.color}40}.badge-est{background:rgba(0,0,0,.05);color:${est.color};border:1px solid ${est.color}40}.descripcion{background:#f8f8f8;border-left:3px solid #990000;padding:14px 16px;border-radius:0 4px 4px 0;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word}.footer{margin-top:40px;padding-top:14px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#aaa}.notas{background:#fff9e6;border-left:3px solid #d4960c;padding:12px 14px;border-radius:0 4px 4px 0;font-size:13px}@media print{body{padding:20px 16px}}</style>
</head><body>
<div class="header"><div class="header-left"><h1>Grupo Foro Inmobiliario</h1><p>Reporte de inconveniente — Plataforma Propia</p></div>
<div class="header-right"><div class="ticket-id">${ticketNum(r.id)}</div><div class="ticket-fecha">Creado el ${fmtFecha(r.created_at)}</div></div></div>
<div class="section"><div class="section-title">Datos del corredor</div>
<div class="grid-2"><div><div class="field-label">Nombre</div><div class="field-value">${r.nombre}</div></div>
<div><div class="field-label">Email</div><div class="field-value">${r.email}</div></div>
${r.matricula ? `<div><div class="field-label">Matrícula COCIR</div><div class="field-value">${r.matricula}</div></div>` : ""}</div></div>
<div class="section"><div class="section-title">Detalle del problema</div>
<div class="grid-2" style="margin-bottom:14px">
<div><div class="field-label">Tipo</div><div class="field-value">${tipoIcon(r.tipo)} ${tipoLabel(r.tipo)}</div></div>
<div><div class="field-label">Urgencia</div><span class="badge badge-urg">${urg.label.toUpperCase()} — ${urg.desc}</span></div></div>
<div class="field-label" style="margin-bottom:6px">Descripción</div>
<div class="descripcion">${r.descripcion.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</div></div>
<div class="section"><div class="section-title">Estado</div><span class="badge badge-est">${est.icon} ${est.label}</span></div>
${r.notas_admin ? `<div class="section"><div class="section-title">Notas internas GFI</div><div class="notas">${r.notas_admin.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</div></div>` : ""}
<div class="footer"><span>Grupo Foro Inmobiliario · foroinmobiliario.com.ar</span><span>Generado el ${new Date().toLocaleDateString("es-AR")}</span></div>
</body></html>`);
  setTimeout(() => win.print(), 350);
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PropiaPage() {
  const [tab, setTab]           = useState<"reportar" | "mis_reportes" | "admin">("reportar");
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState<string | null>(null);

  // Config contacto
  const [config, setConfig]       = useState<PropiaConfig | null>(null);
  const [editCfg, setEditCfg]     = useState<Partial<PropiaConfig>>({});
  const [guardandoCfg, setGuardandoCfg] = useState(false);
  const [cfgOk, setCfgOk]         = useState(false);

  // Form reporte
  const [tipo, setTipo]           = useState("");
  const [urgencia, setUrgencia]   = useState("media");
  const [descripcion, setDesc]    = useState("");
  const [enviando, setEnviando]   = useState(false);
  const [enviado, setEnviado]     = useState(false);
  const [formError, setFormError] = useState("");

  // Admin
  const [filtroEstado, setFiltroEstado] = useState("");
  const [expandido, setExpandido]       = useState<string | null>(null);
  const [notasAdmin, setNotasAdmin]     = useState<Record<string, string>>({});
  const [guardando, setGuardando]       = useState<string | null>(null);
  const [contadores, setContadores]     = useState({ pendiente: 0, en_seguimiento: 0, resuelto: 0 });

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/propia-config");
    if (res.ok) setConfig(await res.json());
  }, []);

  const fetchReportes = useCallback(async (tkn: string) => {
    const url = filtroEstado ? `/api/propia-soporte?estado=${filtroEstado}` : "/api/propia-soporte";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tkn}` } });
    if (!res.ok) return;
    const d = await res.json();
    setReportes(d.reportes ?? []);
    setIsAdmin(d.isAdmin ?? false);
    const cont = { pendiente: 0, en_seguimiento: 0, resuelto: 0 };
    (d.reportes ?? []).forEach((r: Reporte) => {
      if (r.estado in cont) cont[r.estado as keyof typeof cont]++;
    });
    setContadores(cont);
  }, [filtroEstado]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      setToken(session.access_token);
      await Promise.all([fetchReportes(session.access_token), fetchConfig()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => { if (token) fetchReportes(token); }, [filtroEstado, token, fetchReportes]);

  const enviarReporte = async () => {
    setFormError("");
    if (!tipo) { setFormError("Seleccioná el tipo de inconveniente."); return; }
    if (descripcion.trim().length < 20) { setFormError("La descripción debe tener al menos 20 caracteres."); return; }
    setEnviando(true);
    const res = await fetch("/api/propia-soporte", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tipo, urgencia, descripcion }),
    });
    const data = await res.json();
    setEnviando(false);
    if (!res.ok) { setFormError(data.error ?? "Error al enviar."); return; }
    setEnviado(true);
    setTipo(""); setUrgencia("media"); setDesc("");
    if (token) fetchReportes(token);
    setTimeout(() => { setEnviado(false); setTab("mis_reportes"); }, 2500);
  };

  const actualizarReporte = async (id: string, estado?: string) => {
    if (!token) return;
    setGuardando(id);
    const body: Record<string, string> = { id };
    if (estado) body.estado = estado;
    if (notasAdmin[id] !== undefined) body.notas_admin = notasAdmin[id];
    await fetch("/api/propia-soporte", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setGuardando(null);
    if (token) fetchReportes(token);
  };

  const guardarConfig = async () => {
    if (!token) return;
    setGuardandoCfg(true);
    await fetch("/api/propia-config", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(editCfg),
    });
    setGuardandoCfg(false);
    setCfgOk(true);
    fetchConfig();
    setTimeout(() => setCfgOk(false), 2500);
  };

  // Teléfonos configurados
  const phones = [
    config?.propia_tel_1 ? { num: config.propia_tel_1, label: config.propia_tel_1_label || "Soporte Propia" } : null,
    config?.propia_tel_2 ? { num: config.propia_tel_2, label: config.propia_tel_2_label || "Soporte Propia" } : null,
    config?.propia_tel_3 ? { num: config.propia_tel_3, label: config.propia_tel_3_label || "Soporte Propia" } : null,
  ].filter(Boolean) as { num: string; label: string }[];

  const reportesFiltrados = filtroEstado ? reportes.filter(r => r.estado === filtroEstado) : reportes;
  const misReportes = isAdmin ? [] : reportes;

  return (
    <>
      <style>{`
        .prp-card { background:#111; border:1px solid #1e1e1e; border-radius:10px; }
        .prp-input { width:100%; padding:10px 13px; background:#1a1a1a; border:1px solid #272727; border-radius:6px; color:#fff; font-size:14px; font-family:var(--font-body,Inter,sans-serif); outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .prp-input:focus { border-color:rgba(153,0,0,0.5); }
        .prp-select { width:100%; padding:10px 13px; background:#1a1a1a; border:1px solid #272727; border-radius:6px; color:#fff; font-size:14px; font-family:var(--font-body,Inter,sans-serif); outline:none; cursor:pointer; }
        .prp-label { display:block; font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#555; margin-bottom:6px; font-family:var(--font-display,Montserrat,sans-serif); }
        .prp-btn { padding:9px 18px; border:none; border-radius:6px; font-family:var(--font-display,Montserrat,sans-serif); font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; transition:all 0.15s; text-decoration:none; display:inline-flex; align-items:center; gap:6px; }
        .prp-tab { padding:8px 18px; border-radius:7px; font-family:var(--font-display,Montserrat,sans-serif); font-size:12px; font-weight:700; letter-spacing:0.06em; cursor:pointer; border:1px solid #222; transition:all 0.15s; white-space:nowrap; }
        .prp-tipo-btn { padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid #222; background:#111; transition:all 0.15s; text-align:left; width:100%; display:flex; align-items:center; gap:10px; }
        .prp-tipo-btn:hover { border-color:#333; background:#1a1a1a; }
        .prp-tipo-btn.selected { border-color:rgba(153,0,0,0.45); background:rgba(153,0,0,0.08); }
        .prp-urg-btn { padding:10px 14px; border-radius:8px; cursor:pointer; border:1px solid #222; background:#111; transition:all 0.15s; text-align:left; flex:1; min-width:100px; }
        .prp-urg-btn:hover { border-color:#333; background:#1a1a1a; }
        .prp-contact-btn { padding:7px 14px; border-radius:6px; font-family:var(--font-display,Montserrat,sans-serif); font-size:11px; font-weight:700; letter-spacing:0.06em; cursor:pointer; border:1px solid; text-decoration:none; display:inline-flex; align-items:center; gap:5px; transition:all 0.15s; white-space:nowrap; }
        @keyframes prp-slide { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .prp-slide { animation:prp-slide 0.25s ease-out; }
        @media(max-width:700px){.prp-tipos{grid-template-columns:1fr!important;} .prp-phones{flex-direction:column!important;}}
      `}</style>

      <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 22, fontWeight: 800, color: "#f0f0f0", margin: 0, marginBottom: 6 }}>
              Soporte <span style={{ color: "#990000" }}>Propia</span>
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.5, maxWidth: 560 }}>
              Reportá inconvenientes con la plataforma Propia. El equipo GFI los trasladará directamente al área técnica.
            </p>
          </div>
          <div style={{ padding: "10px 16px", background: "rgba(153,0,0,0.06)", border: "1px solid rgba(153,0,0,0.15)", borderRadius: 8, fontSize: 12, color: "#777", lineHeight: 1.5, maxWidth: 220, flexShrink: 0 }}>
            <strong style={{ color: "#cc4444", display: "block", marginBottom: 2 }}>¿Qué NO es esto?</strong>
            No es soporte directo de Propia. Es un canal interno GFI para organizar y canalizar problemas al área técnica.
          </div>
        </div>

        {/* ══════════════ CONTACTO Y RECURSOS PROPIA ══════════════ */}
        <div className="prp-card" style={{ padding: "20px 22px" }}>
          <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
            Contacto directo con Propia
          </div>

          <div className="prp-phones" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: phones.length > 0 || config?.propia_email || config?.propia_reglamento_url ? 18 : 0 }}>

            {/* Teléfonos */}
            {phones.length > 0 ? phones.map((ph, i) => (
              <div key={i} style={{ flex: "1 1 200px", padding: "14px 16px", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  📞 {ph.label}
                </div>
                <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 18, fontWeight: 800, color: "#f0f0f0", letterSpacing: "0.04em", marginBottom: 12 }}>
                  {ph.num}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={telLink(ph.num)} className="prp-contact-btn"
                    style={{ background: "rgba(58,186,182,0.1)", color: "#3abab6", borderColor: "rgba(58,186,182,0.25)" }}>
                    📞 Llamar
                  </a>
                  <a href={waLink(ph.num)} target="_blank" rel="noopener noreferrer" className="prp-contact-btn"
                    style={{ background: "rgba(37,211,102,0.08)", color: "#25d366", borderColor: "rgba(37,211,102,0.2)" }}>
                    WhatsApp
                  </a>
                </div>
              </div>
            )) : (
              <div style={{ flex: "1 1 200px", padding: "14px 16px", background: "#0d0d0d", border: "1px dashed #222", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>📞</span>
                <span style={{ fontSize: 12, color: "#444" }}>{isAdmin ? "Sin teléfonos configurados — agregá uno en el Panel admin ↓" : "Sin teléfonos de contacto aún"}</span>
              </div>
            )}

            {/* Email */}
            <div style={{ flex: "1 1 200px", padding: "14px 16px", background: "#0d0d0d", border: config?.propia_email ? "1px solid #1e1e1e" : "1px dashed #222", borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                ✉️ Email de soporte
              </div>
              {config?.propia_email ? (
                <>
                  <div style={{ fontFamily: "var(--font-body,Inter,sans-serif)", fontSize: 14, fontWeight: 600, color: "#f0f0f0", marginBottom: 12, wordBreak: "break-all" }}>
                    {config.propia_email}
                  </div>
                  <a href={`mailto:${config.propia_email}`} className="prp-contact-btn"
                    style={{ background: "rgba(74,184,216,0.08)", color: "#4ab8d8", borderColor: "rgba(74,184,216,0.2)" }}>
                    ✉️ Enviar email
                  </a>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "#444" }}>{isAdmin ? "Sin email configurado" : "Sin email de contacto aún"}</span>
              )}
            </div>
          </div>

          {/* Reglamento */}
          {config?.propia_reglamento_url ? (
            <div style={{ padding: "14px 16px", background: "rgba(153,0,0,0.05)", border: "1px solid rgba(153,0,0,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>📄</span>
                <div>
                  <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 13, fontWeight: 800, color: "#f0f0f0" }}>
                    {config.propia_reglamento_nombre || "Reglamento Propia"}
                  </div>
                  <div style={{ fontSize: 11, color: "#555" }}>Documento oficial para corredores</div>
                </div>
              </div>
              <a href={config.propia_reglamento_url} target="_blank" rel="noopener noreferrer"
                className="prp-contact-btn"
                style={{ background: "rgba(153,0,0,0.12)", color: "#cc4444", borderColor: "rgba(153,0,0,0.25)", padding: "10px 18px", fontSize: 12 }}>
                ↓ Descargar reglamento
              </a>
            </div>
          ) : isAdmin ? (
            <div style={{ padding: "12px 14px", background: "#0d0d0d", border: "1px dashed #222", borderRadius: 8, fontSize: 12, color: "#444", display: "flex", gap: 8, alignItems: "center" }}>
              <span>📄</span> Sin reglamento cargado — configuralo en el Panel admin ↓
            </div>
          ) : null}
        </div>

        {/* ── Stats admin ── */}
        {isAdmin && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { l: "Pendientes",     n: contadores.pendiente,      c: "#888"    },
              { l: "En seguimiento", n: contadores.en_seguimiento, c: "#4ab8d8" },
              { l: "Resueltos",      n: contadores.resuelto,       c: "#3abab6" },
            ].map(k => (
              <div key={k.l} className="prp-card" style={{ padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 28, fontWeight: 800, color: k.c }}>{k.n}</div>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{k.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "reportar",     label: "📝 Reportar problema" },
            { key: "mis_reportes", label: "📋 Mis reportes" },
            ...(isAdmin ? [{ key: "admin", label: `🗂 Panel admin (${reportes.length})` }] : []),
          ].map(t => (
            <button key={t.key} className="prp-tab" onClick={() => setTab(t.key as typeof tab)}
              style={{ background: tab === t.key ? "rgba(153,0,0,0.12)" : "#0d0d0d", color: tab === t.key ? "#cc3333" : "#555", borderColor: tab === t.key ? "rgba(153,0,0,0.3)" : "#222" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════ TAB: REPORTAR ═══════════ */}
        {tab === "reportar" && (
          <div className="prp-slide">
            {enviado ? (
              <div className="prp-card" style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 18, fontWeight: 800, color: "#3abab6", marginBottom: 8 }}>Reporte enviado</div>
                <div style={{ fontSize: 13, color: "#666" }}>Podés seguir su estado en "Mis reportes".</div>
              </div>
            ) : (
              <div className="prp-card" style={{ padding: "24px" }}>
                {/* Tipo */}
                <div style={{ marginBottom: 22 }}>
                  <label className="prp-label">Tipo de inconveniente *</label>
                  <div className="prp-tipos" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                    {TIPOS.map(t => (
                      <button key={t.value} className={`prp-tipo-btn${tipo === t.value ? " selected" : ""}`}
                        onClick={() => setTipo(t.value)}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
                        <span style={{ fontSize: 13, color: tipo === t.value ? "#e0e0e0" : "#888", fontFamily: "var(--font-body,Inter,sans-serif)" }}>{t.label}</span>
                        {tipo === t.value && <span style={{ marginLeft: "auto", color: "#990000", fontSize: 16, flexShrink: 0 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Urgencia */}
                <div style={{ marginBottom: 22 }}>
                  <label className="prp-label">Nivel de urgencia *</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {URGENCIAS.map(u => (
                      <button key={u.value} className="prp-urg-btn"
                        onClick={() => setUrgencia(u.value)}
                        style={{ borderColor: urgencia === u.value ? u.color + "60" : "#222", background: urgencia === u.value ? u.bg : "#111" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: urgencia === u.value ? u.color : "#888", fontFamily: "var(--font-display,Montserrat,sans-serif)", marginBottom: 2 }}>{u.label}</div>
                        <div style={{ fontSize: 10, color: "#555" }}>{u.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descripción */}
                <div style={{ marginBottom: 20 }}>
                  <label className="prp-label">Descripción detallada * <span style={{ color: "#444", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>({descripcion.trim().length}/20 mínimo)</span></label>
                  <textarea className="prp-input" rows={6} value={descripcion} onChange={e => setDesc(e.target.value)}
                    placeholder="Describí el problema: qué intentabas hacer, qué error aparece, desde cuándo ocurre, si afecta a otros de tu inmobiliaria..." style={{ resize: "vertical", lineHeight: 1.6 }} />
                </div>

                <div style={{ marginBottom: 20, padding: "10px 14px", background: "rgba(74,184,216,0.05)", border: "1px solid rgba(74,184,216,0.12)", borderRadius: 6, fontSize: 12, color: "#4ab8d8", lineHeight: 1.6 }}>
                  💡 <strong>Tip:</strong> Cuánto más detallada sea la descripción, más rápido se puede resolver. Si tenés captura de pantalla, pegá el link de la imagen.
                </div>

                {formError && (
                  <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, fontSize: 13, color: "#ff6666" }}>
                    {formError}
                  </div>
                )}

                <button className="prp-btn" onClick={enviarReporte} disabled={enviando}
                  style={{ background: enviando ? "rgba(153,0,0,0.5)" : "#990000", color: "#fff", width: "100%", padding: "13px", fontSize: 13, opacity: enviando ? 0.7 : 1, cursor: enviando ? "not-allowed" : "pointer", justifyContent: "center" }}>
                  {enviando ? "Enviando..." : "Enviar reporte"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ TAB: MIS REPORTES ═══════════ */}
        {tab === "mis_reportes" && (
          <div className="prp-slide" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div className="prp-card" style={{ padding: "32px", textAlign: "center", color: "#555", fontSize: 13 }}>Cargando...</div>
            ) : misReportes.length === 0 && !isAdmin ? (
              <div className="prp-card" style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>Todavía no enviaste ningún reporte</div>
                <button className="prp-btn" onClick={() => setTab("reportar")} style={{ background: "#990000", color: "#fff", margin: "0 auto" }}>Reportar un problema</button>
              </div>
            ) : (
              (isAdmin ? reportes : misReportes).map(r => (
                <ReporteCard key={r.id} r={r} showName={isAdmin} onExport={() => exportarPDF(r)} />
              ))
            )}
          </div>
        )}

        {/* ═══════════ TAB: ADMIN ═══════════ */}
        {tab === "admin" && isAdmin && (
          <div className="prp-slide" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Configurar contacto ── */}
            <div className="prp-card" style={{ padding: "22px" }}>
              <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 13, fontWeight: 800, color: "#f0f0f0", marginBottom: 16 }}>
                ⚙️ Configurar contacto y recursos
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Tel 1 */}
                <div>
                  <label className="prp-label">Teléfono 1 — número</label>
                  <input className="prp-input" type="text" placeholder="+54 9 11 1234-5678"
                    defaultValue={config?.propia_tel_1 ?? ""}
                    onChange={e => setEditCfg(p => ({ ...p, propia_tel_1: e.target.value }))} />
                </div>
                <div>
                  <label className="prp-label">Teléfono 1 — descripción</label>
                  <input className="prp-input" type="text" placeholder="Ej: Soporte técnico"
                    defaultValue={config?.propia_tel_1_label ?? ""}
                    onChange={e => setEditCfg(p => ({ ...p, propia_tel_1_label: e.target.value }))} />
                </div>

                {/* Tel 2 */}
                <div>
                  <label className="prp-label">Teléfono 2 — número</label>
                  <input className="prp-input" type="text" placeholder="+54 9 11 XXXX-XXXX"
                    defaultValue={config?.propia_tel_2 ?? ""}
                    onChange={e => setEditCfg(p => ({ ...p, propia_tel_2: e.target.value }))} />
                </div>
                <div>
                  <label className="prp-label">Teléfono 2 — descripción</label>
                  <input className="prp-input" type="text" placeholder="Ej: Comercial"
                    defaultValue={config?.propia_tel_2_label ?? ""}
                    onChange={e => setEditCfg(p => ({ ...p, propia_tel_2_label: e.target.value }))} />
                </div>

                {/* Tel 3 */}
                <div>
                  <label className="prp-label">Teléfono 3 — número (opcional)</label>
                  <input className="prp-input" type="text" placeholder="+54 9 11 XXXX-XXXX"
                    defaultValue={config?.propia_tel_3 ?? ""}
                    onChange={e => setEditCfg(p => ({ ...p, propia_tel_3: e.target.value }))} />
                </div>
                <div>
                  <label className="prp-label">Teléfono 3 — descripción</label>
                  <input className="prp-input" type="text" placeholder="Ej: Administración"
                    defaultValue={config?.propia_tel_3_label ?? ""}
                    onChange={e => setEditCfg(p => ({ ...p, propia_tel_3_label: e.target.value }))} />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginTop: 14 }}>
                <label className="prp-label">Email de soporte Propia</label>
                <input className="prp-input" type="email" placeholder="soporte@propia.com.ar"
                  defaultValue={config?.propia_email ?? ""}
                  onChange={e => setEditCfg(p => ({ ...p, propia_email: e.target.value }))} />
              </div>

              {/* Reglamento */}
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="prp-label">URL del reglamento (PDF o Drive)</label>
                  <input className="prp-input" type="url" placeholder="https://drive.google.com/..."
                    defaultValue={config?.propia_reglamento_url ?? ""}
                    onChange={e => setEditCfg(p => ({ ...p, propia_reglamento_url: e.target.value }))} />
                  <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
                    Pegá el link público de Google Drive, Dropbox u otro servicio
                  </div>
                </div>
                <div>
                  <label className="prp-label">Nombre del archivo a mostrar</label>
                  <input className="prp-input" type="text" placeholder="Reglamento Propia 2025.pdf"
                    defaultValue={config?.propia_reglamento_nombre ?? ""}
                    onChange={e => setEditCfg(p => ({ ...p, propia_reglamento_nombre: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
                <button className="prp-btn" onClick={guardarConfig} disabled={guardandoCfg}
                  style={{ background: guardandoCfg ? "rgba(153,0,0,0.5)" : "#990000", color: "#fff", padding: "10px 22px", opacity: guardandoCfg ? 0.7 : 1, cursor: guardandoCfg ? "not-allowed" : "pointer" }}>
                  {guardandoCfg ? "Guardando..." : "💾 Guardar configuración"}
                </button>
                {cfgOk && <span style={{ fontSize: 12, color: "#3abab6", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700 }}>✓ Guardado</span>}
              </div>
            </div>

            {/* ── Filtros y reportes ── */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700 }}>FILTRAR:</span>
              {["", "pendiente", "en_seguimiento", "resuelto", "no_reproducible"].map(e => {
                const info = e ? estInfo(e) : { label: "Todos", color: "#888", icon: "📋" };
                return (
                  <button key={e} className="prp-tab" onClick={() => setFiltroEstado(e)}
                    style={{ background: filtroEstado === e ? "rgba(153,0,0,0.12)" : "#0d0d0d", color: filtroEstado === e ? "#cc3333" : "#555", borderColor: filtroEstado === e ? "rgba(153,0,0,0.3)" : "#222", fontSize: 11, padding: "5px 12px" }}>
                    {info.icon} {info.label}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="prp-card" style={{ padding: "32px", textAlign: "center", color: "#555", fontSize: 13 }}>Cargando...</div>
            ) : reportesFiltrados.length === 0 ? (
              <div className="prp-card" style={{ padding: "32px", textAlign: "center", color: "#555", fontSize: 13 }}>
                No hay reportes{filtroEstado ? ` con estado "${estInfo(filtroEstado).label}"` : ""}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reportesFiltrados.map(r => (
                  <div key={r.id} className="prp-card" style={{ overflow: "hidden" }}>
                    <div onClick={() => setExpandido(expandido === r.id ? null : r.id)}
                      style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 12, fontWeight: 800, color: "#990000" }}>{ticketNum(r.id)}</span>
                          <span style={{ fontSize: 16 }}>{tipoIcon(r.tipo)}</span>
                          <span style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>{tipoLabel(r.tipo)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          <strong style={{ color: "#aaa" }}>{r.nombre}</strong>
                          {r.matricula && <span style={{ color: "#555" }}> · Mat. {r.matricula}</span>}
                          <span style={{ color: "#444" }}> · {r.email}</span>
                          <span style={{ color: "#333" }}> · {fmtFecha(r.created_at)}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        <UrgBadge v={r.urgencia} />
                        <EstBadge v={r.estado} />
                        <span style={{ fontSize: 14, color: "#444", marginLeft: 4 }}>{expandido === r.id ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {expandido === r.id && (
                      <div style={{ padding: "0 20px 20px", borderTop: "1px solid #1a1a1a" }}>
                        <div style={{ marginTop: 16, padding: "14px 16px", background: "#0d0d0d", borderRadius: 8, borderLeft: "3px solid #990000" }}>
                          <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Descripción</div>
                          <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.descripcion}</div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                          <div className="prp-label" style={{ marginBottom: 8 }}>Cambiar estado</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {ESTADOS.map(e => (
                              <button key={e.value} className="prp-btn"
                                onClick={() => actualizarReporte(r.id, e.value)}
                                disabled={guardando === r.id || r.estado === e.value}
                                style={{ background: r.estado === e.value ? "rgba(0,0,0,0.3)" : "#1a1a1a", color: r.estado === e.value ? e.color : "#888", border: `1px solid ${r.estado === e.value ? e.color + "40" : "#2a2a2a"}`, fontSize: 11, padding: "6px 14px", cursor: r.estado === e.value ? "default" : "pointer", opacity: guardando === r.id ? 0.6 : 1 }}>
                                {e.icon} {e.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                          <label className="prp-label">Notas internas (sólo admins)</label>
                          <textarea className="prp-input" rows={3}
                            defaultValue={r.notas_admin ?? ""}
                            onChange={e => setNotasAdmin(prev => ({ ...prev, [r.id]: e.target.value }))}
                            placeholder="Notas de seguimiento, número de ticket Propia, etc."
                            style={{ resize: "vertical" }} />
                        </div>

                        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="prp-btn" onClick={() => actualizarReporte(r.id)} disabled={guardando === r.id}
                            style={{ background: "rgba(153,0,0,0.12)", color: "#cc4444", border: "1px solid rgba(153,0,0,0.25)", opacity: guardando === r.id ? 0.6 : 1 }}>
                            {guardando === r.id ? "Guardando..." : "💾 Guardar notas"}
                          </button>
                          <button className="prp-btn" onClick={() => exportarPDF(r)}
                            style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}>
                            📄 Exportar PDF
                          </button>
                          <a href={`mailto:${r.email}?subject=Tu reporte Propia ${ticketNum(r.id)}`}
                            className="prp-btn"
                            style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}>
                            ✉️ Responder
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Nota al pie ── */}
        <div style={{ fontSize: 11, color: "#333", lineHeight: 1.6, padding: "0 4px" }}>
          Los reportes son recibidos por el equipo GFI y trasladados al área técnica de Propia. Los tiempos de respuesta dependen de Propia. Para urgencias críticas, usá el contacto directo de arriba.
        </div>
      </div>
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function UrgBadge({ v }: { v: string }) {
  const u = urgInfo(v);
  return <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, background: u.bg, color: u.color, border: `1px solid ${u.color}40`, whiteSpace: "nowrap" }}>{u.label}</span>;
}
function EstBadge({ v }: { v: string }) {
  const e = estInfo(v);
  return <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, background: "#111", color: e.color, border: `1px solid ${e.color}30`, whiteSpace: "nowrap" }}>{e.icon} {e.label}</span>;
}
function ReporteCard({ r, showName, onExport }: { r: Reporte; showName: boolean; onExport: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden" }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 11, fontWeight: 800, color: "#990000" }}>{ticketNum(r.id)}</span>
            <span style={{ fontSize: 14 }}>{tipoIcon(r.tipo)}</span>
            <span style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>{tipoLabel(r.tipo)}</span>
          </div>
          <div style={{ fontSize: 11, color: "#555" }}>{showName && <strong style={{ color: "#888" }}>{r.nombre} · </strong>}{fmtFecha(r.created_at)}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <UrgBadge v={r.urgencia} />
          <EstBadge v={r.estado} />
          <span style={{ fontSize: 14, color: "#444" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid #1a1a1a" }}>
          <div style={{ marginTop: 14, padding: "12px 14px", background: "#0d0d0d", borderRadius: 8, borderLeft: "3px solid #990000" }}>
            <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Tu descripción</div>
            <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{r.descripcion}</div>
          </div>
          {r.notas_admin && (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(212,150,12,0.06)", border: "1px solid rgba(212,150,12,0.15)", borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "#d4960c", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Respuesta GFI</div>
              <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>{r.notas_admin}</div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button onClick={onExport} style={{ padding: "7px 14px", borderRadius: 6, background: "#1a1a1a", color: "#777", border: "1px solid #2a2a2a", fontSize: 11, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>
              📄 Exportar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
