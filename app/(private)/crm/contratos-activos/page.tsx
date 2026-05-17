"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ──────────────────────────────────────────────────────────────────

type IndiceAjuste = "ICL" | "IPC" | "CER" | "CAC" | "fijo";
type EstadoContrato = "vigente" | "por_vencer" | "vencido" | "renovado" | "rescindido";

interface Contrato {
  id: string;
  inquilino_nombre: string;
  inquilino_telefono: string;
  propietario_nombre: string;
  propietario_telefono: string;
  direccion: string;
  barrio: string;
  tipo_propiedad: string;
  fecha_inicio: string;
  fecha_fin: string;
  alquiler_inicial: number;
  alquiler_actual: number;
  indice_ajuste: IndiceAjuste;
  tasa_ajuste_anual: number;
  periodo_ajuste_meses: number;
  moneda: "ARS" | "USD";
  estado: EstadoContrato;
  honorarios_admin: number;
  deposito_meses: number;
  notas: string;
  created_at: string;
}

type TabId = "listado" | "vencimientos" | "ingresos";
type FiltroEstado = "todos" | "vigente" | "por_vencer" | "vencido";

// ── Constantes ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "crm_contratos_v1";

const ESTADO_COLORS: Record<EstadoContrato, { bg: string; text: string; border: string }> = {
  vigente:    { bg: "rgba(34,197,94,0.12)",     text: "#22c55e", border: "rgba(34,197,94,0.3)" },
  por_vencer: { bg: "rgba(245,158,11,0.12)",    text: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  vencido:    { bg: "rgba(239,68,68,0.12)",     text: "#ef4444", border: "rgba(239,68,68,0.3)" },
  renovado:   { bg: "rgba(59,130,246,0.12)",    text: "#3b82f6", border: "rgba(59,130,246,0.3)" },
  rescindido: { bg: "rgba(255,255,255,0.05)",   text: "rgba(255,255,255,0.3)", border: "rgba(255,255,255,0.1)" },
};

const CONTRATOS_DEMO: Contrato[] = [
  {
    id: "demo-1",
    inquilino_nombre: "Martínez, Juan Pablo",
    inquilino_telefono: "1145678901",
    propietario_nombre: "Rodríguez, Ana",
    propietario_telefono: "1156789012",
    direccion: "Av. Corrientes 2450 3°B",
    barrio: "Balvanera",
    tipo_propiedad: "Departamento",
    fecha_inicio: "2024-04-01",
    fecha_fin: "2026-04-01",
    alquiler_inicial: 280000,
    alquiler_actual: 420000,
    indice_ajuste: "ICL",
    tasa_ajuste_anual: 120,
    periodo_ajuste_meses: 3,
    moneda: "ARS",
    estado: "vigente",
    honorarios_admin: 5,
    deposito_meses: 2,
    notas: "Buen pagador, paga siempre antes del día 5.",
    created_at: "2024-04-01T10:00:00Z",
  },
  {
    id: "demo-2",
    inquilino_nombre: "García, Sofía",
    inquilino_telefono: "1167890123",
    propietario_nombre: "López, Carlos",
    propietario_telefono: "1178901234",
    direccion: "Gurruchaga 780 PB A",
    barrio: "Palermo Soho",
    tipo_propiedad: "Departamento",
    fecha_inicio: "2024-06-15",
    fecha_fin: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    alquiler_inicial: 950,
    alquiler_actual: 1200,
    indice_ajuste: "fijo",
    tasa_ajuste_anual: 0,
    periodo_ajuste_meses: 12,
    moneda: "USD",
    estado: "por_vencer",
    honorarios_admin: 4,
    deposito_meses: 2,
    notas: "En negociación para renovar.",
    created_at: "2024-06-15T09:00:00Z",
  },
  {
    id: "demo-3",
    inquilino_nombre: "Fernández, Diego",
    inquilino_telefono: "1189012345",
    propietario_nombre: "Sánchez, María",
    propietario_telefono: "1190123456",
    direccion: "Cuba 2100 PB B",
    barrio: "Belgrano",
    tipo_propiedad: "Departamento",
    fecha_inicio: "2023-02-01",
    fecha_fin: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
    alquiler_inicial: 150000,
    alquiler_actual: 380000,
    indice_ajuste: "IPC",
    tasa_ajuste_anual: 140,
    periodo_ajuste_meses: 6,
    moneda: "ARS",
    estado: "vencido",
    honorarios_admin: 5,
    deposito_meses: 1,
    notas: "Pendiente renovación formal.",
    created_at: "2023-02-01T11:00:00Z",
  },
  {
    id: "demo-4",
    inquilino_nombre: "Alvarez, Lucía",
    inquilino_telefono: "1112345678",
    propietario_nombre: "Torres, Norberto",
    propietario_telefono: "1123456789",
    direccion: "Av. Santa Fe 3200 7°D",
    barrio: "Palermo",
    tipo_propiedad: "Departamento",
    fecha_inicio: "2025-01-01",
    fecha_fin: "2027-01-01",
    alquiler_inicial: 600000,
    alquiler_actual: 650000,
    indice_ajuste: "CER",
    tasa_ajuste_anual: 100,
    periodo_ajuste_meses: 3,
    moneda: "ARS",
    estado: "vigente",
    honorarios_admin: 5,
    deposito_meses: 3,
    notas: "",
    created_at: "2025-01-01T08:00:00Z",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${MESES[parseInt(m) - 1]} ${y}`;
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000);
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMeses(fecha: string, meses: number): string {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

function diasParaVencer(c: Contrato): number {
  return diasEntre(hoy(), c.fecha_fin);
}

function estadoCalculado(c: Contrato): EstadoContrato {
  if (c.estado === "renovado" || c.estado === "rescindido") return c.estado;
  const d = diasParaVencer(c);
  if (d < 0) return "vencido";
  if (d < 30) return "por_vencer";
  return "vigente";
}

function proximoAjuste(c: Contrato): string {
  const inicio = new Date(c.fecha_inicio);
  const now = new Date();
  let proxima = new Date(inicio);
  while (proxima <= now) {
    proxima.setMonth(proxima.getMonth() + c.periodo_ajuste_meses);
  }
  return proxima.toISOString().slice(0, 10);
}

function diasParaAjuste(c: Contrato): number {
  return diasEntre(hoy(), proximoAjuste(c));
}

function alquilerProyectado(c: Contrato, meses: number): number {
  if (c.indice_ajuste === "fijo") return c.alquiler_actual;
  return c.alquiler_actual * Math.pow(1 + c.tasa_ajuste_anual / 100, meses / 12);
}

function honorariosAdmin(c: Contrato): number {
  return c.alquiler_actual * c.honorarios_admin / 100;
}

function urgenciaOrden(c: Contrato): number {
  const e = estadoCalculado(c);
  if (e === "vencido") return 0;
  if (e === "por_vencer") return 1;
  return 2;
}

function genId(): string {
  return `contrato_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Formulario vacío ────────────────────────────────────────────────────────

function contratoVacio(): Omit<Contrato, "id" | "created_at"> {
  return {
    inquilino_nombre: "",
    inquilino_telefono: "",
    propietario_nombre: "",
    propietario_telefono: "",
    direccion: "",
    barrio: "",
    tipo_propiedad: "Departamento",
    fecha_inicio: hoy(),
    fecha_fin: addMeses(hoy(), 24),
    alquiler_inicial: 0,
    alquiler_actual: 0,
    indice_ajuste: "ICL",
    tasa_ajuste_anual: 120,
    periodo_ajuste_meses: 3,
    moneda: "ARS",
    estado: "vigente",
    honorarios_admin: 5,
    deposito_meses: 2,
    notas: "",
  };
}

// ── Subcomponentes menores ─────────────────────────────────────────────────

function EstadoChip({ estado }: { estado: EstadoContrato }) {
  const c = ESTADO_COLORS[estado];
  const labels: Record<EstadoContrato, string> = {
    vigente: "Vigente",
    por_vencer: "Por vencer",
    vencido: "Vencido",
    renovado: "Renovado",
    rescindido: "Rescindido",
  };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.04em",
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      fontFamily: "Inter, sans-serif",
    }}>
      {labels[estado]}
    </span>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function ContratosActivosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("listado");
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Contrato, "id" | "created_at">>(contratoVacio());

  // ── Carga ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      const { data, error } = await supabase
        .from("crm_contratos")
        .select("*")
        .order("fecha_fin", { ascending: true });

      if (error || !data) {
        // fallback localStorage
        const raw = localStorage.getItem(STORAGE_KEY);
        setContratos(raw ? (JSON.parse(raw) as Contrato[]) : CONTRATOS_DEMO);
      } else {
        setContratos(data as Contrato[]);
      }
      setLoading(false);
    }
    cargar();
  }, []);

  // ── Persistencia ──────────────────────────────────────────────────────────

  function guardarEnStorage(lista: Contrato[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  }

  function guardar(item: Contrato) {
    const ya = contratos.find(c => c.id === item.id);
    const nueva = ya
      ? contratos.map(c => c.id === item.id ? item : c)
      : [...contratos, item];
    setContratos(nueva);
    guardarEnStorage(nueva);
  }

  function eliminar(id: string) {
    const nueva = contratos.filter(c => c.id !== id);
    setContratos(nueva);
    guardarEnStorage(nueva);
    setSelectedId(null);
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const contratosConEstado = useMemo(
    () => contratos.map(c => ({ ...c, estado: estadoCalculado(c) })),
    [contratos]
  );

  const ordenados = useMemo(
    () => [...contratosConEstado].sort((a, b) => urgenciaOrden(a) - urgenciaOrden(b) || diasParaVencer(a) - diasParaVencer(b)),
    [contratosConEstado]
  );

  const filtrados = useMemo(() => {
    if (filtro === "todos") return ordenados;
    return ordenados.filter(c => c.estado === filtro);
  }, [ordenados, filtro]);

  const vigentes = useMemo(
    () => contratosConEstado.filter(c => c.estado === "vigente" || c.estado === "por_vencer"),
    [contratosConEstado]
  );

  const totalCartera = useMemo(
    () => vigentes.reduce((s, c) => s + c.alquiler_actual, 0),
    [vigentes]
  );

  const totalHonorarios = useMemo(
    () => vigentes.reduce((s, c) => s + honorariosAdmin(c), 0),
    [vigentes]
  );

  const porVencerCount = useMemo(
    () => contratosConEstado.filter(c => c.estado === "por_vencer").length,
    [contratosConEstado]
  );

  const alertasVencimiento = useMemo(
    () => contratosConEstado.filter(c => {
      const d = diasParaVencer(c);
      return d >= 0 && d < 30;
    }).sort((a, b) => diasParaVencer(a) - diasParaVencer(b)),
    [contratosConEstado]
  );

  const alertasAjuste = useMemo(
    () => contratosConEstado.filter(c => {
      const d = diasParaAjuste(c);
      return d >= 0 && d <= 7 && c.indice_ajuste !== "fijo";
    }),
    [contratosConEstado]
  );

  // Proyección 12 meses
  const proyeccion12 = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const targetDate = addMeses(hoy(), mes);
      const totalMes = vigentes.reduce((s, c) => {
        if (c.fecha_fin < targetDate) return s;
        return s + alquilerProyectado(c, mes);
      }, 0);
      const honorariosMes = vigentes.reduce((s, c) => {
        if (c.fecha_fin < targetDate) return s;
        return s + alquilerProyectado(c, mes) * c.honorarios_admin / 100;
      }, 0);
      return { mes, targetDate, totalMes, honorariosMes };
    });
  }, [vigentes]);

  // Timeline vencimientos + ajustes próximos 6 meses
  const eventosTimeline = useMemo(() => {
    const limit = addMeses(hoy(), 6);
    const eventos: Array<{ fecha: string; tipo: "vencimiento" | "ajuste"; contrato: Contrato }> = [];
    contratosConEstado.forEach(c => {
      if (c.fecha_fin <= limit && c.fecha_fin >= hoy()) {
        eventos.push({ fecha: c.fecha_fin, tipo: "vencimiento", contrato: c });
      }
      const pa = proximoAjuste(c);
      if (pa <= limit && pa >= hoy() && c.indice_ajuste !== "fijo") {
        eventos.push({ fecha: pa, tipo: "ajuste", contrato: c });
      }
    });
    return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [contratosConEstado]);

  // Meses timeline
  const mesesTimeline = useMemo(() => {
    const meses: string[] = [];
    for (let i = 0; i < 6; i++) meses.push(addMeses(hoy(), i).slice(0, 7));
    return meses;
  }, []);

  // Seleccionado
  const selected = useMemo(
    () => contratosConEstado.find(c => c.id === selectedId) ?? null,
    [contratosConEstado, selectedId]
  );

  // ── Formulario ────────────────────────────────────────────────────────────

  function abrirNuevo() {
    setEditingId(null);
    setForm(contratoVacio());
    setShowModal(true);
  }

  function abrirEditar(c: Contrato) {
    setEditingId(c.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _ca, ...rest } = c;
    setForm(rest);
    setShowModal(true);
  }

  function cerrarModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const contrato: Contrato = editingId
      ? { ...form, id: editingId, created_at: contratos.find(c => c.id === editingId)?.created_at ?? new Date().toISOString() }
      : { ...form, id: genId(), created_at: new Date().toISOString() };
    guardar(contrato);
    cerrarModal();
  }

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  // ── Helpers SVG ───────────────────────────────────────────────────────────

  const maxHonorarios = useMemo(
    () => Math.max(...proyeccion12.map(p => p.honorariosMes), totalHonorarios, 1),
    [proyeccion12, totalHonorarios]
  );

  const chartW = 600;
  const chartH = 160;
  const padL = 50;
  const padR = 20;
  const padT = 16;
  const padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const linePoints = useMemo(() => {
    const pts = [{ x: padL, y: padT + innerH - (totalHonorarios / maxHonorarios) * innerH }];
    proyeccion12.forEach((p, i) => {
      const x = padL + ((i + 1) / 12) * innerW;
      const y = padT + innerH - (p.honorariosMes / maxHonorarios) * innerH;
      pts.push({ x, y });
    });
    return pts;
  }, [proyeccion12, totalHonorarios, maxHonorarios, innerW, innerH]);

  const polyline = linePoints.map(p => `${p.x},${p.y}`).join(" ");

  // ── Render ────────────────────────────────────────────────────────────────

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "Inter, sans-serif",
      padding: "24px 20px 60px",
    } as React.CSSProperties,

    heading: {
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 800,
      fontSize: 26,
      color: "#fff",
      margin: 0,
      letterSpacing: "-0.5px",
    } as React.CSSProperties,

    subheading: {
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 700,
      fontSize: 15,
      color: "rgba(255,255,255,0.7)",
      margin: 0,
    } as React.CSSProperties,

    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "16px 20px",
    } as React.CSSProperties,

    kpiCard: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "18px 20px",
      flex: 1,
      minWidth: 160,
    } as React.CSSProperties,

    kpiVal: {
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 800,
      fontSize: 24,
      color: "#fff",
      lineHeight: 1.1,
    } as React.CSSProperties,

    kpiLabel: {
      fontSize: 11,
      color: "rgba(255,255,255,0.45)",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      marginTop: 4,
    },

    tabBtn: (active: boolean): React.CSSProperties => ({
      background: active ? "rgba(204,0,0,0.18)" : "transparent",
      border: active ? "1px solid rgba(204,0,0,0.5)" : "1px solid rgba(255,255,255,0.1)",
      color: active ? "#ff4444" : "rgba(255,255,255,0.6)",
      borderRadius: 8,
      padding: "7px 18px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
      transition: "all 0.15s",
    }),

    filtroBtn: (active: boolean): React.CSSProperties => ({
      background: active ? "rgba(255,255,255,0.1)" : "transparent",
      border: "1px solid rgba(255,255,255,0.1)",
      color: active ? "#fff" : "rgba(255,255,255,0.45)",
      borderRadius: 6,
      padding: "4px 12px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
    }),

    btn: {
      background: "#cc0000",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "8px 18px",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
    } as React.CSSProperties,

    btnOutline: {
      background: "transparent",
      color: "rgba(255,255,255,0.6)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 8,
      padding: "8px 16px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
    } as React.CSSProperties,

    btnDanger: {
      background: "rgba(239,68,68,0.15)",
      color: "#ef4444",
      border: "1px solid rgba(239,68,68,0.3)",
      borderRadius: 8,
      padding: "8px 16px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
    } as React.CSSProperties,

    input: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      color: "#fff",
      fontSize: 13,
      padding: "8px 12px",
      fontFamily: "Inter, sans-serif",
      width: "100%",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,

    label: {
      fontSize: 11,
      color: "rgba(255,255,255,0.45)",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      display: "block",
      marginBottom: 4,
    } as React.CSSProperties,

    divider: {
      borderTop: "1px solid rgba(255,255,255,0.07)",
      margin: "16px 0",
    } as React.CSSProperties,
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Cargando contratos...</span>
      </div>
    );
  }

  // ── Render principal ──────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={s.heading}>Contratos Activos</h1>
          <p style={{ ...s.subheading, marginTop: 4 }}>Gestión de alquileres — vencimientos, ajustes y honorarios</p>
        </div>
        <button style={s.btn} onClick={abrirNuevo}>+ Nuevo Contrato</button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {/* Total activos */}
        <div style={s.kpiCard}>
          <div style={s.kpiVal}>{vigentes.length}</div>
          <div style={s.kpiLabel}>Contratos activos</div>
        </div>

        {/* Cartera ARS */}
        <div style={s.kpiCard}>
          <div style={s.kpiVal}>$ {fmt(totalCartera)}</div>
          <div style={s.kpiLabel}>Cartera ARS/mes</div>
        </div>

        {/* Honorarios */}
        <div style={s.kpiCard}>
          <div style={{ ...s.kpiVal, color: "#22c55e" }}>$ {fmt(totalHonorarios)}</div>
          <div style={s.kpiLabel}>Honorarios admin/mes</div>
        </div>

        {/* Por vencer */}
        <div style={{ ...s.kpiCard, borderColor: porVencerCount > 0 ? "rgba(204,0,0,0.4)" : "rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ ...s.kpiVal, color: porVencerCount > 0 ? "#ef4444" : "#fff" }}>{porVencerCount}</div>
            {porVencerCount > 0 && (
              <span style={{
                background: "#cc0000",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 99,
                letterSpacing: "0.04em",
              }}>ALERTA</span>
            )}
          </div>
          <div style={s.kpiLabel}>Por vencer ≤30 días</div>
        </div>
      </div>

      {/* Alertas */}
      {(alertasVencimiento.length > 0 || alertasAjuste.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {alertasVencimiento.map(c => (
            <div key={`alv-${c.id}`} style={{
              background: "rgba(204,0,0,0.1)",
              border: "1px solid rgba(204,0,0,0.35)",
              borderRadius: 10,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <span style={{ fontSize: 16 }}>🔴</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                <strong style={{ color: "#ff4444" }}>Vence en {diasParaVencer(c)} días</strong>
                {" — "}{c.inquilino_nombre}, {c.direccion}
              </span>
            </div>
          ))}
          {alertasAjuste.map(c => (
            <div key={`ala-${c.id}`} style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 10,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <span style={{ fontSize: 16 }}>🟠</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                <strong style={{ color: "#f59e0b" }}>Ajuste {c.indice_ajuste} en {diasParaAjuste(c)} días</strong>
                {" — "}{c.inquilino_nombre}, {c.direccion}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["listado", "vencimientos", "ingresos"] as TabId[]).map(t => (
          <button key={t} style={s.tabBtn(tab === t)} onClick={() => setTab(t)}>
            {t === "listado" ? "Listado" : t === "vencimientos" ? "Vencimientos" : "Ingresos"}
          </button>
        ))}
      </div>

      {/* ── TAB: LISTADO ──────────────────────────────────────────────────── */}
      {tab === "listado" && (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Lista */}
          <div style={{ flex: 1 }}>
            {/* Filtros */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {(["todos", "vigente", "por_vencer", "vencido"] as FiltroEstado[]).map(f => (
                <button key={f} style={s.filtroBtn(filtro === f)} onClick={() => setFiltro(f)}>
                  {f === "todos" ? "Todos" : f === "vigente" ? "Vigentes" : f === "por_vencer" ? "Por vencer" : "Vencidos"}
                </button>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.3)", alignSelf: "center" }}>
                {filtrados.length} contrato{filtrados.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtrados.length === 0 && (
                <div style={{ ...s.card, color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: "32px 20px" }}>
                  No hay contratos para mostrar
                </div>
              )}
              {filtrados.map(c => {
                const dias = diasParaVencer(c);
                const dAjuste = diasParaAjuste(c);
                const isSelected = selectedId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(isSelected ? null : c.id)}
                    style={{
                      ...s.card,
                      cursor: "pointer",
                      borderColor: isSelected ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.08)",
                      background: isSelected ? "rgba(204,0,0,0.07)" : "rgba(255,255,255,0.04)",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{c.inquilino_nombre}</span>
                          <EstadoChip estado={c.estado} />
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>
                          {c.direccion} — {c.barrio}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                          Prop: {c.propietario_nombre}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#fff" }}>
                          {c.moneda === "USD" ? "USD " : "$ "}{fmt(c.alquiler_actual)}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>/mes</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11,
                        color: dias < 0 ? "#ef4444" : dias < 30 ? "#f59e0b" : "rgba(255,255,255,0.4)",
                        fontWeight: dias < 30 ? 700 : 400,
                      }}>
                        {dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : `Vence en ${dias} días (${fmtFecha(c.fecha_fin)})`}
                      </span>
                      {c.indice_ajuste !== "fijo" && dAjuste >= 0 && (
                        <span style={{
                          fontSize: 11,
                          color: dAjuste <= 7 ? "#f59e0b" : "rgba(255,255,255,0.35)",
                          fontWeight: dAjuste <= 7 ? 700 : 400,
                        }}>
                          Ajuste {c.indice_ajuste} en {dAjuste} días
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
                        Admin: ${fmt(honorariosAdmin(c))}/mes
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel lateral */}
          {selected && (
            <div style={{
              width: 320,
              flexShrink: 0,
              position: "sticky",
              top: 20,
              ...s.card,
              borderColor: "rgba(255,255,255,0.12)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Detalle</span>
                <button
                  style={{ ...s.btnOutline, padding: "3px 10px", fontSize: 12 }}
                  onClick={() => setSelectedId(null)}
                >✕</button>
              </div>

              <EstadoChip estado={selected.estado} />

              <div style={s.divider} />

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["Inquilino", `${selected.inquilino_nombre} — ${selected.inquilino_telefono}`],
                  ["Propietario", `${selected.propietario_nombre} — ${selected.propietario_telefono}`],
                  ["Dirección", `${selected.direccion}, ${selected.barrio}`],
                  ["Tipo", selected.tipo_propiedad],
                  ["Inicio", fmtFecha(selected.fecha_inicio)],
                  ["Vencimiento", fmtFecha(selected.fecha_fin)],
                  ["Alquiler inicial", `${selected.moneda === "USD" ? "USD " : "$ "}${fmt(selected.alquiler_inicial)}`],
                  ["Alquiler actual", `${selected.moneda === "USD" ? "USD " : "$ "}${fmt(selected.alquiler_actual)}`],
                  ["Índice ajuste", `${selected.indice_ajuste} (${selected.tasa_ajuste_anual}% anual, cada ${selected.periodo_ajuste_meses} meses)`],
                  ["Próximo ajuste", fmtFecha(proximoAjuste(selected))],
                  ["Admin honorarios", `${selected.honorarios_admin}% = $${fmt(honorariosAdmin(selected))}/mes`],
                  ["Depósito", `${selected.deposito_meses} mes${selected.deposito_meses !== 1 ? "es" : ""}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={s.label}>{k}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{v}</div>
                  </div>
                ))}

                {selected.notas && (
                  <div>
                    <div style={s.label}>Notas</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>{selected.notas}</div>
                  </div>
                )}
              </div>

              <div style={{ ...s.divider }} />

              {/* Proyección 3 meses */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...s.label, marginBottom: 8 }}>Proyección alquiler</div>
                {[3, 6, 12].map(m => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>+{m} meses</span>
                    <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
                      {selected.moneda === "USD" ? "USD " : "$ "}
                      {fmt(alquilerProyectado(selected, m))}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={s.btn} onClick={() => abrirEditar(selected)}>Editar</button>
                <button style={s.btnDanger} onClick={() => { if (confirm("¿Eliminar este contrato?")) eliminar(selected.id); }}>
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: VENCIMIENTOS ─────────────────────────────────────────────── */}
      {tab === "vencimientos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Timeline por mes */}
          <div style={s.card}>
            <h3 style={{ ...s.subheading, marginBottom: 16 }}>Eventos próximos — 6 meses</h3>
            {eventosTimeline.length === 0 && (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                Sin vencimientos ni ajustes próximos en 6 meses.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {eventosTimeline.map((ev, i) => (
                <div key={i} style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  border: `1px solid ${ev.tipo === "vencimiento" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: ev.tipo === "vencimiento" ? "#ef4444" : "#f59e0b",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                      {ev.tipo === "vencimiento" ? "Vencimiento" : `Ajuste ${ev.contrato.indice_ajuste}`}
                      {" — "}
                      {ev.contrato.inquilino_nombre}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {ev.contrato.direccion} · {fmtFecha(ev.fecha)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: diasEntre(hoy(), ev.fecha) <= 7 ? "#ef4444" : "rgba(255,255,255,0.5)",
                  }}>
                    {diasEntre(hoy(), ev.fecha)} días
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Por mes */}
          <div style={s.card}>
            <h3 style={{ ...s.subheading, marginBottom: 16 }}>Vencimientos por mes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {mesesTimeline.map(mes => {
                const items = contratosConEstado.filter(c => c.fecha_fin.slice(0, 7) === mes);
                return (
                  <div key={mes}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      {(() => {
                        const [y, m] = mes.split("-");
                        const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                        return `${MESES_FULL[parseInt(m) - 1]} ${y}`;
                      })()}
                    </div>
                    {items.length === 0 ? (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", paddingLeft: 8 }}>Sin vencimientos</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {items.map(c => (
                          <div key={c.id} style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 7,
                            borderLeft: `3px solid ${ESTADO_COLORS[c.estado].text}`,
                          }}>
                            <div>
                              <div style={{ fontSize: 13, color: "#fff" }}>{c.inquilino_nombre}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{c.direccion}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 12, color: ESTADO_COLORS[c.estado].text, fontWeight: 700 }}>
                                {diasParaVencer(c)} días
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{fmtFecha(c.fecha_fin)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SVG Gantt horizontal */}
          <div style={s.card}>
            <h3 style={{ ...s.subheading, marginBottom: 16 }}>Duración de contratos</h3>
            <div style={{ overflowX: "auto" }}>
              <svg width="100%" viewBox={`0 0 700 ${Math.max(60, contratosConEstado.length * 36 + 40)}`} style={{ display: "block" }}>
                {/* Líneas de fondo */}
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                  <line
                    key={i}
                    x1={100 + (i / 6) * 580}
                    y1={10}
                    x2={100 + (i / 6) * 580}
                    y2={Math.max(60, contratosConEstado.length * 36 + 10)}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                  />
                ))}
                {/* Etiqueta hoy */}
                {(() => {
                  const todayDate = new Date(hoy());
                  const minDate = new Date(Math.min(...contratosConEstado.map(c => new Date(c.fecha_inicio).getTime())));
                  const maxDate = new Date(Math.max(...contratosConEstado.map(c => new Date(c.fecha_fin).getTime())));
                  const totalMs = maxDate.getTime() - minDate.getTime();
                  const todayX = totalMs > 0 ? 100 + ((todayDate.getTime() - minDate.getTime()) / totalMs) * 580 : 100;
                  return (
                    <>
                      <line x1={todayX} y1={10} x2={todayX} y2={Math.max(60, contratosConEstado.length * 36 + 10)} stroke="#cc0000" strokeWidth={1.5} strokeDasharray="4,3" />
                      <text x={todayX + 3} y={22} fill="#cc0000" fontSize={9} fontFamily="Inter, sans-serif">Hoy</text>
                    </>
                  );
                })()}

                {contratosConEstado.map((c, i) => {
                  const minDate = new Date(Math.min(...contratosConEstado.map(cc => new Date(cc.fecha_inicio).getTime())));
                  const maxDate = new Date(Math.max(...contratosConEstado.map(cc => new Date(cc.fecha_fin).getTime())));
                  const totalMs = maxDate.getTime() - minDate.getTime() || 1;
                  const x1 = 100 + ((new Date(c.fecha_inicio).getTime() - minDate.getTime()) / totalMs) * 580;
                  const x2 = 100 + ((new Date(c.fecha_fin).getTime() - minDate.getTime()) / totalMs) * 580;
                  const y = 30 + i * 36;
                  const col = ESTADO_COLORS[c.estado];
                  return (
                    <g key={c.id}>
                      <text x={0} y={y + 9} fill="rgba(255,255,255,0.5)" fontSize={10} fontFamily="Inter, sans-serif">
                        {c.inquilino_nombre.split(",")[0].trim().slice(0, 12)}
                      </text>
                      <rect x={x1} y={y} width={Math.max(2, x2 - x1)} height={18} rx={4} fill={col.bg} stroke={col.border} strokeWidth={1} />
                      <text x={x1 + 4} y={y + 12} fill={col.text} fontSize={9} fontFamily="Inter, sans-serif">
                        {c.moneda === "USD" ? "USD " : "$"}{fmt(c.alquiler_actual)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: INGRESOS ────────────────────────────────────────────────── */}
      {tab === "ingresos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Chart SVG honorarios proyectados */}
          <div style={s.card}>
            <h3 style={{ ...s.subheading, marginBottom: 4 }}>Proyección de honorarios admin — 12 meses</h3>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "0 0 16px" }}>
              Considera ajustes por índice y contratos activos
            </p>
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: "block" }}>
              {/* Grid horizontal */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => {
                const y = padT + innerH - t * innerH;
                return (
                  <g key={t}>
                    <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                    <text x={padL - 4} y={y + 4} fill="rgba(255,255,255,0.3)" fontSize={9} textAnchor="end" fontFamily="Inter, sans-serif">
                      {fmt(maxHonorarios * t)}
                    </text>
                  </g>
                );
              })}
              {/* Grid vertical meses */}
              {proyeccion12.map((p, i) => {
                const x = padL + ((i + 1) / 12) * innerW;
                const [, m] = p.targetDate.split("-");
                const MESES_SHORT = ["E","F","M","A","M","J","J","A","S","O","N","D"];
                return (
                  <g key={i}>
                    <line x1={x} y1={padT} x2={x} y2={padT + innerH} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                    <text x={x} y={padT + innerH + 14} fill="rgba(255,255,255,0.3)" fontSize={9} textAnchor="middle" fontFamily="Inter, sans-serif">
                      {MESES_SHORT[parseInt(m) - 1]}
                    </text>
                  </g>
                );
              })}
              {/* Relleno bajo curva */}
              <polyline
                points={`${padL},${padT + innerH} ${polyline} ${padL + innerW},${padT + innerH}`}
                fill="rgba(204,0,0,0.1)"
                stroke="none"
              />
              {/* Línea */}
              <polyline points={polyline} fill="none" stroke="#cc0000" strokeWidth={2.5} strokeLinejoin="round" />
              {/* Puntos */}
              {linePoints.slice(1).map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill="#cc0000" />
              ))}
            </svg>
          </div>

          {/* Tabla proyección */}
          <div style={s.card}>
            <h3 style={{ ...s.subheading, marginBottom: 16 }}>Ingresos proyectados por mes</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Mes", "Alquiler cartera", "Honorarios admin", "Contratos activos"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Mes actual */}
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(204,0,0,0.05)" }}>
                    <td style={{ padding: "10px 12px", color: "#cc0000", fontWeight: 700 }}>Actual</td>
                    <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 600 }}>$ {fmt(totalCartera)}</td>
                    <td style={{ padding: "10px 12px", color: "#22c55e", fontWeight: 600 }}>$ {fmt(totalHonorarios)}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.5)" }}>{vigentes.length}</td>
                  </tr>
                  {proyeccion12.map((p, i) => {
                    const [y, m] = p.targetDate.split("-");
                    const MESES_FULL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                    const activosEnMes = vigentes.filter(c => c.fecha_fin >= p.targetDate).length;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.6)" }}>{MESES_FULL[parseInt(m) - 1]} {y}</td>
                        <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.85)" }}>$ {fmt(p.totalMes)}</td>
                        <td style={{ padding: "9px 12px", color: "#22c55e" }}>$ {fmt(p.honorariosMes)}</td>
                        <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.5)" }}>{activosEnMes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total proyectado 12 meses */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ ...s.kpiCard, borderColor: "rgba(34,197,94,0.2)" }}>
              <div style={{ ...s.kpiVal, color: "#22c55e" }}>
                $ {fmt(proyeccion12.reduce((s, p) => s + p.honorariosMes, 0))}
              </div>
              <div style={s.kpiLabel}>Total honorarios proyectados 12 meses</div>
            </div>
            <div style={s.kpiCard}>
              <div style={s.kpiVal}>
                $ {fmt(proyeccion12.reduce((s, p) => s + p.totalMes, 0))}
              </div>
              <div style={s.kpiLabel}>Total cartera proyectada 12 meses</div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FORMULARIO ──────────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "28px 28px 24px",
            width: "100%",
            maxWidth: 620,
            maxHeight: "90vh",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ ...s.heading, fontSize: 20 }}>
                {editingId ? "Editar contrato" : "Nuevo contrato"}
              </h2>
              <button style={s.btnOutline} onClick={cerrarModal}>✕</button>
            </div>

            <form onSubmit={submitForm} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Sección inquilino */}
              <div style={{ fontSize: 11, color: "#cc0000", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Inquilino</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Nombre y apellido</label>
                  <input style={s.input} value={form.inquilino_nombre} onChange={e => setField("inquilino_nombre", e.target.value)} required placeholder="Martínez, Juan" />
                </div>
                <div>
                  <label style={s.label}>Teléfono</label>
                  <input style={s.input} value={form.inquilino_telefono} onChange={e => setField("inquilino_telefono", e.target.value)} placeholder="11XXXXXXXX" />
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#cc0000", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginTop: 4 }}>Propietario</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Nombre y apellido</label>
                  <input style={s.input} value={form.propietario_nombre} onChange={e => setField("propietario_nombre", e.target.value)} required placeholder="García, María" />
                </div>
                <div>
                  <label style={s.label}>Teléfono</label>
                  <input style={s.input} value={form.propietario_telefono} onChange={e => setField("propietario_telefono", e.target.value)} placeholder="11XXXXXXXX" />
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#cc0000", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginTop: 4 }}>Propiedad</div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Dirección</label>
                  <input style={s.input} value={form.direccion} onChange={e => setField("direccion", e.target.value)} required placeholder="Av. Corrientes 1234 3°B" />
                </div>
                <div>
                  <label style={s.label}>Barrio</label>
                  <input style={s.input} value={form.barrio} onChange={e => setField("barrio", e.target.value)} placeholder="Palermo" />
                </div>
                <div>
                  <label style={s.label}>Tipo</label>
                  <input style={s.input} value={form.tipo_propiedad} onChange={e => setField("tipo_propiedad", e.target.value)} placeholder="Departamento" />
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#cc0000", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginTop: 4 }}>Contrato</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Fecha inicio</label>
                  <input style={s.input} type="date" value={form.fecha_inicio} onChange={e => setField("fecha_inicio", e.target.value)} required />
                </div>
                <div>
                  <label style={s.label}>Fecha fin</label>
                  <input style={s.input} type="date" value={form.fecha_fin} onChange={e => setField("fecha_fin", e.target.value)} required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Moneda</label>
                  <select style={s.input} value={form.moneda} onChange={e => setField("moneda", e.target.value as "ARS" | "USD")}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Alquiler inicial</label>
                  <input style={s.input} type="number" value={form.alquiler_inicial || ""} onChange={e => setField("alquiler_inicial", parseFloat(e.target.value) || 0)} placeholder="0" required />
                </div>
                <div>
                  <label style={s.label}>Alquiler actual</label>
                  <input style={s.input} type="number" value={form.alquiler_actual || ""} onChange={e => setField("alquiler_actual", parseFloat(e.target.value) || 0)} placeholder="0" required />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Índice ajuste</label>
                  <select style={s.input} value={form.indice_ajuste} onChange={e => setField("indice_ajuste", e.target.value as IndiceAjuste)}>
                    {(["ICL","IPC","CER","CAC","fijo"] as IndiceAjuste[]).map(idx => (
                      <option key={idx} value={idx}>{idx}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Tasa anual %</label>
                  <input style={s.input} type="number" value={form.tasa_ajuste_anual || ""} onChange={e => setField("tasa_ajuste_anual", parseFloat(e.target.value) || 0)} placeholder="120" />
                </div>
                <div>
                  <label style={s.label}>Período ajuste (meses)</label>
                  <select style={s.input} value={form.periodo_ajuste_meses} onChange={e => setField("periodo_ajuste_meses", parseInt(e.target.value))}>
                    <option value={3}>3</option>
                    <option value={6}>6</option>
                    <option value={12}>12</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Honor. admin %</label>
                  <input style={s.input} type="number" value={form.honorarios_admin || ""} onChange={e => setField("honorarios_admin", parseFloat(e.target.value) || 0)} placeholder="5" step="0.5" />
                </div>
                <div>
                  <label style={s.label}>Depósito (meses)</label>
                  <input style={s.input} type="number" value={form.deposito_meses || ""} onChange={e => setField("deposito_meses", parseInt(e.target.value) || 1)} placeholder="2" />
                </div>
                <div>
                  <label style={s.label}>Estado</label>
                  <select style={s.input} value={form.estado} onChange={e => setField("estado", e.target.value as EstadoContrato)}>
                    {(["vigente","por_vencer","vencido","renovado","rescindido"] as EstadoContrato[]).map(est => (
                      <option key={est} value={est}>{est}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={s.label}>Notas</label>
                <textarea
                  style={{ ...s.input, minHeight: 64, resize: "vertical" }}
                  value={form.notas}
                  onChange={e => setField("notas", e.target.value)}
                  placeholder="Observaciones..."
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" style={s.btnOutline} onClick={cerrarModal}>Cancelar</button>
                <button type="submit" style={s.btn}>{editingId ? "Guardar cambios" : "Crear contrato"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
