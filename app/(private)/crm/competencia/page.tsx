"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PropiedadCompetencia {
  id: string;
  portal: string;
  titulo: string;
  zona: string;
  tipo: string;
  operacion: "venta" | "alquiler";
  precio: number;
  moneda: string;
  superficieTotal: number;
  superficieCubierta: number;
  ambientes: number;
  antiguedad: number;
  estado: "activa" | "bajada" | "vendida";
  diasPublicada: number;
  preciom2: number;
  link: string;
  notas: string;
  fechaCarga: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function estadoColor(e: PropiedadCompetencia["estado"]) {
  return e === "activa" ? "#22c55e" : e === "bajada" ? "#f97316" : "#cc0000";
}

// ── Componente ────────────────────────────────────────────────────────────────

const PORTALES = ["ZonaProp","Argenprop","MercadoLibre","Remax","Inmuebles24","Otro"];
const TIPOS = ["Departamento","Casa","PH","Local","Oficina","Terreno","Cochera"];

export default function Competencia() {
  const [propiedades, setPropiedades] = useState<PropiedadCompetencia[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtroZona, setFiltroZona] = useState("");
  const [filtroOp, setFiltroOp] = useState<"todos"|"venta"|"alquiler">("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos"|"activa"|"bajada"|"vendida">("activa");
  const [ordenar, setOrdenar] = useState<"precio"|"preciom2"|"dias">("preciom2");

  // Form
  const [form, setForm] = useState<Omit<PropiedadCompetencia, "id" | "preciom2" | "fechaCarga">>({
    portal: "ZonaProp",
    titulo: "",
    zona: "",
    tipo: "Departamento",
    operacion: "venta",
    precio: 0,
    moneda: "USD",
    superficieTotal: 0,
    superficieCubierta: 0,
    ambientes: 2,
    antiguedad: 10,
    estado: "activa",
    diasPublicada: 0,
    link: "",
    notas: "",
  });

  function agregarPropiedad() {
    if (!form.titulo || form.precio <= 0) return;
    const preciom2 = form.superficieCubierta > 0 ? form.precio / form.superficieCubierta : 0;
    const nueva: PropiedadCompetencia = {
      ...form,
      id: Date.now().toString(),
      preciom2,
      fechaCarga: new Date().toLocaleDateString("es-AR"),
    };
    setPropiedades(prev => [...prev, nueva]);
    setMostrarForm(false);
    setForm(prev => ({ ...prev, titulo: "", precio: 0, link: "", notas: "" }));
  }

  function eliminarPropiedad(id: string) {
    setPropiedades(prev => prev.filter(p => p.id !== id));
  }

  function cambiarEstado(id: string, estado: PropiedadCompetencia["estado"]) {
    setPropiedades(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
  }

  const filtradas = useMemo(() => {
    let arr = propiedades;
    if (filtroZona) arr = arr.filter(p => p.zona.toLowerCase().includes(filtroZona.toLowerCase()));
    if (filtroOp !== "todos") arr = arr.filter(p => p.operacion === filtroOp);
    if (filtroEstado !== "todos") arr = arr.filter(p => p.estado === filtroEstado);
    arr = [...arr].sort((a, b) => {
      if (ordenar === "precio") return a.precio - b.precio;
      if (ordenar === "preciom2") return a.preciom2 - b.preciom2;
      return b.diasPublicada - a.diasPublicada;
    });
    return arr;
  }, [propiedades, filtroZona, filtroOp, filtroEstado, ordenar]);

  const stats = useMemo(() => {
    const activas = propiedades.filter(p => p.estado === "activa");
    if (activas.length === 0) return null;
    const precios = activas.map(p => p.precio);
    const preciosm2 = activas.filter(p => p.preciom2 > 0).map(p => p.preciom2);
    const sorted = [...precios].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const avg = precios.reduce((a, b) => a + b, 0) / precios.length;
    const avgm2 = preciosm2.length > 0 ? preciosm2.reduce((a, b) => a + b, 0) / preciosm2.length : 0;
    const minm2 = Math.min(...preciosm2);
    const maxm2 = Math.max(...preciosm2);
    const diasPromedio = activas.reduce((a, p) => a + p.diasPublicada, 0) / activas.length;
    return { count: activas.length, median, avg, avgm2, minm2, maxm2, diasPromedio };
  }, [propiedades]);

  const zonas = useMemo(() => Array.from(new Set(propiedades.map(p => p.zona))), [propiedades]);

  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "6px 10px", fontFamily: "'Inter',sans-serif", fontSize: 12, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/crm" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12 }}>← CRM</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Análisis de Competencia
        </h1>
        <button onClick={() => setMostrarForm(!mostrarForm)} style={{ marginLeft: "auto", padding: "7px 16px", borderRadius: 8, background: "rgba(204,0,0,0.15)", border: "1px solid rgba(204,0,0,0.4)", color: "#cc0000", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
          + Agregar Propiedad
        </button>
      </div>

      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Form */}
        {mostrarForm && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(204,0,0,0.2)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <p style={{ margin: "0 0 16px 0", fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, color: "#cc0000", letterSpacing: "0.08em", textTransform: "uppercase" }}>Nueva Propiedad Competidora</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <div style={{ gridColumn: "1/3" }}>
                <label style={labelStyle}>Título / Descripción</label>
                <input type="text" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} style={inputStyle} placeholder="Ej: 3 amb con cochera, piso 8" />
              </div>
              <div>
                <label style={labelStyle}>Portal</label>
                <select value={form.portal} onChange={e => setForm(p => ({ ...p, portal: e.target.value }))} style={inputStyle}>
                  {PORTALES.map(por => <option key={por} value={por}>{por}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} style={inputStyle}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zona / Barrio</label>
                <input type="text" value={form.zona} onChange={e => setForm(p => ({ ...p, zona: e.target.value }))} style={inputStyle} placeholder="Ej: Palermo" />
              </div>
              <div>
                <label style={labelStyle}>Operación</label>
                <select value={form.operacion} onChange={e => setForm(p => ({ ...p, operacion: e.target.value as "venta"|"alquiler" }))} style={inputStyle}>
                  <option value="venta">Venta</option>
                  <option value="alquiler">Alquiler</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Precio</label>
                <input type="number" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: +e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Moneda</label>
                <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value }))} style={inputStyle}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Sup. cubierta (m²)</label>
                <input type="number" value={form.superficieCubierta} onChange={e => setForm(p => ({ ...p, superficieCubierta: +e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sup. total (m²)</label>
                <input type="number" value={form.superficieTotal} onChange={e => setForm(p => ({ ...p, superficieTotal: +e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ambientes</label>
                <input type="number" value={form.ambientes} onChange={e => setForm(p => ({ ...p, ambientes: +e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Antigüedad (años)</label>
                <input type="number" value={form.antiguedad} onChange={e => setForm(p => ({ ...p, antiguedad: +e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Días publicada</label>
                <input type="number" value={form.diasPublicada} onChange={e => setForm(p => ({ ...p, diasPublicada: +e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1/3" }}>
                <label style={labelStyle}>Link al portal</label>
                <input type="url" value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} style={inputStyle} placeholder="https://..." />
              </div>
              <div style={{ gridColumn: "3/5" }}>
                <label style={labelStyle}>Notas</label>
                <input type="text" value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} style={inputStyle} placeholder="Observaciones..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={agregarPropiedad} style={{ padding: "7px 20px", borderRadius: 8, background: "#cc0000", border: "none", color: "#fff", fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>Agregar</button>
              <button onClick={() => setMostrarForm(false)} style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Activas", val: stats.count, color: "#22c55e" },
              { label: "Mediana precio", val: `${form.moneda} ${fmt(stats.median)}`, color: "#fff" },
              { label: "Promedio precio", val: `${form.moneda} ${fmt(stats.avg)}`, color: "rgba(255,255,255,0.7)" },
              { label: "Precio/m² prom.", val: `${form.moneda} ${fmt(stats.avgm2, 0)}/m²`, color: "#3b82f6" },
              { label: "Rango m²", val: `${fmt(stats.minm2, 0)} – ${fmt(stats.maxm2, 0)}`, color: "#f97316" },
              { label: "Días prom. activa", val: `${stats.diasPromedio.toFixed(0)}d`, color: stats.diasPromedio > 60 ? "#cc0000" : "#22c55e" },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ margin: "0 0 4px 0", fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{kpi.label}</p>
                <p style={{ margin: 0, fontSize: 14, fontFamily: "'Montserrat',sans-serif", fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="Filtrar por zona..." value={filtroZona} onChange={e => setFiltroZona(e.target.value)} style={{ flex: 1, minWidth: 140, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "6px 10px", fontFamily: "'Inter',sans-serif", fontSize: 12 }} />
          <div style={{ display: "flex", gap: 5 }}>
            {(["todos","venta","alquiler"] as const).map(op => (
              <button key={op} onClick={() => setFiltroOp(op)} style={{ padding: "5px 10px", borderRadius: 16, border: `1px solid ${filtroOp === op ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.1)"}`, background: filtroOp === op ? "rgba(204,0,0,0.12)" : "transparent", color: filtroOp === op ? "#cc0000" : "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
                {op === "todos" ? "Todas" : op === "venta" ? "Venta" : "Alquiler"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {(["todos","activa","bajada","vendida"] as const).map(est => (
              <button key={est} onClick={() => setFiltroEstado(est)} style={{ padding: "5px 10px", borderRadius: 16, border: `1px solid ${filtroEstado === est ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)"}`, background: filtroEstado === est ? "rgba(255,255,255,0.08)" : "transparent", color: filtroEstado === est ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                {est === "todos" ? "Todos" : est}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
            {(["preciom2","precio","dias"] as const).map(o => (
              <button key={o} onClick={() => setOrdenar(o)} style={{ padding: "5px 10px", borderRadius: 16, border: `1px solid ${ordenar === o ? "rgba(204,0,0,0.5)" : "rgba(255,255,255,0.08)"}`, background: ordenar === o ? "rgba(204,0,0,0.12)" : "transparent", color: ordenar === o ? "#cc0000" : "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
                {o === "preciom2" ? "$/m²" : o === "precio" ? "Precio" : "Días"}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
          {filtradas.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: 28 }}>🔍</p>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                {propiedades.length === 0 ? "Agregá propiedades competidoras para analizar el mercado" : "Sin resultados con los filtros actuales"}
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Estado", "Propiedad", "Zona", "Ambientes", "Sup.", "Precio", "$/m²", "Días", "Acciones"].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: h === "Propiedad" || h === "Zona" ? "left" : "center", fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p, idx) => (
                  <tr key={p.id} style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", opacity: p.estado === "vendida" ? 0.5 : 1 }}>
                    <td style={{ padding: "9px 12px", textAlign: "center" }}>
                      <select value={p.estado} onChange={e => cambiarEstado(p.id, e.target.value as PropiedadCompetencia["estado"])} style={{ background: "transparent", border: "none", color: estadoColor(p.estado), fontSize: 11, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, cursor: "pointer" }}>
                        <option value="activa">🟢 Activa</option>
                        <option value="bajada">🟡 Bajó</option>
                        <option value="vendida">🔴 Vendida</option>
                      </select>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{p.titulo}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{p.portal} · {p.tipo} · {p.operacion}</div>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{p.zona}</td>
                    <td style={{ padding: "9px 12px", textAlign: "center", fontSize: 12 }}>{p.ambientes}</td>
                    <td style={{ padding: "9px 12px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                      {p.superficieCubierta}m²{p.superficieTotal > p.superficieCubierta ? `+${p.superficieTotal - p.superficieCubierta}` : ""}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "center", fontSize: 13, fontWeight: 700 }}>
                      {p.moneda} {fmt(p.precio)}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "center" }}>
                      {p.preciom2 > 0 ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: stats && p.preciom2 < stats.avgm2 ? "#22c55e" : stats && p.preciom2 > stats.avgm2 * 1.1 ? "#cc0000" : "rgba(255,255,255,0.7)" }}>
                          {p.moneda} {fmt(p.preciom2, 0)}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "center" }}>
                      <span style={{ fontSize: 11, color: p.diasPublicada > 60 ? "#cc0000" : p.diasPublicada > 30 ? "#f97316" : "#22c55e" }}>
                        {p.diasPublicada}d
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "center", display: "flex", gap: 4, justifyContent: "center" }}>
                      {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none" }}>🔗</a>}
                      <button onClick={() => eliminarPropiedad(p.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Comparación precios/m² por zona */}
        {zonas.length > 1 && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20, marginTop: 20 }}>
            <p style={{ margin: "0 0 14px 0", fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Precio/m² por Zona</p>
            {zonas.map(zona => {
              const props = propiedades.filter(p => p.zona === zona && p.preciom2 > 0 && p.estado === "activa");
              if (props.length === 0) return null;
              const avg = props.reduce((a, p) => a + p.preciom2, 0) / props.length;
              const maxAvg = Math.max(...zonas.map(z => {
                const zProps = propiedades.filter(p => p.zona === z && p.preciom2 > 0 && p.estado === "activa");
                return zProps.length > 0 ? zProps.reduce((a, p) => a + p.preciom2, 0) / zProps.length : 0;
              }));
              return (
                <div key={zona} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, width: 120, color: "rgba(255,255,255,0.6)" }}>{zona}</span>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(avg / maxAvg) * 100}%`, background: "#cc0000", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#cc0000", width: 80, textAlign: "right" }}>{form.moneda} {fmt(avg, 0)}/m²</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", width: 50 }}>{props.length} prop.</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
