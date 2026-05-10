"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

interface Negocio { id: string; titulo: string; }
interface Contacto { id: string; nombre: string; apellido: string; }
interface Firma {
  id: string;
  titulo: string;
  firmante_nombre: string | null;
  imagen_base64: string;
  created_at: string;
  negocio?: { titulo: string } | null;
  contacto?: { nombre: string; apellido: string } | null;
}

const fmtFecha = (s: string) =>
  new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function FirmaDigitalPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [firmas, setFirmas] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({ titulo: "", firmante: "", negocio_id: "", contacto_id: "" });
  const [verFirma, setVerFirma] = useState<Firma | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const cargar = async (uid: string) => {
    const [{ data: neg }, { data: con }, { data: fir }] = await Promise.all([
      supabase.from("crm_negocios").select("id,titulo").eq("perfil_id", uid).eq("archivado", false).order("updated_at", { ascending: false }).limit(50),
      supabase.from("crm_contactos").select("id,nombre,apellido").eq("perfil_id", uid).neq("estado", "archivado").order("apellido").limit(100),
      supabase.from("crm_firmas").select("id,titulo,firmante_nombre,imagen_base64,created_at, negocio:negocio_id(titulo), contacto:contacto_id(nombre,apellido)").eq("perfil_id", uid).order("created_at", { ascending: false }).limit(20),
    ]);
    setNegocios((neg ?? []) as Negocio[]);
    setContactos((con ?? []) as Contacto[]);
    setFirmas((fir ?? []) as Firma[]);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await cargar(data.user.id);
      setLoading(false);
    })();
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

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
    ctx.fillStyle = "#0f172a";
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
    if (!userId) return;
    await supabase.from("crm_firmas").delete().eq("id", id);
    setFirmas(prev => prev.filter(f => f.id !== id));
  };

  const descargar = (firma: Firma) => {
    const a = document.createElement("a");
    a.href = firma.imagen_base64;
    a.download = `firma-${firma.titulo.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  if (loading) return <div style={{ padding: 40, color: "#aaa", textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 860, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>{toast}</div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>✍️ Firma Digital</h1>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>Creá y guardá firmas digitales para tus contratos y documentos</p>
      </div>

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
            style={{ width: "100%", height: 200, borderRadius: 10, border: "2px dashed #334155", cursor: "crosshair", touchAction: "none", display: "block" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={limpiar} style={{ flex: 1, background: "#0f172a", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontSize: 13 }}>
              🗑 Limpiar
            </button>
          </div>
        </div>

        {/* Form */}
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 20, border: "1px solid #334155", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Título / Documento *</label>
            <input
              value={form.titulo}
              onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              placeholder="Ej: Contrato de exclusividad"
              style={{ width: "100%", background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Nombre del firmante</label>
            <input
              value={form.firmante}
              onChange={e => setForm(p => ({ ...p, firmante: e.target.value }))}
              placeholder="Ej: Juan Pérez"
              style={{ width: "100%", background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Negocio (opcional)</label>
            <select
              value={form.negocio_id}
              onChange={e => setForm(p => ({ ...p, negocio_id: e.target.value }))}
              style={{ width: "100%", background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
            >
              <option value="">— Sin negocio —</option>
              {negocios.map(n => <option key={n.id} value={n.id}>{n.titulo}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Contacto (opcional)</label>
            <select
              value={form.contacto_id}
              onChange={e => setForm(p => ({ ...p, contacto_id: e.target.value }))}
              style={{ width: "100%", background: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box" }}
            >
              <option value="">— Sin contacto —</option>
              {contactos.map(c => <option key={c.id} value={c.id}>{c.apellido ? `${c.apellido}, ${c.nombre}` : c.nombre}</option>)}
            </select>
          </div>
          <button
            onClick={guardar}
            disabled={guardando || !hasStroke || !form.titulo.trim()}
            style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, cursor: "pointer", fontSize: 14, opacity: (guardando || !hasStroke || !form.titulo.trim()) ? 0.5 : 1, marginTop: "auto" }}
          >
            {guardando ? "Guardando..." : "✍️ Guardar firma"}
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
          {firmas.map(f => {
            const con = f.contacto as any;
            const neg = f.negocio as any;
            return (
              <div key={f.id} style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                <img
                  src={f.imagen_base64}
                  alt={f.titulo}
                  onClick={() => setVerFirma(f)}
                  style={{ width: "100%", height: 100, objectFit: "contain", cursor: "pointer", background: "#0f172a", display: "block" }}
                />
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc", marginBottom: 2 }}>{f.titulo}</div>
                  {f.firmante_nombre && <div style={{ fontSize: 12, color: "#94a3b8" }}>✍️ {f.firmante_nombre}</div>}
                  {neg && <div style={{ fontSize: 11, color: "#64748b" }}>🏷 {neg.titulo}</div>}
                  {con && <div style={{ fontSize: 11, color: "#64748b" }}>👤 {con.apellido ? `${con.apellido}, ${con.nombre}` : con.nombre}</div>}
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{fmtFecha(f.created_at)}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={() => descargar(f)} style={{ flex: 1, background: "#0f172a", color: "#6366f1", border: "1px solid #6366f144", borderRadius: 6, padding: "5px 0", cursor: "pointer", fontSize: 12 }}>⬇ Descargar</button>
                    <button onClick={() => eliminar(f.id)} style={{ background: "#0f172a", color: "#ef4444", border: "1px solid #ef444422", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
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
