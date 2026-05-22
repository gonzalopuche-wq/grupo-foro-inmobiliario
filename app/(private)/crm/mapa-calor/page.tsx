"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ContactoRaw {
  id: string;
  created_at: string;
}

interface NegocioRaw {
  id: string;
  created_at: string;
  updated_at: string;
  etapa: string | null;
}

interface DiaDetalle {
  contactosNuevos: number;
  negociosActualizados: number;
  negociosCerrados: number;
  total: number;
}

interface DiaActividad {
  fecha: string; // "YYYY-MM-DD"
  nivel: 0 | 1 | 2 | 3 | 4;
  detalle: DiaDetalle;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  dia: DiaActividad | null;
}

type TabId = "anual" | "semanas" | "detalle";

// ── Constantes ───────────────────────────────────────────────────────────────

const COLORES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "#1a1a1a",
  1: "#4d0000",
  2: "#800000",
  3: "#cc0000",
  4: "#ff4444",
};

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

const MESES_CORTO = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_LARGO = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

const ESTADOS_CIERRE = ["cerrado", "ganado", "firmado", "escriturado", "concretado", "vendido", "alquilado"];

const CELL_SIZE = 14;
const CELL_GAP = 2;
const CELL_STEP = CELL_SIZE + CELL_GAP;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateStr(isoStr: string): string {
  // Parse the ISO date portion to avoid timezone shifts
  return isoStr.substring(0, 10);
}

function calcularNivel(total: number): 0 | 1 | 2 | 3 | 4 {
  if (total === 0) return 0;
  if (total <= 2) return 1;
  if (total <= 5) return 2;
  if (total <= 10) return 3;
  return 4;
}

function formatFechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const diaSemana = DIAS_LARGO[date.getDay()];
  const mesNombre = MESES_LARGO[(m ?? 1) - 1];
  return `${diaSemana} ${d} de ${mesNombre} ${y}`;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date((y ?? 2024), (m ?? 1) - 1, (d ?? 1) + n);
  return date.toISOString().substring(0, 10);
}

function getDayOfWeek(dateStr: string): number {
  // Returns 0=Monday … 6=Sunday
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date((y ?? 2024), (m ?? 1) - 1, d ?? 1);
  const dow = date.getDay(); // 0=Sunday … 6=Saturday
  return (dow + 6) % 7; // convert to 0=Monday
}

function getMonthLabel(dateStr: string): string {
  const m = parseInt(dateStr.substring(5, 7), 10) - 1;
  return MESES_CORTO[m] ?? "";
}

