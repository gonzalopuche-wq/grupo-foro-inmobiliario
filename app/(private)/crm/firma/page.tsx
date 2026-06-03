"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Negocio { id: string; titulo: string; }
interface Contacto { id: string; nombre: string; apellido: string; email?: string | null; }
interface Firma {
  id: string;
  titulo: string;
  firmante_nombre: string | null;
  imagen_base64: string;
  created_at: string;
  negocio?: { titulo: string } | null;
  contacto?: { nombre: string; apellido: string } | null;
}

interface FirmanteSolicitud {
  nombre: string;
  email: string;
  rol: string;
}

interface FirmaSolicitud {
  id: string;
  titulo: string;
  estado: string;
  firmantes: Array<{
    nombre: string; email: string; rol: string;
    firmado: boolean; firmado_at: string | null; nombre_firmado: string | null;
  }>;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtFecha = (s: string) =>
  new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ROL_OPTS = ["inquilino", "propietario", "corredor", "garante", "otro"];

const estadoSolicitudColor = (e: string) => {
  if (e === "completado") return "#4ade80";
  if (e === "parcial")    return "#d4960c";
  if (e === "cancelado")  return "#ef4444";
  return "#94a3b8";
};

export default function FirmaDigitalPage() {
  // ── Tab ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"canvas" | "enviar" | "solicitudes">("canvas");

  // ── Canvas pad state ─────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  // ── Auth + data ──────────────────────────────────────────────────────────
  const [userId, setUserId]     = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [firmas, setFirmas]     = useState<Firma[]>([]);
  const [solicitudes, setSolicitudes] = useState<FirmaSolicitud[]>([]);
  const [loading, setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]       = useState("");
  const [form, setForm]         = useState({ titulo: "", firmante: "", negocio_id: "", contacto_id: "" });
  const [verFirma, setVerFirma] = useState<Firma | null>(null);

  // ── Enviar para firmar state ──────────────────────────────────────────────
  const [envTitulo, setEnvTitulo]   = useState("");
  const [envContrato, setEnvContrato] = useState("");
  const [envFirmantes, setEnvFirmantes] = useState<FirmanteSolicitud[]>([
    { nombre: "", email: "", rol: "inquilino" },
  ]);
  const [envContHtml, setEnvContHtml] = useState("");
  const [enviando, setEnviando]     = useState(false);
  const [envResult, setEnvResult]   = useState<{ solicitud_id: string; enviados: number; fallidos: number } | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // ── Cargar datos ─────────────────────────────────────────────────────────
  const cargar = async (uid: string) => {
    const [{ data: neg }, { data: con }, { data: fir }, { data: sols }] = await Promise.all([
      supabase.from("crm_negocios").select("id,titulo").eq("perfil_id", uid).eq("archivado", false).order("updated_at", { ascending: false }).limit(50),
      supabase.from("crm_contactos").select("id,nombre,apellido,email").eq("perfil_id", uid).neq("estado", "archivado").order("apellido").limit(100),
      supabase.from("crm_firmas").select("id,titulo,firmante_nombre,imagen_base64,created_at, negocio:negocio_id(titulo), contacto:contacto_id(nombre,apellido)").eq("perfil_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("firma_solicitudes").select("id,titulo,estado,firmantes,created_at").eq("perfil_id", uid).order("created_at", { ascending: false }).limit(20),
    ]);
    setNegocios((neg ?? []) as Negocio[]);
    setContactos((con ?? []) as Contacto[]);
    setFirmas((fir ?? []) as unknown as Firma[]);
    setSolicitudes((sols ?? []) as unknown as FirmaSolicitud[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      setUserEmail(data.user.email ?? null);
      await cargar(data.user.id);
      setLoading(false);
    })();
  }, []);

  // ── Canvas setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [tab]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    setHasStroke(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [drawing]);

  const onPointerUp = useCallback(() => setDrawing(false), []);

  const limpiar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const guardar = async () => {
    if (!userId || !hasStroke || !form.titulo.trim()) return;
    setGuardando(true);
    const canvas = canvasRef.current!;
    const imagen_base64 = canvas.toDataURL("image/png");
    await supabase.from("crm_firmas").insert({
      perfil_id: userId,
      titulo: form.titulo.trim(),
      firmante_nombre: form.firmante.trim() || null,
      negocio_id: form.negocio_id || null,
      contacto_id: form.contacto_id || null,
      imagen_base64,
    });
    await cargar(userId);
    limpiar();
    setForm({ titulo: "", firmante: "", negocio_id: "", contacto_id: "" });
    setGuardando(false);
    showToast("Firma guardada");
  };

  const eliminar = async (id: string) => {
    if (!userId || !confirm("¿Eliminar esta firma?")) return;
    await supabase.from("crm_firmas").delete().eq("id", id);
    setFirmas(prev => prev.filter(f => f.id !== id));
  };

  const descargar = (firma: Firma) => {
    const a = document.createElement("a");
    a.href = firma.imagen_base64;
    a.download = `firma-${firma.titulo.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  // ── Agregar/quitar firmante ───────────────────────────────────────────────
  const agregarFirmante = () =>
    setEnvFirmantes(f => [...f, { nombre: "", email: "", rol: "inquilino" }]);

  const quitarFirmante = (i: number) =>
    setEnvFirmantes(f => f.filter((_, idx) => idx !== i));

  const updateFirmante = (i: number, field: keyof FirmanteSolicitud, value: string) =>
    setEnvFirmantes(f => f.map((x, idx) => idx === i ? { ...x, [field]: value } : x));

  // ── Autocompletar desde contacto seleccionado ─────────────────────────────
  const llenarDesdeContacto = (contactoId: string, i: number) => {
    const c = contactos.find(x => x.id === contactoId);
    if (!c) return;
    updateFirmante(i, "nombre", `${c.nombre} ${c.apellido}`.trim());
    if (c.email) updateFirmante(i, "email", c.email);
  };

  // ── Enviar solicitud de firma ─────────────────────────────────────────────
  const enviarSolicitud = async () => {
    if (!envTitulo.trim()) { showToast("Ingresá un título para el documento"); return; }
    if (envFirmantes.some(f => !f.nombre.trim() || !f.email.trim())) {
      showToast("Completá nombre y email de cada firmante");
      return;
    }
    setEnviando(true);
    setEnvResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/firma/enviar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        contrato_id: envContrato || undefined,
        titulo: envTitulo.trim(),
        firmantes: envFirmantes,
        documento_html: envContHtml.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Error al enviar");
      setEnviando(false);
      return;
    }
    setEnvResult(data);
    setEnviando(false);
    await cargar(userId!);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "8px 18px",
    background: tab === t ? "#990000" : "rgba(255,255,255,0.04)",
    color: tab === t ? "#fff" : "#94a3b8",
    border: tab === t ? "1px solid #b80000" : "1px solid #1e293b",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "var(--font-display, sans-serif)",
    letterSpacing: "0.06em",
  });

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#3abab6", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>
          {toast}
        </div>
      )}

      {/* Header + tabs */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>Firma Digital</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 16px" }}>
          Creá firmas manuscritas, enviá documentos para firma por email y seguí el estado de cada solicitud
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={tabStyle("canvas")}  onClick={() => setTab("canvas")}>Firma Manuscrita</button>
          <button style={tabStyle("enviar")}  onClick={() => setTab("enviar")}>Enviar para Firmar</button>
          <button style={tabStyle("solicitudes")} onClick={() => setTab("solicitudes")}>
            Solicitudes ({solicitudes.length})
          </button>
        </div>
      </div>

      {/* ── TAB: Canvas ─────────────────────────────────────────────────── */}
      {tab === "canvas" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
            {/* Canvas pad */}
            <div style={{ background: "#1e293b", borderRadius: 14, padding: 20, border: "1px solid #334155" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Área de firma</div>
              <canvas
                ref={canvasRef}
                width={480}
                height={200}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{ width: "100%", height: 200, borderRadius: 10, border: "2px dashed #94a3b8", cursor: "crosshair", touchAction: "none", display: "block", background: "#fff" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={limpiar} style={{ flex: 1, background: "#0f172a", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontSize: 13 }}>
                  Limpiar
                </button>
              </div>
            </div>

            {/* Form */}
            <div style={{ background: "#1e293b", borderRadius: 14, padding: 20, border: "1px solid #334155", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Título / Documento *</label>
                <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ej: Contrato de exclusividad"
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Nombre del firmante</label>
                <input value={form.firmante} onChange={e => setForm(p => ({ ...p, firmante: e.target.value }))}
                  placeholder="Ej: Juan Pérez"
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Negocio (opcional)</label>
                <select value={form.negocio_id} onChange={e => setForm(p => ({ ...p, negocio_id: e.target.value }))} style={inputStyle}>
                  <option value="">— Sin negocio —</option>
                  {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Contacto (opcional)</label>
                <select value={form.contacto_id} onChange={e => setForm(p => ({ ...p, contacto_id: e.target.value }))} style={inputStyle}>
                  <option value="">— Sin contacto —</option>
                  {contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}
                </select>
              </div>
              <button onClick={guardar} disabled={guardando || !hasStroke || !form.titulo.trim()}
                style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, cursor: "pointer", fontSize: 14, opacity: (guardando || !hasStroke || !form.titulo.trim()) ? 0.5 : 1, marginTop: "auto" }}>
                {guardando ? "Guardando..." : "Guardar firma"}
              </button>
            </div>
          </div>

          {/* Firmas guardadas */}
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
            Firmas guardadas ({firmas.length})
          </div>
          {firmas.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "#475569", background: "#1e293b", borderRadius: 14, border: "1px solid #334155" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✍️</div>
              <div style={{ fontWeight: 600 }}>Aún no guardaste ninguna firma</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {firmas.map(f => (
                <div key={f.id} style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                  <img src={f.imagen_base64} alt={f.titulo}
                    onClick={() => setVerFirma(f)}
                    style={{ width: "100%", height: 100, objectFit: "contain", cursor: "pointer", background: "#0f172a", display: "block" }} />
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc", marginBottom: 2 }}>{f.titulo}</div>
                    {f.firmante_nombre && <div style={{ fontSize: 12, color: "#94a3b8" }}>✍️ {f.firmante_nombre}</div>}
                    {f.negocio && <div style={{ fontSize: 11, color: "#64748b" }}>🏷 {f.negocio.titulo}</div>}
                    {f.contacto && <div style={{ fontSize: 11, color: "#64748b" }}>👤 {f.contacto.apellido ? `${f.contacto.apellido}, ${f.contacto.nombre}` : f.contacto.nombre}</div>}
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{fmtFecha(f.created_at)}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button onClick={() => descargar(f)} style={{ flex: 1, background: "#0f172a", color: "#6366f1", border: "1px solid #6366f144", borderRadius: 6, padding: "5px 0", cursor: "pointer", fontSize: 12 }}>⬇ Descargar</button>
                      <button onClick={() => eliminar(f.id)} style={{ background: "#0f172a", color: "#b80000", border: "1px solid #b8000022", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB: Enviar para firmar ──────────────────────────────────────── */}
      {tab === "enviar" && (
        <div style={{ maxWidth: 680 }}>
          {envResult ? (
            /* Éxito */
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📨</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80", marginBottom: 8 }}>
                Solicitudes enviadas
              </div>
              <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}>
                {envResult.enviados} email{envResult.enviados !== 1 ? "s" : ""} enviado{envResult.enviados !== 1 ? "s" : ""} correctamente.
                {envResult.fallidos > 0 && <span style={{ color: "#f87171" }}> {envResult.fallidos} fallido(s).</span>}
              </div>
              <div style={{ background: "#0f172a", borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 12, color: "#64748b" }}>
                ID de solicitud: <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{envResult.solicitud_id}</span>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  onClick={() => { setEnvResult(null); setEnvTitulo(""); setEnvContrato(""); setEnvFirmantes([{ nombre: "", email: "", rol: "inquilino" }]); setEnvContHtml(""); }}
                  style={{ background: "#990000", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  Nueva solicitud
                </button>
                <button onClick={() => setTab("solicitudes")}
                  style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 13 }}>
                  Ver solicitudes
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Título */}
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 18, border: "1px solid #334155" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Documento a firmar
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5 }}>Título del documento *</label>
                  <input value={envTitulo} onChange={e => setEnvTitulo(e.target.value)}
                    placeholder="Ej: Contrato de alquiler — Corrientes 1234"
                    style={inputStyle} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5 }}>Contrato asociado (opcional)</label>
                  <select value={envContrato} onChange={e => setEnvContrato(e.target.value)} style={inputStyle}>
                    <option value="">— Sin contrato —</option>
                    {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5 }}>
                    Texto del documento (opcional — HTML o texto plano)
                  </label>
                  <textarea
                    value={envContHtml}
                    onChange={e => setEnvContHtml(e.target.value)}
                    rows={5}
                    placeholder="Pegá aquí el contenido del contrato o documento. El firmante lo verá antes de firmar."
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                  />
                </div>
              </div>

              {/* Firmantes */}
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 18, border: "1px solid #334155" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Firmantes ({envFirmantes.length})
                  </div>
                  <button onClick={agregarFirmante}
                    style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    + Agregar
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {envFirmantes.map((f, i) => (
                    <div key={i} style={{ background: "#0f172a", borderRadius: 10, padding: 14, border: "1px solid #1e293b" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Firmante {i + 1}</div>
                        {envFirmantes.length > 1 && (
                          <button onClick={() => quitarFirmante(i)}
                            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14 }}>✕</button>
                        )}
                      </div>

                      {/* Autocompletar desde contacto */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, color: "#475569", display: "block", marginBottom: 4 }}>Cargar desde contacto</label>
                        <select
                          defaultValue=""
                          onChange={e => { if (e.target.value) llenarDesdeContacto(e.target.value, i); e.target.value = ""; }}
                          style={{ ...inputStyle, fontSize: 12 }}>
                          <option value="">— Elegir contacto —</option>
                          {contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}
                        </select>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, color: "#475569", display: "block", marginBottom: 4 }}>Nombre *</label>
                          <input value={f.nombre} onChange={e => updateFirmante(i, "nombre", e.target.value)}
                            placeholder="Nombre completo" style={{ ...inputStyle, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: "#475569", display: "block", marginBottom: 4 }}>Rol</label>
                          <select value={f.rol} onChange={e => updateFirmante(i, "rol", e.target.value)} style={{ ...inputStyle, fontSize: 12 }}>
                            {ROL_OPTS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#475569", display: "block", marginBottom: 4 }}>Email *</label>
                        <input type="email" value={f.email} onChange={e => updateFirmante(i, "email", e.target.value)}
                          placeholder="email@ejemplo.com" style={{ ...inputStyle, fontSize: 12 }} />
                      </div>

                      {/* Botón: agregar corredor (yo mismo) */}
                      {i === envFirmantes.length - 1 && userEmail && !envFirmantes.some(x => x.email === userEmail) && (
                        <button
                          onClick={() => {
                            updateFirmante(i, "email", userEmail);
                            updateFirmante(i, "rol", "corredor");
                          }}
                          style={{ marginTop: 8, background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>
                          Usar mi email como corredor
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón enviar */}
              <button onClick={enviarSolicitud} disabled={enviando || !envTitulo.trim()}
                style={{
                  background: envTitulo.trim() ? "linear-gradient(135deg,#b80000,#660000)" : "#1e293b",
                  color: envTitulo.trim() ? "#fff" : "#475569",
                  border: "none", borderRadius: 10, padding: "14px 0",
                  fontWeight: 700, cursor: envTitulo.trim() ? "pointer" : "not-allowed",
                  fontSize: 15, opacity: enviando ? 0.7 : 1, width: "100%",
                }}>
                {enviando ? "Enviando..." : `Enviar emails de firma (${envFirmantes.length} firmante${envFirmantes.length !== 1 ? "s" : ""})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Solicitudes ────────────────────────────────────────────── */}
      {tab === "solicitudes" && (
        <div>
          {solicitudes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#475569", background: "#1e293b", borderRadius: 14, border: "1px solid #334155" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
              <div style={{ fontWeight: 600 }}>Sin solicitudes de firma</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Usá la pestaña "Enviar para Firmar" para crear tu primera solicitud</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {solicitudes.map(sol => {
                const total = sol.firmantes.length;
                const firmados = sol.firmantes.filter(f => f.firmado).length;
                return (
                  <div key={sol.id} style={{ background: "#1e293b", borderRadius: 12, border: `1px solid ${estadoSolicitudColor(sol.estado)}33`, padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>{sol.titulo}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{fmtFecha(sol.created_at)}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ background: `${estadoSolicitudColor(sol.estado)}22`, border: `1px solid ${estadoSolicitudColor(sol.estado)}44`, borderRadius: 20, padding: "2px 10px", fontSize: 11, color: estadoSolicitudColor(sol.estado), fontWeight: 700 }}>
                          {sol.estado === "completado" ? "Completado" : sol.estado === "parcial" ? "Parcial" : sol.estado === "cancelado" ? "Cancelado" : "Pendiente"}
                        </span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{firmados}/{total} firmaron</span>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div style={{ background: "#0f172a", borderRadius: 4, height: 4, overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ width: `${total > 0 ? (firmados / total) * 100 : 0}%`, height: "100%", background: estadoSolicitudColor(sol.estado), transition: "width 0.4s" }} />
                    </div>

                    {/* Firmantes */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {sol.firmantes.map((f, i) => (
                        <div key={i} style={{
                          background: "#0f172a", borderRadius: 8,
                          border: `1px solid ${f.firmado ? "#16a34a33" : "#1e293b"}`,
                          padding: "7px 12px", fontSize: 12, minWidth: 140,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{f.firmado ? "✅" : "⏳"}</span>
                            <span style={{ color: "#f8fafc", fontWeight: 600 }}>{f.nombre}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{f.rol} · {f.email}</div>
                          {f.firmado && f.firmado_at && (
                            <div style={{ fontSize: 10, color: "#4ade80", marginTop: 2 }}>
                              Firmó: {new Date(f.firmado_at).toLocaleDateString("es-AR")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal ver firma */}
      {verFirma && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={() => setVerFirma(null)}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, maxWidth: 600, width: "100%", border: "1px solid #334155" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#f8fafc", marginBottom: 14 }}>{verFirma.titulo}</div>
            <img src={verFirma.imagen_base64} alt="firma" style={{ width: "100%", borderRadius: 8, border: "1px solid #334155" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => descargar(verFirma)} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 600 }}>⬇ Descargar</button>
              <button onClick={() => setVerFirma(null)} style={{ background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "9px 20px", cursor: "pointer" }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  boxSizing: "border-box",
  fontFamily: "Inter, sans-serif",
  outline: "none",
};
