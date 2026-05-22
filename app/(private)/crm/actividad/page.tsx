"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Interaccion {
  id: string;
  tipo: string;
  descripcion: string | null;
  created_at: string;
  contacto_id: string | null;
  negocio_id: string | null;
  crm_contactos?: { nombre: string; apellido: string | null } | null;
  crm_negocios?: { titulo: string } | null;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  llamada:    { icon: "📞", color: "#3b82f6",  label: "Llamada" },
  email:      { icon: "✉️",  color: "#6b7280",  label: "Email" },
  whatsapp:   { icon: "💬", color: "#22c55e",  label: "WhatsApp" },
  visita:     { icon: "🏠", color: "#f59e0b",  label: "Visita" },
  reunion:    { icon: "👥", color: "#a78bfa",  label: "Reunión" },
  oferta:     { icon: "💰", color: "#cc0000",  label: "Oferta" },
  nota:       { icon: "📝", color: "#6b7280",  label: "Nota" },
  otro:       { icon: "⚡", color: "#888",     label: "Otro" },
};

function getTipoConfig(tipo: string) {
  return TIPO_CONFIG[tipo?.toLowerCase()] ?? TIPO_CONFIG.otro;
}

function formatFechaRelativa(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const dias = Math.floor(diff / 86400000);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} sem.`;
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} meses`;
  return `Hace ${Math.floor(dias / 365)} años`;
}

