"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function mesesConRendimiento(
  capital: number,
  meta: number,
  ahorroMes: number,
  tasaAnual: number
): number {
  const r = tasaAnual / 100 / 12;
  let saldo = capital;
  for (let m = 0; m < 600; m++) {
    if (saldo >= meta) return m;
    saldo = saldo * (1 + r) + ahorroMes;
  }
  return -1;
}

function mesesATexto(m: number): string {
  if (m < 0) return "No alcanza en 50 años";
  const años = Math.floor(m / 12);
  const meses = m % 12;
  if (años === 0) return `${meses} mes${meses !== 1 ? "es" : ""}`;
  if (meses === 0) return `${años} año${años !== 1 ? "s" : ""}`;
  return `${años} año${años !== 1 ? "s" : ""} ${meses} mes${meses !== 1 ? "es" : ""}`;
}

// ─── Estilos base ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#e5e5e5",
  padding: "7px 10px",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  fontWeight: 600,
  display: "block",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const cardStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: "16px 20px",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 700,
  fontSize: 14,
  color: "#fff",
};

// ─── Heatmap helpers ─────────────────────────────────────────────────────────

function heatColor(meses: number): string {
  if (meses < 0) return "#4b0000";
  if (meses <= 12) return "#14532d";
  if (meses <= 24) return "#166534";
  if (meses <= 36) return "#15803d";
  if (meses <= 48) return "#ca8a04";
  if (meses <= 60) return "#d97706";
  if (meses <= 84) return "#ea580c";
  if (meses <= 120) return "#b91c1c";
  return "#7f1d1d";
}

