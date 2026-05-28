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
  responsable: "comprador" | "vendedor" | "escribano" | "banco" | "inmobiliaria" | "otro";
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
  titulo: string;
  tipo_operacion: string | null;
  etapa: string | null;
  valor_operacion: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const ST = {
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    padding: "20px",
  } as React.CSSProperties,
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
  } as React.CSSProperties,
  select: {
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
    cursor: "pointer",
  } as React.CSSProperties,
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
  } as React.CSSProperties,
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
  } as React.CSSProperties,
  label: {
    fontSize: "0.75rem",
    color: "rgba(255,255,255,0.45)",
    marginBottom: "4px",
    display: "block",
    fontFamily: "'Inter', sans-serif",
  } as React.CSSProperties,
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
  } as React.CSSProperties,
  subheading: {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: "1rem",
    color: "#fff",
    margin: 0,
  } as React.CSSProperties,
};

function chip(color: string, bg: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    color,
    background: bg,
    fontFamily: "'Inter', sans-serif",
  };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADO_DOC_META: Record<EstadoDoc, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "#9ca3af", bg: "rgba(156,163,175,0.15)" },
  enviado:   { label: "Enviado",   color: "#60a5fa", bg: "rgba(96,165,250,0.15)"  },
  recibido:  { label: "Recibido",  color: "#fbbf24", bg: "rgba(251,191,36,0.15)"  },
  aprobado:  { label: "Aprobado",  color: "#34d399", bg: "rgba(52,211,153,0.15)"  },
  rechazado: { label: "Rechazado", color: "#cc0000", bg: "rgba(204,0,0,0.15)"     },
};

const ROL_COLORS: Record<string, string> = {
  comprador:    "#60a5fa",
  vendedor:     "#fbbf24",
  escribano:    "#a78bfa",
  banco:        "#34d399",
  garante:      "#f97316",
  inmobiliaria: "#ec4899",
  otro:         "#9ca3af",
};

const HITO_ICONS: Record<string, string> = {
  nota:      "📝",
  documento: "📄",
  reunion:   "🤝",
  firma:     "✍️",
  pago:      "💰",
  otro:      "•",
};

// ── Plantillas ────────────────────────────────────────────────────────────────

function getPlantilla(tipo: string | null): Omit<Documento, "id">[] {
  const esVenta = !tipo || tipo === "venta" || tipo === "loteo";

  if (esVenta) {
    const items: Array<[string, TipoDoc, Documento["responsable"]]> = [
      ["DNI comprador",                 "dni",         "comprador"   ],
      ["DNI vendedor",                  "dni",         "vendedor"    ],
      ["Escritura anterior",            "escritura",   "vendedor"    ],
      ["Certificado de libre deuda",    "certificado", "escribano"   ],
      ["Certificado no inhibición",     "certificado", "escribano"   ],
      ["Título de propiedad",           "titulo",      "vendedor"    ],
      ["Planos",                        "planos",      "vendedor"    ],
      ["Reglamento PH (si aplica)",     "reglamento",  "vendedor"    ],
      ["Certificado de deudas impuestos","impuestos",  "vendedor"    ],
      ["Boleto compraventa",            "contrato",    "escribano"   ],
      ["Escritura traslativa",          "escritura",   "escribano"   ],
    ];
    return items.map(([nombre, tipo, responsable]) => ({
      nombre, tipo, responsable,
      estado: "pendiente", fechaVencimiento: null, notas: "", obligatorio: true,
    }));
  }

  const items: Array<[string, TipoDoc, Documento["responsable"]]> = [
    ["DNI inquilino",          "dni",      "comprador"   ],
    ["DNI garante",            "dni",      "otro"        ],
    ["Recibo de sueldo",       "otro",     "comprador"   ],
    ["Garantía propietaria",   "otro",     "otro"        ],
    ["Contrato de alquiler",   "contrato", "escribano"   ],
    ["Inventario del inmueble","otro",     "inmobiliaria"],
  ];
  return items.map(([nombre, tipo, responsable]) => ({
    nombre, tipo, responsable,
    estado: "pendiente", fechaVencimiento: null, notas: "", obligatorio: true,
  }));
}

// ── Persistencia helpers ──────────────────────────────────────────────────────

