"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoriaObjetivo =
  | "captaciones"
  | "ventas"
  | "alquileres"
  | "honorarios"
  | "contactos"
  | "visitas"
  | "custom";

interface Objetivo {
  id: string;
  categoria: CategoriaObjetivo;
  nombre: string;
  meta: number;
  real: number;
  unidad: string;
  color: string;
}

interface ObjetivoMes {
  id: string;
  anio: number;
  mes: number;
  objetivos: Objetivo[];
  created_at: string;
  updated_at: string;
}

type Tab = "actual" | "historico" | "proyeccion";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "objetivos_crm";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CATEGORIA_EMOJI: Record<CategoriaObjetivo, string> = {
  captaciones: "🏠",
  ventas: "✅",
  alquileres: "🔑",
  honorarios: "💰",
  contactos: "👤",
  visitas: "📅",
  custom: "⭐",
};

const COLORES_DISPONIBLES: { label: string; value: string }[] = [
  { label: "Rojo", value: "#cc0000" },
  { label: "Verde", value: "#22c55e" },
  { label: "Azul", value: "#3b82f6" },
  { label: "Naranja", value: "#f97316" },
  { label: "Amarillo", value: "#eab308" },
];

const OBJETIVOS_DEFAULT: Objetivo[] = [
  { id: "1", categoria: "captaciones", nombre: "Captaciones nuevas", meta: 4, real: 2, unidad: "propiedades", color: "#cc0000" },
  { id: "2", categoria: "ventas", nombre: "Ventas cerradas", meta: 2, real: 1, unidad: "operaciones", color: "#22c55e" },
  { id: "3", categoria: "contactos", nombre: "Nuevos contactos", meta: 20, real: 12, unidad: "contactos", color: "#3b82f6" },
  { id: "4", categoria: "visitas", nombre: "Visitas realizadas", meta: 15, real: 8, unidad: "visitas", color: "#f97316" },
  { id: "5", categoria: "honorarios", nombre: "Honorarios cobrados (USD)", meta: 5000, real: 2800, unidad: "USD", color: "#eab308" },
  { id: "6", categoria: "custom", nombre: "Publicaciones actualizadas", meta: 10, real: 7, unidad: "propiedades", color: "#3b82f6" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function pct(real: number, meta: number): number {
  if (meta === 0) return 0;
  return Math.round((real / meta) * 100);
}

function scoreMes(objetivos: Objetivo[]): number {
  if (objetivos.length === 0) return 0;
  const sum = objetivos.reduce((acc, o) => acc + Math.min(pct(o.real, o.meta), 100), 0);
  return Math.round(sum / objetivos.length);
}

function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

function diasTranscurridos(anio: number, mes: number): number {
  const hoy = new Date();
  const mismoMes = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;
  if (mismoMes) return hoy.getDate();
  const total = diasDelMes(anio, mes);
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const mesDato = new Date(anio, mes - 1, 1);
  if (mesDato < mesActual) return total;
  return 0;
}

function proyectado(real: number, meta: number, anio: number, mes: number): number {
  const transcurridos = diasTranscurridos(anio, mes);
  const total = diasDelMes(anio, mes);
  if (transcurridos === 0) return 0;
  return Math.round((real / transcurridos) * total);
}

function colorScore(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#cc0000";
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function cargarTodos(): ObjetivoMes[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ObjetivoMes[];
  } catch {
    return [];
  }
}

function guardarTodos(lista: ObjetivoMes[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function obtenerOCrearMes(anio: number, mes: number): { mes: ObjetivoMes; lista: ObjetivoMes[] } {
  const lista = cargarTodos();
  const existente = lista.find((m) => m.anio === anio && m.mes === mes);
  if (existente) return { mes: existente, lista };
  const nuevo: ObjetivoMes = {
    id: genId(),
    anio,
    mes,
    objetivos: OBJETIVOS_DEFAULT.map((o) => ({ ...o, id: genId() })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const nuevaLista = [...lista, nuevo];
  guardarTodos(nuevaLista);
  return { mes: nuevo, lista: nuevaLista };
}

function persistirMes(mesDato: ObjetivoMes): ObjetivoMes[] {
  const lista = cargarTodos();
  const idx = lista.findIndex((m) => m.anio === mesDato.anio && m.mes === mesDato.mes);
  const actualizado = { ...mesDato, updated_at: new Date().toISOString() };
  let nuevaLista: ObjetivoMes[];
  if (idx >= 0) {
    nuevaLista = lista.map((m, i) => (i === idx ? actualizado : m));
  } else {
    nuevaLista = [...lista, actualizado];
  }
  guardarTodos(nuevaLista);
  return nuevaLista;
}

// ─── SVG Gauge ───────────────────────────────────────────────────────────────

function Gauge({ score }: { score: number }) {
  // Semi-circle gauge: 180° arc from left to right
  const R = 80;
  const cx = 110;
  const cy = 100;
  const startAngle = Math.PI; // left
  const endAngle = 0; // right
  const clamped = Math.min(score, 100);
  const angle = Math.PI - (clamped / 100) * Math.PI;

  const describeArc = (start: number, end: number) => {
    const x1 = cx + R * Math.cos(start);
    const y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end);
    const y2 = cy + R * Math.sin(end);
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  };

  const needleX = cx + R * Math.cos(angle);
  const needleY = cy + R * Math.sin(angle);
  const col = colorScore(score);

  return (
    <svg width={220} height={130} viewBox="0 0 220 130" style={{ display: "block", margin: "0 auto" }}>
      {/* Background arc */}
      <path
        d={describeArc(startAngle, endAngle)}
        fill="none"
        stroke="#222222"
        strokeWidth={18}
        strokeLinecap="round"
      />
      {/* Progress arc */}
      {clamped > 0 && (
        <path
          d={describeArc(startAngle, angle)}
          fill="none"
          stroke={col}
          strokeWidth={18}
          strokeLinecap="round"
        />
      )}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={col} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill={col} />
      {/* Labels */}
      <text x={cx - R - 8} y={cy + 18} fill="#555" fontSize={10} textAnchor="middle">0%</text>
      <text x={cx + R + 8} y={cy + 18} fill="#555" fontSize={10} textAnchor="middle">100%</text>
      <text x={cx} y={cy - 10} fill={col} fontSize={26} fontWeight={800} textAnchor="middle" fontFamily="Montserrat,sans-serif">
        {score}%
      </text>
      <text x={cx} y={cy + 15} fill="#888" fontSize={11} textAnchor="middle" fontFamily="Inter,sans-serif">
        Score general
      </text>
    </svg>
  );
}

// ─── Bar Chart SVG ────────────────────────────────────────────────────────────

interface MesHistorico {
  label: string;
  score: number;
  logrados: number;
  fallidos: number;
  esMejor: boolean;
}

function BarChart({ datos }: { datos: MesHistorico[] }) {
  const W = 700;
  const H = 300;
  const padLeft = 40;
  const padBottom = 50;
  const padTop = 30;
  const chartW = W - padLeft - 20;
  const chartH = H - padBottom - padTop;
  const n = datos.length;
  const barW = Math.floor((chartW / n) * 0.5);
  const gap = Math.floor(chartW / n);
  const y80 = padTop + chartH - (80 / 100) * chartH;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v) => {
        const yy = padTop + chartH - (v / 100) * chartH;
        return (
          <g key={v}>
            <line x1={padLeft} y1={yy} x2={W - 20} y2={yy} stroke="#1e1e1e" strokeWidth={1} />
            <text x={padLeft - 5} y={yy + 4} fill="#555" fontSize={10} textAnchor="end">{v}%</text>
          </g>
        );
      })}
      {/* 80% target line */}
      <line x1={padLeft} y1={y80} x2={W - 20} y2={y80} stroke="#eab308" strokeWidth={1.5} strokeDasharray="6 3" />
      <text x={W - 18} y={y80 - 4} fill="#eab308" fontSize={9} textAnchor="end">objetivo 80%</text>
      {/* Bars */}
      {datos.map((d, i) => {
        const x = padLeft + i * gap + Math.floor((gap - barW) / 2);
        const barH = Math.max(2, (Math.min(d.score, 100) / 100) * chartH);
        const yBar = padTop + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={yBar} width={barW} height={barH} fill="#cc0000" rx={3} />
            <text x={x + barW / 2} y={yBar - 6} fill="#e0e0e0" fontSize={11} textAnchor="middle">{d.score}%</text>
            <text x={x + barW / 2} y={H - padBottom + 18} fill="#888" fontSize={11} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Modal de edición ─────────────────────────────────────────────────────────

interface ModalEdicionProps {
  objetivos: Objetivo[];
  onGuardar: (objetivos: Objetivo[]) => void;
  onCerrar: () => void;
}

function ModalEdicion({ objetivos, onGuardar, onCerrar }: ModalEdicionProps) {
  const [lista, setLista] = useState<Objetivo[]>(objetivos.map((o) => ({ ...o })));

  const actualizar = (id: string, campo: keyof Objetivo, valor: string | number) => {
    setLista((prev) => prev.map((o) => (o.id === id ? { ...o, [campo]: valor } : o)));
  };

  const agregar = () => {
    const nuevo: Objetivo = {
      id: genId(),
      categoria: "custom",
      nombre: "Nuevo objetivo",
      meta: 10,
      real: 0,
      unidad: "unidades",
      color: "#cc0000",
    };
    setLista((prev) => [...prev, nuevo]);
  };

  const eliminar = (id: string) => {
    setLista((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#111111", border: "1px solid #222222", borderRadius: 12,
        width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto",
        padding: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 20, color: "#e0e0e0", margin: 0 }}>
            Editar metas del mes
          </h2>
          <button onClick={onCerrar} style={{ background: "none", border: "none", color: "#888", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.map((obj) => (
            <div key={obj.id} style={{ background: "#0a0a0a", border: "1px solid #222222", borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={obj.nombre}
                  onChange={(e) => actualizar(obj.id, "nombre", e.target.value)}
                  placeholder="Nombre"
                  style={inputStyle}
                />
                <input
                  type="number"
                  value={obj.meta}
                  onChange={(e) => actualizar(obj.id, "meta", Number(e.target.value))}
                  placeholder="Meta"
                  style={{ ...inputStyle, width: 90 }}
                />
                <input
                  value={obj.unidad}
                  onChange={(e) => actualizar(obj.id, "unidad", e.target.value)}
                  placeholder="Unidad"
                  style={{ ...inputStyle, width: 110 }}
                />
                <select
                  value={obj.color}
                  onChange={(e) => actualizar(obj.id, "color", e.target.value)}
                  style={{ ...inputStyle, width: 110, cursor: "pointer" }}
                >
                  {COLORES_DISPONIBLES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => eliminar(obj.id)}
                  style={{
                    background: "#1a0000", border: "1px solid #440000", borderRadius: 6,
                    color: "#cc4444", padding: "6px 12px", cursor: "pointer", fontSize: 13,
                    fontFamily: "Inter,sans-serif",
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button
            onClick={agregar}
            style={{
              background: "#1a1a2e", border: "1px solid #3b82f6", borderRadius: 8,
              color: "#3b82f6", padding: "10px 18px", cursor: "pointer", fontSize: 14,
              fontFamily: "Inter,sans-serif", fontWeight: 600,
            }}
          >
            + Agregar objetivo
          </button>
          <button
            onClick={() => onGuardar(lista)}
            style={{
              background: "#cc0000", border: "none", borderRadius: 8,
              color: "#fff", padding: "10px 24px", cursor: "pointer", fontSize: 14,
              fontFamily: "Inter,sans-serif", fontWeight: 700, marginLeft: "auto",
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#e0e0e0",
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: "Inter,sans-serif",
  outline: "none",
  flex: 1,
  minWidth: 0,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ObjetivosMensualesPage() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [mesDato, setMesDato] = useState<ObjetivoMes | null>(null);
  const [tab, setTab] = useState<Tab>("actual");
  const [editandoReal, setEditandoReal] = useState<string | null>(null);
  const [valorTemp, setValorTemp] = useState<string>("");
  const [modalEdicion, setModalEdicion] = useState(false);
  const [historico, setHistorico] = useState<MesHistorico[]>([]);

  // Cargar mes actual
  const cargarMes = useCallback((a: number, m: number) => {
    const { mes: dato } = obtenerOCrearMes(a, m);
    setMesDato(dato);
  }, []);

  useEffect(() => {
    cargarMes(anio, mes);
  }, [anio, mes, cargarMes]);

  // Cargar histórico (últimos 6 meses)
  useEffect(() => {
    const todos = cargarTodos();
    const resultado: MesHistorico[] = [];
    let mejorScore = -1;
    let mejorIdx = -1;

    for (let i = 5; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const a = fecha.getFullYear();
      const m = fecha.getMonth() + 1;
      const encontrado = todos.find((x) => x.anio === a && x.mes === m);
      const objs = encontrado ? encontrado.objetivos : [];
      const score = scoreMes(objs);
      const logrados = objs.filter((o) => o.real >= o.meta).length;
      const fallidos = objs.length - logrados;
      resultado.push({
        label: MESES[m - 1].slice(0, 3),
        score,
        logrados,
        fallidos,
        esMejor: false,
      });
      if (score > mejorScore && objs.length > 0) {
        mejorScore = score;
        mejorIdx = resultado.length - 1;
      }
    }
    if (mejorIdx >= 0) resultado[mejorIdx].esMejor = true;
    setHistorico(resultado);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesDato]);

  const navMes = (delta: number) => {
    const fecha = new Date(anio, mes - 1 + delta, 1);
    setAnio(fecha.getFullYear());
    setMes(fecha.getMonth() + 1);
  };

  const guardarReal = (objId: string, valor: number) => {
    if (!mesDato) return;
    const nuevosObjs = mesDato.objetivos.map((o) =>
      o.id === objId ? { ...o, real: Math.max(0, valor) } : o
    );
    const actualizado = { ...mesDato, objetivos: nuevosObjs };
    persistirMes(actualizado);
    setMesDato(actualizado);
    setEditandoReal(null);
  };

  const guardarEdicionMetas = (nuevosObjs: Objetivo[]) => {
    if (!mesDato) return;
    const actualizado = { ...mesDato, objetivos: nuevosObjs };
    persistirMes(actualizado);
    setMesDato(actualizado);
    setModalEdicion(false);
  };

  if (!mesDato) {
    return (
      <div style={{ color: "#e0e0e0", padding: 40, fontFamily: "Inter,sans-serif" }}>Cargando...</div>
    );
  }

  const objetivos = mesDato.objetivos;
  const score = scoreMes(objetivos);
  const completados = objetivos.filter((o) => o.real >= o.meta).length;
  const diasTrans = diasTranscurridos(anio, mes);
  const diasTotal = diasDelMes(anio, mes);

  // ─── Tab 1: Mes actual ────────────────────────────────────────────────────

  const renderActual = () => (
    <div>
      {/* Header mes */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button onClick={() => navMes(-1)} style={navBtnStyle}>◀</button>
        <h2 style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 22, color: "#e0e0e0", margin: 0, minWidth: 200, textAlign: "center" }}>
          {MESES[mes - 1]} {anio}
        </h2>
        <button onClick={() => navMes(1)} style={navBtnStyle}>▶</button>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <div style={kpiCard}>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: "#e0e0e0" }}>
            {completados}/{objetivos.length}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4, fontFamily: "Inter,sans-serif" }}>Objetivos logrados</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: colorScore(score) }}>
            {score}%
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4, fontFamily: "Inter,sans-serif" }}>Score general</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: "#e0e0e0" }}>
            {diasTrans}/{diasTotal}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4, fontFamily: "Inter,sans-serif" }}>Días transcurridos</div>
        </div>
      </div>

      {/* Gauge */}
      <div style={{ background: "#111111", border: "1px solid #222222", borderRadius: 12, padding: "24px 16px", marginBottom: 28, maxWidth: 320 }}>
        <Gauge score={score} />
      </div>

      {/* Cards de objetivos */}
      <div style={{ display: "flex", gap: 14, flexDirection: "column", marginBottom: 24 }}>
        {objetivos.map((obj) => {
          const p = pct(obj.real, obj.meta);
          const logrado = obj.real >= obj.meta;
          const superado = p > 100;
          const barPct = Math.min(p, 100);
          return (
            <div key={obj.id} style={{
              background: "#111111", border: `1px solid ${logrado ? "#1a3a1a" : "#222222"}`,
              borderRadius: 10, padding: "18px 20px",
              boxShadow: logrado ? "0 0 0 1px #22c55e22" : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 20, marginRight: 8 }}>{CATEGORIA_EMOJI[obj.categoria]}</span>
                  <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 15, color: "#e0e0e0" }}>{obj.nombre}</span>
                  <span style={{ fontSize: 11, color: "#555", marginLeft: 8, fontFamily: "Inter,sans-serif" }}>{obj.categoria}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {superado && (
                    <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700, fontFamily: "Inter,sans-serif" }}>🚀 Superado</span>
                  )}
                  {logrado && !superado && (
                    <span style={{
                      background: "#0d2b0d", border: "1px solid #22c55e",
                      color: "#22c55e", fontSize: 11, fontWeight: 700,
                      fontFamily: "Inter,sans-serif", padding: "2px 8px", borderRadius: 6,
                    }}>LOGRADO</span>
                  )}
                </div>
              </div>

              {/* Barra de progreso */}
              <div style={{ height: 8, background: "#222222", borderRadius: 4, marginBottom: 10, overflow: "hidden" }}>
                <div style={{
                  width: `${barPct}%`, height: "100%", borderRadius: 4,
                  background: logrado ? "#22c55e" : obj.color,
                  transition: "width 0.4s ease",
                }} />
              </div>

              {/* Real / meta + edición */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#888", fontFamily: "Inter,sans-serif" }}>
                  Meta: <strong style={{ color: "#e0e0e0" }}>{obj.meta.toLocaleString("es-AR")} {obj.unidad}</strong>
                </span>
                <span style={{ fontSize: 12, color: "#888", fontFamily: "Inter,sans-serif" }}>
                  Real:{" "}
                  {editandoReal === obj.id ? (
                    <input
                      autoFocus
                      type="number"
                      value={valorTemp}
                      onChange={(e) => setValorTemp(e.target.value)}
                      onBlur={() => guardarReal(obj.id, Number(valorTemp))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") guardarReal(obj.id, Number(valorTemp));
                        if (e.key === "Escape") setEditandoReal(null);
                      }}
                      style={{
                        background: "#1a1a1a", border: "1px solid #cc0000", borderRadius: 4,
                        color: "#e0e0e0", padding: "2px 6px", fontSize: 13, width: 80,
                        fontFamily: "Inter,sans-serif", outline: "none",
                      }}
                    />
                  ) : (
                    <strong
                      style={{ color: obj.color, cursor: "pointer", textDecoration: "underline dotted" }}
                      onClick={() => { setEditandoReal(obj.id); setValorTemp(String(obj.real)); }}
                      title="Clic para editar"
                    >
                      {obj.real.toLocaleString("es-AR")} {obj.unidad}
                    </strong>
                  )}
                </span>
                <span style={{
                  marginLeft: "auto", fontFamily: "Montserrat,sans-serif", fontWeight: 800,
                  fontSize: 16, color: logrado ? "#22c55e" : colorScore(p),
                }}>
                  {p}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setModalEdicion(true)}
        style={{
          background: "#1a1a1a", border: "1px solid #333", borderRadius: 8,
          color: "#e0e0e0", padding: "10px 22px", cursor: "pointer",
          fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 14,
        }}
      >
        ✏️ Editar metas
      </button>
    </div>
  );

  // ─── Tab 2: Evolución histórica ───────────────────────────────────────────

  const renderHistorico = () => (
    <div>
      <h2 style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 20, color: "#e0e0e0", marginBottom: 24 }}>
        Evolución histórica — últimos 6 meses
      </h2>

      {/* Gráfico de barras */}
      <div style={{ background: "#111111", border: "1px solid #222222", borderRadius: 12, padding: "20px 16px", marginBottom: 28, overflowX: "auto" }}>
        <BarChart datos={historico} />
      </div>

      {/* Tabla */}
      <div style={{ background: "#111111", border: "1px solid #222222", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter,sans-serif", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#0a0a0a", borderBottom: "1px solid #222222" }}>
              {["Mes", "Score", "Logrados", "Fallidos"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", color: "#888", fontWeight: 600, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {historico.map((d, i) => (
              <tr key={i} style={{
                borderBottom: "1px solid #1a1a1a",
                background: d.esMejor ? "rgba(234,179,8,0.06)" : "transparent",
                outline: d.esMejor ? "2px solid #eab308" : "none",
              }}>
                <td style={{ padding: "12px 16px", color: "#e0e0e0", fontWeight: d.esMejor ? 700 : 400 }}>
                  {d.label} {d.esMejor && <span style={{ fontSize: 11, color: "#eab308", marginLeft: 6 }}>⭐ mejor mes</span>}
                </td>
                <td style={{ padding: "12px 16px", color: colorScore(d.score), fontWeight: 700 }}>{d.score}%</td>
                <td style={{ padding: "12px 16px", color: "#22c55e" }}>{d.logrados}</td>
                <td style={{ padding: "12px 16px", color: d.fallidos > 0 ? "#cc0000" : "#555" }}>{d.fallidos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Tab 3: Proyección ────────────────────────────────────────────────────

  const renderProyeccion = () => {
    const enRiesgo = objetivos.filter((o) => {
      const p = proyectado(o.real, o.meta, anio, mes);
      const pctProyectado = o.meta > 0 ? (p / o.meta) * 100 : 0;
      const aMitad = diasTrans >= Math.floor(diasTotal / 2);
      return aMitad && pctProyectado < 70 && o.real < o.meta;
    });

    return (
      <div>
        <h2 style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 20, color: "#e0e0e0", marginBottom: 8 }}>
          Proyección y análisis
        </h2>
        <p style={{ color: "#888", fontFamily: "Inter,sans-serif", fontSize: 13, marginBottom: 24 }}>
          Basado en {diasTrans} días transcurridos de {diasTotal} en {MESES[mes - 1]} {anio}.
        </p>

        {/* Alerta en riesgo */}
        {enRiesgo.length > 0 && (
          <div style={{
            background: "#1a0a0a", border: "1px solid #cc0000", borderRadius: 10,
            padding: "16px 20px", marginBottom: 24,
          }}>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 15, color: "#cc0000", marginBottom: 8 }}>
              ⚠️ Objetivos en riesgo
            </div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#e0e0e0", fontFamily: "Inter,sans-serif", fontSize: 13 }}>
              {enRiesgo.map((o) => (
                <li key={o.id}>{o.nombre} — proyección insuficiente a mitad de mes</li>
              ))}
            </ul>
          </div>
        )}

        {/* Ritmo actual — cards */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
          {objetivos.map((obj) => {
            const proy = proyectado(obj.real, obj.meta, anio, mes);
            const alcanza = proy >= obj.meta;
            return (
              <div key={obj.id} style={{
                background: "#111111", border: `1px solid ${alcanza ? "#1a3a1a" : "#3a1a1a"}`,
                borderRadius: 10, padding: "16px 18px", minWidth: 220, flex: "1 1 220px",
              }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 14, color: "#e0e0e0", marginBottom: 6 }}>
                  {CATEGORIA_EMOJI[obj.categoria]} {obj.nombre}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "Montserrat,sans-serif", color: alcanza ? "#22c55e" : "#cc0000" }}>
                  {proy.toLocaleString("es-AR")} <span style={{ fontSize: 12 }}>{obj.unidad}</span>
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 4, fontFamily: "Inter,sans-serif" }}>
                  proyectado a fin de mes
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, fontFamily: "Inter,sans-serif",
                    color: alcanza ? "#22c55e" : "#cc0000",
                    background: alcanza ? "#0d2b0d" : "#1a0a0a",
                    padding: "3px 8px", borderRadius: 6,
                    border: `1px solid ${alcanza ? "#22c55e55" : "#cc000055"}`,
                  }}>
                    {alcanza ? "En camino ✓" : "En riesgo ✗"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabla de análisis */}
        <div style={{ background: "#111111", border: "1px solid #222222", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter,sans-serif", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0a0a0a", borderBottom: "1px solid #222222" }}>
                {["Objetivo", "Meta", "Real", "Proyectado", "Estado"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", color: "#888", fontWeight: 600, textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {objetivos.map((obj) => {
                const proy = proyectado(obj.real, obj.meta, anio, mes);
                const logrado = obj.real >= obj.meta;
                const alcanza = proy >= obj.meta;
                let estado: string;
                let estadoColor: string;
                if (logrado) { estado = "Logrado"; estadoColor = "#22c55e"; }
                else if (alcanza) { estado = "En camino"; estadoColor = "#22c55e"; }
                else { estado = "En riesgo"; estadoColor = "#cc0000"; }
                return (
                  <tr key={obj.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "11px 14px", color: "#e0e0e0" }}>{CATEGORIA_EMOJI[obj.categoria]} {obj.nombre}</td>
                    <td style={{ padding: "11px 14px", color: "#888" }}>{obj.meta.toLocaleString("es-AR")} {obj.unidad}</td>
                    <td style={{ padding: "11px 14px", color: obj.color, fontWeight: 700 }}>{obj.real.toLocaleString("es-AR")}</td>
                    <td style={{ padding: "11px 14px", color: alcanza || logrado ? "#22c55e" : "#cc4444" }}>{proy.toLocaleString("es-AR")}</td>
                    <td style={{ padding: "11px 14px", color: estadoColor, fontWeight: 700 }}>{estado}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: "#0a0a0a", minHeight: "100vh", color: "#e0e0e0",
      fontFamily: "Inter,sans-serif", padding: "28px 24px",
    }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 28,
          color: "#e0e0e0", margin: "0 0 6px",
        }}>
          🎯 Objetivos Mensuales
        </h1>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          Seguimiento de metas y progreso del corredor
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 32, borderBottom: "1px solid #222222", paddingBottom: 0 }}>
        {([ ["actual", "📊 Mes actual"], ["historico", "📈 Evolución"], ["proyeccion", "🔮 Proyección"] ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "Montserrat,sans-serif", fontWeight: tab === id ? 800 : 600,
              fontSize: 14, color: tab === id ? "#e0e0e0" : "#555",
              padding: "10px 18px",
              borderBottom: tab === id ? "2px solid #cc0000" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "actual" && renderActual()}
      {tab === "historico" && renderHistorico()}
      {tab === "proyeccion" && renderProyeccion()}

      {/* Modal edición */}
      {modalEdicion && (
        <ModalEdicion
          objetivos={objetivos}
          onGuardar={guardarEdicionMetas}
          onCerrar={() => setModalEdicion(false)}
        />
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  background: "#111111", border: "1px solid #222222", borderRadius: 8,
  color: "#e0e0e0", width: 36, height: 36, cursor: "pointer",
  fontFamily: "Inter,sans-serif", fontSize: 16, display: "flex",
  alignItems: "center", justifyContent: "center",
};

const kpiCard: React.CSSProperties = {
  background: "#111111", border: "1px solid #222222", borderRadius: 10,
  padding: "16px 24px", flex: "1 1 120px",
};