function formatFechaCorta(fecha: string): string {
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function ActividadCRM() {
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroDias, setFiltroDias] = useState(90);
  const [busqueda, setBusqueda] = useState("");
  const [vistaMode, setVistaMode] = useState<"timeline" | "estadisticas">("timeline");

  useEffect(() => {
    const desde = new Date();
    desde.setDate(desde.getDate() - 180);
    supabase
      .from("crm_interacciones")
      .select("id,tipo,descripcion,created_at,contacto_id,negocio_id,crm_contactos(nombre,apellido),crm_negocios(titulo)")
      .gte("created_at", desde.toISOString())
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setInteracciones((data ?? []) as unknown as Interaccion[]);
        setLoading(false);
      });
  }, []);

  const limiteDesde = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - filtroDias);
    return d.toISOString();
  }, [filtroDias]);

  const filtradas = useMemo(() => {
    return interacciones.filter(i => {
      if (i.created_at < limiteDesde) return false;
      if (filtroTipo !== "todos" && i.tipo?.toLowerCase() !== filtroTipo) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const contactoNombre = i.crm_contactos ? `${i.crm_contactos.nombre} ${i.crm_contactos.apellido ?? ""}`.toLowerCase() : "";
        const negocioTitulo = i.crm_negocios?.titulo?.toLowerCase() ?? "";
        const desc = i.descripcion?.toLowerCase() ?? "";
        if (!contactoNombre.includes(q) && !negocioTitulo.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [interacciones, limiteDesde, filtroTipo, busqueda]);

  // Agrupar por día para timeline
  const porDia = useMemo(() => {
    const mapa: Record<string, Interaccion[]> = {};
    filtradas.forEach(i => {
      const dia = i.created_at.substring(0, 10);
      if (!mapa[dia]) mapa[dia] = [];
      mapa[dia].push(i);
    });
    return Object.entries(mapa).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtradas]);

  // Estadísticas
  const stats = useMemo(() => {
    const porTipo: Record<string, number> = {};
    filtradas.forEach(i => {
      const t = i.tipo?.toLowerCase() ?? "otro";
      porTipo[t] = (porTipo[t] ?? 0) + 1;
    });

    // Por semana (últimas 8 semanas)
    const porSemana: Record<string, number> = {};
    filtradas.forEach(i => {
      const d = new Date(i.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().substring(0, 10);
      porSemana[key] = (porSemana[key] ?? 0) + 1;
    });

    const semanas = Object.entries(porSemana).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
    const maxSemana = Math.max(...semanas.map(s => s[1]), 1);

    return { porTipo, semanas, maxSemana, total: filtradas.length };
  }, [filtradas]);

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 12, fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>⚡ Actividad del CRM</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Timeline de todas las interacciones — últimos {filtroDias} días</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, width: 160 }} />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los tipos</option>
            {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <select value={filtroDias} onChange={e => setFiltroDias(+e.target.value)} style={inputStyle}>
            {[7, 14, 30, 60, 90, 180].map(d => <option key={d} value={d}>Últimos {d} días</option>)}
          </select>
          {(["timeline", "estadisticas"] as const).map(v => (
            <button key={v} onClick={() => setVistaMode(v)} style={{
              background: vistaMode === v ? "#cc0000" : "#1a1a1a", border: "1px solid #333",
              borderRadius: 6, color: "#fff", padding: "6px 12px", fontSize: 12, cursor: "pointer",
              fontFamily: "Montserrat, sans-serif", fontWeight: 700,
            }}>{v === "timeline" ? "🕐 Timeline" : "📊 Stats"}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {loading ? (
          <div style={{ textAlign: "center", color: "#666", padding: 48 }}>Cargando...</div>
        ) : vistaMode === "estadisticas" ? (
          <>
            {/* Actividad por semana */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                Actividad semanal ({stats.total} interacciones)
              </h2>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
                {stats.semanas.map(([key, count]) => {
                  const d = new Date(key);
                  const dd = `${d.getDate()}/${d.getMonth() + 1}`;
                  return (
                    <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 11, color: "#888", textAlign: "center" }}>{count}</div>
                      <div style={{
                        width: "100%", background: "#cc0000",
                        height: `${(count / stats.maxSemana) * 80}px`,
                        borderRadius: "3px 3px 0 0", minHeight: 4,
                      }} />
                      <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>{dd}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Por tipo */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 13, fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>
                Por tipo de interacción
              </h2>
              {Object.entries(stats.porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, count]) => {
                const cfg = getTipoConfig(tipo);
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={tipo} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#ccc" }}>{cfg.icon} {cfg.label}</span>
                      <span style={{ fontSize: 12, color: "#888" }}>{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: cfg.color, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Timeline */
          filtradas.length === 0 ? (
            <div style={{ background: "#111", border: "1px solid #333", borderRadius: 10, padding: 48, textAlign: "center", color: "#666" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <p>Sin interacciones para los filtros seleccionados.</p>
            </div>
          ) : porDia.map(([dia, items]) => {
            const fecha = new Date(dia + "T12:00:00");
            const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
            const diaLabel = `${fecha.getDate()} ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
            const esHoy = dia === new Date().toISOString().substring(0, 10);
            return (
              <div key={dia}>
                {/* Separador de día */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ height: 1, flex: 1, background: "#1a1a1a" }} />
                  <span style={{
                    fontSize: 11, fontFamily: "Montserrat, sans-serif", fontWeight: 700, textTransform: "uppercase",
                    color: esHoy ? "#cc0000" : "#666", letterSpacing: "0.05em",
                  }}>
                    {esHoy ? "HOY" : diaLabel}
                  </span>
                  <span style={{ fontSize: 11, color: "#444" }}>{items.length}</span>
                  <div style={{ height: 1, flex: 1, background: "#1a1a1a" }} />
                </div>

                {/* Items del día */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map(item => {
                    const cfg = getTipoConfig(item.tipo);
                    return (
                      <div key={item.id} style={{
                        display: "flex", gap: 12, padding: "12px 16px",
                        background: "#111", border: "1px solid #1a1a1a", borderRadius: 8,
                        borderLeft: `3px solid ${cfg.color}`,
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontFamily: "Montserrat, sans-serif" }}>
                                {cfg.label}
                              </span>
                              {item.crm_contactos && (
                                <span style={{ fontSize: 12, color: "#ccc", marginLeft: 8 }}>
                                  {item.crm_contactos.nombre} {item.crm_contactos.apellido ?? ""}
                                </span>
                              )}
                              {item.crm_negocios && (
                                <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>
                                  · {item.crm_negocios.titulo}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 11, color: "#555", flexShrink: 0 }}>
                              {formatFechaCorta(item.created_at)}
                            </span>
                          </div>
                          {item.descripcion && (
                            <div style={{ fontSize: 12, color: "#888", marginTop: 4, lineHeight: 1.5 }}>
                              {item.descripcion.length > 200 ? item.descripcion.substring(0, 200) + "…" : item.descripcion}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#444", flexShrink: 0, alignSelf: "flex-start", paddingTop: 2 }}>
                          {formatFechaRelativa(item.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
