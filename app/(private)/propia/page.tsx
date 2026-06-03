"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Reporte {
  id: string;
  created_at: string;
  updated_at: string;
  perfil_id: string;
  nombre: string;
  email: string;
  matricula: string | null;
  tipo: string;
  urgencia: string;
  descripcion: string;
  estado: string;
  notas_admin: string | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────
const TIPOS = [
  { value: "portal_lento",     label: "Portal caído / muy lento",            icon: "🌐" },
  { value: "publicar_prop",    label: "Error al publicar propiedad",          icon: "🏠" },
  { value: "imagenes",         label: "Problemas con imágenes / fotos",       icon: "🖼️" },
  { value: "contratos",        label: "Contratos y documentos",               icon: "📄" },
  { value: "pagos",            label: "Pagos y facturación",                  icon: "💳" },
  { value: "leads",            label: "Leads / consultas no llegan",          icon: "📨" },
  { value: "integracion",      label: "Integración con CRM / portales",       icon: "🔗" },
  { value: "acceso_cuenta",    label: "Acceso a mi cuenta",                   icon: "🔑" },
  { value: "carga_datos",      label: "Carga o sincronización de datos",      icon: "🔄" },
  { value: "otro",             label: "Otro",                                 icon: "📝" },
];

const URGENCIAS = [
  { value: "baja",     label: "Baja",     desc: "No bloquea mi trabajo",        color: "#3abab6", bg: "rgba(58,186,182,0.1)"  },
  { value: "media",    label: "Media",    desc: "Me dificulta el trabajo",       color: "#d4960c", bg: "rgba(212,150,12,0.1)"  },
  { value: "alta",     label: "Alta",     desc: "Bloquea parte de mi trabajo",   color: "#e85c0a", bg: "rgba(232,92,10,0.1)"   },
  { value: "critica",  label: "Crítica",  desc: "No puedo operar",               color: "#dc2626", bg: "rgba(220,38,38,0.12)"  },
];

const ESTADOS = [
  { value: "pendiente",        label: "Pendiente",        color: "#888",    icon: "⏳" },
  { value: "en_seguimiento",   label: "En seguimiento",   color: "#4ab8d8", icon: "🔄" },
  { value: "resuelto",         label: "Resuelto",         color: "#3abab6", icon: "✅" },
  { value: "no_reproducible",  label: "No reproducible",  color: "#d4960c", icon: "❓" },
];

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ticketNum = (id: string) => "#" + id.slice(0, 8).toUpperCase();

function urgenciaInfo(v: string) { return URGENCIAS.find(u => u.value === v) ?? URGENCIAS[1]; }
function estadoInfo(v: string)   { return ESTADOS.find(e => e.value === v)   ?? ESTADOS[0]; }
function tipoLabel(v: string)    { return TIPOS.find(t => t.value === v)?.label ?? v; }
function tipoIcon(v: string)     { return TIPOS.find(t => t.value === v)?.icon ?? "📝"; }

