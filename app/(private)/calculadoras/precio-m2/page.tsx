"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface Propiedad {
  id: string;
  nombre: string;
  precio: number;
  moneda: "USD" | "ARS";
  m2totales: number;
  m2cubiertos: number;
  antiguedad: number; // años
  piso: number; // 0 = PB
  ambientes: number;
  estado: "excelente" | "muy_bueno" | "bueno" | "regular" | "a_refaccionar";
  zona: "premium" | "media_alta" | "media" | "media_baja";
  amenities: string[]; // pool, gym, sum, cochera, vigilancia, terraza, quincho
}

const AMENITIES_LIST = ["Cochera", "Pileta", "Gimnasio", "SUM", "Vigilancia", "Terraza", "Quincho", "Lavadero"];

const ESTADO_FACTOR: Record<string, number> = {
  excelente: 1.15,
  muy_bueno: 1.07,
  bueno: 1.00,
  regular: 0.90,
  a_refaccionar: 0.75,
};

const ESTADO_LABELS: Record<string, string> = {
  excelente: "Excelente",
  muy_bueno: "Muy bueno",
  bueno: "Bueno",
  regular: "Regular",
  a_refaccionar: "A refaccionar",
};

const ZONA_FACTOR: Record<string, number> = {
  premium: 1.30,
  media_alta: 1.12,
  media: 1.00,
  media_baja: 0.82,
};

const ZONA_LABELS: Record<string, string> = {
  premium: "Premium",
  media_alta: "Media Alta",
  media: "Media",
  media_baja: "Media Baja",
};

const AMENITY_FACTOR: Record<string, number> = {
  Cochera: 0.05,
  Pileta: 0.04,
  Gimnasio: 0.02,
  SUM: 0.015,
  Vigilancia: 0.025,
  Terraza: 0.03,
  Quincho: 0.02,
  Lavadero: 0.01,
};

// Depreciación por antigüedad: -0.5% por año, tope 30%
function factorAntiguedad(anos: number): number {
  return Math.max(1 - Math.min(anos, 60) * 0.005, 0.70);
}

// Factor piso: +0.5% por piso hasta piso 10
function factorPiso(piso: number): number {
  return 1 + Math.min(piso, 10) * 0.005;
}

const PROP_DEFAULT: Omit<Propiedad, "id"> = {
  nombre: "",
  precio: 120000,
  moneda: "USD",
  m2totales: 80,
  m2cubiertos: 70,
  antiguedad: 10,
  piso: 3,
  ambientes: 3,
  estado: "bueno",
  zona: "media",
  amenities: [],
};

function nuevaProp(n: number): Propiedad {
  return { ...PROP_DEFAULT, id: `p${Date.now()}_${n}`, nombre: `Propiedad ${n}` };
}

interface PrecioAnalizado {
  prop: Propiedad;
  precioUSD: number;
  precioPorM2: number;
  precioPorM2Cubierto: number;
  scoreCalidad: number;
  precioAjustado: number; // normalizado a zona media, bueno, sin amenities
  indiceValor: number; // <1 barato, >1 caro vs promedio
}

