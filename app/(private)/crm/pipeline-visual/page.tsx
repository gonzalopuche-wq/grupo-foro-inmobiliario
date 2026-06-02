"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";

interface Negocio {
  id: string;
  perfil_id: string;
  contacto_id: string | null;
  titulo: string;
  tipo_operacion: string;
  etapa: string;
  descripcion: string | null;
  direccion: string | null;
  valor_operacion: number | null;
  moneda: string;
  honorarios_pct: number | null;
  fecha_reserva: string | null;
  fecha_escritura: string | null;
  fecha_cierre: string | null;
  notas: string | null;
  archivado: boolean;
  created_at: string;
  updated_at: string;
}

interface Contacto { id: string; nombre: string; apellido: string; }

const ETAPAS = [
  { value: "prospecto",         label: "Prospecto",        color: "#6b7280", icon: "🔍" },
  { value: "contactado",        label: "Contactado",       color: "#3b82f6", icon: "📞" },
  { value: "visita_coordinada", label: "Visita coord.",    color: "#8b5cf6", icon: "📋" },
  { value: "visita_realizada",  label: "Visita realizada", color: "#a78bfa", icon: "👁️" },
  { value: "oferta_enviada",    label: "Oferta enviada",   color: "#d4960c", icon: "📤" },
  { value: "negociacion",       label: "Negociación",      color: "#d4960c", icon: "🤝" },
  { value: "reserva",           label: "Reserva",          color: "#06b6d4", icon: "📝" },
  { value: "escritura",         label: "Escritura",        color: "#3abab6", icon: "⚖️" },
  { value: "cerrado",           label: "Cerrado",          color: "#3abab6", icon: "✅" },
];

const TIPOS_COLORS: Record<string, string> = {
  venta: "#990000",
  alquiler: "#3b82f6",
  alquiler_temporal: "#8b5cf6",
  loteo: "#d4960c",
  otro: "#6b7280",
};

function fmtValor(v: number | null, m: string): string {
  if (!v) return "—";
  if (v >= 1000000) return `${m} ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${m} ${(v / 1000).toFixed(0)}k`;
  return `${m} ${v.toLocaleString("es-AR")}`;
}

function fmtHon(v: number | null, pct: number | null, m: string): string {
  if (!v || !pct) return "—";
  const hon = v * (pct / 100);
  return fmtValor(hon, m);
}

function diasEnEtapa(updatedAt: string): number {
  const d = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
  return d;
}

function urgenciaColor(dias: number): string {
  if (dias > 30) return "#b80000";
  if (dias > 14) return "#d4960c";
  if (dias > 7) return "#d4960c";
  return "#3abab6";
}

