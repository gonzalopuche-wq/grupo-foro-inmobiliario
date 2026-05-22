"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoCobro = "pendiente" | "parcial" | "cobrado" | "vencido" | "incobrable";

interface CuotaHonorario {
  numero: number;
  monto: number;
  fechaVencimiento: string;
  fechaCobro?: string;
  cobrado: boolean;
}

interface HonorarioExtra {
  negocio_id: string;
  cuotas: CuotaHonorario[];
  notas: string;
  estado: EstadoCobro;
}

interface NegocioRaw {
  id: string;
  titulo: string;
  tipo_operacion: string | null;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  split_pct: number | null;
  fecha_cierre: string | null;
  updated_at: string;
  crm_contactos: { nombre: string; apellido: string }[] | { nombre: string; apellido: string } | null;
}

interface ResumenHonorario {
  negocio_id: string;
  titulo: string;
  contacto: string;
  honorariosTotal: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
  estado: EstadoCobro;
  proximaFecha?: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const LS_KEY = "crm_honorarios_v1";
const ESTADO_META: Record<EstadoCobro, { label: string; color: string; bg: string }> = {
  pendiente:   { label: "Pendiente",    color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  parcial:     { label: "Parcial",      color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  cobrado:     { label: "Cobrado",      color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  vencido:     { label: "Vencido",      color: "#cc0000", bg: "rgba(204,0,0,0.12)"     },
  incobrable:  { label: "Incobrable",   color: "#7f1d1d", bg: "rgba(127,29,29,0.18)"   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtFecha(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadLS(): Record<string, HonorarioExtra> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveLS(data: Record<string, HonorarioExtra>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function cuotasDefault(total: number, fechaBase: string): CuotaHonorario[] {
  return [
    {
      numero: 1,
      monto: total * 0.5,
      fechaVencimiento: addDays(fechaBase, 30),
      cobrado: false,
    },
    {
      numero: 2,
      monto: total * 0.5,
      fechaVencimiento: addDays(fechaBase, 60),
      cobrado: false,
    },
  ];
}

function calcularEstado(cuotas: CuotaHonorario[], overrideIncobrable?: boolean): EstadoCobro {
  if (overrideIncobrable) return "incobrable";
  if (cuotas.length === 0) return "pendiente";
  const todas = cuotas.every(c => c.cobrado);
  if (todas) return "cobrado";
  const alguna = cuotas.some(c => c.cobrado);
  const hoyStr = hoy();
  const hayVencida = cuotas.some(c => !c.cobrado && c.fechaVencimiento < hoyStr);
  if (hayVencida) return "vencido";
  if (alguna) return "parcial";
  return "pendiente";
}

function calcularResumen(
  neg: NegocioRaw,
  extra: HonorarioExtra | undefined,
  tipoCambio: number
): ResumenHonorario {
  const precio = neg.valor_operacion ?? 0;
  const honPct = neg.honorarios_pct ?? 3;
  const splitPct = neg.split_pct ?? 0;
  const totalUSD = precio * (honPct / 100) * (1 - splitPct / 100);
  const honorariosTotal = neg.moneda === "USD" ? totalUSD * tipoCambio : totalUSD;

  const fechaBase = neg.fecha_cierre ?? hoy();
  const cuotas = extra?.cuotas ?? cuotasDefault(honorariosTotal, fechaBase);
  const isIncobrable = extra?.estado === "incobrable";

  const hoyStr = hoy();
  const cobrado = cuotas.filter(c => c.cobrado).reduce((s, c) => s + c.monto, 0);
  const vencido = cuotas
    .filter(c => !c.cobrado && c.fechaVencimiento < hoyStr)
    .reduce((s, c) => s + c.monto, 0);
  const pendiente = cuotas
    .filter(c => !c.cobrado && c.fechaVencimiento >= hoyStr)
    .reduce((s, c) => s + c.monto, 0);

  const proximaFecha = cuotas
    .filter(c => !c.cobrado)
    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))[0]
    ?.fechaVencimiento;

  const estado = isIncobrable ? "incobrable" : calcularEstado(cuotas);
  const contactoRaw = Array.isArray(neg.crm_contactos) ? neg.crm_contactos[0] : neg.crm_contactos;
  const contacto = contactoRaw
    ? `${contactoRaw.nombre} ${contactoRaw.apellido}`
    : "Sin contacto";

  return {
    negocio_id: neg.id,
    titulo: neg.titulo,
    contacto,
    honorariosTotal,
    cobrado,
    pendiente,
    vencido,
    estado,
    proximaFecha,
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function GestionHonorariosPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<NegocioRaw[]>([]);
  const [extras, setExtras] = useState<Record<string, HonorarioExtra>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"resumen" | "detalle" | "proyeccion">("resumen");
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [negocioSelId, setNegocioSelId] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);

  const showToast = useCallback((msg: string, tipo: "ok" | "err" = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // Cargar datos
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      setUid(data.user.id);
      supabase
        .from("crm_negocios")
        .select("id, titulo, tipo_operacion, valor_operacion, moneda, honorarios_pct, split_pct, fecha_cierre, updated_at, crm_contactos(nombre, apellido)")
        .eq("etapa", "cerrado")
        .eq("perfil_id", data.user.id)
        .order("updated_at", { ascending: false })
        .then(({ data: rows }) => {
          const raw = (rows ?? []) as NegocioRaw[];
          setNegocios(raw);
          if (raw.length > 0) setNegocioSelId(raw[0].id);
          setLoading(false);
        });
    });
    setExtras(loadLS());
  }, []);

  // Guardar extras en localStorage
  const updateExtra = useCallback((negocioId: string, patch: Partial<HonorarioExtra>) => {
    setExtras(prev => {
      const defaults: HonorarioExtra = {
        negocio_id: negocioId,
        cuotas: [],
        notas: "",
        estado: "pendiente",
      };
      const next: Record<string, HonorarioExtra> = {
        ...prev,
        [negocioId]: { ...defaults, ...prev[negocioId], ...patch },
      };
      saveLS(next);
      return next;
    });
  }, []);

  // Resúmenes calculados
  const resumenes = useMemo<ResumenHonorario[]>(() =>
    negocios.map(n => calcularResumen(n, extras[n.id], tipoCambio)),
    [negocios, extras, tipoCambio]
  );

  // KPIs globales
  const kpis = useMemo(() => {
    const total    = resumenes.reduce((s, r) => s + r.honorariosTotal, 0);
    const cobrado  = resumenes.reduce((s, r) => s + r.cobrado, 0);
    const pendiente = resumenes.reduce((s, r) => s + r.pendiente, 0);
    const vencido  = resumenes.reduce((s, r) => s + r.vencido, 0);
    return { total, cobrado, pendiente, vencido };
  }, [resumenes]);

  // Negocio seleccionado para detalle
  const negSel = useMemo(() => negocios.find(n => n.id === negocioSelId), [negocios, negocioSelId]);
  const extraSel = negSel ? extras[negSel.id] : undefined;
  const resumenSel = negSel ? calcularResumen(negSel, extraSel, tipoCambio) : null;

  // Cuotas del negocio seleccionado (con default si no hay)
  const cuotasSel = useMemo<CuotaHonorario[]>(() => {
    if (!negSel) return [];
    const fechaBase = negSel.fecha_cierre ?? hoy();
    const precio = negSel.valor_operacion ?? 0;
    const honPct = negSel.honorarios_pct ?? 3;
    const splitPct = negSel.split_pct ?? 0;
    const totalUSD = precio * (honPct / 100) * (1 - splitPct / 100);
    const total = negSel.moneda === "USD" ? totalUSD * tipoCambio : totalUSD;
    return extraSel?.cuotas ?? cuotasDefault(total, fechaBase);
  }, [negSel, extraSel, tipoCambio]);

  // Timeline: todas las cuotas de todos los negocios para proyección
  const timelineItems = useMemo(() => {
    const items: Array<{
      negocioId: string;
      titulo: string;
      cuota: CuotaHonorario;
    }> = [];
    negocios.forEach(neg => {
      const extra = extras[neg.id];
      const fechaBase = neg.fecha_cierre ?? hoy();
      const precio = neg.valor_operacion ?? 0;
      const honPct = neg.honorarios_pct ?? 3;
      const splitPct = neg.split_pct ?? 0;
      const totalUSD = precio * (honPct / 100) * (1 - splitPct / 100);
      const total = neg.moneda === "USD" ? totalUSD * tipoCambio : totalUSD;
      const cuotas = extra?.cuotas ?? cuotasDefault(total, fechaBase);
      cuotas.forEach(c => items.push({ negocioId: neg.id, titulo: neg.titulo, cuota: c }));
    });
    return items.sort((a, b) => a.cuota.fechaVencimiento.localeCompare(b.cuota.fechaVencimiento));
  }, [negocios, extras, tipoCambio]);

  // ── Acciones detalle ───────────────────────────────────────────────────────

  const marcarCobrado = (idx: number, checked: boolean, fechaCobro?: string) => {
    if (!negSel) return;
    const nuevas = cuotasSel.map((c, i) =>
      i === idx ? { ...c, cobrado: checked, fechaCobro: checked ? (fechaCobro ?? hoy()) : undefined } : c
    );
    const estado = calcularEstado(nuevas, extraSel?.estado === "incobrable");
    updateExtra(negSel.id, { cuotas: nuevas, estado });
    showToast(checked ? "Cuota marcada como cobrada" : "Cuota desmarcada");
  };

  const actualizarCuota = (idx: number, campo: keyof CuotaHonorario, valor: string | number | boolean) => {
    if (!negSel) return;
    const nuevas = cuotasSel.map((c, i) =>
      i === idx ? { ...c, [campo]: valor } : c
    );
    updateExtra(negSel.id, { cuotas: nuevas });
  };

  const agregarCuota = () => {
    if (!negSel) return;
    const ultima = cuotasSel[cuotasSel.length - 1];
    const nuevaFecha = ultima ? addDays(ultima.fechaVencimiento, 30) : addDays(hoy(), 30);
    const nuevas: CuotaHonorario[] = [
      ...cuotasSel,
      { numero: cuotasSel.length + 1, monto: 0, fechaVencimiento: nuevaFecha, cobrado: false },
    ];
    updateExtra(negSel.id, { cuotas: nuevas });
  };

  const marcarIncobrable = () => {
    if (!negSel) return;
    if (!confirm("¿Marcar este honorario como incobrable? Esta acción es reversible.")) return;
    updateExtra(negSel.id, { estado: "incobrable" });
    showToast("Marcado como incobrable", "err");
  };

  const guardarNotas = (notas: string) => {
    if (!negSel) return;
    updateExtra(negSel.id, { notas });
  };

  // ── Donut SVG ──────────────────────────────────────────────────────────────

  const DonutChart = () => {
    const cx = 110; const cy = 110; const r = 80; const stroke = 24;
    const total = kpis.cobrado + kpis.pendiente + kpis.vencido;
    if (total === 0) {
      return (
        <svg width={220} height={220} viewBox="0 0 220 220">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <text x={cx} y={cy + 5} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={12} fontFamily="Montserrat,sans-serif">Sin datos</text>
        </svg>
      );
    }
    const circumference = 2 * Math.PI * r;
    const segments: Array<{ value: number; color: string; label: string }> = [
      { value: kpis.cobrado,  color: "#22c55e", label: "Cobrado"  },
      { value: kpis.pendiente, color: "#f59e0b", label: "Pendiente" },
      { value: kpis.vencido,  color: "#cc0000", label: "Vencido"  },
    ].filter(s => s.value > 0);

    let offset = 0;
    const paths = segments.map(seg => {
      const pct = seg.value / total;
      const dash = pct * circumference;
      const gap = circumference - dash;
      const startOffset = circumference - offset * circumference;
      offset += pct;
      return { ...seg, dash, gap, startOffset };
    });

    const pctCobrado = total > 0 ? Math.round((kpis.cobrado / total) * 100) : 0;

    return (
      <svg width={220} height={220} viewBox="0 0 220 220">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
        {paths.map((p, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={p.color}
            strokeWidth={stroke}
            strokeDasharray={`${p.dash} ${p.gap}`}
            strokeDashoffset={p.startOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize={22} fontFamily="Montserrat,sans-serif" fontWeight="800">{pctCobrado}%</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={11} fontFamily="Inter,sans-serif">cobrado</text>
      </svg>
    );
  };

  // ── Timeline SVG ─────────────────────────────────────────────────────────

  const TimelineChart = () => {
    const todayStr = hoy();
    const endDate = addDays(todayStr, 90);
    const relevant = timelineItems.filter(
      item => item.cuota.fechaVencimiento >= todayStr && item.cuota.fechaVencimiento <= endDate
    );

    // Agrupar por fecha
    const byDate: Record<string, { monto: number; cobrado: boolean }[]> = {};
    relevant.forEach(item => {
      const k = item.cuota.fechaVencimiento;
      if (!byDate[k]) byDate[k] = [];
      byDate[k].push({ monto: item.cuota.monto, cobrado: item.cuota.cobrado });
    });

    // También agregar vencidos (antes de hoy)
    const vencidos = timelineItems.filter(
      item => !item.cuota.cobrado && item.cuota.fechaVencimiento < todayStr
    );
    vencidos.forEach(item => {
      const k = item.cuota.fechaVencimiento;
      if (!byDate[k]) byDate[k] = [];
      byDate[k].push({ monto: item.cuota.monto, cobrado: false });
    });

    const fechas = Object.keys(byDate).sort();
    if (fechas.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontFamily: "Inter,sans-serif", fontSize: 13 }}>
          Sin cuotas en los próximos 90 días
        </div>
      );
    }

    // SVG timeline
    const W = 680; const H = 160; const pad = 40;
    const innerW = W - pad * 2;
    const today = new Date(todayStr + "T12:00").getTime();
    const end90  = new Date(endDate  + "T12:00").getTime();
    const allFechas = fechas;
    const maxMonto = Math.max(...fechas.map(f => byDate[f].reduce((s, e) => s + e.monto, 0)), 1);

    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H + 60}`} style={{ display: "block" }}>
        {/* Eje X */}
        <line x1={pad} y1={H} x2={W - pad} y2={H} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        {/* Hoy */}
        <line x1={pad} y1={20} x2={pad} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 3" />
        <text x={pad} y={14} fill="rgba(255,255,255,0.4)" fontSize={9} fontFamily="Inter,sans-serif" textAnchor="middle">Hoy</text>

        {allFechas.map(fecha => {
          const entries = byDate[fecha];
          const montoTotal = entries.reduce((s, e) => s + e.monto, 0);
          const esCobrado = entries.every(e => e.cobrado);
          const esVencido = fecha < todayStr;
          const color = esCobrado ? "#22c55e" : esVencido ? "#cc0000" : "#f59e0b";

          const ts = new Date(fecha + "T12:00").getTime();
          let xPos: number;
          if (esVencido) {
            xPos = pad - 20;
          } else {
            xPos = pad + ((ts - today) / (end90 - today)) * innerW;
          }

          const barH = Math.max(8, (montoTotal / maxMonto) * (H - 30));
          const barW = 14;
          const x = Math.max(pad, Math.min(W - pad - barW, xPos - barW / 2));
          const y = H - barH;

          return (
            <g key={fecha}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} rx={3} opacity={0.85} />
              <text x={x + barW / 2} y={H + 14} fill="rgba(255,255,255,0.4)" fontSize={8} fontFamily="Inter,sans-serif" textAnchor="middle" transform={`rotate(-45 ${x + barW / 2} ${H + 14})`}>
                {fmtFecha(fecha)}
              </text>
              <text x={x + barW / 2} y={y - 4} fill={color} fontSize={8} fontFamily="Montserrat,sans-serif" textAnchor="middle">
                {fmtARS(montoTotal)}
              </text>
            </g>
          );
        })}

        {/* Etiqueta +90d */}
        <text x={W - pad} y={H + 14} fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="Inter,sans-serif" textAnchor="end">+90 días</text>
      </svg>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    borderRadius: 20,
    border: "none",
    cursor: "pointer",
    fontFamily: "Montserrat,sans-serif",
    fontSize: 12,
    fontWeight: 700,
    background: active ? "#cc0000" : "rgba(255,255,255,0.06)",
    color: active ? "#fff" : "rgba(255,255,255,0.45)",
    transition: "background 0.2s",
  });

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "18px 20px",
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7,
    color: "#fff",
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "Inter,sans-serif",
    outline: "none",
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 80px", fontFamily: "Inter,sans-serif", color: "#fff" }}>
      <style>{`
        .gh-input { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:7px; color:#fff; padding:7px 10px; font-size:12px; font-family:Inter,sans-serif; outline:none; }
        .gh-input:focus { border-color:rgba(204,0,0,0.4); }
        .gh-table { width:100%; border-collapse:collapse; }
        .gh-table th { padding:10px 12px; text-align:left; font-size:10px; font-family:Montserrat,sans-serif; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.3); border-bottom:1px solid rgba(255,255,255,0.07); }
        .gh-table td { padding:10px 12px; font-size:12px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle; }
        .gh-table tr:last-child td { border-bottom:none; }
        .gh-table tr:hover td { background:rgba(255,255,255,0.02); }
        .gh-check { width:16px; height:16px; accent-color:#22c55e; cursor:pointer; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, padding: "10px 20px",
          borderRadius: 8, fontSize: 13, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
          zIndex: 9999,
          background: toast.tipo === "err" ? "rgba(204,0,0,0.15)" : "rgba(34,197,94,0.15)",
          border: `1px solid ${toast.tipo === "err" ? "rgba(204,0,0,0.4)" : "rgba(34,197,94,0.4)"}`,
          color: toast.tipo === "err" ? "#cc0000" : "#22c55e",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>
          CRM — Operaciones Cerradas
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#fff", margin: 0 }}>
            Gestión de Honorarios
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
              USD 1 =
            </span>
            <input
              type="number"
              value={tipoCambio}
              onChange={e => setTipoCambio(Number(e.target.value))}
              style={{ ...inputStyle, width: 90, textAlign: "right" }}
            />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>ARS</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
          {negocios.length} operación{negocios.length !== 1 ? "es" : ""} cerrada{negocios.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
        <button style={tabStyle(tab === "resumen")}    onClick={() => setTab("resumen")}>Resumen</button>
        <button style={tabStyle(tab === "detalle")}    onClick={() => setTab("detalle")}>Detalle por negocio</button>
        <button style={tabStyle(tab === "proyeccion")} onClick={() => setTab("proyeccion")}>Proyección de cobros</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Cargando...</div>
      ) : negocios.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>Sin operaciones cerradas</div>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 6 }}>Las operaciones cerradas aparecerán aquí</div>
        </div>
      ) : (
        <>
          {/* ── TAB: RESUMEN ───────────────────────────────────────────── */}
          {tab === "resumen" && (
            <div>
              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12, marginBottom: 28 }}>
                {[
                  { label: "Total Honorarios Facturados", valor: fmtARS(kpis.total), color: "#fff" },
                  { label: "Cobrado", valor: fmtARS(kpis.cobrado), color: "#22c55e" },
                  { label: "Pendiente", valor: fmtARS(kpis.pendiente), color: "#f59e0b" },
                  { label: "Vencido", valor: fmtARS(kpis.vencido), color: "#cc0000" },
                ].map(k => (
                  <div key={k.label} style={cardStyle}>
                    <div style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                      {k.label}
                    </div>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1 }}>
                      {k.valor}
                    </div>
                  </div>
                ))}
              </div>

              {/* Donut + Tabla */}
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, marginBottom: 28, alignItems: "start" }}>
                {/* Donut */}
                <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <DonutChart />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, width: "100%" }}>
                    {[
                      { label: "Cobrado",   color: "#22c55e", val: kpis.cobrado   },
                      { label: "Pendiente", color: "#f59e0b", val: kpis.pendiente },
                      { label: "Vencido",   color: "#cc0000", val: kpis.vencido   },
                    ].map(l => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                        <span>{l.label}</span>
                        <span style={{ marginLeft: "auto", color: l.color, fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 11 }}>
                          {fmtARS(l.val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabla */}
                <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                  <table className="gh-table">
                    <thead>
                      <tr>
                        <th>Negocio</th>
                        <th>Contacto</th>
                        <th>Total Hon.</th>
                        <th>Cobrado</th>
                        <th>Pendiente</th>
                        <th>Vencido</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenes.map(r => {
                        const meta = ESTADO_META[r.estado];
                        return (
                          <tr key={r.negocio_id}>
                            <td>
                              <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.titulo}</div>
                              {r.proximaFecha && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Vence: {fmtFecha(r.proximaFecha)}</div>}
                            </td>
                            <td style={{ color: "rgba(255,255,255,0.5)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contacto}</td>
                            <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff" }}>{fmtARS(r.honorariosTotal)}</td>
                            <td style={{ color: "#22c55e" }}>{fmtARS(r.cobrado)}</td>
                            <td style={{ color: "#f59e0b" }}>{fmtARS(r.pendiente)}</td>
                            <td style={{ color: "#cc0000" }}>{r.vencido > 0 ? fmtARS(r.vencido) : "—"}</td>
                            <td>
                              <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: meta.bg, color: meta.color }}>
                                {meta.label}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => { setNegocioSelId(r.negocio_id); setTab("detalle"); }}
                                style={{ padding: "5px 12px", background: "rgba(204,0,0,0.12)", border: "1px solid rgba(204,0,0,0.25)", borderRadius: 6, color: "#cc0000", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer" }}
                              >
                                Gestionar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: DETALLE ───────────────────────────────────────────── */}
          {tab === "detalle" && (
            <div>
              {/* Selector negocio */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 10, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 6 }}>
                  Negocio
                </label>
                <select
                  value={negocioSelId}
                  onChange={e => setNegocioSelId(e.target.value)}
                  style={{ ...inputStyle, minWidth: 300 }}
                >
                  {negocios.map(n => (
                    <option key={n.id} value={n.id}>{n.titulo}</option>
                  ))}
                </select>
              </div>

              {negSel && resumenSel && (
                <>
                  {/* Header negocio */}
                  <div style={{ ...cardStyle, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, color: "#fff" }}>{negSel.titulo}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                        Total honorarios: <span style={{ color: "#fff", fontWeight: 700 }}>{fmtARS(resumenSel.honorariosTotal)}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700,
                      padding: "5px 14px", borderRadius: 12,
                      background: ESTADO_META[resumenSel.estado].bg,
                      color: ESTADO_META[resumenSel.estado].color,
                    }}>
                      {ESTADO_META[resumenSel.estado].label}
                    </span>
                  </div>

                  {/* Cuotas */}
                  <div style={{ ...cardStyle, marginBottom: 20 }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                      Cuotas de honorarios
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="gh-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Monto (ARS)</th>
                            <th>Fecha Vencimiento</th>
                            <th>Cobrado</th>
                            <th>Fecha Cobro</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cuotasSel.map((cuota, idx) => {
                            const esVencida = !cuota.cobrado && cuota.fechaVencimiento < hoy();
                            return (
                              <tr key={idx} style={{ background: cuota.cobrado ? "rgba(34,197,94,0.04)" : esVencida ? "rgba(204,0,0,0.04)" : "transparent" }}>
                                <td style={{ color: "rgba(255,255,255,0.5)" }}>{cuota.numero}</td>
                                <td>
                                  <input
                                    type="number"
                                    className="gh-input"
                                    value={cuota.monto}
                                    onChange={e => actualizarCuota(idx, "monto", parseFloat(e.target.value) || 0)}
                                    style={{ width: 120 }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="date"
                                    className="gh-input"
                                    value={cuota.fechaVencimiento}
                                    onChange={e => actualizarCuota(idx, "fechaVencimiento", e.target.value)}
                                    style={{ color: esVencida && !cuota.cobrado ? "#cc0000" : "#fff" }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    className="gh-check"
                                    checked={cuota.cobrado}
                                    onChange={e => marcarCobrado(idx, e.target.checked)}
                                  />
                                </td>
                                <td>
                                  {cuota.cobrado ? (
                                    <input
                                      type="date"
                                      className="gh-input"
                                      value={cuota.fechaCobro ?? ""}
                                      onChange={e => actualizarCuota(idx, "fechaCobro", e.target.value)}
                                    />
                                  ) : (
                                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {!cuota.cobrado && (
                                    <button
                                      onClick={() => marcarCobrado(idx, true)}
                                      style={{ padding: "4px 10px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, color: "#22c55e", fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer" }}
                                    >
                                      Cobrar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={agregarCuota}
                      style={{ marginTop: 14, padding: "7px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer" }}
                    >
                      + Agregar cuota
                    </button>
                  </div>

                  {/* Notas */}
                  <div style={{ ...cardStyle, marginBottom: 20 }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                      Notas internas
                    </div>
                    <textarea
                      value={extraSel?.notas ?? ""}
                      onChange={e => guardarNotas(e.target.value)}
                      placeholder="Condiciones especiales de cobro, acuerdos, etc."
                      rows={4}
                      style={{
                        ...inputStyle,
                        width: "100%",
                        resize: "vertical",
                        boxSizing: "border-box",
                        lineHeight: 1.6,
                      }}
                    />
                  </div>

                  {/* Acción incobrable */}
                  {resumenSel.estado !== "cobrado" && resumenSel.estado !== "incobrable" && (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={marcarIncobrable}
                        style={{ padding: "9px 20px", background: "rgba(127,29,29,0.18)", border: "1px solid rgba(127,29,29,0.4)", borderRadius: 8, color: "#ef4444", fontSize: 12, fontFamily: "Montserrat,sans-serif", fontWeight: 700, cursor: "pointer" }}
                      >
                        Marcar incobrable
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── TAB: PROYECCIÓN ────────────────────────────────────────── */}
          {tab === "proyeccion" && (
            <div>
              {/* SVG Timeline */}
              <div style={{ ...cardStyle, marginBottom: 24, overflowX: "auto" }}>
                <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                  Próximos 90 días
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                  {[
                    { color: "#22c55e", label: "Cobrado"  },
                    { color: "#f59e0b", label: "Pendiente" },
                    { color: "#cc0000", label: "Vencido"  },
                  ].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
                <TimelineChart />
              </div>

              {/* Tabla de vencimientos */}
              <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                <table className="gh-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Negocio</th>
                      <th>Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 32 }}>
                          Sin cuotas registradas
                        </td>
                      </tr>
                    ) : timelineItems.map((item, idx) => {
                      const esVencida = !item.cuota.cobrado && item.cuota.fechaVencimiento < hoy();
                      const color = item.cuota.cobrado ? "#22c55e" : esVencida ? "#cc0000" : "#f59e0b";
                      const label = item.cuota.cobrado ? "Cobrado" : esVencida ? "Vencido" : "Pendiente";
                      return (
                        <tr key={`${item.negocioId}-${idx}`}>
                          <td style={{ color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>{fmtFecha(item.cuota.fechaVencimiento)}</td>
                          <td style={{ color: "#fff" }}>{item.titulo}</td>
                          <td style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, color: "#fff" }}>{fmtARS(item.cuota.monto)}</td>
                          <td>
                            <span style={{ fontSize: 11, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: `${color}18`, color }}>
                              {label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
