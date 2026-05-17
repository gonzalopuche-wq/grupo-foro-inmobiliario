"use client";

import { useState, useMemo } from "react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Banco {
  id: string;
  nombre: string;
  tna: number;
  uva: boolean;
  spread: number;
  plazoMaxAnios: number;
  financiacion: number;
  gastos: number;
  ingresosRequeridos: number;
}

interface ResultadoBanco {
  banco: Banco;
  cuotaInicial: number;
  totalPagado: number;
  gastosIniciales: number;
  ingresoMinimo: number;
  montoMaxFinanciable: number;
  elegible: boolean;
  ranking: number;
}

interface ResultadoCapacidad {
  banco: Banco;
  cuotaMaxima: number;
  prestamoMaximo: number;
  propiedadMaxUSD: number;
}

type TabId = "comparar" | "proyeccion" | "capacidad";

// ── Datos ─────────────────────────────────────────────────────────────────────

const BANCOS: Banco[] = [
  { id: "nacion",      nombre: "Banco Nación",      tna:  0,    uva: true,  spread: 5.5, plazoMaxAnios: 30, financiacion: 75, gastos: 3.5, ingresosRequeridos: 0.25 },
  { id: "provincia",   nombre: "Banco Provincia",   tna:  0,    uva: true,  spread: 6.0, plazoMaxAnios: 30, financiacion: 80, gastos: 3.0, ingresosRequeridos: 0.25 },
  { id: "hipotecario", nombre: "Banco Hipotecario", tna:  0,    uva: true,  spread: 6.5, plazoMaxAnios: 20, financiacion: 75, gastos: 3.8, ingresosRequeridos: 0.30 },
  { id: "ciudad",      nombre: "Banco Ciudad",      tna:  0,    uva: true,  spread: 5.0, plazoMaxAnios: 30, financiacion: 80, gastos: 3.2, ingresosRequeridos: 0.25 },
  { id: "santander",   nombre: "Santander",          tna:  0,    uva: true,  spread: 7.0, plazoMaxAnios: 20, financiacion: 70, gastos: 4.0, ingresosRequeridos: 0.30 },
  { id: "macro",       nombre: "Banco Macro",        tna:  0,    uva: true,  spread: 7.5, plazoMaxAnios: 20, financiacion: 70, gastos: 3.5, ingresosRequeridos: 0.30 },
  { id: "bbva",        nombre: "BBVA",               tna:  0,    uva: true,  spread: 6.8, plazoMaxAnios: 20, financiacion: 75, gastos: 3.5, ingresosRequeridos: 0.25 },
  { id: "icbc",        nombre: "ICBC",               tna: 58.0,  uva: false, spread: 0,   plazoMaxAnios: 10, financiacion: 60, gastos: 4.5, ingresosRequeridos: 0.35 },
];

const COLORES_LINEA = ["#cc0000", "#4a9eff", "#22c55e", "#f59e0b"];

// ── Formateo ──────────────────────────────────────────────────────────────────

const fmtARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const fmtNum = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

// ── Cálculos ──────────────────────────────────────────────────────────────────

