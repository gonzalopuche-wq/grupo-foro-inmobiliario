"use client";

import { useState, useMemo, useCallback, useId } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

type MonedaItem = "USD" | "ARS";
type CatObra =
  | "demolicion"
  | "estructura"
  | "albanileria"
  | "cubierta"
  | "instalaciones_electricas"
  | "instalaciones_sanitarias"
  | "carpinteria"
  | "revestimientos"
  | "pintura"
  | "equipamiento"
  | "honorarios_profesionales"
  | "imprevistos"
  | "otro";

interface ItemObra {
  id: string;
  categoria: CatObra;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnit: number;
  moneda: MonedaItem;
  porcentajeAvance: number;
  notas: string;
}

interface Presupuesto {
  nombre: string;
  descripcion: string;
  superficieM2: number;
  tipoCambio: number;
  inflacionMensualARS: number;
  duracionMeses: number;
  fechaInicio: string;
  items: ItemObra[];
  updatedAt: string;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "presupuestos_obra_v1";

const CAT_COLORS: Record<CatObra, string> = {
  demolicion: "#ef4444",
  estructura: "#f97316",
  albanileria: "#eab308",
  cubierta: "#22c55e",
  instalaciones_electricas: "#3b82f6",
  instalaciones_sanitarias: "#06b6d4",
  carpinteria: "#8b5cf6",
  revestimientos: "#ec4899",
  pintura: "#14b8a6",
  equipamiento: "#f59e0b",
  honorarios_profesionales: "#6366f1",
  imprevistos: "#9ca3af",
  otro: "#71717a",
};

const CAT_LABELS: Record<CatObra, string> = {
  demolicion: "Demolición",
  estructura: "Estructura",
  albanileria: "Albañilería",
  cubierta: "Cubierta",
  instalaciones_electricas: "Inst. Eléctricas",
  instalaciones_sanitarias: "Inst. Sanitarias",
  carpinteria: "Carpintería",
  revestimientos: "Revestimientos",
  pintura: "Pintura",
  equipamiento: "Equipamiento",
  honorarios_profesionales: "Honorarios Prof.",
  imprevistos: "Imprevistos",
  otro: "Otro",
};

const ALL_CATS: CatObra[] = [
  "demolicion",
  "estructura",
  "albanileria",
  "cubierta",
  "instalaciones_electricas",
  "instalaciones_sanitarias",
  "carpinteria",
  "revestimientos",
  "pintura",
  "equipamiento",
  "honorarios_profesionales",
  "imprevistos",
  "otro",
];

const UNIDADES = ["m2", "ml", "unid", "gl", "kg", "hs", "mes"];

// Plantillas rápidas por categoría
const PLANTILLAS: Partial<Record<CatObra, Omit<ItemObra, "id">[]>> = {
  pintura: [
    { categoria: "pintura", descripcion: "Pintura interior látex 2 manos", cantidad: 1, unidad: "m2", precioUnit: 12, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "pintura", descripcion: "Pintura exterior impermeabilizante", cantidad: 1, unidad: "m2", precioUnit: 18, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "pintura", descripcion: "Enduído + sellador previo", cantidad: 1, unidad: "m2", precioUnit: 5, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "pintura", descripcion: "Pintura esmalte carpintería", cantidad: 1, unidad: "m2", precioUnit: 15, moneda: "USD", porcentajeAvance: 0, notas: "" },
  ],
  albanileria: [
    { categoria: "albanileria", descripcion: "Mampostería ladrillo común", cantidad: 1, unidad: "m2", precioUnit: 45, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "albanileria", descripcion: "Revoques interiores", cantidad: 1, unidad: "m2", precioUnit: 22, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "albanileria", descripcion: "Contrapisos (hormigón pobre)", cantidad: 1, unidad: "m2", precioUnit: 30, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "albanileria", descripcion: "Cielorrasos de yeso", cantidad: 1, unidad: "m2", precioUnit: 35, moneda: "USD", porcentajeAvance: 0, notas: "" },
  ],
  revestimientos: [
    { categoria: "revestimientos", descripcion: "Porcellanato 60x60 colocado", cantidad: 1, unidad: "m2", precioUnit: 55, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "revestimientos", descripcion: "Cerámicos baño (azulejo)", cantidad: 1, unidad: "m2", precioUnit: 40, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "revestimientos", descripcion: "Zócalos perimetrales", cantidad: 1, unidad: "ml", precioUnit: 12, moneda: "USD", porcentajeAvance: 0, notas: "" },
  ],
  instalaciones_electricas: [
    { categoria: "instalaciones_electricas", descripcion: "Tablero eléctrico completo", cantidad: 1, unidad: "gl", precioUnit: 800, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "instalaciones_electricas", descripcion: "Circuitos + bocas (por m²)", cantidad: 1, unidad: "m2", precioUnit: 35, moneda: "USD", porcentajeAvance: 0, notas: "" },
    { categoria: "instalaciones_electricas", descripcion: "Iluminación (artefactos)", cantidad: 1, unidad: "gl", precioUnit: 1200, moneda: "USD", porcentajeAvance: 0, notas: "" },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function presupuestoVacio(): Presupuesto {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    nombre: "Nuevo Presupuesto",
    descripcion: "",
    superficieM2: 100,
    tipoCambio: 1200,
    inflacionMensualARS: 5,
    duracionMeses: 12,
    fechaInicio: hoy,
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

function cargarPresupuestos(): Presupuesto[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Presupuesto[];
  } catch {
    return [];
  }
}

function guardarPresupuestos(lista: Presupuesto[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

// ── Torta SVG ─────────────────────────────────────────────────────────────────

interface TortaSegmento {
  label: string;
  valor: number;
  color: string;
}

function TortaSVG({ segmentos }: { segmentos: TortaSegmento[] }) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  if (total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
        Sin datos
      </div>
    );
  }

  const r = 80;
  const cx = 100;
  const cy = 100;
  let acumulado = 0;

  const arcos = segmentos.map((seg) => {
    const pct = seg.valor / total;
    const inicio = acumulado;
    acumulado += pct;
    const fin = acumulado;

    const startAngle = inicio * 2 * Math.PI - Math.PI / 2;
    const endAngle = fin * 2 * Math.PI - Math.PI / 2;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const largeArc = pct > 0.5 ? 1 : 0;

    const d =
      pct >= 0.9999
        ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { ...seg, d, pct };
  });

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
      <svg width={200} height={200} viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
        {arcos.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="#0a0a0a" strokeWidth={2}>
            <title>{a.label}: {fmt(a.pct * 100, 1)}%</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={40} fill="#0a0a0a" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={700}>
          USD
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={9} fontFamily="Inter, sans-serif">
          total
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 160 }}>
        {arcos.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: a.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", flex: 1 }}>
              {a.label}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>
              {fmt(a.pct * 100, 1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Line Chart SVG ────────────────────────────────────────────────────────────

interface LineChartData {
  mes: number;
  original: number;
  ajustado: number;
}

function LineChartSVG({ data, duracionMeses }: { data: LineChartData[]; duracionMeses: number }) {
  if (data.length === 0) return null;

  const W = 480;
  const H = 220;
  const padLeft = 70;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const maxVal = Math.max(...data.map((d) => Math.max(d.original, d.ajustado)));
  const minVal = 0;
  const range = maxVal - minVal || 1;

  function xPos(mes: number): number {
    return padLeft + (mes / Math.max(duracionMeses, 1)) * chartW;
  }
  function yPos(val: number): number {
    return padTop + chartH - ((val - minVal) / range) * chartH;
  }

  const pathOriginal = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(d.mes)} ${yPos(d.original)}`).join(" ");
  const pathAjustado = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(d.mes)} ${yPos(d.ajustado)}`).join(" ");

  const yTicks = 4;
  const yStep = range / yTicks;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {/* Grid */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = minVal + yStep * i;
        const y = yPos(val);
        return (
          <g key={i}>
            <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <text x={padLeft - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize={10} fontFamily="Inter, sans-serif">
              {val >= 1000000 ? `${fmt(val / 1000000, 1)}M` : val >= 1000 ? `${fmt(val / 1000, 0)}K` : fmt(val, 0)}
            </text>
          </g>
        );
      })}
      {/* X axis ticks */}
      {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0).map((d) => (
        <text key={d.mes} x={xPos(d.mes)} y={H - padBottom + 16} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={10} fontFamily="Inter, sans-serif">
          M{d.mes}
        </text>
      ))}
      {/* Lines */}
      <path d={pathOriginal} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeDasharray="5,4" />
      <path d={pathAjustado} fill="none" stroke="#cc0000" strokeWidth={2.5} />
      {/* Legend */}
      <line x1={padLeft} y1={H - 8} x2={padLeft + 24} y2={H - 8} stroke="rgba(255,255,255,0.3)" strokeWidth={2} strokeDasharray="5,4" />
      <text x={padLeft + 30} y={H - 4} fill="rgba(255,255,255,0.5)" fontSize={10} fontFamily="Inter, sans-serif">Sin inflación</text>
      <line x1={padLeft + 120} y1={H - 8} x2={padLeft + 144} y2={H - 8} stroke="#cc0000" strokeWidth={2.5} />
      <text x={padLeft + 150} y={H - 4} fill="rgba(255,255,255,0.5)" fontSize={10} fontFamily="Inter, sans-serif">Con inflación</text>
    </svg>
  );
}

// ── Estilos base ──────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "white",
    fontFamily: "Inter, sans-serif",
    padding: "24px 16px 60px",
  } as React.CSSProperties,
  heading: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    color: "white",
    margin: 0,
  } as React.CSSProperties,
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 20,
  } as React.CSSProperties,
  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "white",
    padding: "8px 12px",
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  label: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter, sans-serif",
    display: "block",
    marginBottom: 4,
  } as React.CSSProperties,
  btn: {
    background: "#cc0000",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  } as React.CSSProperties,
  btnOutline: {
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    padding: "7px 14px",
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    cursor: "pointer",
  } as React.CSSProperties,
  btnGhost: {
    background: "transparent",
    color: "rgba(255,255,255,0.5)",
    border: "none",
    padding: "4px 8px",
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    cursor: "pointer",
    borderRadius: 6,
  } as React.CSSProperties,
  kpiCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "16px 20px",
    flex: 1,
    minWidth: 150,
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    padding: "10px 20px",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
    background: "transparent",
    color: active ? "white" : "rgba(255,255,255,0.4)",
    transition: "color 0.2s",
  }),
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function PresupuestoObra() {
  // Estado global
  const [lista, setLista] = useState<Presupuesto[]>(() => {
    const cargados = cargarPresupuestos();
    return cargados.length > 0 ? cargados : [presupuestoVacio()];
  });
  const [idxActivo, setIdxActivo] = useState(0);
  const [tab, setTab] = useState<0 | 1 | 2 | 3>(0);
  const [notasGenerales, setNotasGenerales] = useState("");

  // Estado para nuevo ítem / edición
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formItem, setFormItem] = useState<Omit<ItemObra, "id">>({
    categoria: "albanileria",
    descripcion: "",
    cantidad: 1,
    unidad: "m2",
    precioUnit: 0,
    moneda: "USD",
    porcentajeAvance: 0,
    notas: "",
  });

  const uid1 = useId();

  const p = lista[idxActivo] ?? presupuestoVacio();

  // Persistencia
  const persistir = useCallback((nuevaLista: Presupuesto[]) => {
    setLista(nuevaLista);
    guardarPresupuestos(nuevaLista);
  }, []);

  function actualizarPresupuesto(cambios: Partial<Presupuesto>) {
    const nueva = lista.map((x, i) =>
      i === idxActivo ? { ...x, ...cambios, updatedAt: new Date().toISOString() } : x
    );
    persistir(nueva);
  }

  function nuevoPresupuesto() {
    const nuevo = presupuestoVacio();
    nuevo.nombre = `Presupuesto ${lista.length + 1}`;
    const nueva = [...lista, nuevo];
    persistir(nueva);
    setIdxActivo(nueva.length - 1);
  }

  function eliminarPresupuesto(idx: number) {
    if (lista.length <= 1) return;
    const nueva = lista.filter((_, i) => i !== idx);
    persistir(nueva);
    setIdxActivo(Math.min(idxActivo, nueva.length - 1));
  }

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const calcs = useMemo(() => {
    const tc = p.tipoCambio || 1;
    const inflMens = p.inflacionMensualARS / 100;
    const meses = p.duracionMeses || 1;
    const supM2 = p.superficieM2 || 1;

    function factorInflacion(mes: number): number {
      return Math.pow(1 + inflMens, mes);
    }

    function costoARS(item: ItemObra): number {
      const base = item.precioUnit * item.cantidad;
      return item.moneda === "ARS" ? base : base * tc;
    }

    function costoUSD(item: ItemObra): number {
      const base = item.precioUnit * item.cantidad;
      return item.moneda === "USD" ? base : base / tc;
    }

    function costoAjustadoARS(item: ItemObra, mesPromedio: number): number {
      return costoARS(item) * factorInflacion(mesPromedio);
    }

    const mesMedio = meses / 2;

    // Por categoría
    const porCategoria: Partial<Record<CatObra, { items: ItemObra[]; totalUSD: number; totalARS: number; totalAjustadoARS: number }>> = {};
    for (const cat of ALL_CATS) {
      const catItems = p.items.filter((it) => it.categoria === cat);
      if (catItems.length === 0) continue;
      const totalUSD = catItems.reduce((a, it) => a + costoUSD(it), 0);
      const totalARS = catItems.reduce((a, it) => a + costoARS(it), 0);
      const totalAjustadoARS = catItems.reduce((a, it) => a + costoAjustadoARS(it, mesMedio), 0);
      porCategoria[cat] = { items: catItems, totalUSD, totalARS, totalAjustadoARS };
    }

    const totalSinImprevistosUSD = p.items
      .filter((it) => it.categoria !== "imprevistos")
      .reduce((a, it) => a + costoUSD(it), 0);
    const totalConImprevistosUSD = p.items.reduce((a, it) => a + costoUSD(it), 0);
    const totalConImprevistosARS = p.items.reduce((a, it) => a + costoARS(it), 0);
    const totalAjustadoARS = p.items.reduce((a, it) => a + costoAjustadoARS(it, mesMedio), 0);
    const costoPorM2USD = supM2 > 0 ? totalConImprevistosUSD / supM2 : 0;

    // Avance ponderado por costo
    const pesoTotal = totalConImprevistosUSD;
    const avancePromedio =
      pesoTotal > 0
        ? p.items.reduce((a, it) => a + (costoUSD(it) / pesoTotal) * it.porcentajeAvance, 0)
        : 0;

    // Proyección mes a mes
    const proyeccionMeses: LineChartData[] = Array.from({ length: meses + 1 }, (_, mes) => {
      const ajustado = p.items.reduce((a, it) => a + costoAjustadoARS(it, mes), 0);
      return { mes, original: totalConImprevistosARS, ajustado };
    });

    const diferenciaInflacionARS = totalAjustadoARS - totalConImprevistosARS;
    const diferenciaInflacionUSD = diferenciaInflacionARS / tc;

    return {
      porCategoria,
      totalSinImprevistosUSD,
      totalConImprevistosUSD,
      totalConImprevistosARS,
      totalAjustadoARS,
      costoPorM2USD,
      avancePromedio,
      proyeccionMeses,
      diferenciaInflacionARS,
      diferenciaInflacionUSD,
      costoUSD,
      costoARS,
      costoAjustadoARS: (item: ItemObra, mes: number) => costoAjustadoARS(item, mes),
      mesMedio,
    };
  }, [p]);

  // Segmentos torta (máx 7 + otros)
  const segmentosTorta = useMemo((): TortaSegmento[] => {
    const entradas = (Object.keys(calcs.porCategoria) as CatObra[])
      .map((cat) => ({
        label: CAT_LABELS[cat],
        valor: calcs.porCategoria[cat]!.totalUSD,
        color: CAT_COLORS[cat],
      }))
      .sort((a, b) => b.valor - a.valor);

    if (entradas.length <= 7) return entradas;

    const top7 = entradas.slice(0, 7);
    const resto = entradas.slice(7).reduce((a, s) => a + s.valor, 0);
    if (resto > 0) top7.push({ label: "Otros", valor: resto, color: "#4b5563" });
    return top7;
  }, [calcs.porCategoria]);

  // ── Gestión de ítems ──────────────────────────────────────────────────────

  function iniciarNuevoItem() {
    setEditandoId(null);
    setFormItem({
      categoria: "albanileria",
      descripcion: "",
      cantidad: 1,
      unidad: "m2",
      precioUnit: 0,
      moneda: "USD",
      porcentajeAvance: 0,
      notas: "",
    });
    setMostrarForm(true);
  }

  function iniciarEdicion(item: ItemObra) {
    setEditandoId(item.id);
    setFormItem({
      categoria: item.categoria,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      unidad: item.unidad,
      precioUnit: item.precioUnit,
      moneda: item.moneda,
      porcentajeAvance: item.porcentajeAvance,
      notas: item.notas,
    });
    setMostrarForm(true);
  }

  function guardarItem() {
    if (!formItem.descripcion.trim()) return;
    let nuevosItems: ItemObra[];
    if (editandoId) {
      nuevosItems = p.items.map((it) =>
        it.id === editandoId ? { ...formItem, id: editandoId } : it
      );
    } else {
      nuevosItems = [...p.items, { ...formItem, id: uid() }];
    }
    actualizarPresupuesto({ items: nuevosItems });
    setMostrarForm(false);
    setEditandoId(null);
  }

  function eliminarItem(id: string) {
    actualizarPresupuesto({ items: p.items.filter((it) => it.id !== id) });
  }

  function actualizarAvanceItem(id: string, avance: number) {
    const nuevosItems = p.items.map((it) =>
      it.id === id ? { ...it, porcentajeAvance: Math.min(100, Math.max(0, avance)) } : it
    );
    actualizarPresupuesto({ items: nuevosItems });
  }

  function importarPlantilla(cat: CatObra) {
    const plantilla = PLANTILLAS[cat];
    if (!plantilla) return;
    const nuevos: ItemObra[] = plantilla.map((tpl) => ({ ...tpl, id: uid() }));
    actualizarPresupuesto({ items: [...p.items, ...nuevos] });
  }

  // ── PDF Export ────────────────────────────────────────────────────────────

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;

    const filas = p.items
      .map(
        (it) =>
          `<tr>
            <td>${CAT_LABELS[it.categoria]}</td>
            <td>${it.descripcion}</td>
            <td>${fmt(it.cantidad, 2)} ${it.unidad}</td>
            <td>${it.moneda} ${fmt(it.precioUnit, 2)}</td>
            <td>USD ${fmt(calcs.costoUSD(it), 2)}</td>
            <td>${it.porcentajeAvance}%</td>
          </tr>`
      )
      .join("");

    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Presupuesto de Obra — ${p.nombre}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 14px; color: #555; margin-bottom: 16px; font-weight: normal; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #111; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e5e5; }
    tr:nth-child(even) { background: #f9f9f9; }
    .kpis { display: flex; gap: 20px; margin: 16px 0; }
    .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; flex: 1; }
    .kpi-val { font-size: 18px; font-weight: bold; }
    .kpi-label { font-size: 10px; color: #888; }
    .footer { margin-top: 20px; font-size: 10px; color: #999; }
  </style>
</head>
<body>
  <h1>Presupuesto de Obra: ${p.nombre}</h1>
  <h2>${p.descripcion || ""} — ${p.superficieM2} m² — Inicio: ${p.fechaInicio}</h2>
  <div class="kpis">
    <div class="kpi"><div class="kpi-val">USD ${fmt(calcs.totalConImprevistosUSD, 0)}</div><div class="kpi-label">Total con imprevistos</div></div>
    <div class="kpi"><div class="kpi-val">ARS ${fmt(calcs.totalConImprevistosARS, 0)}</div><div class="kpi-label">Total ARS</div></div>
    <div class="kpi"><div class="kpi-val">USD ${fmt(calcs.costoPorM2USD, 0)}/m²</div><div class="kpi-label">Costo por m²</div></div>
    <div class="kpi"><div class="kpi-val">${fmt(calcs.avancePromedio, 1)}%</div><div class="kpi-label">Avance de obra</div></div>
  </div>
  <table>
    <thead><tr><th>Categoría</th><th>Descripción</th><th>Cantidad</th><th>Precio Unit.</th><th>Total USD</th><th>Avance</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr style="font-weight:bold;background:#f0f0f0;">
        <td colspan="4">TOTAL</td>
        <td>USD ${fmt(calcs.totalConImprevistosUSD, 2)}</td>
        <td>${fmt(calcs.avancePromedio, 1)}%</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">Generado el ${new Date().toLocaleDateString("es-AR")} — Tipo de cambio: 1 USD = ARS ${fmt(p.tipoCambio, 0)} — Inflación estimada: ${p.inflacionMensualARS}% mensual</div>
</body>
</html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderResumen() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI Cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={S.kpiCard}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>TOTAL USD</div>
            <div style={{ fontSize: 26, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>
              ${fmt(calcs.totalConImprevistosUSD, 0)}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              sin imprevistos: ${fmt(calcs.totalSinImprevistosUSD, 0)}
            </div>
          </div>
          <div style={S.kpiCard}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>TOTAL ARS</div>
            <div style={{ fontSize: 26, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white" }}>
              ${fmt(calcs.totalConImprevistosARS, 0)}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              TC: ${fmt(p.tipoCambio, 0)} ARS/USD
            </div>
          </div>
          <div style={S.kpiCard}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>COSTO/m²</div>
            <div style={{ fontSize: 26, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "white" }}>
              ${fmt(calcs.costoPorM2USD, 0)}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>USD por m²</div>
          </div>
          <div style={S.kpiCard}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>AVANCE OBRA</div>
            <div style={{ fontSize: 26, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: calcs.avancePromedio > 60 ? "#22c55e" : calcs.avancePromedio > 30 ? "#eab308" : "white" }}>
              {fmt(calcs.avancePromedio, 1)}%
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>ponderado por costo</div>
          </div>
        </div>

        {/* Torta */}
        <div style={S.card}>
          <div style={{ ...S.heading, fontSize: 14, marginBottom: 20 }}>Distribución por categoría</div>
          <TortaSVG segmentos={segmentosTorta} />
        </div>

        {/* Tabla por categoría */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ ...S.heading, fontSize: 14 }}>Por categoría</div>
            <button style={S.btn} onClick={exportarPDF}>
              ↓ PDF
            </button>
          </div>
          {p.items.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center", padding: "32px 0" }}>
              Agregá ítems desde la pestaña Ítems
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Categoría", "Ítems", "Total USD", "Total ARS", "% del total"].map((h) => (
                    <th
                      key={h}
                      style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.08)", fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(calcs.porCategoria) as CatObra[]).map((cat) => {
                  const cd = calcs.porCategoria[cat]!;
                  const pct = calcs.totalConImprevistosUSD > 0 ? (cd.totalUSD / calcs.totalConImprevistosUSD) * 100 : 0;
                  return (
                    <tr key={cat} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px 10px", fontSize: 13 }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: CAT_COLORS[cat], marginRight: 8, verticalAlign: "middle" }} />
                        {CAT_LABELS[cat]}
                      </td>
                      <td style={{ padding: "10px 10px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{cd.items.length}</td>
                      <td style={{ padding: "10px 10px", fontSize: 13 }}>USD {fmt(cd.totalUSD, 0)}</td>
                      <td style={{ padding: "10px 10px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>ARS {fmt(cd.totalARS, 0)}</td>
                      <td style={{ padding: "10px 10px", fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: CAT_COLORS[cat], borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", minWidth: 36, textAlign: "right" }}>{fmt(pct, 1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  function renderItems() {
    const catConItems = ALL_CATS.filter((cat) => calcs.porCategoria[cat]);
    const catSinItems = ALL_CATS.filter((cat) => !calcs.porCategoria[cat]);
    const catsConPlantilla = ALL_CATS.filter((cat) => PLANTILLAS[cat] && !calcs.porCategoria[cat]);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Acciones top */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button style={S.btn} onClick={iniciarNuevoItem}>
            + Agregar Ítem
          </button>
          {catsConPlantilla.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {catsConPlantilla.map((cat) => (
                <button
                  key={cat}
                  style={{ ...S.btnOutline, fontSize: 12 }}
                  onClick={() => importarPlantilla(cat)}
                >
                  + Plantilla {CAT_LABELS[cat]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Formulario inline */}
        {mostrarForm && (
          <div style={{ ...S.card, border: "1px solid rgba(204,0,0,0.4)" }}>
            <div style={{ ...S.heading, fontSize: 14, marginBottom: 16 }}>
              {editandoId ? "Editar ítem" : "Nuevo ítem"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <div>
                <label style={S.label} htmlFor={`${uid1}-cat`}>Categoría</label>
                <select
                  id={`${uid1}-cat`}
                  style={S.input}
                  value={formItem.categoria}
                  onChange={(e) => setFormItem({ ...formItem, categoria: e.target.value as CatObra })}
                >
                  {ALL_CATS.map((c) => (
                    <option key={c} value={c}>{CAT_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={S.label} htmlFor={`${uid1}-desc`}>Descripción *</label>
                <input
                  id={`${uid1}-desc`}
                  style={S.input}
                  value={formItem.descripcion}
                  onChange={(e) => setFormItem({ ...formItem, descripcion: e.target.value })}
                  placeholder="Ej: Mampostería ladrillo 6 huecos"
                />
              </div>
              <div>
                <label style={S.label} htmlFor={`${uid1}-cant`}>Cantidad</label>
                <input
                  id={`${uid1}-cant`}
                  type="number"
                  style={S.input}
                  value={formItem.cantidad}
                  onChange={(e) => setFormItem({ ...formItem, cantidad: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div>
                <label style={S.label} htmlFor={`${uid1}-unid`}>Unidad</label>
                <select
                  id={`${uid1}-unid`}
                  style={S.input}
                  value={formItem.unidad}
                  onChange={(e) => setFormItem({ ...formItem, unidad: e.target.value })}
                >
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  <option value="otro">otro</option>
                </select>
              </div>
              <div>
                <label style={S.label} htmlFor={`${uid1}-precio`}>Precio unitario</label>
                <input
                  id={`${uid1}-precio`}
                  type="number"
                  style={S.input}
                  value={formItem.precioUnit}
                  onChange={(e) => setFormItem({ ...formItem, precioUnit: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div>
                <label style={S.label} htmlFor={`${uid1}-mon`}>Moneda</label>
                <select
                  id={`${uid1}-mon`}
                  style={S.input}
                  value={formItem.moneda}
                  onChange={(e) => setFormItem({ ...formItem, moneda: e.target.value as MonedaItem })}
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div>
                <label style={S.label} htmlFor={`${uid1}-av`}>Avance % (0-100)</label>
                <input
                  id={`${uid1}-av`}
                  type="number"
                  style={S.input}
                  value={formItem.porcentajeAvance}
                  onChange={(e) => setFormItem({ ...formItem, porcentajeAvance: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
                  min={0}
                  max={100}
                />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={S.label} htmlFor={`${uid1}-notas`}>Notas</label>
                <input
                  id={`${uid1}-notas`}
                  style={S.input}
                  value={formItem.notas}
                  onChange={(e) => setFormItem({ ...formItem, notas: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button style={S.btn} onClick={guardarItem}>
                {editandoId ? "Guardar cambios" : "Agregar"}
              </button>
              <button
                style={S.btnOutline}
                onClick={() => { setMostrarForm(false); setEditandoId(null); }}
              >
                Cancelar
              </button>
              {!editandoId && formItem.precioUnit > 0 && (
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", alignSelf: "center", marginLeft: 8 }}>
                  Total: {formItem.moneda} {fmt(formItem.cantidad * formItem.precioUnit, 2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Ítems por categoría */}
        {p.items.length === 0 && !mostrarForm ? (
          <div style={{ ...S.card, textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏗️</div>
            <div style={{ fontSize: 15 }}>Sin ítems. Usá "Agregar Ítem" o una plantilla rápida.</div>
          </div>
        ) : (
          catConItems.map((cat) => {
            const cd = calcs.porCategoria[cat];
            if (!cd) return null;
            const itemsOrdenados = [...cd.items].sort((a, b) => calcs.costoUSD(b) - calcs.costoUSD(a));
            return (
              <div key={cat} style={S.card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: CAT_COLORS[cat] }} />
                    <span style={{ ...S.heading, fontSize: 14 }}>{CAT_LABELS[cat]}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>
                      {itemsOrdenados.length} ítem{itemsOrdenados.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                    USD {fmt(cd.totalUSD, 0)}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {itemsOrdenados.map((item) => {
                    const totalUSD = calcs.costoUSD(item);
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.03)",
                          borderRadius: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Checkbox avance */}
                        <input
                          type="checkbox"
                          checked={item.porcentajeAvance >= 100}
                          onChange={(e) => actualizarAvanceItem(item.id, e.target.checked ? 100 : item.porcentajeAvance > 0 ? item.porcentajeAvance : 0)}
                          style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0, accentColor: "#22c55e" }}
                          title="Marcar como completado"
                          aria-label={`Marcar ${item.descripcion} como completado`}
                        />
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <div style={{ fontSize: 13, color: item.porcentajeAvance >= 100 ? "rgba(255,255,255,0.4)" : "white", textDecoration: item.porcentajeAvance >= 100 ? "line-through" : "none" }}>
                            {item.descripcion}
                          </div>
                          {item.notas && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{item.notas}</div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", minWidth: 100, textAlign: "right" }}>
                          {fmt(item.cantidad, 2)} {item.unidad} × {item.moneda} {fmt(item.precioUnit, 2)}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Montserrat, sans-serif", color: "white", minWidth: 90, textAlign: "right" }}>
                          USD {fmt(totalUSD, 0)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={item.porcentajeAvance}
                            onChange={(e) => actualizarAvanceItem(item.id, parseInt(e.target.value))}
                            style={{ width: 70, accentColor: "#cc0000", cursor: "pointer" }}
                            aria-label={`Avance de ${item.descripcion}`}
                          />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", minWidth: 28 }}>
                            {item.porcentajeAvance}%
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button style={S.btnGhost} onClick={() => iniciarEdicion(item)} title="Editar">✏️</button>
                          <button
                            style={{ ...S.btnGhost, color: "#ef4444" }}
                            onClick={() => { if (confirm(`¿Eliminar "${item.descripcion}"?`)) eliminarItem(item.id); }}
                            title="Eliminar"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Sub total de categoría */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, gap: 16, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>ARS {fmt(cd.totalARS, 0)}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>USD {fmt(cd.totalUSD, 0)}</span>
                </div>
              </div>
            );
          })
        )}

        {/* Plantillas para categorías vacías */}
        {catSinItems.some((c) => PLANTILLAS[c]) && (
          <div style={S.card}>
            <div style={{ ...S.heading, fontSize: 13, marginBottom: 12, color: "rgba(255,255,255,0.5)" }}>
              Plantillas rápidas disponibles
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {catSinItems.filter((c) => PLANTILLAS[c]).map((cat) => (
                <button key={cat} style={{ ...S.btnOutline, fontSize: 12 }} onClick={() => importarPlantilla(cat)}>
                  + {CAT_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderProyeccion() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI inflación */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={S.kpiCard}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>COSTO ORIGINAL ARS</div>
            <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
              ${fmt(calcs.totalConImprevistosARS, 0)}
            </div>
          </div>
          <div style={S.kpiCard}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>COSTO AJUSTADO ARS</div>
            <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#cc0000" }}>
              ${fmt(calcs.totalAjustadoARS, 0)}
            </div>
          </div>
          <div style={S.kpiCard}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>DIFERENCIA POR INFLACIÓN</div>
            <div style={{ fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#ef4444" }}>
              +${fmt(calcs.diferenciaInflacionARS, 0)} ARS
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              ≈ USD {fmt(calcs.diferenciaInflacionUSD, 0)}
            </div>
          </div>
        </div>

        {/* Sugerencia */}
        <div style={{ ...S.card, borderColor: "rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.05)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22 }}>💡</span>
            <div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 4, color: "#eab308" }}>
                Recomendación anti-inflación
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                Comprá materiales en USD (o dolarizados) lo antes posible. Con una inflación del {p.inflacionMensualARS}% mensual durante {p.duracionMeses} meses, el costo en ARS se multiplica por{" "}
                <strong style={{ color: "white" }}>{fmt(Math.pow(1 + p.inflacionMensualARS / 100, p.duracionMeses), 2)}×</strong>.{" "}
                Priorizá estructurales y materiales de larga espera.
              </div>
            </div>
          </div>
        </div>

        {/* Line chart */}
        <div style={S.card}>
          <div style={{ ...S.heading, fontSize: 14, marginBottom: 16 }}>Evolución del costo ARS durante la obra</div>
          {p.items.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px 0" }}>Sin ítems</div>
          ) : (
            <LineChartSVG data={calcs.proyeccionMeses} duracionMeses={p.duracionMeses} />
          )}
        </div>

        {/* Tabla mes a mes */}
        <div style={S.card}>
          <div style={{ ...S.heading, fontSize: 14, marginBottom: 16 }}>Proyección mes a mes</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
              <thead>
                <tr>
                  {["Mes", "Factor inflación", "Costo ARS ajustado", "Costo USD equiv.", "Δ vs original ARS"].map((h) => (
                    <th
                      key={h}
                      style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.08)", fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calcs.proyeccionMeses.map((d) => {
                  const factor = Math.pow(1 + p.inflacionMensualARS / 100, d.mes);
                  const ajustadoARS = calcs.totalConImprevistosARS * factor;
                  const ajustadoUSD = ajustadoARS / p.tipoCambio;
                  const delta = ajustadoARS - calcs.totalConImprevistosARS;
                  return (
                    <tr key={d.mes} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "8px 12px", fontSize: 13 }}>Mes {d.mes}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{fmt(factor, 3)}×</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>ARS {fmt(ajustadoARS, 0)}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>USD {fmt(ajustadoUSD, 0)}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: d.mes === 0 ? "rgba(255,255,255,0.3)" : "#ef4444" }}>
                        {d.mes === 0 ? "—" : `+ARS ${fmt(delta, 0)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderSeguimiento() {
    const completadoUSD = p.items.reduce((a, it) => a + calcs.costoUSD(it) * (it.porcentajeAvance / 100), 0);
    const pendienteUSD = calcs.totalConImprevistosUSD - completadoUSD;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Avance general */}
        <div style={S.card}>
          <div style={{ ...S.heading, fontSize: 14, marginBottom: 16 }}>Avance general de obra</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 20, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
              <div
                style={{
                  width: `${calcs.avancePromedio}%`,
                  height: "100%",
                  background: calcs.avancePromedio >= 100 ? "#22c55e" : "linear-gradient(90deg, #cc0000, #ef4444)",
                  borderRadius: 10,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, minWidth: 64, textAlign: "right" }}>
              {fmt(calcs.avancePromedio, 1)}%
            </span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Ejecutado</div>
              <div style={{ fontSize: 16, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#22c55e" }}>USD {fmt(completadoUSD, 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Pendiente</div>
              <div style={{ fontSize: 16, fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#eab308" }}>USD {fmt(pendienteUSD, 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Total</div>
              <div style={{ fontSize: 16, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>USD {fmt(calcs.totalConImprevistosUSD, 0)}</div>
            </div>
          </div>
        </div>

        {/* Por categoría */}
        <div style={S.card}>
          <div style={{ ...S.heading, fontSize: 14, marginBottom: 16 }}>Por categoría</div>
          {p.items.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "24px 0" }}>Sin ítems</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(Object.keys(calcs.porCategoria) as CatObra[]).map((cat) => {
                const cd = calcs.porCategoria[cat]!;
                const avanceCat =
                  cd.totalUSD > 0
                    ? cd.items.reduce((a, it) => a + (calcs.costoUSD(it) / cd.totalUSD) * it.porcentajeAvance, 0)
                    : 0;
                const ejec = (cd.totalUSD * avanceCat) / 100;
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: CAT_COLORS[cat] }} />
                        <span style={{ fontSize: 13 }}>{CAT_LABELS[cat]}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        <span>Ejecutado: USD {fmt(ejec, 0)}</span>
                        <span style={{ minWidth: 36, textAlign: "right", color: "white" }}>{fmt(avanceCat, 1)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${avanceCat}%`,
                          height: "100%",
                          background: CAT_COLORS[cat],
                          borderRadius: 4,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notas generales */}
        <div style={S.card}>
          <div style={{ ...S.heading, fontSize: 14, marginBottom: 12 }}>Notas de obra</div>
          <textarea
            style={{
              ...S.input,
              minHeight: 120,
              resize: "vertical",
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              lineHeight: 1.6,
            }}
            value={notasGenerales}
            onChange={(e) => setNotasGenerales(e.target.value)}
            placeholder="Registrá observaciones, pendientes, contactos de proveedores, etc."
          />
        </div>
      </div>
    );
  }

  // ── Render principal ──────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/calculadoras" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 12 }}>
            ← Calculadoras
          </Link>
          <h1 style={{ ...S.heading, fontSize: 28, marginBottom: 6 }}>
            Presupuesto de Obra
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: 0 }}>
            Construcción y renovación — ítems por categoría, proyección con inflación, seguimiento de avance
          </p>
        </div>

        {/* Selector de presupuesto */}
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ ...S.heading, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Proyectos:</div>
            {lista.map((pr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <button
                  style={{
                    ...S.btnOutline,
                    borderColor: i === idxActivo ? "rgba(204,0,0,0.6)" : undefined,
                    color: i === idxActivo ? "white" : undefined,
                    fontSize: 13,
                    borderRadius: lista.length > 1 ? "8px 0 0 8px" : 8,
                  }}
                  onClick={() => setIdxActivo(i)}
                >
                  {pr.nombre}
                </button>
                {lista.length > 1 && (
                  <button
                    style={{ ...S.btnGhost, border: "1px solid rgba(255,255,255,0.12)", borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "7px 10px", color: "#ef4444", fontSize: 12 }}
                    onClick={() => { if (confirm(`¿Eliminar "${pr.nombre}"?`)) eliminarPresupuesto(i); }}
                    title="Eliminar presupuesto"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button style={{ ...S.btnOutline, fontSize: 12 }} onClick={nuevoPresupuesto}>
              + Nuevo
            </button>
          </div>

          {/* Config del presupuesto activo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={S.label} htmlFor="pnombre">Nombre del proyecto</label>
              <input
                id="pnombre"
                style={S.input}
                value={p.nombre}
                onChange={(e) => actualizarPresupuesto({ nombre: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={S.label} htmlFor="pdesc">Descripción</label>
              <input
                id="pdesc"
                style={S.input}
                value={p.descripcion}
                onChange={(e) => actualizarPresupuesto({ descripcion: e.target.value })}
                placeholder="Dirección, tipo de obra, etc."
              />
            </div>
            <div>
              <label style={S.label} htmlFor="psup">Superficie total (m²)</label>
              <input
                id="psup"
                type="number"
                style={S.input}
                value={p.superficieM2}
                onChange={(e) => actualizarPresupuesto({ superficieM2: parseFloat(e.target.value) || 0 })}
                min={1}
              />
            </div>
            <div>
              <label style={S.label} htmlFor="ptc">Tipo de cambio (ARS/USD)</label>
              <input
                id="ptc"
                type="number"
                style={S.input}
                value={p.tipoCambio}
                onChange={(e) => actualizarPresupuesto({ tipoCambio: parseFloat(e.target.value) || 1 })}
                min={1}
              />
            </div>
            <div>
              <label style={S.label} htmlFor="pinfl">Inflación mensual ARS (%)</label>
              <input
                id="pinfl"
                type="number"
                style={S.input}
                value={p.inflacionMensualARS}
                onChange={(e) => actualizarPresupuesto({ inflacionMensualARS: parseFloat(e.target.value) || 0 })}
                min={0}
                step={0.1}
              />
            </div>
            <div>
              <label style={S.label} htmlFor="pdur">Duración estimada (meses)</label>
              <input
                id="pdur"
                type="number"
                style={S.input}
                value={p.duracionMeses}
                onChange={(e) => actualizarPresupuesto({ duracionMeses: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>
            <div>
              <label style={S.label} htmlFor="pfinicio">Fecha de inicio</label>
              <input
                id="pfinicio"
                type="date"
                style={S.input}
                value={p.fechaInicio}
                onChange={(e) => actualizarPresupuesto({ fechaInicio: e.target.value })}
              />
            </div>
            <div style={{ alignSelf: "flex-end", fontSize: 11, color: "rgba(255,255,255,0.25)", paddingBottom: 8 }}>
              Actualizado: {new Date(p.updatedAt).toLocaleDateString("es-AR")}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 24, overflowX: "auto" }}>
          {(["Resumen", "Ítems", "Proyección c/ Inflación", "Seguimiento"] as const).map((label, i) => (
            <button key={label} style={S.tab(tab === i)} onClick={() => setTab(i as 0 | 1 | 2 | 3)}>
              {label}
            </button>
          ))}
        </div>

        {/* Contenido de tab */}
        {tab === 0 && renderResumen()}
        {tab === 1 && renderItems()}
        {tab === 2 && renderProyeccion()}
        {tab === 3 && renderSeguimiento()}
      </div>
    </div>
  );
}