export default function PrecioM2Page() {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([nuevaProp(1), nuevaProp(2), nuevaProp(3)]);
  const [tc, setTc] = useState(1300);
  const [editando, setEditando] = useState<string | null>(propiedades[0].id);

  const updProp = (id: string, cambios: Partial<Propiedad>) => {
    setPropiedades(prev => prev.map(p => p.id === id ? { ...p, ...cambios } : p));
  };

  const toggleAmenity = (id: string, amenity: string) => {
    setPropiedades(prev => prev.map(p => {
      if (p.id !== id) return p;
      const tiene = p.amenities.includes(amenity);
      return { ...p, amenities: tiene ? p.amenities.filter(a => a !== amenity) : [...p.amenities, amenity] };
    }));
  };

  const agregarProp = () => {
    const nueva = nuevaProp(propiedades.length + 1);
    setPropiedades(prev => [...prev, nueva]);
    setEditando(nueva.id);
  };

  const eliminarProp = (id: string) => {
    setPropiedades(prev => prev.filter(p => p.id !== id));
    if (editando === id) setEditando(null);
  };

  const analisis = useMemo<PrecioAnalizado[]>(() => {
    return propiedades.map(p => {
      const precioUSD = p.moneda === "USD" ? p.precio : p.precio / tc;
      const precioPorM2 = p.m2totales > 0 ? precioUSD / p.m2totales : 0;
      const precioPorM2Cubierto = p.m2cubiertos > 0 ? precioUSD / p.m2cubiertos : 0;

      const fEstado = ESTADO_FACTOR[p.estado];
      const fZona = ZONA_FACTOR[p.zona];
      const fAmenities = p.amenities.reduce((s, a) => s + (AMENITY_FACTOR[a] ?? 0), 1);
      const fAntig = factorAntiguedad(p.antiguedad);
      const fPiso = factorPiso(p.piso);

      // Score calidad 0-100
      const scoreCalidad = Math.min(
        Math.round(
          (fEstado / 1.15) * 35 +
          (fZona / 1.30) * 30 +
          (Math.min(p.amenities.length, 5) / 5) * 15 +
          (fAntig / 1) * 10 +
          (fPiso / 1.05) * 10
        ), 100
      );

      // Precio ajustado: normaliza a "zona media, bueno, sin amenities, PB, 0 años"
      const factorTotal = fEstado * fZona * fAmenities * fAntig * fPiso;
      const precioAjustado = factorTotal > 0 ? precioPorM2 / factorTotal : precioPorM2;

      return { prop: p, precioUSD, precioPorM2, precioPorM2Cubierto, scoreCalidad, precioAjustado, indiceValor: 0 };
    });
  }, [propiedades, tc]);

  // Calcular índice de valor relativo al promedio
  const analisisConIndice = useMemo<PrecioAnalizado[]>(() => {
    const avgAjustado = analisis.length > 0
      ? analisis.reduce((s, a) => s + a.precioAjustado, 0) / analisis.length
      : 1;
    return analisis.map(a => ({
      ...a,
      indiceValor: avgAjustado > 0 ? a.precioAjustado / avgAjustado : 1,
    }));
  }, [analisis]);

  const avgPorM2 = analisisConIndice.length > 0
    ? analisisConIndice.reduce((s, a) => s + a.precioPorM2, 0) / analisisConIndice.length
    : 0;

  const maxPorM2 = Math.max(...analisisConIndice.map(a => a.precioPorM2), 1);

  const propEditando = propiedades.find(p => p.id === editando);

  const indiceColor = (idx: number) =>
    idx < 0.9 ? "#22c55e" : idx > 1.15 ? "#cc0000" : idx > 1.05 ? "#f97316" : "#9ca3af";
  const indiceLabel = (idx: number) =>
    idx < 0.9 ? "Barato" : idx > 1.15 ? "Caro" : idx > 1.05 ? "Levemente caro" : "Precio justo";

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", padding: "24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", margin: 0 }}>📐 Comparador de Precio por m²</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>Comparación ajustada por zona, estado, antigüedad, piso y amenities</p>
          </div>
          <Link href="/calculadoras" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Calculadoras</Link>
        </div>

        {/* TC */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>TC ARS/USD:</label>
          <input type="number" value={tc} step={50} onChange={e => setTc(parseFloat(e.target.value) || 1)}
            style={{ background: "#111", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 10px", fontSize: 13, width: 100 }} />
          <span style={{ fontSize: 11, color: "#4b5563" }}>Para convertir propiedades en ARS</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
          {/* Panel izquierdo: lista + comparación */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Ranking */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Comparación — USD/m² total
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Promedio: USD {fmt(Math.round(avgPorM2))}/m²</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...analisisConIndice].sort((a, b) => a.indiceValor - b.indiceValor).map((a, rank) => (
                  <div key={a.prop.id}
                    onClick={() => setEditando(a.prop.id)}
                    style={{ background: editando === a.prop.id ? "#161616" : "#0d0d0d", border: `1px solid ${editando === a.prop.id ? "#374151" : "#1a1a1a"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 13, color: rank === 0 ? "#22c55e" : "#6b7280" }}>#{rank + 1}</span>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#e5e5e5" }}>{a.prop.nombre}</span>
                        <span style={{ fontSize: 10, color: "#4b5563" }}>· {a.prop.m2totales}m² · {ZONA_LABELS[a.prop.zona]} · {ESTADO_LABELS[a.prop.estado]}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: "#e5e5e5" }}>
                          USD {fmt(Math.round(a.precioPorM2))}/m²
                        </span>
                        <span style={{ background: `${indiceColor(a.indiceValor)}22`, color: indiceColor(a.indiceValor), padding: "3px 8px", borderRadius: 4, fontSize: 10, fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          {indiceLabel(a.indiceValor)}
                        </span>
                      </div>
                    </div>
                    <div style={{ background: "#0a0a0a", borderRadius: 3, height: 5, overflow: "hidden" }}>
                      <div style={{ width: `${maxPorM2 > 0 ? (a.precioPorM2 / maxPorM2) * 100 : 0}%`, height: "100%", background: indiceColor(a.indiceValor), transition: "width 0.3s" }} />
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "#4b5563" }}>
                      <span>Cubierto: USD {fmt(Math.round(a.precioPorM2Cubierto))}/m²</span>
                      <span>Score calidad: {a.scoreCalidad}/100</span>
                      <span>Precio ajustado: USD {fmt(Math.round(a.precioAjustado))}/m²</span>
                      {a.prop.amenities.length > 0 && <span>{a.prop.amenities.join(" · ")}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={agregarProp}
                style={{ marginTop: 14, width: "100%", background: "transparent", border: "1px dashed #374151", borderRadius: 8, color: "#6b7280", padding: "10px", fontSize: 12, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                + Agregar propiedad
              </button>
            </div>

            {/* Tabla comparativa */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16, overflowX: "auto" }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Tabla Comparativa</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Propiedad", "Precio", "m² total", "m² cub.", "USD/m²", "USD/m² cub.", "Score", "Índice"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontFamily: "Montserrat, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#6b7280", borderBottom: "1px solid #1f2937", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analisisConIndice.map(a => (
                    <tr key={a.prop.id} style={{ background: editando === a.prop.id ? "rgba(255,255,255,0.02)" : "transparent" }}>
                      <td style={{ padding: "7px 10px", color: "#e5e5e5", fontWeight: 500 }}>{a.prop.nombre}</td>
                      <td style={{ padding: "7px 10px", color: "#9ca3af" }}>{a.prop.moneda} {fmt(a.prop.precio)}</td>
                      <td style={{ padding: "7px 10px", color: "#9ca3af" }}>{a.prop.m2totales}</td>
                      <td style={{ padding: "7px 10px", color: "#9ca3af" }}>{a.prop.m2cubiertos}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#e5e5e5" }}>USD {fmt(Math.round(a.precioPorM2))}</td>
                      <td style={{ padding: "7px 10px", color: "#6b7280" }}>USD {fmt(Math.round(a.precioPorM2Cubierto))}</td>
                      <td style={{ padding: "7px 10px" }}>
                        <span style={{ color: a.scoreCalidad >= 70 ? "#22c55e" : a.scoreCalidad >= 50 ? "#f97316" : "#cc0000", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          {a.scoreCalidad}
                        </span>
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                        <span style={{ color: indiceColor(a.indiceValor), fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          {a.indiceValor.toFixed(2)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Metodología */}
            <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 14px", fontSize: 11, color: "#4b5563" }}>
              <strong style={{ color: "#6b7280" }}>Metodología:</strong> El precio ajustado normaliza cada propiedad a condiciones base (zona media, estado bueno, sin amenities, PB, nueva). El índice de valor compara cada ajustado vs el promedio del grupo. &lt;0.90 = oportunidad · 0.90–1.05 = precio justo · &gt;1.05 = caro relativo.
            </div>
          </div>

          {/* Panel derecho: editor */}
          <div>
            {propEditando ? (
              <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 16, position: "sticky", top: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase" }}>Editar propiedad</div>
                  {propiedades.length > 1 && (
                    <button onClick={() => eliminarProp(propEditando.id)}
                      style={{ background: "transparent", border: "1px solid #cc000044", borderRadius: 4, color: "#cc0000", padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>
                      Eliminar
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Nombre */}
                  <div>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Nombre / referencia</label>
                    <input value={propEditando.nombre} onChange={e => updProp(propEditando.id, { nombre: e.target.value })}
                      style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  {/* Precio + moneda */}
                  <div>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 3 }}>Precio</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="number" value={propEditando.precio} step={5000} onChange={e => updProp(propEditando.id, { precio: parseFloat(e.target.value) || 0 })}
                        style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 10px", fontSize: 13, flex: 1, boxSizing: "border-box" }} />
                      <select value={propEditando.moneda} onChange={e => updProp(propEditando.id, { moneda: e.target.value as "USD" | "ARS" })}
                        style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "6px 8px", fontSize: 12 }}>
                        <option>USD</option><option>ARS</option>
                      </select>
                    </div>
                  </div>
                  {/* m² */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "m² totales", key: "m2totales" as const },
                      { label: "m² cubiertos", key: "m2cubiertos" as const },
                      { label: "Antigüedad (años)", key: "antiguedad" as const },
                      { label: "Piso", key: "piso" as const },
                      { label: "Ambientes", key: "ambientes" as const },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 10, color: "#6b7280", display: "block", marginBottom: 2 }}>{f.label}</label>
                        <input type="number" value={propEditando[f.key] as number} step={1}
                          onChange={e => updProp(propEditando.id, { [f.key]: parseFloat(e.target.value) || 0 })}
                          style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, color: "#e5e5e5", padding: "5px 8px", fontSize: 12, width: "100%", boxSizing: "border-box" }} />
                      </div>
                    ))}
                  </div>
                  {/* Estado */}
                  <div>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Estado</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(["excelente", "muy_bueno", "bueno", "regular", "a_refaccionar"] as const).map(e => (
                        <button key={e} onClick={() => updProp(propEditando.id, { estado: e })}
                          style={{ background: propEditando.estado === e ? "#1f2937" : "transparent", border: `1px solid ${propEditando.estado === e ? "#374151" : "#222"}`, borderRadius: 5, color: propEditando.estado === e ? "#e5e5e5" : "#6b7280", padding: "4px 8px", fontSize: 10, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          {ESTADO_LABELS[e]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Zona */}
                  <div>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Zona</label>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(["premium", "media_alta", "media", "media_baja"] as const).map(z => (
                        <button key={z} onClick={() => updProp(propEditando.id, { zona: z })}
                          style={{ background: propEditando.zona === z ? "#cc000022" : "transparent", border: `1px solid ${propEditando.zona === z ? "#cc000066" : "#222"}`, borderRadius: 5, color: propEditando.zona === z ? "#cc0000" : "#6b7280", padding: "4px 8px", fontSize: 10, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                          {ZONA_LABELS[z]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Amenities */}
                  <div>
                    <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Amenities</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {AMENITIES_LIST.map(a => {
                        const tiene = propEditando.amenities.includes(a);
                        return (
                          <button key={a} onClick={() => toggleAmenity(propEditando.id, a)}
                            style={{ background: tiene ? "rgba(59,130,246,0.15)" : "transparent", border: `1px solid ${tiene ? "rgba(59,130,246,0.4)" : "#222"}`, borderRadius: 5, color: tiene ? "#3b82f6" : "#6b7280", padding: "4px 8px", fontSize: 10, cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700 }}>
                            {a}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Resumen ajustes */}
                {(() => {
                  const a = analisisConIndice.find(x => x.prop.id === propEditando.id);
                  if (!a) return null;
                  return (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1f2937" }}>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Análisis</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { label: "USD/m² total", value: `USD ${fmt(Math.round(a.precioPorM2))}`, color: "#e5e5e5" },
                          { label: "USD/m² cubierto", value: `USD ${fmt(Math.round(a.precioPorM2Cubierto))}`, color: "#9ca3af" },
                          { label: "Score calidad", value: `${a.scoreCalidad}/100`, color: a.scoreCalidad >= 70 ? "#22c55e" : "#f97316" },
                          { label: "Índice de valor", value: `${a.indiceValor.toFixed(2)}x`, color: indiceColor(a.indiceValor) },
                        ].map(k => (
                          <div key={k.label} style={{ background: "#0a0a0a", borderRadius: 6, padding: "8px 10px" }}>
                            <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 3 }}>{k.label}</div>
                            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 15, color: k.color }}>{k.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, padding: "8px 10px", background: `${indiceColor(a.indiceValor)}11`, border: `1px solid ${indiceColor(a.indiceValor)}33`, borderRadius: 6, fontSize: 11, color: indiceColor(a.indiceValor), fontFamily: "Montserrat, sans-serif", fontWeight: 700, textAlign: "center" }}>
                        {indiceLabel(a.indiceValor)} vs. promedio del grupo
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 10, padding: 40, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                Hacé click en una propiedad para editarla
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
