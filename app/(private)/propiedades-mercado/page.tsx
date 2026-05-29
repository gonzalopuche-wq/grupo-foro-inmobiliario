"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

// ── Configuración de portales ──────────────────────────────────────────────
const PORTALES = [
  { id: "gfi_red",      label: "Red GFI",       color: "#cc0000", bg: "rgba(200,0,0,0.14)", textColor: "#fff" },
  { id: "gfi_portal",   label: "Portal GFI",    color: "#ff4444", bg: "rgba(255,68,68,0.10)", textColor: "#fff" },
  { id: "mercadolibre", label: "Mercado Libre",  color: "#ffe600", bg: "rgba(255,230,0,0.12)", textColor: "#000" },
  { id: "zonaprop",     label: "Zonaprop",       color: "#00b274", bg: "rgba(0,178,116,0.12)", textColor: "#fff" },
  { id: "argenprop",    label: "Argenprop",       color: "#4a90d9", bg: "rgba(74,144,217,0.12)", textColor: "#fff" },
  { id: "properati",    label: "Properati",       color: "#ff6b35", bg: "rgba(255,107,53,0.12)", textColor: "#fff" },
] as const;

type PortalId = (typeof PORTALES)[number]["id"];

const OPERACIONES = [
  { id: "", label: "Todas las operaciones" },
  { id: "venta", label: "Venta" },
  { id: "alquiler", label: "Alquiler" },
  { id: "alquiler_temporal", label: "Alquiler temporal" },
];

const TIPOS = [
  { id: "", label: "Todos los tipos" },
  { id: "departamento", label: "Departamento" },
  { id: "casa", label: "Casa" },
  { id: "ph", label: "PH" },
  { id: "local", label: "Local" },
  { id: "oficina", label: "Oficina" },
  { id: "terreno", label: "Terreno" },
  { id: "cochera", label: "Cochera" },
];

const DORM_OPTS = [
  { id: "", label: "Cualquier dormitorio" },
  { id: "1", label: "1+" },
  { id: "2", label: "2+" },
  { id: "3", label: "3+" },
  { id: "4", label: "4+" },
];

interface Propiedad {
  id: string;
  portal: PortalId;
  portal_id: string;
  url: string;
  titulo: string;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string;
  dormitorios: number | null;
  banos: number | null;
  ambientes: number | null;
  superficie_cubierta: number | null;
  sup_terreno: number | null;
  expensas: number | null;
  barrio: string | null;
  ciudad: string;
  imagenes: string[];
  synced_at: string;
}

interface Filters {
  portalesActivos: PortalId[];
  operacion: string;
  tipo: string;
  dorm: string;
  min: string;
  max: string;
  q: string;
}

const defaultFilters: Filters = {
  portalesActivos: [],
  operacion: "",
  tipo: "",
  dorm: "",
  min: "",
  max: "",
  q: "",
};

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

function PortalBadge({ portal }: { portal: PortalId }) {
  const p = PORTALES.find(x => x.id === portal);
  if (!p) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
      padding: "2px 6px", borderRadius: 3,
      background: p.bg, color: p.id === "mercadolibre" ? "#996600" : p.color,
      border: `1px solid ${p.color}40`,
      fontFamily: "'Montserrat',sans-serif", textTransform: "uppercase",
    }}>
      {p.label}
    </span>
  );
}