function heatTextColor(meses: number): string {
  return meses < 0 || meses > 60 ? "#fca5a5" : "#e5e5e5";
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface DataPoint {
  mes: number;
  nominal: number;
  conRend: number;
  meta: number;
  metaMovil: number;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AccesibilidadPage() {
  // ── Inputs ──
  const [ingresoFamiliarNeto, setIngresoFamiliarNeto] = useState(600000);
  const [gastosMensuales, setGastosMensuales] = useState(350000);
  const [ahorroMensualExtra, setAhorroMensualExtra] = useState(0);
  const [valorPropiedadObjetivo, setValorPropiedadObjetivo] = useState(80000);
  const [tipoCambio, setTipoCambio] = useState(1300);
  const [financiacionDisponible, setFinanciacionDisponible] = useState(75);
  const [ahorroActual, setAhorroActual] = useState(0);
  const [tasaRendimientoAhorro, setTasaRendimientoAhorro] = useState(90);
  const [inflacionAnual, setInflacionAnual] = useState(80);

  // ── Tab ──
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // ── Tooltip heatmap ──
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // ─── Cálculos principales ────────────────────────────────────────────────

  const calcs = useMemo(() => {
    const capacidadAhorroMensualARS =
      ingresoFamiliarNeto - gastosMensuales + ahorroMensualExtra;
    const capacidadAhorroMensualUSD = capacidadAhorroMensualARS / tipoCambio;

    const valorPropARS = valorPropiedadObjetivo * tipoCambio;
    const montoNecesarioUSD =
      valorPropiedadObjetivo * (1 - financiacionDisponible / 100);
    const montoNecesarioARS = montoNecesarioUSD * tipoCambio;
    const gastosEscritura = valorPropARS * 0.075;
    const totalNecesario = montoNecesarioARS + gastosEscritura;

    const ahorroActualARS = ahorroActual * tipoCambio;
    const faltante = totalNecesario - ahorroActualARS;

    const mesesSimple =
      capacidadAhorroMensualARS > 0
        ? Math.ceil(Math.max(0, faltante) / capacidadAhorroMensualARS)
        : -1;

    const mesesConRend =
      capacidadAhorroMensualARS > 0
        ? mesesConRendimiento(
            ahorroActualARS,
            totalNecesario,
            capacidadAhorroMensualARS,
            tasaRendimientoAhorro
          )
        : -1;

    const tasaRealAnual =
      ((1 + tasaRendimientoAhorro / 100 / 12) /
        (1 + inflacionAnual / 100 / 12) -
        1) *
      12 *
      100;

    const mesesRealistas =
      capacidadAhorroMensualARS > 0
        ? mesesConRendimiento(
            ahorroActualARS,
            totalNecesario,
            capacidadAhorroMensualARS,
            tasaRealAnual
          )
        : -1;

    const ingresoAnualUSD = (ingresoFamiliarNeto * 12) / tipoCambio;
    const priceToIncome =
      ingresoAnualUSD > 0 ? valorPropiedadObjetivo / ingresoAnualUSD : 0;

    const tasaEstimada = Math.pow(1 + 0.08, 1 / 12) - 1;
    const capitalCred = valorPropARS * (financiacionDisponible / 100);
    const cuotaEstimada =
      tasaEstimada > 0
        ? (capitalCred *
            tasaEstimada *
            Math.pow(1 + tasaEstimada, 300)) /
          (Math.pow(1 + tasaEstimada, 300) - 1)
        : capitalCred / 300;
    const ratioDeuda =
      ingresoFamiliarNeto > 0
        ? (cuotaEstimada / ingresoFamiliarNeto) * 100
        : 0;

    return {
      capacidadAhorroMensualARS,
      capacidadAhorroMensualUSD,
      valorPropARS,
      montoNecesarioUSD,
      montoNecesarioARS,
      gastosEscritura,
      totalNecesario,
      ahorroActualARS,
      faltante,
      mesesSimple,
      mesesConRend,
      mesesRealistas,
      priceToIncome,
      cuotaEstimada,
      ratioDeuda,
      tasaRealAnual,
    };
  }, [
    ingresoFamiliarNeto,
    gastosMensuales,
    ahorroMensualExtra,
    valorPropiedadObjetivo,
    tipoCambio,
    financiacionDisponible,
    ahorroActual,
    tasaRendimientoAhorro,
    inflacionAnual,
  ]);

  // ─── Datos proyección ────────────────────────────────────────────────────

  const proyeccionData = useMemo((): DataPoint[] => {
    const { capacidadAhorroMensualARS, ahorroActualARS, totalNecesario } =
      calcs;
    const mesesMax =
      calcs.mesesSimple > 0 ? Math.ceil(calcs.mesesSimple * 1.2) + 1 : 120;
    const points: DataPoint[] = [];

    const r = tasaRendimientoAhorro / 100 / 12;
    const rReal =
      (1 + tasaRendimientoAhorro / 100 / 12) /
        (1 + inflacionAnual / 100 / 12) -
      1;
    const rInflacion = inflacionAnual / 100 / 12;

    let saldoNominal = ahorroActualARS;
    let saldoRend = ahorroActualARS;
    let metaMovil = totalNecesario;

    for (let m = 0; m <= mesesMax; m++) {
      points.push({
        mes: m,
        nominal: saldoNominal,
        conRend: saldoRend,
        meta: totalNecesario,
        metaMovil: metaMovil,
      });
      saldoNominal += capacidadAhorroMensualARS;
      saldoRend = saldoRend * (1 + r) + capacidadAhorroMensualARS;
      // ahorro real: deflacionado pero meta también sube
      const _ = saldoRend * (1 + rReal); // unused but keep logic correct via metaMovil
      void _;
      metaMovil = metaMovil * (1 + rInflacion);
    }
    return points;
  }, [calcs, tasaRendimientoAhorro, inflacionAnual]);

  // ─── Heatmap escenarios ──────────────────────────────────────────────────

  const heatmapData = useMemo(() => {
    const ingresoBase = ingresoFamiliarNeto;
    const propBase = valorPropiedadObjetivo;
    // 5×5: eje Y ingreso (−30% a +30%), eje X prop (−30% a +30%)
    const factores = [-0.3, -0.15, 0, 0.15, 0.3];
    return factores.map((fy) => {
      const ingreso = ingresoBase * (1 + fy);
      return factores.map((fx) => {
        const prop = propBase * (1 + fx);
        const valARS = prop * tipoCambio;
        const anticipo = valARS * (1 - financiacionDisponible / 100);
        const escritura = valARS * 0.075;
        const meta = anticipo + escritura;
        const ahorroARS = ahorroActual * tipoCambio;
        const falt = meta - ahorroARS;
        const cap = ingreso - gastosMensuales + ahorroMensualExtra;
        if (cap <= 0) return -1;
        return Math.ceil(Math.max(0, falt) / cap);
      });
    });
  }, [
    ingresoFamiliarNeto,
    valorPropiedadObjetivo,
    tipoCambio,
    financiacionDisponible,
    ahorroActual,
    gastosMensuales,
    ahorroMensualExtra,
  ]);

  // ─── SVG Chart ───────────────────────────────────────────────────────────

  const ChartSVG = () => {
    const W = 860;
    const H = 280;
    const PAD = { top: 20, right: 20, bottom: 40, left: 80 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    if (proyeccionData.length < 2) return null;

    const maxMes = proyeccionData[proyeccionData.length - 1].mes;
    const maxVal = Math.max(
      ...proyeccionData.map((d) =>
        Math.max(d.nominal, d.conRend, d.metaMovil)
      )
    );
    const minVal = 0;

    const scaleX = (m: number) => PAD.left + (m / maxMes) * innerW;
    const scaleY = (v: number) =>
      PAD.top + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;

    const polyline = (key: keyof Omit<DataPoint, "mes">) =>
      proyeccionData
        .map((d) => `${scaleX(d.mes)},${scaleY(d[key])}`)
        .join(" ");

    // Área verde: donde conRend >= meta
    const areaPoints = proyeccionData
      .filter((d) => d.conRend >= d.meta)
      .map((d) => ({ x: scaleX(d.mes), y: scaleY(d.conRend) }));

    let areaPath = "";
    if (areaPoints.length > 1) {
      const metaY = scaleY(calcs.totalNecesario);
      areaPath =
        `M ${areaPoints[0].x},${metaY} ` +
        areaPoints.map((p) => `L ${p.x},${p.y}`).join(" ") +
        ` L ${areaPoints[areaPoints.length - 1].x},${metaY} Z`;
    }

    // Cruces con meta
    const cruzaNominal = proyeccionData.find((d) => d.nominal >= d.meta);
    const cruzaRend = proyeccionData.find((d) => d.conRend >= d.meta);

    const ticksY = 5;
    const yTicks = Array.from({ length: ticksY + 1 }, (_, i) => {
      const v = minVal + ((maxVal - minVal) * i) / ticksY;
      return { v, y: scaleY(v) };
    });

    const xTickCount = Math.min(6, maxMes);
    const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => {
      const m = Math.round((maxMes * i) / xTickCount);
      return { m, x: scaleX(m) };
    });

    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {/* Grid lines */}
        {yTicks.map(({ y }, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={y}
            x2={W - PAD.right}
            y2={y}
            stroke="#1f2937"
            strokeWidth={1}
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map(({ v, y }, i) => (
          <text
            key={i}
            x={PAD.left - 8}
            y={y + 4}
            textAnchor="end"
            fontSize={10}
            fill="#6b7280"
          >
            {v >= 1_000_000
              ? `$${(v / 1_000_000).toFixed(1)}M`
              : `$${(v / 1_000).toFixed(0)}k`}
          </text>
        ))}

        {/* X axis labels */}
        {xTicks.map(({ m, x }, i) => (
          <text
            key={i}
            x={x}
            y={H - PAD.bottom + 16}
            textAnchor="middle"
            fontSize={10}
            fill="#6b7280"
          >
            {m}m
          </text>
        ))}

        {/* Área verde */}
        {areaPath && (
          <path d={areaPath} fill="#22c55e" fillOpacity={0.15} />
        )}

        {/* Meta fija roja punteada */}
        <polyline
          points={proyeccionData
            .map((d) => `${scaleX(d.mes)},${scaleY(d.meta)}`)
            .join(" ")}
          fill="none"
          stroke="#cc0000"
          strokeWidth={2}
          strokeDasharray="6 3"
        />

        {/* Meta móvil naranja punteada */}
        <polyline
          points={polyline("metaMovil")}
          fill="none"
          stroke="#f97316"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* Ahorro nominal gris */}
        <polyline
          points={polyline("nominal")}
          fill="none"
          stroke="#6b7280"
          strokeWidth={2}
        />

        {/* Ahorro con rendimiento azul */}
        <polyline
          points={polyline("conRend")}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2.5}
        />

        {/* Marca cruce nominal */}
        {cruzaNominal && (
          <line
            x1={scaleX(cruzaNominal.mes)}
            y1={PAD.top}
            x2={scaleX(cruzaNominal.mes)}
            y2={H - PAD.bottom}
            stroke="#6b7280"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Marca cruce con rendimiento */}
        {cruzaRend && (
          <>
            <line
              x1={scaleX(cruzaRend.mes)}
              y1={PAD.top}
              x2={scaleX(cruzaRend.mes)}
              y2={H - PAD.bottom}
              stroke="#3b82f6"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={scaleX(cruzaRend.mes) + 4}
              y={PAD.top + 12}
              fontSize={10}
              fill="#3b82f6"
            >
              {cruzaRend.mes}m
            </text>
          </>
        )}

        {/* Leyenda */}
        {[
          { color: "#6b7280", label: "Nominal (sin rendimiento)", dash: false },
          { color: "#3b82f6", label: "Con TNA", dash: false },
          { color: "#cc0000", label: "Meta anticipo", dash: true },
          { color: "#f97316", label: "Meta móvil (inflación)", dash: true },
        ].map((l, i) => (
          <g key={i} transform={`translate(${PAD.left + i * 190}, ${H - 10})`}>
            <line
              x1={0}
              y1={0}
              x2={20}
              y2={0}
              stroke={l.color}
              strokeWidth={2}
              strokeDasharray={l.dash ? "4 3" : "none"}
            />
            <text x={24} y={4} fontSize={10} fill="#9ca3af">
              {l.label}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  // ─── Tabla resumen proyección ────────────────────────────────────────────

  const tablaResumen = useMemo(() => {
    const hitos = [12, 24, 36, 48];
    return hitos.map((m) => {
      const d = proyeccionData[Math.min(m, proyeccionData.length - 1)];
      return d
        ? {
            mes: m,
            nominal: d.nominal,
            conRend: d.conRend,
            meta: d.meta,
          }
        : { mes: m, nominal: 0, conRend: 0, meta: calcs.totalNecesario };
    });
  }, [proyeccionData, calcs.totalNecesario]);

  // ─── Semáforo price-to-income ────────────────────────────────────────────

  const { priceToIncome, ratioDeuda } = calcs;

  const ptiColor =
    priceToIncome < 3
      ? "#22c55e"
      : priceToIncome < 6
      ? "#eab308"
      : priceToIncome < 9
      ? "#f97316"
      : "#cc0000";

  const ptiLabel =
    priceToIncome < 3
      ? "Mercado accesible"
      : priceToIncome < 6
      ? "Accesible con esfuerzo"
      : priceToIncome < 9
      ? "Difícil acceso"
      : "Muy difícil acceso";

  const ratioColor =
    ratioDeuda < 25
      ? "#22c55e"
      : ratioDeuda < 33
      ? "#eab308"
      : "#cc0000";

  // ─── Inputs en grid ─────────────────────────────────────────────────────

  const inputs: {
    label: string;
    val: number;
    set: (v: number) => void;
    step?: number;
    unit?: string;
  }[] = [
    {
      label: "Ingreso familiar neto",
      val: ingresoFamiliarNeto,
      set: setIngresoFamiliarNeto,
      unit: "ARS/mes",
    },
    {
      label: "Gastos mensuales fijos",
      val: gastosMensuales,
      set: setGastosMensuales,
      unit: "ARS/mes",
    },
    {
      label: "Ahorro adicional",
      val: ahorroMensualExtra,
      set: setAhorroMensualExtra,
      unit: "ARS/mes",
    },
    {
      label: "Valor propiedad objetivo",
      val: valorPropiedadObjetivo,
      set: setValorPropiedadObjetivo,
      unit: "USD",
    },
    {
      label: "Tipo de cambio",
      val: tipoCambio,
      set: setTipoCambio,
      unit: "ARS/USD",
    },
    {
      label: "Financiación disponible",
      val: financiacionDisponible,
      set: setFinanciacionDisponible,
      step: 5,
      unit: "%",
    },
    {
      label: "Ahorro actual",
      val: ahorroActual,
      set: setAhorroActual,
      unit: "USD",
    },
    {
      label: "Rendimiento ahorro TNA",
      val: tasaRendimientoAhorro,
      set: setTasaRendimientoAhorro,
      step: 5,
      unit: "%",
    },
    {
      label: "Inflación anual esperada",
      val: inflacionAnual,
      set: setInflacionAnual,
      step: 5,
      unit: "%",
    },
  ];

  const heatmapFactors = [-0.3, -0.15, 0, 0.15, 0.3];
  const heatmapPropLabels = heatmapFactors.map((f) =>
    fmt(valorPropiedadObjetivo * (1 + f))
  );
  const heatmapIngLabels = heatmapFactors.map((f) =>
    fmt(ingresoFamiliarNeto * (1 + f))
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "#e5e5e5",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 28,
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
                lineHeight: 1.2,
              }}
            >
              Accesibilidad a la Vivienda
            </h1>
            <p
              style={{
                color: "#6b7280",
                fontSize: 13,
                margin: "6px 0 0",
              }}
            >
              ¿Cuánto tiempo necesitás para comprar una propiedad en Argentina?
            </p>
          </div>
          <Link
            href="/calculadoras"
            style={{
              color: "#6b7280",
              textDecoration: "none",
              fontSize: 13,
              marginTop: 4,
            }}
          >
            ← Calculadoras
          </Link>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            background: "#111",
            border: "1px solid #1f2937",
            borderRadius: 10,
            padding: 4,
            width: "fit-content",
          }}
        >
          {(["Mi situación", "Proyección de ahorro", "Escenarios"] as const).map(
            (t, i) => (
              <button
                key={t}
                onClick={() => setTab(i as 0 | 1 | 2)}
                style={{
                  background: tab === i ? "#cc0000" : "transparent",
                  color: tab === i ? "#fff" : "#9ca3af",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: tab === i ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "Montserrat, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {t}
              </button>
            )
          )}
        </div>

        {/* ═══ TAB 0: Mi situación ═══ */}
        {tab === 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.1fr",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* Panel izquierdo: inputs */}
            <div style={{ ...cardStyle }}>
              <p style={{ ...sectionTitle, marginBottom: 16 }}>Tus datos</p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                {inputs.map((f) => (
                  <div key={f.label}>
                    <label style={labelStyle}>
                      {f.label}
                      {f.unit && (
                        <span
                          style={{
                            fontWeight: 400,
                            color: "#4b5563",
                            marginLeft: 4,
                          }}
                        >
                          ({f.unit})
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={f.val}
                      step={f.step ?? 1000}
                      onChange={(e) => f.set(parseFloat(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Panel derecho: resultados */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Índice de accesibilidad */}
              <div
                style={{
                  ...cardStyle,
                  border: `1px solid ${ptiColor}44`,
                  background: `${ptiColor}0d`,
                }}
              >
                <p
                  style={{
                    ...sectionTitle,
                    marginBottom: 10,
                    color: "#9ca3af",
                    fontWeight: 600,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Índice de Accesibilidad (Price-to-Income)
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 52,
                      color: ptiColor,
                      lineHeight: 1,
                    }}
                  >
                    {priceToIncome.toFixed(1)}
                  </span>
                  <div>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: ptiColor,
                      }}
                    >
                      {ptiLabel}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      años de ingreso para comprar
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    { rango: "<3", label: "Accesible", c: "#22c55e" },
                    { rango: "3-6", label: "Con esfuerzo", c: "#eab308" },
                    { rango: "6-9", label: "Difícil", c: "#f97316" },
                    { rango: ">9", label: "Muy difícil", c: "#cc0000" },
                  ].map((s) => (
                    <span
                      key={s.rango}
                      style={{
                        fontSize: 10,
                        color: s.c,
                        background: `${s.c}22`,
                        borderRadius: 4,
                        padding: "2px 7px",
                        border: `1px solid ${s.c}44`,
                      }}
                    >
                      {s.rango} → {s.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* KPIs */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {/* Capacidad de ahorro */}
                <div style={cardStyle}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Capacidad de ahorro
                  </div>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 18,
                      color:
                        calcs.capacidadAhorroMensualARS > 0
                          ? "#22c55e"
                          : "#cc0000",
                    }}
                  >
                    ${fmt(calcs.capacidadAhorroMensualARS)}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    ARS/mes · USD {fmt(calcs.capacidadAhorroMensualUSD, 0)}
                  </div>
                </div>

                {/* Anticipo necesario */}
                <div style={cardStyle}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Anticipo necesario
                  </div>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 18,
                      color: "#f97316",
                    }}
                  >
                    ${fmt(calcs.totalNecesario / 1_000_000, 1)}M
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    ARS · USD {fmt(calcs.montoNecesarioUSD)} + escritura
                  </div>
                </div>

                {/* Meses nominal */}
                <div style={cardStyle}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Meses para el anticipo (nominal)
                  </div>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 16,
                      color: "#3b82f6",
                    }}
                  >
                    {calcs.mesesSimple < 0
                      ? "No alcanza"
                      : `${calcs.mesesSimple} meses`}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {calcs.mesesSimple >= 0
                      ? mesesATexto(calcs.mesesSimple)
                      : "Capacidad de ahorro negativa"}
                  </div>
                </div>

                {/* Meses realistas */}
                <div style={cardStyle}>
                  <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Meses realistas (real vs inflación)
                  </div>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 16,
                      color:
                        calcs.mesesRealistas < 0 ? "#cc0000" : "#a855f7",
                    }}
                  >
                    {calcs.mesesRealistas < 0
                      ? "No alcanza"
                      : `${calcs.mesesRealistas} meses`}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {calcs.mesesRealistas >= 0
                      ? mesesATexto(calcs.mesesRealistas)
                      : "La inflación supera el rendimiento"}
                  </div>
                </div>
              </div>

              {/* Ratio cuota/ingreso */}
              <div
                style={{
                  ...cardStyle,
                  border: `1px solid ${ratioColor}44`,
                  background: `${ratioColor}0d`,
                }}
              >
                <p
                  style={{
                    ...sectionTitle,
                    marginBottom: 8,
                    color: "#9ca3af",
                    fontWeight: 600,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Ratio cuota / ingreso si tomara crédito
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 800,
                      fontSize: 36,
                      color: ratioColor,
                    }}
                  >
                    {ratioDeuda.toFixed(1)}%
                  </span>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    <div>Cuota estimada: ${fmt(calcs.cuotaEstimada)}/mes</div>
                    <div>
                      {ratioDeuda < 25
                        ? "Dentro del rango recomendado"
                        : ratioDeuda < 33
                        ? "Límite aceptable"
                        : "Alto — banco puede rechazar"}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(ratioDeuda, 100)}%`,
                      background: ratioColor,
                      borderRadius: 3,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#4b5563" }}>
                  <span>0%</span>
                  <span style={{ color: "#22c55e" }}>25% recomendado</span>
                  <span style={{ color: "#f97316" }}>33% límite</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 1: Proyección ═══ */}
        {tab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                ...cardStyle,
                padding: "20px 16px 12px",
              }}
            >
              <p style={{ ...sectionTitle, marginBottom: 16 }}>
                Proyección de ahorro vs meta
              </p>
              <ChartSVG />
            </div>

            {/* Tabla resumen */}
            <div
              style={{
                ...cardStyle,
                padding: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "#1a1a1a",
                  padding: "12px 20px",
                  borderBottom: "1px solid #1f2937",
                }}
              >
                <span style={sectionTitle}>Resumen por período</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#161616" }}>
                      {[
                        "Período",
                        "Ahorro nominal",
                        "Ahorro con TNA",
                        "Meta anticipo",
                        "% de la meta",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 16px",
                            textAlign: "right",
                            color: "#6b7280",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            borderBottom: "1px solid #1f2937",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tablaResumen.map((r, i) => {
                      const pct =
                        r.meta > 0 ? (r.conRend / r.meta) * 100 : 0;
                      return (
                        <tr
                          key={r.mes}
                          style={{
                            background:
                              r.conRend >= r.meta
                                ? "#15803d11"
                                : i % 2 === 0
                                ? "#0f0f0f"
                                : "#111",
                            borderBottom: "1px solid #1f2937",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              color: "#9ca3af",
                              fontWeight: 600,
                            }}
                          >
                            Mes {r.mes}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              color: "#6b7280",
                            }}
                          >
                            ${fmt(r.nominal / 1_000_000, 2)}M
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              color: "#3b82f6",
                              fontWeight: 600,
                            }}
                          >
                            ${fmt(r.conRend / 1_000_000, 2)}M
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              color: "#cc0000",
                            }}
                          >
                            ${fmt(r.meta / 1_000_000, 2)}M
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              color:
                                pct >= 100
                                  ? "#22c55e"
                                  : pct >= 75
                                  ? "#eab308"
                                  : "#cc0000",
                              fontWeight: 700,
                            }}
                          >
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                    {/* Fila meta */}
                    <tr
                      style={{
                        background: "#1a1a1a",
                        borderTop: "2px solid #cc000044",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          color: "#cc0000",
                          fontWeight: 700,
                        }}
                      >
                        META
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          color: "#6b7280",
                        }}
                      >
                        —
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          color: "#6b7280",
                        }}
                      >
                        —
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          color: "#cc0000",
                          fontWeight: 700,
                        }}
                      >
                        ${fmt(calcs.totalNecesario / 1_000_000, 2)}M
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          color: "#cc0000",
                          fontWeight: 700,
                        }}
                      >
                        100%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                color: "#4b5563",
                textAlign: "center",
                padding: "0 0 8px",
              }}
            >
              La meta móvil (naranja) refleja cómo sube el valor de la
              propiedad con la inflación. El ahorro real incluye el
              rendimiento TNA pero deflacionado por inflación.
            </div>
          </div>
        )}

        {/* ═══ TAB 2: Escenarios / Heatmap ═══ */}
        {tab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={cardStyle}>
              <p style={{ ...sectionTitle, marginBottom: 4 }}>
                Meses para alcanzar el anticipo
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  marginBottom: 20,
                }}
              >
                Variando ingreso familiar (±30%) y valor de la propiedad
                (±30%). Asumiendo tasas actuales. El valor real depende de
                la inflación.
              </p>

              {/* Heatmap container */}
              <div style={{ position: "relative" }}>
                {/* Eje X: valor prop */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 6,
                    paddingLeft: 120,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 11,
                      color: "#6b7280",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Valor propiedad (USD)
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    paddingLeft: 120,
                    marginBottom: 4,
                    gap: 4,
                  }}
                >
                  {heatmapPropLabels.map((l, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: 10,
                        color: "#9ca3af",
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {/* Filas */}
                {heatmapData.map((row, ri) => (
                  <div
                    key={ri}
                    style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}
                  >
                    {/* Label ingreso */}
                    <div
                      style={{
                        width: 116,
                        textAlign: "right",
                        paddingRight: 8,
                        fontSize: 10,
                        color: "#9ca3af",
                        flexShrink: 0,
                      }}
                    >
                      {ri === 2 && (
                        <span
                          style={{
                            display: "block",
                            fontSize: 9,
                            color: "#6b7280",
                            marginBottom: 1,
                            textTransform: "uppercase",
                          }}
                        >
                          Ingreso
                        </span>
                      )}
                      ${heatmapIngLabels[ri]}
                    </div>
                    {row.map((meses, ci) => (
                      <div
                        key={ci}
                        onMouseEnter={(e) => {
                          const rect = (
                            e.target as HTMLElement
                          ).getBoundingClientRect();
                          setTooltip({
                            x: rect.left + rect.width / 2,
                            y: rect.top - 8,
                            text:
                              meses < 0
                                ? "No alcanza"
                                : `${meses} meses (${mesesATexto(meses)})`,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          flex: 1,
                          height: 52,
                          background: heatColor(meses),
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "default",
                          border:
                            ri === 2 && ci === 2
                              ? "2px solid #fff"
                              : "1px solid transparent",
                          transition: "transform 0.1s",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: "Montserrat, sans-serif",
                            color: heatTextColor(meses),
                          }}
                        >
                          {meses < 0 ? "∞" : meses}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Tooltip */}
                {tooltip && (
                  <div
                    style={{
                      position: "fixed",
                      left: tooltip.x,
                      top: tooltip.y,
                      transform: "translate(-50%, -100%)",
                      background: "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "#e5e5e5",
                      pointerEvents: "none",
                      zIndex: 9999,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tooltip.text}
                  </div>
                )}
              </div>

              {/* Leyenda heatmap */}
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{ fontSize: 11, color: "#6b7280", marginRight: 4 }}
                >
                  Escala:
                </span>
                {[
                  { label: "0-12m", c: "#14532d" },
                  { label: "13-24m", c: "#15803d" },
                  { label: "25-36m", c: "#ca8a04" },
                  { label: "37-60m", c: "#ea580c" },
                  { label: "61-120m", c: "#b91c1c" },
                  { label: ">120m", c: "#7f1d1d" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        background: s.c,
                        borderRadius: 3,
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {s.label}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    marginLeft: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      background: "transparent",
                      border: "2px solid #fff",
                      borderRadius: 3,
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    Situación actual
                  </span>
                </div>
              </div>

              <p
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: "#4b5563",
                }}
              >
                Nota: Asumiendo tasas actuales. El valor real depende de la
                inflación. El cuadro con borde blanco representa tu
                situación base.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
