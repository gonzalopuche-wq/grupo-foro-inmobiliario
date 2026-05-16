"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TIPOS_PROPIEDAD = [
  "Departamento", "Casa", "PH", "Oficina", "Local Comercial",
  "Terreno", "Cochera", "Galpón", "Campo", "Otro"
];

const ZONAS_ROSARIO = [
  "Centro", "Pichincha", "Abasto", "Echesortu", "República de la Sexta",
  "Fisherton", "Alberdi", "Tablada", "Parque", "Arroyito", "Rambla",
  "Las Delicias", "Bombal", "Libertad", "Constitución", "Belgrano",
  "Saladillo", "Villa del Parque", "Refinería", "Otro"
];

interface PropiedadForm {
  tipo: string;
  operacion: "venta" | "alquiler";
  barrio: string;
  zona: string;
  ciudad: string;
  precio: string;
  moneda: "USD" | "ARS";
  sup_cubierta: string;
  propietario_nombre: string;
}

interface PerfilData {
  nombre: string;
  apellido: string;
  matricula: string;
  inmobiliaria: string;
  bio: string;
  anos_experiencia: string;
}

const initialPropiedad: PropiedadForm = {
  tipo: "Departamento",
  operacion: "venta",
  barrio: "",
  zona: "",
  ciudad: "Rosario",
  precio: "",
  moneda: "USD",
  sup_cubierta: "",
  propietario_nombre: "",
};