function calcularResultado(
  banco: Banco,
  monto: number,
  plazoAnios: number,
  valorPropiedadARS: number,
  inflacionAnual: number,
  valorUVA: number
): Omit<ResultadoBanco, "ranking"> {
  const n = Math.min(plazoAnios, banco.plazoMaxAnios) * 12;
  const gastosIniciales = monto * (banco.gastos / 100);
  const montoMaxFinanciable = valorPropiedadARS * (banco.financiacion / 100);
  const elegible = monto <= montoMaxFinanciable;

  let cuotaInicial = 0;
  let totalPagado = 0;

  if (banco.uva) {
    const tasaMensualReal = Math.pow(1 + banco.spread / 100, 1 / 12) - 1;
    const montoUVA = monto / valorUVA;
    cuotaInicial =
      tasaMensualReal === 0
        ? (montoUVA / n) * valorUVA
        : (montoUVA * tasaMensualReal) /
          (1 - Math.pow(1 + tasaMensualReal, -n)) *
          valorUVA;

    // Proyectar cuotas con inflación anual
    const mesesPorAnio = 12;
    let total = 0;
    for (let anio = 0; anio < Math.min(plazoAnios, banco.plazoMaxAnios); anio++) {
      const factorInflacion = Math.pow(1 + inflacionAnual / 100, anio);
      const cuotaEsteAnio = cuotaInicial * factorInflacion;
      total += cuotaEsteAnio * mesesPorAnio;
    }
    totalPagado = total + gastosIniciales;
  } else {
    const tasaMensual = Math.pow(1 + banco.tna / 100, 1 / 12) - 1;
    cuotaInicial =
      tasaMensual === 0
        ? monto / n
        : (monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
    totalPagado = cuotaInicial * n + gastosIniciales;
  }

  const ingresoMinimo = cuotaInicial / banco.ingresosRequeridos;

  return {
    banco,
    cuotaInicial,
    totalPagado,
    gastosIniciales,
    ingresoMinimo,
    montoMaxFinanciable,
    elegible,
  };
}

function calcularCuotaProyectada(
  banco: Banco,
  monto: number,
  plazoAnios: number,
  inflacionAnual: number,
  valorUVA: number,
  anio: number
): number {
  const n = Math.min(plazoAnios, banco.plazoMaxAnios) * 12;

  if (banco.uva) {
    const tasaMensualReal = Math.pow(1 + banco.spread / 100, 1 / 12) - 1;
    const montoUVA = monto / valorUVA;
    const cuotaInicial =
      tasaMensualReal === 0
        ? (montoUVA / n) * valorUVA
        : (montoUVA * tasaMensualReal) /
          (1 - Math.pow(1 + tasaMensualReal, -n)) *
          valorUVA;
    return cuotaInicial * Math.pow(1 + inflacionAnual / 100, anio);
  } else {
    const tasaMensual = Math.pow(1 + banco.tna / 100, 1 / 12) - 1;
    return tasaMensual === 0
      ? monto / n
      : (monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
  }
}

function calcularCapacidad(
  banco: Banco,
  ingresoMensual: number,
  plazoAnios: number,
  valorUVA: number,
  tipoCambio: number
): ResultadoCapacidad {
  const n = Math.min(plazoAnios, banco.plazoMaxAnios) * 12;
  const cuotaMaxima = ingresoMensual * banco.ingresosRequeridos;

  let prestamoMaximo = 0;

  if (banco.uva) {
    const tasaMensualReal = Math.pow(1 + banco.spread / 100, 1 / 12) - 1;
    if (tasaMensualReal === 0) {
      prestamoMaximo = (cuotaMaxima / valorUVA) * n * valorUVA;
    } else {
      const cuotaEnUVA = cuotaMaxima / valorUVA;
      prestamoMaximo =
        (cuotaEnUVA / tasaMensualReal) *
        (1 - Math.pow(1 + tasaMensualReal, -n)) *
        valorUVA;
    }
  } else {
    const tasaMensual = Math.pow(1 + banco.tna / 100, 1 / 12) - 1;
    if (tasaMensual === 0) {
      prestamoMaximo = cuotaMaxima * n;
    } else {
      prestamoMaximo =
        (cuotaMaxima / tasaMensual) *
        (1 - Math.pow(1 + tasaMensual, -n));
    }
  }

  const propiedadMaxUSD = prestamoMaximo / (banco.financiacion / 100) / tipoCambio;

  return { banco, cuotaMaxima, prestamoMaximo, propiedadMaxUSD };
}

// ── Estilos base ──────────────────────────────────────────────────────────────

const s = {
  page: {
    backgroundColor: "#0a0a0a",
    minHeight: "100vh",
    padding: "32px 24px",
    fontFamily: "Inter, sans-serif",
    color: "#fff",
  } as React.CSSProperties,

  header: {
    marginBottom: 32,
  } as React.CSSProperties,

  h1: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 800,
    fontSize: 28,
    color: "#fff",
    margin: 0,
    marginBottom: 8,
  } as React.CSSProperties,

  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    margin: 0,
  } as React.CSSProperties,

  section: {
    backgroundColor: "#111",
    border: "1px solid #222",
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  } as React.CSSProperties,

  sectionTitle: {
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: 16,
    margin: "0 0 16px 0",
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 16,
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 6,
    fontWeight: 500,
  } as React.CSSProperties,

  input: {
    width: "100%",
    backgroundColor: "#111",
    border: "1px solid #333",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    padding: "8px 12px",
    boxSizing: "border-box" as const,
    outline: "none",
  } as React.CSSProperties,

  tabBar: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  tableWrap: {
    overflowX: "auto" as const,
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  } as React.CSSProperties,

  th: {
    textAlign: "left" as const,
    padding: "10px 12px",
    color: "rgba(255,255,255,0.5)",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    borderBottom: "1px solid #222",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #1a1a1a",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
} as const;

// ── Componentes auxiliares ────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 20px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        fontFamily: "Inter, sans-serif",
        fontSize: 14,
        fontWeight: 600,
        backgroundColor: active ? "#cc0000" : "#1a1a1a",
        color: active ? "#fff" : "rgba(255,255,255,0.6)",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function Badge({ uva }: { uva: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        backgroundColor: uva ? "#cc0000" : "#333",
        color: uva ? "#fff" : "rgba(255,255,255,0.7)",
        letterSpacing: "0.04em",
      }}
    >
      {uva ? "UVA" : "Fijo"}
    </span>
  );
}

