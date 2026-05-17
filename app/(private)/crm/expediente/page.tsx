"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoDoc = "pendiente" | "enviado" | "recibido" | "aprobado" | "rechazado";
type TipoDoc = "dni" | "escritura" | "titulo" | "certificado" | "impuestos" | "planos" | "reglamento" | "contrato" | "otro";

interface Documento {
  id: string;
  nombre: string;
  tipo: TipoDoc;
  responsable: "comprador" | "vendedor" | "escribano" | "banco" | "garante" | "inmobiliaria" | "otro";
  estado: EstadoDoc;
  fechaVencimiento: string | null;
  notas: string;
  obligatorio: boolean;
}

interface Parte {
  rol: "comprador" | "vendedor" | "escribano" | "banco" | "garante" | "otro";
  nombre: string;
  telefono: string;
  email: string;
  dni: string;
  notas: string;
}

interface Hito {
  id: string;
  fecha: string;
  tipo: "nota" | "documento" | "reunion" | "firma" | "pago" | "otro";
  descripcion: string;
  autor: string;
}

interface Expediente {
  negocioId: string;
  partes: Parte[];
  documentos: Documento[];
  hitos: Hito[];
  notas: string;
  updatedAt: string;
}

interface NegocioDB {
  id: string;
  tipo: string | null;
  estado: string | null;
  barrio: string | null;
  tipo_propiedad: string | null;
  precio_cierre: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
}

// ── Helpers de persistencia ───────────────────────────────────────────────────

const LS_KEY = "crm_expedientes_v1";

function loadAllExpedientes(): Expediente[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Expediente[]) : [];
  } catch {
    return [];
  }
}

