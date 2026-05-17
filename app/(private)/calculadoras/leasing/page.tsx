"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Tipos ────────────────────────────────────────────────────────────────────

type TipoTasa = "fija" | "variable";
type Moneda = "USD" | "ARS";
type Tab = "resumen" | "amortizacion" | "comparar";

interface FilaAmortizacion {
  mes: number;
  cuota: number;
  interes: number;
  amortizacion: number;
  saldoDeuda: number;
  equityAcumulado: number;
}

interface ResultadosLeasing {
  entrada: number;
  montoFinanciado: number;
  valorResidual: number;
  baseFinanciar: number;
  tasaMensual: number;
  cuotaMensual: number;
  totalPagado: number;
  costoTotalFinanciamiento: number;
  tasaEfectivaAnual: number;
  tabla: FilaAmortizacion[];
  // Para tasa variable
  cuotasPorAnio: number[];
}

interface DatoPorAnio {
  anio: number;
  intereses: number;
  amortizacion: number;
  equity: number;
  cuotaAnual: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcularTasaMensual(tasaAnualPct: number): number {
  return Math.pow(1 + tasaAnualPct / 100, 1 / 12) - 1;
}

function cuotaFrances(base: number, tasaMensual: number, n: number): number {
  if (tasaMensual === 0) return base / n;
  return (base * tasaMensual * Math.pow(1 + tasaMensual, n)) /
    (Math.pow(1 + tasaMensual, n) - 1);
}

function calcularLeasing(
  valorInmueble: number,
  porcentajeEntrada: number,
  plazoAnios: number,
  tasaAnualPct: number,
  valorResidualPct: number,
  tipoTasa: TipoTasa,
  ajusteAnualVariable: number
): ResultadosLeasing {
  const n = plazoAnios * 12;
  const entrada = valorInmueble * (porcentajeEntrada / 100);
  const montoFinanciado = valorInmueble - entrada;
  const valorResidual = valorInmueble * (valorResidualPct / 100);

  const tasaMensual = calcularTasaMensual(tasaAnualPct);
  // PV del valor residual descontado a la tasa del leasing
  const pvResidual = valorResidual / Math.pow(1 + tasaMensual, n);
  const baseFinanciar = montoFinanciado - pvResidual;

  // Cuotas por año para tasa variable
  const cuotasPorAnio: number[] = [];
  if (tipoTasa === "variable") {
    for (let a = 0; a < plazoAnios; a++) {
      const tasaEsteAnio = tasaAnualPct * Math.pow(1 + ajusteAnualVariable / 100, a);
      const tmEsteAnio = calcularTasaMensual(tasaEsteAnio);
      cuotasPorAnio.push(cuotaFrances(baseFinanciar, tmEsteAnio, n));
    }
  }

  const cuotaMensual = cuotaFrances(baseFinanciar, tasaMensual, n);

  // Tabla de amortización
  const tabla: FilaAmortizacion[] = [];
  let saldo = baseFinanciar;
  let equityAcumulado = entrada;

  for (let mes = 1; mes <= n; mes++) {
    const anioIdx = Math.floor((mes - 1) / 12);
    const cuotaEste =
      tipoTasa === "variable" && cuotasPorAnio.length > 0
        ? (cuotasPorAnio[anioIdx] ?? cuotaMensual)
        : cuotaMensual;

    const tasaEste =
      tipoTasa === "variable"
        ? calcularTasaMensual(
            tasaAnualPct * Math.pow(1 + ajusteAnualVariable / 100, anioIdx)
          )
        : tasaMensual;

    const interes = saldo * tasaEste;
    const amort = cuotaEste - interes;
    saldo = Math.max(saldo - amort, 0);
    equityAcumulado = entrada + (montoFinanciado - pvResidual - saldo);

    tabla.push({
      mes,
      cuota: cuotaEste,
      interes,
      amortizacion: amort,
      saldoDeuda: saldo,
      equityAcumulado,
    });
  }

  const totalCuotas = tabla.reduce((s, r) => s + r.cuota, 0);
  const totalPagado = totalCuotas + valorResidual + entrada;
  const costoTotalFinanciamiento = totalPagado - valorInmueble;
  const tasaEfectivaAnual =
    plazoAnios > 0
      ? Math.pow(totalPagado / valorInmueble, 1 / plazoAnios) - 1
      : 0;

  return {
    entrada,
    montoFinanciado,
    valorResidual,
    baseFinanciar,
    tasaMensual,
    cuotaMensual,
    totalPagado,
    costoTotalFinanciamiento,
    tasaEfectivaAnual,
    tabla,
    cuotasPorAnio,
  };
}

function datosPorAnio(tabla: FilaAmortizacion[], plazoAnios: number): DatoPorAnio[] {
  const anios: DatoPorAnio[] = [];
  for (let a = 0; a < plazoAnios; a++) {
    const inicio = a * 12;
    const fin = inicio + 12;
    const filas = tabla.slice(inicio, fin);
    const intereses = filas.reduce((s, r) => s + r.interes, 0);
    const amortizacion = filas.reduce((s, r) => s + r.amortizacion, 0);
    const equity = filas[filas.length - 1]?.equityAcumulado ?? 0;
    const cuotaAnual = filas.reduce((s, r) => s + r.cuota, 0);
    anios.push({ anio: a + 1, intereses, amortizacion, equity, cuotaAnual });
  }
  return anios;
}

// ── Estilos compartidos ──────────────────────────────────────────────────────

const S = {
  label: {
    fontSize: 11,
    color: "#888",
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: 4,
    display: "block",
  },
  input: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#fff",
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  card: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 10,
    padding: "20px 24px",
  },
};

