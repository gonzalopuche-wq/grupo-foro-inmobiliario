"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Firmante {
  nombre: string;
  email: string;
  rol: string;
  token: string;
  firmado: boolean;
  firmado_at: string | null;
  nombre_firmado: string | null;
}

interface Solicitud {
  id: string;
  titulo: string;
  html_doc: string | null;
  firmantes: Firmante[];
  estado: string;
  created_at: string;
}

export default function FirmarPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [sol, setSol]       = useState<Solicitud | null>(null);
  const [firmante, setFirmante] = useState<Firmante | null>(null);
  const [loading, setLoading]   = useState(true);
  const [nombre, setNombre]     = useState("");
  const [acepto, setAcepto]     = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await sb
        .from("firma_solicitudes")
        .select("id, titulo, html_doc, firmantes, estado, created_at")
        .contains("firmantes", JSON.stringify([{ token }]))
        .maybeSingle();

      if (err || !data) {
        setError("No se encontró el documento o el link ya no es válido.");
        setLoading(false);
        return;
      }

      const sol = data as Solicitud;
      const f = sol.firmantes.find((x) => x.token === token) ?? null;

      setSol(sol);
      setFirmante(f);
      if (f?.nombre) setNombre(f.nombre);
      if (f?.firmado) setDone(true);
      setLoading(false);
    })();
  }, [token]);

  const confirmarFirma = async () => {
    if (!nombre.trim() || !acepto || !sol || !firmante) return;
    setFirmando(true);

    const ahora = new Date().toISOString();
    const nuevosFirmantes = sol.firmantes.map((f) =>
      f.token === token
        ? { ...f, firmado: true, firmado_at: ahora, nombre_firmado: nombre.trim() }
        : f
    );

    const todosFlrmaron = nuevosFirmantes.every((f) => f.firmado);
    const nuevoEstado = todosFlrmaron ? "completado" : "parcial";

    const { error: updErr } = await sb
      .from("firma_solicitudes")
      .update({
        firmantes: nuevosFirmantes,
        estado: nuevoEstado,
        updated_at: ahora,
      })
      .eq("id", sol.id);

    if (updErr) {
      setError("Error al registrar la firma. Por favor intentá nuevamente.");
      setFirmando(false);
      return;
    }

    setDone(true);
    setFirmando(false);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>Cargando documento...</div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !sol || !firmante) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>
              Link inválido o expirado
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              {error ?? "No se encontró el documento de firma."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Ya firmado ────────────────────────────────────────────────────────────
  if (done || firmante.firmado) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#4ade80", marginBottom: 8 }}>
              Documento firmado
            </div>
            <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>
              <strong style={{ color: "#f8fafc" }}>
                {firmante.nombre_firmado ?? nombre}
              </strong>{" "}
              firmó el documento el{" "}
              {new Date(firmante.firmado_at ?? Date.now()).toLocaleDateString("es-AR", {
                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Documento</div>
              <div style={{ fontWeight: 700, color: "#f8fafc" }}>{sol.titulo}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario de firma ───────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ fontFamily: "var(--font-display, sans-serif)", fontWeight: 800, fontSize: 16, color: "#f8fafc" }}>
          GFI <span style={{ color: "#990000" }}>Firma Digital</span>
        </div>
      </div>

      <div style={styles.card}>
        {/* Título */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Solicitud de firma
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", margin: 0 }}>{sol.titulo}</h1>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 20, padding: "3px 12px", fontSize: 12, color: "#94a3b8" }}>
              {firmante.rol}
            </span>
            <span style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 20, padding: "3px 12px", fontSize: 12, color: "#94a3b8" }}>
              {firmante.email}
            </span>
          </div>
        </div>

        {/* Documento HTML */}
        {sol.html_doc && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              Contenido del documento
            </div>
            <div
              style={{
                background: "#fff",
                color: "#0f172a",
                borderRadius: 10,
                padding: "24px",
                maxHeight: 480,
                overflowY: "auto",
                border: "1px solid #334155",
                fontSize: 13,
                lineHeight: 1.7,
              }}
              dangerouslySetInnerHTML={{ __html: sol.html_doc }}
            />
          </div>
        )}

        {/* Otros firmantes */}
        {sol.firmantes.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              Estado de firmas
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sol.firmantes.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#1e293b",
                    border: `1px solid ${f.firmado ? "#16a34a44" : "#334155"}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{f.firmado ? "✅" : "⏳"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600 }}>{f.nombre}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{f.rol} · {f.email}</div>
                  </div>
                  {f.firmado && f.firmado_at && (
                    <div style={{ fontSize: 11, color: "#4ade80" }}>
                      {new Date(f.firmado_at).toLocaleDateString("es-AR")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario de confirmación */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 16 }}>
            Confirmá tu firma
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Nombre completo *
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Escribí tu nombre y apellido completo"
              style={{
                width: "100%",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#f8fafc",
                fontSize: 14,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              marginBottom: 20,
              padding: 14,
              background: acepto ? "rgba(153,0,0,0.08)" : "#0f172a",
              border: `1px solid ${acepto ? "rgba(153,0,0,0.4)" : "#1e293b"}`,
              borderRadius: 8,
              transition: "all 0.15s",
            }}
          >
            <input
              type="checkbox"
              checked={acepto}
              onChange={(e) => setAcepto(e.target.checked)}
              style={{ marginTop: 2, accentColor: "#990000", width: 16, height: 16, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
              Declaro haber leído y comprendido el documento{" "}
              <strong style={{ color: "#f8fafc" }}>&ldquo;{sol.titulo}&rdquo;</strong> y acepto y firmo
              digitalmente el mismo con plena validez legal. Esta firma tiene la misma validez que una
              firma manuscrita bajo la legislación argentina vigente.
            </span>
          </label>

          <button
            onClick={confirmarFirma}
            disabled={!nombre.trim() || !acepto || firmando}
            style={{
              width: "100%",
              background: nombre.trim() && acepto ? "linear-gradient(135deg,#b80000,#660000)" : "#1e293b",
              color: nombre.trim() && acepto ? "#fff" : "#475569",
              border: "none",
              borderRadius: 10,
              padding: "14px 0",
              fontSize: 15,
              fontWeight: 700,
              cursor: nombre.trim() && acepto ? "pointer" : "not-allowed",
              transition: "all 0.2s",
            }}
          >
            {firmando ? "Registrando firma..." : "Firmar documento"}
          </button>
        </div>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: "#334155" }}>
          Powered by GFI — Grupo Foro Inmobiliario
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#060910",
    padding: "0 16px 40px",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,
  header: {
    padding: "16px 0",
    marginBottom: 16,
    borderBottom: "1px solid #1e293b",
    display: "flex",
    alignItems: "center",
  } as React.CSSProperties,
  card: {
    maxWidth: 720,
    margin: "0 auto",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: "28px 24px",
  } as React.CSSProperties,
};
