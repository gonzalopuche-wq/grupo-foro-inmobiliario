"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type RolParticipante = "captador" | "vendedor" | "gerente" | "referido" | "otro";
type TipoOperacion = "venta" | "alquiler" | "alquiler_temporal";
type EstadoOperacion = "pendiente" | "cobrada_parcial" | "cobrada";

interface Participante {
  id: string;
  nombre: string;
  rol: RolParticipante;
  porcentaje: number;
  monto_usd: number;
  cobrado: boolean;
  fecha_cobro: string | null;
}

interface OperacionSplit {
  id: string;
  descripcion: string;
  tipo: TipoOperacion;
  valor_operacion: number;
  moneda: string;
  comision_total_pct: number;
  comision_total_usd: number;
  participantes: Participante[];
  estado: EstadoOperacion;
  fecha: string;
  notas: string;
  created_at: string;
}

// ── Colores ───────────────────────────────────────────────────────────────────

const C = {
  bg: "#0a0a0a",
  card: "#111111",
  border: "#222222",
  red: "#990000",
  redLight: "#ff2222",
  text: "#e0e0e0",
  muted: "#888888",
  green: "#3abab6",
  yellow: "#d4960c",
  blue: "#3b82f6",
  purple: "#a855f7",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const hoy = () => new Date().toISOString().slice(0, 10);

const fmtUSD = (n: number) =>
  `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtARS = (n: number) =>
  `$ ${Math.round(n).toLocaleString("es-AR")}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const ROL_LABELS: Record<RolParticipante, string> = {
  captador: "Captador",
  vendedor: "Vendedor",
  gerente: "Gerente",
  referido: "Referido",
  otro: "Otro",
};

const TIPO_LABELS: Record<TipoOperacion, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporal: "Alq. Temporal",
};

const TIPO_COLORS: Record<TipoOperacion, string> = {
  venta: C.red,
  alquiler: C.blue,
  alquiler_temporal: C.purple,
};

const ESTADO_LABELS: Record<EstadoOperacion, string> = {
  pendiente: "Pendiente",
  cobrada_parcial: "Cobrada parcial",
  cobrada: "Cobrada",
};

const ESTADO_COLORS: Record<EstadoOperacion, string> = {
  pendiente: C.yellow,
  cobrada_parcial: C.blue,
  cobrada: C.green,
};

const MESES_NOMBRES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function calcularEstado(op: OperacionSplit): EstadoOperacion {
  const todos = op.participantes.every(p => p.cobrado);
  const alguno = op.participantes.some(p => p.cobrado);
  if (todos) return "cobrada";
  if (alguno) return "cobrada_parcial";
  return "pendiente";
}

function recalcularMontos(participantes: Participante[], comisionTotal: number): Participante[] {
  return participantes.map(p => ({
    ...p,
    monto_usd: (p.porcentaje / 100) * comisionTotal,
  }));
}

// ── Datos de ejemplo ──────────────────────────────────────────────────────────

function generarEjemplos(): OperacionSplit[] {
  const op1: OperacionSplit = {
    id: genId(),
    descripcion: "Venta Dto. Alberdi - García",
    tipo: "venta",
    valor_operacion: 85000,
    moneda: "USD",
    comision_total_pct: 3,
    comision_total_usd: 2550,
    participantes: [
      { id: genId(), nombre: "Carlos Méndez", rol: "captador", porcentaje: 40, monto_usd: 1020, cobrado: true, fecha_cobro: "2026-03-15" },
      { id: genId(), nombre: "Ana Rodríguez", rol: "vendedor", porcentaje: 40, monto_usd: 1020, cobrado: true, fecha_cobro: "2026-03-15" },
      { id: genId(), nombre: "Roberto Silva", rol: "gerente", porcentaje: 20, monto_usd: 510, cobrado: true, fecha_cobro: "2026-03-15" },
    ],
    estado: "cobrada",
    fecha: "2026-03-10",
    notas: "Operación cerrada en tiempo récord.",
    created_at: "2026-03-01T10:00:00Z",
  };

  const op2: OperacionSplit = {
    id: genId(),
    descripcion: "Alquiler Local Pichincha - Martínez",
    tipo: "alquiler",
    valor_operacion: 800,
    moneda: "USD",
    comision_total_pct: 100,
    comision_total_usd: 800,
    participantes: [
      { id: genId(), nombre: "Lucía Fernández", rol: "captador", porcentaje: 50, monto_usd: 400, cobrado: true, fecha_cobro: "2026-04-05" },
      { id: genId(), nombre: "Marcos Torres", rol: "vendedor", porcentaje: 50, monto_usd: 400, cobrado: false, fecha_cobro: null },
    ],
    estado: "cobrada_parcial",
    fecha: "2026-04-01",
    notas: "Comisión equivale a 1 mes de alquiler.",
    created_at: "2026-04-01T09:00:00Z",
  };

  const op3: OperacionSplit = {
    id: genId(),
    descripcion: "Venta Casa Fisherton - López",
    tipo: "venta",
    valor_operacion: 120000,
    moneda: "USD",
    comision_total_pct: 3,
    comision_total_usd: 3600,
    participantes: [
      { id: genId(), nombre: "Carlos Méndez", rol: "captador", porcentaje: 35, monto_usd: 1260, cobrado: false, fecha_cobro: null },
      { id: genId(), nombre: "Sofía Gómez", rol: "vendedor", porcentaje: 35, monto_usd: 1260, cobrado: false, fecha_cobro: null },
      { id: genId(), nombre: "Roberto Silva", rol: "gerente", porcentaje: 20, monto_usd: 720, cobrado: false, fecha_cobro: null },
      { id: genId(), nombre: "Javier Paz", rol: "referido", porcentaje: 10, monto_usd: 360, cobrado: false, fecha_cobro: null },
    ],
    estado: "pendiente",
    fecha: "2026-05-10",
    notas: "Escritura programada para fin de mes.",
    created_at: "2026-05-10T11:00:00Z",
  };

  return [op1, op2, op3];
}