// ── Formateo ─────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtM(n: number, moneda: Moneda, tipoCambio: number): string {
  if (moneda === "ARS") return `$ ${fmt(n * tipoCambio, 0)}`;
  return `USD ${fmt(n, 0)}`;
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function CalculadoraLeasing() {
  // Inputs
  const [valorInmueble, setValorInmueble] = useState(500000);
  const [porcentajeEntrada, setPorcentajeEntrada] = useState(20);
  const [plazoAnios, setPlazoAnios] = useState(10);
  const [tasaAnualPct, setTasaAnualPct] = useState(8);
  const [valorResidualPct, setValorResidualPct] = useState(10);
  const [tipoTasa, setTipoTasa] = useState<TipoTasa>("fija");
  const [ajusteAnualVariable, setAjusteAnualVariable] = useState(5);
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [tipoCambio, setTipoCambio] = useState(1300);

  // UI state
  const [tabActivo, setTabActivo] = useState<Tab>("resumen");
  const [mostrarTablaCompleta, setMostrarTablaCompleta] = useState(false);
  const [alquilerMensual, setAlquilerMensual] = useState(3000);

  // Cálculos principales
  const res = useMemo(
    () =>
      calcularLeasing(
        valorInmueble,
        porcentajeEntrada,
        plazoAnios,
        tasaAnualPct,
        valorResidualPct,
        tipoTasa,
        ajusteAnualVariable
      ),
    [
      valorInmueble,
      porcentajeEntrada,
      plazoAnios,
      tasaAnualPct,
      valorResidualPct,
      tipoTasa,
      ajusteAnualVariable,
    ]
  );

  const anuales = useMemo(
    () => datosPorAnio(res.tabla, plazoAnios),
    [res.tabla, plazoAnios]
  );

  // Filas de la tabla de amortización a mostrar
  const filasTabla = useMemo(() => {
    if (mostrarTablaCompleta) return res.tabla;
    // Primeros 24 meses + último mes de cada año
    const set = new Set<number>();
    for (let i = 0; i < Math.min(24, res.tabla.length); i++) set.add(i);
    for (let a = 1; a <= plazoAnios; a++) {
      const idx = a * 12 - 1;
      if (idx < res.tabla.length) set.add(idx);
    }
    return Array.from(set)
      .sort((a, b) => a - b)
      .map((i) => res.tabla[i]);
  }, [res.tabla, mostrarTablaCompleta, plazoAnios]);

  // Comparación vs alquiler
  const comparacionAnual = useMemo(() => {
    return anuales.map((a) => {
      const gastoAlquilerAcum =
        alquilerMensual * 12 * a.anio;
      const leasingGastoAcum =
        res.tabla
          .slice(0, a.anio * 12)
          .reduce((s, r) => s + r.cuota, 0) + res.entrada;
      const equityLeasing = res.tabla[a.anio * 12 - 1]?.equityAcumulado ?? 0;
      return {
        anio: a.anio,
        gastoAlquiler: gastoAlquilerAcum,
        gastoLeasing: leasingGastoAcum,
        equityLeasing,
      };
    });
  }, [anuales, alquilerMensual, res]);

  // Breakeven: mes en que equity supera exceso de costo
  const breakevenMes = useMemo(() => {
    for (let i = 0; i < res.tabla.length; i++) {
      const fila = res.tabla[i];
      const gastoAlqAcum = alquilerMensual * (i + 1);
      const gastoCuotaAcum =
        res.tabla.slice(0, i + 1).reduce((s, r) => s + r.cuota, 0) +
        res.entrada;
      if (fila.equityAcumulado >= gastoCuotaAcum - gastoAlqAcum) {
        return i + 1;
      }
    }
    return null;
  }, [res, alquilerMensual]);

  const m = (n: number) => fmtM(n, moneda, tipoCambio);

  // ── SVG barras apiladas ──────────────────────────────────────────────────

  function GraficoBarrasAnuales() {
    const W = 900;
    const H = 250;
    const PAD_L = 60;
    const PAD_B = 40;
    const PAD_T = 20;
    const PAD_R = 20;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_B - PAD_T;

    const maxVal = Math.max(...anuales.map((a) => a.intereses + a.amortizacion));
    const barW = innerW / anuales.length;
    const gap = barW * 0.15;
    const bW = barW - gap * 2;

    function scaleY(v: number): number {
      return innerH - (v / maxVal) * innerH;
    }

    // Grid lines
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
      y: PAD_T + pct * innerH,
      val: maxVal * (1 - pct),
    }));

    return (
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H + 30}`}
        style={{ overflow: "visible" }}
      >
        {/* Grid */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={g.y}
              x2={W - PAD_R}
              y2={g.y}
              stroke="#222"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 6}
              y={g.y + 4}
              textAnchor="end"
              fill="#555"
              fontSize={9}
            >
              {fmt(g.val / 1000, 0)}k
            </text>
          </g>
        ))}

        {/* Barras */}
        {anuales.map((a, i) => {
          const x = PAD_L + i * barW + gap;
          const hInt = (a.intereses / maxVal) * innerH;
          const hAmort = (a.amortizacion / maxVal) * innerH;
          const yAmort = PAD_T + scaleY(a.amortizacion + a.intereses);
          const yInt = PAD_T + scaleY(a.intereses);

          return (
            <g key={i}>
              {/* Amortización (verde) */}
              <rect
                x={x}
                y={yAmort}
                width={bW}
                height={hAmort}
                fill="#22c55e"
                rx={2}
              />
              {/* Intereses (rojo) */}
              <rect
                x={x}
                y={yInt}
                width={bW}
                height={hInt}
                fill="#cc0000"
                rx={0}
              />
              {/* Label año */}
              <text
                x={x + bW / 2}
                y={PAD_T + innerH + 16}
                textAnchor="middle"
                fill="#666"
                fontSize={9}
              >
                A{a.anio}
              </text>
            </g>
          );
        })}

        {/* Eje Y label */}
        <text
          x={8}
          y={PAD_T + innerH / 2}
          fill="#555"
          fontSize={9}
          transform={`rotate(-90,8,${PAD_T + innerH / 2})`}
          textAnchor="middle"
        >
          USD (miles)
        </text>

        {/* Leyenda */}
        <rect x={PAD_L} y={H + 4} width={12} height={10} fill="#cc0000" rx={2} />
        <text x={PAD_L + 16} y={H + 13} fill="#aaa" fontSize={10}>
          Intereses
        </text>
        <rect x={PAD_L + 90} y={H + 4} width={12} height={10} fill="#22c55e" rx={2} />
        <text x={PAD_L + 106} y={H + 13} fill="#aaa" fontSize={10}>
          Amortización de capital
        </text>
      </svg>
    );
  }

  // ── SVG dual line (equity leasing vs alquiler) ───────────────────────────

  function GraficoDualLine() {
    const W = 900;
    const H = 220;
    const PAD_L = 70;
    const PAD_B = 40;
    const PAD_T = 20;
    const PAD_R = 20;
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_B - PAD_T;

    const maxVal = Math.max(
      ...comparacionAnual.map((c) => Math.max(c.equityLeasing, 1))
    );

    function px(anio: number): number {
      return PAD_L + ((anio - 1) / Math.max(plazoAnios - 1, 1)) * innerW;
    }

    function py(val: number): number {
      return PAD_T + innerH - (val / maxVal) * innerH;
    }

    const pathEquity = comparacionAnual
      .map((c, i) => `${i === 0 ? "M" : "L"}${px(c.anio).toFixed(1)},${py(c.equityLeasing).toFixed(1)}`)
      .join(" ");

    const pathAlquiler = comparacionAnual
      .map((c, i) => `${i === 0 ? "M" : "L"}${px(c.anio).toFixed(1)},${py(0).toFixed(1)}`)
      .join(" ");

    const gridVals = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
      y: PAD_T + (1 - p) * innerH,
      val: maxVal * p,
    }));

    return (
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H + 30}`}
        style={{ overflow: "visible" }}
      >
        {gridVals.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={g.y}
              x2={W - PAD_R}
              y2={g.y}
              stroke="#222"
              strokeWidth={1}
            />
            <text x={PAD_L - 6} y={g.y + 4} textAnchor="end" fill="#555" fontSize={9}>
              {fmt(g.val / 1000, 0)}k
            </text>
          </g>
        ))}

        {/* Línea alquiler (siempre 0) */}
        <path
          d={pathAlquiler}
          fill="none"
          stroke="#cc0000"
          strokeWidth={2}
          strokeDasharray="6,3"
        />

        {/* Línea equity leasing */}
        <path d={pathEquity} fill="none" stroke="#22c55e" strokeWidth={2.5} />

        {/* Puntos equity */}
        {comparacionAnual.map((c) => (
          <circle
            key={c.anio}
            cx={px(c.anio)}
            cy={py(c.equityLeasing)}
            r={3}
            fill="#22c55e"
          />
        ))}

        {/* Eje X labels */}
        {comparacionAnual.map((c) => (
          <text
            key={c.anio}
            x={px(c.anio)}
            y={PAD_T + innerH + 16}
            textAnchor="middle"
            fill="#666"
            fontSize={9}
          >
            A{c.anio}
          </text>
        ))}

        {/* Leyenda */}
        <line x1={PAD_L} y1={H + 9} x2={PAD_L + 24} y2={H + 9} stroke="#22c55e" strokeWidth={2.5} />
        <text x={PAD_L + 28} y={H + 13} fill="#aaa" fontSize={10}>
          Equity leasing
        </text>
        <line
          x1={PAD_L + 110}
          y1={H + 9}
          x2={PAD_L + 134}
          y2={H + 9}
          stroke="#cc0000"
          strokeWidth={2}
          strokeDasharray="6,3"
        />
        <text x={PAD_L + 138} y={H + 13} fill="#aaa" fontSize={10}>
          Equity alquiler (= 0)
        </text>
      </svg>
    );
  }

  // ── PDF export ───────────────────────────────────────────────────────────

  function exportarPDF() {
    const win = window.open("", "_blank");
    if (!win) return;
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Leasing Inmobiliario — Resumen</title>
  <style>
    body { font-family: Arial, sans-serif; background: #fff; color: #111; padding: 32px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    p.sub { color: #666; font-size: 12px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
    .card-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .05em; }
    .card-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f5f5f5; padding: 6px 10px; text-align: left; border-bottom: 2px solid #ddd; }
    td { padding: 5px 10px; border-bottom: 1px solid #eee; }
    .red { color: #cc0000; }
    .green { color: #16a34a; }
    footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <h1>Leasing Inmobiliario Comercial</h1>
  <p class="sub">Calculadora Grupo Foro Inmobiliario — ${new Date().toLocaleDateString("es-AR")}</p>

  <div class="grid">
    <div class="card">
      <div class="card-label">Valor inmueble</div>
      <div class="card-value">USD ${fmt(valorInmueble)}</div>
    </div>
    <div class="card">
      <div class="card-label">Entrada (${porcentajeEntrada}%)</div>
      <div class="card-value">USD ${fmt(res.entrada)}</div>
    </div>
    <div class="card">
      <div class="card-label">Monto financiado</div>
      <div class="card-value">USD ${fmt(res.montoFinanciado)}</div>
    </div>
    <div class="card">
      <div class="card-label">Cuota mensual</div>
      <div class="card-value" style="color:#cc0000">USD ${fmt(res.cuotaMensual, 2)}</div>
    </div>
    <div class="card">
      <div class="card-label">Valor residual (${valorResidualPct}%)</div>
      <div class="card-value">USD ${fmt(res.valorResidual)}</div>
    </div>
    <div class="card">
      <div class="card-label">TEA</div>
      <div class="card-value">${fmt(res.tasaEfectivaAnual * 100, 2)}%</div>
    </div>
    <div class="card">
      <div class="card-label">Total pagado</div>
      <div class="card-value">USD ${fmt(res.totalPagado)}</div>
    </div>
    <div class="card">
      <div class="card-label">Costo financiamiento</div>
      <div class="card-value" style="color:#cc0000">USD ${fmt(res.costoTotalFinanciamiento)}</div>
    </div>
    <div class="card">
      <div class="card-label">Plazo</div>
      <div class="card-value">${plazoAnios} años (${plazoAnios * 12} cuotas)</div>
    </div>
  </div>

  <h2 style="font-size:15px;margin-bottom:8px;">Tabla de amortización (resumen anual)</h2>
  <table>
    <thead>
      <tr>
        <th>Año</th>
        <th>Intereses</th>
        <th>Capital amort.</th>
        <th>Equity acumulado</th>
      </tr>
    </thead>
    <tbody>
      ${anuales
        .map(
          (a) => `
      <tr>
        <td>${a.anio}</td>
        <td class="red">USD ${fmt(a.intereses)}</td>
        <td class="green">USD ${fmt(a.amortizacion)}</td>
        <td>USD ${fmt(a.equity)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <footer>Generado por la calculadora de Leasing Inmobiliario — Grupo Foro Inmobiliario</footer>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "10px 20px",
    fontSize: 13,
    fontFamily: "Montserrat, sans-serif",
    fontWeight: 700,
    cursor: "pointer",
    background: "transparent",
    border: "none",
    borderBottom: tabActivo === t ? "2px solid #cc0000" : "2px solid transparent",
    color: tabActivo === t ? "#fff" : "#666",
    transition: "all 0.15s",
  });

  const kpiCard = (label: string, value: string, color = "#fff", sub?: string) => (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 10,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#888",
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 800,
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#111",
          borderBottom: "1px solid #222",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/calculadoras"
          style={{ color: "#888", textDecoration: "none", fontSize: 13 }}
        >
          ← Calculadoras
        </Link>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
            }}
          >
            Leasing Inmobiliario Comercial
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Calculadora de cuotas, equity y comparación con alquiler
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Panel de inputs */}
        <div style={S.card}>
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: 12,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Parámetros del leasing
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={S.label}>Valor inmueble (USD)</label>
              <input
                type="number"
                min={0}
                value={valorInmueble}
                onChange={(e) => setValorInmueble(Number(e.target.value))}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Entrada (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={porcentajeEntrada}
                onChange={(e) => setPorcentajeEntrada(Number(e.target.value))}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Plazo (años)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={plazoAnios}
                onChange={(e) => setPlazoAnios(Number(e.target.value))}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Tasa anual nominal (%)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={tasaAnualPct}
                onChange={(e) => setTasaAnualPct(Number(e.target.value))}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Valor residual (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={valorResidualPct}
                onChange={(e) => setValorResidualPct(Number(e.target.value))}
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Tipo de tasa</label>
              <select
                value={tipoTasa}
                onChange={(e) => setTipoTasa(e.target.value as TipoTasa)}
                style={S.input}
              >
                <option value="fija">Fija</option>
                <option value="variable">Variable</option>
              </select>
            </div>
            {tipoTasa === "variable" && (
              <div>
                <label style={S.label}>Ajuste anual variable (%)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={ajusteAnualVariable}
                  onChange={(e) =>
                    setAjusteAnualVariable(Number(e.target.value))
                  }
                  style={S.input}
                />
              </div>
            )}
            <div>
              <label style={S.label}>Moneda</label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as Moneda)}
                style={S.input}
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
            {moneda === "ARS" && (
              <div>
                <label style={S.label}>Tipo de cambio (ARS/USD)</label>
                <input
                  type="number"
                  min={1}
                  value={tipoCambio}
                  onChange={(e) => setTipoCambio(Number(e.target.value))}
                  style={S.input}
                />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            background: "#111",
            border: "1px solid #222",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #222",
              padding: "0 8px",
            }}
          >
            <button style={tabStyle("resumen")} onClick={() => setTabActivo("resumen")}>
              Resumen
            </button>
            <button
              style={tabStyle("amortizacion")}
              onClick={() => setTabActivo("amortizacion")}
            >
              Amortización
            </button>
            <button
              style={tabStyle("comparar")}
              onClick={() => setTabActivo("comparar")}
            >
              Comparar vs Alquiler
            </button>
          </div>

          {/* ── TAB 1: RESUMEN ────────────────────────────────────────────── */}
          {tabActivo === "resumen" && (
            <div style={{ padding: "24px" }}>
              {/* KPI Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 12,
                  marginBottom: 28,
                }}
              >
                {kpiCard(
                  "Cuota mensual",
                  m(res.cuotaMensual),
                  "#cc0000",
                  `Sistema francés${tipoTasa === "variable" ? " · var." : ""}`
                )}
                {kpiCard("Entrada", m(res.entrada), "#f59e0b", `${porcentajeEntrada}% del valor`)}
                {kpiCard(
                  "Valor residual",
                  m(res.valorResidual),
                  "#8b5cf6",
                  `Opción de compra al final — ${valorResidualPct}%`
                )}
                {kpiCard("Total pagado", m(res.totalPagado), "#fff", "Cuotas + entrada + residual")}
                {kpiCard(
                  "Costo financiamiento",
                  m(res.costoTotalFinanciamiento),
                  "#ef4444",
                  "Sobre el valor del inmueble"
                )}
                {kpiCard(
                  "TEA",
                  `${fmt(res.tasaEfectivaAnual * 100, 2)}%`,
                  "#22c55e",
                  "Tasa efectiva anual real"
                )}
              </div>

              {/* Info pills */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 28,
                }}
              >
                {[
                  { label: "Monto financiado", val: m(res.montoFinanciado) },
                  { label: "Base a financiar (neto residual)", val: m(res.baseFinanciar) },
                  { label: "Plazo", val: `${plazoAnios} años / ${plazoAnios * 12} cuotas` },
                  { label: "Tasa nominal anual", val: `${fmt(tasaAnualPct, 2)}%` },
                  { label: "Tasa mensual equiv.", val: `${fmt(res.tasaMensual * 100, 4)}%` },
                ].map((pill) => (
                  <div
                    key={pill.label}
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #2a2a2a",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 11,
                      color: "#aaa",
                    }}
                  >
                    <span style={{ color: "#555" }}>{pill.label}: </span>
                    <span style={{ color: "#ddd", fontWeight: 600 }}>{pill.val}</span>
                  </div>
                ))}
              </div>

              {/* Gráfico */}
              <div>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 12,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Composición de la cuota por año — intereses vs capital
                </h3>
                <GraficoBarrasAnuales />
              </div>

              {/* Botón PDF */}
              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={exportarPDF}
                  style={{
                    background: "#cc0000",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    padding: "10px 24px",
                    fontSize: 13,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  Exportar PDF
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 2: AMORTIZACIÓN ───────────────────────────────────────── */}
          {tabActivo === "amortizacion" && (
            <div style={{ padding: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Tabla de amortización mensual
                </h3>
                <button
                  onClick={() => setMostrarTablaCompleta((v) => !v)}
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: 6,
                    color: "#ccc",
                    padding: "6px 14px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {mostrarTablaCompleta
                    ? "Ver resumen"
                    : `Ver tabla completa (${plazoAnios * 12} filas)`}
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Mes",
                        "Cuota",
                        "Interés",
                        "Capital",
                        "Saldo deuda",
                        "Equity %",
                      ].map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            fontSize: 10,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color: "#666",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "1px solid #222",
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasTabla.map((fila, idx) => {
                      const esFinAnio = fila.mes % 12 === 0;
                      const equityPct = valorInmueble > 0
                        ? (fila.equityAcumulado / valorInmueble) * 100
                        : 0;
                      return (
                        <tr
                          key={fila.mes}
                          style={{
                            background:
                              esFinAnio
                                ? "#1a1a1a"
                                : idx % 2 === 0
                                ? "transparent"
                                : "#0d0d0d",
                          }}
                        >
                          <td
                            style={{
                              padding: "7px 12px",
                              color: esFinAnio ? "#fff" : "#888",
                              fontWeight: esFinAnio ? 700 : 400,
                              borderBottom: "1px solid #1a1a1a",
                              textAlign: "right",
                            }}
                          >
                            {fila.mes}
                            {esFinAnio && (
                              <span
                                style={{
                                  fontSize: 9,
                                  color: "#cc0000",
                                  marginLeft: 4,
                                  fontFamily: "Montserrat, sans-serif",
                                }}
                              >
                                A{fila.mes / 12}
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#ddd",
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {m(fila.cuota)}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#cc0000",
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {m(fila.interes)}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#22c55e",
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {m(fila.amortizacion)}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#aaa",
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {m(fila.saldoDeuda)}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#8b5cf6",
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {fmt(equityPct, 1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr
                      style={{
                        borderTop: "2px solid #333",
                        background: "#1a1a1a",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 11,
                          color: "#fff",
                          textAlign: "right",
                        }}
                        colSpan={1}
                      >
                        TOTALES
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: "#ddd",
                          fontSize: 12,
                        }}
                      >
                        {m(res.tabla.reduce((s, r) => s + r.cuota, 0))}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: "#cc0000",
                          fontSize: 12,
                        }}
                      >
                        {m(res.tabla.reduce((s, r) => s + r.interes, 0))}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: "#22c55e",
                          fontSize: 12,
                        }}
                      >
                        {m(res.tabla.reduce((s, r) => s + r.amortizacion, 0))}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          color: "#555",
                          fontSize: 12,
                        }}
                      >
                        {m(res.valorResidual)}{" "}
                        <span style={{ fontSize: 9, color: "#555" }}>residual</span>
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: "#8b5cf6",
                          fontSize: 12,
                        }}
                      >
                        {fmt(
                          valorInmueble > 0
                            ? ((res.tabla[res.tabla.length - 1]?.equityAcumulado ?? 0) /
                                valorInmueble) *
                                100
                            : 0,
                          1
                        )}
                        %
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!mostrarTablaCompleta && (
                <p
                  style={{
                    fontSize: 11,
                    color: "#555",
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  Mostrando primeros 24 meses + cierre de cada año —{" "}
                  <button
                    onClick={() => setMostrarTablaCompleta(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#cc0000",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: 0,
                    }}
                  >
                    ver tabla completa
                  </button>
                </p>
              )}
            </div>
          )}

          {/* ── TAB 3: COMPARAR VS ALQUILER ───────────────────────────────── */}
          {tabActivo === "comparar" && (
            <div style={{ padding: "24px" }}>
              {/* Input alquiler */}
              <div
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  padding: "16px",
                  marginBottom: 24,
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <label style={S.label}>
                    Alquiler mensual equivalente (USD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={alquilerMensual}
                    onChange={(e) => setAlquilerMensual(Number(e.target.value))}
                    style={{ ...S.input, maxWidth: 200 }}
                  />
                </div>
                {breakevenMes !== null && (
                  <div
                    style={{
                      background: "#22c55e15",
                      border: "1px solid #22c55e44",
                      borderRadius: 8,
                      padding: "12px 16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#22c55e",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Punto de equilibrio
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 800,
                        color: "#22c55e",
                      }}
                    >
                      Mes {breakevenMes} — Año {Math.ceil(breakevenMes / 12)}
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                      El equity del leasing supera el costo extra vs alquiler
                    </div>
                  </div>
                )}
                {breakevenMes === null && (
                  <div
                    style={{
                      background: "#cc000015",
                      border: "1px solid #cc000044",
                      borderRadius: 8,
                      padding: "12px 16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#cc0000",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      Sin breakeven en el plazo dado
                    </div>
                    <div style={{ fontSize: 11, color: "#555" }}>
                      Considerá aumentar el alquiler de referencia
                    </div>
                  </div>
                )}
              </div>

              {/* Gráfico dual line */}
              <div style={{ marginBottom: 24 }}>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 12,
                    fontFamily: "Montserrat, sans-serif",
                    fontWeight: 700,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Equity acumulado: Leasing vs Alquiler
                </h3>
                <GraficoDualLine />
              </div>

              {/* Tabla comparativa por año */}
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Comparativa anual
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Año",
                        "Gasto leasing acum.",
                        "Equity leasing",
                        "Gasto alquiler acum.",
                        "Equity alquiler",
                        "Ventaja leasing",
                      ].map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            fontSize: 10,
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            color: "#666",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "1px solid #222",
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparacionAnual.map((c, idx) => {
                      const ventaja = c.equityLeasing - (c.gastoLeasing - c.gastoAlquiler);
                      const positivo = ventaja >= 0;
                      return (
                        <tr
                          key={c.anio}
                          style={{
                            background:
                              idx % 2 === 0 ? "transparent" : "#0d0d0d",
                          }}
                        >
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#fff",
                              fontWeight: 700,
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {c.anio}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#aaa",
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {m(c.gastoLeasing)}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#22c55e",
                              fontWeight: 700,
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {m(c.equityLeasing)}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#aaa",
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {m(c.gastoAlquiler)}
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: "#cc0000",
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            USD 0
                          </td>
                          <td
                            style={{
                              padding: "7px 12px",
                              textAlign: "right",
                              color: positivo ? "#22c55e" : "#cc0000",
                              fontWeight: 700,
                              borderBottom: "1px solid #1a1a1a",
                            }}
                          >
                            {positivo ? "+" : ""}
                            {m(ventaja)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Nota explicativa */}
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#666",
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: "#888" }}>Metodología:</strong> La
                ventaja del leasing se calcula como el equity acumulado menos el
                exceso de gasto frente al alquiler equivalente. Cuando la
                ventaja es positiva, el leasing es financieramente superior al
                alquiler. No incluye apreciación del inmueble ni efectos
                impositivos.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
