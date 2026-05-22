"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Propiedad {
  id: string;
  direccion: string;
  zona: string | null;
  ciudad: string | null;
  tipo: string | null;
  operacion: string | null;
  precio: number | null;
  moneda: string | null;
  superficie_total: number | null;
  superficie_cubierta: number | null;
  ambientes: number | null;
  dormitorios: number | null;
  banos: number | null;
  cochera: boolean | null;
  pileta: boolean | null;
  amenities: boolean | null;
  estado: string | null;
  antiguedad: number | null;
  expensas: number | null;
  descripcion: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function precioM2(p: Propiedad): number | null {
  if (!p.precio || !p.superficie_cubierta) return null;
  return p.precio / p.superficie_cubierta;
}

function badge(val: string | number | null | boolean, good?: boolean): React.CSSProperties {
  if (val === null || val === undefined || val === "") return { color: "#555" };
  if (typeof good === "boolean") return { color: good ? "#22c55e" : "#ef4444" };
  return { color: "#fff" };
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function ComparadorPropiedades() {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("cartera_propiedades")
      .select("id,direccion,zona,ciudad,tipo,operacion,precio,moneda,superficie_total,superficie_cubierta,ambientes,dormitorios,banos,cochera,pileta,amenities,estado,antiguedad,expensas,descripcion")
      .eq("estado", "activa")
      .order("precio", { ascending: false })
      .then(({ data }) => {
        setPropiedades((data ?? []) as Propiedad[]);
        setLoading(false);
      });
  }, []);

  const filtradas = useMemo(() =>
    propiedades.filter(p =>
      busqueda === "" ||
      p.direccion?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.zona?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.tipo?.toLowerCase().includes(busqueda.toLowerCase())
    ), [propiedades, busqueda]);

  const comparadas = useMemo(() =>
    seleccionadas.map(id => propiedades.find(p => p.id === id)).filter(Boolean) as Propiedad[],
    [seleccionadas, propiedades]);

  function toggleSeleccion(id: string) {
    setSeleccionadas(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= 4 ? prev : [...prev, id]
    );
  }

  function findBest(key: keyof Propiedad, direction: "max" | "min" = "max"): string | null {
    const vals = comparadas.map(p => ({ id: p.id, val: p[key] as number | null })).filter(x => x.val !== null);
    if (vals.length < 2) return null;
    const sorted = [...vals].sort((a, b) => direction === "max" ? (b.val! - a.val!) : (a.val! - b.val!));
    return sorted[0].id;
  }

  const bestPrecioM2 = findBest("id" as keyof Propiedad); // placeholder, computed per column

  const fmt = (n: number | null, prefix = "") => n !== null ? `${prefix}${n.toLocaleString("es-AR")}` : "—";
  const fmtMoneda = (p: Propiedad) => {
    if (!p.precio) return "—";
    const sym = p.moneda === "ARS" ? "$" : "USD";
    return `${sym} ${p.precio.toLocaleString("es-AR")}`;
  };

  const FILAS: { label: string; key: keyof Propiedad | "precio_m2"; format: (p: Propiedad) => string; mejor?: "max" | "min" }[] = [
    { label: "Tipo", key: "tipo", format: p => p.tipo ?? "—" },
    { label: "Operación", key: "operacion", format: p => p.operacion ?? "—" },
    { label: "Zona / Ciudad", key: "zona", format: p => [p.zona, p.ciudad].filter(Boolean).join(", ") || "—" },
    { label: "Precio", key: "precio", format: fmtMoneda, mejor: "min" },
    { label: "Precio/m²", key: "precio_m2", format: p => { const v = precioM2(p); return v !== null ? `USD ${v.toFixed(0)}/m²` : "—"; }, mejor: "min" },
    { label: "Sup. total", key: "superficie_total", format: p => fmt(p.superficie_total, "") + (p.superficie_total ? " m²" : ""), mejor: "max" },
    { label: "Sup. cubierta", key: "superficie_cubierta", format: p => fmt(p.superficie_cubierta, "") + (p.superficie_cubierta ? " m²" : ""), mejor: "max" },
    { label: "Ambientes", key: "ambientes", format: p => fmt(p.ambientes), mejor: "max" },
    { label: "Dormitorios", key: "dormitorios", format: p => fmt(p.dormitorios), mejor: "max" },
    { label: "Baños", key: "banos", format: p => fmt(p.banos), mejor: "max" },
    { label: "Cochera", key: "cochera", format: p => p.cochera === null ? "—" : p.cochera ? "✓ Sí" : "✗ No" },
    { label: "Pileta", key: "pileta", format: p => p.pileta === null ? "—" : p.pileta ? "✓ Sí" : "✗ No" },
    { label: "Amenities", key: "amenities", format: p => p.amenities === null ? "—" : p.amenities ? "✓ Sí" : "✗ No" },
    { label: "Antigüedad", key: "antiguedad", format: p => p.antiguedad !== null ? `${p.antiguedad} años` : "—", mejor: "min" },
    { label: "Expensas", key: "expensas", format: p => p.expensas !== null ? `$ ${p.expensas.toLocaleString("es-AR")}` : "—", mejor: "min" },
    { label: "Estado", key: "estado", format: p => p.estado ?? "—" },
  ];

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 6,
    color: "#fff", padding: "8px 12px", fontSize: 13, fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "#888", textDecoration: "none", fontSize: 13 }}>← CRM</Link>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: "Montserrat, sans-serif", fontWeight: 800 }}>
            🔍 Comparador de Propiedades
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>Seleccioná hasta 4 propiedades de la cartera activa para comparar</p>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#888" }}>
          {seleccionadas.length > 0 && `${seleccionadas.length} seleccionada${seleccionadas.length > 1 ? "s" : ""}`}
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>
        {/* Sidebar selector */}
        <div style={{ width: 300, borderRight: "1px solid #222", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a" }}>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por dirección, barrio..."
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, color: "#666", textAlign: "center" }}>Cargando...</div>
            ) : filtradas.length === 0 ? (
              <div style={{ padding: 24, color: "#666", textAlign: "center" }}>Sin resultados</div>
            ) : filtradas.map(p => {
              const sel = seleccionadas.includes(p.id);
              const lleno = seleccionadas.length >= 4 && !sel;
              return (
                <div
                  key={p.id}
                  onClick={() => !lleno && toggleSeleccion(p.id)}
                  style={{
                    padding: "12px 16px", borderBottom: "1px solid #1a1a1a",
                    cursor: lleno ? "not-allowed" : "pointer",
                    background: sel ? "#cc000015" : "transparent",
                    borderLeft: sel ? "3px solid #cc0000" : "3px solid transparent",
                    opacity: lleno ? 0.4 : 1,
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: sel ? "#fff" : "#ccc" }}>{p.direccion}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                    {[p.tipo, p.zona, fmtMoneda(p)].filter(Boolean).join(" · ")}
                  </div>
                  {precioM2(p) !== null && (
                    <div style={{ fontSize: 11, color: "#666" }}>USD {precioM2(p)!.toFixed(0)}/m²</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabla comparativa */}
        <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
          {comparadas.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12, color: "#666" }}>
              <span style={{ fontSize: 48 }}>🔍</span>
              <p style={{ margin: 0 }}>Seleccioná propiedades del panel izquierdo para comparar</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
              <thead>
                <tr style={{ background: "#111", borderBottom: "2px solid #222" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#666", fontFamily: "Montserrat, sans-serif", fontWeight: 700, width: 160, position: "sticky", left: 0, background: "#111" }}>
                    ATRIBUTO
                  </th>
                  {comparadas.map(p => (
                    <th key={p.id} style={{ padding: "12px 16px", textAlign: "center", minWidth: 200 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{p.direccion}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2, fontWeight: 400 }}>{[p.tipo, p.zona].filter(Boolean).join(" · ")}</div>
                      <button
                        onClick={() => toggleSeleccion(p.id)}
                        style={{ marginTop: 6, background: "none", border: "1px solid #333", borderRadius: 4, color: "#888", fontSize: 11, padding: "2px 8px", cursor: "pointer" }}
                      >
                        Quitar
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FILAS.map((fila, fi) => {
                  // Encontrar mejor valor para esta fila
                  let mejorId: string | null = null;
                  if (fila.mejor && fila.key !== "precio_m2") {
                    const vals = comparadas.map(p => {
                      const v = p[fila.key as keyof Propiedad];
                      return { id: p.id, val: typeof v === "number" ? v : null };
                    }).filter(x => x.val !== null);
                    if (vals.length >= 2) {
                      const sorted = [...vals].sort((a, b) => fila.mejor === "max" ? b.val! - a.val! : a.val! - b.val!);
                      mejorId = sorted[0].id;
                    }
                  }
                  if (fila.key === "precio_m2" && fila.mejor) {
                    const vals = comparadas.map(p => ({ id: p.id, val: precioM2(p) })).filter(x => x.val !== null);
                    if (vals.length >= 2) {
                      const sorted = [...vals].sort((a, b) => fila.mejor === "min" ? a.val! - b.val! : b.val! - a.val!);
                      mejorId = sorted[0].id;
                    }
                  }

                  return (
                    <tr key={fi} style={{ background: fi % 2 === 0 ? "#0d0d0d" : "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
                      <td style={{
                        padding: "10px 16px", fontSize: 12, color: "#888", fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                        position: "sticky", left: 0, background: fi % 2 === 0 ? "#0d0d0d" : "#0a0a0a",
                      }}>
                        {fila.label}
                      </td>
                      {comparadas.map(p => {
                        const isBest = mejorId === p.id;
                        return (
                          <td key={p.id} style={{
                            padding: "10px 16px", textAlign: "center", fontSize: 13,
                            color: isBest ? "#22c55e" : "#ccc",
                            fontWeight: isBest ? 700 : 400,
                            background: isBest ? "#22c55e08" : "transparent",
                          }}>
                            {fila.format(p)}
                            {isBest && <span style={{ marginLeft: 4, fontSize: 10 }}>★</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* PDF export */}
      {comparadas.length >= 2 && (
        <div style={{ position: "fixed", bottom: 24, right: 24 }}>
          <button
            onClick={() => {
              const win = window.open("", "_blank");
              if (!win) return;
              win.document.write(`
                <html><head><title>Comparativa</title>
                <style>body{font-family:Arial,sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}tr:nth-child(even){background:#fafafa}.mejor{color:#16a34a;font-weight:bold}</style>
                </head><body>
                <h2>Comparativa de Propiedades</h2>
                <p>Generado: ${new Date().toLocaleDateString("es-AR")}</p>
                <table>
                <tr><th>Atributo</th>${comparadas.map(p => `<th>${p.direccion}</th>`).join("")}</tr>
                ${FILAS.map(f => `<tr><td><b>${f.label}</b></td>${comparadas.map(p => `<td>${f.format(p)}</td>`).join("")}</tr>`).join("")}
                </table>
                </body></html>
              `);
              setTimeout(() => win.print(), 400);
            }}
            style={{
              background: "#cc0000", color: "#fff", border: "none", borderRadius: 8,
              padding: "12px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "Montserrat, sans-serif", boxShadow: "0 4px 16px #cc000040",
            }}
          >
            📄 Exportar PDF
          </button>
        </div>
      )}
    </div>
  );
}
