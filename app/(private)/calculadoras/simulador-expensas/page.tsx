"use client";

import { useState, useMemo } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtARS(n: number): string {
  return `$ ${fmt(Math.round(n))}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const ADVERTENCIA_MONTO = 150000;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Rubro {
  id: string;
  nombre: string;
  monto: number;
  categoria: "fijo" | "variable";
  ajusteAnual: number; // %
}

type Tab = "presupuesto" | "proyeccion" | "inflacion";

// ── Datos iniciales ───────────────────────────────────────────────────────────

const RUBROS_INICIALES: Rubro[] = [
  { id: uid(), nombre: "Portería / Encargado (sueldo + cargas sociales)", monto: 320000, categoria: "fijo", ajusteAnual: 60 },
  { id: uid(), nombre: "Limpieza y mantenimiento", monto: 80000, categoria: "variable", ajusteAnual: 50 },
  { id: uid(), nombre: "Electricidad áreas comunes", monto: 45000, categoria: "variable", ajusteAnual: 55 },
  { id: uid(), nombre: "Gas calderas / áreas comunes", monto: 35000, categoria: "variable", ajusteAnual: 55 },
  { id: uid(), nombre: "Ascensor (mantenimiento)", monto: 60000, categoria: "fijo", ajusteAnual: 45 },
  { id: uid(), nombre: "Seguro del edificio", monto: 55000, categoria: "fijo", ajusteAnual: 50 },
  { id: uid(), nombre: "Administración (honorarios)", monto: 90000, categoria: "fijo", ajusteAnual: 50 },
  { id: uid(), nombre: "Fondo de reserva", monto: 40000, categoria: "variable", ajusteAnual: 40 },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function SimuladorExpensasPage() {
  const [activeTab, setActiveTab] = useState<Tab>("presupuesto");

  // Configuración global
  const [unidades, setUnidades] = useState(12);
  const [modoCertificado, setModoCertificado] = useState<"iguales" | "superficie">("iguales");
  const [superficiePromedio, setSuperficiePromedio] = useState(60); // m²

  // Rubros
  const [rubros, setRubros] = useState<Rubro[]>(RUBROS_INICIALES);

  // Tab 3 — inflación
  const [inflacionAnual, setInflacionAnual] = useState(50);
  const [ajusteSalarios, setAjusteSalarios] = useState(60);

  // ── Cálculos base ──────────────────────────────────────────────────────────

  const totalMensual = useMemo(
    () => rubros.reduce((acc, r) => acc + r.monto, 0),
    [rubros]
  );

  const totalAnual = totalMensual * 12;

  const porUnidad = useMemo(() => {
    if (unidades <= 0) return 0;
    return totalMensual / unidades;
  }, [totalMensual, unidades]);

  const expensaAlta = porUnidad > ADVERTENCIA_MONTO;

  // ── Proyección 12 meses ────────────────────────────────────────────────────

  const proyeccion = useMemo(() => {
    const filas: {
      mes: string;
      total: number;
      porUnidad: number;
      variacion: number | null;
    }[] = [];

    let prevTotal: number | null = null;

    for (let m = 0; m < 12; m++) {
      const fraccion = m / 12; // fracción del año transcurrida
      const totalMes = rubros.reduce((acc, r) => {
        const factor = Math.pow(1 + r.ajusteAnual / 100, fraccion);
        return acc + r.monto * factor;
      }, 0);

      const unidadesMes = unidades > 0 ? unidades : 1;
      const porUnidadMes = totalMes / unidadesMes;
      const variacion = prevTotal !== null ? ((totalMes - prevTotal) / prevTotal) * 100 : null;

      filas.push({
        mes: MESES[m],
        total: totalMes,
        porUnidad: porUnidadMes,
        variacion,
      });
      prevTotal = totalMes;
    }
    return filas;
  }, [rubros, unidades]);

  const totalMes12 = proyeccion[11]?.total ?? totalMensual;
  const subirPct = totalMensual > 0 ? ((totalMes12 - totalMensual) / totalMensual) * 100 : 0;
  const subirPesos = totalMes12 - totalMensual;

  // SVG line chart data
  const chartW = 700;
  const chartH = 260;
  const padL = 80;
  const padR = 20;
  const padT = 20;
  const padB = 40;

  const minVal = Math.min(...proyeccion.map((f) => f.total));
  const maxVal = Math.max(...proyeccion.map((f) => f.total));
  const rangeVal = maxVal - minVal || 1;

  function toX(i: number): number {
    return padL + (i / 11) * (chartW - padL - padR);
  }
  function toY(v: number): number {
    return padT + ((maxVal - v) / rangeVal) * (chartH - padT - padB);
  }

  const svgPoints = proyeccion.map((f, i) => `${toX(i)},${toY(f.total)}`).join(" ");
  const svgArea =
    `M${toX(0)},${toY(proyeccion[0]?.total ?? 0)} ` +
    proyeccion.map((f, i) => `L${toX(i)},${toY(f.total)}`).join(" ") +
    ` L${toX(11)},${chartH - padB} L${toX(0)},${chartH - padB} Z`;

  // ── Comparador inflación ───────────────────────────────────────────────────

  const escenarios = useMemo(() => {
    function proyectarEscenario(multiplicador: number) {
      return rubros.reduce((acc, r) => {
        const ajuste = r.nombre.toLowerCase().includes("portería") ||
          r.nombre.toLowerCase().includes("porteria") ||
          r.nombre.toLowerCase().includes("encargado")
          ? ajusteSalarios * multiplicador
          : inflacionAnual * multiplicador;
        const factor = Math.pow(1 + ajuste / 100, 1);
        return acc + r.monto * factor;
      }, 0);
    }

    const conservador = proyectarEscenario(0.8);
    const base = proyectarEscenario(1.0);
    const agresivo = proyectarEscenario(1.2);

    return [
      {
        nombre: "Conservador",
        subtitulo: `Inflación −20% (${fmt(inflacionAnual * 0.8, 1)}%)`,
        color: "#22c55e",
        total: conservador,
        variacion: ((conservador - totalMensual) / totalMensual) * 100,
      },
      {
        nombre: "Base",
        subtitulo: `Inflación base (${fmt(inflacionAnual, 1)}%)`,
        color: "#f97316",
        total: base,
        variacion: ((base - totalMensual) / totalMensual) * 100,
      },
      {
        nombre: "Agresivo",
        subtitulo: `Inflación +20% (${fmt(inflacionAnual * 1.2, 1)}%)`,
        color: "#cc0000",
        total: agresivo,
        variacion: ((agresivo - totalMensual) / totalMensual) * 100,
      },
    ];
  }, [rubros, inflacionAnual, ajusteSalarios, totalMensual]);

  const maxEscenario = Math.max(...escenarios.map((e) => e.total));

  // ── Handlers ──────────────────────────────────────────────────────────────

  function updateRubro(id: string, field: keyof Rubro, value: string | number) {
    setRubros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function eliminarRubro(id: string) {
    setRubros((prev) => prev.filter((r) => r.id !== id));
  }

  function agregarRubro() {
    setRubros((prev) => [
      ...prev,
      { id: uid(), nombre: "Nuevo rubro", monto: 0, categoria: "fijo", ajusteAnual: 50 },
    ]);
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const S = {
    page: {
      background: "#0a0a0a",
      minHeight: "100vh",
      color: "#e0e0e0",
      fontFamily: "'Inter', sans-serif",
      padding: "24px 16px 60px",
    } as React.CSSProperties,
    heading: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 800,
      fontSize: "clamp(22px, 4vw, 32px)",
      color: "#e0e0e0",
      margin: 0,
      letterSpacing: "-0.5px",
    } as React.CSSProperties,
    subtitle: {
      color: "#888",
      fontSize: 14,
      margin: "6px 0 0",
    } as React.CSSProperties,
    tabBar: {
      display: "flex",
      gap: 4,
      marginBottom: 24,
      borderBottom: "1px solid #222",
      paddingBottom: 0,
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    card: {
      background: "#111",
      border: "1px solid #222",
      borderRadius: 10,
      padding: "20px",
    } as React.CSSProperties,
    label: {
      fontSize: 12,
      color: "#888",
      display: "block",
      marginBottom: 4,
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
    } as React.CSSProperties,
    input: {
      background: "#1a1a1a",
      border: "1px solid #2a2a2a",
      borderRadius: 6,
      color: "#e0e0e0",
      padding: "8px 10px",
      fontSize: 14,
      width: "100%",
      boxSizing: "border-box" as const,
      outline: "none",
    } as React.CSSProperties,
    select: {
      background: "#1a1a1a",
      border: "1px solid #2a2a2a",
      borderRadius: 6,
      color: "#e0e0e0",
      padding: "8px 10px",
      fontSize: 14,
      outline: "none",
      cursor: "pointer",
    } as React.CSSProperties,
    btnPrimary: {
      background: "#cc0000",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      padding: "9px 18px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
    } as React.CSSProperties,
    btnGhost: {
      background: "transparent",
      color: "#888",
      border: "1px solid #2a2a2a",
      borderRadius: 6,
      padding: "5px 10px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
    } as React.CSSProperties,
    statCard: (highlight?: boolean): React.CSSProperties => ({
      background: highlight ? "rgba(204,0,0,0.08)" : "#111",
      border: `1px solid ${highlight ? "#cc0000" : "#222"}`,
      borderRadius: 10,
      padding: "16px 20px",
    }),
    statLabel: {
      fontSize: 12,
      color: "#888",
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
      marginBottom: 4,
    } as React.CSSProperties,
    statValue: (highlight?: boolean): React.CSSProperties => ({
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 700,
      fontSize: "clamp(18px, 3vw, 24px)",
      color: highlight ? "#f97316" : "#e0e0e0",
    }),
    tableHead: {
      background: "#161616",
      fontSize: 12,
      color: "#666",
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
    } as React.CSSProperties,
    th: {
      padding: "10px 12px",
      textAlign: "left" as const,
      borderBottom: "1px solid #222",
      fontWeight: 600,
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,
    td: {
      padding: "9px 12px",
      borderBottom: "1px solid #1a1a1a",
      fontSize: 14,
      verticalAlign: "middle" as const,
    } as React.CSSProperties,
    sectionTitle: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 700,
      fontSize: 16,
      color: "#e0e0e0",
      margin: "0 0 16px",
    } as React.CSSProperties,
  };

  function tabStyle(t: Tab): React.CSSProperties {
    const active = activeTab === t;
    return {
      padding: "10px 18px",
      fontSize: 14,
      fontWeight: active ? 700 : 400,
      color: active ? "#e0e0e0" : "#666",
      background: "transparent",
      border: "none",
      borderBottom: active ? "2px solid #cc0000" : "2px solid transparent",
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
      marginBottom: -1,
      whiteSpace: "nowrap",
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={S.heading}>Simulador de Expensas</h1>
          <p style={S.subtitle}>
            Presupuesto, proyección y análisis inflacionario para consorcios
          </p>
        </div>

        {/* Config global */}
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              alignItems: "end",
            }}
          >
            <div>
              <label style={S.label}>Unidades funcionales</label>
              <input
                type="number"
                min={1}
                value={unidades}
                onChange={(e) => setUnidades(Math.max(1, parseInt(e.target.value) || 1))}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Reparto de expensas</label>
              <select
                value={modoCertificado}
                onChange={(e) =>
                  setModoCertificado(e.target.value as "iguales" | "superficie")
                }
                style={{ ...S.select, width: "100%" }}
              >
                <option value="iguales">Partes iguales</option>
                <option value="superficie">Por superficie</option>
              </select>
            </div>
            {modoCertificado === "superficie" && (
              <div>
                <label style={S.label}>Superficie promedio (m²)</label>
                <input
                  type="number"
                  min={1}
                  value={superficiePromedio}
                  onChange={(e) =>
                    setSuperficiePromedio(Math.max(1, parseFloat(e.target.value) || 1))
                  }
                  style={S.input}
                />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabBar}>
          {(
            [
              ["presupuesto", "1. Presupuesto del consorcio"],
              ["proyeccion", "2. Proyección 12 meses"],
              ["inflacion", "3. Comparador inflación"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
              {label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            TAB 1 — PRESUPUESTO
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "presupuesto" && (
          <div>
            {/* Totales destacados */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div style={S.statCard()}>
                <div style={S.statLabel}>Total mensual</div>
                <div style={S.statValue()}>{fmtARS(totalMensual)}</div>
              </div>
              <div style={S.statCard()}>
                <div style={S.statLabel}>Total anual</div>
                <div style={S.statValue()}>{fmtARS(totalAnual)}</div>
              </div>
              <div style={S.statCard(expensaAlta)}>
                <div style={S.statLabel}>Por unidad / mes</div>
                <div style={S.statValue(expensaAlta)}>{fmtARS(porUnidad)}</div>
                {expensaAlta && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#f97316",
                      marginTop: 4,
                      fontWeight: 600,
                    }}
                  >
                    ⚠ Expensas altas
                  </div>
                )}
              </div>
              <div style={S.statCard()}>
                <div style={S.statLabel}>Rubros</div>
                <div style={S.statValue()}>{rubros.length}</div>
              </div>
            </div>

            {/* Tabla de rubros */}
            <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  padding: "16px 20px 12px",
                  borderBottom: "1px solid #222",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <h2 style={{ ...S.sectionTitle, margin: 0 }}>Rubros del presupuesto</h2>
                <button style={S.btnPrimary} onClick={agregarRubro}>
                  + Agregar rubro
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                  <thead>
                    <tr style={S.tableHead}>
                      <th style={{ ...S.th, width: "35%" }}>Nombre del rubro</th>
                      <th style={S.th}>Monto mensual (ARS)</th>
                      <th style={S.th}>Categoría</th>
                      <th style={S.th}>Ajuste anual %</th>
                      <th style={S.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rubros.map((r, i) => (
                      <tr
                        key={r.id}
                        style={{ background: i % 2 === 0 ? "transparent" : "#0e0e0e" }}
                      >
                        <td style={S.td}>
                          <input
                            type="text"
                            value={r.nombre}
                            onChange={(e) => updateRubro(r.id, "nombre", e.target.value)}
                            style={{
                              ...S.input,
                              fontSize: 13,
                              padding: "6px 8px",
                            }}
                          />
                        </td>
                        <td style={S.td}>
                          <input
                            type="number"
                            min={0}
                            value={r.monto}
                            onChange={(e) =>
                              updateRubro(r.id, "monto", parseFloat(e.target.value) || 0)
                            }
                            style={{
                              ...S.input,
                              fontSize: 13,
                              padding: "6px 8px",
                              maxWidth: 130,
                            }}
                          />
                        </td>
                        <td style={S.td}>
                          <select
                            value={r.categoria}
                            onChange={(e) =>
                              updateRubro(r.id, "categoria", e.target.value)
                            }
                            style={{ ...S.select, fontSize: 13, padding: "6px 8px" }}
                          >
                            <option value="fijo">Fijo</option>
                            <option value="variable">Variable</option>
                          </select>
                        </td>
                        <td style={S.td}>
                          <input
                            type="number"
                            min={0}
                            max={500}
                            step={1}
                            value={r.ajusteAnual}
                            onChange={(e) =>
                              updateRubro(
                                r.id,
                                "ajusteAnual",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            style={{
                              ...S.input,
                              fontSize: 13,
                              padding: "6px 8px",
                              maxWidth: 80,
                            }}
                          />
                        </td>
                        <td style={{ ...S.td, textAlign: "center" }}>
                          <button
                            onClick={() => eliminarRubro(r.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#555",
                              fontSize: 18,
                              cursor: "pointer",
                              lineHeight: 1,
                              padding: "2px 6px",
                              borderRadius: 4,
                              transition: "color 0.15s",
                            }}
                            title="Eliminar rubro"
                            onMouseEnter={(e) =>
                              ((e.currentTarget as HTMLButtonElement).style.color = "#cc0000")
                            }
                            onMouseLeave={(e) =>
                              ((e.currentTarget as HTMLButtonElement).style.color = "#555")
                            }
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#161616" }}>
                      <td
                        style={{
                          ...S.td,
                          fontWeight: 700,
                          color: "#e0e0e0",
                          fontSize: 14,
                        }}
                      >
                        TOTAL MENSUAL
                      </td>
                      <td
                        style={{
                          ...S.td,
                          fontWeight: 700,
                          color: "#e0e0e0",
                          fontSize: 15,
                        }}
                      >
                        {fmtARS(totalMensual)}
                      </td>
                      <td colSpan={3} style={S.td}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Breakdown por categoría */}
            <div style={{ ...S.card, marginTop: 20 }}>
              <h2 style={S.sectionTitle}>Distribución por categoría</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 10,
                }}
              >
                {(["fijo", "variable"] as const).map((cat) => {
                  const subtotal = rubros
                    .filter((r) => r.categoria === cat)
                    .reduce((a, r) => a + r.monto, 0);
                  const pct = totalMensual > 0 ? (subtotal / totalMensual) * 100 : 0;
                  return (
                    <div
                      key={cat}
                      style={{
                        background: "#161616",
                        border: "1px solid #222",
                        borderRadius: 8,
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: cat === "fijo" ? "#3b82f6" : "#f97316",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: 6,
                        }}
                      >
                        {cat === "fijo" ? "Fijos" : "Variables"}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#e0e0e0" }}>
                        {fmtARS(subtotal)}
                      </div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
                        {fmt(pct, 1)}% del total
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2 — PROYECCIÓN 12 MESES
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "proyeccion" && (
          <div>
            {/* Resumen anual */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div style={S.statCard()}>
                <div style={S.statLabel}>Expensa mes 1</div>
                <div style={S.statValue()}>{fmtARS(proyeccion[0]?.total ?? 0)}</div>
              </div>
              <div style={S.statCard()}>
                <div style={S.statLabel}>Expensa mes 12</div>
                <div style={S.statValue()}>{fmtARS(totalMes12)}</div>
              </div>
              <div style={S.statCard(subirPct > 50)}>
                <div style={S.statLabel}>Sube en el año</div>
                <div style={S.statValue(subirPct > 50)}>
                  +{fmt(subirPct, 1)}%
                </div>
              </div>
              <div style={S.statCard()}>
                <div style={S.statLabel}>En pesos (mes 12 vs. 1)</div>
                <div style={S.statValue()}>+{fmtARS(subirPesos)}</div>
              </div>
            </div>

            {/* Gráfico SVG */}
            <div style={{ ...S.card, marginBottom: 24, overflowX: "auto" }}>
              <h2 style={S.sectionTitle}>Total mensual a lo largo del año</h2>
              <svg
                width="100%"
                viewBox={`0 0 ${chartW} ${chartH}`}
                style={{ display: "block", maxWidth: "100%" }}
              >
                {/* Grid horizontal */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const yPos = padT + pct * (chartH - padT - padB);
                  const val = maxVal - pct * rangeVal;
                  return (
                    <g key={pct}>
                      <line
                        x1={padL}
                        y1={yPos}
                        x2={chartW - padR}
                        y2={yPos}
                        stroke="#1e1e1e"
                        strokeWidth={1}
                      />
                      <text
                        x={padL - 6}
                        y={yPos + 4}
                        textAnchor="end"
                        fontSize={10}
                        fill="#555"
                      >
                        {fmtARS(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Área bajo la línea */}
                <path d={svgArea} fill="rgba(204,0,0,0.08)" />

                {/* Línea principal */}
                <polyline
                  points={svgPoints}
                  fill="none"
                  stroke="#cc0000"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Puntos */}
                {proyeccion.map((f, i) => (
                  <g key={i}>
                    <circle
                      cx={toX(i)}
                      cy={toY(f.total)}
                      r={4}
                      fill="#cc0000"
                      stroke="#0a0a0a"
                      strokeWidth={2}
                    />
                    {/* Etiqueta mes */}
                    <text
                      x={toX(i)}
                      y={chartH - padB + 18}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#555"
                    >
                      {MESES[i].slice(0, 3)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Tabla mes a mes */}
            <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #222" }}>
                <h2 style={{ ...S.sectionTitle, margin: 0 }}>Detalle mes a mes</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                  <thead>
                    <tr style={S.tableHead}>
                      <th style={S.th}>Mes</th>
                      <th style={S.th}>Total consorcio (ARS)</th>
                      <th style={S.th}>Por unidad (ARS)</th>
                      <th style={S.th}>Var. vs mes anterior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proyeccion.map((f, i) => {
                      const altaUnidad = f.porUnidad > ADVERTENCIA_MONTO;
                      return (
                        <tr
                          key={i}
                          style={{
                            background:
                              altaUnidad
                                ? "rgba(249,115,22,0.04)"
                                : i % 2 === 0
                                ? "transparent"
                                : "#0e0e0e",
                          }}
                        >
                          <td style={{ ...S.td, fontWeight: 600 }}>{f.mes}</td>
                          <td style={S.td}>{fmtARS(f.total)}</td>
                          <td
                            style={{
                              ...S.td,
                              color: altaUnidad ? "#f97316" : "#e0e0e0",
                              fontWeight: altaUnidad ? 600 : 400,
                            }}
                          >
                            {fmtARS(f.porUnidad)}
                            {altaUnidad && (
                              <span
                                style={{ marginLeft: 6, fontSize: 11, color: "#f97316" }}
                              >
                                ⚠
                              </span>
                            )}
                          </td>
                          <td style={S.td}>
                            {f.variacion !== null ? (
                              <span
                                style={{
                                  color: f.variacion > 0 ? "#f97316" : "#22c55e",
                                  fontWeight: 600,
                                  fontSize: 13,
                                }}
                              >
                                {f.variacion > 0 ? "+" : ""}
                                {fmt(f.variacion, 2)}%
                              </span>
                            ) : (
                              <span style={{ color: "#444" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 3 — COMPARADOR INFLACIÓN
        ═══════════════════════════════════════════════════════════ */}
        {activeTab === "inflacion" && (
          <div>
            {/* Inputs inflación */}
            <div style={{ ...S.card, marginBottom: 24 }}>
              <h2 style={S.sectionTitle}>Parámetros macroeconómicos</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                <div>
                  <label style={S.label}>Inflación esperada anual (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    value={inflacionAnual}
                    onChange={(e) =>
                      setInflacionAnual(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    style={S.input}
                  />
                </div>
                <div>
                  <label style={S.label}>Incremento salarios / encargado (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    value={ajusteSalarios}
                    onChange={(e) =>
                      setAjusteSalarios(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    style={S.input}
                  />
                  <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                    Aplica solo a rubros de portería / encargado
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla comparativa */}
            <div style={{ ...S.card, padding: 0, overflow: "hidden", marginBottom: 24 }}>
              <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #222" }}>
                <h2 style={{ ...S.sectionTitle, margin: 0 }}>3 Escenarios de ajuste</h2>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}
                >
                  <thead>
                    <tr style={S.tableHead}>
                      <th style={S.th}>Escenario</th>
                      <th style={S.th}>Expensa actual / mes</th>
                      <th style={S.th}>Proyectada a 12 meses</th>
                      <th style={S.th}>Variación %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escenarios.map((esc) => (
                      <tr key={esc.nombre}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, color: esc.color }}>
                            {esc.nombre}
                          </div>
                          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                            {esc.subtitulo}
                          </div>
                        </td>
                        <td style={S.td}>{fmtARS(totalMensual)}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>
                          {fmtARS(esc.total)}
                        </td>
                        <td style={S.td}>
                          <span
                            style={{
                              color: esc.color,
                              fontWeight: 700,
                              fontSize: 15,
                            }}
                          >
                            +{fmt(esc.variacion, 1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Barras SVG horizontales */}
            <div style={{ ...S.card, marginBottom: 24 }}>
              <h2 style={S.sectionTitle}>Comparación visual de escenarios</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {escenarios.map((esc) => {
                  const pct = maxEscenario > 0 ? (esc.total / maxEscenario) * 100 : 0;
                  return (
                    <div key={esc.nombre}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: esc.color }}>
                          {esc.nombre}
                        </span>
                        <span style={{ color: "#e0e0e0", fontWeight: 600 }}>
                          {fmtARS(esc.total)} / mes &nbsp;·&nbsp; +{fmt(esc.variacion, 1)}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 28,
                          background: "#1a1a1a",
                          borderRadius: 6,
                          overflow: "hidden",
                          border: "1px solid #222",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${esc.color}cc, ${esc.color})`,
                            borderRadius: 5,
                            transition: "width 0.4s ease",
                            display: "flex",
                            alignItems: "center",
                            paddingLeft: 10,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#fff",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {fmt(pct, 0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Por unidad en cada escenario */}
            {unidades > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                {escenarios.map((esc) => {
                  const pu = esc.total / unidades;
                  const alta = pu > ADVERTENCIA_MONTO;
                  return (
                    <div key={esc.nombre} style={S.statCard(alta)}>
                      <div style={{ ...S.statLabel, color: esc.color }}>
                        {esc.nombre} — por unidad
                      </div>
                      <div style={S.statValue(alta)}>{fmtARS(pu)}</div>
                      {alta && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#f97316",
                            marginTop: 4,
                            fontWeight: 600,
                          }}
                        >
                          ⚠ Expensas altas
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Nota legal */}
            <div
              style={{
                background: "#111",
                border: "1px solid #222",
                borderLeft: "3px solid #f97316",
                borderRadius: 8,
                padding: "14px 18px",
                fontSize: 13,
                color: "#888",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "#f97316" }}>Nota:</strong> Las expensas ajustan
              según los convenios colectivos de porteros, seguros y servicios. El
              incremento del encargado sigue el Convenio Colectivo de Trabajo 589/10
              (SUTERH). Los servicios públicos pueden tener actualizaciones distintas a la
              inflación general.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