function PropCard({ p }: { p: Propiedad }) {
  const img = p.imagenes?.[0];
  const precio = p.precio
    ? `${p.moneda === "ARS" ? "$" : "USD"} ${fmt(p.precio)}`
    : "A consultar";
  const specs: string[] = [];
  if (p.ambientes) specs.push(`${p.ambientes} amb.`);
  else if (p.dormitorios) specs.push(`${p.dormitorios} dorm.`);
  if (p.banos) specs.push(`${p.banos} baño${p.banos > 1 ? "s" : ""}`);
  if (p.superficie_cubierta) specs.push(`${p.superficie_cubierta} m²`);
  else if (p.sup_terreno) specs.push(`${p.sup_terreno} m² terreno`);

  const opColor = p.operacion === "venta" ? "#22c55e" : p.operacion === "alquiler" ? "#60a5fa" : "#f59e0b";

  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "flex", flexDirection: "column" }}
    >
      <div style={{
        background: "rgba(18,18,18,0.9)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        transition: "border-color 0.15s, transform 0.15s",
        cursor: "pointer",
        height: "100%",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
          (e.currentTarget as HTMLElement).style.transform = "";
        }}
      >
        {/* Imagen */}
        <div style={{ position: "relative", height: 160, background: "#111", flexShrink: 0 }}>
          {img ? (
            <img
              src={img}
              alt={p.titulo}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "rgba(255,255,255,0.1)" }}>
              🏠
            </div>
          )}
          {/* Operación badge */}
          <span style={{
            position: "absolute", top: 8, left: 8,
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            padding: "3px 7px", borderRadius: 3,
            background: `${opColor}22`, color: opColor,
            border: `1px solid ${opColor}44`,
            fontFamily: "'Montserrat',sans-serif", textTransform: "uppercase",
          }}>
            {p.operacion === "alquiler_temporal" ? "Alq. temporal" : p.operacion}
          </span>
          {/* Tipo */}
          <span style={{
            position: "absolute", top: 8, right: 8,
            fontSize: 9, fontWeight: 600, padding: "3px 7px",
            borderRadius: 3, background: "rgba(0,0,0,0.7)",
            color: "rgba(255,255,255,0.7)", textTransform: "capitalize",
          }}>
            {p.tipo}
          </span>
        </div>

        {/* Contenido */}
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {/* Portal */}
          <PortalBadge portal={p.portal} />

          {/* Título */}
          <p style={{
            fontSize: 12, color: "rgba(255,255,255,0.82)", fontWeight: 500,
            fontFamily: "'Inter',sans-serif", margin: 0,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            lineHeight: 1.4,
          }}>
            {p.titulo}
          </p>

          {/* Precio */}
          <p style={{
            fontSize: 15, fontWeight: 700, color: "#fff",
            fontFamily: "'Montserrat',sans-serif", margin: 0,
          }}>
            {precio}
          </p>

          {/* Specs */}
          {specs.length > 0 && (
            <p style={{
              fontSize: 11, color: "rgba(255,255,255,0.45)",
              fontFamily: "'Inter',sans-serif", margin: 0,
            }}>
              {specs.join(" · ")}
            </p>
          )}

          {/* Ubicación */}
          <p style={{
            fontSize: 11, color: "rgba(255,255,255,0.35)",
            fontFamily: "'Inter',sans-serif", margin: 0, marginTop: "auto",
          }}>
            📍 {[p.barrio, p.ciudad].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>
    </a>
  );
}

