"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  matricula: string | null;
  foto_url: string | null;
  inmobiliaria: string | null;
  cocir_estado: string | null;
  estado: string;
  tipo: string;
  especialidades: string[] | null;
  zona_trabajo: string | null;
  created_at: string;
}

const JURAS_2026 = [
  { fecha: "2026-05-29", label: "29 de mayo 2026" },
  { fecha: "2026-07-31", label: "31 de julio 2026" },
  { fecha: "2026-09-25", label: "25 de septiembre 2026" },
  { fecha: "2026-11-27", label: "27 de noviembre 2026" },
];

function proximaJura(): { label: string; diasRestantes: number } | null {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (const j of JURAS_2026) {
    const d = new Date(j.fecha + "T00:00:00");
    const diff = Math.round((d.getTime() - hoy.getTime()) / 86400000);
    if (diff >= 0) return { label: j.label, diasRestantes: diff };
  }
  return null;
}

function estadoBadge(cocirEstado: string | null, estado: string) {
  const s = (cocirEstado ?? estado ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (s.includes("activ") || s.includes("habili") || s.includes("vigente"))
    return { texto: "ACTIVO", color: "#3abab6", bg: "rgba(58,186,182,0.12)", border: "rgba(58,186,182,0.4)" };
  if (s.includes("suspen") || s.includes("inhab"))
    return { texto: "SUSPENDIDO", color: "#d05050", bg: "rgba(200,0,0,0.12)", border: "rgba(200,0,0,0.4)" };
  if (s.includes("baja") || s.includes("cancela"))
    return { texto: "BAJA", color: "#888", bg: "rgba(136,136,136,0.12)", border: "rgba(136,136,136,0.4)" };
  return { texto: estado.toUpperCase() || "SIN ESTADO", color: "#d4960c", bg: "rgba(212,150,12,0.12)", border: "rgba(212,150,12,0.4)" };
}

export default function CredencialPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const jura = proximaJura();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      const { data: p } = await supabase
        .from("perfiles")
        .select("id, nombre, apellido, matricula, foto_url, inmobiliaria, cocir_estado, estado, tipo, especialidades, zona_trabajo, created_at")
        .eq("id", data.user.id)
        .single();
      if (p) setPerfil(p as Perfil);
      setLoading(false);
    };
    init();
  }, []);

  const verUrl = perfil?.matricula
    ? `https://foroinmobiliario.com.ar/padron/${perfil.matricula}`
    : typeof window !== "undefined" ? window.location.origin : "https://foroinmobiliario.com.ar";

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verUrl)}&bgcolor=111111&color=3abab6&margin=6`;

  async function copiarLink() {
    await navigator.clipboard.writeText(verUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#555", fontSize: 14, fontFamily: "Inter, sans-serif" }}>Cargando credencial...</div>
      </div>
    );
  }

  if (!perfil) return null;

  const badge = estadoBadge(perfil.cocir_estado, perfil.estado);
  const nombreCompleto = `${perfil.nombre} ${perfil.apellido}`.trim();
  const anioVigencia = new Date().getFullYear();

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", padding: "24px 16px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(20px, 4vw, 28px)", color: "#e0e0e0", margin: 0, marginBottom: 6 }}>
            Credencial <span style={{ color: "#990000" }}>Digital</span>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
            Tu identificación profesional verificable como corredor inmobiliario
          </p>
        </div>

        {/* Credencial card */}
        <div
          ref={cardRef}
          style={{
            background: "linear-gradient(135deg, #141414 0%, #1a1a1a 100%)",
            border: "1px solid #2a2a2a",
            borderRadius: 20,
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
          }}
        >
          {/* Top accent bar */}
          <div style={{ height: 6, background: "linear-gradient(90deg, #990000 0%, #3abab6 100%)" }} />

          {/* Body */}
          <div style={{ padding: "28px 28px 24px", display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

            {/* Left: foto + estado */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
              {/* Foto */}
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 110, height: 110, borderRadius: "50%",
                  border: `3px solid ${badge.color}`,
                  overflow: "hidden",
                  background: "#222",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {perfil.foto_url ? (
                    <img
                      src={perfil.foto_url}
                      alt={nombreCompleto}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span style={{ fontSize: 42, color: "#555" }}>
                      {perfil.nombre.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Estado dot */}
                <div style={{
                  position: "absolute", bottom: 4, right: 4,
                  width: 20, height: 20, borderRadius: "50%",
                  background: badge.color,
                  border: "2px solid #141414",
                  boxShadow: `0 0 8px ${badge.color}`,
                }} />
              </div>

              {/* Badge estado */}
              <div style={{
                padding: "4px 12px",
                borderRadius: 20,
                background: badge.bg,
                border: `1px solid ${badge.border}`,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: badge.color,
                fontFamily: "var(--font-display)",
              }}>
                {badge.texto}
              </div>
            </div>

            {/* Center: datos */}
            <div style={{ flex: 1, minWidth: 200 }}>
              {/* Institución */}
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontFamily: "var(--font-display)" }}>
                Grupo Foro Inmobiliario · {anioVigencia}
              </div>

              {/* Nombre */}
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800, color: "#f0f0f0", lineHeight: 1.1, marginBottom: 8 }}>
                {nombreCompleto}
              </div>

              {/* Matrícula */}
              {perfil.matricula && (
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: "#666", fontFamily: "Inter, sans-serif" }}>Matrícula COCIR  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "#3abab6", letterSpacing: "0.05em" }}>
                    {perfil.matricula}
                  </span>
                </div>
              )}

              {/* Inmobiliaria */}
              {perfil.inmobiliaria && (
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 6 }}>
                  {perfil.inmobiliaria}
                </div>
              )}

              {/* Especialidades */}
              {perfil.especialidades && perfil.especialidades.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {perfil.especialidades.slice(0, 3).map((esp) => (
                    <span key={esp} style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 20,
                      background: "rgba(153,0,0,0.12)", border: "1px solid rgba(153,0,0,0.3)",
                      color: "#cc5555", fontFamily: "Inter, sans-serif",
                    }}>
                      {esp}
                    </span>
                  ))}
                </div>
              )}

              {/* Zona */}
              {perfil.zona_trabajo && (
                <div style={{ fontSize: 12, color: "#666", marginTop: 10 }}>
                  {perfil.zona_trabajo}
                </div>
              )}
            </div>

            {/* Right: QR */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ padding: 8, background: "#111", borderRadius: 12, border: "1px solid #333" }}>
                <img
                  src={qrUrl}
                  alt="QR de verificación"
                  style={{ width: 100, height: 100, display: "block", borderRadius: 6 }}
                />
              </div>
              <div style={{ fontSize: 9, color: "#555", textAlign: "center", fontFamily: "Inter, sans-serif", maxWidth: 100 }}>
                Escanear para verificar
              </div>
            </div>
          </div>

          {/* Footer strip */}
          <div style={{
            background: "rgba(0,0,0,0.4)",
            borderTop: "1px solid #222",
            padding: "10px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}>
            <div style={{ fontSize: 10, color: "#444", fontFamily: "var(--font-display)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              foroinmobiliario.com.ar · Credencial verificable
            </div>
            <div style={{ fontSize: 10, color: "#444", fontFamily: "Inter, sans-serif" }}>
              ID: {perfil.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={copiarLink}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "1px solid #333",
              background: copiado ? "rgba(58,186,182,0.1)" : "#1a1a1a",
              color: copiado ? "#3abab6" : "#ccc",
              fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {copiado ? "✓ Link copiado" : "Copiar link de verificación"}
          </button>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Hola, soy ${nombreCompleto}, corredor inmobiliario mat. ${perfil.matricula ?? ""}. Podés verificar mi credencial en: ${verUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "10px 18px", borderRadius: 8,
              background: "rgba(37,211,102,0.08)",
              border: "1px solid rgba(37,211,102,0.2)",
              color: "#25d366", fontSize: 13, fontFamily: "Inter, sans-serif",
              textDecoration: "none", display: "inline-block",
            }}
          >
            Compartir por WhatsApp
          </a>

          <button
            onClick={() => window.print()}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "1px solid #333",
              background: "#1a1a1a", color: "#888",
              fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer",
            }}
          >
            Imprimir
          </button>
        </div>

        {/* Juras COCIR 2026 */}
        <div style={{ marginTop: 32, background: "#111", border: "1px solid #222", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, color: "#990000", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
            Próximas juras COCIR 2026
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {JURAS_2026.map((j) => {
              const d = new Date(j.fecha + "T00:00:00");
              const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
              const diff = Math.round((d.getTime() - hoy.getTime()) / 86400000);
              const pasada = diff < 0;
              const esProxima = !pasada && jura?.label === j.label;
              return (
                <div
                  key={j.fecha}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", borderRadius: 8,
                    background: esProxima ? "rgba(153,0,0,0.1)" : "transparent",
                    border: esProxima ? "1px solid rgba(153,0,0,0.3)" : "1px solid transparent",
                    opacity: pasada ? 0.4 : 1,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 16 }}>{pasada ? "✓" : esProxima ? "🔴" : "📅"}</span>
                    <div>
                      <div style={{ fontSize: 14, color: "#e0e0e0", fontFamily: "Inter, sans-serif" }}>{j.label}</div>
                      {pasada && <div style={{ fontSize: 11, color: "#555" }}>Realizada</div>}
                    </div>
                  </div>
                  {!pasada && (
                    <div style={{
                      fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 700,
                      color: esProxima ? "#990000" : "#666",
                    }}>
                      {diff === 0 ? "Hoy" : `en ${diff} día${diff !== 1 ? "s" : ""}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: "#555", fontFamily: "Inter, sans-serif" }}>
            Juras ordinarias del Colegio Único de Corredores Inmobiliarios de la Ciudad de Buenos Aires (CUCICBA / COCIR)
          </div>
        </div>

        {/* Nota de verificación */}
        <div style={{ marginTop: 16, fontSize: 12, color: "#444", fontFamily: "Inter, sans-serif", paddingBottom: 32, lineHeight: 1.6 }}>
          El QR de la credencial apunta al perfil verificable del corredor en el padrón de GFI. Para verificar la habilitación oficial ante el colegio, consultá el Registro Público de Corredores Inmobiliarios.
        </div>
      </div>
    </div>
  );
}
