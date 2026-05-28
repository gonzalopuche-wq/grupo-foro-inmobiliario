"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  tipo: string | null;
  etiquetas: string[] | null;
  created_at: string;
}

interface Interaccion {
  id: string;
  contacto_id: string;
  tipo: string;
  descripcion: string;
  created_at: string;
}

interface Negocio {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string | null;
  created_at: string;
  updated_at: string;
}

interface Tarea {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  fecha_vencimiento: string | null;
  created_at: string;
}

interface Recordatorio {
  id: string;
  descripcion: string;
  fecha_recordatorio: string;
  completado: boolean;
  created_at: string;
}

type EventoTipo = "interaccion" | "negocio_creado" | "negocio_etapa" | "tarea" | "recordatorio" | "contacto_creado";

interface EventoTimeline {
  id: string;
  tipo: EventoTipo;
  fecha: string;
  titulo: string;
  subtitulo: string;
  color: string;
  icon: string;
  raw?: Interaccion | Negocio | Tarea | Recordatorio;
}

const COLOR_TIPO: Record<string, string> = {
  llamada: "#22c55e", whatsapp: "#15803d", email: "#3b82f6",
  reunion: "#a855f7", visita: "#f97316", nota: "#6b7280",
  otro: "#4b5563",
};

const ICON_TIPO: Record<string, string> = {
  llamada: "📞", whatsapp: "💬", email: "📧",
  reunion: "🤝", visita: "🏠", nota: "📝", otro: "📌",
};

