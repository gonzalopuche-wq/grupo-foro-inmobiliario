"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

interface GenerarContratoModalProps {
  contratoInicial?: {
    inquilino_nombre?: string;
    inquilino_telefono?: string;
    propietario_nombre?: string;
    propietario_telefono?: string;
    direccion?: string;
    barrio?: string;
    tipo_propiedad?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    alquiler_inicial?: number;
    moneda?: "ARS" | "USD";
    indice_ajuste?: string;
    periodo_ajuste_meses?: number;
    deposito_meses?: number;
  };
}

type TipoContrato = "alquiler" | "venta" | "temporal";

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMeses(fecha: string, meses: number): string {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
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

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#990000",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
  marginTop: 4,
  marginBottom: 0,
};

export default function GenerarContratoModal({ contratoInicial }: GenerarContratoModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [htmlContrato, setHtmlContrato] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [emailEnviado, setEmailEnviado] = useState(false);

  const [form, setForm] = useState({
    tipo: "alquiler" as TipoContrato,
    propietario_nombre: contratoInicial?.propietario_nombre ?? "",
    propietario_dni: "",
    propietario_domicilio: "",
    inquilino_nombre: contratoInicial?.inquilino_nombre ?? "",
    inquilino_dni: "",
    inquilino_domicilio: "",
    inquilino_email: "",
    direccion: contratoInicial?.direccion ?? "",
    barrio: contratoInicial?.barrio ?? "",
    tipo_propiedad: contratoInicial?.tipo_propiedad ?? "Departamento",
    fecha_inicio: contratoInicial?.fecha_inicio ?? hoy(),
    fecha_fin: contratoInicial?.fecha_fin ?? addMeses(hoy(), 24),
    alquiler_inicial: contratoInicial?.alquiler_inicial ?? 0,
    moneda: (contratoInicial?.moneda ?? "ARS") as "ARS" | "USD",
    indice_ajuste: contratoInicial?.indice_ajuste ?? "ICL",
    periodo_ajuste_meses: contratoInicial?.periodo_ajuste_meses ?? 3,
    deposito_meses: contratoInicial?.deposito_meses ?? 1,
    clausulas_especiales: "",
  });

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function mostrarToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function generarContrato(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/crm/contratos/generar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          alquiler_inicial: Number(form.alquiler_inicial),
          periodo_ajuste_meses: Number(form.periodo_ajuste_meses),
          deposito_meses: Number(form.deposito_meses),
          guardar: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        mostrarToast("Error al generar el contrato");
        return;
      }

      setHtmlContrato(json.html);
      mostrarToast("Contrato generado correctamente");
    } catch {
      mostrarToast("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  function descargarPDF() {
    if (!htmlContrato) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(htmlContrato);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 300);
  }

  async function enviarEmail() {
    if (!htmlContrato || !form.inquilino_email) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/crm/contratos/enviar-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: form.inquilino_email,
          nombre: form.inquilino_nombre,
          html: htmlContrato,
          direccion: form.direccion,
        }),
      });

      if (res.ok) {
        setEmailEnviado(true);
        mostrarToast("Email enviado correctamente");
      } else {
        mostrarToast("Error al enviar el email");
      }
    } catch {
      mostrarToast("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  function cerrar() {
    setOpen(false);
    setHtmlContrato(null);
    setEmailEnviado(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(99,102,241,0.15)",
          border: "1px solid rgba(99,102,241,0.4)",
          color: "#a5b4fc",
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>📄</span> Generar contrato
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
              maxWidth: 680,
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "#fff", margin: 0 }}>
                  📄 Generador de contratos
                </h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                  Completá los datos para generar un contrato legal completo
                </p>
              </div>
              <button
                onClick={cerrar}
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
              >✕</button>
            </div>

            {/* Si ya hay contrato generado */}
            {htmlContrato ? (
              <div>
                <div style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  borderRadius: 10,
                  padding: "16px 20px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Contrato generado exitosamente</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      Podés descargarlo como PDF o enviarlo por email
                    </div>
                  </div>
                </div>

                {/* Preview iframe */}
                <div style={{ marginBottom: 20, border: "1px solid var(--gfi-border)", borderRadius: 10, overflow: "hidden" }}>
                  <iframe
                    srcDoc={htmlContrato}
                    style={{ width: "100%", height: 360, border: "none", background: "#fff" }}
                    title="Vista previa del contrato"
                  />
                </div>

                {/* Enviar por email */}
                {!emailEnviado && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Email del inquilino (para enviar contrato)</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        style={inputStyle}
                        type="email"
                        value={form.inquilino_email}
                        onChange={e => setField("inquilino_email", e.target.value)}
                        placeholder="inquilino@email.com"
                      />
                      <button
                        onClick={enviarEmail}
                        disabled={loading || !form.inquilino_email}
                        style={{
                          background: "rgba(99,102,241,0.15)",
                          border: "1px solid rgba(99,102,241,0.4)",
                          color: "#a5b4fc",
                          borderRadius: 8,
                          padding: "8px 16px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: form.inquilino_email && !loading ? "pointer" : "not-allowed",
                          fontFamily: "Inter, sans-serif",
                          whiteSpace: "nowrap",
                          opacity: !form.inquilino_email ? 0.5 : 1,
                        }}
                      >
                        {loading ? "Enviando..." : "✉️ Enviar"}
                      </button>
                    </div>
                  </div>
                )}
                {emailEnviado && (
                  <div style={{ fontSize: 12, color: "#3abab6", marginBottom: 16, padding: "8px 12px", background: "rgba(58,186,182,0.08)", borderRadius: 8, border: "1px solid rgba(58,186,182,0.2)" }}>
                    ✓ Email enviado a {form.inquilino_email}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={() => { setHtmlContrato(null); setEmailEnviado(false); }}
                    style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    ← Editar datos
                  </button>
                  <button
                    onClick={descargarPDF}
                    style={{ background: "#990000", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    ⬇ Descargar PDF
                  </button>
                  <button
                    onClick={cerrar}
                    style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#3abab6", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                  >
                    Listo ✓
                  </button>
                </div>
              </div>
            ) : (
              /* Formulario */
              <form onSubmit={generarContrato} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Tipo de contrato */}
                <div>
                  <div style={sectionTitleStyle}>Tipo de contrato</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {(["alquiler", "venta", "temporal"] as TipoContrato[]).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setField("tipo", t)}
                        style={{
                          flex: 1,
                          background: form.tipo === t ? "rgba(153,0,0,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${form.tipo === t ? "rgba(153,0,0,0.5)" : "var(--gfi-border)"}`,
                          color: form.tipo === t ? "#ff4444" : "rgba(255,255,255,0.5)",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                          textTransform: "capitalize",
                        }}
                      >
                        {t === "alquiler" ? "Alquiler / Locación" : t === "venta" ? "Compraventa" : "Locación temporal"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Propietario / Vendedor */}
                <div style={sectionTitleStyle}>
                  {form.tipo === "venta" ? "Vendedor" : "Propietario / Locador"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nombre y apellido *</label>
                    <input style={inputStyle} value={form.propietario_nombre} onChange={e => setField("propietario_nombre", e.target.value)} required placeholder="García, María" />
                  </div>
                  <div>
                    <label style={labelStyle}>D.N.I.</label>
                    <input style={inputStyle} value={form.propietario_dni} onChange={e => setField("propietario_dni", e.target.value)} placeholder="12.345.678" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Domicilio real</label>
                  <input style={inputStyle} value={form.propietario_domicilio} onChange={e => setField("propietario_domicilio", e.target.value)} placeholder="Av. Corrientes 1234, CABA" />
                </div>

                {/* Inquilino / Comprador */}
                <div style={sectionTitleStyle}>
                  {form.tipo === "venta" ? "Comprador" : "Inquilino / Locatario"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Nombre y apellido *</label>
                    <input style={inputStyle} value={form.inquilino_nombre} onChange={e => setField("inquilino_nombre", e.target.value)} required placeholder="Martínez, Juan" />
                  </div>
                  <div>
                    <label style={labelStyle}>D.N.I.</label>
                    <input style={inputStyle} value={form.inquilino_dni} onChange={e => setField("inquilino_dni", e.target.value)} placeholder="23.456.789" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Domicilio real</label>
                  <input style={inputStyle} value={form.inquilino_domicilio} onChange={e => setField("inquilino_domicilio", e.target.value)} placeholder="Av. Santa Fe 2100, CABA" />
                </div>

                {/* Propiedad */}
                <div style={sectionTitleStyle}>Propiedad</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Dirección *</label>
                    <input style={inputStyle} value={form.direccion} onChange={e => setField("direccion", e.target.value)} required placeholder="Gurruchaga 780 PB A" />
                  </div>
                  <div>
                    <label style={labelStyle}>Barrio</label>
                    <input style={inputStyle} value={form.barrio} onChange={e => setField("barrio", e.target.value)} placeholder="Palermo" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <input style={inputStyle} value={form.tipo_propiedad} onChange={e => setField("tipo_propiedad", e.target.value)} placeholder="Departamento" />
                  </div>
                </div>

                {/* Fechas y monto */}
                <div style={sectionTitleStyle}>
                  {form.tipo === "venta" ? "Precio y cierre" : "Período y canon"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>{form.tipo === "venta" ? "Fecha de firma" : "Fecha inicio"} *</label>
                    <input style={inputStyle} type="date" value={form.fecha_inicio} onChange={e => setField("fecha_inicio", e.target.value)} required />
                  </div>
                  {form.tipo !== "venta" && (
                    <div>
                      <label style={labelStyle}>Fecha fin *</label>
                      <input style={inputStyle} type="date" value={form.fecha_fin} onChange={e => setField("fecha_fin", e.target.value)} required />
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Moneda</label>
                    <select style={inputStyle} value={form.moneda} onChange={e => setField("moneda", e.target.value as "ARS" | "USD")}>
                      <option value="ARS">ARS — Pesos</option>
                      <option value="USD">USD — Dólares</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{form.tipo === "venta" ? "Precio total" : "Alquiler mensual"} *</label>
                    <input style={inputStyle} type="number" value={form.alquiler_inicial || ""} onChange={e => setField("alquiler_inicial", Number(e.target.value) || 0)} placeholder="0" required min={1} />
                  </div>
                  {form.tipo !== "venta" && (
                    <div>
                      <label style={labelStyle}>Depósito (meses)</label>
                      <select style={inputStyle} value={form.deposito_meses} onChange={e => setField("deposito_meses", Number(e.target.value))}>
                        {[1, 2, 3].map(n => <option key={n} value={n}>{n} mes{n > 1 ? "es" : ""}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Ajuste (solo alquiler) */}
                {form.tipo !== "venta" && (
                  <>
                    <div style={sectionTitleStyle}>Índice de ajuste</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Índice</label>
                        <select style={inputStyle} value={form.indice_ajuste} onChange={e => setField("indice_ajuste", e.target.value)}>
                          <option value="ICL">ICL — Índice Contratos Locación</option>
                          <option value="IPC">IPC — Índice Precios Consumidor</option>
                          <option value="CER">CER</option>
                          <option value="CAC">CAC</option>
                          <option value="fijo">Fijo (sin ajuste)</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Período de ajuste</label>
                        <select style={inputStyle} value={form.periodo_ajuste_meses} onChange={e => setField("periodo_ajuste_meses", Number(e.target.value))}>
                          <option value={3}>Trimestral (3 meses)</option>
                          <option value={6}>Semestral (6 meses)</option>
                          <option value={12}>Anual (12 meses)</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* Cláusulas especiales */}
                <div>
                  <label style={labelStyle}>Cláusulas especiales (opcional)</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                    value={form.clausulas_especiales}
                    onChange={e => setField("clausulas_especiales", e.target.value)}
                    placeholder="Ej: Se prohíbe la tenencia de mascotas. El inquilino se hace cargo de las expensas extraordinarias..."
                  />
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
                    {loading ? "Generando..." : "📄 Generar contrato"}
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