function expedienteVacio(negocioId: string): Expediente {
  return {
    negocioId,
    partes: [],
    documentos: [],
    hitos: [],
    notas: "",
    updatedAt: new Date().toISOString(),
  };
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

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

type TabId = "documentos" | "partes" | "timeline" | "notas";
type UpdateExpFn = (fn: (prev: Expediente) => Expediente) => void;

// ── Página principal ──────────────────────────────────────────────────────────

export default function ExpedientePage() {
  const [negocios, setNegocios] = useState<NegocioDB[]>([]);
  const [negocioId, setNegocioId] = useState<string>("");
  const [exp, setExp] = useState<Expediente | null>(null);
  const [tab, setTab] = useState<TabId>("documentos");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [allExpedientes, setAllExpedientes] = useState<Expediente[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: cfgRow } = await supabase
          .from("crm_expedientes")
          .select("expedientes")
          .eq("perfil_id", user.id)
          .maybeSingle();
        if (cfgRow?.expedientes) {
          setAllExpedientes(cfgRow.expedientes as Expediente[]);
        }
      }
      const { data } = await supabase
        .from("crm_negocios")
        .select("id,titulo,tipo_operacion,etapa,valor_operacion,moneda,fecha_cierre")
        .not("etapa", "in", '("perdido")')
        .order("created_at", { ascending: false })
        .limit(50);
      setNegocios((data as NegocioDB[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!negocioId) { setExp(null); return; }
    const found = allExpedientes.find((e) => e.negocioId === negocioId);
    setExp(found ?? expedienteVacio(negocioId));
  }, [negocioId, allExpedientes]);

  const updateExp = useCallback((fn: (prev: Expediente) => Expediente) => {
    setExp((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      next.updatedAt = new Date().toISOString();
      // Persist to Supabase
      setAllExpedientes((prevAll) => {
        const idx = prevAll.findIndex((e) => e.negocioId === next.negocioId);
        const updated = idx >= 0
          ? prevAll.map((e) => (e.negocioId === next.negocioId ? next : e))
          : [...prevAll, next];
        // Fire and forget upsert
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return;
          supabase.from("crm_expedientes").upsert({
            perfil_id: user.id,
            expedientes: updated,
            updated_at: new Date().toISOString(),
          });
        });
        return updated;
      });
      return next;
    });
  }, []);

  const negocioActivo = negocios.find((n) => n.id === negocioId) ?? null;

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: "documentos", label: `Documentos (${exp?.documentos.length ?? 0})` },
    { id: "partes",     label: `Partes (${exp?.partes.length ?? 0})` },
    { id: "timeline",   label: `Timeline (${exp?.hitos.length ?? 0})` },
    { id: "notas",      label: "Notas" },
  ];

  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>
            CRM · Operaciones
          </p>
          <h1
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 800,
              fontSize: "1.6rem",
              color: "#fff",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Expediente Digital
          </h1>
        </div>

        {/* Selector de negocio */}
        <div style={{ ...ST.card, marginBottom: "20px" }}>
          <label style={ST.label}>Seleccionar operación</label>
          {loading ? (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", margin: 0 }}>Cargando negocios...</p>
          ) : (
            <select
              value={negocioId}
              onChange={(e) => setNegocioId(e.target.value)}
              style={{ ...ST.select, padding: "10px 14px", fontSize: "0.95rem" }}
            >
              <option value="">— Seleccioná una operación —</option>
              {negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {[
                    n.titulo,
                    n.tipo_operacion && `(${n.tipo_operacion})`,
                    n.valor_operacion && `· ${formatPrecio(n.valor_operacion, n.moneda)}`,
                    n.etapa && `[${n.etapa}]`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Pantalla de bienvenida */}
        {!negocioId && (
          <div style={{ ...ST.card, textAlign: "center", padding: "56px 24px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>📂</div>
            <p style={{ ...ST.subheading, marginBottom: "8px" }}>Seleccioná una operación para comenzar</p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", margin: 0 }}>
              El expediente centraliza partes, documentos, timeline y notas de cada negocio.
            </p>
          </div>
        )}

        {/* Expediente activo */}
        {negocioId && exp && negocioActivo && (
          <>
            <ResumenNegocio negocio={negocioActivo} exp={exp} />

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                marginBottom: "20px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}
            >
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

            {tab === "documentos" && (
              <TabDocumentos exp={exp} updateExp={updateExp} negocioTipo={negocioActivo.tipo_operacion} />
            )}
            {tab === "partes" && <TabPartes exp={exp} updateExp={updateExp} />}
            {tab === "timeline" && <TabTimeline exp={exp} updateExp={updateExp} />}
            {tab === "notas" && <TabNotas exp={exp} updateExp={updateExp} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Resumen ───────────────────────────────────────────────────────────────────

function ResumenNegocio({ negocio, exp }: { negocio: NegocioDB; exp: Expediente }) {
  const docsObligatorios = exp.documentos.filter((d) => d.obligatorio);
  const docsCompletados  = docsObligatorios.filter((d) => d.estado === "aprobado");
  const pct = docsObligatorios.length > 0
    ? Math.round((docsCompletados.length / docsObligatorios.length) * 100)
    : 0;
  const docsVencidos  = exp.documentos.filter((d) => estaVencido(d.fechaVencimiento));
  const docsPorVencer = exp.documentos.filter((d) => esPorVencer(d.fechaVencimiento));

  return (
    <div style={{ ...ST.card, marginBottom: "20px" }}>
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "16px" }}>
        {(
          [
            ["Tipo operación", negocio.tipo_operacion?.toUpperCase() ?? "—"],
            ["Valor cierre", formatPrecio(negocio.valor_operacion, negocio.moneda)],
          ] as Array<[string, string]>
        ).map(([k, v]) => (
          <div key={k}>
            <span style={ST.label}>{k}</span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{v}</span>
          </div>
        ))}
        <div>
          <span style={ST.label}>Etapa</span>
          <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#34d399" }}>
            {negocio.etapa ?? "—"}
          </span>
        </div>
        {negocio.fecha_cierre && (
          <div>
            <span style={ST.label}>Fecha cierre</span>
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
              {new Date(negocio.fecha_cierre).toLocaleDateString("es-AR")}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)" }}>
          Documentos obligatorios aprobados
        </span>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: pct === 100 ? "#34d399" : "#fff" }}>
          {docsCompletados.length}/{docsObligatorios.length} ({pct}%)
        </span>
      </div>
      <div
        style={{
          height: "6px",
          background: "rgba(255,255,255,0.08)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
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

      {(docsVencidos.length > 0 || docsPorVencer.length > 0) && (
        <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {docsVencidos.length > 0 && (
            <span style={{ ...chip("#cc0000", "rgba(204,0,0,0.15)"), fontSize: "0.8rem", padding: "4px 12px" }}>
              ⚠ {docsVencidos.length} doc{docsVencidos.length > 1 ? "s" : ""} vencido
              {docsVencidos.length > 1 ? "s" : ""}
            </span>
          )}
          {docsPorVencer.length > 0 && (
            <span
              style={{ ...chip("#fbbf24", "rgba(251,191,36,0.12)"), fontSize: "0.8rem", padding: "4px 12px" }}
            >
              ⏰ {docsPorVencer.length} por vencer (7 días)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Documentos ───────────────────────────────────────────────────────────

const DOC_VACÍO = (): Omit<Documento, "id"> => ({
  nombre: "",
  tipo: "otro",
  responsable: "otro",
  estado: "pendiente",
  fechaVencimiento: null,
  notas: "",
  obligatorio: true,
});

const TIPOS_DOC: TipoDoc[] = [
  "dni","escritura","titulo","certificado","impuestos","planos","reglamento","contrato","otro",
];
const RESPONSABLES: Documento["responsable"][] = [
  "comprador","vendedor","escribano","banco","inmobiliaria","otro",
];
const ESTADOS_DOC: EstadoDoc[] = [
  "pendiente","enviado","recibido","aprobado","rechazado",
];

function TabDocumentos({
  exp,
  updateExp,
  negocioTipo,
}: {
  exp: Expediente;
  updateExp: UpdateExpFn;
  negocioTipo: string | null;
}) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<Omit<Documento, "id">>(DOC_VACÍO());

  function agregarDoc() {
    if (!form.nombre.trim()) return;
    updateExp((prev) => ({
      ...prev,
      documentos: [...prev.documentos, { ...form, id: uid() }],
    }));
    setForm(DOC_VACÍO());
    setShowForm(false);
  }

  function editarDoc<K extends keyof Documento>(id: string, campo: K, valor: Documento[K]) {
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

  const esAlquiler = negocioTipo === "alquiler" || negocioTipo === "alquiler_temporal";

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button onClick={() => setShowForm(!showForm)} style={ST.btn}>
          + Agregar documento
        </button>
        <button onClick={aplicarPlantilla} style={ST.btnGhost}>
          📋 Plantilla {esAlquiler ? "alquiler" : "venta"}
        </button>
      </div>

      {showForm && (
        <div style={{ ...ST.card, marginBottom: "16px", borderColor: "rgba(204,0,0,0.3)" }}>
          <p style={{ ...ST.subheading, marginBottom: "14px" }}>Nuevo documento</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label style={ST.label}>Nombre *</label>
              <input
                style={ST.input}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: DNI comprador"
              />
            </div>
            <div>
              <label style={ST.label}>Tipo</label>
              <select
                style={ST.select}
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoDoc })}
              >
                {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={ST.label}>Responsable</label>
              <select
                style={ST.select}
                value={form.responsable}
                onChange={(e) => setForm({ ...form, responsable: e.target.value as Documento["responsable"] })}
              >
                {RESPONSABLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={ST.label}>Estado</label>
              <select
                style={ST.select}
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoDoc })}
              >
                {ESTADOS_DOC.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div>
              <label style={ST.label}>Fecha vencimiento</label>
              <input
                type="date"
                style={ST.input}
                value={form.fechaVencimiento ?? ""}
                onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value || null })}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
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
            <label style={ST.label}>Notas</label>
            <input
              style={ST.input}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Notas opcionales..."
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={agregarDoc} style={ST.btn}>Guardar</button>
            <button
              onClick={() => { setShowForm(false); setForm(DOC_VACÍO()); }}
              style={ST.btnGhost}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {exp.documentos.length === 0 ? (
        <div style={{ ...ST.card, textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
          No hay documentos. Agregá uno o usá la plantilla.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {exp.documentos.map((doc) => {
            const meta      = ESTADO_DOC_META[doc.estado];
            const vencido   = estaVencido(doc.fechaVencimiento);
            const porVencer = esPorVencer(doc.fechaVencimiento);
            const isOpen    = expandido === doc.id;

            return (
              <div
                key={doc.id}
                style={{
                  ...ST.card,
                  padding: "12px 16px",
                  borderColor: vencido
                    ? "rgba(204,0,0,0.4)"
                    : porVencer
                    ? "rgba(251,191,36,0.3)"
                    : undefined,
                  cursor: "pointer",
                }}
                onClick={() => setExpandido(isOpen ? null : doc.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: "0.9rem" }}>{doc.nombre}</span>
                  <span style={chip(ROL_COLORS[doc.responsable] ?? "#9ca3af", "rgba(255,255,255,0.07)")}>
                    {doc.responsable}
                  </span>
                  <span style={chip(meta.color, meta.bg)}>{meta.label}</span>
                  {doc.obligatorio && (
                    <span style={{ fontSize: "0.7rem", color: "#cc0000", fontWeight: 700 }}>OBL</span>
                  )}
                  {doc.fechaVencimiento && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: vencido ? "#cc0000" : porVencer ? "#fbbf24" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {vencido ? "⚠ Vencido" : porVencer ? "⏰" : ""}{" "}
                      {new Date(doc.fechaVencimiento).toLocaleDateString("es-AR")}
                    </span>
                  )}
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.8rem" }}>
                    {isOpen ? "▲" : "▼"}
                  </span>
                </div>

                {!isOpen && doc.notas && (
                  <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>
                    {doc.notas}
                  </p>
                )}

                {isOpen && (
                  <div
                    style={{
                      marginTop: "14px",
                      borderTop: "1px solid rgba(255,255,255,0.07)",
                      paddingTop: "14px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <label style={ST.label}>Nombre</label>
                        <input
                          style={ST.input}
                          value={doc.nombre}
                          onChange={(e) => editarDoc(doc.id, "nombre", e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={ST.label}>Estado</label>
                        <select
                          style={ST.select}
                          value={doc.estado}
                          onChange={(e) => editarDoc(doc.id, "estado", e.target.value as EstadoDoc)}
                        >
                          {ESTADOS_DOC.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={ST.label}>Responsable</label>
                        <select
                          style={ST.select}
                          value={doc.responsable}
                          onChange={(e) =>
                            editarDoc(doc.id, "responsable", e.target.value as Documento["responsable"])
                          }
                        >
                          {RESPONSABLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={ST.label}>Tipo</label>
                        <select
                          style={ST.select}
                          value={doc.tipo}
                          onChange={(e) => editarDoc(doc.id, "tipo", e.target.value as TipoDoc)}
                        >
                          {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={ST.label}>Fecha vencimiento</label>
                        <input
                          type="date"
                          style={ST.input}
                          value={doc.fechaVencimiento ?? ""}
                          onChange={(e) =>
                            editarDoc(doc.id, "fechaVencimiento", e.target.value || null)
                          }
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
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
                      <label style={ST.label}>Notas</label>
                      <input
                        style={ST.input}
                        value={doc.notas}
                        onChange={(e) => editarDoc(doc.id, "notas", e.target.value)}
                        placeholder="Notas del documento..."
                      />
                    </div>
                    <button
                      onClick={() => eliminarDoc(doc.id)}
                      style={{
                        ...ST.btnGhost,
                        color: "#cc0000",
                        borderColor: "rgba(204,0,0,0.3)",
                        fontSize: "0.8rem",
                      }}
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

const ROLES_PARTE: Parte["rol"][] = ["comprador","vendedor","escribano","banco","garante","otro"];
const CAMPOS_PARTE: Array<Exclude<keyof Parte, "rol">> = [
  "nombre","telefono","email","dni","notas",
];

function TabPartes({ exp, updateExp }: { exp: Expediente; updateExp: UpdateExpFn }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Parte>(PARTE_VACÍA());

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
        <button onClick={() => setShowForm(!showForm)} style={ST.btn}>
          + Agregar parte
        </button>
      </div>

      {showForm && (
        <div style={{ ...ST.card, marginBottom: "16px", borderColor: "rgba(204,0,0,0.3)" }}>
          <p style={{ ...ST.subheading, marginBottom: "14px" }}>Nueva parte</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div>
              <label style={ST.label}>Nombre *</label>
              <input
                style={ST.input}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label style={ST.label}>Rol</label>
              <select
                style={ST.select}
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Parte["rol"] })}
              >
                {ROLES_PARTE.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={ST.label}>Teléfono</label>
              <input
                style={ST.input}
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="+54 9 11..."
              />
            </div>
            <div>
              <label style={ST.label}>Email</label>
              <input
                style={ST.input}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div>
              <label style={ST.label}>DNI</label>
              <input
                style={ST.input}
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value })}
                placeholder="12.345.678"
              />
            </div>
            <div>
              <label style={ST.label}>Notas</label>
              <input
                style={ST.input}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Notas..."
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={agregarParte} style={ST.btn}>Guardar</button>
            <button
              onClick={() => { setShowForm(false); setForm(PARTE_VACÍA()); }}
              style={ST.btnGhost}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {exp.partes.length === 0 ? (
        <div style={{ ...ST.card, textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
          No hay partes registradas.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "12px",
          }}
        >
          {exp.partes.map((parte, idx) => {
            const rolColor = ROL_COLORS[parte.rol] ?? "#9ca3af";
            const isEdit   = editIdx === idx;

            return (
              <div
                key={idx}
                style={{ ...ST.card, cursor: isEdit ? "default" : "pointer" }}
                onClick={() => !isEdit && setEditIdx(idx)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px",
                  }}
                >
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
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {parte.rol}
                    </span>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>
                      {parte.nombre || (
                        <span style={{ color: "rgba(255,255,255,0.3)" }}>Sin nombre</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditIdx(isEdit ? null : idx); }}
                    style={{ ...ST.btnGhost, padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    {isEdit ? "Listo" : "Editar"}
                  </button>
                </div>

                {!isEdit ? (
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
                      <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)" }}>
                        DNI: {parte.dni}
                      </span>
                    )}
                    {parte.notas && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.8rem",
                          color: "rgba(255,255,255,0.35)",
                          fontStyle: "italic",
                        }}
                      >
                        {parte.notas}
                      </p>
                    )}
                  </div>
                ) : (
                  <div onClick={(e) => e.stopPropagation()}>
                    <div style={{ marginBottom: "8px" }}>
                      <label style={ST.label}>Rol</label>
                      <select
                        style={ST.select}
                        value={parte.rol}
                        onChange={(e) => actualizarParte(idx, "rol", e.target.value)}
                      >
                        {ROLES_PARTE.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    {CAMPOS_PARTE.map((campo) => (
                      <div key={campo} style={{ marginBottom: "8px" }}>
                        <label style={ST.label}>{campo.charAt(0).toUpperCase() + campo.slice(1)}</label>
                        <input
                          style={ST.input}
                          value={parte[campo]}
                          onChange={(e) => actualizarParte(idx, campo, e.target.value)}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => eliminarParte(idx)}
                      style={{
                        ...ST.btnGhost,
                        color: "#cc0000",
                        borderColor: "rgba(204,0,0,0.3)",
                        fontSize: "0.8rem",
                        marginTop: "4px",
                      }}
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

const TIPOS_HITO: Hito["tipo"][] = ["nota","documento","reunion","firma","pago","otro"];

function TabTimeline({ exp, updateExp }: { exp: Expediente; updateExp: UpdateExpFn }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Hito, "id">>(HITO_VACÍO());

  const sorted = [...exp.hitos].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

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
        <button onClick={() => setShowForm(!showForm)} style={ST.btn}>
          + Agregar hito
        </button>
      </div>

      {showForm && (
        <div style={{ ...ST.card, marginBottom: "20px", borderColor: "rgba(204,0,0,0.3)" }}>
          <p style={{ ...ST.subheading, marginBottom: "14px" }}>Nuevo hito</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label style={ST.label}>Tipo</label>
              <select
                style={ST.select}
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as Hito["tipo"] })}
              >
                {TIPOS_HITO.map((t) => (
                  <option key={t} value={t}>{HITO_ICONS[t]} {t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={ST.label}>Fecha</label>
              <input
                type="date"
                style={ST.input}
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label style={ST.label}>Autor</label>
              <input
                style={ST.input}
                value={form.autor}
                onChange={(e) => setForm({ ...form, autor: e.target.value })}
                placeholder="Tu nombre..."
              />
            </div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={ST.label}>Descripción *</label>
            <textarea
              style={{ ...ST.textarea, minHeight: "80px" }}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Describí el evento..."
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={agregarHito} style={ST.btn}>Guardar</button>
            <button
              onClick={() => { setShowForm(false); setForm(HITO_VACÍO()); }}
              style={ST.btnGhost}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ ...ST.card, textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
          No hay hitos en el timeline.
        </div>
      ) : (
        <div style={{ position: "relative" }}>
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

                <div style={{ ...ST.card, flex: 1, padding: "12px 16px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#cc0000",
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.06em",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        {hito.tipo}
                      </span>
                      {hito.autor && (
                        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                          · {hito.autor}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
                        {fechaRelativa(hito.fecha)}
                      </span>
                      <button
                        onClick={() => eliminarHito(hito.id)}
                        style={{
                          ...ST.btnGhost,
                          padding: "2px 8px",
                          fontSize: "0.7rem",
                          color: "rgba(255,255,255,0.3)",
                        }}
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

function TabNotas({ exp, updateExp }: { exp: Expediente; updateExp: UpdateExpFn }) {
  const [guardando, setGuardando]     = useState(false);
  const [guardado, setGuardado]       = useState(false);
  const [localNotas, setLocalNotas]   = useState(exp.notas);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalNotas(exp.notas);
    setGuardado(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp.negocioId]);

  function handleChange(val: string) {
    setLocalNotas(val);
    setGuardado(false);
    setGuardando(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateExp((prev) => ({ ...prev, notas: val }));
      setGuardando(false);
      setGuardado(true);
    }, 800);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <p style={{ ...ST.subheading, fontSize: "0.9rem", color: "rgba(255,255,255,0.5)" }}>
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
        style={{ ...ST.textarea, minHeight: "320px" }}
        value={localNotas}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Escribí notas generales sobre el expediente, instrucciones, pendientes, observaciones..."
      />

      <div
        style={{ marginTop: "8px", textAlign: "right", fontSize: "0.75rem", color: "rgba(255,255,255,0.25)" }}
      >
        {localNotas.length} caracteres · Última actualización:{" "}
        {new Date(exp.updatedAt).toLocaleString("es-AR")}
      </div>
    </div>
  );
}