export default function PropuestaCaptacionPage() {
  const [perfil, setPerfil] = useState<PerfilData>({
    nombre: "", apellido: "", matricula: "", inmobiliaria: "", bio: "", anos_experiencia: "",
  });
  const [form, setForm] = useState<PropiedadForm>(initialPropiedad);
  const [propuesta, setPropuesta] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const propuestaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function cargarPerfil() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data } = await sb.from("perfiles").select("nombre,apellido,matricula,inmobiliaria,bio,anos_experiencia").eq("id", session.user.id).single();
      if (data) {
        setPerfil({
          nombre: data.nombre ?? "",
          apellido: data.apellido ?? "",
          matricula: data.matricula ?? "",
          inmobiliaria: data.inmobiliaria ?? "",
          bio: data.bio ?? "",
          anos_experiencia: data.anos_experiencia?.toString() ?? "",
        });
      }
    }
    cargarPerfil();
  }, []);

  async function generar() {
    setError("");
    setGenerando(true);
    setPropuesta("");
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("No autorizado");

      const res = await fetch("/api/ia-propuesta-captacion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          propiedadData: {
            ...form,
            precio: form.precio ? Number(form.precio) : undefined,
            sup_cubierta: form.sup_cubierta ? Number(form.sup_cubierta) : undefined,
          },
          perfilData: perfil,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al generar");
      setPropuesta(json.propuesta ?? "");
    } catch (e: any) {
      setError(e.message ?? "Error desconocido");
    } finally {
      setGenerando(false);
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(propuesta);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function imprimir() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Propuesta de Captación</title>
      <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #111; }
        pre { white-space: pre-wrap; font-family: Georgia, serif; font-size: 15px; }
        @media print { body { margin: 20px; } }
      </style></head><body>
      <pre>${propuesta.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
      <script>window.onload=function(){window.print();window.close();}<\/script>
      </body></html>
    `);
    win.document.close();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)", color: "#fff",
    fontFamily: "Inter,sans-serif", fontSize: 13,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "Inter,sans-serif", fontSize: 11,
    fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
    marginBottom: 5, display: "block",
  };

  const sectionStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12, padding: "20px 24px", marginBottom: 20,
  };

  const sectionTitle: React.CSSProperties = {
    fontFamily: "Montserrat,sans-serif", fontSize: 13,
    fontWeight: 700, color: "#cc0000",
    letterSpacing: "0.1em", textTransform: "uppercase",
    marginBottom: 16,
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800,
          color: "#fff", margin: 0, letterSpacing: "-0.01em",
        }}>
          Propuesta de Captación IA
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", fontSize: 13, marginTop: 6 }}>
          Generá una propuesta profesional personalizada para presentar a propietarios
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* LEFT: Formulario */}
        <div>
          {/* Datos del corredor */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Datos del Corredor</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Nombre</label>
                <input style={inputStyle} value={perfil.nombre} onChange={e => setPerfil(p => ({ ...p, nombre: e.target.value }))} placeholder="Juan" />
              </div>
              <div>
                <label style={labelStyle}>Apellido</label>
                <input style={inputStyle} value={perfil.apellido} onChange={e => setPerfil(p => ({ ...p, apellido: e.target.value }))} placeholder="Pérez" />
              </div>
              <div>
                <label style={labelStyle}>Matrícula</label>
                <input style={inputStyle} value={perfil.matricula} onChange={e => setPerfil(p => ({ ...p, matricula: e.target.value }))} placeholder="12345" />
              </div>
              <div>
                <label style={labelStyle}>Inmobiliaria</label>
                <input style={inputStyle} value={perfil.inmobiliaria} onChange={e => setPerfil(p => ({ ...p, inmobiliaria: e.target.value }))} placeholder="GFI® Inmobiliaria" />
              </div>
              <div>
                <label style={labelStyle}>Años de Experiencia</label>
                <input style={inputStyle} type="number" min="0" value={perfil.anos_experiencia} onChange={e => setPerfil(p => ({ ...p, anos_experiencia: e.target.value }))} placeholder="10" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Bio profesional (opcional)</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
                value={perfil.bio}
                onChange={e => setPerfil(p => ({ ...p, bio: e.target.value }))}
                placeholder="Corredor especializado en el mercado de Rosario..."
              />
            </div>
          </div>

          {/* Datos de la propiedad */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Datos de la Propiedad</div>

            {/* Tipo operación */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tipo de Operación</label>
              <div style={{ display: "flex", gap: 10 }}>
                {(["venta", "alquiler"] as const).map(op => (
                  <button key={op} onClick={() => setForm(f => ({ ...f, operacion: op }))} style={{
                    flex: 1, padding: "9px 0", borderRadius: 8,
                    border: `1px solid ${form.operacion === op ? "#cc0000" : "rgba(255,255,255,0.1)"}`,
                    background: form.operacion === op ? "rgba(200,0,0,0.12)" : "transparent",
                    color: form.operacion === op ? "#fff" : "rgba(255,255,255,0.4)",
                    fontFamily: "Inter,sans-serif", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", textTransform: "capitalize",
                  }}>
                    {op === "venta" ? "Venta" : "Alquiler"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Tipo de Propiedad</label>
                <select style={inputStyle} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_PROPIEDAD.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Barrio / Zona</label>
                <select style={inputStyle} value={form.barrio} onChange={e => setForm(f => ({ ...f, barrio: e.target.value, zona: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {ZONAS_ROSARIO.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Ciudad</label>
                <input style={inputStyle} value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} placeholder="Rosario" />
              </div>
              <div>
                <label style={labelStyle}>Superficie Cubierta (m²)</label>
                <input style={inputStyle} type="number" min="0" value={form.sup_cubierta} onChange={e => setForm(f => ({ ...f, sup_cubierta: e.target.value }))} placeholder="80" />
              </div>
              <div>
                <label style={labelStyle}>Precio Orientativo</label>
                <input style={inputStyle} type="number" min="0" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} placeholder="120000" />
              </div>
              <div>
                <label style={labelStyle}>Moneda</label>
                <select style={inputStyle} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value as "USD" | "ARS" }))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Nombre del Propietario/a</label>
                <input style={inputStyle} value={form.propietario_nombre} onChange={e => setForm(f => ({ ...f, propietario_nombre: e.target.value }))} placeholder="María González" />
              </div>
            </div>
          </div>

          {/* Generar */}
          <button
            onClick={generar}
            disabled={generando}
            style={{
              width: "100%", padding: "14px 0",
              background: generando ? "rgba(200,0,0,0.3)" : "#cc0000",
              color: "#fff", border: "none", borderRadius: 10,
              fontFamily: "Montserrat,sans-serif", fontSize: 14, fontWeight: 700,
              letterSpacing: "0.05em", cursor: generando ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {generando ? "Generando propuesta..." : "Generar Propuesta con IA"}
          </button>

          {error && (
            <div style={{
              marginTop: 12, padding: "12px 16px", borderRadius: 8,
              background: "rgba(200,0,0,0.12)", border: "1px solid rgba(200,0,0,0.3)",
              color: "#ff6b6b", fontFamily: "Inter,sans-serif", fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* RIGHT: Propuesta generada */}
        <div>
          <div style={{
            ...sectionStyle,
            minHeight: 600,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={sectionTitle}>Propuesta Generada</div>
              {propuesta && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={copiar} style={{
                    padding: "6px 14px", borderRadius: 7,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: copiado ? "rgba(0,200,100,0.12)" : "rgba(255,255,255,0.05)",
                    color: copiado ? "#4ade80" : "rgba(255,255,255,0.7)",
                    fontFamily: "Inter,sans-serif", fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                  }}>
                    {copiado ? "Copiado!" : "Copiar"}
                  </button>
                  <button onClick={imprimir} style={{
                    padding: "6px 14px", borderRadius: 7,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "Inter,sans-serif", fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                  }}>
                    Imprimir / PDF
                  </button>
                </div>
              )}
            </div>

            {generando ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  border: "3px solid rgba(204,0,0,0.3)",
                  borderTopColor: "#cc0000",
                  animation: "spin 0.8s linear infinite",
                }} />
                <p style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif", fontSize: 13, margin: 0 }}>
                  Analizando mercado y redactando propuesta...
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : propuesta ? (
              <div ref={propuestaRef} style={{
                flex: 1,
                whiteSpace: "pre-wrap",
                fontFamily: "Georgia,serif", fontSize: 14,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.75,
                overflowY: "auto",
                padding: "4px 0",
              }}>
                {propuesta}
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 40 }}>📋</div>
                <p style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Inter,sans-serif", fontSize: 13, textAlign: "center", margin: 0 }}>
                  Completá los datos del corredor y la propiedad,<br />luego presioná el botón para generar la propuesta.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
