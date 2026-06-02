"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: string;
  estado: string;
  fecha_vencimiento: string | null;
  negocio_id: string | null;
  contacto_id: string | null;
  created_at: string;
}

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  updated_at: string;
}

interface Interaccion {
  id: string;
  contacto_id: string;
  tipo: string;
  created_at: string;
}

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  valor_operacion: number | null;
  moneda: string | null;
  updated_at: string;
}

interface Recordatorio {
  id: string;
  contacto_id: string;
  descripcion: string;
  fecha_recordatorio: string;
  completado: boolean;
}

interface Alerta {
  id: string;
  tipo: "tarea_vencida" | "tarea_hoy" | "negocio_estancado" | "contacto_inactivo" | "recordatorio";
  prioridad: "alta" | "media" | "baja";
  titulo: string;
  subtitulo: string;
  accion?: string;
  link?: string;
}

const HOY = new Date().toISOString().slice(0, 10);
const DIAS_ESTANCADO = 21;
const DIAS_INACTIVO = 30;

function diasDesde(fecha: string): number {
  const d = new Date(fecha);
  const hoy = new Date(HOY);
  return Math.floor((hoy.getTime() - d.getTime()) / 86400000);
}

function badge(tipo: Alerta["tipo"]) {
  const map: Record<Alerta["tipo"], { icon: string; color: string; label: string }> = {
    tarea_vencida:      { icon: "⏰", color: "#990000", label: "Tarea Vencida" },
    tarea_hoy:          { icon: "📅", color: "#d4960c", label: "Vence Hoy" },
    negocio_estancado:  { icon: "🔒", color: "#a855f7", label: "Negocio Estancado" },
    contacto_inactivo:  { icon: "💤", color: "#6b7280", label: "Contacto Inactivo" },
    recordatorio:       { icon: "🔔", color: "#3b82f6", label: "Recordatorio" },
  };
  return map[tipo];
}

