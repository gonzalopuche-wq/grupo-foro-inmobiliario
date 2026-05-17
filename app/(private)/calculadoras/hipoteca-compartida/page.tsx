"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function cuotaFrances(capital: number, tnaAnual: number, plazoMeses: number): number {
  if (capital <= 0 || plazoMeses <= 0) return 0;
  const tem = tnaAnual / 100 / 12;
  if (tem === 0) return capital / plazoMeses;
  return (capital * tem * Math.pow(1 + tem, plazoMeses)) / (Math.pow(1 + tem, plazoMeses) - 1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TipoCredito = "uva" | "peso_fijo" | "uva_tope";

interface Cotitular {
  id: number;
  nombre: string;
  ingresoMensual: number;
  participacion: number; // %
}

interface FilaProyeccionUVA {
  anio: number;
  cuotaARS: number;
  capitalAdeudado: number;
  uvasAdeudadas: number;
}

interface FilaAmortizacion {
  cuota: number;
  capital: number;
  interes: number;
  saldo: number;
}

// ---------------------------------------------------------------------------
// Styles helpers
// ---------------------------------------------------------------------------
const S = {
  card: {
    background: "#111111",
    border: "1px solid #222222",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 600,
    display: "block",
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,
  input: {
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    padding: "6px 10px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  select: {
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#e0e0e0",
    padding: "6px 10px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  tabBtn: (active: boolean): React.CSSProperties => ({
    padding: "8px 18px",
    borderRadius: 8,
    border: "1px solid",
    borderColor: active ? "#cc0000" : "#333",
    background: active ? "#cc000022" : "transparent",
    color: active ? "#cc0000" : "#9ca3af",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
  }),
  thCell: {
    padding: "9px 12px",
    textAlign: "left" as const,
    color: "#6b7280",
    fontSize: 11,
    fontWeight: 600,
    borderBottom: "1px solid #222222",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  tdCell: (alt: boolean): React.CSSProperties => ({
    padding: "8px 12px",
    fontSize: 12,
    color: "#e0e0e0",
    borderBottom: "1px solid #1a1a1a",
    background: alt ? "#0f0f0f" : "#111111",
  }),
};

function ptiBadge(pti: number): React.CSSProperties {
  if (pti <= 30) return { background: "#14532d44", color: "#22c55e", border: "1px solid #22c55e44" };
  if (pti <= 40) return { background: "#78350f44", color: "#f59e0b", border: "1px solid #f59e0b44" };
  return { background: "#7f1d1d44", color: "#cc0000", border: "1px solid #cc000044" };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function HipotecaCompartidaPage() {
  // ---- Tab state
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // ---- Credit inputs
  const [valorPropiedad, setValorPropiedad] = useState(80_000_000);
  const [pctFinanciacion, setPctFinanciacion] = useState(75);
  const [plazoAnios, setPlazoAnios] = useState(20);
  const [tipoCredito, setTipoCredito] = useState<TipoCredito>("uva");
  const [tasaAnual, setTasaAnual] = useState(8.5);
  const [inflacionAnual, setInflacionAnual] = useState(80);

  // ---- Cotitulares
  const [cotitulares, setCotitulares] = useState<Cotitular[]>([
    { id: 1, nombre: "Cotitular 1", ingresoMensual: 1_200_000, participacion: 50 },
    { id: 2, nombre: "Cotitular 2", ingresoMensual: 900_000, participacion: 50 },
  ]);

  // ---- Derived
  const montoCredito = useMemo(
    () => (valorPropiedad * Math.min(80, Math.max(50, pctFinanciacion))) / 100,
    [valorPropiedad, pctFinanciacion]
  );
  const plazoMeses = plazoAnios * 12;
  const cuotaTotal = useMemo(
    () => cuotaFrances(montoCredito, tasaAnual, plazoMeses),
    [montoCredito, tasaAnual, plazoMeses]
  );

  const sumParticipacion = cotitulares.reduce((s, c) => s + c.participacion, 0);
  const partSuma100 = Math.abs(sumParticipacion - 100) < 0.01;

  // ---- Cotitular helpers
  function setCotitularField<K extends keyof Cotitular>(
    id: number,
    field: K,
    value: Cotitular[K]
  ) {
    setCotitulares((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  function distribuirEquitativamente() {
    const n = cotitulares.length;
    const base = Math.floor(100 / n);
    const resto = 100 - base * n;
    setCotitulares((prev) =>
      prev.map((c, i) => ({
        ...c,
        participacion: i === 0 ? base + resto : base,
      }))
    );
  }

  function agregarCotitular() {
    if (cotitulares.length >= 4) return;
    const id = Math.max(...cotitulares.map((c) => c.id)) + 1;
    setCotitulares((prev) => [
      ...prev,
      { id, nombre: `Cotitular ${id}`, ingresoMensual: 500_000, participacion: 0 },
    ]);
  }

  function quitarCotitular(id: number) {
    if (cotitulares.length <= 2) return;
    setCotitulares((prev) => prev.filter((c) => c.id !== id));
  }

  // ---- Results per cotitular
  const resultadosCotitulares = useMemo(() => {
    const ingresoTotal = cotitulares.reduce((s, c) => s + c.ingresoMensual, 0);
    const ptiTotal = ingresoTotal > 0 ? (cuotaTotal / ingresoTotal) * 100 : 0;

    return {
      cuotaTotal,
      ingresoTotal,
      ptiTotal,
      calificaConjunto: ptiTotal <= 30,
      cotitulares: cotitulares.map((c) => {
        const cuotaProp = cuotaTotal * (c.participacion / 100);
        const pti = c.ingresoMensual > 0 ? (cuotaProp / c.ingresoMensual) * 100 : 999;
        const ingresoMinimo = cuotaProp / 0.3;
        return {
          ...c,
          cuotaProp,
          pti,
          ingresoMinimo,
          califica: pti <= 30,
        };
      }),
    };
  }, [cotitulares, cuotaTotal]);

  // ---- Proyección UVA (Tab 2)
  const proyeccionUVA = useMemo((): FilaProyeccionUVA[] => {
    const tem = tasaAnual / 100 / 12;
    const inflMensual = Math.pow(1 + inflacionAnual / 100, 1 / 12) - 1;
    const uvaCuotaFija = cuotaFrances(montoCredito, tasaAnual, plazoMeses);
    const filas: FilaProyeccionUVA[] = [];
    let saldoActual = montoCredito;

    for (let mes = 1; mes <= plazoMeses; mes++) {
      const interes = saldoActual * tem;
      const capitalMes = uvaCuotaFija - interes;
      saldoActual = Math.max(0, saldoActual - capitalMes);

      if (mes % 12 === 0) {
        const anio = mes / 12;
        if (anio > 10) break;
        const factorInflacion = Math.pow(1 + inflacionAnual / 100, anio);
        const cuotaARS = uvaCuotaFija * factorInflacion;
        const capitalAdeudado = saldoActual * factorInflacion;
        filas.push({
          anio,
          cuotaARS,
          capitalAdeudado,
          uvasAdeudadas: saldoActual,
        });
      }
    }
    return filas;
  }, [montoCredito, tasaAnual, plazoMeses, inflacionAnual, cuotaTotal]);

  // ---- Amortización peso fijo primeras 24 cuotas (Tab 2)
  const tablaAmortizacion = useMemo((): FilaAmortizacion[] => {
    const tem = tasaAnual / 100 / 12;
    const filas: FilaAmortizacion[] = [];
    let saldo = montoCredito;
    const cuota = cuotaTotal;
    for (let i = 1; i <= Math.min(24, plazoMeses); i++) {
      const interes = saldo * tem;
      const capital = cuota - interes;
      saldo = Math.max(0, saldo - capital);
      filas.push({ cuota, capital, interes, saldo });
    }
    return filas;
  }, [montoCredito, tasaAnual, plazoMeses, cuotaTotal]);

  const interesTotalPesoFijo = useMemo(() => {
    return cuotaTotal * plazoMeses - montoCredito;
  }, [cuotaTotal, plazoMeses, montoCredito]);

  // ---- Escenarios (Tab 3)
  const ESCENARIOS = [
    { label: "Optimista", inflacion: 50, color: "#22c55e" },
    { label: "Base", inflacion: 100, color: "#f59e0b" },
    { label: "Pesimista", inflacion: 150, color: "#cc0000" },
  ];
  const PERIODOS = [12, 24, 36, 60];

  const tablaEscenarios = useMemo(() => {
    return ESCENARIOS.map((esc) => {
      const cuotas = PERIODOS.map((mes) => {
        const factor = Math.pow(1 + esc.inflacion / 100, mes / 12);
        return cuotaTotal * factor;
      });
      return { ...esc, cuotas };
    });
  }, [cuotaTotal]);

  const maxCuota5a = Math.max(...tablaEscenarios.map((e) => e.cuotas[3]), 1);

  // ---- SVG chart data (Tab 2 UVA)
  const SVG_W = 680;
  const SVG_H = 260;
  const SVG_PAD = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = SVG_W - SVG_PAD.left - SVG_PAD.right;
  const chartH = SVG_H - SVG_PAD.top - SVG_PAD.bottom;

  const svgData = useMemo(() => {
    if (proyeccionUVA.length === 0) return null;
    const maxVal = Math.max(
      ...proyeccionUVA.map((f) => f.cuotaARS),
      ...proyeccionUVA.map((f) => {
        const c1 = resultadosCotitulares.cotitulares[0];
        return c1 ? f.cuotaARS * (c1.participacion / 100) : 0;
      }),
      ...proyeccionUVA.map((f) => {
        const c2 = resultadosCotitulares.cotitulares[1];
        return c2 ? f.cuotaARS * (c2.participacion / 100) : 0;
      }),
      1
    );

    const n = proyeccionUVA.length;
    const px = (i: number) =>
      SVG_PAD.left + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
    const py = (v: number) =>
      SVG_PAD.top + chartH - (v / maxVal) * chartH;

    const lineTotal = proyeccionUVA.map((f, i) => `${px(i)},${py(f.cuotaARS)}`).join(" ");
    const lineCot1 = proyeccionUVA
      .map((f, i) => {
        const c1 = resultadosCotitulares.cotitulares[0];
        return `${px(i)},${py(c1 ? f.cuotaARS * (c1.participacion / 100) : 0)}`;
      })
      .join(" ");
    const lineCot2 = proyeccionUVA
      .map((f, i) => {
        const c2 = resultadosCotitulares.cotitulares[1];
        return `${px(i)},${py(c2 ? f.cuotaARS * (c2.participacion / 100) : 0)}`;
      })
      .join(" ");

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: py(t * maxVal),
      label: fmt(t * maxVal),
    }));

    return { lineTotal, lineCot1, lineCot2, px, py, yTicks, maxVal };
  }, [proyeccionUVA, resultadosCotitulares]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#e0e0e0",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 800,
                fontSize: 26,
                color: "#ffffff",
                margin: 0,
              }}
            >
              Hipoteca Compartida
            </h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
              Distribución de crédito hipotecario UVA entre cotitulares
            </p>
          </div>
          <Link
            href="/calculadoras"
            style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}
          >
            ← Calculadoras
          </Link>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {(["Configuración", "Proyección", "Escenarios"] as const).map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i as 0 | 1 | 2)}
              style={S.tabBtn(tab === i)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ================================================================ */}
        {/* TAB 0 — Configuración                                            */}
        {/* ================================================================ */}
        {tab === 0 && (
          <>
            {/* Crédito */}
            <div style={S.card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#fff",
                  margin: "0 0 16px",
                }}
              >
                Datos del crédito
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                {/* Valor propiedad */}
                <div>
                  <label style={S.label}>Valor de la propiedad (ARS)</label>
                  <input
                    type="number"
                    value={valorPropiedad}
                    step={1_000_000}
                    onChange={(e) => setValorPropiedad(parseFloat(e.target.value) || 0)}
                    style={S.input}
                  />
                </div>

                {/* Pct financiacion */}
                <div>
                  <label style={S.label}>Financiación ({pctFinanciacion}%)</label>
                  <input
                    type="range"
                    min={50}
                    max={80}
                    step={5}
                    value={pctFinanciacion}
                    onChange={(e) => setPctFinanciacion(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#cc0000" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 10,
                      color: "#4b5563",
                      marginTop: 2,
                    }}
                  >
                    <span>50%</span><span>80%</span>
                  </div>
                </div>

                {/* Monto crédito readonly */}
                <div>
                  <label style={S.label}>Monto del crédito (ARS)</label>
                  <div
                    style={{
                      background: "#0d0d0d",
                      border: "1px solid #222",
                      borderRadius: 6,
                      padding: "7px 10px",
                      fontSize: 13,
                      color: "#cc0000",
                      fontWeight: 700,
                    }}
                  >
                    $ {fmt(montoCredito)}
                  </div>
                </div>

                {/* Plazo */}
                <div>
                  <label style={S.label}>Plazo</label>
                  <select
                    value={plazoAnios}
                    onChange={(e) => setPlazoAnios(parseInt(e.target.value))}
                    style={S.select}
                  >
                    {[5, 10, 15, 20, 25, 30].map((a) => (
                      <option key={a} value={a}>
                        {a} años ({a * 12} meses)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo crédito */}
                <div>
                  <label style={S.label}>Tipo de crédito</label>
                  <select
                    value={tipoCredito}
                    onChange={(e) => setTipoCredito(e.target.value as TipoCredito)}
                    style={S.select}
                  >
                    <option value="uva">UVA</option>
                    <option value="peso_fijo">Peso fijo</option>
                    <option value="uva_tope">UVA con tope (Hogan)</option>
                  </select>
                </div>

                {/* Tasa anual */}
                <div>
                  <label style={S.label}>
                    Tasa anual (%){" "}
                    {tipoCredito !== "peso_fijo" ? "sobre UVA" : "sobre capital"}
                  </label>
                  <input
                    type="number"
                    value={tasaAnual}
                    step={0.5}
                    min={0}
                    onChange={(e) => setTasaAnual(parseFloat(e.target.value) || 0)}
                    style={S.input}
                  />
                </div>

                {/* Inflación (solo UVA) */}
                {tipoCredito !== "peso_fijo" && (
                  <div>
                    <label style={S.label}>Inflación anual estimada (%)</label>
                    <input
                      type="number"
                      value={inflacionAnual}
                      step={5}
                      min={0}
                      onChange={(e) => setInflacionAnual(parseFloat(e.target.value) || 0)}
                      style={S.input}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Cotitulares */}
            <div style={S.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#fff",
                    margin: 0,
                  }}
                >
                  Cotitulares ({cotitulares.length})
                </h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={distribuirEquitativamente}
                    style={{
                      background: "#1e3a5f",
                      border: "1px solid #3b82f644",
                      borderRadius: 6,
                      color: "#3b82f6",
                      fontSize: 12,
                      padding: "5px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Distribuir equitativamente
                  </button>
                  {cotitulares.length < 4 && (
                    <button
                      onClick={agregarCotitular}
                      style={{
                        background: "#14532d22",
                        border: "1px solid #22c55e44",
                        borderRadius: 6,
                        color: "#22c55e",
                        fontSize: 12,
                        padding: "5px 12px",
                        cursor: "pointer",
                      }}
                    >
                      + Agregar
                    </button>
                  )}
                </div>
              </div>

              {/* Validation */}
              {!partSuma100 && (
                <div
                  style={{
                    background: "#7f1d1d33",
                    border: "1px solid #cc000066",
                    borderRadius: 6,
                    padding: "8px 14px",
                    marginBottom: 12,
                    fontSize: 12,
                    color: "#cc0000",
                  }}
                >
                  Los porcentajes de participación deben sumar 100% (actualmente{" "}
                  {fmt(sumParticipacion, 1)}%)
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {cotitulares.map((cot) => (
                  <div
                    key={cot.id}
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #222",
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr auto",
                        gap: 12,
                        alignItems: "end",
                      }}
                    >
                      <div>
                        <label style={S.label}>Nombre</label>
                        <input
                          type="text"
                          value={cot.nombre}
                          onChange={(e) =>
                            setCotitularField(cot.id, "nombre", e.target.value)
                          }
                          style={S.input}
                        />
                      </div>
                      <div>
                        <label style={S.label}>Ingreso mensual neto (ARS)</label>
                        <input
                          type="number"
                          value={cot.ingresoMensual}
                          step={50_000}
                          onChange={(e) =>
                            setCotitularField(
                              cot.id,
                              "ingresoMensual",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          style={S.input}
                        />
                      </div>
                      <div>
                        <label style={S.label}>Participación (%)</label>
                        <input
                          type="number"
                          value={cot.participacion}
                          step={1}
                          min={0}
                          max={100}
                          onChange={(e) =>
                            setCotitularField(
                              cot.id,
                              "participacion",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          style={{
                            ...S.input,
                            borderColor: partSuma100 ? "#333" : "#cc000066",
                          }}
                        />
                      </div>
                      <div>
                        {cotitulares.length > 2 && (
                          <button
                            onClick={() => quitarCotitular(cot.id)}
                            style={{
                              background: "#7f1d1d22",
                              border: "1px solid #cc000044",
                              borderRadius: 6,
                              color: "#cc0000",
                              fontSize: 18,
                              width: 34,
                              height: 34,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resultados */}
            {partSuma100 && (
              <>
                {/* Cuota total KPI */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      background: "#111",
                      border: "1px solid #cc000033",
                      borderRadius: 12,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}
                    >
                      Cuota inicial total
                    </div>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: 24,
                        color: "#cc0000",
                      }}
                    >
                      $ {fmt(cuotaTotal)}
                    </div>
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>
                      Sistema francés · {plazoAnios} años
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#111",
                      border: "1px solid #22222",
                      borderRadius: 12,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}
                    >
                      Ingreso total del grupo
                    </div>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: 22,
                        color: "#e0e0e0",
                      }}
                    >
                      $ {fmt(resultadosCotitulares.ingresoTotal)}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "#111",
                      border: "1px solid #222",
                      borderRadius: 12,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}
                    >
                      PTI conjunto
                    </div>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        fontSize: 22,
                        color:
                          resultadosCotitulares.ptiTotal <= 30
                            ? "#22c55e"
                            : resultadosCotitulares.ptiTotal <= 40
                            ? "#f59e0b"
                            : "#cc0000",
                      }}
                    >
                      {fmt(resultadosCotitulares.ptiTotal, 1)}%
                    </div>
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>
                      {resultadosCotitulares.calificaConjunto
                        ? "Califica como conjunto"
                        : "No califica como conjunto"}
                    </div>
                  </div>
                </div>

                {/* Detalle por cotitular */}
                <div style={S.card}>
                  <h2
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#fff",
                      margin: "0 0 16px",
                    }}
                  >
                    Distribución por cotitular
                  </h2>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#0d0d0d" }}>
                          {[
                            "Nombre",
                            "Participación",
                            "Cuota proporcional",
                            "Ingreso",
                            "PTI",
                            "Ingreso mínimo req.",
                            "Estado",
                          ].map((h) => (
                            <th key={h} style={S.thCell}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultadosCotitulares.cotitulares.map((cot, i) => (
                          <tr key={cot.id}>
                            <td style={S.tdCell(i % 2 !== 0)}>
                              <strong style={{ color: "#fff" }}>
                                {cot.nombre}
                              </strong>
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "center",
                              }}
                            >
                              {fmt(cot.participacion, 1)}%
                            </td>
                            <td style={S.tdCell(i % 2 !== 0)}>
                              <span
                                style={{ color: "#cc0000", fontWeight: 700 }}
                              >
                                $ {fmt(cot.cuotaProp)}
                              </span>
                            </td>
                            <td style={S.tdCell(i % 2 !== 0)}>
                              $ {fmt(cot.ingresoMensual)}
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "center",
                              }}
                            >
                              <span
                                style={{
                                  padding: "3px 8px",
                                  borderRadius: 20,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  ...ptiBadge(cot.pti),
                                }}
                              >
                                {fmt(cot.pti, 1)}%
                              </span>
                            </td>
                            <td style={S.tdCell(i % 2 !== 0)}>
                              $ {fmt(cot.ingresoMinimo)}
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "center",
                              }}
                            >
                              <span
                                style={{
                                  padding: "3px 10px",
                                  borderRadius: 20,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: cot.califica
                                    ? "#14532d44"
                                    : "#7f1d1d44",
                                  color: cot.califica ? "#22c55e" : "#cc0000",
                                  border: `1px solid ${
                                    cot.califica ? "#22c55e44" : "#cc000044"
                                  }`,
                                }}
                              >
                                {cot.califica ? "Califica" : "No califica"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Nota PTI */}
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 11,
                      color: "#4b5563",
                      display: "flex",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      PTI = Payment-to-Income (cuota / ingreso mensual neto)
                    </span>
                    <span style={{ color: "#22c55e" }}>● ≤ 30% Califica</span>
                    <span style={{ color: "#f59e0b" }}>
                      ● 30–40% Margen ajustado
                    </span>
                    <span style={{ color: "#cc0000" }}>● &gt;40% No califica</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 1 — Proyección                                               */}
        {/* ================================================================ */}
        {tab === 1 && (
          <>
            {tipoCredito !== "peso_fijo" ? (
              <>
                {/* Tabla proyección UVA */}
                <div style={S.card}>
                  <h2
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#fff",
                      margin: "0 0 4px",
                    }}
                  >
                    Proyección UVA — años 1 a 10
                  </h2>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      margin: "0 0 16px",
                    }}
                  >
                    Inflación anual estimada: {inflacionAnual}% · Cuota en ARS
                    ajustada por UVA
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#0d0d0d" }}>
                          <th style={S.thCell}>Año</th>
                          <th style={{ ...S.thCell, textAlign: "right" }}>
                            Cuota ARS
                          </th>
                          <th style={{ ...S.thCell, textAlign: "right" }}>
                            Capital adeudado
                          </th>
                          <th style={{ ...S.thCell, textAlign: "right" }}>
                            UVAs adeudadas
                          </th>
                          {resultadosCotitulares.cotitulares.map((c) => (
                            <th
                              key={c.id}
                              style={{ ...S.thCell, textAlign: "right" }}
                            >
                              {c.nombre}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {proyeccionUVA.map((fila, i) => (
                          <tr key={fila.anio}>
                            <td style={S.tdCell(i % 2 !== 0)}>
                              <strong>Año {fila.anio}</strong>
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "right",
                                color: "#cc0000",
                                fontWeight: 700,
                              }}
                            >
                              $ {fmt(fila.cuotaARS)}
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "right",
                              }}
                            >
                              $ {fmt(fila.capitalAdeudado)}
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "right",
                                color: "#6b7280",
                              }}
                            >
                              {fmt(fila.uvasAdeudadas, 0)}
                            </td>
                            {resultadosCotitulares.cotitulares.map((c) => (
                              <td
                                key={c.id}
                                style={{
                                  ...S.tdCell(i % 2 !== 0),
                                  textAlign: "right",
                                }}
                              >
                                ${" "}
                                {fmt(fila.cuotaARS * (c.participacion / 100))}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SVG Chart */}
                {svgData && (
                  <div style={S.card}>
                    <h2
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#fff",
                        margin: "0 0 16px",
                      }}
                    >
                      Evolución de cuotas — primeros 10 años
                    </h2>
                    <div style={{ overflowX: "auto" }}>
                      <svg
                        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                        style={{
                          width: "100%",
                          maxWidth: SVG_W,
                          height: "auto",
                          display: "block",
                        }}
                      >
                        {/* Grid lines */}
                        {svgData.yTicks.map((tick, ti) => (
                          <g key={ti}>
                            <line
                              x1={SVG_PAD.left}
                              y1={tick.y}
                              x2={SVG_W - SVG_PAD.right}
                              y2={tick.y}
                              stroke="#1a1a1a"
                              strokeWidth={1}
                            />
                            <text
                              x={SVG_PAD.left - 6}
                              y={tick.y + 4}
                              textAnchor="end"
                              fontSize={9}
                              fill="#4b5563"
                            >
                              {tick.label}
                            </text>
                          </g>
                        ))}
                        {/* X axis labels */}
                        {proyeccionUVA.map((f, i) => (
                          <text
                            key={i}
                            x={svgData.px(i)}
                            y={SVG_H - 10}
                            textAnchor="middle"
                            fontSize={10}
                            fill="#4b5563"
                          >
                            A{f.anio}
                          </text>
                        ))}
                        {/* Lines */}
                        <polyline
                          points={svgData.lineTotal}
                          fill="none"
                          stroke="#cc0000"
                          strokeWidth={2.5}
                        />
                        <polyline
                          points={svgData.lineCot1}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth={1.8}
                          strokeDasharray="5,3"
                        />
                        <polyline
                          points={svgData.lineCot2}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth={1.8}
                          strokeDasharray="5,3"
                        />
                        {/* Dots on total */}
                        {proyeccionUVA.map((f, i) => (
                          <circle
                            key={i}
                            cx={svgData.px(i)}
                            cy={svgData.py(f.cuotaARS)}
                            r={3}
                            fill="#cc0000"
                          />
                        ))}
                      </svg>
                    </div>
                    {/* Legend */}
                    <div
                      style={{
                        display: "flex",
                        gap: 20,
                        marginTop: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {[
                        {
                          color: "#cc0000",
                          label: "Cuota total",
                          dash: false,
                        },
                        {
                          color: "#f97316",
                          label:
                            resultadosCotitulares.cotitulares[0]?.nombre ??
                            "Cotitular 1",
                          dash: true,
                        },
                        {
                          color: "#3b82f6",
                          label:
                            resultadosCotitulares.cotitulares[1]?.nombre ??
                            "Cotitular 2",
                          dash: true,
                        },
                      ].map((l) => (
                        <div
                          key={l.label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: "#9ca3af",
                          }}
                        >
                          <svg width={24} height={8}>
                            <line
                              x1={0}
                              y1={4}
                              x2={24}
                              y2={4}
                              stroke={l.color}
                              strokeWidth={2}
                              strokeDasharray={l.dash ? "4,2" : undefined}
                            />
                          </svg>
                          {l.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Peso fijo: KPIs + tabla amortización */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  {[
                    {
                      label: "Capital total",
                      value: `$ ${fmt(montoCredito)}`,
                      color: "#e0e0e0",
                    },
                    {
                      label: "Interés total pagado",
                      value: `$ ${fmt(interesTotalPesoFijo)}`,
                      color: "#cc0000",
                    },
                    {
                      label: "Costo financiero total",
                      value: `$ ${fmt(cuotaTotal * plazoMeses)}`,
                      color: "#f59e0b",
                    },
                    {
                      label: "Relación interés/capital",
                      value: `${fmt((interesTotalPesoFijo / montoCredito) * 100, 1)}%`,
                      color: "#9ca3af",
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      style={{
                        background: "#111",
                        border: "1px solid #222",
                        borderRadius: 12,
                        padding: 18,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        {kpi.label}
                      </div>
                      <div
                        style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 18,
                          color: kpi.color,
                        }}
                      >
                        {kpi.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={S.card}>
                  <h2
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#fff",
                      margin: "0 0 4px",
                    }}
                  >
                    Tabla de amortización — primeras 24 cuotas
                  </h2>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      margin: "0 0 12px",
                    }}
                  >
                    Cuota fija en pesos · TNA {tasaAnual}%
                  </p>
                  <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ position: "sticky", top: 0 }}>
                        <tr style={{ background: "#0d0d0d" }}>
                          {["#", "Cuota", "Capital", "Interés", "Saldo"].map(
                            (h) => (
                              <th
                                key={h}
                                style={{
                                  ...S.thCell,
                                  textAlign: h === "#" ? "left" : "right",
                                }}
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {tablaAmortizacion.map((fila, i) => (
                          <tr key={i}>
                            <td style={S.tdCell(i % 2 !== 0)}>{i + 1}</td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "right",
                                color: "#cc0000",
                                fontWeight: 700,
                              }}
                            >
                              $ {fmt(fila.cuota)}
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "right",
                                color: "#22c55e",
                              }}
                            >
                              $ {fmt(fila.capital)}
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "right",
                                color: "#f59e0b",
                              }}
                            >
                              $ {fmt(fila.interes)}
                            </td>
                            <td
                              style={{
                                ...S.tdCell(i % 2 !== 0),
                                textAlign: "right",
                                color: "#9ca3af",
                              }}
                            >
                              $ {fmt(fila.saldo)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 2 — Escenarios                                               */}
        {/* ================================================================ */}
        {tab === 2 && (
          <>
            <div style={S.card}>
              <h2
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#fff",
                  margin: "0 0 4px",
                }}
              >
                Comparador de escenarios inflacionarios
              </h2>
              <p
                style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}
              >
                Cuota total proyectada según escenario · Base: cuota inicial ${" "}
                {fmt(cuotaTotal)}
              </p>

              {/* Tabla 4×4 */}
              <div style={{ overflowX: "auto", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0d0d0d" }}>
                      <th style={S.thCell}>Escenario</th>
                      <th style={{ ...S.thCell, textAlign: "center" }}>
                        Inflación/año
                      </th>
                      {PERIODOS.map((p) => (
                        <th
                          key={p}
                          style={{ ...S.thCell, textAlign: "right" }}
                        >
                          Mes {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tablaEscenarios.map((esc, i) => (
                      <tr key={esc.label}>
                        <td style={S.tdCell(i % 2 !== 0)}>
                          <span
                            style={{ color: esc.color, fontWeight: 700 }}
                          >
                            {esc.label}
                          </span>
                        </td>
                        <td
                          style={{
                            ...S.tdCell(i % 2 !== 0),
                            textAlign: "center",
                          }}
                        >
                          {esc.inflacion}%
                        </td>
                        {esc.cuotas.map((c, ci) => (
                          <td
                            key={ci}
                            style={{
                              ...S.tdCell(i % 2 !== 0),
                              textAlign: "right",
                              color: esc.color,
                              fontWeight: ci === 3 ? 700 : 400,
                            }}
                          >
                            $ {fmt(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Barras SVG horizontales — cuota a 5 años */}
              <h3
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#fff",
                  margin: "0 0 14px",
                }}
              >
                Cuota a 5 años por escenario
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {tablaEscenarios.map((esc) => {
                  const val = esc.cuotas[3];
                  const pct = maxCuota5a > 0 ? (val / maxCuota5a) * 100 : 0;
                  return (
                    <div key={esc.label}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: esc.color, fontWeight: 700 }}>
                          {esc.label} ({esc.inflacion}%/año)
                        </span>
                        <span style={{ color: "#e0e0e0", fontWeight: 700 }}>
                          $ {fmt(val)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 22,
                          background: "#0a0a0a",
                          borderRadius: 4,
                          overflow: "hidden",
                          border: "1px solid #222",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: esc.color,
                            opacity: 0.75,
                            borderRadius: 4,
                            transition: "width 0.3s",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Distribución por cotitular en cada escenario */}
            {partSuma100 && (
              <div style={S.card}>
                <h2
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#fff",
                    margin: "0 0 16px",
                  }}
                >
                  Cuota a 5 años por cotitular y escenario
                </h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#0d0d0d" }}>
                        <th style={S.thCell}>Cotitular</th>
                        {tablaEscenarios.map((e) => (
                          <th
                            key={e.label}
                            style={{ ...S.thCell, textAlign: "right" }}
                          >
                            <span style={{ color: e.color }}>{e.label}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosCotitulares.cotitulares.map((cot, i) => (
                        <tr key={cot.id}>
                          <td style={S.tdCell(i % 2 !== 0)}>
                            <strong style={{ color: "#fff" }}>
                              {cot.nombre}
                            </strong>
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 11,
                                color: "#4b5563",
                              }}
                            >
                              {cot.participacion}%
                            </span>
                          </td>
                          {tablaEscenarios.map((esc) => {
                            const cuota5a =
                              esc.cuotas[3] * (cot.participacion / 100);
                            const pti =
                              cot.ingresoMensual > 0
                                ? (cuota5a / cot.ingresoMensual) * 100
                                : 999;
                            return (
                              <td
                                key={esc.label}
                                style={{
                                  ...S.tdCell(i % 2 !== 0),
                                  textAlign: "right",
                                }}
                              >
                                <div
                                  style={{ color: esc.color, fontWeight: 700 }}
                                >
                                  $ {fmt(cuota5a)}
                                </div>
                                <div style={{ fontSize: 10, color: "#4b5563" }}>
                                  PTI:{" "}
                                  <span
                                    style={{
                                      color:
                                        pti <= 30
                                          ? "#22c55e"
                                          : pti <= 40
                                          ? "#f59e0b"
                                          : "#cc0000",
                                    }}
                                  >
                                    {fmt(pti, 1)}%
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div
              style={{
                background: "#1c1107",
                border: "1px solid #f9731644",
                borderRadius: 8,
                padding: "12px 16px",
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              <strong style={{ color: "#f97316" }}>Aviso:</strong> Las
              proyecciones son estimativas y asumen inflación constante. Las
              cuotas UVA se ajustan por CER (coeficiente de estabilización de
              referencia). Consultar con su banco o entidad financiera para
              condiciones actualizadas.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
