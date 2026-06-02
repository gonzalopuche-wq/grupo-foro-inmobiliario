"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

type Categoria =
  | "captacion"
  | "seguimiento"
  | "visita"
  | "oferta"
  | "cierre"
  | "postventa"
  | "cumpleanos"
  | "recordatorio"
  | "custom";

type Canal = "whatsapp" | "email" | "sms" | "todos";

interface Plantilla {
  id: string;
  nombre: string;
  categoria: Categoria;
  canal: Canal;
  texto: string;
  favorita: boolean;
  usos: number;
  created_at: string;
  updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIAS: Record<Categoria, { label: string; color: string; bg: string }> = {
  captacion:    { label: "Captación",    color: "#d4960c", bg: "rgba(245,158,11,0.15)" },
  seguimiento:  { label: "Seguimiento",  color: "#4ab8d8", bg: "rgba(74,184,216,0.15)" },
  visita:       { label: "Visita",       color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  oferta:       { label: "Oferta",       color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  cierre:       { label: "Cierre",       color: "#fb923c", bg: "rgba(251,146,60,0.15)" },
  postventa:    { label: "Postventa",    color: "#f472b6", bg: "rgba(244,114,182,0.15)" },
  cumpleanos:   { label: "Cumpleaños",   color: "#d4960c", bg: "rgba(250,204,21,0.15)" },
  recordatorio: { label: "Recordatorio", color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  custom:       { label: "Custom",       color: "#990000", bg: "rgba(153,0,0,0.15)" },
};

const CANALES: Record<Canal, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "#25d366" },
  email:    { label: "Email",    color: "#4ab8d8" },
  sms:      { label: "SMS",      color: "#94a3b8" },
  todos:    { label: "Todos",    color: "#e0e0e0" },
};

const PLANTILLAS_DEFAULT: Plantilla[] = [
  {
    id: "p1",
    nombre: "Propietario interesado en vender",
    categoria: "captacion",
    canal: "whatsapp",
    texto: "Hola {nombre}! Te escribo de {agencia}. Vi que tenés una propiedad en {zona} y me gustaría comentarte sobre las condiciones actuales del mercado y cómo podría ayudarte a venderla al mejor precio. ¿Tenés unos minutos para conversar?",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p2",
    nombre: "Seguimiento post contacto captación",
    categoria: "captacion",
    canal: "whatsapp",
    texto: "Hola {nombre}! El otro día charlamos sobre tu departamento en {zona}. ¿Pudiste pensarlo? Estoy disponible para responder cualquier pregunta que tengas. Un saludo, {corredor} de {agencia}.",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p3",
    nombre: "Propuesta de tasación",
    categoria: "captacion",
    canal: "email",
    texto: "Estimado/a {nombre},\n\nMe comunico desde {agencia} para ofrecerle una tasación profesional de su propiedad ubicada en {zona}.\n\nContamos con amplia experiencia en la zona y acceso a datos de operaciones cerradas recientemente, lo que nos permite brindarle una valoración precisa y actualizada del mercado.\n\nLa tasación es sin cargo ni compromiso y le entregamos un informe detallado con comparables de la zona.\n\n¿Le resultaría conveniente coordinar una visita esta semana?\n\nQuedo a su disposición,\n{corredor}\n{agencia}\n{telefono}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p4",
    nombre: "Primera respuesta a consulta",
    categoria: "seguimiento",
    canal: "whatsapp",
    texto: "Hola {nombre}! 👋 Soy {corredor} de {agencia}. Gracias por tu consulta sobre {propiedad}. Con gusto te cuento todos los detalles. ¿Cuándo te viene bien hablar o coordinar una visita?",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p5",
    nombre: "Envío de propiedades seleccionadas",
    categoria: "seguimiento",
    canal: "whatsapp",
    texto: "Hola {nombre}! Seleccioné algunas propiedades que se ajustan muy bien a lo que estás buscando:\n\n📍 {propiedad}\n💰 Precio: {precio}\n📅 Disponible para visitar desde {fecha}\n\nTambién tengo otras opciones en cartera. ¿Te gustaría que coordinemos para verlas esta semana?",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p6",
    nombre: "Seguimiento sin respuesta",
    categoria: "seguimiento",
    canal: "whatsapp",
    texto: "Hola {nombre}! Hace unos días te había enviado algunas opciones de propiedades. Quería saber si tuviste oportunidad de verlas y si seguís con la búsqueda activa. Si cambiaron tus necesidades, también podemos ajustar el perfil. ¡Cualquier cosa, acá estoy! {corredor} 😊",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p7",
    nombre: "Recordatorio de visita",
    categoria: "recordatorio",
    canal: "whatsapp",
    texto: "Hola {nombre}! 🗓️ Te recuerdo que mañana {fecha} a las {hora} tenemos la visita a {propiedad}. La dirección es: {zona}. Cualquier cambio avisame con anticipación. ¡Nos vemos! {corredor}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p8",
    nombre: "Confirmación de visita",
    categoria: "visita",
    canal: "whatsapp",
    texto: "Hola {nombre}! ✅ Quedó confirmada la visita para el {fecha} a las {hora}.\n\n📍 Dirección: {zona}\n🏠 Propiedad: {propiedad}\n\nTe espero ahí. Si necesitás indicaciones no dudes en escribirme. ¡Hasta el {fecha}! {corredor}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p9",
    nombre: "Post visita — opinión",
    categoria: "visita",
    canal: "whatsapp",
    texto: "Hola {nombre}! ¿Cómo te fue luego de ver {propiedad}? Me gustaría saber tu opinión y qué fue lo que más y menos te gustó. Con eso puedo ajustar mejor las próximas opciones que te muestre. ¡Contame! 😊 {corredor}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p10",
    nombre: "Feedback de visita estructurado",
    categoria: "visita",
    canal: "whatsapp",
    texto: "Hola {nombre}! Post visita a {propiedad} del {fecha}:\n\n¿Qué te pareció la propiedad en general del 1 al 10?\n¿La ubicación en {zona} te conviene?\n¿El precio de {precio} te parece razonable?\n¿Avanzarías con una oferta?\n\nTu feedback me ayuda mucho para seguir buscando. ¡Gracias! {corredor}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p11",
    nombre: "Transmisión de oferta al propietario",
    categoria: "oferta",
    canal: "whatsapp",
    texto: "Hola {nombre}, te comento que tenemos una oferta formal por tu propiedad en {zona}.\n\n💰 Oferta recibida: {precio}\n📅 Fecha: {fecha}\n\nEl interesado está muy motivado y puede avanzar rápido. ¿Cuándo podemos hablar para analizar juntos la propuesta? {corredor} — {agencia}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p12",
    nombre: "Contraoferta al comprador",
    categoria: "oferta",
    canal: "whatsapp",
    texto: "Hola {nombre}! Te transmito la respuesta del propietario de {propiedad}. Recibimos tu oferta de {precio} con mucho interés, sin embargo nos propone avanzar a un valor de {precio}. Dado el estado de la propiedad y la zona, creemos que es una oportunidad muy razonable. ¿Te parece que charlamos para seguir avanzando? {corredor}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p13",
    nombre: "Felicitación por cierre",
    categoria: "cierre",
    canal: "whatsapp",
    texto: "¡Felicitaciones {nombre}! 🎉🏠 Hoy es un día muy especial — ¡es tuya! Fue un placer acompañarte en todo el proceso. Que disfrutes muchísimo tu nueva propiedad en {zona}. ¡No dudes en recomendarme a quien necesite! Fue un honor, {corredor} de {agencia}.",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p14",
    nombre: "Cumpleaños del cliente",
    categoria: "cumpleanos",
    canal: "whatsapp",
    texto: "¡Feliz cumpleaños {nombre}! 🎂🎉 Todo el equipo de {agencia} te desea un día lleno de alegrías y un año nuevo repleto de éxitos. ¡Un abrazo grande! {corredor}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "p15",
    nombre: "Aniversario de la operación",
    categoria: "postventa",
    canal: "whatsapp",
    texto: "Hola {nombre}! ¿Cómo estás? 😊 Hoy se cumple un año desde que cerramos la operación de {propiedad} en {zona}. ¡Qué lindo momento fue ese! Espero que estés disfrutando mucho. Si alguna vez pensás en invertir de nuevo o conocés a alguien que busque o quiera vender, no dudes en contactarme. ¡Saludos! {corredor} — {agencia}",
    favorita: false,
    usos: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractVariables(texto: string): string[] {
  const matches = texto.match(/\{([^}]+)\}/g) ?? [];
  const unique = Array.from(new Set(matches.map((m) => m.slice(1, -1))));
  return unique;
}

function applyVariables(texto: string, vars: Record<string, string>): string {
  let result = texto;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(val || `{${key}}`);
  }
  return result;
}

function genId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Inline style helpers ──────────────────────────────────────────────────────

const S = {
  page: {
    background: "#0a0a0a",
    minHeight: "100vh",
    color: "#e0e0e0",
    fontFamily: "'Inter', sans-serif",
    padding: "24px 16px 80px",
    maxWidth: 1100,
    margin: "0 auto",
  } as React.CSSProperties,

  heading: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 800,
    fontSize: 28,
    color: "#e0e0e0",
    margin: 0,
  } as React.CSSProperties,

  subheading: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    color: "#e0e0e0",
    margin: 0,
  } as React.CSSProperties,