export default function PipelineVisualPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Negocio | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id ?? null;
      setUid(id);
      if (id) fetchData(id);
    });
  }, []);

  async function fetchData(userId: string) {
    setLoading(true);
    const [{ data: neg }, { data: con }] = await Promise.all([
      supabase
        .from("crm_negocios")
        .select("*")
        .eq("perfil_id", userId)
        .eq("archivado", false)
        .order("updated_at", { ascending: false }),
      supabase
        .from("crm_contactos")
        .select("id,nombre,apellido")
        .eq("perfil_id", userId),
    ]);
    setNegocios(neg ?? []);
    setContactos(con ?? []);
    setLoading(false);
  }

  const contactoMap = useMemo(() => {
    const m: Record<string, Contacto> = {};
    for (const c of contactos) m[c.id] = c;
    return m;
  }, [contactos]);

  const negociosFiltrados = useMemo(() =>
    negocios.filter((n) => filtroTipo === "all" || n.tipo_operacion === filtroTipo),
    [negocios, filtroTipo]
  );

  const columnas = useMemo(() => {
    return ETAPAS.map((e) => {
      const items = negociosFiltrados.filter((n) => n.etapa === e.value);
      const totalUSD = items.reduce((acc, n) => {
        if (!n.valor_operacion) return acc;
        const v = n.moneda === "USD" ? n.valor_operacion : n.valor_operacion / 1000;
        return acc + v;
      }, 0);
      const honUSD = items.reduce((acc, n) => {
        if (!n.valor_operacion || !n.honorarios_pct) return acc;
        const v = n.moneda === "USD" ? n.valor_operacion : n.valor_operacion / 1000;
        return acc + v * (n.honorarios_pct / 100);
      }, 0);
      return { ...e, items, totalUSD, honUSD };
    });
  }, [negociosFiltrados]);

  const resumen = useMemo(() => {
    const total = negociosFiltrados.length;
    const valorTotal = columnas.reduce((a, c) => a + c.totalUSD, 0);
    const honTotal = columnas.reduce((a, c) => a + c.honUSD, 0);
    const enCierre = negociosFiltrados.filter((n) =>
      ["reserva", "escritura"].includes(n.etapa)
    ).length;
    return { total, valorTotal, honTotal, enCierre };
  }, [columnas, negociosFiltrados]);

  async function moverEtapa(negocioId: string, nuevaEtapa: string) {
    setSaving(true);
    await supabase
      .from("crm_negocios")
      .update({ etapa: nuevaEtapa, updated_at: new Date().toISOString() })
      .eq("id", negocioId);
    setNegocios((prev) =>
      prev.map((n) =>
        n.id === negocioId
          ? { ...n, etapa: nuevaEtapa, updated_at: new Date().toISOString() }
          : n
      )
    );
    if (detalle?.id === negocioId) setDetalle((d) => d ? { ...d, etapa: nuevaEtapa } : d);
    setSaving(false);
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("negocioId", id);
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOver(null);
  }

  function handleDragOver(e: React.DragEvent, etapa: string) {
    e.preventDefault();
    setDragOver(etapa);
  }

  function handleDrop(e: React.DragEvent, etapa: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("negocioId");
    if (id) moverEtapa(id, etapa);
    setDraggingId(null);
    setDragOver(null);
  }

  const card: React.CSSProperties = {
    background: "#161616",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "grab",
    userSelect: "none",
    transition: "transform 0.1s, box-shadow 0.1s",
  };

  if (loading) return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
      Cargando pipeline...
    </div>
  );

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, margin: 0 }}>
              Pipeline Visual
            </h1>
            <p style={{ color: "#666", fontSize: 13, margin: "4px 0 0" }}>
              Arrastrá las tarjetas para mover negocios entre etapas
            </p>
          </div>

          {/* KPIs */}
          <div style={{ display: "flex", gap: 20 }}>
            {[
              { label: "Negocios", value: resumen.total.toString() },
              { label: "Valor total", value: `USD ${(resumen.valorTotal / 1000).toFixed(0)}k` },
              { label: "Honorarios est.", value: `USD ${(resumen.honTotal / 1000).toFixed(0)}k` },
              { label: "En cierre", value: resumen.enCierre.toString(), highlight: true },
            ].map((k) => (
              <div key={k.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontFamily: "var(--font-display)", fontWeight: 800, color: k.highlight ? "#3abab6" : "#fff" }}>
                  {k.value}
                </div>
                <div style={{ fontSize: 10, color: "#666", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" }}>
                  {k.label}
                </div>
              </div>
            ))}
          </div>

          {/* Filtro tipo */}
          <div style={{ display: "flex", gap: 8 }}>
            {[{ v: "all", l: "Todos" }, { v: "venta", l: "Ventas" }, { v: "alquiler", l: "Alquileres" }, { v: "alquiler_temporal", l: "Temporal" }].map((f) => (
              <button
                key={f.v}
                onClick={() => setFiltroTipo(f.v)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: filtroTipo === f.v ? "1px solid #990000" : "1px solid #333",
                  background: filtroTipo === f.v ? "rgba(153,0,0,0.15)" : "var(--gfi-bg-secondary)",
                  color: filtroTipo === f.v ? "#990000" : "#888",
                  fontSize: 12,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {saving && (
        <div style={{ background: "rgba(153,0,0,0.1)", borderBottom: "1px solid rgba(153,0,0,0.3)", padding: "6px 24px", fontSize: 12, color: "#990000", fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Guardando...
        </div>
      )}

      {/* Kanban Board */}
      <div style={{ overflowX: "auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", gap: 12, minWidth: "max-content", alignItems: "flex-start" }}>
          {columnas.map((col) => {
            const isOver = dragOver === col.value;
            return (
              <div
                key={col.value}
                onDragOver={(e) => handleDragOver(e, col.value)}
                onDrop={(e) => handleDrop(e, col.value)}
                onDragLeave={() => setDragOver(null)}
                style={{
                  width: 220,
                  background: isOver ? "var(--gfi-border-subtle)" : "var(--gfi-bg-primary)",
                  border: isOver ? `2px solid ${col.color}` : "2px solid #1a1a1a",
                  borderRadius: 14,
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {/* Column header */}
                <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{col.icon}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: col.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {col.label}
                      </span>
                    </div>
                    <div style={{ background: `${col.color}22`, border: `1px solid ${col.color}55`, borderRadius: 10, padding: "2px 8px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 12, color: col.color }}>
                      {col.items.length}
                    </div>
                  </div>
                  {col.totalUSD > 0 && (
                    <div style={{ fontSize: 11, color: "#666" }}>
                      <span style={{ color: "#999" }}>USD {(col.totalUSD / 1000).toFixed(0)}k</span>
                      {col.honUSD > 0 && (
                        <span style={{ color: "#3abab6", marginLeft: 6 }}>→ {(col.honUSD / 1000).toFixed(0)}k</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 8, minHeight: 80 }}>
                  {col.items.map((n) => {
                    const contacto = n.contacto_id ? contactoMap[n.contacto_id] : null;
                    const dias = diasEnEtapa(n.updated_at);
                    const isDragging = draggingId === n.id;
                    return (
                      <div
                        key={n.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, n.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setDetalle(detalle?.id === n.id ? null : n)}
                        style={{
                          ...card,
                          opacity: isDragging ? 0.4 : 1,
                          transform: isDragging ? "rotate(3deg)" : "none",
                          boxShadow: detalle?.id === n.id ? `0 0 0 2px ${col.color}` : "none",
                        }}
                      >
                        {/* Tipo badge */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: TIPOS_COLORS[n.tipo_operacion] ?? "#888", background: `${TIPOS_COLORS[n.tipo_operacion] ?? "#888"}22`, borderRadius: 4, padding: "2px 6px" }}>
                            {n.tipo_operacion.replace("_", " ")}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: urgenciaColor(dias) }} />
                            <span style={{ fontSize: 9, color: "#666" }}>{dias}d</span>
                          </div>
                        </div>

                        {/* Título */}
                        <div style={{ fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 4, wordBreak: "break-word" }}>
                          {n.titulo}
                        </div>

                        {/* Contacto */}
                        {contacto && (
                          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                            {contacto.nombre} {contacto.apellido}
                          </div>
                        )}

                        {/* Valor */}
                        {n.valor_operacion && (
                          <div style={{ fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 700, color: "#fff" }}>
                            {fmtValor(n.valor_operacion, n.moneda)}
                            {n.honorarios_pct && (
                              <span style={{ color: "#3abab6", marginLeft: 6, fontSize: 10 }}>
                                +{fmtHon(n.valor_operacion, n.honorarios_pct, n.moneda)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Dirección */}
                        {n.direccion && (
                          <div style={{ fontSize: 10, color: "#666", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {n.direccion}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {col.items.length === 0 && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 11, textAlign: "center", padding: "20px 0" }}>
                      Soltá aquí
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detalle lateral */}
      {detalle && (
        <div style={{
          position: "fixed", right: 0, top: 0, bottom: 0, width: 340,
          background: "var(--gfi-bg-secondary)", borderLeft: "1px solid #222",
          overflowY: "auto", padding: 24, zIndex: 100,
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, margin: 0, color: "#fff" }}>
              Detalle
            </h2>
            <button
              onClick={() => setDetalle(null)}
              style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer", padding: 0 }}
            >
              ×
            </button>
          </div>

          {/* Etapa selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 8, fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase" }}>
              Etapa actual
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ETAPAS.map((e) => (
                <button
                  key={e.value}
                  onClick={() => moverEtapa(detalle.id, e.value)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 12,
                    border: `1px solid ${detalle.etapa === e.value ? e.color : "#333"}`,
                    background: detalle.etapa === e.value ? `${e.color}22` : "transparent",
                    color: detalle.etapa === e.value ? e.color : "#666",
                    fontSize: 11,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          {[
            { label: "Título", value: detalle.titulo },
            { label: "Tipo", value: detalle.tipo_operacion.replace("_", " ") },
            {
              label: "Valor",
              value: detalle.valor_operacion
                ? fmtValor(detalle.valor_operacion, detalle.moneda)
                : "—",
            },
            {
              label: "Honorarios",
              value: detalle.honorarios_pct
                ? `${detalle.honorarios_pct}% → ${fmtHon(detalle.valor_operacion, detalle.honorarios_pct, detalle.moneda)}`
                : "—",
            },
            { label: "Dirección", value: detalle.direccion ?? "—" },
            {
              label: "Contacto",
              value: detalle.contacto_id && contactoMap[detalle.contacto_id]
                ? `${contactoMap[detalle.contacto_id].nombre} ${contactoMap[detalle.contacto_id].apellido}`
                : "—",
            },
            {
              label: "Última actualización",
              value: new Date(detalle.updated_at).toLocaleDateString("es-AR"),
            },
            {
              label: "Días en etapa",
              value: `${diasEnEtapa(detalle.updated_at)} días`,
            },
          ].map((row) => (
            <div key={row.label} style={{ borderBottom: "1px solid #1a1a1a", paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#666", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>
                {row.label}
              </div>
              <div style={{ fontSize: 14, color: "#fff" }}>{row.value}</div>
            </div>
          ))}

          {detalle.notas && (
            <div>
              <div style={{ fontSize: 10, color: "#666", fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                Notas
              </div>
              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6, background: "#161616", borderRadius: 8, padding: 12 }}>
                {detalle.notas}
              </div>
            </div>
          )}

          {/* Mover etapa rápido */}
          <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
            {(() => {
              const idx = ETAPAS.findIndex((e) => e.value === detalle.etapa);
              const prev = idx > 0 ? ETAPAS[idx - 1] : null;
              const next = idx < ETAPAS.length - 1 ? ETAPAS[idx + 1] : null;
              return (
                <>
                  {prev && (
                    <button
                      onClick={() => moverEtapa(detalle.id, prev.value)}
                      style={{ flex: 1, padding: "10px 0", background: "#161616", border: `1px solid ${prev.color}55`, borderRadius: 8, color: prev.color, fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 700, cursor: "pointer" }}
                    >
                      ← {prev.label}
                    </button>
                  )}
                  {next && (
                    <button
                      onClick={() => moverEtapa(detalle.id, next.value)}
                      style={{ flex: 1, padding: "10px 0", background: `${next.color}22`, border: `1px solid ${next.color}`, borderRadius: 8, color: next.color, fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 700, cursor: "pointer" }}
                    >
                      {next.label} →
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
