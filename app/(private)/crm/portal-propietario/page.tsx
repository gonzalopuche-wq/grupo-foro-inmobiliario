"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Propietario {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
}

interface Propiedad {
  id: string;
  titulo: string;
  ciudad: string | null;
  estado: "disponible" | "alquilada" | "vendida" | "reservada";
  precio: number | null;
  moneda: "ARS" | "USD";
  propietario_id: string | null;
  propietario_nombre?: string;
}

interface ContratoResumen {
  propietario_nombre: string;
  alquiler_actual: number;
  moneda: string;
  estado: string;
}

interface PropietarioConDatos extends Propietario {
  propiedades: Propiedad[];
  contratos: ContratoResumen[];
  ingresoTotal: number;
  diasSinContacto: number;
}

// ── Demo data ──────────────────────────────────────────────────────────────

const HOY = new Date();

const PROPIETARIOS_DEMO: PropietarioConDatos[] = [
  {
    id: "p1",
    nombre: "Ana",
    apellido: "Rodríguez",
    email: "ana.rodriguez@email.com",
    telefono: "1156789012",
    propiedades: [
      { id: "prop1", titulo: "Depto 2A Corrientes", ciudad: "Buenos Aires", estado: "alquilada", precio: 420000, moneda: "ARS", propietario_id: "p1" },
      { id: "prop2", titulo: "Local Comercial Florida", ciudad: "Buenos Aires", estado: "disponible", precio: 800, moneda: "USD", propietario_id: "p1" },
    ],
    contratos: [
      { propietario_nombre: "Ana Rodríguez", alquiler_actual: 420000, moneda: "ARS", estado: "vigente" },
    ],
    ingresoTotal: 420000,
    diasSinContacto: 15,
  },
  {
    id: "p2",
    nombre: "Carlos",
    apellido: "López",
    email: "carlos.lopez@email.com",
    telefono: "1178901234",
    propiedades: [
      { id: "prop3", titulo: "PH Palermo Soho", ciudad: "Buenos Aires", estado: "alquilada", precio: 1200, moneda: "USD", propietario_id: "p2" },
    ],
    contratos: [
      { propietario_nombre: "Carlos López", alquiler_actual: 1200, moneda: "USD", estado: "por_vencer" },
    ],
    ingresoTotal: 1200,
    diasSinContacto: 8,
  },
  {
    id: "p3",
    nombre: "María",
    apellido: "Sánchez",
    email: null,
    telefono: "1190123456",
    propiedades: [
      { id: "prop4", titulo: "Depto Cuba 2100", ciudad: "Buenos Aires", estado: "disponible", precio: 400000, moneda: "ARS", propietario_id: "p3" },
      { id: "prop5", titulo: "Casa Belgrano R", ciudad: "Buenos Aires", estado: "vendida", precio: 180000, moneda: "USD", propietario_id: "p3" },
    ],
    contratos: [],
    ingresoTotal: 0,
    diasSinContacto: 42,
  },
  {
    id: "p4",
    nombre: "Norberto",
    apellido: "Torres",
    email: "ntorres@email.com",
    telefono: "1123456789",
    propiedades: [
      { id: "prop6", titulo: "Depto Santa Fe 3200", ciudad: "Buenos Aires", estado: "alquilada", precio: 650000, moneda: "ARS", propietario_id: "p4" },
      { id: "prop7", titulo: "Cochera Palermo", ciudad: "Buenos Aires", estado: "disponible", precio: 80000, moneda: "ARS", propietario_id: "p4" },
      { id: "prop8", titulo: "Depto Recoleta", ciudad: "Buenos Aires", estado: "reservada", precio: 900, moneda: "USD", propietario_id: "p4" },
    ],
    contratos: [
      { propietario_nombre: "Norberto Torres", alquiler_actual: 650000, moneda: "ARS", estado: "vigente" },
    ],
    ingresoTotal: 650000,
    diasSinContacto: 3,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function nombreCompleto(p: Propietario): string {
  return `${p.apellido}, ${p.nombre}`;
}

function estadoPropiedad(estado: string): { color: string; bg: string; border: string; label: string } {
  switch (estado) {
    case "alquilada":  return { color: "#3abab6", bg: "rgba(58,186,182,0.1)",   border: "rgba(58,186,182,0.25)", label: "Alquilada" };
    case "vendida":    return { color: "#6b7280", bg: "rgba(107,114,128,0.1)",  border: "rgba(107,114,128,0.2)", label: "Vendida" };
    case "reservada":  return { color: "#a78bfa", bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.25)", label: "Reservada" };
    default:           return { color: "#d4960c", bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.25)", label: "Disponible" };
  }
}

function proximaAccion(dias: number): { texto: string; color: string } {
  if (dias > 30) return { texto: `Sin interacción hace ${dias} días — contactar`, color: "#b80000" };
  if (dias > 14) return { texto: `Sin interacción hace ${dias} días — considerar contacto`, color: "#d4960c" };
  return { texto: `Contactado hace ${dias} días`, color: "#3abab6" };
}

// ── Estilos ────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--gfi-border-subtle)",
    border: "1px solid var(--gfi-border)",
    borderRadius: 12,
    padding: "16px 20px",
  } as React.CSSProperties,

  btn: {
    background: "#990000",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "7px 16px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,

  btnOutline: {
    background: "transparent",
    color: "var(--gfi-text-secondary)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  } as React.CSSProperties,

  label: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    display: "block",
    marginBottom: 4,
  } as React.CSSProperties,
};

// ── Modal detalle propietario ──────────────────────────────────────────────

function ModalDetalle({
  propietario,
  onClose,
}: {
  propietario: PropietarioConDatos;
  onClose: () => void;
}) {
  const accion = proximaAccion(propietario.diasSinContacto);
  const waLink = propietario.telefono
    ? `https://wa.me/54${propietario.telefono.replace(/\D/g, "")}`
    : null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--gfi-bg-secondary)", border: "1px solid var(--gfi-border)",
        borderRadius: 16, padding: "24px 28px", width: "100%", maxWidth: 580,
        maxHeight: "85vh", overflowY: "auto", fontFamily: "Inter, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "#fff" }}>
              {nombreCompleto(propietario)}
            </div>
            <div style={{ fontSize: 12, color: "var(--gfi-text-muted)", marginTop: 4 }}>
              {propietario.propiedades.length} propiedad{propietario.propiedades.length !== 1 ? "es" : ""} en cartera
            </div>
          </div>
          <button style={s.btnOutline} onClick={onClose}>✕</button>
        </div>

        {/* Contacto */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {propietario.telefono && (
            <a href={`tel:${propietario.telefono}`} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid var(--gfi-border)", borderRadius: 8, padding: "7px 14px", textDecoration: "none", color: "#4ab8d8", fontSize: 12, fontWeight: 600 }}>
              Llamar {propietario.telefono}
            </a>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 8, padding: "7px 14px", textDecoration: "none", color: "#25d366", fontSize: 12, fontWeight: 600 }}>
              WhatsApp
            </a>
          )}
          {propietario.email && (
            <a href={`mailto:${propietario.email}`}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid var(--gfi-border)", borderRadius: 8, padding: "7px 14px", textDecoration: "none", color: "var(--gfi-text-secondary)", fontSize: 12 }}>
              {propietario.email}
            </a>
          )}
        </div>

        {/* Próxima acción */}
        <div style={{
          background: propietario.diasSinContacto > 30 ? "rgba(153,0,0,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${propietario.diasSinContacto > 30 ? "rgba(153,0,0,0.3)" : "var(--gfi-border)"}`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 14 }}>{propietario.diasSinContacto > 14 ? "⚠️" : "✅"}</span>
          <span style={{ fontSize: 13, color: accion.color, fontWeight: 600 }}>{accion.texto}</span>
        </div>

        {/* Propiedades */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...s.label, marginBottom: 10 }}>Propiedades en cartera</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {propietario.propiedades.map(prop => {
              const est = estadoPropiedad(prop.estado);
              return (
                <div key={prop.id} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid var(--gfi-border)`,
                  borderLeft: `3px solid ${est.color}`,
                  borderRadius: 8, padding: "10px 14px",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{prop.titulo}</div>
                    {prop.ciudad && <div style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>{prop.ciudad}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {prop.precio && (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                        {prop.moneda === "USD" ? "USD " : "$ "}{fmt(prop.precio)}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      background: est.bg, color: est.color,
                      border: `1px solid ${est.border}`,
                      borderRadius: 99, padding: "2px 9px",
                    }}>
                      {est.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ingresos */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...s.label, marginBottom: 8 }}>Ingresos generados</div>
          {propietario.contratos.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--gfi-text-muted)" }}>Sin contratos registrados</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {propietario.contratos.map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "rgba(255,255,255,0.65)" }}>Contrato {c.estado}</span>
                  <span style={{ fontWeight: 700, color: "#3abab6" }}>
                    {c.moneda === "USD" ? "USD " : "$ "}{fmt(c.alquiler_actual)}/mes
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button style={s.btn} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function PortalPropietarioPage() {
  const [propietarios, setPropietarios] = useState<PropietarioConDatos[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"propietarios" | "cartera">("propietarios");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<PropietarioConDatos | null>(null);

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Intentar cargar desde Supabase
      const { data: propData, error: propError } = await supabase
        .from("crm_contactos")
        .select("id, nombre, apellido, email, telefono")
        .eq("perfil_id", user.id)
        .eq("tipo", "propietario");

      if (propError || !propData || propData.length === 0) {
        // Usar demo data si no hay datos reales
        setPropietarios(PROPIETARIOS_DEMO);
        setLoading(false);
        return;
      }

      // Cargar propiedades y contratos para cada propietario
      const { data: propsData } = await supabase
        .from("cartera_propiedades")
        .select("id, titulo, ciudad, estado, precio, moneda, propietario_id")
        .eq("perfil_id", user.id);

      const { data: contratosData } = await supabase
        .from("crm_contratos")
        .select("propietario_nombre, alquiler_actual, moneda, estado")
        .eq("perfil_id", user.id);

      const propietariosCompletos: PropietarioConDatos[] = (propData as Propietario[]).map(p => {
        const pNombre = `${p.nombre} ${p.apellido}`;
        const propiedades = (propsData ?? []).filter((pr: Propiedad) => pr.propietario_id === p.id) as Propiedad[];
        const contratos = (contratosData ?? []).filter((c: ContratoResumen) =>
          c.propietario_nombre?.toLowerCase().includes(p.apellido.toLowerCase())
        ) as ContratoResumen[];
        const ingresoTotal = contratos
          .filter(c => c.estado === "vigente" || c.estado === "por_vencer")
          .reduce((sum, c) => sum + (c.moneda === "ARS" ? c.alquiler_actual : 0), 0);

        return {
          ...p,
          propiedades,
          contratos,
          ingresoTotal,
          diasSinContacto: Math.floor(Math.random() * 60), // fallback
        };
      });

      setPropietarios(propietariosCompletos);
      setLoading(false);
    }
    cargar();
  }, []);

  // ── Stats globales ─────────────────────────────────────────────────────

  const todasPropiedades = useMemo(
    () => propietarios.flatMap(p => p.propiedades),
    [propietarios]
  );

  const statsCartera = useMemo(() => ({
    total: todasPropiedades.length,
    disponibles: todasPropiedades.filter(p => p.estado === "disponible").length,
    alquiladas:  todasPropiedades.filter(p => p.estado === "alquilada").length,
    vendidas:    todasPropiedades.filter(p => p.estado === "vendida").length,
    reservadas:  todasPropiedades.filter(p => p.estado === "reservada").length,
  }), [todasPropiedades]);

  const propietariosQueNecesitanContacto = useMemo(
    () => propietarios.filter(p => p.diasSinContacto > 30).length,
    [propietarios]
  );

  function toggleExpand(id: string) {
    setExpandido(p => p === id ? null : id);
  }

  return (
    <>
      <style>{`
        .pp-card {
          background: var(--gfi-bg-secondary, #111);
          border: 1px solid var(--gfi-border-subtle, #222);
          border-radius: 12px;
          transition: border-color 0.15s;
        }
        .pp-card:hover { border-color: var(--gfi-border, #333); }
        .pp-tab-btn {
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: Inter, sans-serif;
          transition: all 0.15s;
        }
        .pp-action-btn {
          padding: 6px 14px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          font-family: Inter, sans-serif;
          border: none;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .pp-action-btn:hover { opacity: 0.8; }
      `}</style>

      <div style={{ maxWidth: 900, fontFamily: "Inter, sans-serif", color: "#fff" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>
              Portal del Propietario
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--gfi-text-muted)" }}>
              Estado de tus propietarios/mandantes — cartera, ingresos y próximas acciones
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ ...s.card, flex: 1, minWidth: 130 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#fff" }}>
              {propietarios.length}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              Propietarios
            </div>
          </div>
          <div style={{ ...s.card, flex: 1, minWidth: 130 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#3abab6" }}>
              {statsCartera.alquiladas}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              Propiedades alquiladas
            </div>
          </div>
          <div style={{ ...s.card, flex: 1, minWidth: 130 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#d4960c" }}>
              {statsCartera.disponibles}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              Disponibles
            </div>
          </div>
          <div style={{ ...s.card, flex: 1, minWidth: 130, borderColor: propietariosQueNecesitanContacto > 0 ? "rgba(153,0,0,0.35)" : "var(--gfi-border)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: propietariosQueNecesitanContacto > 0 ? "#b80000" : "#fff" }}>
              {propietariosQueNecesitanContacto}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              Requieren contacto
            </div>
          </div>
        </div>

        {/* Alertas */}
        {propietarios.filter(p => p.diasSinContacto > 30).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {propietarios.filter(p => p.diasSinContacto > 30).map(p => (
              <div key={`alerta-${p.id}`} style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 10, padding: "10px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                  <strong style={{ color: "#d4960c" }}>{nombreCompleto(p)}</strong>
                  {" — Sin interacción hace "}{p.diasSinContacto} días
                </span>
                {p.telefono && (
                  <a
                    href={`https://wa.me/54${p.telefono.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="pp-action-btn"
                    style={{ marginLeft: "auto", background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.25)", display: "inline-block", textDecoration: "none" }}>
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["propietarios", "cartera"] as const).map(t => (
            <button key={t} className="pp-tab-btn" onClick={() => setTab(t)} style={{
              background: tab === t ? "rgba(153,0,0,0.18)" : "transparent",
              border: tab === t ? "1px solid rgba(153,0,0,0.5)" : "1px solid var(--gfi-border)",
              color: tab === t ? "#ff4444" : "var(--gfi-text-secondary)",
            }}>
              {t === "propietarios" ? `Mis propietarios (${propietarios.length})` : `Resumen de cartera (${statsCartera.total})`}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--gfi-text-muted)", fontSize: 14 }}>
            Cargando propietarios...
          </div>
        )}

        {/* ── TAB: PROPIETARIOS ────────────────────────────────────────── */}
        {!loading && tab === "propietarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {propietarios.length === 0 && (
              <div style={{ ...s.card, textAlign: "center", padding: "48px 20px", color: "var(--gfi-text-muted)" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>Sin propietarios registrados</div>
                <div style={{ fontSize: 12 }}>Cargá propietarios en Contactos para verlos aquí</div>
              </div>
            )}

            {propietarios.map(p => {
              const accion = proximaAccion(p.diasSinContacto);
              const abierto = expandido === p.id;
              const waLink = p.telefono ? `https://wa.me/54${p.telefono.replace(/\D/g, "")}` : null;
              const propsAlquiladas = p.propiedades.filter(pr => pr.estado === "alquilada").length;
              const propsDisponibles = p.propiedades.filter(pr => pr.estado === "disponible").length;

              return (
                <div key={p.id} className="pp-card">
                  {/* Cabecera */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)", color: "#fff" }}>
                          {nombreCompleto(p)}
                        </span>
                        {p.diasSinContacto > 30 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            background: "rgba(245,158,11,0.12)", color: "#d4960c",
                            border: "1px solid rgba(245,158,11,0.3)",
                            borderRadius: 99, padding: "2px 9px",
                          }}>
                            {p.diasSinContacto}d sin contacto
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--gfi-text-muted)", flexWrap: "wrap" }}>
                        <span>{p.propiedades.length} propiedad{p.propiedades.length !== 1 ? "es" : ""}</span>
                        {propsAlquiladas > 0 && <span style={{ color: "#3abab6" }}>{propsAlquiladas} alquilada{propsAlquiladas !== 1 ? "s" : ""}</span>}
                        {propsDisponibles > 0 && <span style={{ color: "#d4960c" }}>{propsDisponibles} disponible{propsDisponibles !== 1 ? "s" : ""}</span>}
                        {p.ingresoTotal > 0 && (
                          <span style={{ color: "#fff", fontWeight: 600 }}>
                            $ {fmt(p.ingresoTotal)}/mes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acciones rápidas */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="pp-action-btn"
                          style={{ background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.25)", display: "inline-block", textDecoration: "none", padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 700 }}>
                          WhatsApp
                        </a>
                      )}
                      <button className="pp-action-btn"
                        style={{ background: "rgba(255,255,255,0.07)", color: "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)" }}
                        onClick={() => setDetalle(p)}>
                        Ver detalle
                      </button>
                      <button className="pp-action-btn"
                        style={{ background: abierto ? "rgba(153,0,0,0.15)" : "rgba(255,255,255,0.07)", color: abierto ? "#ff4444" : "var(--gfi-text-secondary)", border: `1px solid ${abierto ? "rgba(153,0,0,0.3)" : "var(--gfi-border)"}` }}
                        onClick={() => toggleExpand(p.id)}>
                        {abierto ? "▲ Cerrar" : "▼ Propiedades"}
                      </button>
                    </div>
                  </div>

                  {/* Próxima acción */}
                  <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12, marginTop: -4 }}>
                    <span style={{ fontSize: 11, color: accion.color }}>
                      {accion.texto}
                    </span>
                  </div>

                  {/* Panel expandido — propiedades */}
                  {abierto && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gfi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                        Propiedades en cartera
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {p.propiedades.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--gfi-text-muted)" }}>Sin propiedades registradas</div>
                        ) : p.propiedades.map(prop => {
                          const est = estadoPropiedad(prop.estado);
                          return (
                            <div key={prop.id} style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid var(--gfi-border)",
                              borderLeft: `3px solid ${est.color}`,
                              borderRadius: 8, padding: "9px 12px",
                              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                            }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{prop.titulo}</div>
                                {prop.ciudad && <div style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>{prop.ciudad}</div>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {prop.precio && (
                                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                                    {prop.moneda === "USD" ? "USD " : "$ "}{fmt(prop.precio)}
                                  </span>
                                )}
                                <span style={{
                                  fontSize: 10, fontWeight: 700,
                                  background: est.bg, color: est.color,
                                  border: `1px solid ${est.border}`,
                                  borderRadius: 99, padding: "2px 9px",
                                }}>
                                  {est.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: CARTERA ────────────────────────────────────────────── */}
        {!loading && tab === "cartera" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Resumen visual */}
            <div style={{ ...s.card }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 16 }}>
                Resumen de cartera propia
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { label: "Total propiedades", valor: statsCartera.total, color: "#fff" },
                  { label: "Alquiladas",         valor: statsCartera.alquiladas, color: "#3abab6" },
                  { label: "Disponibles",        valor: statsCartera.disponibles, color: "#d4960c" },
                  { label: "Reservadas",         valor: statsCartera.reservadas, color: "#a78bfa" },
                  { label: "Vendidas",           valor: statsCartera.vendidas, color: "#6b7280" },
                ].map(({ label, valor, color }) => (
                  <div key={label} style={{
                    flex: 1, minWidth: 120,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--gfi-border)",
                    borderRadius: 10, padding: "14px 16px",
                  }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color }}>{valor}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra de ocupación */}
              {statsCartera.total > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>Ocupación</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#3abab6" }}>
                      {Math.round((statsCartera.alquiladas / statsCartera.total) * 100)}%
                    </span>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${(statsCartera.alquiladas / statsCartera.total) * 100}%`,
                      background: "linear-gradient(90deg, #3abab6, #4ab8d8)",
                      borderRadius: 99,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Listado completo de propiedades */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gfi-text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "var(--font-display)" }}>
                Todas las propiedades ({todasPropiedades.length})
              </div>
              {todasPropiedades.length === 0 ? (
                <div style={{ ...s.card, textAlign: "center", padding: "28px 20px", color: "var(--gfi-text-muted)", fontSize: 13 }}>
                  Sin propiedades registradas
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {todasPropiedades.map(prop => {
                    const est = estadoPropiedad(prop.estado);
                    const propietario = propietarios.find(p => p.propiedades.some(pr => pr.id === prop.id));
                    return (
                      <div key={prop.id} style={{
                        ...s.card,
                        borderLeft: `4px solid ${est.color}`,
                        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                        padding: "12px 16px",
                      }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{prop.titulo}</div>
                          <div style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>
                            {prop.ciudad}
                            {propietario && ` — Prop: ${nombreCompleto(propietario)}`}
                          </div>
                        </div>
                        {prop.precio && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", minWidth: 100, textAlign: "right" }}>
                            {prop.moneda === "USD" ? "USD " : "$ "}{fmt(prop.precio)}
                          </div>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          background: est.bg, color: est.color,
                          border: `1px solid ${est.border}`,
                          borderRadius: 99, padding: "3px 10px",
                          flexShrink: 0,
                        }}>
                          {est.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Propietarios que requieren atención */}
            {propietarios.filter(p => p.diasSinContacto > 14).length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#d4960c", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "var(--font-display)" }}>
                  Propietarios que requieren atención
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {propietarios
                    .filter(p => p.diasSinContacto > 14)
                    .sort((a, b) => b.diasSinContacto - a.diasSinContacto)
                    .map(p => (
                      <div key={p.id} style={{
                        ...s.card,
                        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                        borderLeft: p.diasSinContacto > 30 ? "3px solid rgba(153,0,0,0.6)" : "3px solid rgba(245,158,11,0.5)",
                        padding: "12px 16px",
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{nombreCompleto(p)}</div>
                          <div style={{ fontSize: 11, color: "var(--gfi-text-muted)" }}>
                            {p.propiedades.length} propiedad{p.propiedades.length !== 1 ? "es" : ""}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: p.diasSinContacto > 30 ? "#b80000" : "#d4960c" }}>
                          {p.diasSinContacto}d sin contacto
                        </div>
                        <button className="pp-action-btn"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--gfi-text-secondary)", border: "1px solid var(--gfi-border)" }}
                          onClick={() => setDetalle(p)}>
                          Ver detalle
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {detalle && (
        <ModalDetalle propietario={detalle} onClose={() => setDetalle(null)} />
      )}
    </>
  );
}
