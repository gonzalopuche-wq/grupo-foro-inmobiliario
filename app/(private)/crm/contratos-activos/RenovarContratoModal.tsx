"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Contrato {
  id: string;
  inquilino_nombre: string;
  propietario_nombre: string;
  direccion: string;
  fecha_inicio: string;
  fecha_fin: string;
  alquiler_actual: number;
  moneda: "ARS" | "USD";
  indice_ajuste: string;
  periodo_ajuste_meses: number;
}

interface RenovarContratoModalProps {
  contrato: Contrato;
  onRenovado?: (nuevoId: string) => void;
}

function addMeses(fecha: string, meses: number): string {
  const d = new Date(fecha + "T12:00:00");
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${MESES[parseInt(m) - 1]} ${y}`;
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--gfi-border)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
  padding: "8px 12px",
  fontFamily: "Inter, sans-serif",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  display: "block",
  marginBottom: 4,
};

type AjustePreset = "icl" | "ipc" | "manual";

export default function RenovarContratoModal({ contrato, onRenovado }: RenovarContratoModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [renovado, setRenovado] = useState(false);

  // Default: extend 24 months from current fecha_fin, 20% increase
  const montoSugerido = Math.round(contrato.alquiler_actual * 1.2);

  const [form, setForm] = useState({
    nueva_fecha_fin: addMeses(contrato.fecha_fin, 24),
    nuevo_monto: montoSugerido,
    ajuste_preset: "icl" as AjustePreset,
    indice_ajuste: contrato.indice_ajuste,
    email_inquilino: "",
    email_propietario: "",
  });

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function aplicarPreset(preset: AjustePreset) {
    setField("ajuste_preset", preset);
    if (preset === "icl") {
      setField("nuevo_monto", Math.round(contrato.alquiler_actual * 1.2));
      setField("indice_ajuste", "ICL");
    } else if (preset === "ipc") {
      setField("nuevo_monto", Math.round(contrato.alquiler_actual * 1.25));
      setField("indice_ajuste", "IPC");
    }
    // "manual" keeps current values
  }

  function mostrarToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleRenovar(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`¿Confirmar renovación del contrato de ${contrato.inquilino_nombre}?`)) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/crm/contratos/renovar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          contrato_id: contrato.id,
          nueva_fecha_fin: form.nueva_fecha_fin,
          nuevo_monto: Number(form.nuevo_monto),
          indice_ajuste: form.indice_ajuste,
          email_inquilino: form.email_inquilino || undefined,
          email_propietario: form.email_propietario || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        mostrarToast("Error al renovar el contrato");
        return;
      }

      setRenovado(true);
      mostrarToast("Contrato renovado exitosamente");
      onRenovado?.(json.nuevoContratoId);
    } catch {
      mostrarToast("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  function cerrar() {
    setOpen(false);
    setRenovado(false);
  }

  const monedaSimbolo = contrato.moneda === "USD" ? "USD " : "$ ";
  const incrementoPct = Math.round(((form.nuevo_monto - contrato.alquiler_actual) / contrato.alquiler_actual) * 100);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(245,158,11,0.12)",
          border: "1px solid rgba(245,158,11,0.35)",
          color: "#d4960c",
          borderRadius: 8,
          padding: "7px 14px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        🔄 Renovar
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div
            style={{
              background: "var(--gfi-bg-secondary, #111)",
              border: "1px solid var(--gfi-border)",
              borderRadius: 16,
              padding: "28px 28px 24px",
              width: "100%",
              maxWidth: 540,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#fff", margin: 0 }}>
                  🔄 Renovar contrato
                </h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                  {contrato.inquilino_nombre} — {contrato.direccion}
                </p>
              </div>
              <button
                onClick={cerrar}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
              >✕</button>
            </div>

            {renovado ? (
              <div>
                <div style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  borderRadius: 10,
                  padding: "20px 24px",
                  textAlign: "center",
                  marginBottom: 20,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Contrato renovado exitosamente</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                    Se creó un nuevo contrato y el anterior fue marcado como "renovado"
                    {(form.email_inquilino || form.email_propietario) && <><br/>Se enviaron emails de confirmación</>}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={cerrar}
                    style={{ background: "#990000", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRenovar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Info del contrato actual */}
                <div style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--gfi-border)",
                  borderRadius: 10,
                  padding: "14px 16px",
                }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Contrato actual</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      ["Vence", fmtFecha(contrato.fecha_fin)],
                      ["Alquiler actual", `${monedaSimbolo}${contrato.alquiler_actual.toLocaleString("es-AR")}`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
                        <div style={{ fontSize: 14, color: "#fff", fontWeight: 600, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ajuste rápido */}
                <div>
                  <div style={{ fontSize: 11, color: "#990000", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>
                    Ajuste automático
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { key: "icl" as AjustePreset, label: "ICL +20%", desc: "Estimado ICL" },
                      { key: "ipc" as AjustePreset, label: "IPC +25%", desc: "Estimado IPC" },
                      { key: "manual" as AjustePreset, label: "Manual", desc: "Ingresá vos" },
                    ].map(({ key, label, desc }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => aplicarPreset(key)}
                        style={{
                          flex: 1,
                          background: form.ajuste_preset === key ? "rgba(153,0,0,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${form.ajuste_preset === key ? "rgba(153,0,0,0.5)" : "var(--gfi-border)"}`,
                          color: form.ajuste_preset === key ? "#ff4444" : "rgba(255,255,255,0.5)",
                          borderRadius: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                          textAlign: "center" as const,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
                        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nueva fecha fin */}
                <div>
                  <label style={labelStyle}>Nueva fecha de vencimiento *</label>
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.nueva_fecha_fin}
                    onChange={e => setField("nueva_fecha_fin", e.target.value)}
                    min={contrato.fecha_fin}
                    required
                  />
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                    Período: {fmtFecha(contrato.fecha_fin)} → {fmtFecha(form.nueva_fecha_fin)}
                  </div>
                </div>

                {/* Nuevo monto */}
                <div>
                  <label style={labelStyle}>Nuevo alquiler mensual ({contrato.moneda}) *</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={form.nuevo_monto || ""}
                    onChange={e => { setField("nuevo_monto", Number(e.target.value) || 0); setField("ajuste_preset", "manual"); }}
                    required
                    min={1}
                  />
                  {form.nuevo_monto > 0 && contrato.alquiler_actual > 0 && (
                    <div style={{
                      fontSize: 11,
                      color: incrementoPct >= 0 ? "#3abab6" : "#b80000",
                      marginTop: 4,
                    }}>
                      {incrementoPct >= 0 ? "+" : ""}{incrementoPct}% respecto al alquiler actual
                      {" "}({monedaSimbolo}{contrato.alquiler_actual.toLocaleString("es-AR")} → {monedaSimbolo}{form.nuevo_monto.toLocaleString("es-AR")})
                    </div>
                  )}
                </div>

                {/* Índice ajuste */}
                <div>
                  <label style={labelStyle}>Índice de ajuste para nuevo contrato</label>
                  <select style={inputStyle} value={form.indice_ajuste} onChange={e => setField("indice_ajuste", e.target.value)}>
                    <option value="ICL">ICL — Índice Contratos de Locación</option>
                    <option value="IPC">IPC — Índice Precios Consumidor</option>
                    <option value="CER">CER</option>
                    <option value="CAC">CAC</option>
                    <option value="fijo">Fijo (sin ajuste)</option>
                  </select>
                </div>

                {/* Emails opcionales */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                  <div style={{ fontSize: 11, color: "#990000", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>
                    Notificaciones por email (opcional)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Email inquilino</label>
                      <input
                        style={inputStyle}
                        type="email"
                        value={form.email_inquilino}
                        onChange={e => setField("email_inquilino", e.target.value)}
                        placeholder="inquilino@email.com"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Email propietario</label>
                      <input
                        style={inputStyle}
                        type="email"
                        value={form.email_propietario}
                        onChange={e => setField("email_propietario", e.target.value)}
                        placeholder="propietario@email.com"
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
                    Si completás los emails, se enviarán notificaciones automáticas de confirmación
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={cerrar}
                    style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ background: "#990000", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? "Renovando..." : "🔄 Confirmar renovación"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          padding: "12px 20px",
          borderRadius: 8,
          background: "rgba(34,197,94,0.15)",
          border: "1px solid rgba(34,197,94,0.35)",
          color: "#3abab6",
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          zIndex: 9999,
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