const ETAPA_COLOR: Record<string, string> = {
  prospecto: "#6b7280", calificado: "#3b82f6", propuesta: "#a855f7",
  negociacion: "#f97316", reservado: "#eab308", en_escritura: "#22c55e", cerrado: "#cc0000",
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function HistorialPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = "/login"; return; }
      const userId = data.user.id;
      setUid(userId);
      supabase.from("crm_contactos").select("id,nombre,apellido,telefono,email,tipo,etiquetas,created_at")
        .eq("perfil_id", userId).order("nombre").then(({ data: c }) => setContactos((c ?? []) as Contacto[]));
    });
  }, []);

  useEffect(() => {
    if (!selectedId || !uid) return;
    setLoading(true);
    Promise.all([
      supabase.from("crm_interacciones").select("*").eq("perfil_id", uid).eq("contacto_id", selectedId).order("created_at", { ascending: false }),
      supabase.from("crm_negocios").select("id,titulo,etapa,tipo_operacion,valor_operacion,moneda,created_at,updated_at").eq("perfil_id", uid).eq("contacto_id", selectedId),
      supabase.from("crm_tareas").select("id,titulo,estado,prioridad,fecha_vencimiento,created_at").eq("perfil_id", uid).eq("contacto_id", selectedId),
      supabase.from("crm_recordatorios").select("*").eq("perfil_id", uid).eq("contacto_id", selectedId),
    ]).then(([{ data: i }, { data: n }, { data: t }, { data: r }]) => {
      setInteracciones((i ?? []) as Interaccion[]);
      setNegocios((n ?? []) as Negocio[]);
      setTareas((t ?? []) as Tarea[]);
      setRecordatorios((r ?? []) as Recordatorio[]);
      setLoading(false);
    });
  }, [selectedId, uid]);

  const contacto = useMemo(() => contactos.find(c => c.id === selectedId), [contactos, selectedId]);

  const contactosFiltrados = useMemo(() => {
    if (!busqueda) return contactos;
    const q = busqueda.toLowerCase();
    return contactos.filter(c =>
      `${c.nombre} ${c.apellido}`.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.telefono ?? "").includes(q)
    );
  }, [contactos, busqueda]);

  const timeline = useMemo<EventoTimeline[]>(() => {
    const events: EventoTimeline[] = [];

    if (contacto) {
      events.push({
        id: `creado-${contacto.id}`,
        tipo: "contacto_creado",
        fecha: contacto.created_at,
        titulo: "Contacto creado",
        subtitulo: `${contacto.nombre} ${contacto.apellido} agregado al CRM`,
        color: "#22c55e",
        icon: "✅",
      });
    }

    interacciones.forEach(i => {
      events.push({
        id: `int-${i.id}`,
        tipo: "interaccion",
        fecha: i.created_at,
        titulo: `${ICON_TIPO[i.tipo] ?? "📌"} ${i.tipo.charAt(0).toUpperCase() + i.tipo.slice(1)}`,
        subtitulo: i.descripcion,
        color: COLOR_TIPO[i.tipo] ?? "#6b7280",
        icon: ICON_TIPO[i.tipo] ?? "📌",
        raw: i,
      });
    });

    negocios.forEach(n => {
      events.push({
        id: `neg-${n.id}`,
        tipo: "negocio_creado",
        fecha: n.created_at,
        titulo: `🏢 Negocio: ${n.titulo}`,
        subtitulo: `${n.tipo_operacion} · Etapa inicial${n.valor_operacion ? ` · ${n.moneda} ${fmt(n.valor_operacion)}` : ""}`,
        color: ETAPA_COLOR[n.etapa] ?? "#6b7280",
        icon: "🏢",
        raw: n,
      });
      if (n.updated_at !== n.created_at) {
        events.push({
          id: `neg-upd-${n.id}`,
          tipo: "negocio_etapa",
          fecha: n.updated_at,
          titulo: `🔄 Actualización: ${n.titulo}`,
          subtitulo: `Etapa actual: ${n.etapa}`,
          color: ETAPA_COLOR[n.etapa] ?? "#6b7280",
          icon: "🔄",
        });
      }
    });

    tareas.forEach(t => {
      events.push({
        id: `tarea-${t.id}`,
        tipo: "tarea",
        fecha: t.created_at,
        titulo: `✅ Tarea: ${t.titulo}`,
        subtitulo: `${t.estado} · ${t.prioridad}${t.fecha_vencimiento ? ` · Vence ${t.fecha_vencimiento}` : ""}`,
        color: t.estado === "completada" ? "#22c55e" : t.prioridad === "alta" ? "#cc0000" : "#f97316",
        icon: t.estado === "completada" ? "✅" : "⏳",
        raw: t,
      });
    });

    recordatorios.forEach(r => {
      events.push({
        id: `rec-${r.id}`,
        tipo: "recordatorio",
        fecha: r.created_at,
        titulo: `🔔 Recordatorio`,
        subtitulo: `${r.descripcion} · ${r.completado ? "Completado" : `Para el ${r.fecha_recordatorio}`}`,
        color: r.completado ? "#22c55e" : "#3b82f6",
        icon: "🔔",
        raw: r,
      });
    });

    return events
      .filter(e => filtroTipo === "todos" || e.tipo === filtroTipo)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [contacto, interacciones, negocios, tareas, recordatorios, filtroTipo]);

  const statsContacto = useMemo(() => ({
    totalInteracciones: interacciones.length,
    negociosActivos: negocios.filter(n => !["cerrado", "perdido"].includes(n.etapa)).length,
    negociosCerrados: negocios.filter(n => n.etapa === "cerrado").length,
    tareasComp: tareas.filter(t => t.estado === "completada").length,
    tareasPend: tareas.filter(t => t.estado !== "completada").length,
    ultimaActividad: interacciones[0]?.created_at ?? contacto?.created_at ?? "",
  }), [interacciones, negocios, tareas, contacto]);

  const exportarPDF = () => {
    if (!contacto) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const filas = timeline.map(e => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;font-size:11px;white-space:nowrap">${fechaCorta(e.fecha)}</td>
        <td style="padding:6px;border:1px solid #ddd;font-size:11px">${e.titulo}</td>
        <td style="padding:6px;border:1px solid #ddd;font-size:11px">${e.subtitulo}</td>
      </tr>`).join("");
    win.document.write(`<html><body style="font-family:sans-serif;padding:24px">
      <h2>Historial: ${contacto.nombre} ${contacto.apellido}</h2>
      <p>${interacciones.length} interacciones · ${negocios.length} negocios · ${tareas.length} tareas</p>
      <table border="0" style="width:100%;border-collapse:collapse">
        <thead><tr><th style="padding:6px;border:1px solid #ddd;text-align:left">Fecha</th><th style="padding:6px;border:1px solid #ddd;text-align:left">Evento</th><th style="padding:6px;border:1px solid #ddd;text-align:left">Detalle</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </body></html>`);
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", display: "flex" }}>

      {/* Panel izquierdo: lista de contactos */}
      <div style={{ width: 280, flexShrink: 0, background: "#0f0f0f", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 15, color: "#fff", marginBottom: 12 }}>
            📋 Historial de Contacto
          </div>
          <input
            placeholder="Buscar contacto…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#e5e5e5", padding: "7px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {contactosFiltrados.map(c => (
            <div key={c.id} onClick={() => setSelectedId(c.id)}
              style={{ padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid #111", background: selectedId === c.id ? "#cc000022" : "transparent", borderLeft: selectedId === c.id ? "3px solid #cc0000" : "3px solid transparent", transition: "background 0.1s" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: selectedId === c.id ? "#cc0000" : "#e5e5e5" }}>{c.nombre} {c.apellido}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{c.tipo ?? "Sin tipo"} {c.email ? `· ${c.email}` : ""}</div>
            </div>
          ))}
          {contactosFiltrados.length === 0 && (
            <div style={{ padding: 20, fontSize: 12, color: "#4b5563", textAlign: "center" }}>Sin resultados</div>
          )}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1f2937" }}>
          <Link href="/crm" style={{ color: "#6b7280", textDecoration: "none", fontSize: 12 }}>← Volver al CRM</Link>
        </div>
      </div>

      {/* Panel derecho: timeline */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {!selectedId ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, color: "#4b5563" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Seleccioná un contacto</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>para ver su historial completo</div>
          </div>
        ) : (
          <>
            {/* Header contacto */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", margin: 0 }}>
                  {contacto?.nombre} {contacto?.apellido}
                </h2>
                <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  {contacto?.telefono && (
                    <a href={`https://wa.me/${contacto.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: "#22c55e", textDecoration: "none" }}>
                      💬 {contacto.telefono}
                    </a>
                  )}
                  {contacto?.email && <span style={{ fontSize: 12, color: "#3b82f6" }}>📧 {contacto.email}</span>}
                  {contacto?.tipo && <span style={{ fontSize: 12, color: "#9ca3af" }}>· {contacto.tipo}</span>}
                </div>
              </div>
              <button onClick={exportarPDF}
                style={{ background: "#1f2937", color: "#e5e5e5", border: "1px solid #374151", borderRadius: 6, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>
                📄 PDF
              </button>
            </div>

            {/* Stats */}
            {!loading && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                {[
                  { label: "Interacciones", value: statsContacto.totalInteracciones, color: "#3b82f6" },
                  { label: "Negocios activos", value: statsContacto.negociosActivos, color: "#f97316" },
                  { label: "Cierres", value: statsContacto.negociosCerrados, color: "#22c55e" },
                  { label: "Tareas pendientes", value: statsContacto.tareasPend, color: "#cc0000" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#111", border: `1px solid ${s.color}33`, borderRadius: 8, padding: "8px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{s.label}</span>
                  </div>
                ))}
                {statsContacto.ultimaActividad && (
                  <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#6b7280", alignSelf: "center" }}>
                    Última actividad: <span style={{ color: "#9ca3af" }}>{fechaCorta(statsContacto.ultimaActividad)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Filtro tipo */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { val: "todos", label: "Todos" },
                { val: "interaccion", label: "Interacciones" },
                { val: "negocio_creado", label: "Negocios" },
                { val: "tarea", label: "Tareas" },
                { val: "recordatorio", label: "Recordatorios" },
              ].map(f => (
                <button key={f.val} onClick={() => setFiltroTipo(f.val)}
                  style={{ background: filtroTipo === f.val ? "#cc000033" : "#111", border: `1px solid ${filtroTipo === f.val ? "#cc0000" : "#333"}`, borderRadius: 20, color: filtroTipo === f.val ? "#cc0000" : "#6b7280", padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Timeline */}
            {loading ? (
              <div style={{ textAlign: "center", color: "#4b5563", padding: 60 }}>Cargando historial…</div>
            ) : timeline.length === 0 ? (
              <div style={{ textAlign: "center", color: "#4b5563", padding: 60 }}>Sin eventos registrados</div>
            ) : (
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 20, top: 0, bottom: 0, width: 2, background: "#1f2937" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {timeline.map((ev, i) => {
                    const prevFecha = i > 0 ? timeline[i - 1].fecha.slice(0, 10) : null;
                    const estaFecha = ev.fecha.slice(0, 10);
                    const showFecha = prevFecha !== estaFecha;
                    return (
                      <div key={ev.id}>
                        {showFecha && (
                          <div style={{ paddingLeft: 52, paddingTop: i > 0 ? 16 : 0, paddingBottom: 6, fontSize: 11, color: "#4b5563", fontWeight: 600 }}>
                            {fechaCorta(estaFecha)}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 16, paddingBottom: 8, paddingLeft: 0 }}>
                          <div style={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${ev.color}22`, border: `2px solid ${ev.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, zIndex: 1, marginTop: 10 }}>
                              {ev.icon}
                            </div>
                          </div>
                          <div style={{ flex: 1, background: "#111", border: `1px solid ${ev.color}22`, borderLeft: `3px solid ${ev.color}`, borderRadius: 8, padding: "10px 14px", marginTop: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5" }}>{ev.titulo}</div>
                              <div style={{ fontSize: 11, color: "#4b5563", flexShrink: 0, marginLeft: 10 }}>{horaCorta(ev.fecha)}</div>
                            </div>
                            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{ev.subtitulo}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