// ── PDF export ────────────────────────────────────────────────────────────────
function exportarPDF(r: Reporte) {
  const win = window.open("", "_blank");
  if (!win) return;
  const urg = urgenciaInfo(r.urgencia);
  const est = estadoInfo(r.estado);
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Propia ${ticketNum(r.id)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; max-width: 700px; margin: 0 auto; padding: 32px 28px; color: #1a1a1a; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; margin-bottom: 28px; border-bottom: 3px solid #990000; }
  .header-left h1 { margin: 0 0 4px; font-size: 22px; color: #111; }
  .header-left p  { margin: 0; font-size: 13px; color: #555; }
  .header-right   { text-align: right; }
  .ticket-id      { font-size: 24px; font-weight: 800; color: #990000; font-family: monospace; }
  .ticket-fecha   { font-size: 11px; color: #777; margin-top: 4px; }
  .section        { margin-bottom: 22px; }
  .section-title  { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #999; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
  .grid-2         { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field-label    { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 2px; }
  .field-value    { font-size: 14px; color: #1a1a1a; font-weight: 500; }
  .badge          { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .badge-urg      { background: ${urg.bg}; color: ${urg.color}; border: 1px solid ${urg.color}40; }
  .badge-est      { background: rgba(0,0,0,0.05); color: ${est.color}; border: 1px solid ${est.color}40; }
  .descripcion    { background: #f8f8f8; border-left: 3px solid #990000; padding: 14px 16px; border-radius: 0 4px 4px 0; font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
  .footer         { margin-top: 40px; padding-top: 14px; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
  .notas          { background: #fff9e6; border-left: 3px solid #d4960c; padding: 12px 14px; border-radius: 0 4px 4px 0; font-size: 13px; }
  @media print { body { padding: 20px 16px; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Grupo Foro Inmobiliario</h1>
      <p>Reporte de inconveniente — Plataforma Propia</p>
    </div>
    <div class="header-right">
      <div class="ticket-id">${ticketNum(r.id)}</div>
      <div class="ticket-fecha">Creado el ${fmtFecha(r.created_at)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del corredor</div>
    <div class="grid-2">
      <div>
        <div class="field-label">Nombre</div>
        <div class="field-value">${r.nombre}</div>
      </div>
      <div>
        <div class="field-label">Email</div>
        <div class="field-value">${r.email}</div>
      </div>
      ${r.matricula ? `<div>
        <div class="field-label">Matrícula COCIR</div>
        <div class="field-value">${r.matricula}</div>
      </div>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle del problema</div>
    <div class="grid-2" style="margin-bottom:14px">
      <div>
        <div class="field-label">Tipo de inconveniente</div>
        <div class="field-value">${tipoIcon(r.tipo)} ${tipoLabel(r.tipo)}</div>
      </div>
      <div>
        <div class="field-label">Urgencia</div>
        <div><span class="badge badge-urg">${urg.label.toUpperCase()} — ${urg.desc}</span></div>
      </div>
    </div>
    <div class="field-label" style="margin-bottom:6px">Descripción del problema</div>
    <div class="descripcion">${r.descripcion.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
  </div>

  <div class="section">
    <div class="section-title">Estado</div>
    <span class="badge badge-est">${est.icon} ${est.label}</span>
    ${r.updated_at !== r.created_at ? `<div style="font-size:11px;color:#999;margin-top:6px">Última actualización: ${fmtFecha(r.updated_at)}</div>` : ""}
  </div>

  ${r.notas_admin ? `<div class="section">
    <div class="section-title">Notas internas GFI</div>
    <div class="notas">${r.notas_admin.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
  </div>` : ""}

  <div class="footer">
    <span>Grupo Foro Inmobiliario · foroinmobiliario.com.ar</span>
    <span>Reporte generado el ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
  </div>
</body>
</html>`);
  setTimeout(() => win.print(), 350);
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PropiaPage() {
  const [tab, setTab] = useState<"reportar" | "mis_reportes" | "admin">("reportar");
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Form state
  const [tipo, setTipo]           = useState("");
  const [urgencia, setUrgencia]   = useState("media");
  const [descripcion, setDesc]    = useState("");
  const [enviando, setEnviando]   = useState(false);
  const [enviado, setEnviado]     = useState(false);
  const [formError, setFormError] = useState("");

  // Admin state
  const [filtroEstado, setFiltroEstado]     = useState("");
  const [expandido, setExpandido]           = useState<string | null>(null);
  const [notasAdmin, setNotasAdmin]         = useState<Record<string, string>>({});
  const [guardando, setGuardando]           = useState<string | null>(null);
  const [contadores, setContadores] = useState({ pendiente: 0, en_seguimiento: 0, resuelto: 0 });

  const fetchReportes = useCallback(async (tkn: string) => {
    const url = filtroEstado ? `/api/propia-soporte?estado=${filtroEstado}` : "/api/propia-soporte";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tkn}` } });
    if (!res.ok) return;
    const d = await res.json();
    setReportes(d.reportes ?? []);
    setIsAdmin(d.isAdmin ?? false);

    const cont = { pendiente: 0, en_seguimiento: 0, resuelto: 0 };
    (d.reportes ?? []).forEach((r: Reporte) => {
      if (r.estado === "pendiente") cont.pendiente++;
      else if (r.estado === "en_seguimiento") cont.en_seguimiento++;
      else if (r.estado === "resuelto") cont.resuelto++;
    });
    setContadores(cont);
  }, [filtroEstado]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      setToken(session.access_token);
      await fetchReportes(session.access_token);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (token) fetchReportes(token);
  }, [filtroEstado, token, fetchReportes]);

  const enviarReporte = async () => {
    setFormError("");
    if (!tipo) { setFormError("Seleccioná el tipo de inconveniente."); return; }
    if (!descripcion.trim() || descripcion.trim().length < 20) {
      setFormError("La descripción debe tener al menos 20 caracteres."); return;
    }
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
    fetchReportes(token);
  };

  const misReportes     = reportes.filter(r => !isAdmin || r.perfil_id !== undefined); // todos para admin
  const reportesFiltrados = isAdmin && filtroEstado
    ? reportes.filter(r => r.estado === filtroEstado)
    : reportes;

  return (
    <>
      <style>{`
        .prp-card { background:#111; border:1px solid #1e1e1e; border-radius:10px; }
        .prp-input { width:100%; padding:10px 13px; background:#1a1a1a; border:1px solid #272727; border-radius:6px; color:#fff; font-size:14px; font-family:var(--font-body,Inter,sans-serif); outline:none; box-sizing:border-box; transition:border-color 0.15s; }
        .prp-input:focus { border-color:rgba(153,0,0,0.5); }
        .prp-select { width:100%; padding:10px 13px; background:#1a1a1a; border:1px solid #272727; border-radius:6px; color:#fff; font-size:14px; font-family:var(--font-body,Inter,sans-serif); outline:none; cursor:pointer; }
        .prp-label { display:block; font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#555; margin-bottom:6px; font-family:var(--font-display,Montserrat,sans-serif); }
        .prp-btn { padding:10px 20px; border:none; border-radius:6px; font-family:var(--font-display,Montserrat,sans-serif); font-size:11px; font-weight:700; letter-spacing:0.08em; cursor:pointer; transition:all 0.15s; }
        .prp-tab { padding:8px 18px; border-radius:7px; font-family:var(--font-display,Montserrat,sans-serif); font-size:12px; font-weight:700; letter-spacing:0.06em; cursor:pointer; border:1px solid #222; transition:all 0.15s; white-space:nowrap; }
        .prp-tipo-btn { padding:10px 12px; border-radius:8px; cursor:pointer; border:1px solid #222; background:#111; transition:all 0.15s; text-align:left; width:100%; display:flex; align-items:center; gap:10px; }
        .prp-tipo-btn:hover { border-color:#333; background:#1a1a1a; }
        .prp-tipo-btn.selected { border-color:rgba(153,0,0,0.45); background:rgba(153,0,0,0.08); }
        .prp-urg-btn { padding:10px 14px; border-radius:8px; cursor:pointer; border:1px solid #222; background:#111; transition:all 0.15s; text-align:left; flex:1; }
        .prp-urg-btn:hover { border-color:#333; background:#1a1a1a; }
        @keyframes prp-slide { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .prp-slide { animation:prp-slide 0.25s ease-out; }
        @media(max-width:700px){.prp-cols{flex-direction:column!important;} .prp-tipos{grid-template-columns:1fr!important;}}
      `}</style>

      <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 22, fontWeight: 800, color: "#f0f0f0", margin: 0, marginBottom: 6 }}>
              Soporte <span style={{ color: "#990000" }}>Propia</span>
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.5, maxWidth: 560 }}>
              Describí tu inconveniente con la plataforma Propia. El equipo GFI lo trasladará directamente al área técnica y te dará seguimiento.
            </p>
          </div>
          <div style={{ padding: "10px 16px", background: "rgba(153,0,0,0.06)", border: "1px solid rgba(153,0,0,0.15)", borderRadius: 8, fontSize: 12, color: "#888", lineHeight: 1.5, maxWidth: 220, flexShrink: 0 }}>
            <strong style={{ color: "#cc4444", display: "block", marginBottom: 2 }}>¿Qué NO es esto?</strong>
            No es soporte directo de Propia. Es un canal interno GFI para centralizar y canalizar problemas de forma organizada.
          </div>
        </div>

        {/* ── Stats rápidas (admin) ── */}
        {isAdmin && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { l: "Pendientes",       n: contadores.pendiente,      c: "#888"    },
              { l: "En seguimiento",   n: contadores.en_seguimiento, c: "#4ab8d8" },
              { l: "Resueltos",        n: contadores.resuelto,       c: "#3abab6" },
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
            { key: "reportar",    label: "📝 Reportar problema",    show: true },
            { key: "mis_reportes",label: `📋 Mis reportes${reportes.filter(r=>!isAdmin).length > 0 ? " (" + reportes.filter(r=>r.perfil_id).length + ")" : ""}`, show: true },
            { key: "admin",       label: `🗂 Panel admin (${reportes.length})`, show: isAdmin },
          ].filter(t => t.show).map(t => (
            <button key={t.key} className="prp-tab" onClick={() => setTab(t.key as typeof tab)}
              style={{ background: tab === t.key ? "rgba(153,0,0,0.12)" : "#0d0d0d", color: tab === t.key ? "#cc3333" : "#555", borderColor: tab === t.key ? "rgba(153,0,0,0.3)" : "#222" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════ TAB: REPORTAR ═══════════ */}
        {tab === "reportar" && (
          <div className="prp-slide" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {enviado ? (
              <div className="prp-card" style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 18, fontWeight: 800, color: "#3abab6", marginBottom: 8 }}>Reporte enviado</div>
                <div style={{ fontSize: 13, color: "#666" }}>Tu reporte fue recibido. Podés seguir su estado en "Mis reportes".</div>
              </div>
            ) : (
              <div className="prp-card" style={{ padding: "24px" }}>

                {/* Tipo de problema */}
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
                  <textarea
                    className="prp-input"
                    rows={6}
                    value={descripcion}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Describí el problema con el mayor detalle posible: qué intentabas hacer, qué error aparece, desde cuándo ocurre, si afecta a otras personas de tu inmobiliaria, etc."
                    style={{ resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>

                {/* Tip */}
                <div style={{ marginBottom: 20, padding: "10px 14px", background: "rgba(74,184,216,0.05)", border: "1px solid rgba(74,184,216,0.12)", borderRadius: 6, fontSize: 12, color: "#4ab8d8", lineHeight: 1.6 }}>
                  💡 <strong>Tip:</strong> Cuánto más detallada sea la descripción, más rápido lo podemos resolver. Incluí capturas de pantalla en el texto si podés (pegá el link de la imagen).
                </div>

                {formError && (
                  <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, fontSize: 13, color: "#ff6666" }}>
                    {formError}
                  </div>
                )}

                <button className="prp-btn" onClick={enviarReporte} disabled={enviando}
                  style={{ background: enviando ? "rgba(153,0,0,0.5)" : "#990000", color: "#fff", width: "100%", padding: "13px", fontSize: 13, opacity: enviando ? 0.7 : 1, cursor: enviando ? "not-allowed" : "pointer" }}>
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
            ) : reportes.filter(r => !isAdmin).length === 0 && !isAdmin ? (
              <div className="prp-card" style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, color: "#555" }}>Todavía no enviaste ningún reporte</div>
              </div>
            ) : (
              (isAdmin ? [] : reportes).map(r => (
                <ReporteCard key={r.id} r={r} isAdmin={false} onExport={() => exportarPDF(r)} />
              ))
            )}
            {!isAdmin && reportes.length === 0 && !loading && (
              <div className="prp-card" style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, color: "#555" }}>Todavía no enviaste ningún reporte</div>
                <button className="prp-btn" onClick={() => setTab("reportar")} style={{ marginTop: 16, background: "#990000", color: "#fff" }}>
                  Reportar un problema
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ TAB: ADMIN ═══════════ */}
        {tab === "admin" && isAdmin && (
          <div className="prp-slide" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700 }}>FILTRAR:</span>
              {["", "pendiente", "en_seguimiento", "resuelto", "no_reproducible"].map(e => {
                const info = e ? estadoInfo(e) : { label: "Todos", color: "#888", icon: "📋" };
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
                No hay reportes{filtroEstado ? ` con estado "${estadoInfo(filtroEstado).label}"` : ""}
              </div>
            ) : (
              reportesFiltrados.map(r => (
                <div key={r.id} className="prp-card" style={{ overflow: "hidden" }}>
                  {/* Header del reporte */}
                  <div
                    onClick={() => setExpandido(expandido === r.id ? null : r.id)}
                    style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>

                    {/* Ticket + tipo */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 12, fontWeight: 800, color: "#990000" }}>{ticketNum(r.id)}</span>
                        <span style={{ fontSize: 16 }}>{tipoIcon(r.tipo)}</span>
                        <span style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>{tipoLabel(r.tipo)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        <strong style={{ color: "#aaa" }}>{r.nombre}</strong>
                        {r.matricula && <span style={{ color: "#555" }}> · Mat. {r.matricula}</span>}
                        <span style={{ color: "#444" }}> · {fmtFecha(r.created_at)}</span>
                      </div>
                    </div>

                    {/* Badges */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <UrgenciaBadge v={r.urgencia} />
                      <EstadoBadge v={r.estado} />
                      <span style={{ fontSize: 14, color: "#444", marginLeft: 4 }}>{expandido === r.id ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Panel expandido */}
                  {expandido === r.id && (
                    <div style={{ padding: "0 20px 20px", borderTop: "1px solid #1a1a1a" }}>

                      {/* Descripción */}
                      <div style={{ marginTop: 16, padding: "14px 16px", background: "#0d0d0d", borderRadius: 8, borderLeft: "3px solid #990000" }}>
                        <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Descripción del problema</div>
                        <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.descripcion}</div>
                      </div>

                      {/* Cambiar estado */}
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 10, color: "#555", fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Cambiar estado</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {ESTADOS.map(e => (
                            <button key={e.value} className="prp-btn"
                              onClick={() => actualizarReporte(r.id, e.value)}
                              disabled={guardando === r.id || r.estado === e.value}
                              style={{
                                background: r.estado === e.value ? `rgba(0,0,0,0.3)` : "#1a1a1a",
                                color: r.estado === e.value ? e.color : "#888",
                                border: `1px solid ${r.estado === e.value ? e.color + "40" : "#2a2a2a"}`,
                                fontSize: 11, padding: "6px 14px",
                                cursor: r.estado === e.value ? "default" : "pointer",
                                opacity: guardando === r.id ? 0.6 : 1,
                              }}>
                              {e.icon} {e.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Notas admin */}
                      <div style={{ marginTop: 16 }}>
                        <label className="prp-label">Notas internas (sólo visibles para admins)</label>
                        <textarea
                          className="prp-input"
                          rows={3}
                          defaultValue={r.notas_admin ?? ""}
                          onChange={e => setNotasAdmin(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Agregar notas internas, seguimiento, ticket de Propia, etc."
                          style={{ resize: "vertical" }}
                        />
                      </div>

                      {/* Acciones */}
                      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="prp-btn" onClick={() => actualizarReporte(r.id)} disabled={guardando === r.id}
                          style={{ background: "rgba(153,0,0,0.12)", color: "#cc4444", border: "1px solid rgba(153,0,0,0.25)", opacity: guardando === r.id ? 0.6 : 1 }}>
                          {guardando === r.id ? "Guardando..." : "💾 Guardar notas"}
                        </button>
                        <button className="prp-btn" onClick={() => exportarPDF(r)}
                          style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}>
                          📄 Exportar PDF
                        </button>
                        <a href={`mailto:${r.email}?subject=Tu reporte Propia ${ticketNum(r.id)}&body=Hola ${r.nombre.split(" ")[0]},%0A%0ATe contactamos respecto a tu reporte ${ticketNum(r.id)} sobre: ${tipoLabel(r.tipo)}.%0A%0A`}
                          style={{ padding: "9px 14px", borderRadius: 6, background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a", fontSize: 11, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, letterSpacing: "0.08em", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          ✉️ Email al corredor
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Nota al pie ── */}
        <div style={{ fontSize: 11, color: "#3a3a3a", lineHeight: 1.6, padding: "0 4px" }}>
          Este espacio es para reportar inconvenientes con la plataforma <strong style={{ color: "#444" }}>Propia</strong>. Los reportes son recibidos por el equipo GFI y trasladados al área técnica de Propia. No es soporte directo — los tiempos de respuesta dependen de Propia.
        </div>
      </div>
    </>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function UrgenciaBadge({ v }: { v: string }) {
  const u = urgenciaInfo(v);
  return (
    <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, background: u.bg, color: u.color, border: `1px solid ${u.color}40`, whiteSpace: "nowrap" }}>
      {u.label}
    </span>
  );
}

function EstadoBadge({ v }: { v: string }) {
  const e = estadoInfo(v);
  return (
    <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, fontFamily: "var(--font-display,Montserrat,sans-serif)", fontWeight: 700, background: "#111", color: e.color, border: `1px solid ${e.color}30`, whiteSpace: "nowrap" }}>
      {e.icon} {e.label}
    </span>
  );
}

function ReporteCard({ r, isAdmin: _admin, onExport }: { r: Reporte; isAdmin: boolean; onExport: () => void }) {
  const [expandido, setExpandido] = useState(false);
  return (
    <div className="prp-card" style={{ overflow: "hidden" }}>
      <div onClick={() => setExpandido(!expandido)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontFamily: "var(--font-display,Montserrat,sans-serif)", fontSize: 11, fontWeight: 800, color: "#990000" }}>{ticketNum(r.id)}</span>
            <span style={{ fontSize: 14 }}>{tipoIcon(r.tipo)}</span>
            <span style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>{tipoLabel(r.tipo)}</span>
          </div>
          <div style={{ fontSize: 11, color: "#555" }}>{fmtFecha(r.created_at)}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <UrgenciaBadge v={r.urgencia} />
          <EstadoBadge v={r.estado} />
          <span style={{ fontSize: 14, color: "#444" }}>{expandido ? "▲" : "▼"}</span>
        </div>
      </div>

      {expandido && (
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
