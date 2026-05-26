"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

// ── Tipos ────────────────────────────────────────────────────────────────────

type TipoExpediente = "venta" | "alquiler" | "alquiler_temporal" | "hipoteca";
type EstadoExpediente = "en_proceso" | "completo" | "archivado";
type CategoriaDoc = "vendedor" | "comprador" | "propiedad" | "banco" | "escribanía";

interface DocItem {
  id: string;
  nombre: string;
  categoria: CategoriaDoc;
  requerido: boolean;
  obtenido: boolean;
  vencimiento: string | null; // ISO date
  notas: string;
}

interface Expediente {
  id: string;
  nombre: string;
  tipo: TipoExpediente;
  estado: EstadoExpediente;
  contacto: string;
  propiedad: string;
  items: DocItem[];
  created_at: string;
  updated_at: string;
}

// ── Constantes de fecha ───────────────────────────────────────────────────────

const HOY = "2026-05-18";
const HOY_DATE = new Date(HOY);

// ── Templates por tipo ────────────────────────────────────────────────────────

function makeItem(
  nombre: string,
  categoria: CategoriaDoc,
  requerido: boolean
): DocItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nombre,
    categoria,
    requerido,
    obtenido: false,
    vencimiento: null,
    notas: "",
  };
}

const TEMPLATES: Record<TipoExpediente, DocItem[]> = {
  venta: [
    makeItem("DNI del vendedor", "vendedor", true),
    makeItem("CUIT del vendedor", "vendedor", true),
    makeItem("Título de propiedad", "vendedor", true),
    makeItem("Libre deuda de expensas", "vendedor", false),
    makeItem("Libre deuda TGI", "vendedor", true),
    makeItem("Libre deuda de servicios", "vendedor", true),
    makeItem("DNI del comprador", "comprador", true),
    makeItem("CUIT del comprador", "comprador", true),
    makeItem("Comprobante de fondos", "comprador", true),
    makeItem("Plano aprobado", "propiedad", false),
    makeItem("Habilitación (si corresponde)", "propiedad", false),
    makeItem("Medición de peritos", "propiedad", false),
    makeItem("Solicitud de informes", "escribanía", true),
    makeItem("Boleto de compraventa", "escribanía", true),
    makeItem("Escritura", "escribanía", true),
  ],
  alquiler: [
    makeItem("DNI del propietario", "vendedor", true),
    makeItem("Título de propiedad", "vendedor", true),
    makeItem("Impuesto inmobiliario al día", "vendedor", true),
    makeItem("DNI del inquilino", "comprador", true),
    makeItem("Recibos de sueldo (últimos 3)", "comprador", true),
    makeItem("Tipo de garantía", "comprador", true),
    makeItem("Documentación de garantía", "comprador", true),
    makeItem("Plano de la propiedad", "propiedad", false),
    makeItem("Inventario firmado", "propiedad", true),
    makeItem("Contrato firmado", "escribanía", true),
    makeItem("Depósito recibido", "escribanía", true),
  ],
  alquiler_temporal: [
    makeItem("DNI del propietario", "vendedor", true),
    makeItem("Título de propiedad", "vendedor", true),
    makeItem("DNI del inquilino temporal", "comprador", true),
    makeItem("Depósito de garantía", "comprador", true),
    makeItem("Inventario de equipamiento", "propiedad", true),
    makeItem("Estado del inmueble (fotos)", "propiedad", false),
    makeItem("Contrato de alquiler temporal", "escribanía", true),
    makeItem("Pago anticipado recibido", "escribanía", true),
  ],
  hipoteca: [
    makeItem("DNI del titular", "vendedor", true),
    makeItem("CUIT del titular", "vendedor", true),
    makeItem("Últimas 3 declaraciones AFIP", "vendedor", true),
    makeItem("Recibos de sueldo", "vendedor", true),
    makeItem("Extractos bancarios (6 meses)", "vendedor", true),
    makeItem("Tasación aprobada", "banco", true),
    makeItem("Pre-aprobación del crédito", "banco", true),
    makeItem("Aprobación final del crédito", "banco", true),
    makeItem("Título sin inhibiciones", "propiedad", true),
    makeItem("Certificado de dominio", "propiedad", true),
    makeItem("Libre deuda total", "propiedad", true),
  ],
};

// ── Datos de ejemplo ──────────────────────────────────────────────────────────