  tabBar: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid #222222",
    marginBottom: 24,
    marginTop: 20,
  } as React.CSSProperties,

  card: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 10,
    padding: "16px 18px",
  } as React.CSSProperties,

  input: {
    background: "#0a0a0a",
    border: "1px solid #333333",
    borderRadius: 7,
    color: "#e0e0e0",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  select: {
    background: "#0a0a0a",
    border: "1px solid #333333",
    borderRadius: 7,
    color: "#e0e0e0",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    cursor: "pointer",
  } as React.CSSProperties,

  textarea: {
    background: "#0a0a0a",
    border: "1px solid #333333",
    borderRadius: 7,
    color: "#e0e0e0",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
    lineHeight: 1.6,
  } as React.CSSProperties,

  btnPrimary: {
    background: "#990000",
    border: "none",
    borderRadius: 7,
    color: "#fff",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: 14,
    padding: "9px 18px",
    cursor: "pointer",
    transition: "background 0.15s",
  } as React.CSSProperties,

  btnSecondary: {
    background: "transparent",
    border: "1px solid #333333",
    borderRadius: 7,
    color: "#e0e0e0",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 14,
    padding: "9px 16px",
    cursor: "pointer",
  } as React.CSSProperties,

  btnDanger: {
    background: "transparent",
    border: "1px solid #990000",
    borderRadius: 7,
    color: "#990000",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 14,
    padding: "9px 16px",
    cursor: "pointer",
  } as React.CSSProperties,

  label: {
    display: "block",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 13,
    color: "#999",
    marginBottom: 5,
  } as React.CSSProperties,

  badge: (color: string, bg: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 99,
    padding: "2px 9px",
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    letterSpacing: 0.3,
  }),

  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  } as React.CSSProperties,

  modal: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 12,
    padding: 28,
    width: "100%",
    maxWidth: 600,
    maxHeight: "92vh",
    overflowY: "auto" as const,
  } as React.CSSProperties,
};