function buildDays365(today: string): string[] {
  const days: string[] = [];
  for (let i = 364; i >= 0; i--) {
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date((y ?? 2024), (m ?? 1) - 1, (d ?? 1) - i);
    days.push(date.toISOString().substring(0, 10));
  }
  return days;
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function MapaActividadCorredor() {
  const [loading, setLoading] = useState(true);
  const [mapaActividad, setMapaActividad] = useState<Map<string, DiaActividad>>(new Map());
  const [tab, setTab] = useState<TabId>("anual");
  const [filtroDetalle, setFiltroDetalle] = useState<"todos" | "activos">("activos");
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, dia: null });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().substring(0, 10);
  }, []);

  const hace365 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 365);
    return d.toISOString();
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [
        { data: contactosRaw },
        { data: negociosRaw },
      ] = await Promise.all([
        supabase
          .from("crm_contactos")
          .select("id, created_at")
          .eq("perfil_id", user.id)
          .gte("created_at", hace365),
        supabase
          .from("crm_negocios")
          .select("id, created_at, updated_at, etapa")
          .eq("perfil_id", user.id)
          .gte("updated_at", hace365),
      ]);

      const contactos: ContactoRaw[] = (contactosRaw ?? []) as ContactoRaw[];
      const negocios: NegocioRaw[] = (negociosRaw ?? []) as NegocioRaw[];

      // Construir mapa de actividad por día
      const mapa = new Map<string, DiaDetalle>();

      const ensureDia = (fecha: string): DiaDetalle => {
        if (!mapa.has(fecha)) {
          mapa.set(fecha, { contactosNuevos: 0, negociosActualizados: 0, negociosCerrados: 0, total: 0 });
        }
        return mapa.get(fecha)!;
      };

      // Contactos nuevos: +1 punto
      contactos.forEach((c) => {
        const fecha = toLocalDateStr(c.created_at);
        const dia = ensureDia(fecha);
        dia.contactosNuevos += 1;
        dia.total += 1;
      });

      // Negocios actualizados/cerrados
      negocios.forEach((n) => {
        const fechaUpdate = toLocalDateStr(n.updated_at);
        const esCierre = n.etapa
          ? ESTADOS_CIERRE.some((e) => n.etapa!.toLowerCase().includes(e))
          : false;

        const diaUpdate = ensureDia(fechaUpdate);

        if (esCierre) {
          // Negocio cerrado: +3 puntos en día de actualización
          diaUpdate.negociosCerrados += 1;
          diaUpdate.total += 3;
        } else {
          // Negocio actualizado: +1 punto
          diaUpdate.negociosActualizados += 1;
          diaUpdate.total += 1;
        }
      });

      // Convertir a DiaActividad con nivel
      const mapaFinal = new Map<string, DiaActividad>();
      mapa.forEach((detalle, fecha) => {
        const nivel = calcularNivel(detalle.total);
        mapaFinal.set(fecha, { fecha, nivel, detalle });
      });

      setMapaActividad(mapaFinal);
      setLoading(false);
    }

    load();
  }, [hace365]);

  // ── Datos derivados ────────────────────────────────────────────────────────

  const dias365 = useMemo(() => buildDays365(today), [today]);

  const diasConActividad = useMemo((): DiaActividad[] => {
    return dias365
      .map((fecha): DiaActividad => mapaActividad.get(fecha) ?? { fecha, nivel: 0, detalle: { contactosNuevos: 0, negociosActualizados: 0, negociosCerrados: 0, total: 0 } })
      .filter((d) => d.nivel > 0);
  }, [dias365, mapaActividad]);

  const stats = useMemo((): {
    totalPuntos: number;
    rachaActual: number;
    rachaMax: number;
    diaMasActivo: DiaActividad | null;
    promedioDiasActivosSemana: number;
  } => {
    let totalPuntos = 0;
    let rachaActual = 0;
    let rachaMax = 0;
    let rachaTemp = 0;
    let diaMasActivo: DiaActividad | null = null;
    let maxTotal = 0;
    let diasActivosTotal = 0;

    // Recorrer días de más antiguo a más reciente para calcular rachas
    dias365.forEach((fecha) => {
      const dia = mapaActividad.get(fecha);
      if (dia && dia.detalle.total > 0) {
        totalPuntos += dia.detalle.total;
        diasActivosTotal++;
        rachaTemp++;
        if (rachaTemp > rachaMax) rachaMax = rachaTemp;
        if (dia.detalle.total > maxTotal) {
          maxTotal = dia.detalle.total;
          diaMasActivo = dia;
        }
      } else {
        rachaTemp = 0;
      }
    });

    // Racha actual: contar desde hoy hacia atrás
    for (let i = dias365.length - 1; i >= 0; i--) {
      const fecha = dias365[i];
      if (!fecha) break;
      const dia = mapaActividad.get(fecha);
      if (dia && dia.detalle.total > 0) {
        rachaActual++;
      } else {
        break;
      }
    }

    const semanas = Math.ceil(dias365.length / 7);
    const promedioDiasActivosSemana = semanas > 0 ? diasActivosTotal / semanas : 0;

    const diaMasActivoFinal: DiaActividad | null = diaMasActivo;
    return {
      totalPuntos,
      rachaActual,
      rachaMax,
      diaMasActivo: diaMasActivoFinal,
      promedioDiasActivosSemana,
    };
  }, [dias365, mapaActividad]);

  // ── Heatmap grid ──────────────────────────────────────────────────────────

  const heatmapData = useMemo(() => {
    // Necesitamos 53 columnas (semanas), cada una con hasta 7 días
    // La primera semana puede tener días vacíos al inicio (antes del primer día del rango)

    // El primer día del rango es dias365[0]
    const primerDia = dias365[0] ?? today;
    const dowPrimer = getDayOfWeek(primerDia); // 0=Lun, 6=Dom

    // Construir grid: semanas × 7 días
    // Columna 0 tiene `dowPrimer` celdas vacías antes del primer día
    const semanas: Array<Array<{ fecha: string | null; dia: DiaActividad | null }>> = [];
    let semanaActual: Array<{ fecha: string | null; dia: DiaActividad | null }> = [];

    // Rellenar inicio de la primera semana con nulos
    for (let i = 0; i < dowPrimer; i++) {
      semanaActual.push({ fecha: null, dia: null });
    }

    dias365.forEach((fecha) => {
      const dia = mapaActividad.get(fecha) ?? { fecha, nivel: 0 as const, detalle: { contactosNuevos: 0, negociosActualizados: 0, negociosCerrados: 0, total: 0 } };
      semanaActual.push({ fecha, dia });
      if (semanaActual.length === 7) {
        semanas.push(semanaActual);
        semanaActual = [];
      }
    });

    // Última semana incompleta
    if (semanaActual.length > 0) {
      while (semanaActual.length < 7) {
        semanaActual.push({ fecha: null, dia: null });
      }
      semanas.push(semanaActual);
    }

    // Cabeceras de mes: para cada semana, si el primer día de la semana cambia de mes
    const monthLabels: Array<{ col: number; label: string }> = [];
    let lastMonth = -1;
    semanas.forEach((semana, col) => {
      const primerFechaValida = semana.find((c) => c.fecha !== null);
      if (primerFechaValida?.fecha) {
        const m = parseInt(primerFechaValida.fecha.substring(5, 7), 10);
        if (m !== lastMonth) {
          monthLabels.push({ col, label: getMonthLabel(primerFechaValida.fecha) });
          lastMonth = m;
        }
      }
    });

    return { semanas, monthLabels };
  }, [dias365, mapaActividad, today]);

  // ── Últimas 12 semanas ─────────────────────────────────────────────────────

  const ultimas12Semanas = useMemo(() => {
    const semanas: Array<{
      inicio: string;
      dias: Array<{ fecha: string; dia: DiaActividad }>;
      total: number;
    }> = [];

    // Encontrar el lunes más cercano al día de hoy (o hoy si es lunes)
    const todayDate = new Date();
    const dowHoy = (todayDate.getDay() + 6) % 7; // 0=Lun
    const lunesHoy = new Date(todayDate);
    lunesHoy.setDate(todayDate.getDate() - dowHoy);

    for (let s = 0; s < 12; s++) {
      const lunesDate = new Date(lunesHoy);
      lunesDate.setDate(lunesHoy.getDate() - s * 7);
      const lunesStr = lunesDate.toISOString().substring(0, 10);

      const diasSemana: Array<{ fecha: string; dia: DiaActividad }> = [];
      let total = 0;

      for (let d = 0; d < 7; d++) {
        const fechaDate = new Date(lunesDate);
        fechaDate.setDate(lunesDate.getDate() + d);
        const fecha = fechaDate.toISOString().substring(0, 10);
        const dia = mapaActividad.get(fecha) ?? { fecha, nivel: 0 as const, detalle: { contactosNuevos: 0, negociosActualizados: 0, negociosCerrados: 0, total: 0 } };
        diasSemana.push({ fecha, dia });
        total += dia.detalle.total;
      }

      semanas.unshift({ inicio: lunesStr, dias: diasSemana, total });
    }

    return semanas;
  }, [mapaActividad]);

  const maxTotalSemana = useMemo(
    () => Math.max(...ultimas12Semanas.map((s) => s.total), 1),
    [ultimas12Semanas]
  );

  // ── Timeline 30 días ──────────────────────────────────────────────────────

  const ultimos30Dias = useMemo(() => {
    const result: DiaActividad[] = [];
    for (let i = 0; i < 30; i++) {
      const [y, m, d] = today.split("-").map(Number);
      const date = new Date((y ?? 2024), (m ?? 1) - 1, (d ?? 1) - i);
      const fecha = date.toISOString().substring(0, 10);
      const dia = mapaActividad.get(fecha) ?? { fecha, nivel: 0 as const, detalle: { contactosNuevos: 0, negociosActualizados: 0, negociosCerrados: 0, total: 0 } };
      result.push(dia);
    }
    return result;
  }, [today, mapaActividad]);

  const diasFiltradosDetalle = useMemo(() => {
    if (filtroDetalle === "activos") return ultimos30Dias.filter((d) => d.nivel > 0);
    return ultimos30Dias;
  }, [ultimos30Dias, filtroDetalle]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCellMouseEnter = useCallback(
    (e: React.MouseEvent, dia: DiaActividad | null) => {
      if (!dia) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({ visible: true, x: rect.left + window.scrollX, y: rect.top + window.scrollY - 10, dia });
    },
    []
  );

  const handleCellMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
          Cargando actividad...
        </span>
      </div>
    );
  }

  const gridWidth = heatmapData.semanas.length * CELL_STEP;
  const gridHeight = 7 * CELL_STEP;

  // Extraer antes del JSX para evitar narrowing erróneo de TypeScript
  const diaMasActivo: DiaActividad | null = stats.diaMasActivo;
  const dmaValor = diaMasActivo !== null ? `${diaMasActivo.detalle.total} pts` : "—";
  const dmaSub = diaMasActivo !== null ? diaMasActivo.fecha : "sin datos";
  const statItems: Array<{ label: string; valor: string; sub: string; highlight?: boolean }> = [
    { label: "Total actividad", valor: `${stats.totalPuntos} pts`, sub: "último año" },
    { label: "Racha actual", valor: `${stats.rachaActual} días`, sub: stats.rachaActual > 0 ? "consecutivos" : "sin racha activa", highlight: stats.rachaActual >= 7 },
    { label: "Racha máxima", valor: `${stats.rachaMax} días`, sub: "días consecutivos" },
    { label: "Día más activo", valor: dmaValor, sub: dmaSub },
    { label: "Promedio semanal", valor: `${stats.promedioDiasActivosSemana.toFixed(1)} / 7`, sub: "días activos por semana" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>
          ← CRM
        </Link>
        <h1 style={{
          margin: 0,
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 800,
          fontSize: 28,
          color: "#fff",
          letterSpacing: "-0.02em",
        }}>
          Mapa de Actividad
        </h1>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          {diasConActividad.length} días activos en el último año
        </span>
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 0 }}>
          {([
            { id: "anual" as TabId, label: "Heatmap anual" },
            { id: "semanas" as TabId, label: "Por semana (12 últ.)" },
            { id: "detalle" as TabId, label: "Detalle por día" },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 18px",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${tab === t.id ? "#cc0000" : "transparent"}`,
                color: tab === t.id ? "#fff" : "rgba(255,255,255,0.4)",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                marginBottom: -1,
                transition: "color 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: Heatmap anual ──────────────────────────────────────────── */}
        {tab === "anual" && (
          <div>
            {/* Heatmap */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "20px 24px",
              marginBottom: 20,
              overflowX: "auto",
            }}>
              <div style={{ display: "flex", marginBottom: 4 }}>
                {/* Espacio para etiquetas de días */}
                <div style={{ width: 18, flexShrink: 0 }} />
                {/* Cabeceras de mes */}
                <div style={{ position: "relative", height: 18, flex: 1, minWidth: gridWidth }}>
                  {heatmapData.monthLabels.map(({ col, label }) => (
                    <span
                      key={`${col}-${label}`}
                      style={{
                        position: "absolute",
                        left: col * CELL_STEP,
                        top: 0,
                        fontSize: 10,
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        userSelect: "none",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex" }}>
                {/* Etiquetas días izquierda */}
                <div style={{ display: "flex", flexDirection: "column", gap: CELL_GAP, marginRight: 4, flexShrink: 0 }}>
                  {DIAS_SEMANA.map((letra, idx) => (
                    <div
                      key={letra}
                      style={{
                        width: 14,
                        height: CELL_SIZE,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        color: idx % 2 === 0 ? "rgba(255,255,255,0.3)" : "transparent",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        userSelect: "none",
                      }}
                    >
                      {letra}
                    </div>
                  ))}
                </div>

                {/* Grid de celdas */}
                <div style={{ display: "flex", gap: CELL_GAP, position: "relative" }}>
                  {heatmapData.semanas.map((semana, colIdx) => (
                    <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: CELL_GAP }}>
                      {semana.map((celda, rowIdx) => {
                        if (!celda.fecha || !celda.dia) {
                          return (
                            <div
                              key={rowIdx}
                              style={{
                                width: CELL_SIZE,
                                height: CELL_SIZE,
                                borderRadius: 2,
                                background: "transparent",
                              }}
                            />
                          );
                        }
                        const nivel = celda.dia.nivel;
                        return (
                          <div
                            key={celda.fecha}
                            onMouseEnter={(e) => handleCellMouseEnter(e, celda.dia)}
                            onMouseLeave={handleCellMouseLeave}
                            style={{
                              width: CELL_SIZE,
                              height: CELL_SIZE,
                              borderRadius: 2,
                              background: COLORES[nivel],
                              cursor: nivel > 0 ? "pointer" : "default",
                              transition: "opacity 0.1s",
                              border: "1px solid rgba(255,255,255,0.04)",
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Leyenda */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                  Menos
                </span>
                {([0, 1, 2, 3, 4] as const).map((n) => (
                  <div
                    key={n}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      borderRadius: 2,
                      background: COLORES[n],
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  />
                ))}
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                  Más
                </span>
              </div>
            </div>

            {/* Estadísticas */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}>
              {statItems.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${stat.highlight ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <p style={{ margin: "0 0 4px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {stat.label}
                  </p>
                  <p style={{ margin: "0 0 2px 0", fontSize: 22, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: stat.highlight ? "#cc0000" : "#fff" }}>
                    {stat.valor}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    {stat.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* Nota privacidad */}
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: 0 }}>
              Solo visible para vos. Basado en tu actividad registrada en el CRM.
            </p>
          </div>
        )}

        {/* ── TAB 2: Por semana ─────────────────────────────────────────────── */}
        {tab === "semanas" && (
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    Semana
                  </th>
                  {DIAS_SEMANA.map((d) => (
                    <th key={d} style={{ padding: "10px 8px", textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {d}
                    </th>
                  ))}
                  <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {ultimas12Semanas.map((semana, sIdx) => {
                  const [sy, sm, sd] = semana.inicio.split("-").map(Number);
                  const finDate = new Date((sy ?? 2024), (sm ?? 1) - 1, (sd ?? 1) + 6);
                  const finStr = `${finDate.getDate()}/${finDate.getMonth() + 1}`;
                  const inicioStr = `${sd}/${sm}`;
                  return (
                    <tr key={semana.inicio} style={{ background: sIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      <td style={{ padding: "8px 14px", fontSize: 11, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
                        {inicioStr} — {finStr}
                      </td>
                      {semana.dias.map(({ fecha, dia }) => (
                        <td key={fecha} style={{ padding: "8px 4px", textAlign: "center" }}>
                          <div
                            onMouseEnter={(e) => handleCellMouseEnter(e, dia)}
                            onMouseLeave={handleCellMouseLeave}
                            style={{
                              width: 28,
                              height: 28,
                              margin: "0 auto",
                              borderRadius: 4,
                              background: COLORES[dia.nivel],
                              border: "1px solid rgba(255,255,255,0.06)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              color: dia.nivel > 0 ? "rgba(255,255,255,0.7)" : "transparent",
                              cursor: dia.nivel > 0 ? "pointer" : "default",
                              fontWeight: 700,
                            }}
                          >
                            {dia.nivel > 0 ? dia.detalle.total : ""}
                          </div>
                        </td>
                      ))}
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            height: 8,
                            width: Math.max(4, (semana.total / maxTotalSemana) * 80),
                            background: semana.total > 0 ? "#cc0000" : "rgba(255,255,255,0.05)",
                            borderRadius: 4,
                          }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: semana.total > 0 ? "#fff" : "rgba(255,255,255,0.2)", minWidth: 20 }}>
                            {semana.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                Solo visible para vos. Basado en tu actividad registrada en el CRM.
              </p>
            </div>
          </div>
        )}

        {/* ── TAB 3: Detalle por día ────────────────────────────────────────── */}
        {tab === "detalle" && (
          <div>
            {/* Filtro */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {([
                { id: "activos" as const, label: "Solo días con actividad" },
                { id: "todos" as const, label: "Todos los días" },
              ]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroDetalle(f.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: `1px solid ${filtroDetalle === f.id ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                    background: filtroDetalle === f.id ? "rgba(204,0,0,0.15)" : "transparent",
                    color: filtroDetalle === f.id ? "#cc0000" : "rgba(255,255,255,0.5)",
                    fontSize: 11,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {diasFiltradosDetalle.length === 0 ? (
                <div style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: 40,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.2)",
                  fontSize: 13,
                }}>
                  Sin actividad en los últimos 30 días
                </div>
              ) : (
                diasFiltradosDetalle.map((dia) => {
                  const fechaLabel = formatFechaLarga(dia.fecha);
                  const esHoy = dia.fecha === today;
                  return (
                    <div
                      key={dia.fecha}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.02)",
                        border: `1px solid ${esHoy ? "rgba(204,0,0,0.2)" : "rgba(255,255,255,0.06)"}`,
                        borderLeft: `3px solid ${COLORES[dia.nivel]}`,
                        borderRadius: 10,
                      }}
                    >
                      {/* Celda de color */}
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        background: COLORES[dia.nivel],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: 14,
                        color: dia.nivel > 0 ? "#fff" : "rgba(255,255,255,0.2)",
                        flexShrink: 0,
                      }}>
                        {dia.nivel > 0 ? dia.detalle.total : "—"}
                      </div>

                      {/* Fecha */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 2px 0", fontSize: 13, fontWeight: 600, color: esHoy ? "#cc0000" : "#fff" }}>
                          {esHoy ? "Hoy — " : ""}{fechaLabel}
                        </p>
                        {dia.nivel > 0 ? (
                          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                            {dia.detalle.total} puntos de actividad
                          </p>
                        ) : (
                          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                            Sin actividad
                          </p>
                        )}
                      </div>

                      {/* Chips */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {dia.detalle.contactosNuevos > 0 && (
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: "rgba(59,130,246,0.15)",
                            border: "1px solid rgba(59,130,246,0.25)",
                            fontSize: 10,
                            color: "#93c5fd",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}>
                            +{dia.detalle.contactosNuevos} contacto{dia.detalle.contactosNuevos > 1 ? "s" : ""}
                          </span>
                        )}
                        {dia.detalle.negociosActualizados > 0 && (
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: "rgba(249,115,22,0.15)",
                            border: "1px solid rgba(249,115,22,0.25)",
                            fontSize: 10,
                            color: "#fdba74",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}>
                            {dia.detalle.negociosActualizados} negocio{dia.detalle.negociosActualizados > 1 ? "s" : ""}
                          </span>
                        )}
                        {dia.detalle.negociosCerrados > 0 && (
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 12,
                            background: "rgba(204,0,0,0.15)",
                            border: "1px solid rgba(204,0,0,0.3)",
                            fontSize: 10,
                            color: "#ff9999",
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}>
                            {dia.detalle.negociosCerrados} cierre{dia.detalle.negociosCerrados > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, margin: 0 }}>
                Solo visible para vos. Basado en tu actividad registrada en el CRM.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip flotante */}
      {tooltip.visible && tooltip.dia && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y - 90,
            zIndex: 9999,
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "10px 14px",
            pointerEvents: "none",
            minWidth: 180,
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            transform: "translateX(-50%)",
          }}
        >
          <p style={{ margin: "0 0 6px 0", fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
            {formatFechaLarga(tooltip.dia.fecha)}
          </p>
          {tooltip.dia.nivel === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Sin actividad</p>
          ) : (
            <>
              {tooltip.dia.detalle.contactosNuevos > 0 && (
                <p style={{ margin: "0 0 2px 0", fontSize: 12, color: "#93c5fd" }}>
                  {tooltip.dia.detalle.contactosNuevos} contacto{tooltip.dia.detalle.contactosNuevos > 1 ? "s" : ""} nuevo{tooltip.dia.detalle.contactosNuevos > 1 ? "s" : ""}
                </p>
              )}
              {tooltip.dia.detalle.negociosActualizados > 0 && (
                <p style={{ margin: "0 0 2px 0", fontSize: 12, color: "#fdba74" }}>
                  {tooltip.dia.detalle.negociosActualizados} negocio{tooltip.dia.detalle.negociosActualizados > 1 ? "s" : ""} actualizado{tooltip.dia.detalle.negociosActualizados > 1 ? "s" : ""}
                </p>
              )}
              {tooltip.dia.detalle.negociosCerrados > 0 && (
                <p style={{ margin: "0 0 2px 0", fontSize: 12, color: "#ff9999" }}>
                  {tooltip.dia.detalle.negociosCerrados} cierre{tooltip.dia.detalle.negociosCerrados > 1 ? "s" : ""}
                </p>
              )}
              <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 4 }}>
                Total: {tooltip.dia.detalle.total} pts
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