function buildEjemplos(): Expediente[] {
  const items1: DocItem[] = [
    { id: "e1-1", nombre: "DNI del vendedor", categoria: "vendedor", requerido: true, obtenido: true, vencimiento: null, notas: "Copia digital verificada" },
    { id: "e1-2", nombre: "CUIT del vendedor", categoria: "vendedor", requerido: true, obtenido: true, vencimiento: null, notas: "" },
    { id: "e1-3", nombre: "Título de propiedad", categoria: "vendedor", requerido: true, obtenido: false, vencimiento: null, notas: "Pendiente escribanía" },
    { id: "e1-4", nombre: "Libre deuda TGI", categoria: "vendedor", requerido: true, obtenido: true, vencimiento: "2026-05-20", notas: "" },
    { id: "e1-5", nombre: "Libre deuda de expensas", categoria: "vendedor", requerido: false, obtenido: false, vencimiento: null, notas: "" },
    { id: "e1-6", nombre: "DNI del comprador", categoria: "comprador", requerido: true, obtenido: true, vencimiento: null, notas: "" },
    { id: "e1-7", nombre: "CUIT del comprador", categoria: "comprador", requerido: true, obtenido: true, vencimiento: null, notas: "" },
    { id: "e1-8", nombre: "Comprobante de fondos", categoria: "comprador", requerido: true, obtenido: false, vencimiento: "2026-05-14", notas: "VENCIDO — solicitar actualización" },
    { id: "e1-9", nombre: "Plano aprobado", categoria: "propiedad", requerido: false, obtenido: true, vencimiento: null, notas: "Plano municipal 2018" },
    { id: "e1-10", nombre: "Medición de peritos", categoria: "propiedad", requerido: false, obtenido: false, vencimiento: null, notas: "" },
    { id: "e1-11", nombre: "Solicitud de informes", categoria: "escribanía", requerido: true, obtenido: true, vencimiento: "2026-05-24", notas: "" },
    { id: "e1-12", nombre: "Boleto de compraventa", categoria: "escribanía", requerido: true, obtenido: false, vencimiento: null, notas: "Pendiente firma" },
  ];
  const items2: DocItem[] = [
    { id: "e2-1", nombre: "DNI del propietario", categoria: "vendedor", requerido: true, obtenido: true, vencimiento: null, notas: "" },
    { id: "e2-2", nombre: "Título de propiedad", categoria: "vendedor", requerido: true, obtenido: true, vencimiento: null, notas: "" },
    { id: "e2-3", nombre: "Impuesto inmobiliario al día", categoria: "vendedor", requerido: true, obtenido: false, vencimiento: null, notas: "" },
    { id: "e2-4", nombre: "DNI del inquilino", categoria: "comprador", requerido: true, obtenido: true, vencimiento: null, notas: "" },
    { id: "e2-5", nombre: "Recibos de sueldo (últimos 3)", categoria: "comprador", requerido: true, obtenido: false, vencimiento: null, notas: "Faltan los de marzo" },
    { id: "e2-6", nombre: "Documentación de garantía", categoria: "comprador", requerido: true, obtenido: true, vencimiento: null, notas: "Garantía propietaria" },
    { id: "e2-7", nombre: "Inventario firmado", categoria: "propiedad", requerido: true, obtenido: false, vencimiento: null, notas: "" },
    { id: "e2-8", nombre: "Contrato firmado", categoria: "escribanía", requerido: true, obtenido: true, vencimiento: null, notas: "" },
  ];

  return [
    {
      id: "exp-001",
      nombre: "Venta Departamento - García",
      tipo: "venta",
      estado: "en_proceso",
      contacto: "Roberto García",
      propiedad: "Belgrano, Dto. 4B - 3 amb.",
      items: items1,
      created_at: "2026-04-10T10:00:00Z",
      updated_at: "2026-05-15T14:30:00Z",
    },
    {
      id: "exp-002",
      nombre: "Alquiler Local - Martínez",
      tipo: "alquiler",
      estado: "en_proceso",
      contacto: "Lucía Martínez",
      propiedad: "Palermo, Local planta baja 80m²",
      items: items2,
      created_at: "2026-05-01T09:00:00Z",
      updated_at: "2026-05-17T11:00:00Z",
    },
  ];
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = "documentos_crm";

function loadExpedientes(): Expediente[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Expediente[];
  } catch {
    // ignore
  }
  const ejemplos = buildEjemplos();
  localStorage.setItem(LS_KEY, JSON.stringify(ejemplos));
  return ejemplos;
}

function saveExpedientes(data: Expediente[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function diffDias(isoDate: string): number {
  const d = new Date(isoDate);
  return Math.floor((d.getTime() - HOY_DATE.getTime()) / 86400000);
}

function formatFecha(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function porcentaje(items: DocItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.obtenido).length / items.length) * 100);
}

function statusInfo(pct: number): { label: string; color: string } {
  if (pct === 100) return { label: "Completo", color: "#22c55e" };
  if (pct >= 75) return { label: "Casi listo", color: "#f59e0b" };
  return { label: "Pendiente", color: "#cc0000" };
}

