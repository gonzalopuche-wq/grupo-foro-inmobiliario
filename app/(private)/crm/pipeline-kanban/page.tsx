"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ───────────────────────────────────────────────────────────────────

type Etapa =
  | "prospecto"
  | "contactado"
  | "visita"
  | "oferta"
  | "negociacion"
  | "escritura"
  | "cerrado"
  | "perdido";

const ETAPAS: { id: Etapa; label: string; color: string }[] = [
  { id: "prospecto",   label: "Prospecto",   color: "#6b7280" },
  { id: "contactado",  label: "Contactado",  color: "#3b82f6" },
  { id: "visita",      label: "Visita",       color: "#8b5cf6" },
  { id: "oferta",      label: "Oferta",       color: "#f59e0b" },
  { id: "negociacion", label: "Negociación",  color: "#f97316" },
  { id: "escritura",   label: "Escritura",    color: "#10b981" },
  { id: "cerrado",     label: "Cerrado",      color: "#22c55e" },
  { id: "perdido",     label: "Perdido",      color: "#cc0000" },
];

interface CrmContactoRow {
  nombre: string;
  apellido: string;
}

interface NegocioRaw {
  id: string;
  titulo: string;
  etapa: string;
  tipo_operacion: string;
  valor_operacion: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  fecha_cierre: string | null;
  updated_at: string;
  crm_contactos: CrmContactoRow | CrmContactoRow[] | null;
}

interface NegocioKanban {
  id: string;
  titulo: string;
  etapa: Etapa;
  tipo: string;
  precio_cierre: number | null;
  moneda: string | null;
  honorarios_pct: number | null;
  fecha_cierre: string | null;
  contacto_nombre: string | null;
  dias_en_etapa: number;
  updated_at: string;
}

type TabId = "kanban" | "resumen";

// ── Helpers ─────────────────────────────────────────────────────────────────

function calcDias(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
}

function diasColor(dias: number): string {
  if (dias > 21) return "#cc0000";
  if (dias >= 7) return "#f59e0b";
  return "#22c55e";
}

function fmtPrecio(valor: number | null, moneda: string | null): string {
  if (!valor) return "—";
  const cur = moneda ?? "USD";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  }).format(valor);
}

function calcHonorarios(precio: number | null, pct: number | null): number {
  if (!precio || !pct) return 0;
  return precio * (pct / 100);
}

function fmtHonorarios(precio: number | null, pct: number | null, moneda: string | null): string {
  const h = calcHonorarios(precio, pct);
  if (!h) return "—";
  return fmtPrecio(h, moneda);
}

function etapaAnterior(etapa: Etapa): Etapa | null {
  const idx = ETAPAS.findIndex((e) => e.id === etapa);
  if (idx <= 0) return null;
  return ETAPAS[idx - 1].id;
}

function etapaSiguiente(etapa: Etapa): Etapa | null {
  const idx = ETAPAS.findIndex((e) => e.id === etapa);
  if (idx < 0 || idx >= ETAPAS.length - 1) return null;
  return ETAPAS[idx + 1].id;
}

function normalizeContacto(raw: CrmContactoRow | CrmContactoRow[] | null): string | null {
  if (!raw) return null;
  const c = Array.isArray(raw) ? raw[0] : raw;
  if (!c) return null;
  return `${c.nombre} ${c.apellido}`.trim();
}

const ETAPA_ALIAS: Record<string, Etapa> = {
  visita_coordinada: "visita",
  visita_realizada:  "visita",
  oferta_enviada:    "oferta",
  escriturado:       "cerrado",
  firmado:           "cerrado",
};

