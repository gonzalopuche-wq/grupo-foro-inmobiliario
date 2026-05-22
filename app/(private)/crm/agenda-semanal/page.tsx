"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Tarea {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string | null;
  fecha_vencimiento: string | null;
  negocio_id: string | null;
  contacto_id: string | null;
}

interface Recordatorio {
  id: string;
  descripcion: string;
  fecha_recordatorio: string | null;
  completado: boolean;
  contacto_id: string | null;
}

interface Hito {
  id: string;
  tipo: string;
  fecha: string | null;
  completado: boolean;
  negocio_id: string | null;
  crm_negocios?: { titulo: string } | null;
}

interface EventoCalendario {
  id: string;
  tipo: "tarea" | "recordatorio" | "hito";
  titulo: string;
  fecha: string;
  completado: boolean;
  prioridad?: string | null;
  link?: string;
  color: string;
  bgColor: string;
  icono: string;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const PRIO_COLOR: Record<string, string> = { alta: "#ef4444", media: "#f59e0b", baja: "#6b7280" };

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date: Date, offset: number = 0): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  d.setDate(d.getDate() - day + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function AgendaSemanal() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [vistaMode, setVistaMode] = useState<"semana" | "lista">("semana");
  const [filtroTipos, setFiltroTipos] = useState<Set<string>>(new Set(["tarea", "recordatorio", "hito"]));

  const hoy = toLocalDateStr(new Date());

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: r }, { data: h }] = await Promise.all([
        supabase.from("crm_tareas").select("id,titulo,estado,prioridad,fecha_vencimiento,negocio_id,contacto_id")
          .not("estado", "eq", "completada").not("fecha_vencimiento", "is", null),
        supabase.from("crm_recordatorios").select("id,descripcion,fecha_recordatorio,completado,contacto_id")
          .eq("completado", false).not("fecha_recordatorio", "is", null),
        supabase.from("crm_escritura_hitos").select("id,tipo,fecha,completado,negocio_id,crm_negocios(titulo)")
          .eq("completado", false).not("fecha", "is", null),
      ]);
      setTareas((t ?? []) as Tarea[]);
      setRecordatorios((r ?? []) as Recordatorio[]);
      setHitos((h ?? []) as unknown as Hito[]);
      setLoading(false);
    }
    load();
  }, []);

  const lunes = startOfWeek(new Date(), semanaOffset);
  // Empezamos desde el lunes (día 1 de la semana)
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
  // Ajuste: startOfWeek da domingo, queremos lunes
  const lunesAjustado = addDays(lunes, 1);
  const diasSemanaAjustados = Array.from({ length: 7 }, (_, i) => addDays(lunesAjustado, i));

  const eventos = useMemo<EventoCalendario[]>(() => {
    const ev: EventoCalendario[] = [];
    if (filtroTipos.has("tarea")) {
      for (const t of tareas) {
        if (!t.fecha_vencimiento) continue;
        ev.push({
          id: t.id,
          tipo: "tarea",
          titulo: t.titulo,
          fecha: t.fecha_vencimiento,
          completado: t.estado === "completada",
          prioridad: t.prioridad,
          link: t.negocio_id ? `/crm/negocios/${t.negocio_id}` : t.contacto_id ? `/crm/contactos/${t.contacto_id}` : undefined,
          color: PRIO_COLOR[t.prioridad ?? "baja"] ?? "#6b7280",
          bgColor: (PRIO_COLOR[t.prioridad ?? "baja"] ?? "#6b7280") + "18",
          icono: "✓",
        });
      }
    }
    if (filtroTipos.has("recordatorio")) {
      for (const r of recordatorios) {
        if (!r.fecha_recordatorio) continue;
        const fecha = r.fecha_recordatorio.slice(0, 10);
        ev.push({
          id: r.id,
          tipo: "recordatorio",
          titulo: r.descripcion,
          fecha,
          completado: r.completado,
          link: r.contacto_id ? `/crm/contactos/${r.contacto_id}` : undefined,
          color: "#3b82f6",
          bgColor: "#3b82f618",
          icono: "🔔",
        });
      }
    }
    if (filtroTipos.has("hito")) {
      for (const h of hitos) {
        if (!h.fecha) continue;
        ev.push({
          id: h.id,
          tipo: "hito",
          titulo: `${h.tipo}${(h as any).crm_negocios?.titulo ? ` (${(h as any).crm_negocios.titulo})` : ""}`,
          fecha: h.fecha,
          completado: h.completado,
          link: h.negocio_id ? `/crm/negocios/${h.negocio_id}` : undefined,
          color: "#22c55e",
          bgColor: "#22c55e18",
          icono: "🏁",
        });
      }
    }
    return ev.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [tareas, recordatorios, hitos, filtroTipos]);

  const eventosPorDia = useMemo(() => {
    const map: Record<string, EventoCalendario[]> = {};
    for (const e of eventos) {
      if (!map[e.fecha]) map[e.fecha] = [];
      map[e.fecha].push(e);
    }
    return map;
  }, [eventos]);

  // Eventos de los próximos 30 días para lista
  const eventosLista = useMemo(() => {
    const desde = toLocalDateStr(new Date());
    const hasta = toLocalDateStr(addDays(new Date(), 30));
    return eventos.filter(e => e.fecha >= desde && e.fecha <= hasta);
  }, [eventos]);

  const totalSemana = diasSemanaAjustados.reduce((s, d) => s + (eventosPorDia[toLocalDateStr(d)]?.length ?? 0), 0);
  const vencidosSemana = eventos.filter(e => e.fecha < hoy && !e.completado).length;

  function toggleTipo(tipo: string) {
    setFiltroTipos(prev => {
      const next = new Set(prev);
      next.has(tipo) ? next.delete(tipo) : next.add(tipo);
      return next;
    });
  }

  const cardStyle: React.CSSProperties = {
    background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "16px 18px",
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter,sans-serif" }}>Cargando agenda…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
        <h1 style={{ fontFamily: "Montserrat,sans-serif", fontSize: 18, fontWeight: 800, margin: 0 }}>Agenda Semanal</h1>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>
        {vencidosSemana > 0 && <span style={{ color: "#ef4444" }}>⚠ {vencidosSemana} vencido{vencidosSemana > 1 ? "s" : ""} · </span>}
        {totalSemana} evento{totalSemana !== 1 ? "s" : ""} esta semana
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        {/* Filtros de tipo */}
        {[
          { id: "tarea", label: "Tareas", color: "#f59e0b", icono: "✓" },
          { id: "recordatorio", label: "Recordatorios", color: "#3b82f6", icono: "🔔" },
          { id: "hito", label: "Hitos", color: "#22c55e", icono: "🏁" },
        ].map(t => (
          <button key={t.id} onClick={() => toggleTipo(t.id)}
            style={{ background: filtroTipos.has(t.id) ? t.color + "22" : "rgba(255,255,255,0.04)", border: `1px solid ${filtroTipos.has(t.id) ? t.color + "44" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: filtroTipos.has(t.id) ? t.color : "rgba(255,255,255,0.3)", fontSize: 11, padding: "5px 12px", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
            {t.icono} {t.label}
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {/* Semana nav */}
          <button onClick={() => setSemanaOffset(v => v - 1)}
            style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 14, padding: "5px 12px", cursor: "pointer" }}>←</button>
          <button onClick={() => setSemanaOffset(0)}
            style={{ background: semanaOffset === 0 ? "rgba(204,0,0,0.15)" : "#111", border: `1px solid ${semanaOffset === 0 ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 6, color: semanaOffset === 0 ? "#cc0000" : "rgba(255,255,255,0.5)", fontSize: 11, padding: "5px 12px", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
            Hoy
          </button>
          <button onClick={() => setSemanaOffset(v => v + 1)}
            style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 14, padding: "5px 12px", cursor: "pointer" }}>→</button>

          {/* Vista */}
          {(["semana", "lista"] as const).map(v => (
            <button key={v} onClick={() => setVistaMode(v)}
              style={{ background: vistaMode === v ? "rgba(204,0,0,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${vistaMode === v ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: vistaMode === v ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 11, padding: "5px 10px", cursor: "pointer", fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>
              {v === "semana" ? "📅 Semana" : "📋 Lista"}
            </button>
          ))}
        </div>
      </div>

      {/* Título de semana */}
      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
        {DIAS_SEMANA[(lunesAjustado.getDay())]} {lunesAjustado.getDate()} {MESES[lunesAjustado.getMonth()]} — {DIAS_SEMANA[diasSemanaAjustados[6].getDay()]} {diasSemanaAjustados[6].getDate()} {MESES[diasSemanaAjustados[6].getMonth()]} {diasSemanaAjustados[6].getFullYear()}
      </div>

      {vistaMode === "semana" ? (
        /* Vista semanal: 7 columnas */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
          {diasSemanaAjustados.map(dia => {
            const diaStr = toLocalDateStr(dia);
            const esHoy = diaStr === hoy;
            const esPassado = diaStr < hoy;
            const eventosDelDia = eventosPorDia[diaStr] ?? [];
            const tieneVencidos = eventosDelDia.some(e => !e.completado);

            return (
              <div key={diaStr} style={{ background: esHoy ? "rgba(204,0,0,0.06)" : "#0d0d0d", border: `1px solid ${esHoy ? "rgba(204,0,0,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "12px 10px", minHeight: 160 }}>
                {/* Cabecera del día */}
                <div style={{ marginBottom: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: esHoy ? "#cc0000" : "rgba(255,255,255,0.35)" }}>
                    {DIAS_SEMANA[dia.getDay()]}
                  </div>
                  <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 20, fontWeight: 800, color: esHoy ? "#cc0000" : esPassado ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.85)", lineHeight: 1.2 }}>
                    {dia.getDate()}
                  </div>
                  {eventosDelDia.length > 0 && (
                    <div style={{ marginTop: 3, display: "flex", justifyContent: "center" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: esPassado && tieneVencidos ? "#ef4444" : "#22c55e" }} />
                    </div>
                  )}
                </div>

                {/* Eventos del día */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {eventosDelDia.map(ev => (
                    <div key={ev.id} style={{ background: esPassado && !ev.completado ? "rgba(239,68,68,0.08)" : ev.bgColor, borderLeft: `2px solid ${esPassado && !ev.completado ? "#ef4444" : ev.color}`, borderRadius: "0 4px 4px 0", padding: "4px 6px" }}>
                      <div style={{ fontSize: 9, color: esPassado && !ev.completado ? "#ef4444" : ev.color, fontFamily: "Montserrat,sans-serif", fontWeight: 700 }}>{ev.icono}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", lineHeight: 1.3, marginTop: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {ev.titulo}
                      </div>
                      {ev.link && (
                        <Link href={ev.link} style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>↗</Link>
                      )}
                    </div>
                  ))}
                  {eventosDelDia.length === 0 && (
                    <div style={{ textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.1)", paddingTop: 8 }}>—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista lista: próximos 30 días */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Vencidos */}
          {eventos.filter(e => e.fecha < hoy).length > 0 && (
            <div style={{ ...cardStyle, borderColor: "rgba(239,68,68,0.25)" }}>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ef4444", marginBottom: 10 }}>⚠ Vencidos</div>
              {eventos.filter(e => e.fecha < hoy).map(ev => (
                <div key={ev.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 12 }}>{ev.icono}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{ev.titulo}</div>
                    <div style={{ fontSize: 10, color: "#ef4444" }}>Venció {ev.fecha}</div>
                  </div>
                  {ev.link && <Link href={ev.link} style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>↗</Link>}
                </div>
              ))}
            </div>
          )}

          {/* Próximos 30 días agrupados */}
          {(() => {
            const grupos: Record<string, EventoCalendario[]> = {};
            for (const e of eventosLista) {
              if (!grupos[e.fecha]) grupos[e.fecha] = [];
              grupos[e.fecha].push(e);
            }
            return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, evs]) => {
              const dObj = new Date(fecha + "T12:00:00");
              const esHoyDate = fecha === hoy;
              return (
                <div key={fecha} style={{ ...cardStyle, borderColor: esHoyDate ? "rgba(204,0,0,0.3)" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 800, color: esHoyDate ? "#cc0000" : "rgba(255,255,255,0.7)", lineHeight: 1 }}>{dObj.getDate()}</div>
                    <div>
                      <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 11, fontWeight: 700, color: esHoyDate ? "#cc0000" : "rgba(255,255,255,0.4)" }}>{DIAS_SEMANA[dObj.getDay()]}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{MESES[dObj.getMonth()]} {dObj.getFullYear()}</div>
                    </div>
                    {esHoyDate && <span style={{ background: "#cc0000", color: "#fff", fontSize: 9, fontFamily: "Montserrat,sans-serif", fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>HOY</span>}
                    <span style={{ marginLeft: "auto", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", fontSize: 10, padding: "2px 8px", borderRadius: 4 }}>{evs.length}</span>
                  </div>
                  {evs.map(ev => (
                    <div key={ev.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 6, background: ev.bgColor, borderLeft: `3px solid ${ev.color}`, marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>{ev.icono}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{ev.titulo}</div>
                        <div style={{ fontSize: 9, color: ev.color, fontFamily: "Montserrat,sans-serif", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>{ev.tipo}</div>
                      </div>
                      {ev.link && <Link href={ev.link} style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textDecoration: "none", whiteSpace: "nowrap" }}>Ver ↗</Link>}
                    </div>
                  ))}
                </div>
              );
            });
          })()}
          {eventosLista.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
              <div style={{ fontFamily: "Montserrat,sans-serif", fontSize: 14 }}>Sin eventos en los próximos 30 días</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