function InputField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        style={s.input}
      />
    </div>
  );
}

// ── Tab Comparar ──────────────────────────────────────────────────────────────

function TabComparar({ resultados }: { resultados: ResultadoBanco[] }) {
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            {[
              "Banco",
              "Tipo",
              "Cuota inicial",
              "Total pagado",
              "Gastos",
              "Ingreso mínimo",
              "Financiación",
              "Estado",
            ].map((col) => (
              <th key={col} style={s.th}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => {
            const isBest = r.ranking === 1;
            const rowStyle: React.CSSProperties = {
              ...s.td,
              ...(isBest
                ? {
                    boxShadow: "inset 3px 0 0 #cc0000",
                    backgroundColor: "rgba(204,0,0,0.05)",
                  }
                : {}),
            };
            return (
              <tr key={r.banco.id}>
                <td style={rowStyle}>
                  <span
                    style={{
                      fontWeight: isBest ? 700 : 400,
                      color: isBest ? "#fff" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {isBest ? "★ " : ""}
                    {r.banco.nombre}
                  </span>
                </td>
                <td style={{ ...s.td }}>
                  <Badge uva={r.banco.uva} />
                </td>
                <td style={{ ...s.td, color: "#fff", fontWeight: 600 }}>
                  {fmtARS.format(r.cuotaInicial)}
                </td>
                <td style={{ ...s.td, color: "rgba(255,255,255,0.75)" }}>
                  {fmtARS.format(r.totalPagado)}
                </td>
                <td style={{ ...s.td, color: "rgba(255,255,255,0.75)" }}>
                  {fmtARS.format(r.gastosIniciales)}
                </td>
                <td style={{ ...s.td, color: "rgba(255,255,255,0.75)" }}>
                  {fmtARS.format(r.ingresoMinimo)}
                </td>
                <td style={{ ...s.td, color: "rgba(255,255,255,0.75)" }}>
                  {r.banco.financiacion}%
                </td>
                <td style={{ ...s.td }}>
                  {r.elegible ? (
                    <span
                      style={{
                        color: "#22c55e",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      ✓ Elegible
                    </span>
                  ) : (
                    <span
                      style={{
                        color: "#ef4444",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      ✗ No elegible
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab Proyección ────────────────────────────────────────────────────────────

function TabProyeccion({
  resultados,
  monto,
  plazoAnios,
  inflacionAnual,
  valorUVA,
}: {
  resultados: ResultadoBanco[];
  monto: number;
  plazoAnios: number;
  inflacionAnual: number;
  valorUVA: number;
}) {
  const TOP = 4;
  const bancosGraf = resultados.slice(0, TOP);

  const W = 900;
  const H = 280;
  const PAD = { top: 20, right: 20, bottom: 40, left: 90 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const ANOS = 10;

  const puntos: { banco: Banco; color: string; valores: number[] }[] =
    bancosGraf.map((r, i) => ({
      banco: r.banco,
      color: COLORES_LINEA[i] ?? "#888",
      valores: Array.from({ length: ANOS + 1 }, (_, anio) =>
        calcularCuotaProyectada(
          r.banco,
          monto,
          plazoAnios,
          inflacionAnual,
          valorUVA,
          anio
        )
      ),
    }));

  const allVals = puntos.flatMap((p) => p.valores).filter((v) => v > 0);
  const minY = 0;
  const maxY = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 1;

  function xPos(anio: number): number {
    return PAD.left + (anio / ANOS) * innerW;
  }

  function yPos(val: number): number {
    return PAD.top + innerH - ((val - minY) / (maxY - minY)) * innerH;
  }

  function toPath(valores: number[]): string {
    return valores
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(v).toFixed(1)}`)
      .join(" ");
  }

  const yTicks = 5;
  const yTickVals = Array.from(
    { length: yTicks },
    (_, i) => minY + ((maxY - minY) * i) / (yTicks - 1)
  );

  return (
    <div>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 0 }}>
        Evolución de la cuota mensual (primeros 10 años). Para préstamos UVA la
        cuota crece con la inflación proyectada.
      </p>
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", maxWidth: W, display: "block" }}
        >
          {/* Grilla */}
          {yTickVals.map((val, i) => {
            const y = yPos(val);
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  stroke="#222"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.4)"
                  fontSize={10}
                >
                  {fmtNum.format(Math.round(val / 1000))}k
                </text>
              </g>
            );
          })}

          {/* Eje X */}
          {Array.from({ length: ANOS + 1 }, (_, i) => (
            <text
              key={i}
              x={xPos(i)}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
              fill="rgba(255,255,255,0.4)"
              fontSize={10}
            >
              {i === 0 ? "Hoy" : `Año ${i}`}
            </text>
          ))}

          {/* Líneas */}
          {puntos.map((p) => (
            <path
              key={p.banco.id}
              d={toPath(p.valores)}
              stroke={p.color}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Puntos */}
          {puntos.map((p) =>
            p.valores.map((v, i) => (
              <circle
                key={`${p.banco.id}-${i}`}
                cx={xPos(i)}
                cy={yPos(v)}
                r={3}
                fill={p.color}
              />
            ))
          )}

          {/* Eje Y label */}
          <text
            x={14}
            y={H / 2}
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize={10}
            transform={`rotate(-90, 14, ${H / 2})`}
          >
            Cuota ARS (miles)
          </text>
        </svg>
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 16 }}>
        {puntos.map((p) => (
          <div
            key={p.banco.id}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 24,
                height: 3,
                backgroundColor: p.color,
                borderRadius: 2,
              }}
            />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              {p.banco.nombre}{" "}
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                ({p.banco.uva ? "UVA" : "Fijo"})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab Capacidad ─────────────────────────────────────────────────────────────

function TabCapacidad({
  plazoAnios,
  valorUVA,
  tipoCambio,
}: {
  plazoAnios: number;
  valorUVA: number;
  tipoCambio: number;
}) {
  const [ingresoMensual, setIngresoMensual] = useState<number>(500000);

  const resultados: ResultadoCapacidad[] = useMemo(
    () =>
      BANCOS.map((b) =>
        calcularCapacidad(b, ingresoMensual, plazoAnios, valorUVA, tipoCambio)
      ).sort((a, b) => b.prestamoMaximo - a.prestamoMaximo),
    [ingresoMensual, plazoAnios, valorUVA, tipoCambio]
  );

  const maxPrestamo =
    resultados.length > 0 ? resultados[0].prestamoMaximo : 1;

  return (
    <div>
      <div style={{ marginBottom: 24, maxWidth: 300 }}>
        <label style={s.label}>Ingreso mensual disponible (ARS)</label>
        <input
          type="number"
          value={ingresoMensual}
          step={10000}
          min={0}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= 0) setIngresoMensual(v);
          }}
          style={s.input}
        />
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
          Ingresá tu sueldo o ingreso mensual para ver cuánto podés pedir en
          cada banco.
        </p>
      </div>

      {/* Barras */}
      <div style={{ marginBottom: 28 }}>
        {resultados.map((r, i) => {
          const pct = maxPrestamo > 0 ? (r.prestamoMaximo / maxPrestamo) * 100 : 0;
          const color = COLORES_LINEA[i % COLORES_LINEA.length] ?? "#888";
          return (
            <div key={r.banco.id} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.8)",
                    fontWeight: 500,
                  }}
                >
                  {r.banco.nombre}
                </span>
                <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                  {fmtARS.format(r.prestamoMaximo)}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  backgroundColor: "#1a1a1a",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    backgroundColor: color,
                    borderRadius: 4,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {["Banco", "Tipo", "Cuota máxima", "Préstamo máximo", "Prop. máx. (USD)"].map(
                (col) => (
                  <th key={col} style={s.th}>
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.banco.id}>
                <td style={s.td}>{r.banco.nombre}</td>
                <td style={s.td}>
                  <Badge uva={r.banco.uva} />
                </td>
                <td style={{ ...s.td, color: "rgba(255,255,255,0.75)" }}>
                  {fmtARS.format(r.cuotaMaxima)}
                </td>
                <td style={{ ...s.td, fontWeight: 600, color: "#fff" }}>
                  {fmtARS.format(r.prestamoMaximo)}
                </td>
                <td style={{ ...s.td, color: "rgba(255,255,255,0.75)" }}>
                  USD {fmtNum.format(Math.round(r.propiedadMaxUSD))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CompararBancosPage() {
  const [tab, setTab] = useState<TabId>("comparar");

  // Inputs
  const [valorPropiedadUSD, setValorPropiedadUSD] = useState<number>(100000);
  const [tipoCambio, setTipoCambio] = useState<number>(1300);
  const [montoSolicitadoARS, setMontoSolicitadoARS] = useState<number>(
    100000 * 1300 * 0.75
  );
  const [plazoAnios, setPlazoAnios] = useState<number>(20);
  const [inflacionAnual, setInflacionAnual] = useState<number>(80);
  const [valorUVA, setValorUVA] = useState<number>(1200);

  const valorPropiedadARS = valorPropiedadUSD * tipoCambio;

  const resultados: ResultadoBanco[] = useMemo(() => {
    const sinRanking = BANCOS.map((b) =>
      calcularResultado(
        b,
        montoSolicitadoARS,
        plazoAnios,
        valorPropiedadARS,
        inflacionAnual,
        valorUVA
      )
    );

    const ordenados = [...sinRanking].sort(
      (a, b) => a.cuotaInicial - b.cuotaInicial
    );

    return ordenados.map((r, i) => ({ ...r, ranking: i + 1 }));
  }, [
    montoSolicitadoARS,
    plazoAnios,
    valorPropiedadARS,
    inflacionAnual,
    valorUVA,
  ]);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.h1}>Comparador de Préstamos Hipotecarios</h1>
        <p style={s.subtitle}>
          Compará condiciones de créditos UVA y tasa fija entre bancos argentinos
        </p>
      </div>

      {/* Parámetros */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Parámetros del préstamo</p>
        <div style={s.grid}>
          <InputField
            label="Valor propiedad (USD)"
            value={valorPropiedadUSD}
            onChange={(v) => {
              setValorPropiedadUSD(v);
              setMontoSolicitadoARS(v * tipoCambio * 0.75);
            }}
            min={10000}
            step={5000}
          />
          <InputField
            label="Tipo de cambio (ARS/USD)"
            value={tipoCambio}
            onChange={(v) => {
              setTipoCambio(v);
              setMontoSolicitadoARS(valorPropiedadUSD * v * 0.75);
            }}
            min={1}
            step={100}
          />
          <InputField
            label="Monto solicitado (ARS)"
            value={montoSolicitadoARS}
            onChange={setMontoSolicitadoARS}
            min={0}
            step={100000}
          />
          <InputField
            label="Plazo (años)"
            value={plazoAnios}
            onChange={setPlazoAnios}
            min={1}
            max={30}
          />
          <InputField
            label="Inflación anual estimada (%)"
            value={inflacionAnual}
            onChange={setInflacionAnual}
            min={0}
            max={500}
            step={5}
          />
          <InputField
            label="Valor UVA actual (ARS)"
            value={valorUVA}
            onChange={setValorUVA}
            min={1}
            step={10}
          />
        </div>

        {/* Resumen rápido */}
        <div
          style={{
            marginTop: 20,
            padding: "12px 16px",
            backgroundColor: "#0d0d0d",
            borderRadius: 8,
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          {[
            {
              label: "Propiedad en ARS",
              value: fmtARS.format(valorPropiedadARS),
            },
            {
              label: "Monto solicitado",
              value: fmtARS.format(montoSolicitadoARS),
            },
            {
              label: "LTV",
              value: `${((montoSolicitadoARS / valorPropiedadARS) * 100).toFixed(1)}%`,
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 2,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        <TabButton active={tab === "comparar"} onClick={() => setTab("comparar")}>
          Comparar bancos
        </TabButton>
        <TabButton
          active={tab === "proyeccion"}
          onClick={() => setTab("proyeccion")}
        >
          Proyección 10 años
        </TabButton>
        <TabButton
          active={tab === "capacidad"}
          onClick={() => setTab("capacidad")}
        >
          ¿Cuánto puedo pedir?
        </TabButton>
      </div>

      {/* Contenido */}
      <div style={s.section}>
        {tab === "comparar" && <TabComparar resultados={resultados} />}
        {tab === "proyeccion" && (
          <TabProyeccion
            resultados={resultados}
            monto={montoSolicitadoARS}
            plazoAnios={plazoAnios}
            inflacionAnual={inflacionAnual}
            valorUVA={valorUVA}
          />
        )}
        {tab === "capacidad" && (
          <TabCapacidad
            plazoAnios={plazoAnios}
            valorUVA={valorUVA}
            tipoCambio={tipoCambio}
          />
        )}
      </div>

      {/* Disclaimer */}
      <p
        style={{
          color: "rgba(255,255,255,0.25)",
          fontSize: 11,
          textAlign: "center",
          marginTop: 16,
        }}
      >
        Los valores son estimativos. Consultá las condiciones actualizadas
        directamente con cada banco antes de solicitar un crédito.
      </p>
    </div>
  );
}