function statusEmoji(pct: number): string {
  if (pct === 100) return "✅";
  if (pct >= 75) return "🟡";
  return "🔴";
}

const TIPO_LABELS: Record<TipoExpediente, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alquiler temporal",
  hipoteca: "Hipoteca",
};

const TIPO_COLORS: Record<TipoExpediente, string> = {
  venta: "#3b82f6",
  alquiler: "#22c55e",
  alquiler_temporal: "#f59e0b",
  hipoteca: "#8b5cf6",
};

const CATEGORIA_LABELS: Record<CategoriaDoc, string> = {
  vendedor: "Vendedor / Propietario",
  comprador: "Comprador / Inquilino",
  propiedad: "Propiedad",
  banco: "Banco",
  "escribanía": "Escribanía",
};

const CATEGORIAS_ORDER: CategoriaDoc[] = [
  "vendedor",
  "comprador",
  "propiedad",
  "banco",
  "escribanía",
];

// ── Componente Modal ──────────────────────────────────────────────────────────

interface ModalNuevoExpedienteProps {
  onClose: () => void;
  onSave: (exp: Expediente) => void;
}

function ModalNuevoExpediente({ onClose, onSave }: ModalNuevoExpedienteProps) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoExpediente>("venta");
  const [contacto, setContacto] = useState("");
  const [propiedad, setPropiedad] = useState("");
  const [error, setError] = useState("");

  const handleGuardar = () => {
    if (!nombre.trim()) { setError("El nombre es requerido."); return; }
    const now = new Date().toISOString();
    const template = TEMPLATES[tipo];
    const items: DocItem[] = template.map((item) => ({
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    const exp: Expediente = {
      id: `exp-${Date.now()}`,
      nombre: nombre.trim(),
      tipo,
      estado: "en_proceso",
      contacto: contacto.trim(),
      propiedad: propiedad.trim(),
      items,
      created_at: now,
      updated_at: now,
    };
    onSave(exp);
  };

  const inputSty: React.CSSProperties = {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    padding: "9px 12px",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111111",
          border: "1px solid #222222",
          borderRadius: 12,
          padding: "28px 24px",
          width: "100%",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            color: "#e0e0e0",
          }}
        >
          Nuevo expediente
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            NOMBRE DEL EXPEDIENTE *
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Venta Dto. Belgrano - López"
            style={inputSty}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            TIPO DE OPERACIÓN *
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoExpediente)}
            style={{ ...inputSty, cursor: "pointer" }}
          >
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
            <option value="alquiler_temporal">Alquiler temporal</option>
            <option value="hipoteca">Hipoteca</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            CONTACTO
          </label>
          <input
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Nombre del cliente"
            style={inputSty}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            PROPIEDAD
          </label>
          <input
            value={propiedad}
            onChange={(e) => setPropiedad(e.target.value)}
            placeholder="Dirección o descripción"
            style={inputSty}
          />
        </div>

        <div
          style={{
            background: "rgba(204,0,0,0.08)",
            border: "1px solid rgba(204,0,0,0.2)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 11,
            color: "#aaa",
          }}
        >
          Se cargarán automáticamente{" "}
          <strong style={{ color: "#e0e0e0" }}>
            {TEMPLATES[tipo].length} documentos
          </strong>{" "}
          del template para <strong style={{ color: TIPO_COLORS[tipo] }}>{TIPO_LABELS[tipo]}</strong>.
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "#ff6666", fontFamily: "Inter, sans-serif" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#666",
              padding: "9px 18px",
              fontSize: 12,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            style={{
              background: "#cc0000",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              padding: "9px 22px",
              fontSize: 12,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Crear expediente
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente Modal Agregar Doc ──────────────────────────────────────────────

interface ModalAgregarDocProps {
  onClose: () => void;
  onSave: (item: DocItem) => void;
}

function ModalAgregarDoc({ onClose, onSave }: ModalAgregarDocProps) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDoc>("vendedor");
  const [requerido, setRequerido] = useState(true);
  const [vencimiento, setVencimiento] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");

  const inputSty: React.CSSProperties = {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    padding: "9px 12px",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  const handleGuardar = () => {
    if (!nombre.trim()) { setError("El nombre es requerido."); return; }
    onSave({
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nombre: nombre.trim(),
      categoria,
      requerido,
      obtenido: false,
      vencimiento: vencimiento || null,
      notas: notas.trim(),
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111111",
          border: "1px solid #222222",
          borderRadius: 12,
          padding: "28px 24px",
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            color: "#e0e0e0",
          }}
        >
          Agregar documento
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            NOMBRE *
          </label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del documento" style={inputSty} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            CATEGORÍA
          </label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaDoc)}
            style={{ ...inputSty, cursor: "pointer" }}
          >
            {CATEGORIAS_ORDER.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setRequerido(!requerido)}
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              border: `2px solid ${requerido ? "#cc0000" : "#444"}`,
              background: requerido ? "#cc0000" : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {requerido && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
          </button>
          <span style={{ fontSize: 13, color: "#ccc" }}>Documento requerido</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            FECHA DE VENCIMIENTO (opcional)
          </label>
          <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} style={inputSty} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 11, color: "#888", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            NOTAS (opcional)
          </label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones" style={inputSty} />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "#ff6666" }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid #333",
              borderRadius: 8,
              color: "#666",
              padding: "9px 18px",
              fontSize: 12,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            style={{
              background: "#cc0000",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              padding: "9px 22px",
              fontSize: 12,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function GestionDocumentosPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [tabActiva, setTabActiva] = useState<"expedientes" | "detalle" | "estadisticas">("expedientes");
  const [expSeleccionado, setExpSeleccionado] = useState<string | null>(null);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [mostrarModalDoc, setMostrarModalDoc] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<TipoExpediente | "todos">("todos");
  const [filtroEstado, setFiltroEstado] = useState<EstadoExpediente | "todos">("todos");
  const [editandoNotaId, setEditandoNotaId] = useState<string | null>(null);
  const [notaTemp, setNotaTemp] = useState("");
  const [inited, setInited] = useState(false);

  useEffect(() => {
    setExpedientes(loadExpedientes());
    setInited(true);
  }, []);

  const persist = useCallback(
    (next: Expediente[]) => {
      setExpedientes(next);
      saveExpedientes(next);
    },
    []
  );

  // ── Expediente actual ────────────────────────────────────────────────────────

  const expedienteActual = useMemo(
    () => expedientes.find((e) => e.id === expSeleccionado) ?? null,
    [expedientes, expSeleccionado]
  );

  // ── Filtros Tab1 ─────────────────────────────────────────────────────────────

  const expedientesFiltrados = useMemo(() => {
    return expedientes.filter((e) => {
      if (e.estado === "archivado" && filtroEstado !== "archivado") return false;
      if (filtroTipo !== "todos" && e.tipo !== filtroTipo) return false;
      if (filtroEstado !== "todos" && e.estado !== filtroEstado) return false;
      return true;
    });
  }, [expedientes, filtroTipo, filtroEstado]);

  const expedientesActivos = useMemo(
    () => expedientes.filter((e) => e.estado !== "archivado"),
    [expedientes]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleNuevoExpediente = (exp: Expediente) => {
    persist([...expedientes, exp]);
    setMostrarModalNuevo(false);
    setExpSeleccionado(exp.id);
    setTabActiva("detalle");
  };

  const handleToggleItem = (itemId: string) => {
    if (!expSeleccionado) return;
    const now = new Date().toISOString();
    const next = expedientes.map((e) => {
      if (e.id !== expSeleccionado) return e;
      const items = e.items.map((i) =>
        i.id === itemId ? { ...i, obtenido: !i.obtenido } : i
      );
      const pct = porcentaje(items);
      const nuevoEstado: EstadoExpediente = pct === 100 ? "completo" : "en_proceso";
      return { ...e, items, estado: nuevoEstado, updated_at: now };
    });
    persist(next);
  };

  const handleAgregarDoc = (item: DocItem) => {
    if (!expSeleccionado) return;
    const now = new Date().toISOString();
    const next = expedientes.map((e) =>
      e.id === expSeleccionado
        ? { ...e, items: [...e.items, item], updated_at: now }
        : e
    );
    persist(next);
    setMostrarModalDoc(false);
  };

  const handleArchivar = () => {
    if (!expSeleccionado) return;
    const now = new Date().toISOString();
    const next = expedientes.map((e) =>
      e.id === expSeleccionado
        ? { ...e, estado: "archivado" as EstadoExpediente, updated_at: now }
        : e
    );
    persist(next);
    setExpSeleccionado(null);
    setTabActiva("expedientes");
  };

  const handleGuardarNota = (itemId: string) => {
    if (!expSeleccionado) return;
    const now = new Date().toISOString();
    const next = expedientes.map((e) => {
      if (e.id !== expSeleccionado) return e;
      return {
        ...e,
        items: e.items.map((i) =>
          i.id === itemId ? { ...i, notas: notaTemp } : i
        ),
        updated_at: now,
      };
    });
    persist(next);
    setEditandoNotaId(null);
    setNotaTemp("");
  };

  const seleccionarExpediente = (id: string) => {
    setExpSeleccionado(id);
    setTabActiva("detalle");
  };

  // ── Estadísticas ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const activos = expedientesActivos;
    const totalActivos = activos.length;
    const promedioCompletitud =
      totalActivos === 0
        ? 0
        : Math.round(
            activos.reduce((acc, e) => acc + porcentaje(e.items), 0) / totalActivos
          );

    const conVencidos = activos.filter((e) =>
      e.items.some(
        (i) => !i.obtenido && i.vencimiento && diffDias(i.vencimiento) < 0
      )
    ).length;

    const porTipo: Record<TipoExpediente, { suma: number; count: number }> = {
      venta: { suma: 0, count: 0 },
      alquiler: { suma: 0, count: 0 },
      alquiler_temporal: { suma: 0, count: 0 },
      hipoteca: { suma: 0, count: 0 },
    };

    activos.forEach((e) => {
      porTipo[e.tipo].suma += porcentaje(e.items);
      porTipo[e.tipo].count += 1;
    });

    const promPorTipo: Record<TipoExpediente, number> = {
      venta: porTipo.venta.count > 0 ? Math.round(porTipo.venta.suma / porTipo.venta.count) : 0,
      alquiler: porTipo.alquiler.count > 0 ? Math.round(porTipo.alquiler.suma / porTipo.alquiler.count) : 0,
      alquiler_temporal: porTipo.alquiler_temporal.count > 0 ? Math.round(porTipo.alquiler_temporal.suma / porTipo.alquiler_temporal.count) : 0,
      hipoteca: porTipo.hipoteca.count > 0 ? Math.round(porTipo.hipoteca.suma / porTipo.hipoteca.count) : 0,
    };

    // Docs más frecuentemente faltantes
    const faltaMap: Record<string, number> = {};
    activos.forEach((e) => {
      e.items.forEach((i) => {
        if (!i.obtenido) {
          faltaMap[i.nombre] = (faltaMap[i.nombre] ?? 0) + 1;
        }
      });
    });
    const topFaltantes = Object.entries(faltaMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return { totalActivos, promedioCompletitud, conVencidos, promPorTipo, topFaltantes };
  }, [expedientesActivos]);

  // ── Estilos compartidos ───────────────────────────────────────────────────────

  const tabBtn = (activa: boolean): React.CSSProperties => ({
    padding: "9px 18px",
    fontSize: 12,
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    border: activa ? "1px solid #cc0000" : "1px solid #222222",
    borderRadius: 8,
    background: activa ? "rgba(204,0,0,0.12)" : "#111111",
    color: activa ? "#cc0000" : "#666",
    cursor: "pointer",
  });

  if (!inited) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "2px solid rgba(204,0,0,0.3)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#e0e0e0", fontFamily: "Inter, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap');`}</style>

      {/* Header */}
      <div
        style={{
          background: "#111111",
          borderBottom: "1px solid #222222",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              color: "#e0e0e0",
            }}
          >
            Gestión de Documentos
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#666" }}>
            Checklist de documentación por expediente — guardado localmente
          </p>
        </div>
        <button
          onClick={() => setMostrarModalNuevo(true)}
          style={{
            background: "#cc0000",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            padding: "10px 20px",
            fontSize: 12,
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          + Nuevo expediente
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: "#111111",
          borderBottom: "1px solid #222222",
          padding: "12px 24px",
          display: "flex",
          gap: 8,
        }}
      >
        <button style={tabBtn(tabActiva === "expedientes")} onClick={() => setTabActiva("expedientes")}>
          Expedientes activos
        </button>
        <button style={tabBtn(tabActiva === "detalle")} onClick={() => setTabActiva("detalle")}>
          Detalle
          {expedienteActual && (
            <span
              style={{
                marginLeft: 6,
                background: "#cc0000",
                color: "#fff",
                fontSize: 9,
                padding: "1px 6px",
                borderRadius: 8,
                fontWeight: 700,
              }}
            >
              {porcentaje(expedienteActual.items)}%
            </span>
          )}
        </button>
        <button style={tabBtn(tabActiva === "estadisticas")} onClick={() => setTabActiva("estadisticas")}>
          Estadísticas
        </button>
      </div>

      {/* Contenido */}
      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── TAB 1: Expedientes ──────────────────────────────────────────────── */}
        {tabActiva === "expedientes" && (
          <div>
            {/* Filtros */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as TipoExpediente | "todos")}
                style={{
                  background: "#111111",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: "#e0e0e0",
                  padding: "8px 12px",
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                }}
              >
                <option value="todos">Todos los tipos</option>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
                <option value="alquiler_temporal">Alquiler temporal</option>
                <option value="hipoteca">Hipoteca</option>
              </select>

              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as EstadoExpediente | "todos")}
                style={{
                  background: "#111111",
                  border: "1px solid #333",
                  borderRadius: 6,
                  color: "#e0e0e0",
                  padding: "8px 12px",
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                }}
              >
                <option value="todos">Todos los estados</option>
                <option value="en_proceso">En proceso</option>
                <option value="completo">Completo</option>
                <option value="archivado">Archivado</option>
              </select>

              <span style={{ marginLeft: "auto", fontSize: 11, color: "#555", alignSelf: "center" }}>
                {expedientesFiltrados.length} expediente{expedientesFiltrados.length !== 1 ? "s" : ""}
              </span>
            </div>

            {expedientesFiltrados.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 24px",
                  color: "#555",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
                <p style={{ margin: 0, fontSize: 14 }}>
                  No hay expedientes{filtroTipo !== "todos" || filtroEstado !== "todos" ? " con estos filtros" : ""}. Creá el primero.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {expedientesFiltrados.map((exp) => {
                  const pct = porcentaje(exp.items);
                  const { label, color } = statusInfo(pct);
                  const sel = expSeleccionado === exp.id;
                  return (
                    <div
                      key={exp.id}
                      onClick={() => seleccionarExpediente(exp.id)}
                      style={{
                        background: "#111111",
                        border: `1px solid ${sel ? "#cc0000" : "#222222"}`,
                        borderRadius: 10,
                        padding: "16px",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", lineHeight: 1.3 }}>
                          {exp.nombre}
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            background: `${TIPO_COLORS[exp.tipo]}20`,
                            color: TIPO_COLORS[exp.tipo],
                            border: `1px solid ${TIPO_COLORS[exp.tipo]}40`,
                            borderRadius: 4,
                            fontSize: 9,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            padding: "2px 7px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {TIPO_LABELS[exp.tipo]}
                        </span>
                      </div>

                      {exp.contacto && (
                        <div style={{ fontSize: 11, color: "#777", marginBottom: 2 }}>
                          {exp.contacto}
                        </div>
                      )}
                      {exp.propiedad && (
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>
                          {exp.propiedad}
                        </div>
                      )}

                      {/* Barra progreso */}
                      <div style={{ height: 5, background: "#1a1a1a", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: color,
                            borderRadius: 3,
                            transition: "width 0.3s",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#666" }}>
                          {exp.items.filter((i) => i.obtenido).length}/{exp.items.length} docs
                        </span>
                        <span style={{ fontSize: 11, color, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          {statusEmoji(pct)} {label} · {pct}%
                        </span>
                      </div>

                      <div style={{ fontSize: 10, color: "#444", marginTop: 8 }}>
                        {formatFecha(exp.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Detalle ──────────────────────────────────────────────────── */}
        {tabActiva === "detalle" && (
          <div>
            {!expedienteActual ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "80px 24px",
                  color: "#555",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <p style={{ margin: 0, fontSize: 15 }}>
                  Seleccioná un expediente para ver sus documentos
                </p>
                <button
                  onClick={() => setTabActiva("expedientes")}
                  style={{
                    marginTop: 14,
                    background: "none",
                    border: "1px solid #333",
                    borderRadius: 6,
                    color: "#666",
                    padding: "8px 16px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Ver expedientes
                </button>
              </div>
            ) : (() => {
              const pct = porcentaje(expedienteActual.items);
              const { label, color } = statusInfo(pct);

              const itemsPorCategoria = CATEGORIAS_ORDER.reduce<Record<CategoriaDoc, DocItem[]>>(
                (acc, cat) => {
                  acc[cat] = expedienteActual.items.filter((i) => i.categoria === cat);
                  return acc;
                },
                {
                  vendedor: [],
                  comprador: [],
                  propiedad: [],
                  banco: [],
                  "escribanía": [],
                }
              );

              return (
                <div>
                  {/* Header expediente */}
                  <div
                    style={{
                      background: "#111111",
                      border: "1px solid #222222",
                      borderRadius: 10,
                      padding: "20px",
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h2
                            style={{
                              margin: 0,
                              fontSize: 18,
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 800,
                              color: "#e0e0e0",
                            }}
                          >
                            {expedienteActual.nombre}
                          </h2>
                          <span
                            style={{
                              background: `${TIPO_COLORS[expedienteActual.tipo]}20`,
                              color: TIPO_COLORS[expedienteActual.tipo],
                              border: `1px solid ${TIPO_COLORS[expedienteActual.tipo]}40`,
                              borderRadius: 4,
                              fontSize: 10,
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 700,
                              padding: "3px 9px",
                            }}
                          >
                            {TIPO_LABELS[expedienteActual.tipo]}
                          </span>
                        </div>
                        {expedienteActual.contacto && (
                          <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                            Contacto: {expedienteActual.contacto}
                          </div>
                        )}
                        {expedienteActual.propiedad && (
                          <div style={{ fontSize: 12, color: "#666" }}>
                            {expedienteActual.propiedad}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => setMostrarModalDoc(true)}
                          style={{
                            background: "rgba(59,130,246,0.12)",
                            border: "1px solid rgba(59,130,246,0.3)",
                            borderRadius: 7,
                            color: "#60a5fa",
                            padding: "8px 14px",
                            fontSize: 11,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          + Agregar documento
                        </button>
                        {expedienteActual.estado !== "archivado" && (
                          <button
                            onClick={handleArchivar}
                            style={{
                              background: "rgba(107,114,128,0.1)",
                              border: "1px solid #333",
                              borderRadius: 7,
                              color: "#666",
                              padding: "8px 14px",
                              fontSize: 11,
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Archivar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barra de progreso grande */}
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#888" }}>
                          {expedienteActual.items.filter((i) => i.obtenido).length} de{" "}
                          {expedienteActual.items.length} documentos obtenidos
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 800,
                            color,
                          }}
                        >
                          {statusEmoji(pct)} {label} · {pct}%
                        </span>
                      </div>
                      <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: color,
                            borderRadius: 4,
                            transition: "width 0.3s",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Items por categoría */}
                  {CATEGORIAS_ORDER.map((cat) => {
                    const items = itemsPorCategoria[cat];
                    if (items.length === 0) return null;
                    return (
                      <div key={cat} style={{ marginBottom: 20 }}>
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 800,
                            color: "#cc0000",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            marginBottom: 8,
                          }}
                        >
                          {CATEGORIA_LABELS[cat]}
                          <span style={{ marginLeft: 8, color: "#555", fontWeight: 700 }}>
                            ({items.filter((i) => i.obtenido).length}/{items.length})
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {items.map((item) => {
                            const dias = item.vencimiento ? diffDias(item.vencimiento) : null;
                            const vencido = dias !== null && dias < 0;
                            const proximoVencer = dias !== null && dias >= 0 && dias <= 7;
                            let borderColor = "#222222";
                            if (!item.obtenido && vencido) borderColor = "#cc0000";
                            else if (!item.obtenido && proximoVencer) borderColor = "#f97316";

                            return (
                              <div
                                key={item.id}
                                style={{
                                  background: "#111111",
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: 8,
                                  padding: "12px 14px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                  {/* Checkbox */}
                                  <button
                                    onClick={() => handleToggleItem(item.id)}
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 5,
                                      flexShrink: 0,
                                      marginTop: 1,
                                      border: `2px solid ${item.obtenido ? "#22c55e" : item.requerido ? "#cc0000" : "#444"}`,
                                      background: item.obtenido ? "#22c55e" : "transparent",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    {item.obtenido && (
                                      <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>
                                    )}
                                  </button>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                      <span
                                        style={{
                                          fontSize: 13,
                                          color: item.obtenido ? "#555" : "#e0e0e0",
                                          textDecoration: item.obtenido ? "line-through" : "none",
                                        }}
                                      >
                                        {item.nombre}
                                      </span>

                                      {item.requerido ? (
                                        <span
                                          style={{
                                            fontSize: 9,
                                            fontFamily: "Montserrat, sans-serif",
                                            fontWeight: 700,
                                            color: "#cc0000",
                                            background: "rgba(204,0,0,0.12)",
                                            border: "1px solid rgba(204,0,0,0.25)",
                                            borderRadius: 3,
                                            padding: "1px 5px",
                                          }}
                                        >
                                          REQUERIDO
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: 9,
                                            fontFamily: "Montserrat, sans-serif",
                                            fontWeight: 700,
                                            color: "#555",
                                            background: "rgba(85,85,85,0.1)",
                                            border: "1px solid #333",
                                            borderRadius: 3,
                                            padding: "1px 5px",
                                          }}
                                        >
                                          OPCIONAL
                                        </span>
                                      )}

                                      {item.vencimiento && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            color: vencido ? "#cc0000" : proximoVencer ? "#f97316" : "#666",
                                            fontFamily: "Montserrat, sans-serif",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {vencido
                                            ? `⚠ Vencido (${formatFecha(item.vencimiento)})`
                                            : proximoVencer
                                            ? `⏰ Vence en ${dias} día${dias === 1 ? "" : "s"}`
                                            : `Vence: ${formatFecha(item.vencimiento)}`}
                                        </span>
                                      )}
                                    </div>

                                    {/* Notas */}
                                    {editandoNotaId === item.id ? (
                                      <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                                        <input
                                          autoFocus
                                          value={notaTemp}
                                          onChange={(e) => setNotaTemp(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleGuardarNota(item.id);
                                            if (e.key === "Escape") {
                                              setEditandoNotaId(null);
                                              setNotaTemp("");
                                            }
                                          }}
                                          onBlur={() => handleGuardarNota(item.id)}
                                          style={{
                                            flex: 1,
                                            background: "#0a0a0a",
                                            border: "1px solid #333",
                                            borderRadius: 5,
                                            color: "#e0e0e0",
                                            padding: "5px 10px",
                                            fontSize: 12,
                                            fontFamily: "Inter, sans-serif",
                                            outline: "none",
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                                        {item.notas && (
                                          <span style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
                                            {item.notas}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => {
                                            setEditandoNotaId(item.id);
                                            setNotaTemp(item.notas);
                                          }}
                                          style={{
                                            fontSize: 10,
                                            color: "#444",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: 0,
                                            fontFamily: "Inter, sans-serif",
                                          }}
                                        >
                                          {item.notas ? "✏ editar nota" : "+ nota"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── TAB 3: Estadísticas ─────────────────────────────────────────────── */}
        {tabActiva === "estadisticas" && (
          <div>
            {/* Cards resumen */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 14,
                marginBottom: 28,
              }}
            >
              {[
                {
                  label: "Expedientes activos",
                  value: stats.totalActivos,
                  color: "#3b82f6",
                  icon: "📁",
                },
                {
                  label: "Completitud promedio",
                  value: `${stats.promedioCompletitud}%`,
                  color: stats.promedioCompletitud >= 75 ? "#22c55e" : stats.promedioCompletitud >= 50 ? "#f59e0b" : "#cc0000",
                  icon: "📊",
                },
                {
                  label: "Con documentos vencidos",
                  value: stats.conVencidos,
                  color: stats.conVencidos === 0 ? "#22c55e" : "#cc0000",
                  icon: "⚠️",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: "#111111",
                    border: "1px solid #222222",
                    borderRadius: 10,
                    padding: "18px 20px",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      color: card.color,
                    }}
                  >
                    {card.value}
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    {card.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Gráfico de barras SVG */}
            <div
              style={{
                background: "#111111",
                border: "1px solid #222222",
                borderRadius: 10,
                padding: "20px",
                marginBottom: 24,
              }}
            >
              <h3
                style={{
                  margin: "0 0 20px",
                  fontSize: 13,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  color: "#e0e0e0",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Completitud promedio por tipo de operación
              </h3>

              {(["venta", "alquiler", "alquiler_temporal", "hipoteca"] as TipoExpediente[]).map((tipo) => {
                const val = stats.promPorTipo[tipo];
                const barColor = val >= 75 ? "#22c55e" : val >= 50 ? "#f59e0b" : val > 0 ? "#cc0000" : "#2a2a2a";
                return (
                  <div key={tipo} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "#ccc",
                          fontFamily: "Inter, sans-serif",
                          minWidth: 140,
                        }}
                      >
                        {TIPO_LABELS[tipo]}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          color: val > 0 ? barColor : "#444",
                        }}
                      >
                        {val > 0 ? `${val}%` : "Sin datos"}
                      </span>
                    </div>
                    <div style={{ height: 10, background: "#1a1a1a", borderRadius: 5, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${val}%`,
                          background: barColor,
                          borderRadius: 5,
                          transition: "width 0.4s",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top documentos faltantes */}
            <div
              style={{
                background: "#111111",
                border: "1px solid #222222",
                borderRadius: 10,
                padding: "20px",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  color: "#e0e0e0",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Documentos más frecuentemente pendientes
              </h3>

              {stats.topFaltantes.length === 0 ? (
                <div style={{ fontSize: 13, color: "#555", textAlign: "center", padding: "20px 0" }}>
                  No hay documentos pendientes.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stats.topFaltantes.map(([nombre, count], idx) => (
                    <div
                      key={nombre}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        background: "#0a0a0a",
                        borderRadius: 6,
                        border: "1px solid #1a1a1a",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 800,
                          color: "#444",
                          minWidth: 20,
                          textAlign: "center",
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: "#ccc" }}>{nombre}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          color: "#cc0000",
                          background: "rgba(204,0,0,0.1)",
                          border: "1px solid rgba(204,0,0,0.2)",
                          borderRadius: 4,
                          padding: "2px 8px",
                        }}
                      >
                        {count} exp.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {mostrarModalNuevo && (
        <ModalNuevoExpediente
          onClose={() => setMostrarModalNuevo(false)}
          onSave={handleNuevoExpediente}
        />
      )}
      {mostrarModalDoc && expSeleccionado && (
        <ModalAgregarDoc
          onClose={() => setMostrarModalDoc(false)}
          onSave={handleAgregarDoc}
        />
      )}
    </div>
  );
}