function saveExpediente(exp: Expediente): void {
  const all = loadAllExpedientes();
  const idx = all.findIndex((e) => e.negocioId === exp.negocioId);
  if (idx >= 0) all[idx] = exp;
  else all.push(exp);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function loadExpediente(negocioId: string): Expediente {
  const all = loadAllExpedientes();
  return (
    all.find((e) => e.negocioId === negocioId) ?? {
      negocioId,
      partes: [],
      documentos: [],
      hitos: [],
      notas: "",
      updatedAt: new Date().toISOString(),
    }
  );
}

// ── Constantes de colores ─────────────────────────────────────────────────────

const ESTADO_DOC_META: Record<EstadoDoc, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "#9ca3af", bg: "rgba(156,163,175,0.15)" },
  enviado:    { label: "Enviado",    color: "#60a5fa", bg: "rgba(96,165,250,0.15)"  },
  recibido:   { label: "Recibido",   color: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
  aprobado:   { label: "Aprobado",   color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  rechazado:  { label: "Rechazado",  color: "#cc0000", bg: "rgba(204,0,0,0.15)"    },
};

const ROL_COLORS: Record<string, string> = {
  comprador:  "#60a5fa",
  vendedor:   "#fbbf24",
  escribano:  "#a78bfa",
  banco:      "#34d399",
  garante:    "#f97316",
  inmobiliaria: "#ec4899",
  otro:       "#9ca3af",
};

const HITO_ICONS: Record<string, string> = {
  nota:      "📝",
  documento: "📄",
  reunion:   "🤝",
  firma:     "✍️",
  pago:      "💰",
  otro:      "•",
};

// ── Plantillas de documentos ──────────────────────────────────────────────────

function getPlantilla(tipo: string | null): Omit<Documento, "id">[] {
  const esVenta = !tipo || tipo === "venta" || tipo === "loteo";
  if (esVenta) {
    const nombres = [
      ["DNI comprador", "dni", "comprador"],
      ["DNI vendedor", "dni", "vendedor"],
      ["Escritura anterior", "escritura", "vendedor"],
      ["Certificado de libre deuda", "certificado", "escribano"],
      ["Certificado no inhibición", "certificado", "escribano"],
      ["Título de propiedad", "titulo", "vendedor"],
      ["Planos", "planos", "vendedor"],
      ["Reglamento PH (si aplica)", "reglamento", "vendedor"],
      ["Certificado de deudas impuestos", "impuestos", "vendedor"],
      ["Boleto compraventa", "contrato", "escribano"],
      ["Escritura traslativa", "escritura", "escribano"],
    ] as const;
    return nombres.map(([nombre, tipo, responsable]) => ({
      nombre,
      tipo: tipo as TipoDoc,
      responsable,
      estado: "pendiente" as EstadoDoc,
      fechaVencimiento: null,
      notas: "",
      obligatorio: true,
    }));
  } else {
    const nombres = [
      ["DNI inquilino", "dni", "comprador"],
      ["DNI garante", "dni", "otro"],
      ["Recibo de sueldo", "otro", "otro"],
      ["Garantía propietaria", "otro", "otro"],
      ["Contrato de alquiler", "contrato", "escribano"],
      ["Inventario del inmueble", "otro", "inmobiliaria"],
    ] as const;
    return nombres.map(([nombre, tipo, responsable]) => ({
      nombre,
      tipo: tipo as TipoDoc,
      responsable: responsable as Documento["responsable"],
      estado: "pendiente" as EstadoDoc,
      fechaVencimiento: null,
      notas: "",
      obligatorio: true,
    }));
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fechaRelativa(fechaStr: string): string {
  const diff = Date.now() - new Date(fechaStr).getTime();
  const dias = Math.floor(diff / 86400000);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} sem.`;
  return new Date(fechaStr).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" });
}

function esPorVencer(fecha: string | null): boolean {
  if (!fecha) return false;
  const diff = new Date(fecha).getTime() - Date.now();
  return diff > 0 && diff < 7 * 86400000;
}

function estaVencido(fecha: string | null): boolean {
  if (!fecha) return false;
  return new Date(fecha).getTime() < Date.now();
}

function formatPrecio(precio: number | null, moneda: string | null): string {
  if (!precio) return "—";
  return `${moneda ?? "ARS"} ${precio.toLocaleString("es-AR")}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ExpedientePage() {
  const [negocios, setNegocios] = useState<NegocioDB[]>([]);
  const [negocioId, setNegocioId] = useState<string>("");
  const [exp, setExp] = useState<Expediente | null>(null);
  const [tab, setTab] = useState<"documentos" | "partes" | "timeline" | "notas">("documentos");
  const [loading, setLoading] = useState(true);

  // Cargar lista de negocios
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("crm_negocios")
        .select("id,tipo,estado,barrio,tipo_propiedad,precio_cierre,moneda,fecha_cierre")
        .not("estado", "in", '("perdido")')
        .order("created_at", { ascending: false })
        .limit(50);
      setNegocios((data as NegocioDB[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // Al seleccionar negocio: cargar expediente
  useEffect(() => {
    if (!negocioId) { setExp(null); return; }
    setExp(loadExpediente(negocioId));
  }, [negocioId]);

  const updateExp = useCallback((fn: (prev: Expediente) => Expediente) => {
    setExp((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      next.updatedAt = new Date().toISOString();
      saveExpediente(next);
      return next;
    });
  }, []);

  const negocioActivo = negocios.find((n) => n.id === negocioId) ?? null;

  // ── Estilos base ────────────────────────────────────────────────────────────

  const chipStyle = (color: string, bg: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    color,
    background: bg,
    fontFamily: "'Inter', sans-serif",
  });

  const s: Record<string, React.CSSProperties> = {
    page: {
      background: "#0a0a0a",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
      padding: "24px",
    },
    heading: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 800,
      fontSize: "1.6rem",
      color: "#fff",
      margin: 0,
      letterSpacing: "-0.02em",
    },
    subheading: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 700,
      fontSize: "1rem",
      color: "#fff",
      margin: 0,
    },
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      padding: "20px",
    },
    select: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "8px",
      color: "#fff",
      padding: "10px 14px",
      fontSize: "0.95rem",
      fontFamily: "'Inter', sans-serif",
      outline: "none",
      cursor: "pointer",
      width: "100%",
    },
    input: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "8px",
      color: "#fff",
      padding: "8px 12px",
      fontSize: "0.9rem",
      fontFamily: "'Inter', sans-serif",
      outline: "none",
      width: "100%",
      boxSizing: "border-box" as const,
    },
    btn: {
      background: "#cc0000",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      padding: "8px 16px",
      fontSize: "0.85rem",
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
    },
    btnGhost: {
      background: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.7)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      padding: "7px 14px",
      fontSize: "0.85rem",
      fontFamily: "'Inter', sans-serif",
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
    },
    label: {
      fontSize: "0.75rem",
      color: "rgba(255,255,255,0.45)",
      marginBottom: "4px",
      display: "block",
      fontFamily: "'Inter', sans-serif",
    },
    divider: {
      borderColor: "rgba(255,255,255,0.07)",
      margin: "16px 0",
    },
    textarea: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "8px",
      color: "#fff",
      padding: "12px",
      fontSize: "0.9rem",
      fontFamily: "'Inter', sans-serif",
      outline: "none",
      resize: "vertical" as const,
      width: "100%",
      boxSizing: "border-box" as const,
      lineHeight: 1.6,
    },
  };

  // ── Render: cabecera + selector ─────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>CRM · Operaciones</p>
            <h1 style={s.heading}>Expediente Digital</h1>
          </div>
        </div>

        {/* Selector de negocio */}
        <div style={{ ...s.card, marginBottom: "20px" }}>
          <label style={s.label}>Seleccionar operación</label>
          {loading ? (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", margin: 0 }}>Cargando negocios...</p>
          ) : (
            <select
              value={negocioId}
              onChange={(e) => setNegocioId(e.target.value)}
              style={s.select}
            >
              <option value="">— Seleccioná una operación —</option>
              {negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {[
                    n.tipo?.toUpperCase(),
                    n.tipo_propiedad,
                    n.barrio && `· ${n.barrio}`,
                    n.precio_cierre && `· ${formatPrecio(n.precio_cierre, n.moneda)}`,
                    n.estado && `[${n.estado}]`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Sin negocio seleccionado */}
        {!negocioId && (
          <div style={{ ...s.card, textAlign: "center", padding: "56px 24px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>📂</div>
            <p style={{ ...s.subheading, marginBottom: "8px" }}>Seleccioná una operación para comenzar</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", margin: 0 }}>
              El expediente centraliza partes, documentos, timeline y notas de cada negocio.
            </p>
          </div>
        )}

        {/* Contenido del expediente */}
        {negocioId && exp && negocioActivo && (
          <ExpedientePanel
            negocio={negocioActivo}
            exp={exp}
            tab={tab}
            setTab={setTab}
            updateExp={updateExp}
            s={s}
          />
        )}
      </div>
    </div>
  );
}

// ── Panel principal del expediente ────────────────────────────────────────────

interface ExpedientePanelProps {
  negocio: NegocioDB;
  exp: Expediente;
  tab: "documentos" | "partes" | "timeline" | "notas";
  setTab: (t: "documentos" | "partes" | "timeline" | "notas") => void;
  updateExp: (fn: (prev: Expediente) => Expediente) => void;
  s: Record<string, React.CSSProperties>;
}

function ExpedientePanel({ negocio, exp, tab, setTab, updateExp, s }: ExpedientePanelProps) {
  const chipFn = (color: string, bg: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 10px", borderRadius: "999px",
    fontSize: "0.75rem", fontWeight: 600, color, background: bg, fontFamily: "'Inter',sans-serif",
  });

  const docsObligatorios = exp.documentos.filter((d) => d.obligatorio);
  const docsCompletados  = docsObligatorios.filter((d) => d.estado === "aprobado");
  const pct = docsObligatorios.length > 0
    ? Math.round((docsCompletados.length / docsObligatorios.length) * 100)
    : 0;

  const docsVencidos    = exp.documentos.filter((d) => estaVencido(d.fechaVencimiento));
  const docsPorVencer   = exp.documentos.filter((d) => esPorVencer(d.fechaVencimiento));

  const TABS = [
    { id: "documentos", label: `Documentos (${exp.documentos.length})` },
    { id: "partes",     label: `Partes (${exp.partes.length})` },
    { id: "timeline",   label: `Timeline (${exp.hitos.length})` },
    { id: "notas",      label: "Notas" },
  ] as const;

  return (
    <>
      {/* Panel de resumen */}
      <div style={{ ...s.card as React.CSSProperties, marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div>
            <span style={s.label as React.CSSProperties}>Tipo</span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{negocio.tipo?.toUpperCase() ?? "—"}</span>
          </div>
          <div>
            <span style={s.label as React.CSSProperties}>Barrio</span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{negocio.barrio ?? "—"}</span>
          </div>
          <div>
            <span style={s.label as React.CSSProperties}>Propiedad</span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{negocio.tipo_propiedad ?? "—"}</span>
          </div>
          <div>
            <span style={s.label as React.CSSProperties}>Precio cierre</span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{formatPrecio(negocio.precio_cierre, negocio.moneda)}</span>
          </div>
          <div>
            <span style={s.label as React.CSSProperties}>Estado</span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#34d399" }}>{negocio.estado ?? "—"}</span>
          </div>
          {negocio.fecha_cierre && (
            <div>
              <span style={s.label as React.CSSProperties}>Fecha cierre</span>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                {new Date(negocio.fecha_cierre).toLocaleDateString("es-AR")}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)" }}>
            Documentos obligatorios aprobados
          </span>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: pct === 100 ? "#34d399" : "#fff" }}>
            {docsCompletados.length}/{docsObligatorios.length} ({pct}%)
          </span>
        </div>
        <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: pct === 100 ? "#34d399" : "#cc0000",
              borderRadius: "999px",
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {/* Alertas */}
        {(docsVencidos.length > 0 || docsPorVencer.length > 0) && (
          <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {docsVencidos.length > 0 && (
              <div style={{ ...chipFn("#cc0000", "rgba(204,0,0,0.15)"), fontSize: "0.8rem", padding: "4px 12px" }}>
                ⚠ {docsVencidos.length} doc{docsVencidos.length > 1 ? "s" : ""} vencido{docsVencidos.length > 1 ? "s" : ""}
              </div>
            )}
            {docsPorVencer.length > 0 && (
              <div style={{ ...chipFn("#fbbf24", "rgba(251,191,36,0.12)"), fontSize: "0.8rem", padding: "4px 12px" }}>
                ⏰ {docsPorVencer.length} por vencer (7 días)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "0" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "2px solid #cc0000" : "2px solid transparent",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.45)",
              padding: "10px 16px",
              fontSize: "0.88rem",
              fontFamily: "'Inter', sans-serif",
              fontWeight: tab === t.id ? 600 : 400,
              cursor: "pointer",
              transition: "color 0.2s",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "documentos" && (
        <TabDocumentos exp={exp} updateExp={updateExp} negocioTipo={negocio.tipo} s={s} />
      )}
      {tab === "partes" && (
        <TabPartes exp={exp} updateExp={updateExp} s={s} />
      )}
      {tab === "timeline" && (
        <TabTimeline exp={exp} updateExp={updateExp} s={s} />
      )}
      {tab === "notas" && (
        <TabNotas exp={exp} updateExp={updateExp} s={s} />
      )}
    </>
  );
}

// ── Tab: Documentos ───────────────────────────────────────────────────────────

interface TabProps {
  exp: Expediente;
  updateExp: (fn: (prev: Expediente) => Expediente) => void;
  s: Record<string, React.CSSProperties>;
}

interface TabDocumentosProps extends TabProps {
  negocioTipo: string | null;
}

const DOC_VACÍO = (): Omit<Documento, "id"> => ({
  nombre: "",
  tipo: "otro",
  responsable: "otro",
  estado: "pendiente",
  fechaVencimiento: null,
  notas: "",
  obligatorio: true,
});

function TabDocumentos({ exp, updateExp, negocioTipo, s }: TabDocumentosProps) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Documento, "id">>(DOC_VACÍO());

  const chipFn = (color: string, bg: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 10px", borderRadius: "999px",
    fontSize: "0.75rem", fontWeight: 600, color, background: bg, fontFamily: "'Inter',sans-serif",
  });

  function agregarDoc() {
    if (!form.nombre.trim()) return;
    updateExp((prev) => ({
      ...prev,
      documentos: [...prev.documentos, { ...form, id: uid() }],
    }));
    setForm(DOC_VACÍO());
    setShowForm(false);
  }

  function editarDoc(id: string, campo: keyof Documento, valor: Documento[keyof Documento]) {
    updateExp((prev) => ({
      ...prev,
      documentos: prev.documentos.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)),
    }));
  }

  function eliminarDoc(id: string) {
    updateExp((prev) => ({
      ...prev,
      documentos: prev.documentos.filter((d) => d.id !== id),
    }));
    if (expandido === id) setExpandido(null);
  }

  function aplicarPlantilla() {
    const plantilla = getPlantilla(negocioTipo);
    const nuevos: Documento[] = plantilla.map((d) => ({ ...d, id: uid() }));
    updateExp((prev) => ({ ...prev, documentos: [...prev.documentos, ...nuevos] }));
  }

  const inputStyle = s.input as React.CSSProperties;
  const btnStyle   = s.btn  as React.CSSProperties;
  const btnGhost   = s.btnGhost as React.CSSProperties;
  const cardStyle  = s.card as React.CSSProperties;
  const labelStyle = s.label as React.CSSProperties;

  return (
    <div>
      {/* Acciones */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>
          + Agregar documento
        </button>
        <button onClick={aplicarPlantilla} style={btnGhost}>
          📋 Plantilla {negocioTipo === "alquiler" || negocioTipo === "alquiler_temporal" ? "alquiler" : "venta"}
        </button>
      </div>

      {/* Formulario nuevo doc */}
      {showForm && (
        <div style={{ ...cardStyle, marginBottom: "16px", borderColor: "rgba(204,0,0,0.3)" }}>
          <p style={{ ...s.subheading as React.CSSProperties, marginBottom: "14px" }}>Nuevo documento</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label style={labelStyle}>Nombre *</label>
              <input
                style={inputStyle}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: DNI comprador"
              />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoDoc })}>
                {(["dni","escritura","titulo","certificado","impuestos","planos","reglamento","contrato","otro"] as TipoDoc[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Responsable</label>
              <select style={inputStyle} value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value as Documento["responsable"] })}>
                {(["comprador","vendedor","escribano","banco","inmobiliaria","otro"] as const).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Estado</label>
              <select style={inputStyle} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoDoc })}>
                {(["pendiente","enviado","recibido","aprobado","rechazado"] as EstadoDoc[]).map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha vencimiento</label>
              <input
                type="date"
                style={inputStyle}
                value={form.fechaVencimiento ?? ""}
                onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value || null })}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", paddingBottom: "0" }}>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={form.obligatorio}
                  onChange={(e) => setForm({ ...form, obligatorio: e.target.checked })}
                  style={{ accentColor: "#cc0000" }}
                />
                Obligatorio
              </label>
            </div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>Notas</label>
            <input
              style={inputStyle}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Notas opcionales..."
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={agregarDoc} style={btnStyle}>Guardar</button>
            <button onClick={() => { setShowForm(false); setForm(DOC_VACÍO()); }} style={btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista de documentos */}
      {exp.documentos.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
          No hay documentos. Agregá uno o usá la plantilla.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {exp.documentos.map((doc) => {
            const meta = ESTADO_DOC_META[doc.estado];
            const vencido    = estaVencido(doc.fechaVencimiento);
            const porVencer  = esPorVencer(doc.fechaVencimiento);
            const isOpen     = expandido === doc.id;

            return (
              <div
                key={doc.id}
                style={{
                  ...cardStyle,
                  padding: "12px 16px",
                  borderColor: vencido ? "rgba(204,0,0,0.4)" : porVencer ? "rgba(251,191,36,0.3)" : undefined,
                  cursor: "pointer",
                }}
                onClick={() => setExpandido(isOpen ? null : doc.id)}
              >
                {/* Fila principal */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "0.9rem" }}>{doc.nombre}</span>
                  <span style={chipFn(ROL_COLORS[doc.responsable] ?? "#9ca3af", "rgba(255,255,255,0.07)")}>
                    {doc.responsable}
                  </span>
                  <span style={chipFn(meta.color, meta.bg)}>{meta.label}</span>
                  {doc.obligatorio && (
                    <span style={{ fontSize: "0.7rem", color: "#cc0000", fontWeight: 700 }}>OBL</span>
                  )}
                  {doc.fechaVencimiento && (
                    <span style={{
                      fontSize: "0.75rem",
                      color: vencido ? "#cc0000" : porVencer ? "#fbbf24" : "rgba(255,255,255,0.4)",
                    }}>
                      {vencido ? "⚠ Vencido" : porVencer ? "⏰" : ""} {new Date(doc.fechaVencimiento).toLocaleDateString("es-AR")}
                    </span>
                  )}
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.8rem" }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Fila de notas (colapsada) */}
                {!isOpen && doc.notas && (
                  <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>{doc.notas}</p>
                )}

                {/* Editor expandido */}
                {isOpen && (
                  <div
                    style={{ marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "14px" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                      <div>
                        <label style={labelStyle}>Nombre</label>
                        <input
                          style={inputStyle}
                          value={doc.nombre}
                          onChange={(e) => editarDoc(doc.id, "nombre", e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Estado</label>
                        <select
                          style={inputStyle}
                          value={doc.estado}
                          onChange={(e) => editarDoc(doc.id, "estado", e.target.value as EstadoDoc)}
                        >
                          {(["pendiente","enviado","recibido","aprobado","rechazado"] as EstadoDoc[]).map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Responsable</label>
                        <select
                          style={inputStyle}
                          value={doc.responsable}
                          onChange={(e) => editarDoc(doc.id, "responsable", e.target.value as Documento["responsable"])}
                        >
                          {(["comprador","vendedor","escribano","banco","inmobiliaria","otro"] as const).map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Tipo</label>
                        <select
                          style={inputStyle}
                          value={doc.tipo}
                          onChange={(e) => editarDoc(doc.id, "tipo", e.target.value as TipoDoc)}
                        >
                          {(["dni","escritura","titulo","certificado","impuestos","planos","reglamento","contrato","otro"] as TipoDoc[]).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Fecha vencimiento</label>
                        <input
                          type="date"
                          style={inputStyle}
                          value={doc.fechaVencimiento ?? ""}
                          onChange={(e) => editarDoc(doc.id, "fechaVencimiento", e.target.value || null)}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "2px" }}>
                        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: 0 }}>
                          <input
                            type="checkbox"
                            checked={doc.obligatorio}
                            onChange={(e) => editarDoc(doc.id, "obligatorio", e.target.checked)}
                            style={{ accentColor: "#cc0000" }}
                          />
                          Obligatorio
                        </label>
                      </div>
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <label style={labelStyle}>Notas</label>
                      <input
                        style={inputStyle}
                        value={doc.notas}
                        onChange={(e) => editarDoc(doc.id, "notas", e.target.value)}
                        placeholder="Notas del documento..."
                      />
                    </div>
                    <button
                      onClick={() => eliminarDoc(doc.id)}
                      style={{ ...btnGhost, color: "#cc0000", borderColor: "rgba(204,0,0,0.3)", fontSize: "0.8rem" }}
                    >
                      Eliminar documento
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Partes ───────────────────────────────────────────────────────────────

const PARTE_VACÍA = (): Parte => ({
  rol: "comprador",
  nombre: "",
  telefono: "",
  email: "",
  dni: "",
  notas: "",
});

function TabPartes({ exp, updateExp, s }: TabProps) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Parte>(PARTE_VACÍA());

  const btnStyle  = s.btn  as React.CSSProperties;
  const btnGhost  = s.btnGhost as React.CSSProperties;
  const cardStyle = s.card as React.CSSProperties;
  const inputStyle = s.input as React.CSSProperties;
  const labelStyle = s.label as React.CSSProperties;

  function agregarParte() {
    if (!form.nombre.trim()) return;
    updateExp((prev) => ({ ...prev, partes: [...prev.partes, form] }));
    setForm(PARTE_VACÍA());
    setShowForm(false);
  }

  function actualizarParte(idx: number, campo: keyof Parte, valor: string) {
    updateExp((prev) => ({
      ...prev,
      partes: prev.partes.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)),
    }));
  }

  function eliminarParte(idx: number) {
    updateExp((prev) => ({ ...prev, partes: prev.partes.filter((_, i) => i !== idx) }));
    if (editIdx === idx) setEditIdx(null);
  }

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>+ Agregar parte</button>
      </div>

      {/* Formulario nueva parte */}
      {showForm && (
        <div style={{ ...cardStyle, marginBottom: "16px", borderColor: "rgba(204,0,0,0.3)" }}>
          <p style={{ ...s.subheading as React.CSSProperties, marginBottom: "14px" }}>Nueva parte</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div>
              <label style={labelStyle}>Nombre *</label>
              <input style={inputStyle} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" />
            </div>
            <div>
              <label style={labelStyle}>Rol</label>
              <select style={inputStyle} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Parte["rol"] })}>
                {(["comprador","vendedor","escribano","banco","garante","otro"] as const).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input style={inputStyle} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+54 9 11..." />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@ejemplo.com" />
            </div>
            <div>
              <label style={labelStyle}>DNI</label>
              <input style={inputStyle} value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} placeholder="12.345.678" />
            </div>
            <div>
              <label style={labelStyle}>Notas</label>
              <input style={inputStyle} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Notas..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={agregarParte} style={btnStyle}>Guardar</button>
            <button onClick={() => { setShowForm(false); setForm(PARTE_VACÍA()); }} style={btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Cards de partes */}
      {exp.partes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
          No hay partes registradas.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
          {exp.partes.map((parte, idx) => {
            const rolColor = ROL_COLORS[parte.rol] ?? "#9ca3af";
            const isEdit = editIdx === idx;

            return (
              <div
                key={idx}
                style={{ ...cardStyle, cursor: "pointer" }}
                onClick={() => !isEdit && setEditIdx(idx)}
              >
                {/* Rol y nombre */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "999px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: rolColor,
                        background: `${rolColor}20`,
                        marginBottom: "6px",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {parte.rol}
                    </span>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>
                      {parte.nombre || <span style={{ color: "rgba(255,255,255,0.3)" }}>Sin nombre</span>}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditIdx(isEdit ? null : idx); }}
                    style={{ ...btnGhost, padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    {isEdit ? "Listo" : "Editar"}
                  </button>
                </div>

                {!isEdit ? (
                  /* Vista colapsada */
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {parte.telefono && (
                      <a
                        href={`https://wa.me/${parte.telefono.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#34d399", fontSize: "0.85rem", textDecoration: "none" }}
                      >
                        📱 {parte.telefono}
                      </a>
                    )}
                    {parte.email && (
                      <a
                        href={`mailto:${parte.email}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#60a5fa", fontSize: "0.85rem", textDecoration: "none" }}
                      >
                        ✉ {parte.email}
                      </a>
                    )}
                    {parte.dni && (
                      <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)" }}>DNI: {parte.dni}</span>
                    )}
                    {parte.notas && (
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>{parte.notas}</p>
                    )}
                  </div>
                ) : (
                  /* Editor inline */
                  <div onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                      <div>
                        <label style={labelStyle}>Rol</label>
                        <select style={inputStyle} value={parte.rol} onChange={(e) => actualizarParte(idx, "rol", e.target.value)}>
                          {(["comprador","vendedor","escribano","banco","garante","otro"] as const).map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Nombre</label>
                        <input style={inputStyle} value={parte.nombre} onChange={(e) => actualizarParte(idx, "nombre", e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Teléfono</label>
                        <input style={inputStyle} value={parte.telefono} onChange={(e) => actualizarParte(idx, "telefono", e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Email</label>
                        <input style={inputStyle} value={parte.email} onChange={(e) => actualizarParte(idx, "email", e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>DNI</label>
                        <input style={inputStyle} value={parte.dni} onChange={(e) => actualizarParte(idx, "dni", e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Notas</label>
                        <input style={inputStyle} value={parte.notas} onChange={(e) => actualizarParte(idx, "notas", e.target.value)} />
                      </div>
                    </div>
                    <button
                      onClick={() => eliminarParte(idx)}
                      style={{ ...btnGhost, color: "#cc0000", borderColor: "rgba(204,0,0,0.3)", fontSize: "0.8rem" }}
                    >
                      Eliminar parte
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Timeline ─────────────────────────────────────────────────────────────

const HITO_VACÍO = (): Omit<Hito, "id"> => ({
  fecha: new Date().toISOString().slice(0, 10),
  tipo: "nota",
  descripcion: "",
  autor: "",
});

function TabTimeline({ exp, updateExp, s }: TabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Hito, "id">>(HITO_VACÍO());

  const btnStyle  = s.btn  as React.CSSProperties;
  const btnGhost  = s.btnGhost as React.CSSProperties;
  const cardStyle = s.card as React.CSSProperties;
  const inputStyle = s.input as React.CSSProperties;
  const labelStyle = s.label as React.CSSProperties;
  const textareaStyle = s.textarea as React.CSSProperties;

  const sorted = [...exp.hitos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  function agregarHito() {
    if (!form.descripcion.trim()) return;
    updateExp((prev) => ({
      ...prev,
      hitos: [...prev.hitos, { ...form, id: uid() }],
    }));
    setForm(HITO_VACÍO());
    setShowForm(false);
  }

  function eliminarHito(id: string) {
    updateExp((prev) => ({ ...prev, hitos: prev.hitos.filter((h) => h.id !== id) }));
  }

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <button onClick={() => setShowForm(!showForm)} style={btnStyle}>+ Agregar hito</button>
      </div>

      {/* Formulario nuevo hito */}
      {showForm && (
        <div style={{ ...cardStyle, marginBottom: "20px", borderColor: "rgba(204,0,0,0.3)" }}>
          <p style={{ ...s.subheading as React.CSSProperties, marginBottom: "14px" }}>Nuevo hito</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Hito["tipo"] })}>
                {(["nota","documento","reunion","firma","pago","otro"] as const).map((t) => (
                  <option key={t} value={t}>{HITO_ICONS[t]} {t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input
                type="date"
                style={inputStyle}
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Autor</label>
              <input
                style={inputStyle}
                value={form.autor}
                onChange={(e) => setForm({ ...form, autor: e.target.value })}
                placeholder="Tu nombre..."
              />
            </div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>Descripción *</label>
            <textarea
              style={{ ...textareaStyle, minHeight: "80px" }}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Describí el evento..."
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={agregarHito} style={btnStyle}>Guardar</button>
            <button onClick={() => { setShowForm(false); setForm(HITO_VACÍO()); }} style={btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
          No hay hitos en el timeline.
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Línea vertical */}
          <div
            style={{
              position: "absolute",
              left: "20px",
              top: 0,
              bottom: 0,
              width: "2px",
              background: "rgba(255,255,255,0.07)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sorted.map((hito) => (
              <div key={hito.id} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                {/* Icono */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "#1a1a1a",
                    border: "2px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1rem",
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                >
                  {HITO_ICONS[hito.tipo]}
                </div>

                {/* Contenido */}
                <div style={{ ...cardStyle, flex: 1, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#cc0000",
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {hito.tipo}
                      </span>
                      {hito.autor && (
                        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>· {hito.autor}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
                        {fechaRelativa(hito.fecha)}
                      </span>
                      <button
                        onClick={() => eliminarHito(hito.id)}
                        style={{ ...btnGhost, padding: "2px 8px", fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5 }}>{hito.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Notas ────────────────────────────────────────────────────────────────

function TabNotas({ exp, updateExp, s }: TabProps) {
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaStyle = s.textarea as React.CSSProperties;

  function handleChange(val: string) {
    setGuardado(false);
    setGuardando(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateExp((prev) => ({ ...prev, notas: val }));
      setGuardando(false);
      setGuardado(true);
    }, 800);

    // Actualizar valor local inmediatamente (sin persistir)
    updateExp((prev) => ({ ...prev, notas: val }));
  }

  return (
    <div>
      {/* Indicador de guardado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <p style={{ ...s.subheading as React.CSSProperties, fontSize: "0.9rem", color: "rgba(255,255,255,0.5)" }}>
          Notas libres del expediente
        </p>
        <span
          style={{
            fontSize: "0.78rem",
            color: guardando ? "#fbbf24" : guardado ? "#34d399" : "rgba(255,255,255,0.25)",
            fontStyle: "italic",
            transition: "color 0.3s",
          }}
        >
          {guardando ? "Guardando..." : guardado ? "✓ Guardado" : ""}
        </span>
      </div>

      <textarea
        style={{ ...textareaStyle, minHeight: "320px" }}
        value={exp.notas}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Escribí notas generales sobre el expediente, instrucciones, pendientes, observaciones..."
      />

      <div style={{ marginTop: "8px", textAlign: "right", fontSize: "0.75rem", color: "rgba(255,255,255,0.25)" }}>
        {exp.notas.length} caracteres · Última actualización: {new Date(exp.updatedAt).toLocaleString("es-AR")}
      </div>
    </div>
  );
}