// ── Draft inicial ─────────────────────────────────────────────────────────────

function draftVacio(): OperacionSplit {
  return {
    id: "",
    descripcion: "",
    tipo: "venta",
    valor_operacion: 0,
    moneda: "USD",
    comision_total_pct: 3,
    comision_total_usd: 0,
    participantes: [],
    estado: "pendiente",
    fecha: hoy(),
    notas: "",
    created_at: new Date().toISOString(),
  };
}

function participanteVacio(): Participante {
  return { id: genId(), nombre: "", rol: "vendedor", porcentaje: 0, monto_usd: 0, cobrado: false, fecha_cobro: null };
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const s = {
  input: {
    background: "#1a1a1a",
    border: `1px solid ${C.border}`,
    color: C.text,
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  label: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 4,
    display: "block" as const,
  },
  btn: (color = C.red, full = false) => ({
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    width: full ? "100%" : "auto",
    whiteSpace: "nowrap" as const,
  }),
  btnOutline: (color = C.border) => ({
    background: "transparent",
    color: C.text,
    border: `1px solid ${color}`,
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    whiteSpace: "nowrap" as const,
  }),
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 20,
  },
  badge: (color: string) => ({
    background: color + "22",
    color: color,
    border: `1px solid ${color}44`,
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 600,
    display: "inline-block",
  }),
};

// ── Modal de edición ──────────────────────────────────────────────────────────

interface ModalEditarProps {
  op: OperacionSplit;
  tc: number;
  onGuardar: (op: OperacionSplit) => void;
  onCerrar: () => void;
}