// ── FAB ───────────────────────────────────────────────────────────────────────

function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Nueva plantilla"
      style={{
        position: "fixed",
        bottom: 28,
        right: 24,
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "#990000",
        border: "none",
        color: "#fff",
        fontSize: 26,
        lineHeight: 1,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(153,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
    >
      +
    </button>
  );
}

// ── PlantillaCard ─────────────────────────────────────────────────────────────

interface PlantillaCardProps {
  p: Plantilla;
  onToggleFav: (id: string) => void;
  onUsar: (p: Plantilla) => void;
  onEditar: (p: Plantilla) => void;
  copiadoId: string | null;
  onCopiar: (p: Plantilla) => void;
}

function PlantillaCard({ p, onToggleFav, onUsar, onEditar, copiadoId, onCopiar }: PlantillaCardProps) {
  const cat = CATEGORIAS[p.categoria];
  const canal = CANALES[p.canal];
  const preview = p.texto.length > 100 ? p.texto.slice(0, 100) + "..." : p.texto;

  return (
    <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 14, color: "#e0e0e0", lineHeight: 1.3 }}>
            {p.nombre}
          </span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={S.badge(cat.color, cat.bg)}>{cat.label}</span>
            <span style={S.badge(canal.color, `${canal.color}22`)}>{canal.label}</span>
          </div>
        </div>
        <button
          onClick={() => onToggleFav(p.id)}
          title={p.favorita ? "Quitar de favoritas" : "Marcar como favorita"}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "2px 4px", color: p.favorita ? "#d4960c" : "#444" }}
        >
          {p.favorita ? "★" : "☆"}
        </button>
      </div>

      {/* Preview */}
      <p style={{ margin: 0, fontSize: 13, color: "#999", lineHeight: 1.5 }}>{preview}</p>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 12, color: "#555" }}>
          {p.usos === 0 ? "Sin usos" : p.usos === 1 ? "1 uso" : `${p.usos} usos`}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ ...S.btnSecondary, padding: "6px 12px", fontSize: 12 }} onClick={() => onCopiar(p)}>
            {copiadoId === p.id ? "¡Copiado!" : "Copiar"}
          </button>
          <button style={{ ...S.btnSecondary, padding: "6px 12px", fontSize: 12 }} onClick={() => onEditar(p)}>
            Editar
          </button>
          <button style={{ ...S.btnPrimary, padding: "6px 12px", fontSize: 12 }} onClick={() => onUsar(p)}>
            Usar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────