export default function AlertasPage() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("todas");
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>("todas");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const uid = data.user.id;
      const [{ data: t }, { data: c }, { data: i }, { data: n }, { data: r }] = await Promise.all([
        supabase.from("crm_tareas").select("*").eq("perfil_id", uid).neq("estado", "completada"),
        supabase.from("crm_contactos").select("id,nombre,apellido,telefono,updated_at").eq("perfil_id", uid),
        supabase.from("crm_interacciones").select("id,contacto_id,tipo,created_at").eq("perfil_id", uid).order("created_at", { ascending: false }),
        supabase.from("crm_negocios").select("id,titulo,etapa,valor_operacion,moneda,updated_at").eq("perfil_id", uid).not("etapa", "in", '("cerrado","perdido","archivado")'),
        supabase.from("crm_recordatorios").select("*").eq("perfil_id", uid).eq("completado", false).lte("fecha_recordatorio", HOY),
      ]);
      setTareas((t ?? []) as Tarea[]);
      setContactos((c ?? []) as Contacto[]);
      setInteracciones((i ?? []) as Interaccion[]);
      setNegocios((n ?? []) as Negocio[]);
      setRecordatorios((r ?? []) as Recordatorio[]);
      setLoading(false);
    });
  }, []);

  const alertas = useMemo<Alerta[]>(() => {
    const list: Alerta[] = [];

    // Tareas vencidas
    tareas
      .filter(t => t.fecha_vencimiento && t.fecha_vencimiento < HOY)
      .sort((a, b) => (a.fecha_vencimiento ?? "").localeCompare(b.fecha_vencimiento ?? ""))
      .forEach(t => {
        const dias = diasDesde(t.fecha_vencimiento!);
        list.push({
          id: `tarea-vencida-${t.id}`,
          tipo: "tarea_vencida",
          prioridad: t.prioridad === "alta" ? "alta" : dias > 7 ? "alta" : "media",
          titulo: t.titulo,
          subtitulo: `Venció hace ${dias} día${dias !== 1 ? "s" : ""}${t.prioridad === "alta" ? " · ALTA PRIORIDAD" : ""}`,
          link: "/crm",
        });
      });

    // Tareas vencen hoy
    tareas
      .filter(t => t.fecha_vencimiento === HOY)
      .forEach(t => {
        list.push({
          id: `tarea-hoy-${t.id}`,
          tipo: "tarea_hoy",
          prioridad: t.prioridad === "alta" ? "alta" : "media",
          titulo: t.titulo,
          subtitulo: `Vence hoy${t.prioridad === "alta" ? " · ALTA PRIORIDAD" : ""}`,
          link: "/crm",
        });
      });

    // Recordatorios vencidos
    recordatorios.forEach(r => {
      const c = contactos.find(x => x.id === r.contacto_id);
      list.push({
        id: `recordatorio-${r.id}`,
        tipo: "recordatorio",
        prioridad: "alta",
        titulo: r.descripcion,
        subtitulo: c ? `Contacto: ${c.nombre} ${c.apellido}` : "Sin contacto",
        link: "/crm",
      });
    });

    // Negocios estancados
    negocios.forEach(n => {
      const dias = diasDesde(n.updated_at);
      if (dias >= DIAS_ESTANCADO) {
        list.push({
          id: `negocio-${n.id}`,
          tipo: "negocio_estancado",
          prioridad: dias >= 45 ? "alta" : "media",
          titulo: n.titulo,
          subtitulo: `Sin actualizar hace ${dias} días · Etapa: ${n.etapa}`,
          link: "/crm",
        });
      }
    });

    // Contactos inactivos (sin interacciones en DIAS_INACTIVO)
    const ultimaInteraccion: Record<string, string> = {};
    interacciones.forEach(i => {
      if (!ultimaInteraccion[i.contacto_id]) ultimaInteraccion[i.contacto_id] = i.created_at;
    });
    contactos.forEach(c => {
      const ultima = ultimaInteraccion[c.id];
      const dias = ultima ? diasDesde(ultima.slice(0, 10)) : diasDesde(c.updated_at.slice(0, 10));
      if (dias >= DIAS_INACTIVO) {
        list.push({
          id: `inactivo-${c.id}`,
          tipo: "contacto_inactivo",
          prioridad: dias >= 60 ? "alta" : "baja",
          titulo: `${c.nombre} ${c.apellido}`,
          subtitulo: `Sin actividad hace ${dias} días`,
          accion: c.telefono ? `https://wa.me/${c.telefono.replace(/\D/g, "")}` : undefined,
          link: "/crm",
        });
      }
    });

    // Orden: alta → media → baja, dentro de cada grupo por tipo
    const prioOrd: Record<string, number> = { alta: 0, media: 1, baja: 2 };
    return list
      .filter(a => !dismissed.has(a.id))
      .sort((a, b) => prioOrd[a.prioridad] - prioOrd[b.prioridad]);
  }, [tareas, contactos, interacciones, negocios, recordatorios, dismissed]);

  const filtradas = useMemo(() => {
    return alertas.filter(a => {
      if (filtroTipo !== "todas" && a.tipo !== filtroTipo) return false;
      if (filtroPrioridad !== "todas" && a.prioridad !== filtroPrioridad) return false;
      return true;
    });
  }, [alertas, filtroTipo, filtroPrioridad]);

  const porTipo = useMemo(() => {
    const m: Record<string, number> = {};
    alertas.forEach(a => { m[a.tipo] = (m[a.tipo] ?? 0) + 1; });
    return m;
  }, [alertas]);

  const porPrioridad = useMemo(() => {
    const m: Record<string, number> = {};
    alertas.forEach(a => { m[a.prioridad] = (m[a.prioridad] ?? 0) + 1; });
    return m;
  }, [alertas]);

  const dismiss = (id: string) => setDismissed(prev => new Set([...prev, id]));
  const dismissAll = () => setDismissed(new Set(filtradas.map(a => a.id)));

  const colPrioridad = { alta: "#990000", media: "#d4960c", baja: "#6b7280" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "#fff", margin: 0 }}>
              🚨 Panel de Alertas
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
              {alertas.length === 0 ? "Sin alertas pendientes" : `${alertas.length} alerta${alertas.length !== 1 ? "s" : ""} activa${alertas.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/crm" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 13 }}>← Volver al CRM</Link>
        </div>

        {/* KPI chips */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          {[
            { label: "Vencidas", count: porTipo["tarea_vencida"] ?? 0, color: "#990000" },
            { label: "Hoy", count: porTipo["tarea_hoy"] ?? 0, color: "#d4960c" },
            { label: "Recordatorios", count: porTipo["recordatorio"] ?? 0, color: "#3b82f6" },
            { label: "Estancados", count: porTipo["negocio_estancado"] ?? 0, color: "#a855f7" },
            { label: "Inactivos", count: porTipo["contacto_inactivo"] ?? 0, color: "#6b7280" },
          ].map(k => (
            <div key={k.label} style={{ background: "var(--gfi-bg-secondary)", border: `1px solid ${k.color}44`, borderRadius: 8, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.count}</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{k.label}</span>
            </div>
          ))}
          <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #333", borderRadius: 8, padding: "8px 16px" }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Alta prioridad: </span>
            <span style={{ fontWeight: 700, color: "#990000" }}>{porPrioridad["alta"] ?? 0}</span>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13 }}>
            <option value="todas">Todos los tipos</option>
            <option value="tarea_vencida">Tareas vencidas</option>
            <option value="tarea_hoy">Vencen hoy</option>
            <option value="recordatorio">Recordatorios</option>
            <option value="negocio_estancado">Negocios estancados</option>
            <option value="contacto_inactivo">Contactos inactivos</option>
          </select>
          <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}
            style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13 }}>
            <option value="todas">Toda prioridad</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          {filtradas.length > 0 && (
            <button onClick={dismissAll}
              style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, color: "#9ca3af", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
              Descartar visibles ({filtradas.length})
            </button>
          )}
          {dismissed.size > 0 && (
            <button onClick={() => setDismissed(new Set())}
              style={{ background: "#1a1a1a", border: "1px solid #444", borderRadius: 6, color: "#6b7280", padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
              Restaurar descartadas ({dismissed.size})
            </button>
          )}
        </div>

        {/* Lista alertas */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: 60 }}>Cargando alertas…</div>
        ) : filtradas.length === 0 ? (
          <div style={{ background: "var(--gfi-bg-secondary)", border: "1px solid #222", borderRadius: 12, padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "#3abab6" }}>Sin alertas pendientes</div>
            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>Todo en orden por ahora</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtradas.map(alerta => {
              const b = badge(alerta.tipo);
              return (
                <div key={alerta.id}
                  style={{ background: "var(--gfi-bg-secondary)", border: `1px solid ${b.color}33`, borderLeft: `3px solid ${b.color}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{b.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ background: `${b.color}22`, color: b.color, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-display)" }}>{b.label}</span>
                      <span style={{ background: `${colPrioridad[alerta.prioridad]}22`, color: colPrioridad[alerta.prioridad], fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>
                        {alerta.prioridad.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#e5e5e5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alerta.titulo}</div>
                    <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>{alerta.subtitulo}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {alerta.accion && (
                      <a href={alerta.accion} target="_blank" rel="noreferrer"
                        style={{ background: "#15803d22", color: "#3abab6", border: "1px solid #3abab644", borderRadius: 6, padding: "5px 10px", fontSize: 12, textDecoration: "none" }}>
                        WhatsApp
                      </a>
                    )}
                    {alerta.link && (
                      <Link href={alerta.link}
                        style={{ background: "#1a1a1a", color: "#9ca3af", border: "1px solid #333", borderRadius: 6, padding: "5px 10px", fontSize: 12, textDecoration: "none" }}>
                        Ver
                      </Link>
                    )}
                    <button onClick={() => dismiss(alerta.id)}
                      style={{ background: "transparent", color: "#6b7280", border: "none", cursor: "pointer", fontSize: 16, padding: "0 4px" }} title="Descartar">
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumen pie */}
        {alertas.length > 0 && (
          <div style={{ marginTop: 24, background: "var(--gfi-bg-secondary)", border: "1px solid #1f2937", borderRadius: 10, padding: "14px 18px", display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              <span style={{ color: "#990000", fontWeight: 700 }}>{porPrioridad["alta"] ?? 0}</span> alta ·{" "}
              <span style={{ color: "#d4960c", fontWeight: 700 }}>{porPrioridad["media"] ?? 0}</span> media ·{" "}
              <span style={{ color: "#6b7280", fontWeight: 700 }}>{porPrioridad["baja"] ?? 0}</span> baja
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Estancado = sin actualizar {DIAS_ESTANCADO}+ días · Inactivo = sin interacción {DIAS_INACTIVO}+ días
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