function toEtapa(raw: string): Etapa {
  if (ETAPA_ALIAS[raw]) return ETAPA_ALIAS[raw];
  const found = ETAPAS.find((e) => e.id === raw);
  return found ? found.id : "prospecto";
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function PipelineKanbanPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [negocios, setNegocios] = useState<NegocioKanban[]>([]);
  const [loading, setLoading] = useState(true);
  const [incluirCerrados, setIncluirCerrados] = useState(false);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("kanban");

  // ── Auth + carga ──────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id ?? null;
      setUid(id);
      if (id) fetchData(id, false);
    });
  }, []);

  useEffect(() => {
    if (uid) fetchData(uid, incluirCerrados);
  }, [incluirCerrados, uid]);

  async function fetchData(userId: string, conCerrados: boolean) {
    setLoading(true);
    let q = supabase
      .from("crm_negocios")
      .select(
        `id, titulo, etapa, tipo_operacion, valor_operacion, moneda, honorarios_pct,
         fecha_cierre, updated_at,
         crm_contactos ( nombre, apellido )`
      )
      .eq("perfil_id", userId);

    if (!conCerrados) {
      q = q.not("etapa", "in", '("cerrado","perdido")');
    }

    const { data } = await q;
    const rows = (data ?? []) as NegocioRaw[];
    const mapped: NegocioKanban[] = rows.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      etapa: toEtapa(r.etapa),
      tipo: r.tipo_operacion ?? "otro",
      precio_cierre: r.valor_operacion,
      moneda: r.moneda,
      honorarios_pct: r.honorarios_pct,
      fecha_cierre: r.fecha_cierre,
      contacto_nombre: normalizeContacto(r.crm_contactos),
      dias_en_etapa: calcDias(r.updated_at),
      updated_at: r.updated_at,
    }));
    setNegocios(mapped);
    setLoading(false);
  }

  // ── Mover negocio ─────────────────────────────────────────────────────────

  async function moverNegocio(id: string, nuevaEtapa: Etapa) {
    setMoviendo(id);
    await supabase
      .from("crm_negocios")
      .update({ etapa: nuevaEtapa, updated_at: new Date().toISOString() })
      .eq("id", id);
    setNegocios((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, etapa: nuevaEtapa, updated_at: new Date().toISOString(), dias_en_etapa: 0 }
          : n
      )
    );
    setMoviendo(null);
  }

  // ── Columnas kanban ───────────────────────────────────────────────────────

  const etapasVisibles = useMemo(
    () => (incluirCerrados ? ETAPAS : ETAPAS.filter((e) => e.id !== "cerrado" && e.id !== "perdido")),
    [incluirCerrados]
  );

  const columnas = useMemo(
    () =>
      etapasVisibles.map((e) => {
        const items = negocios.filter((n) => n.etapa === e.id);
        const totalHon = items.reduce((acc, n) => acc + calcHonorarios(n.precio_cierre, n.honorarios_pct), 0);
        return { ...e, items, totalHon };
      }),
    [negocios, etapasVisibles]
  );

  // ── Datos resumen ─────────────────────────────────────────────────────────

  const totalActivos = useMemo(
    () => negocios.filter((n) => n.etapa !== "cerrado" && n.etapa !== "perdido").length,
    [negocios]
  );

  const resumenEtapas = useMemo(
    () =>
      ETAPAS.map((e) => {
        const items = negocios.filter((n) => n.etapa === e.id);
        const totalHon = items.reduce((acc, n) => acc + calcHonorarios(n.precio_cierre, n.honorarios_pct), 0);
        const diasProm =
          items.length > 0
            ? Math.round(items.reduce((acc, n) => acc + n.dias_en_etapa, 0) / items.length)
            : 0;
        const convPct = totalActivos > 0 ? Math.round((items.length / totalActivos) * 100) : 0;
        return { ...e, items, totalHon, diasProm, convPct };
      }),
    [negocios, totalActivos]
  );

  const maxHon = useMemo(
    () => Math.max(...resumenEtapas.map((r) => r.totalHon), 1),
    [resumenEtapas]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          background: "#0a0a0a",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Cargando pipeline...
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "20px 24px" }}>
        <div
          style={{
            maxWidth: 1800,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                fontSize: 28,
                color: "#fff",
                margin: 0,
              }}
            >
              Pipeline Kanban
            </h1>
            <p style={{ color: "#666", fontSize: 13, margin: "4px 0 0", fontFamily: "Inter, sans-serif" }}>
              Mové negocios entre etapas con los botones ← →
            </p>
          </div>

          {/* Filtro cerrados */}
          <button
            onClick={() => setIncluirCerrados((v) => !v)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: incluirCerrados ? "1px solid #22c55e" : "1px solid #333",
              background: incluirCerrados ? "rgba(34,197,94,0.1)" : "#111",
              color: incluirCerrados ? "#22c55e" : "#888",
              fontSize: 12,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {incluirCerrados ? "✓ " : ""}Incluir cerrados y perdidos
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "0 24px" }}>
        <div style={{ maxWidth: 1800, margin: "0 auto", display: "flex", gap: 0 }}>
          {(
            [
              { id: "kanban", label: "Kanban" },
              { id: "resumen", label: "Resumen por etapa" },
            ] as { id: TabId; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "12px 20px",
                background: "transparent",
                border: "none",
                borderBottom: tab === t.id ? "2px solid #cc0000" : "2px solid transparent",
                color: tab === t.id ? "#fff" : "#666",
                fontSize: 14,
                fontFamily: "Montserrat, sans-serif",
                fontWeight: tab === t.id ? 700 : 600,
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Kanban ── */}
      {tab === "kanban" && (
        <div style={{ overflowX: "auto", padding: "20px 16px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: "max-content" }}>
            {columnas.map((col) => (
              <KanbanColumna
                key={col.id}
                etapa={col}
                items={col.items}
                totalHon={col.totalHon}
                onMover={moverNegocio}
                moviendo={moviendo}
                etapasVisibles={etapasVisibles.map((e) => e.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Resumen ── */}
      {tab === "resumen" && (
        <ResumenTab resumen={resumenEtapas} maxHon={maxHon} />
      )}
    </div>
  );
}

// ── Columna Kanban ────────────────────────────────────────────────────────────

interface ColProps {
  etapa: { id: Etapa; label: string; color: string };
  items: NegocioKanban[];
  totalHon: number;
  onMover: (id: string, etapa: Etapa) => Promise<void>;
  moviendo: string | null;
  etapasVisibles: Etapa[];
}

function KanbanColumna({ etapa, items, totalHon, onMover, moviendo, etapasVisibles }: ColProps) {
  const prev = etapaAnterior(etapa.id);
  const next = etapaSiguiente(etapa.id);
  const prevVisible = prev && etapasVisibles.includes(prev) ? prev : null;
  const nextVisible = next && etapasVisibles.includes(next) ? next : null;

  return (
    <div
      style={{
        minWidth: 240,
        maxWidth: 260,
        background: "#111",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #1e1e1e",
      }}
    >
      {/* Header columna */}
      <div
        style={{
          borderTop: `4px solid ${etapa.color}`,
          padding: "10px 12px 8px",
          background: "#141414",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              color: "#fff",
            }}
          >
            {etapa.label}
          </span>
          <span
            style={{
              background: etapa.color,
              color: "#fff",
              borderRadius: 20,
              padding: "2px 8px",
              fontSize: 11,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
            }}
          >
            {items.length}
          </span>
        </div>
        {totalHon > 0 && (
          <div style={{ fontSize: 11, color: "#888", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
            Hon. est.:{" "}
            <span style={{ color: "#22c55e", fontWeight: 600 }}>
              {new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(totalHon)}
            </span>
          </div>
        )}
      </div>

      {/* Cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 8,
          minHeight: 60,
          maxHeight: "calc(100vh - 260px)",
          overflowY: "auto",
        }}
      >
        {items.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#333",
              fontSize: 12,
              padding: "20px 0",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Sin negocios
          </div>
        )}
        {items.map((n) => (
          <NegocioCard
            key={n.id}
            negocio={n}
            etapaActual={etapa}
            prevEtapa={prevVisible ? ETAPAS.find((e) => e.id === prevVisible) ?? null : null}
            nextEtapa={nextVisible ? ETAPAS.find((e) => e.id === nextVisible) ?? null : null}
            onMover={onMover}
            moviendo={moviendo}
          />
        ))}
      </div>
    </div>
  );
}

// ── Card de negocio ───────────────────────────────────────────────────────────

interface CardProps {
  negocio: NegocioKanban;
  etapaActual: { id: Etapa; label: string; color: string };
  prevEtapa: { id: Etapa; label: string; color: string } | null;
  nextEtapa: { id: Etapa; label: string; color: string } | null;
  onMover: (id: string, etapa: Etapa) => Promise<void>;
  moviendo: string | null;
}

const TIPO_COLORS: Record<string, string> = {
  venta: "#cc0000",
  alquiler: "#3b82f6",
  alquiler_temporal: "#8b5cf6",
  loteo: "#f97316",
  otro: "#6b7280",
};

function NegocioCard({ negocio, prevEtapa, nextEtapa, onMover, moviendo }: CardProps) {
  const isMoving = moviendo === negocio.id;
  const dColor = diasColor(negocio.dias_en_etapa);
  const tipoColor = TIPO_COLORS[negocio.tipo] ?? "#6b7280";

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: 8,
        padding: 12,
        opacity: isMoving ? 0.5 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Título */}
      <div
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          color: "#fff",
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {negocio.titulo}
      </div>

      {/* Contacto */}
      {negocio.contacto_nombre && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
          {negocio.contacto_nombre}
        </div>
      )}

      {/* Tipo badge */}
      <div style={{ marginBottom: 6 }}>
        <span
          style={{
            background: `${tipoColor}22`,
            border: `1px solid ${tipoColor}55`,
            color: tipoColor,
            borderRadius: 4,
            padding: "2px 6px",
            fontSize: 10,
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {negocio.tipo}
        </span>
      </div>

      {/* Precio */}
      {negocio.precio_cierre && (
        <div style={{ fontSize: 12, color: "#ccc", marginBottom: 2, fontFamily: "Inter, sans-serif" }}>
          {fmtPrecio(negocio.precio_cierre, negocio.moneda)}
          {negocio.honorarios_pct && (
            <span style={{ color: "#22c55e", marginLeft: 6 }}>
              → {fmtHonorarios(negocio.precio_cierre, negocio.honorarios_pct, negocio.moneda)}
            </span>
          )}
        </div>
      )}

      {/* Fecha cierre estimada */}
      {negocio.fecha_cierre && (
        <div style={{ fontSize: 11, color: "#666", marginBottom: 4, fontFamily: "Inter, sans-serif" }}>
          Cierre: {new Date(negocio.fecha_cierre).toLocaleDateString("es-AR")}
        </div>
      )}

      {/* Días en etapa */}
      <div style={{ fontSize: 11, color: dColor, marginBottom: 8, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
        {negocio.dias_en_etapa === 0
          ? "Hoy"
          : `${negocio.dias_en_etapa}d en etapa`}
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {/* Flecha anterior */}
        <button
          onClick={() => prevEtapa && onMover(negocio.id, prevEtapa.id)}
          disabled={!prevEtapa || isMoving}
          title={prevEtapa ? `Mover a ${prevEtapa.label}` : "Primera etapa"}
          style={{
            background: prevEtapa ? "rgba(255,255,255,0.06)" : "transparent",
            border: "1px solid #333",
            borderRadius: 4,
            color: prevEtapa ? "#aaa" : "#333",
            cursor: prevEtapa && !isMoving ? "pointer" : "default",
            padding: "3px 7px",
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          ←
        </button>

        {/* Link Ver */}
        <Link
          href={`/crm?negocio=${negocio.id}`}
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 11,
            color: "#888",
            textDecoration: "none",
            padding: "3px 0",
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            border: "1px solid #2a2a2a",
            borderRadius: 4,
            background: "#141414",
            display: "block",
          }}
        >
          Ver
        </Link>

        {/* Flecha siguiente */}
        <button
          onClick={() => nextEtapa && onMover(negocio.id, nextEtapa.id)}
          disabled={!nextEtapa || isMoving}
          title={nextEtapa ? `Mover a ${nextEtapa.label}` : "Última etapa"}
          style={{
            background: nextEtapa ? "rgba(255,255,255,0.06)" : "transparent",
            border: "1px solid #333",
            borderRadius: 4,
            color: nextEtapa ? "#aaa" : "#333",
            cursor: nextEtapa && !isMoving ? "pointer" : "default",
            padding: "3px 7px",
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

// ── Tab Resumen ───────────────────────────────────────────────────────────────

interface ResumenEtapa {
  id: Etapa;
  label: string;
  color: string;
  items: NegocioKanban[];
  totalHon: number;
  diasProm: number;
  convPct: number;
}

interface ResumenTabProps {
  resumen: ResumenEtapa[];
  maxHon: number;
}

function ResumenTab({ resumen, maxHon }: ResumenTabProps) {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px" }}>
      {/* Funnel SVG */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 16,
            color: "#fff",
            marginBottom: 16,
          }}
        >
          Distribución por etapa
        </h2>
        <div style={{ background: "#111", borderRadius: 10, padding: 20, border: "1px solid #1e1e1e" }}>
          <svg width="100%" viewBox={`0 0 600 ${ETAPAS.length * 36}`} style={{ display: "block" }}>
            {resumen.map((r, i) => {
              const barW = maxHon > 0 ? Math.max((r.totalHon / maxHon) * 520, r.items.length > 0 ? 12 : 0) : 0;
              const y = i * 36;
              return (
                <g key={r.id}>
                  {/* Label */}
                  <text
                    x={0}
                    y={y + 22}
                    fill="#888"
                    fontSize={11}
                    fontFamily="Montserrat, sans-serif"
                    fontWeight={600}
                    style={{ userSelect: "none" }}
                  >
                    {r.label}
                  </text>
                  {/* Barra fondo */}
                  <rect x={80} y={y + 8} width={520} height={20} rx={4} fill="#1e1e1e" />
                  {/* Barra valor */}
                  {barW > 0 && (
                    <rect x={80} y={y + 8} width={barW} height={20} rx={4} fill={r.color} opacity={0.8} />
                  )}
                  {/* Count badge */}
                  <text
                    x={82 + barW}
                    y={y + 22}
                    fill="#ccc"
                    fontSize={10}
                    fontFamily="Inter, sans-serif"
                    dominantBaseline="middle"
                    style={{ userSelect: "none" }}
                  >
                    {r.items.length > 0 ? ` ${r.items.length}` : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Tabla */}
      <h2
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 16,
          color: "#fff",
          marginBottom: 12,
        }}
      >
        Tabla de conversión
      </h2>
      <div
        style={{
          background: "#111",
          borderRadius: 10,
          border: "1px solid #1e1e1e",
          overflow: "hidden",
        }}
      >
        {/* Encabezado tabla */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 1fr 100px 90px",
            padding: "10px 16px",
            background: "#141414",
            borderBottom: "1px solid #1e1e1e",
          }}
        >
          {["Etapa", "Cant.", "Hon. estimados", "Días prom.", "Conversión"].map((h) => (
            <span
              key={h}
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 11,
                color: "#666",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Filas tabla */}
        {resumen.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 1fr 100px 90px",
              padding: "10px 16px",
              borderBottom: i < resumen.length - 1 ? "1px solid #1a1a1a" : "none",
              alignItems: "center",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
            }}
          >
            {/* Etapa */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: r.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 13, color: "#fff" }}>
                {r.label}
              </span>
            </div>

            {/* Cantidad */}
            <span
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                color: r.items.length > 0 ? "#fff" : "#444",
              }}
            >
              {r.items.length}
            </span>

            {/* Honorarios */}
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: r.totalHon > 0 ? "#22c55e" : "#444" }}>
              {r.totalHon > 0
                ? new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(r.totalHon)
                : "—"}
            </span>

            {/* Días promedio */}
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: diasColor(r.diasProm) }}>
              {r.items.length > 0 ? `${r.diasProm}d` : "—"}
            </span>

            {/* Conversión % */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: "#1e1e1e",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${r.convPct}%`,
                    height: "100%",
                    background: r.color,
                    borderRadius: 3,
                  }}
                />
              </div>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#888", minWidth: 32 }}>
                {r.convPct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
