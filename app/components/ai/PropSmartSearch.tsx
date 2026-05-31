"use client";
/**
 * PropSmartSearch — Búsqueda inteligente de propiedades usando json-render + Claude.
 * Permite hacer búsquedas en lenguaje natural como:
 *   "departamento 3 dormitorios venta bajo USD 150000"
 * y obtener una UI generada con los resultados.
 *
 * Requiere ruta API: /api/web/[slug]/ai-search
 */
import { Renderer, createSpecStreamCompiler } from "@json-render/react";
import { useCallback, useState } from "react";
import type { PropCardProps, PropGridProps, PropResumenProps } from "@/app/lib/json-render/catalog";

// ── Implementaciones de componentes (renderizado real) ───────────────────────

function PropCard({ id, titulo, precio, moneda, operacion, tipo, zona, ciudad, dormitorios, banos, superficie_cubierta, foto, destacada, slug }: PropCardProps) {
  const precioStr = precio
    ? (moneda === "USD" ? `USD ${precio.toLocaleString("es-AR")}` : `$ ${precio.toLocaleString("es-AR")}`)
    : null;
  return (
    <a
      href={`/web/${slug}/propiedad/${id}`}
      style={{
        display: "block",
        background: "#fff",
        border: `1px solid ${destacada ? "#c9a84c60" : "#e5e7eb"}`,
        borderRadius: 10,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
    >
      <div style={{ height: 180, background: "#f3f4f6", position: "relative", overflow: "hidden" }}>
        {foto
          ? <img src={foto} alt={titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 32, color: "#9ca3af" }}>🏠</div>
        }
        <span style={{ position: "absolute", top: 8, left: 8, background: "#111827", color: "#fff", padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
          {operacion.toUpperCase()}
        </span>
        {destacada && (
          <span style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", color: "#eab308", padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
            ⭐ DESTACADA
          </span>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, lineClamp: 2, overflow: "hidden" }}>{titulo}</div>
        {(zona || ciudad) && (
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>📍 {[zona, ciudad].filter(Boolean).join(", ")}</div>
        )}
        {precioStr && <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 8 }}>{precioStr}</div>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {dormitorios && <span style={{ fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "2px 7px", borderRadius: 4 }}>🛏 {dormitorios}</span>}
          {banos && <span style={{ fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "2px 7px", borderRadius: 4 }}>🚿 {banos}</span>}
          {superficie_cubierta && <span style={{ fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "2px 7px", borderRadius: 4 }}>📐 {superficie_cubierta}m²</span>}
          <span style={{ fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "2px 7px", borderRadius: 4 }}>{tipo}</span>
        </div>
      </div>
    </a>
  );
}

function PropGrid({ titulo, columnas, children }: PropGridProps & { children: React.ReactNode }) {
  return (
    <div>
      {titulo && <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#111827" }}>{titulo}</h2>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columnas}, 1fr)`, gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function PropResumen({ total, ventas, alquileres, precio_promedio, moneda_promedio }: PropResumenProps) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#374151", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
      <span><strong>{total}</strong> resultados</span>
      {ventas > 0 && <span>{ventas} en venta</span>}
      {alquileres > 0 && <span>{alquileres} en alquiler</span>}
      {precio_promedio && <span>Precio promedio: <strong>{moneda_promedio === "USD" ? "USD" : "$"} {precio_promedio.toLocaleString("es-AR")}</strong></span>}
    </div>
  );
}

function MensajeVacio({ texto, sugerencia }: { texto: string; sugerencia?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 6 }}>{texto}</div>
      {sugerencia && <p style={{ fontSize: 13 }}>{sugerencia}</p>}
    </div>
  );
}

const components = { PropCard, PropGrid, PropResumen, MensajeVacio };

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  slug: string;
  placeholder?: string;
}

export default function PropSmartSearch({ slug, placeholder = "Ej: 3 dormitorios venta menos de USD 120.000" }: Props) {
  const [query, setQuery] = useState("");
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSpec(null);

    try {
      const res = await fetch(`/api/web/${slug}/ai-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setSpec(data.spec);
    } catch (e: any) {
      setError(e.message || "Error en búsqueda");
    } finally {
      setLoading(false);
    }
  }, [query, slug]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder={placeholder}
          style={{
            flex: 1, padding: "10px 14px", border: "1px solid #d1d5db",
            borderRadius: 8, fontSize: 14, outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{
            padding: "10px 20px", background: "#111827", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Buscando…" : "✨ Buscar"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {spec && <Renderer spec={spec} components={components} />}
    </div>
  );
}