function ModalEditar({ op, tc, onGuardar, onCerrar }: ModalEditarProps) {
  const [draft, setDraft] = useState<OperacionSplit>(() => ({
    ...op,
    participantes: op.participantes.map(p => ({ ...p })),
  }));

  const totalPct = draft.participantes.reduce((s, p) => s + p.porcentaje, 0);
  const comisionCalc = (draft.valor_operacion * draft.comision_total_pct) / 100;

  const actualizar = (campo: keyof OperacionSplit, valor: OperacionSplit[keyof OperacionSplit]) => {
    setDraft(d => {
      const nuevo = { ...d, [campo]: valor };
      const com = (nuevo.valor_operacion * nuevo.comision_total_pct) / 100;
      nuevo.comision_total_usd = com;
      nuevo.participantes = recalcularMontos(nuevo.participantes, com);
      return nuevo;
    });
  };

  const actualizarParticipante = (idx: number, campo: keyof Participante, valor: Participante[keyof Participante]) => {
    setDraft(d => {
      const parts = d.participantes.map((p, i) => i === idx ? { ...p, [campo]: valor } : p);
      const partsCalc = recalcularMontos(parts, d.comision_total_usd);
      return { ...d, participantes: partsCalc };
    });
  };

  const agregarParticipante = () => {
    setDraft(d => ({ ...d, participantes: [...d.participantes, participanteVacio()] }));
  };

  const eliminarParticipante = (idx: number) => {
    setDraft(d => ({ ...d, participantes: d.participantes.filter((_, i) => i !== idx) }));
  };

  const guardar = () => {
    if (!draft.descripcion.trim() || draft.valor_operacion <= 0) return;
    onGuardar({ ...draft, estado: calcularEstado(draft) });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: C.text }}>Editar Operación</h2>
          <button onClick={onCerrar} style={{ ...s.btnOutline(), padding: "6px 12px" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={s.label}>Descripción</label>
            <input style={s.input} value={draft.descripcion} onChange={e => setDraft(d => ({ ...d, descripcion: e.target.value }))} />
          </div>
          <div>
            <label style={s.label}>Tipo</label>
            <select style={s.input} value={draft.tipo} onChange={e => setDraft(d => ({ ...d, tipo: e.target.value as TipoOperacion }))}>
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
              <option value="alquiler_temporal">Alquiler Temporal</option>
            </select>
          </div>
          <div>
            <label style={s.label}>Fecha</label>
            <input style={s.input} type="date" value={draft.fecha} onChange={e => setDraft(d => ({ ...d, fecha: e.target.value }))} />
          </div>
          <div>
            <label style={s.label}>Valor operación (USD)</label>
            <input style={s.input} type="number" value={draft.valor_operacion || ""} onChange={e => actualizar("valor_operacion", parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label style={s.label}>Comisión total (%)</label>
            <input style={s.input} type="number" step="0.1" value={draft.comision_total_pct || ""} onChange={e => actualizar("comision_total_pct", parseFloat(e.target.value) || 0)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={s.label}>Notas</label>
            <input style={s.input} value={draft.notas} onChange={e => setDraft(d => ({ ...d, notas: e.target.value }))} />
          </div>
        </div>

        <div style={{ background: "var(--gfi-bg-primary)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: C.muted }}>Comisión total calculada</p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.red, fontFamily: "var(--font-display)" }}>{fmtUSD(comisionCalc)}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: C.muted }}>{fmtARS(comisionCalc * tc)}</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: C.text }}>Participantes</h3>
          <span style={{ fontSize: 13, color: totalPct === 100 ? C.green : C.red, fontWeight: 600 }}>Total: {fmtPct(totalPct)} {totalPct !== 100 && "⚠ debe ser 100%"}</span>
        </div>

        {draft.participantes.map((p, i) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <div>
              {i === 0 && <label style={s.label}>Nombre</label>}
              <input style={s.input} placeholder="Nombre" value={p.nombre} onChange={e => actualizarParticipante(i, "nombre", e.target.value)} />
            </div>
            <div>
              {i === 0 && <label style={s.label}>Rol</label>}
              <select style={s.input} value={p.rol} onChange={e => actualizarParticipante(i, "rol", e.target.value as RolParticipante)}>
                {(Object.keys(ROL_LABELS) as RolParticipante[]).map(r => (
                  <option key={r} value={r}>{ROL_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              {i === 0 && <label style={s.label}>% comisión</label>}
              <input style={s.input} type="number" step="0.1" placeholder="%" value={p.porcentaje || ""} onChange={e => actualizarParticipante(i, "porcentaje", parseFloat(e.target.value) || 0)} />
            </div>
            <button onClick={() => eliminarParticipante(i)} style={{ ...s.btnOutline(C.red), padding: "8px 10px", marginTop: i === 0 ? 16 : 0 }}>✕</button>
          </div>
        ))}

        <button onClick={agregarParticipante} style={{ ...s.btnOutline(), marginBottom: 20 }}>+ Agregar participante</button>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCerrar} style={s.btnOutline()}>Cancelar</button>
          <button onClick={guardar} style={s.btn()}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ComisionesSplitPage() {
  const [operaciones, setOperaciones] = useState<OperacionSplit[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"nueva" | "historial" | "resumen">("nueva");
  const [tc, setTc] = useState(1280);
  const [editModal, setEditModal] = useState<OperacionSplit | null>(null);

  // Form de nueva operación
  const [draft, setDraft] = useState<OperacionSplit>(draftVacio);
  const [retencion, setRetencion] = useState<"monotributo" | "ri">("monotributo");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      const { data: row } = await supabase
        .from("crm_comisiones_split")
        .select("operaciones")
        .eq("perfil_id", userId)
        .maybeSingle();
      if (row?.operaciones && Array.isArray(row.operaciones) && row.operaciones.length > 0) {
        setOperaciones(row.operaciones as OperacionSplit[]);
      }
      setLoading(false);
    });
  }, []);

  const guardarSB = useCallback(async (ops: OperacionSplit[]) => {
    if (!uid) return;
    await supabase.from("crm_comisiones_split").upsert(
      { perfil_id: uid, operaciones: ops, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id" }
    );
  }, [uid]);

  const persistir = useCallback((ops: OperacionSplit[]) => {
    setOperaciones(ops);
    guardarSB(ops);
  }, [guardarSB]);

  // ── Actualizar comisión al cambiar valor u operación ──────────────────────

  const actualizarDraft = (campo: keyof OperacionSplit, valor: OperacionSplit[keyof OperacionSplit]) => {
    setDraft(d => {
      const nuevo = { ...d, [campo]: valor };
      const com = (nuevo.valor_operacion * nuevo.comision_total_pct) / 100;
      nuevo.comision_total_usd = com;
      nuevo.participantes = recalcularMontos(nuevo.participantes, com);
      return nuevo;
    });
  };

  const actualizarParticipante = (idx: number, campo: keyof Participante, valor: Participante[keyof Participante]) => {
    setDraft(d => {
      const parts = d.participantes.map((p, i) => i === idx ? { ...p, [campo]: valor } : p);
      const partsCalc = recalcularMontos(parts, d.comision_total_usd);
      return { ...d, participantes: partsCalc };
    });
  };

  const agregarParticipante = () => {
    setDraft(d => ({ ...d, participantes: [...d.participantes, participanteVacio()] }));
  };

  const eliminarParticipanteForm = (idx: number) => {
    setDraft(d => ({ ...d, participantes: d.participantes.filter((_, i) => i !== idx) }));
  };

  const distribuirEquitativamente = () => {
    setDraft(d => {
      if (d.participantes.length === 0) return d;
      const pct = 100 / d.participantes.length;
      const parts = d.participantes.map(p => ({ ...p, porcentaje: parseFloat(pct.toFixed(2)) }));
      return { ...d, participantes: recalcularMontos(parts, d.comision_total_usd) };
    });
  };

  const presetTipico = () => {
    setDraft(d => {
      const base = [
        { id: genId(), nombre: "", rol: "captador" as RolParticipante, porcentaje: 40, monto_usd: 0, cobrado: false, fecha_cobro: null },
        { id: genId(), nombre: "", rol: "vendedor" as RolParticipante, porcentaje: 40, monto_usd: 0, cobrado: false, fecha_cobro: null },
        { id: genId(), nombre: "", rol: "gerente" as RolParticipante, porcentaje: 20, monto_usd: 0, cobrado: false, fecha_cobro: null },
      ];
      return { ...d, participantes: recalcularMontos(base, d.comision_total_usd) };
    });
  };

  const guardarOperacion = () => {
    if (!draft.descripcion.trim() || draft.valor_operacion <= 0) return;
    const nueva: OperacionSplit = {
      ...draft,
      id: genId(),
      estado: calcularEstado(draft),
      created_at: new Date().toISOString(),
    };
    persistir([nueva, ...operaciones]);
    setDraft(draftVacio());
  };

  // ── Historial: filtros ────────────────────────────────────────────────────

  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoOperacion>("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoOperacion>("todos");
  const [filtroAnio, setFiltroAnio] = useState<string>("todos");

  const aniosDisponibles = useMemo(() => {
    const set = new Set(operaciones.map(o => o.fecha.slice(0, 4)));
    return Array.from(set).sort().reverse();
  }, [operaciones]);

  const opsFiltradas = useMemo(() => {
    return operaciones.filter(o => {
      if (filtroTipo !== "todos" && o.tipo !== filtroTipo) return false;
      if (filtroEstado !== "todos" && o.estado !== filtroEstado) return false;
      if (filtroAnio !== "todos" && o.fecha.slice(0, 4) !== filtroAnio) return false;
      return true;
    });
  }, [operaciones, filtroTipo, filtroEstado, filtroAnio]);

  const marcarCobradoParticipante = (opId: string, pIdx: number, cobrado: boolean) => {
    const ops = operaciones.map(o => {
      if (o.id !== opId) return o;
      const parts = o.participantes.map((p, i) =>
        i === pIdx ? { ...p, cobrado, fecha_cobro: cobrado ? hoy() : null } : p
      );
      return { ...o, participantes: parts, estado: calcularEstado({ ...o, participantes: parts }) };
    });
    persistir(ops);
  };

  const marcarTodaCobrada = (opId: string) => {
    const ops = operaciones.map(o => {
      if (o.id !== opId) return o;
      const parts = o.participantes.map(p => ({ ...p, cobrado: true, fecha_cobro: p.fecha_cobro ?? hoy() }));
      return { ...o, participantes: parts, estado: "cobrada" as EstadoOperacion };
    });
    persistir(ops);
  };

  const duplicarOperacion = (op: OperacionSplit) => {
    const nueva: OperacionSplit = {
      ...op,
      id: genId(),
      fecha: hoy(),
      estado: "pendiente",
      created_at: new Date().toISOString(),
      participantes: op.participantes.map(p => ({ ...p, id: genId(), cobrado: false, fecha_cobro: null })),
    };
    persistir([nueva, ...operaciones]);
    setTab("historial");
  };

  const guardarEdicion = (op: OperacionSplit) => {
    persistir(operaciones.map(o => o.id === op.id ? op : o));
    setEditModal(null);
  };

  // ── Resumen financiero ────────────────────────────────────────────────────

  const anioActual = new Date().getFullYear().toString();

  const opsAnio = useMemo(() =>
    operaciones.filter(o => o.fecha.startsWith(anioActual)),
    [operaciones, anioActual]
  );

  const kpis = useMemo(() => {
    let cobradas = 0, pendiente = 0;
    opsAnio.forEach(o => {
      o.participantes.forEach(p => {
        if (p.cobrado) cobradas += p.monto_usd;
        else pendiente += p.monto_usd;
      });
    });
    const promedio = opsAnio.length > 0
      ? opsAnio.reduce((s, o) => s + o.comision_total_usd, 0) / opsAnio.length
      : 0;

    // Participante con mayor volumen
    const volumen: Record<string, number> = {};
    opsAnio.forEach(o => {
      o.participantes.forEach(p => {
        if (p.nombre) volumen[p.nombre] = (volumen[p.nombre] ?? 0) + p.monto_usd;
      });
    });
    const top = Object.entries(volumen).sort((a, b) => b[1] - a[1])[0];

    return { cobradas, pendiente, promedio, topNombre: top?.[0] ?? "", topMonto: top?.[1] ?? 0 };
  }, [opsAnio]);

  // Barras por mes
  const barrasData = useMemo(() => {
    const por_mes: Record<number, number> = {};
    opsAnio.forEach(o => {
      const mes = parseInt(o.fecha.slice(5, 7)) - 1;
      o.participantes.forEach(p => {
        if (p.cobrado) por_mes[mes] = (por_mes[mes] ?? 0) + p.monto_usd;
      });
    });
    const vals = Array.from({ length: 12 }, (_, i) => por_mes[i] ?? 0);
    const max = Math.max(...vals, 1);
    return { vals, max };
  }, [opsAnio]);

  // Donut por tipo
  const donutData = useMemo(() => {
    const por_tipo: Record<TipoOperacion, number> = { venta: 0, alquiler: 0, alquiler_temporal: 0 };
    opsAnio.forEach(o => { por_tipo[o.tipo] += o.comision_total_usd; });
    const total = Object.values(por_tipo).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(por_tipo).map(([tipo, val]) => ({
      tipo: tipo as TipoOperacion,
      val,
      pct: val / total,
    }));
  }, [opsAnio]);

  // Tabla participantes
  const tablaParticipantes = useMemo(() => {
    const map: Record<string, { ops: number; cobrado: number; pendiente: number }> = {};
    opsAnio.forEach(o => {
      o.participantes.forEach(p => {
        if (!p.nombre) return;
        if (!map[p.nombre]) map[p.nombre] = { ops: 0, cobrado: 0, pendiente: 0 };
        map[p.nombre].ops += 1;
        if (p.cobrado) map[p.nombre].cobrado += p.monto_usd;
        else map[p.nombre].pendiente += p.monto_usd;
      });
    });
    return Object.entries(map).sort((a, b) => (b[1].cobrado + b[1].pendiente) - (a[1].cobrado + a[1].pendiente));
  }, [opsAnio]);

  // ── Cálculos del formulario ───────────────────────────────────────────────

  const totalPct = draft.participantes.reduce((s, p) => s + p.porcentaje, 0);
  const comisionCalc = (draft.valor_operacion * draft.comision_total_pct) / 100;
  const miParticipacion = draft.participantes[0]?.monto_usd ?? 0;
  const retencionPct = retencion === "ri" ? 0.21 : 0;
  const miParticipacionNeta = miParticipacion * (1 - retencionPct);

  // ── Donut SVG ─────────────────────────────────────────────────────────────

  function DonutSVG() {
    const r = 70, cx = 90, cy = 90, stroke = 20;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    const tipos = donutData.filter(d => d.val > 0);
    if (tipos.length === 0) {
      return (
        <svg width={200} height={200} viewBox="0 0 180 180">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
          <text x={cx} y={cy + 5} textAnchor="middle" fill={C.muted} fontSize={12}>Sin datos</text>
        </svg>
      );
    }
    const arcos = tipos.map(d => {
      const dashArray = circumference * d.pct;
      const dashOffset = circumference - offset * circumference / (2 * Math.PI * r);
      const arc = { ...d, dashArray, startOffset: offset };
      offset += d.pct;
      return arc;
    });
    return (
      <svg width={200} height={200} viewBox="0 0 180 180">
        {arcos.map((a, i) => {
          const start = a.startOffset * 2 * Math.PI * r;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={TIPO_COLORS[a.tipo]}
              strokeWidth={stroke}
              strokeDasharray={`${a.dashArray * circumference} ${circumference}`}
              strokeDashoffset={-start + circumference * 0.25}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "all 0.3s" }}
            />
          );
        })}
        <text x={cx} y={cy - 8} textAnchor="middle" fill={C.text} fontSize={11} fontWeight="600">Total</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill={C.red} fontSize={12} fontWeight="700">
          {fmtUSD(donutData.reduce((s, d) => s + d.val, 0))}
        </text>
      </svg>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ background: C.bg, minHeight: "100vh", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>Cargando...</div>;
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "Inter, sans-serif", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 28px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, margin: "0 0 4px", color: C.text }}>
          Comisiones & Split
        </h1>
        <p style={{ margin: "0 0 20px", color: C.muted, fontSize: 14 }}>Calculadora y registro de divisiones entre agentes</p>

        {/* TC */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: C.muted }}>Tipo de cambio USD/ARS:</span>
          <input
            type="number"
            value={tc}
            onChange={e => setTc(parseFloat(e.target.value) || 1)}
            style={{ ...s.input, width: 100 }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>
          {(["nueva", "historial", "resumen"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? C.card : "transparent",
                color: tab === t ? C.text : C.muted,
                border: `1px solid ${tab === t ? C.border : "transparent"}`,
                borderBottom: tab === t ? `1px solid ${C.card}` : "1px solid transparent",
                borderRadius: "6px 6px 0 0",
                padding: "9px 20px",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                fontWeight: tab === t ? 600 : 400,
              }}
            >
              {t === "nueva" ? "Nueva operación" : t === "historial" ? "Historial" : "Resumen financiero"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1 — NUEVA OPERACIÓN
        ═══════════════════════════════════════════════════════════════ */}
        {tab === "nueva" && (
          <div>
            <div style={s.card}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, margin: "0 0 20px", color: C.text }}>Datos de la operación</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={s.label}>Descripción *</label>
                  <input
                    style={s.input}
                    placeholder="Ej: Venta Dto. Pichincha - López"
                    value={draft.descripcion}
                    onChange={e => setDraft(d => ({ ...d, descripcion: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={s.label}>Tipo de operación</label>
                  <select style={s.input} value={draft.tipo} onChange={e => setDraft(d => ({ ...d, tipo: e.target.value as TipoOperacion }))}>
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                    <option value="alquiler_temporal">Alquiler Temporal</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Fecha</label>
                  <input style={s.input} type="date" value={draft.fecha} onChange={e => setDraft(d => ({ ...d, fecha: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>Valor de operación (USD) *</label>
                  <input
                    style={s.input}
                    type="number"
                    placeholder="Ej: 85000"
                    value={draft.valor_operacion || ""}
                    onChange={e => actualizarDraft("valor_operacion", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label style={s.label}>Comisión total (%)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      style={{ ...s.input, flex: 1 }}
                      type="number"
                      step="0.1"
                      placeholder="3"
                      value={draft.comision_total_pct || ""}
                      onChange={e => actualizarDraft("comision_total_pct", parseFloat(e.target.value) || 0)}
                    />
                    <button
                      onClick={() => actualizarDraft("comision_total_pct", draft.comision_total_pct)}
                      style={s.btn(C.border.replace("#222", "#333"))}
                    >
                      Calcular
                    </button>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={s.label}>Notas</label>
                  <input style={s.input} placeholder="Observaciones..." value={draft.notas} onChange={e => setDraft(d => ({ ...d, notas: e.target.value }))} />
                </div>
              </div>

              {/* Preview comisión */}
              {comisionCalc > 0 && (
                <div style={{ background: "var(--gfi-bg-primary)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, color: C.muted }}>Comisión total ({fmtPct(draft.comision_total_pct)} sobre {fmtUSD(draft.valor_operacion)})</p>
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.red, fontFamily: "var(--font-display)" }}>{fmtUSD(comisionCalc)}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: C.muted }}>{fmtARS(comisionCalc * tc)}</p>
                </div>
              )}

              {/* Participantes */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, margin: 0, color: C.text }}>Participantes</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={presetTipico} style={s.btnOutline()}>Preset típico (40/40/20)</button>
                  <button onClick={distribuirEquitativamente} style={s.btnOutline()}>Distribuir equitativamente</button>
                  <button onClick={agregarParticipante} style={s.btn()}>+ Participante</button>
                </div>
              </div>

              {draft.participantes.length === 0 && (
                <p style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>No hay participantes. Agregá uno o usá el preset típico.</p>
              )}

              {draft.participantes.map((p, i) => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                  <div>
                    {i === 0 && <label style={s.label}>Nombre</label>}
                    <input style={s.input} placeholder="Nombre del agente" value={p.nombre} onChange={e => actualizarParticipante(i, "nombre", e.target.value)} />
                  </div>
                  <div>
                    {i === 0 && <label style={s.label}>Rol</label>}
                    <select style={s.input} value={p.rol} onChange={e => actualizarParticipante(i, "rol", e.target.value as RolParticipante)}>
                      {(Object.keys(ROL_LABELS) as RolParticipante[]).map(r => (
                        <option key={r} value={r}>{ROL_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    {i === 0 && <label style={s.label}>% comisión</label>}
                    <input
                      style={{ ...s.input, borderColor: totalPct !== 100 && draft.participantes.length > 0 ? C.red : C.border }}
                      type="number"
                      step="0.1"
                      placeholder="%"
                      value={p.porcentaje || ""}
                      onChange={e => actualizarParticipante(i, "porcentaje", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    {i === 0 && <label style={s.label}>Monto</label>}
                    <div style={{ ...s.input, color: C.red, fontWeight: 600, display: "flex", alignItems: "center" }}>
                      {fmtUSD(p.monto_usd)}
                    </div>
                  </div>
                  <button
                    onClick={() => eliminarParticipanteForm(i)}
                    style={{ ...s.btnOutline(C.red), padding: "8px 10px", marginTop: i === 0 ? 16 : 0 }}
                  >✕</button>
                </div>
              ))}

              {draft.participantes.length > 0 && (
                <div style={{ textAlign: "right", marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: totalPct === 100 ? C.green : C.red, fontWeight: 600 }}>
                    Total asignado: {fmtPct(totalPct)} {totalPct !== 100 && "— debe sumar 100%"}
                  </span>
                </div>
              )}

              {/* Preview por participante */}
              {draft.participantes.some(p => p.monto_usd > 0) && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: C.muted, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 1 }}>Preview de cobros</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                    {draft.participantes.filter(p => p.nombre).map(p => (
                      <div key={p.id} style={{ background: "var(--gfi-bg-primary)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                        <p style={{ margin: "0 0 2px", fontSize: 12, color: C.muted }}>{p.nombre}</p>
                        <p style={{ margin: "0 0 2px", fontSize: 11 }}><span style={s.badge(C.blue)}>{ROL_LABELS[p.rol]}</span></p>
                        <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: C.red, fontFamily: "var(--font-display)" }}>{fmtUSD(p.monto_usd)}</p>
                        <p style={{ margin: "1px 0 0", fontSize: 12, color: C.muted }}>{fmtARS(p.monto_usd * tc)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={guardarOperacion} style={{ ...s.btn(C.red, true), padding: "12px 16px", fontSize: 15, fontWeight: 700 }}>
                Guardar operación
              </button>
            </div>

            {/* Cards de resumen */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginTop: 20 }}>
              <div style={s.card}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Comisión total</p>
                <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800, color: C.red, fontFamily: "var(--font-display)" }}>{fmtUSD(comisionCalc)}</p>
                <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{fmtARS(comisionCalc * tc)}</p>
              </div>
              <div style={s.card}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Tu participación</p>
                <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "var(--font-display)" }}>{fmtUSD(miParticipacion)}</p>
                <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{fmtARS(miParticipacion * tc)}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>(primer participante)</p>
              </div>
              <div style={s.card}>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Retención impositiva</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => setRetencion("monotributo")}
                    style={{ ...s.btn(retencion === "monotributo" ? C.red : "#333"), padding: "4px 10px", fontSize: 11 }}
                  >Monotributo</button>
                  <button
                    onClick={() => setRetencion("ri")}
                    style={{ ...s.btn(retencion === "ri" ? C.blue : "#333"), padding: "4px 10px", fontSize: 11 }}
                  >R. Inscripto</button>
                </div>
                <p style={{ margin: "0 0 2px", fontSize: 12, color: C.muted }}>IVA: {retencion === "ri" ? "21%" : "0%"}</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.green, fontFamily: "var(--font-display)" }}>{fmtUSD(miParticipacionNeta)}</p>
                <p style={{ margin: "1px 0 0", fontSize: 12, color: C.muted }}>{fmtARS(miParticipacionNeta * tc)} neto</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 2 — HISTORIAL
        ═══════════════════════════════════════════════════════════════ */}
        {tab === "historial" && (
          <div>
            {/* Filtros */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <select style={{ ...s.input, width: "auto" }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as typeof filtroTipo)}>
                <option value="todos">Todos los tipos</option>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
                <option value="alquiler_temporal">Alq. Temporal</option>
              </select>
              <select style={{ ...s.input, width: "auto" }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}>
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="cobrada_parcial">Cobrada parcial</option>
                <option value="cobrada">Cobrada</option>
              </select>
              <select style={{ ...s.input, width: "auto" }} value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}>
                <option value="todos">Todos los años</option>
                {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <span style={{ marginLeft: "auto", fontSize: 13, color: C.muted, alignSelf: "center" }}>{opsFiltradas.length} operación{opsFiltradas.length !== 1 ? "es" : ""}</span>
            </div>

            {opsFiltradas.length === 0 && (
              <p style={{ color: C.muted, textAlign: "center", padding: 40 }}>No hay operaciones con los filtros seleccionados.</p>
            )}

            {opsFiltradas.map(op => (
              <div key={op.id} style={{ ...s.card, marginBottom: 16 }}>
                {/* Cabecera de la card */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, margin: "0 0 6px", color: C.text }}>{op.descripcion}</h3>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={s.badge(TIPO_COLORS[op.tipo])}>{TIPO_LABELS[op.tipo]}</span>
                      <span style={s.badge(ESTADO_COLORS[op.estado])}>{ESTADO_LABELS[op.estado]}</span>
                      <span style={{ fontSize: 12, color: C.muted, alignSelf: "center" }}>{op.fecha}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: "0 0 2px", fontSize: 12, color: C.muted }}>Valor: {fmtUSD(op.valor_operacion)}</p>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.red, fontFamily: "var(--font-display)" }}>{fmtUSD(op.comision_total_usd)}</p>
                    <p style={{ margin: "1px 0 0", fontSize: 12, color: C.muted }}>{fmtARS(op.comision_total_usd * tc)}</p>
                  </div>
                </div>

                {/* Participantes */}
                <div style={{ marginBottom: 12 }}>
                  {op.participantes.map((p, i) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: C.text, minWidth: 120 }}>{p.nombre || "Sin nombre"}</span>
                        <span style={s.badge(C.blue)}>{ROL_LABELS[p.rol]}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{fmtPct(p.porcentaje)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmtUSD(p.monto_usd)}</span>
                          {p.fecha_cobro && <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{p.fecha_cobro}</p>}
                        </div>
                        <button
                          onClick={() => marcarCobradoParticipante(op.id, i, !p.cobrado)}
                          style={s.btn(p.cobrado ? "#333" : C.green)}
                        >
                          {p.cobrado ? "✓ Cobrado" : "Marcar cobrado"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {op.estado !== "cobrada" && (
                    <button onClick={() => marcarTodaCobrada(op.id)} style={s.btn(C.green)}>
                      Toda la operación cobrada
                    </button>
                  )}
                  <button onClick={() => setEditModal(op)} style={s.btnOutline()}>Editar</button>
                  <button onClick={() => duplicarOperacion(op)} style={s.btnOutline()}>Duplicar</button>
                </div>
                {op.notas && <p style={{ margin: "12px 0 0", fontSize: 12, color: C.muted, fontStyle: "italic" }}>📝 {op.notas}</p>}
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3 — RESUMEN FINANCIERO
        ═══════════════════════════════════════════════════════════════ */}
        {tab === "resumen" && (
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, margin: "0 0 16px", color: C.muted }}>Año {anioActual}</h2>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
              <div style={s.card}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Cobradas</p>
                <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800, color: C.green, fontFamily: "var(--font-display)" }}>{fmtUSD(kpis.cobradas)}</p>
                <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{fmtARS(kpis.cobradas * tc)}</p>
              </div>
              <div style={s.card}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Pendientes</p>
                <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800, color: C.yellow, fontFamily: "var(--font-display)" }}>{fmtUSD(kpis.pendiente)}</p>
                <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{fmtARS(kpis.pendiente * tc)}</p>
              </div>
              <div style={s.card}>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Promedio / op.</p>
                <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "var(--font-display)" }}>{fmtUSD(kpis.promedio)}</p>
                <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{opsAnio.length} operaciones</p>
              </div>
              {kpis.topNombre && (
                <div style={s.card}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>Mayor volumen</p>
                  <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>{kpis.topNombre}</p>
                  <p style={{ margin: 0, fontSize: 13, color: C.red, fontWeight: 600 }}>{fmtUSD(kpis.topMonto)}</p>
                </div>
              )}
            </div>

            {/* Gráfico de barras */}
            <div style={{ ...s.card, marginBottom: 20, overflowX: "auto" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, margin: "0 0 16px", color: C.text }}>Comisiones cobradas por mes — {anioActual}</h3>
              <svg width={700} height={280} viewBox="0 0 700 280" style={{ maxWidth: "100%", display: "block" }}>
                {/* Grid lines */}
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <line key={f} x1={40} x2={690} y1={240 - f * 200} y2={240 - f * 200} stroke={C.border} strokeWidth={1} />
                ))}
                {barrasData.vals.map((v, i) => {
                  const bw = 40;
                  const gap = 10;
                  const totalW = (bw + gap) * 12;
                  const startX = 40 + (610 - totalW) / 2 + i * (bw + gap);
                  const h = barrasData.max > 0 ? (v / barrasData.max) * 200 : 0;
                  return (
                    <g key={i}>
                      <rect x={startX} y={240 - h} width={bw} height={h} fill={C.red} rx={3} />
                      {v > 0 && (
                        <text x={startX + bw / 2} y={240 - h - 6} textAnchor="middle" fill={C.text} fontSize={9} fontWeight="600">
                          {Math.round(v).toLocaleString("es-AR")}
                        </text>
                      )}
                      <text x={startX + bw / 2} y={258} textAnchor="middle" fill={C.muted} fontSize={10}>{MESES_NOMBRES[i]}</text>
                    </g>
                  );
                })}
                {/* Eje Y labels */}
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <text key={f} x={36} y={243 - f * 200} textAnchor="end" fill={C.muted} fontSize={9}>
                    {Math.round(barrasData.max * f).toLocaleString("es-AR")}
                  </text>
                ))}
              </svg>
            </div>

            {/* Donut + tabla tipos */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, marginBottom: 20, alignItems: "start" }}>
              <div style={s.card}>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, margin: "0 0 12px", color: C.text }}>Por tipo</h3>
                <DonutSVG />
                <div style={{ marginTop: 12 }}>
                  {donutData.filter(d => d.val > 0).map(d => (
                    <div key={d.tipo} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: TIPO_COLORS[d.tipo] }} />
                      <span style={{ fontSize: 12, color: C.text }}>{TIPO_LABELS[d.tipo]}</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>{fmtPct(d.pct * 100)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabla participantes */}
              <div style={s.card}>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, margin: "0 0 12px", color: C.text }}>Participantes — {anioActual}</h3>
                {tablaParticipantes.length === 0 ? (
                  <p style={{ color: C.muted, fontSize: 13 }}>Sin datos para el año.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Participante", "Ops.", "Cobrado (USD)", "Pendiente (USD)"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, color: C.muted, borderBottom: `1px solid ${C.border}`, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tablaParticipantes.map(([nombre, datos]) => (
                        <tr key={nombre}>
                          <td style={{ padding: "8px 8px", color: C.text, borderBottom: `1px solid ${C.border}` }}>{nombre}</td>
                          <td style={{ padding: "8px 8px", color: C.muted, borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>{datos.ops}</td>
                          <td style={{ padding: "8px 8px", color: C.green, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{fmtUSD(datos.cobrado)}</td>
                          <td style={{ padding: "8px 8px", color: C.yellow, borderBottom: `1px solid ${C.border}` }}>{fmtUSD(datos.pendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editModal && (
        <ModalEditar
          op={editModal}
          tc={tc}
          onGuardar={guardarEdicion}
          onCerrar={() => setEditModal(null)}
        />
      )}
    </div>
  );
}