interface EditModalProps {
  plantilla: Plantilla | null; // null = nueva
  onClose: () => void;
  onSave: (p: Plantilla) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

function EditModal({ plantilla, onClose, onSave, onDelete }: EditModalProps) {
  const isNew = plantilla === null;
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [categoria, setCategoria] = useState<Categoria>(plantilla?.categoria ?? "custom");
  const [canal, setCanal] = useState<Canal>(plantilla?.canal ?? "whatsapp");
  const [texto, setTexto] = useState(plantilla?.texto ?? "");
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const variables = useMemo(() => extractVariables(texto), [texto]);

  const handleSave = () => {
    if (!nombre.trim() || !texto.trim()) return;
    const now = new Date().toISOString();
    const p: Plantilla = {
      id: plantilla?.id ?? genId(),
      nombre: nombre.trim(),
      categoria,
      canal,
      texto: texto.trim(),
      favorita: plantilla?.favorita ?? false,
      usos: plantilla?.usos ?? 0,
      created_at: plantilla?.created_at ?? now,
      updated_at: now,
    };
    onSave(p);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ ...S.subheading, fontSize: 16 }}>{isNew ? "Nueva plantilla" : "Editar plantilla"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#999", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={S.label}>Nombre</label>
            <input
              style={S.input}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de la plantilla"
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Categoría</label>
              <select style={S.select} value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
                {(Object.keys(CATEGORIAS) as Categoria[]).map((k) => (
                  <option key={k} value={k}>{CATEGORIAS[k].label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Canal</label>
              <select style={S.select} value={canal} onChange={(e) => setCanal(e.target.value as Canal)}>
                {(Object.keys(CANALES) as Canal[]).map((k) => (
                  <option key={k} value={k}>{CANALES[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <label style={{ ...S.label, marginBottom: 0 }}>Texto</label>
              <span style={{ fontSize: 12, color: "#555" }}>{texto.length} caracteres</span>
            </div>
            <textarea
              style={{ ...S.textarea, minHeight: 140 }}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribí el texto de la plantilla. Usá {variable} para insertar valores dinámicos. Ej: {nombre}, {propiedad}, {precio}, {fecha}, {hora}, {zona}, {agencia}, {corredor}, {telefono}"
            />
            {variables.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
                <span style={{ fontSize: 12, color: "#666" }}>Variables detectadas:</span>
                {variables.map((v) => (
                  <span key={v} style={{ fontSize: 11, color: "#4ab8d8", background: "rgba(74,184,216,0.1)", borderRadius: 4, padding: "2px 6px" }}>
                    {"{" + v + "}"}
                  </span>
                ))}
              </div>
            )}
          </div>

          {preview && texto && (
            <div style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 14 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Vista previa</p>
              <p style={{ margin: 0, fontSize: 13, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{texto}</p>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {!isNew && !confirmDelete && (
                <button style={S.btnDanger} onClick={() => setConfirmDelete(true)}>Eliminar</button>
              )}
              {confirmDelete && (
                <>
                  <span style={{ fontSize: 13, color: "#990000", alignSelf: "center" }}>¿Confirmar?</span>
                  <button style={S.btnDanger} onClick={() => { onDelete(plantilla!.id); onClose(); }}>Sí, eliminar</button>
                  <button style={S.btnSecondary} onClick={() => setConfirmDelete(false)}>No</button>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btnSecondary} onClick={() => setPreview((v) => !v)}>
                {preview ? "Ocultar preview" : "Vista previa"}
              </button>
              <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
              <button style={S.btnPrimary} onClick={handleSave} disabled={!nombre.trim() || !texto.trim()}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1 — Biblioteca ────────────────────────────────────────────────────────

interface Tab1Props {
  plantillas: Plantilla[];
  onToggleFav: (id: string) => void;
  onUsar: (p: Plantilla) => void;
  onEditar: (p: Plantilla) => void;
  onNueva: () => void;
  onCopiar: (p: Plantilla) => void;
  copiadoId: string | null;
}

function Tab1Biblioteca({ plantillas, onToggleFav, onUsar, onEditar, onNueva, onCopiar, copiadoId }: Tab1Props) {
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [catFiltro, setCatFiltro] = useState<Categoria | "todas">("todas");
  const [canalFiltro, setCanalFiltro] = useState<Canal | "todos">("todos");

  // Debounce 400ms
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  const filtradas = useMemo(() => {
    return plantillas.filter((p) => {
      const q = busquedaDebounced.toLowerCase();
      if (q && !p.nombre.toLowerCase().includes(q) && !p.texto.toLowerCase().includes(q)) return false;
      if (catFiltro !== "todas" && p.categoria !== catFiltro) return false;
      if (canalFiltro !== "todos" && p.canal !== canalFiltro && p.canal !== "todos") return false;
      return true;
    });
  }, [plantillas, busquedaDebounced, catFiltro, canalFiltro]);

  return (
    <div>
      {/* Search & filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <input
          style={S.input}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o contenido..."
        />

        {/* Categoria pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setCatFiltro("todas")}
            style={{
              ...S.btnSecondary,
              padding: "5px 12px",
              fontSize: 12,
              background: catFiltro === "todas" ? "#990000" : "transparent",
              borderColor: catFiltro === "todas" ? "#990000" : "#333",
              color: catFiltro === "todas" ? "#fff" : "#e0e0e0",
            }}
          >
            Todas
          </button>
          {(Object.keys(CATEGORIAS) as Categoria[]).map((k) => (
            <button
              key={k}
              onClick={() => setCatFiltro(k)}
              style={{
                ...S.btnSecondary,
                padding: "5px 12px",
                fontSize: 12,
                background: catFiltro === k ? CATEGORIAS[k].bg : "transparent",
                borderColor: catFiltro === k ? CATEGORIAS[k].color : "#333",
                color: catFiltro === k ? CATEGORIAS[k].color : "#999",
              }}
            >
              {CATEGORIAS[k].label}
            </button>
          ))}
        </div>

        {/* Canal filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666", marginRight: 4 }}>Canal:</span>
          {(["todos", "whatsapp", "email", "sms"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCanalFiltro(c)}
              style={{
                ...S.btnSecondary,
                padding: "5px 10px",
                fontSize: 12,
                background: canalFiltro === c ? (c === "todos" ? "#333" : `${CANALES[c].color}22`) : "transparent",
                borderColor: canalFiltro === c ? (c === "todos" ? "#666" : CANALES[c].color) : "#333",
                color: canalFiltro === c ? (c === "todos" ? "#e0e0e0" : CANALES[c].color) : "#777",
              }}
            >
              {c === "todos" ? "Todos" : CANALES[c].label}
            </button>
          ))}
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
          {filtradas.length} {filtradas.length === 1 ? "plantilla" : "plantillas"} encontrada{filtradas.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Grid */}
      {filtradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#444" }}>
          <p style={{ fontSize: 40, margin: 0 }}>📭</p>
          <p style={{ marginTop: 12, fontSize: 15 }}>No se encontraron plantillas</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {filtradas.map((p) => (
            <PlantillaCard
              key={p.id}
              p={p}
              onToggleFav={onToggleFav}
              onUsar={onUsar}
              onEditar={onEditar}
              copiadoId={copiadoId}
              onCopiar={onCopiar}
            />
          ))}
        </div>
      )}

      <FAB onClick={onNueva} />
    </div>
  );
}

// ── Tab 2 — Personalizar ──────────────────────────────────────────────────────

interface Tab2Props {
  plantillas: Plantilla[];
  initialPlantilla: Plantilla | null;
  onIncrementUso: (id: string) => void;
}

function Tab2Personalizar({ plantillas, initialPlantilla, onIncrementUso }: Tab2Props) {
  const [selectedId, setSelectedId] = useState<string>(initialPlantilla?.id ?? (plantillas[0]?.id ?? ""));
  const [searchTerm, setSearchTerm] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [copiadoMsg, setCopiadoMsg] = useState(false);

  const selected = useMemo(() => plantillas.find((p) => p.id === selectedId) ?? null, [plantillas, selectedId]);

  const variables = useMemo(() => (selected ? extractVariables(selected.texto) : []), [selected]);

  // Reset vars when plantilla changes
  useEffect(() => {
    setVars({});
  }, [selectedId]);

  // When initial plantilla changes from outside
  useEffect(() => {
    if (initialPlantilla) {
      setSelectedId(initialPlantilla.id);
    }
  }, [initialPlantilla]);

  const mensajeFinal = useMemo(() => {
    if (!selected) return "";
    return applyVariables(selected.texto, vars);
  }, [selected, vars]);

  const filteredPlantillas = useMemo(() => {
    if (!searchTerm) return plantillas;
    const q = searchTerm.toLowerCase();
    return plantillas.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [plantillas, searchTerm]);

  const handleCopiar = async () => {
    if (!mensajeFinal) return;
    await navigator.clipboard.writeText(mensajeFinal);
    if (selected) onIncrementUso(selected.id);
    setCopiadoMsg(true);
    setTimeout(() => setCopiadoMsg(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!mensajeFinal) return;
    if (selected) onIncrementUso(selected.id);
    window.open(`https://wa.me/?text=${encodeURIComponent(mensajeFinal)}`, "_blank");
  };

  const handleEmail = () => {
    if (!mensajeFinal) return;
    if (selected) onIncrementUso(selected.id);
    window.open(`mailto:?body=${encodeURIComponent(mensajeFinal)}`, "_blank");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Selector */}
      <div style={S.card}>
        <label style={S.label}>Seleccioná una plantilla</label>
        <input
          style={{ ...S.input, marginBottom: 8 }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar plantilla..."
        />
        <select
          style={{ ...S.select, minHeight: 42 }}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          size={Math.min(filteredPlantillas.length, 6)}
        >
          {filteredPlantillas.map((p) => (
            <option key={p.id} value={p.id}>
              [{CATEGORIAS[p.categoria].label}] {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          {/* Variables */}
          {variables.length > 0 && (
            <div style={S.card}>
              <p style={{ ...S.subheading, fontSize: 14, marginBottom: 14 }}>
                Variables — completá los campos
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {variables.map((v) => (
                  <div key={v}>
                    <label style={S.label}>{"{" + v + "}"}</label>
                    <input
                      style={S.input}
                      value={vars[v] ?? ""}
                      onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))}
                      placeholder={v}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ ...S.subheading, fontSize: 14, margin: 0 }}>Vista previa</p>
              <span style={{ fontSize: 12, color: "#555" }}>
                {selected.usos === 0 ? "Sin usos previos" : `Usaste esta plantilla ${selected.usos} ${selected.usos === 1 ? "vez" : "veces"}`}
              </span>
            </div>
            <div
              style={{
                background: "#0a0a0a",
                border: "1px solid #1e1e1e",
                borderRadius: 8,
                padding: "14px 16px",
                minHeight: 80,
                fontSize: 14,
                color: "#ccc",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {mensajeFinal || <span style={{ color: "#444" }}>El mensaje aparecerá aquí...</span>}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#555" }}>{mensajeFinal.length} caracteres</p>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={S.btnPrimary}
              onClick={handleCopiar}
              disabled={!mensajeFinal}
            >
              {copiadoMsg ? "¡Copiado!" : "📋 Copiar mensaje"}
            </button>
            <button
              style={{ ...S.btnSecondary, borderColor: "#25d366", color: "#25d366" }}
              onClick={handleWhatsApp}
              disabled={!mensajeFinal}
            >
              💬 Abrir en WhatsApp
            </button>
            <button
              style={{ ...S.btnSecondary, borderColor: "#4ab8d8", color: "#4ab8d8" }}
              onClick={handleEmail}
              disabled={!mensajeFinal}
            >
              📧 Abrir en Gmail
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab 3 — Estadísticas ──────────────────────────────────────────────────────

interface Tab3Props {
  plantillas: Plantilla[];
}

function Tab3Estadisticas({ plantillas }: Tab3Props) {
  const totalPlantillas = plantillas.length;
  const totalFavoritas = plantillas.filter((p) => p.favorita).length;
  const totalUsos = plantillas.reduce((acc, p) => acc + p.usos, 0);
  const masUsada = useMemo(
    () => [...plantillas].sort((a, b) => b.usos - a.usos)[0] ?? null,
    [plantillas]
  );

  const top5 = useMemo(
    () => [...plantillas].sort((a, b) => b.usos - a.usos).slice(0, 5),
    [plantillas]
  );
  const maxUsos = top5[0]?.usos ?? 1;

  // Donut por categoria
  const catData = useMemo(() => {
    const counts: Partial<Record<Categoria, number>> = {};
    for (const p of plantillas) {
      counts[p.categoria] = (counts[p.categoria] ?? 0) + 1;
    }
    return (Object.keys(counts) as Categoria[])
      .map((k) => ({ cat: k, count: counts[k]! }))
      .sort((a, b) => b.count - a.count);
  }, [plantillas]);

  const donutData = useMemo(() => {
    const total = catData.reduce((a, c) => a + c.count, 0);
    if (total === 0) return [];
    let cumul = 0;
    return catData.map(({ cat, count }) => {
      const pct = count / total;
      const start = cumul;
      cumul += pct;
      return { cat, count, pct, start };
    });
  }, [catData]);

  // SVG donut helpers
  const DONUT_R = 60;
  const DONUT_CX = 90;
  const DONUT_CY = 90;
  const STROKE_W = 22;

  function describeArc(start: number, pct: number): string {
    if (pct >= 1) pct = 0.9999;
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle = (start + pct) * 2 * Math.PI - Math.PI / 2;
    const x1 = DONUT_CX + DONUT_R * Math.cos(startAngle);
    const y1 = DONUT_CY + DONUT_R * Math.sin(startAngle);
    const x2 = DONUT_CX + DONUT_R * Math.cos(endAngle);
    const y2 = DONUT_CY + DONUT_R * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${DONUT_R} ${DONUT_R} 0 ${large} 1 ${x2} ${y2}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {[
          { label: "Total plantillas", value: totalPlantillas, color: "#4ab8d8" },
          { label: "Favoritas", value: totalFavoritas, color: "#d4960c" },
          { label: "Total usos", value: totalUsos, color: "#34d399" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "#666" }}>{label}</p>
            <p style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 32, color }}>{value}</p>
          </div>
        ))}
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#666" }}>Más usada</p>
          {masUsada ? (
            <>
              <p style={{ margin: "0 0 2px", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 14, color: "#e0e0e0" }}>
                {masUsada.nombre}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#555" }}>{masUsada.usos} uso{masUsada.usos !== 1 ? "s" : ""}</p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "#444" }}>—</p>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {/* Top 5 */}
        <div style={S.card}>
          <p style={{ ...S.subheading, fontSize: 14, marginBottom: 16 }}>Top 5 más usadas</p>
          {top5.length === 0 ? (
            <p style={{ color: "#444", fontSize: 13 }}>Sin usos aún</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {top5.map((p) => {
                const barPct = maxUsos > 0 ? (p.usos / maxUsos) * 100 : 0;
                return (
                  <div key={p.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#ccc", maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.nombre}
                      </span>
                      <span style={{ fontSize: 12, color: "#555" }}>{p.usos}</span>
                    </div>
                    <svg width="100%" height="10" style={{ display: "block", borderRadius: 5, overflow: "hidden" }}>
                      <rect x="0" y="0" width="100%" height="10" fill="#1a1a1a" />
                      <rect x="0" y="0" width={`${barPct}%`} height="10" fill="#990000" rx="5" />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Donut por categoría */}
        <div style={S.card}>
          <p style={{ ...S.subheading, fontSize: 14, marginBottom: 16 }}>Por categoría</p>
          {donutData.length === 0 ? (
            <p style={{ color: "#444", fontSize: 13 }}>Sin datos</p>
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <svg width={180} height={180} viewBox="0 0 180 180">
                <circle cx={DONUT_CX} cy={DONUT_CY} r={DONUT_R} fill="none" stroke="#1a1a1a" strokeWidth={STROKE_W} />
                {donutData.map(({ cat, start, pct }) => (
                  <path
                    key={cat}
                    d={describeArc(start, pct)}
                    fill="none"
                    stroke={CATEGORIAS[cat].color}
                    strokeWidth={STROKE_W}
                    strokeLinecap="butt"
                  />
                ))}
                <text x={DONUT_CX} y={DONUT_CY - 6} textAnchor="middle" fill="#e0e0e0" fontSize="22" fontWeight="bold" fontFamily="Montserrat, sans-serif">
                  {totalPlantillas}
                </text>
                <text x={DONUT_CX} y={DONUT_CY + 12} textAnchor="middle" fill="#666" fontSize="10" fontFamily="Inter, sans-serif">
                  plantillas
                </text>
              </svg>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {donutData.map(({ cat, count }) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: CATEGORIAS[cat].color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 12, color: "#bbb" }}>{CATEGORIAS[cat].label}</span>
                    <span style={{ fontSize: 12, color: "#555", marginLeft: "auto" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PlantillasMensajesPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  const [editModal, setEditModal] = useState<{ open: boolean; plantilla: Plantilla | null }>({ open: false, plantilla: null });
  const [usarPlantilla, setUsarPlantilla] = useState<Plantilla | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Auth + load on mount
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: rows } = await supabase
        .from("crm_plantillas_mensajes")
        .select("*")
        .eq("perfil_id", userId)
        .order("created_at", { ascending: true });
      if (rows && rows.length > 0) {
        setPlantillas(rows as Plantilla[]);
      } else {
        // Seed defaults into Supabase on first load
        const now = new Date().toISOString();
        const toInsert = PLANTILLAS_DEFAULT.map((p) => ({
          perfil_id: userId,
          nombre: p.nombre,
          categoria: p.categoria,
          canal: p.canal,
          texto: p.texto,
          favorita: p.favorita,
          usos: p.usos,
          created_at: now,
          updated_at: now,
        }));
        const { data: inserted } = await supabase
          .from("crm_plantillas_mensajes")
          .insert(toInsert)
          .select("*");
        if (inserted) setPlantillas(inserted as Plantilla[]);
      }
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleToggleFav = useCallback((id: string) => {
    if (!uid) return;
    setPlantillas((prev) => {
      const updated = prev.find((p) => p.id === id);
      if (!updated) return prev;
      const newFav = !updated.favorita;
      supabase
        .from("crm_plantillas_mensajes")
        .update({ favorita: newFav, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("perfil_id", uid)
        .then(() => {});
      return prev.map((p) => (p.id === id ? { ...p, favorita: newFav, updated_at: new Date().toISOString() } : p));
    });
  }, [uid]);

  const handleCopiar = useCallback(async (p: Plantilla) => {
    await navigator.clipboard.writeText(p.texto);
    setCopiadoId(p.id);
    showToast("¡Texto copiado!");
    setTimeout(() => setCopiadoId(null), 2000);
  }, [showToast]);

  const handleUsar = useCallback((p: Plantilla) => {
    setUsarPlantilla(p);
    setTab(1);
  }, []);

  const handleEditar = useCallback((p: Plantilla) => {
    setEditModal({ open: true, plantilla: p });
  }, []);

  const handleNueva = useCallback(() => {
    setEditModal({ open: true, plantilla: null });
  }, []);

  const handleSavePlantilla = useCallback(async (p: Plantilla) => {
    if (!uid) return;
    const now = new Date().toISOString();
    const isNew = !plantillas.find((x) => x.id === p.id);
    if (isNew) {
      const { data: inserted } = await supabase
        .from("crm_plantillas_mensajes")
        .insert({
          perfil_id: uid,
          nombre: p.nombre,
          categoria: p.categoria,
          canal: p.canal,
          texto: p.texto,
          favorita: p.favorita,
          usos: p.usos,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (inserted) setPlantillas((prev) => [...prev, inserted as Plantilla]);
    } else {
      await supabase
        .from("crm_plantillas_mensajes")
        .update({
          nombre: p.nombre,
          categoria: p.categoria,
          canal: p.canal,
          texto: p.texto,
          favorita: p.favorita,
          usos: p.usos,
          updated_at: now,
        })
        .eq("id", p.id)
        .eq("perfil_id", uid);
      setPlantillas((prev) => prev.map((x) => (x.id === p.id ? { ...p, updated_at: now } : x)));
    }
    setEditModal({ open: false, plantilla: null });
    showToast(isNew ? "¡Plantilla guardada!" : "¡Plantilla actualizada!");
  }, [uid, plantillas, showToast]);

  const handleDeletePlantilla = useCallback(async (id: string) => {
    if (!uid) return;
    await supabase
      .from("crm_plantillas_mensajes")
      .delete()
      .eq("id", id)
      .eq("perfil_id", uid);
    setPlantillas((prev) => prev.filter((p) => p.id !== id));
    showToast("Plantilla eliminada");
  }, [uid, showToast]);

  const handleIncrementUso = useCallback((id: string) => {
    if (!uid) return;
    setPlantillas((prev) => {
      const p = prev.find((x) => x.id === id);
      if (!p) return prev;
      const newUsos = p.usos + 1;
      supabase
        .from("crm_plantillas_mensajes")
        .update({ usos: newUsos, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("perfil_id", uid)
        .then(() => {});
      return prev.map((x) => (x.id === id ? { ...x, usos: newUsos, updated_at: new Date().toISOString() } : x));
    });
  }, [uid]);

  const TABS = ["Biblioteca", "Personalizar", "Estadísticas"];

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <h1 style={S.heading}>Plantillas de Mensajes</h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#555" }}>
          Biblioteca de mensajes pre-escritos para WhatsApp, email y SMS
        </p>
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {TABS.map((name, i) => (
          <button
            key={name}
            onClick={() => setTab(i as 0 | 1 | 2)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === i ? "2px solid #990000" : "2px solid transparent",
              color: tab === i ? "#e0e0e0" : "#555",
              fontFamily: "'Inter', sans-serif",
              fontWeight: tab === i ? 600 : 400,
              fontSize: 14,
              padding: "10px 14px",
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && (
        <Tab1Biblioteca
          plantillas={plantillas}
          onToggleFav={handleToggleFav}
          onUsar={handleUsar}
          onEditar={handleEditar}
          onNueva={handleNueva}
          onCopiar={handleCopiar}
          copiadoId={copiadoId}
        />
      )}
      {tab === 1 && (
        <Tab2Personalizar
          plantillas={plantillas}
          initialPlantilla={usarPlantilla}
          onIncrementUso={handleIncrementUso}
        />
      )}
      {tab === 2 && <Tab3Estadisticas plantillas={plantillas} />}

      {/* Edit modal */}
      {editModal.open && (
        <EditModal
          plantilla={editModal.plantilla}
          onClose={() => setEditModal({ open: false, plantilla: null })}
          onSave={handleSavePlantilla}
          onDelete={handleDeletePlantilla}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 13,
            color: "#e0e0e0",
            zIndex: 2000,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