export default function PropiedadesMercadoPage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [props, setProps] = useState<Propiedad[]>([]);
  const [total, setTotal] = useState(0);
  const [porPortal, setPorPortal] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResultado, setSyncResultado] = useState<string | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [syncPortal, setSyncPortal] = useState<string>("all");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      supabase.from("perfiles").select("tipo").eq("id", session.user.id).single()
        .then(({ data }) => setEsAdmin(["admin", "master"].includes(data?.tipo ?? "")));
    });
  }, []);

  const fetchProps = useCallback(async (currentPage: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.portalesActivos.length === 1) params.set("portal", filters.portalesActivos[0]);
      if (filters.operacion) params.set("operacion", filters.operacion);
      if (filters.tipo) params.set("tipo", filters.tipo);
      if (filters.dorm) params.set("dorm", filters.dorm);
      if (filters.min) params.set("min", filters.min);
      if (filters.max) params.set("max", filters.max);
      if (filters.q) params.set("q", filters.q);
      params.set("page", String(currentPage));

      const res = await fetch(`/api/propiedades-externas?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setProps(json.data ?? []);
      setTotal(json.total ?? 0);
      setPorPortal(json.porPortal ?? {});
      if (json.data?.[0]?.synced_at) setUltimaSync(json.data[0].synced_at);
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    setPage(1);
    fetchProps(1);
  }, [filters, fetchProps]);

  useEffect(() => {
    if (page > 1) fetchProps(page);
  }, [page, fetchProps]);

  async function handleSync(portal: string) {
    if (!token) return;
    setSyncing(true);
    setSyncResultado(null);
    try {
      const res = await fetch("/api/propiedades-externas/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ portal }),
      });
      const json = await res.json();
      if (json.ok) {
        const lineas = Object.entries(json.resultados as Record<string, any>)
          .map(([p, r]: [string, any]) => `${p}: ${r.importados} importadas${r.error ? ` (${r.error})` : ""}`)
          .join(" · ");
        setSyncResultado(`✓ ${json.total} propiedades — ${lineas}`);
        fetchProps(1);
      } else {
        setSyncResultado("✗ Error en la sincronización");
      }
    } catch {
      setSyncResultado("✗ Error de red");
    } finally {
      setSyncing(false);
    }
  }

  function togglePortal(id: PortalId) {
    setFilters(f => ({
      ...f,
      portalesActivos: f.portalesActivos.includes(id)
        ? f.portalesActivos.filter(p => p !== id)
        : [...f.portalesActivos, id],
    }));
  }

  const totalPages = Math.ceil(total / 24);
  const totalGeneral = Object.values(porPortal).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: "28px 24px 80px", maxWidth: 1400, margin: "0 auto" }}>
      <style>{`
        .pm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
        .pm-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #fff; padding: 8px 12px; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; width: 100%; }
        .pm-input:focus { border-color: rgba(200,0,0,0.5); }
        .pm-input::placeholder { color: rgba(255,255,255,0.25); }
        .pm-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: rgba(255,255,255,0.8); padding: 8px 12px; font-size: 12px; font-family: 'Inter',sans-serif; outline: none; width: 100%; cursor: pointer; }
        .pm-select option { background: #1a1a1a; color: #fff; }
        @media (max-width: 768px) { .pm-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: "#fff", margin: 0 }}>
          🏙️ Portales del Mercado
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4, fontFamily: "'Inter',sans-serif" }}>
          Propiedades sincronizadas desde Mercado Libre, Zonaprop, Argenprop y Properati
          {ultimaSync && ` · Última sync: ${new Date(ultimaSync).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
        </p>
      </div>

      {/* Chips de portales (stats) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button
          onClick={() => setFilters(f => ({ ...f, portalesActivos: [] }))}
          style={{
            padding: "6px 14px", borderRadius: 20,
            background: filters.portalesActivos.length === 0 ? "rgba(200,0,0,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${filters.portalesActivos.length === 0 ? "rgba(200,0,0,0.4)" : "rgba(255,255,255,0.1)"}`,
            color: filters.portalesActivos.length === 0 ? "#cc0000" : "rgba(255,255,255,0.5)",
            cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif",
          }}
        >
          Todos ({totalGeneral.toLocaleString("es-AR")})
        </button>
        {PORTALES.map(p => {
          const count = porPortal[p.id] ?? 0;
          const activo = filters.portalesActivos.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => togglePortal(p.id)}
              style={{
                padding: "6px 14px", borderRadius: 20,
                background: activo ? p.bg : "rgba(255,255,255,0.04)",
                border: `1px solid ${activo ? p.color + "60" : "rgba(255,255,255,0.08)"}`,
                color: activo ? (p.id === "mercadolibre" ? "#996600" : p.color) : "rgba(255,255,255,0.45)",
                cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif",
                transition: "all 0.15s",
              }}
            >
              {p.label} ({count.toLocaleString("es-AR")})
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={{
        background: "rgba(14,14,14,0.8)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8, padding: 16, marginBottom: 24,
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12,
      }}>
        <input
          className="pm-input"
          placeholder="🔍 Buscar por título..."
          value={filters.q}
          onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
        />
        <select className="pm-select" value={filters.operacion} onChange={e => setFilters(f => ({ ...f, operacion: e.target.value }))}>
          {OPERACIONES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select className="pm-select" value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}>
          {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select className="pm-select" value={filters.dorm} onChange={e => setFilters(f => ({ ...f, dorm: e.target.value }))}>
          {DORM_OPTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        <input
          className="pm-input"
          placeholder="Precio mín (USD)"
          type="number"
          value={filters.min}
          onChange={e => setFilters(f => ({ ...f, min: e.target.value }))}
        />
        <input
          className="pm-input"
          placeholder="Precio máx (USD)"
          type="number"
          value={filters.max}
          onChange={e => setFilters(f => ({ ...f, max: e.target.value }))}
        />
        {(filters.operacion || filters.tipo || filters.dorm || filters.min || filters.max || filters.q || filters.portalesActivos.length > 0) && (
          <button
            onClick={() => setFilters(defaultFilters)}
            style={{
              background: "rgba(200,0,0,0.1)", border: "1px solid rgba(200,0,0,0.3)",
              borderRadius: 5, color: "#cc0000", cursor: "pointer",
              fontSize: 11, fontFamily: "'Inter',sans-serif", padding: "8px 12px",
            }}
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Panel admin: sincronización */}
      {esAdmin && (
        <div style={{
          background: "rgba(200,0,0,0.05)",
          border: "1px solid rgba(200,0,0,0.2)",
          borderRadius: 8, padding: "14px 18px",
          marginBottom: 24, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Inter',sans-serif" }}>
            ⚙️ Sincronizar portales:
          </span>
          <select
            className="pm-select"
            value={syncPortal}
            onChange={e => setSyncPortal(e.target.value)}
            style={{ width: "auto", minWidth: 160 }}
          >
            <option value="all">Todos los portales</option>
            {PORTALES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button
            onClick={() => handleSync(syncPortal)}
            disabled={syncing}
            style={{
              padding: "8px 18px", borderRadius: 5,
              background: syncing ? "rgba(255,255,255,0.05)" : "rgba(200,0,0,0.15)",
              border: "1px solid rgba(200,0,0,0.3)",
              color: syncing ? "rgba(255,255,255,0.35)" : "#cc0000",
              cursor: syncing ? "not-allowed" : "pointer",
              fontSize: 12, fontFamily: "'Montserrat',sans-serif",
              fontWeight: 700, letterSpacing: "0.05em",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {syncing && <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(200,0,0,0.4)", borderTopColor: "#cc0000", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
            {syncing ? "Sincronizando..." : "⟳ Sincronizar"}
          </button>
          {syncResultado && (
            <span style={{ fontSize: 11, color: syncResultado.startsWith("✓") ? "#22c55e" : "#ef4444", fontFamily: "'Inter',sans-serif" }}>
              {syncResultado}
            </span>
          )}
        </div>
      )}

      {/* Resultados */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter',sans-serif", margin: 0 }}>
          {loading ? "Cargando..." : `${total.toLocaleString("es-AR")} propiedad${total !== 1 ? "es" : ""} encontrada${total !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Grid */}
      {!loading && props.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          {totalGeneral === 0 ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏙️</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "'Inter',sans-serif", marginBottom: 8 }}>
                Todavía no hay propiedades sincronizadas.
              </p>
              {esAdmin && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "'Inter',sans-serif" }}>
                  Usá el panel de sincronización de arriba para importar propiedades de los portales.
                </p>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "'Inter',sans-serif" }}>
                Sin resultados para los filtros aplicados.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="pm-grid" style={{ opacity: loading ? 0.4 : 1, transition: "opacity 0.2s" }}>
          {props.map(p => <PropCard key={`${p.portal}-${p.portal_id}`} p={p} />)}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 32 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: "8px 16px", borderRadius: 5, cursor: page === 1 ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: page === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
              fontSize: 12, fontFamily: "'Inter',sans-serif",
            }}
          >
            ← Anterior
          </button>
          <span style={{ padding: "8px 14px", fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'Inter',sans-serif" }}>
            Pág. {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: "8px 16px", borderRadius: 5, cursor: page === totalPages ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: page === totalPages ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
              fontSize: 12, fontFamily: "'Inter',sans-serif",
            }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
