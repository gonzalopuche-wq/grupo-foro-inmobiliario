"use client";

import { useState, useMemo } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtUSD = (n: number, d = 2) =>
  `USD ${Math.abs(n).toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;

const fmtPct = (n: number, d = 2) =>
  `${n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}%`;

const fmtNum = (n: number, d = 0) =>
  n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

function calcTIR(flujos: number[]): number {
  // Newton-Raphson
  let tasa = 0.01;
  for (let iter = 0; iter < 200; iter++) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < flujos.length; t++) {
      const v = Math.pow(1 + tasa, t);
      f += flujos[t] / v;
      df -= t * flujos[t] / (v * (1 + tasa));
    }
    if (Math.abs(df) < 1e-12) break;
    const delta = f / df;
    tasa -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return tasa;
}

// ── Types ──────────────────────────────────────────────────────────────────

type MonedaCuotas = "usd" | "ars_ccl" | "mixto";
type AjusteCuotas = "fijo_usd" | "ccl" | "cac";
type TabId = "estructura" | "rentabilidad" | "escenarios";
type AlternativaId = "reventa" | "alquiler";

interface Etapa {
  pct: number;
  label: string;
}

interface CuotaRow {
  mes: number;
  concepto: string;
  cuotaNominal: number;
  cuotaAjustada: number;
  acumulado: number;
  pctTotal: number;
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function InversionPozo() {
  // ── Estado: proyecto ─────────────────────────────────────────────────────
  const [precioTotal, setPrecioTotal] = useState("100000");
  const [monedaCuotas, setMonedaCuotas] = useState<MonedaCuotas>("ars_ccl");
  const [plazoMeses, setPlazoMeses] = useState("30");
  const [fechaInicioMes, setFechaInicioMes] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0")
  );
  const [fechaInicioAnio, setFechaInicioAnio] = useState(
    String(new Date().getFullYear())
  );

  // ── Estado: etapas ───────────────────────────────────────────────────────
  const [etapaBoleto, setEtapaBoleto] = useState<Etapa>({
    pct: 30,
    label: "Boleto/Anticipo",
  });
  const [etapaCuotas, setEtapaCuotas] = useState<Etapa>({
    pct: 50,
    label: "Cuotas en obra",
  });
  const [etapaEntrega, setEtapaEntrega] = useState<Etapa>({
    pct: 20,
    label: "Entrega",
  });
  const [ajuste, setAjuste] = useState<AjusteCuotas>("cac");
  const [tasaCAC, setTasaCAC] = useState("60");
  const [apreciacionCCL, setApreciacionCCL] = useState("3");

  // ── Estado: rentabilidad ─────────────────────────────────────────────────
  const [alternativa, setAlternativa] = useState<AlternativaId>("reventa");
  const [precioReventa, setPrecioReventa] = useState("120000");
  const [costosReventa, setCostosReventa] = useState("5");
  const [alquilerMensual, setAlquilerMensual] = useState("600");
  const [tasaPF, setTasaPF] = useState("8");

  // ── Estado: tabs ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabId>("estructura");

  // ── Cálculo central ──────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const precio = parseFloat(precioTotal) || 0;
    const plazo = Math.max(parseInt(plazoMeses) || 30, 1);
    const pctBoleto = Math.max(0, Math.min(etapaBoleto.pct, 100)) / 100;
    const pctCuotas = Math.max(0, Math.min(etapaCuotas.pct, 100)) / 100;
    const pctEntrega = Math.max(0, 1 - pctBoleto - pctCuotas);

    const montoBoleto = precio * pctBoleto;
    const montoCuotasTotal = precio * pctCuotas;
    const montoEntrega = precio * pctEntrega;
    const cuotaNominal = plazo > 0 ? montoCuotasTotal / plazo : 0;

    const tasaCACAnual = (parseFloat(tasaCAC) || 60) / 100;
    const tasaCACMensual = Math.pow(1 + tasaCACAnual, 1 / 12) - 1;
    const tasaCCLMensual = (parseFloat(apreciacionCCL) || 3) / 100;

    // Flujo de pagos mes a mes (mes 0 = boleto, mes 1..plazo = cuotas, mes plazo = entrega)
    const rows: CuotaRow[] = [];
    let acumulado = 0;

    // Mes 0: boleto
    acumulado += montoBoleto;
    rows.push({
      mes: 0,
      concepto: etapaBoleto.label,
      cuotaNominal: montoBoleto,
      cuotaAjustada: montoBoleto,
      acumulado,
      pctTotal: precio > 0 ? (acumulado / precio) * 100 : 0,
    });

    // Meses 1..plazo: cuotas
    for (let m = 1; m <= plazo; m++) {
      let ajustada = cuotaNominal;
      if (ajuste === "cac") {
        ajustada = cuotaNominal * Math.pow(1 + tasaCACMensual, m - 1);
      } else if (ajuste === "ccl") {
        ajustada = cuotaNominal * Math.pow(1 + tasaCCLMensual, m - 1);
      }
      // Si fijo_usd: ajustada = nominal
      acumulado += ajustada;
      rows.push({
        mes: m,
        concepto: m === plazo ? "Cuota + Entrega" : `Cuota ${m}`,
        cuotaNominal: cuotaNominal + (m === plazo ? montoEntrega : 0),
        cuotaAjustada: ajustada + (m === plazo ? montoEntrega : 0),
        acumulado: acumulado + (m === plazo ? montoEntrega : 0),
        pctTotal:
          precio > 0
            ? ((acumulado + (m === plazo ? montoEntrega : 0)) / precio) * 100
            : 0,
      });
      if (m === plazo) {
        acumulado += montoEntrega;
      }
    }

    // Total real desembolsado (en USD equivalente)
    const totalDesembolsado =
      montoBoleto +
      rows
        .filter((r) => r.mes >= 1 && r.mes <= plazo)
        .reduce(
          (s, r) =>
            s +
            (r.mes === plazo
              ? r.cuotaAjustada - montoEntrega
              : r.cuotaAjustada),
          0
        ) +
      montoEntrega;

    // Flujos para TIR (negativo = salida, positivo = entrada al revender)
    const pr = parseFloat(precioReventa) || precio * 1.2;
    const pctCostos = (parseFloat(costosReventa) || 5) / 100;
    const precioNetoReventa = pr * (1 - pctCostos);

    // Flujos mensuales: mes 0 boleto, mes 1..plazo cuotas ajustadas, mes plazo +entrega +reventa
    const flujosTIR: number[] = [];
    for (let m = 0; m <= plazo; m++) {
      const row = rows.find((r) => r.mes === m);
      if (!row) continue;
      const salida = -(row.cuotaAjustada);
      if (m === plazo) {
        flujosTIR.push(salida + precioNetoReventa);
      } else {
        flujosTIR.push(salida);
      }
    }

    const tirMensual = calcTIR(flujosTIR);
    const tirAnual = Math.pow(1 + tirMensual, 12) - 1;

    const gananciaBruta = precioNetoReventa - totalDesembolsado;
    const roi = totalDesembolsado > 0 ? (gananciaBruta / totalDesembolsado) * 100 : 0;

    // PF USD comparación
    const tasaPFAnual = (parseFloat(tasaPF) || 8) / 100;
    const tasaPFMensual = Math.pow(1 + tasaPFAnual, 1 / 12) - 1;
    // Capital efectivo invertido ponderado por tiempo
    let pfAcum = 0;
    for (const row of rows) {
      const mesesRestantes = plazo - row.mes;
      pfAcum += row.cuotaAjustada * Math.pow(1 + tasaPFMensual, mesesRestantes);
    }
    const gananciaPF = pfAcum - totalDesembolsado;
    const roiPF = totalDesembolsado > 0 ? (gananciaPF / totalDesembolsado) * 100 : 0;

    // Alquiler
    const alquiler = parseFloat(alquilerMensual) || 0;
    const yieldBruto =
      totalDesembolsado > 0 ? ((alquiler * 12) / totalDesembolsado) * 100 : 0;
    const recuperoAnios =
      alquiler > 0 ? totalDesembolsado / (alquiler * 12) : Infinity;

    return {
      precio,
      plazo,
      montoBoleto,
      montoCuotasTotal,
      montoEntrega,
      cuotaNominal,
      rows,
      totalDesembolsado,
      pr,
      precioNetoReventa,
      gananciaBruta,
      roi,
      tirMensual,
      tirAnual,
      gananciaPF,
      roiPF,
      pfAcum,
      alquiler,
      yieldBruto,
      recuperoAnios,
      pctEntrega: pctEntrega * 100,
    };
  }, [
    precioTotal,
    plazoMeses,
    etapaBoleto,
    etapaCuotas,
    etapaEntrega,
    ajuste,
    tasaCAC,
    apreciacionCCL,
    precioReventa,
    costosReventa,
    alquilerMensual,
    tasaPF,
  ]);

  // ── Estilos ───────────────────────────────────────────────────────────────
  const S = {
    page: {
      background: "#0a0a0a",
      color: "#e0e0e0",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif",
      padding: "0 0 60px",
    } as React.CSSProperties,
    header: {
      background: "#111111",
      borderBottom: "1px solid #222222",
      padding: "28px 24px 20px",
    } as React.CSSProperties,
    title: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 800,
      fontSize: "clamp(1.3rem, 3vw, 1.8rem)",
      color: "#cc0000",
      margin: 0,
    } as React.CSSProperties,
    subtitle: {
      color: "#999",
      fontSize: "0.85rem",
      marginTop: 4,
    } as React.CSSProperties,
    tabBar: {
      display: "flex",
      gap: 4,
      padding: "16px 24px 0",
      borderBottom: "1px solid #222222",
      overflowX: "auto" as const,
    } as React.CSSProperties,
    tabBtn: (active: boolean): React.CSSProperties => ({
      background: active ? "#cc0000" : "transparent",
      color: active ? "#fff" : "#999",
      border: active ? "none" : "1px solid #333",
      borderBottom: active ? "1px solid #cc0000" : "1px solid #333",
      borderRadius: "6px 6px 0 0",
      padding: "8px 18px",
      cursor: "pointer",
      fontSize: "0.85rem",
      fontWeight: active ? 700 : 400,
      whiteSpace: "nowrap" as const,
      fontFamily: "'Montserrat', sans-serif",
    }),
    body: {
      padding: "24px 24px",
      maxWidth: 900,
      margin: "0 auto",
    } as React.CSSProperties,
    card: {
      background: "#111111",
      border: "1px solid #222222",
      borderRadius: 10,
      padding: "20px 22px",
      marginBottom: 20,
    } as React.CSSProperties,
    cardTitle: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 700,
      fontSize: "1rem",
      color: "#e0e0e0",
      marginBottom: 16,
      marginTop: 0,
    } as React.CSSProperties,
    grid2: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 16,
    } as React.CSSProperties,
    grid3: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 16,
    } as React.CSSProperties,
    label: {
      display: "block",
      fontSize: "0.78rem",
      color: "#999",
      marginBottom: 5,
    } as React.CSSProperties,
    input: {
      width: "100%",
      background: "#0a0a0a",
      border: "1px solid #333",
      color: "#e0e0e0",
      borderRadius: 6,
      padding: "8px 10px",
      fontSize: "0.9rem",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,
    select: {
      width: "100%",
      background: "#0a0a0a",
      border: "1px solid #333",
      color: "#e0e0e0",
      borderRadius: 6,
      padding: "8px 10px",
      fontSize: "0.9rem",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,
    kpi: {
      background: "#0a0a0a",
      border: "1px solid #222",
      borderRadius: 8,
      padding: "14px 16px",
      textAlign: "center" as const,
    } as React.CSSProperties,
    kpiLabel: {
      fontSize: "0.74rem",
      color: "#888",
      marginBottom: 6,
      textTransform: "uppercase" as const,
      letterSpacing: "0.04em",
    } as React.CSSProperties,
    kpiValue: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 700,
      fontSize: "1.15rem",
      color: "#e0e0e0",
    } as React.CSSProperties,
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      fontSize: "0.8rem",
    } as React.CSSProperties,
    th: {
      background: "#0a0a0a",
      color: "#888",
      padding: "7px 10px",
      textAlign: "left" as const,
      borderBottom: "1px solid #222",
      fontWeight: 600,
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,
    td: {
      padding: "6px 10px",
      borderBottom: "1px solid #1a1a1a",
      color: "#d0d0d0",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,
    sectionTitle: {
      fontFamily: "'Montserrat', sans-serif",
      fontWeight: 700,
      fontSize: "0.9rem",
      color: "#cc0000",
      marginBottom: 12,
      marginTop: 0,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
    } as React.CSSProperties,
    divider: {
      border: "none",
      borderTop: "1px solid #222",
      margin: "20px 0",
    } as React.CSSProperties,
    row: {
      display: "flex",
      gap: 12,
      alignItems: "flex-end",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    toggleGroup: {
      display: "flex",
      gap: 4,
    } as React.CSSProperties,
    toggleBtn: (active: boolean): React.CSSProperties => ({
      background: active ? "#cc0000" : "#1a1a1a",
      color: active ? "#fff" : "#999",
      border: "1px solid #333",
      borderRadius: 5,
      padding: "7px 14px",
      cursor: "pointer",
      fontSize: "0.82rem",
      fontWeight: active ? 700 : 400,
    }),
  };

  // ── Fechas de obra ────────────────────────────────────────────────────────
  const mesNombres = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  const anioActual = new Date().getFullYear();

  // ── Gráfico Tab 1 ─────────────────────────────────────────────────────────
  const Chart1 = () => {
    const W = 720;
    const H = 260;
    const PL = 60;
    const PR = 20;
    const PT = 20;
    const PB = 40;
    const innerW = W - PL - PR;
    const innerH = H - PT - PB;

    const { rows, precio, totalDesembolsado } = calc;
    const maxVal = Math.max(precio * 1.05, totalDesembolsado * 1.05, 1);
    const maxAcum = Math.max(...rows.map((r) => r.acumulado), 1);
    const scaleY = (v: number) => innerH - (v / Math.max(maxAcum, maxVal)) * innerH;

    const barW = Math.max(2, Math.floor(innerW / (rows.length + 1)) - 2);

    const acumPts = rows
      .map((r, i) => {
        const x = PL + (i / (rows.length - 1 || 1)) * innerW;
        const y = PT + scaleY(r.acumulado);
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block", maxWidth: W }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const yv = PT + frac * innerH;
            const val = (1 - frac) * Math.max(maxAcum, maxVal);
            return (
              <g key={frac}>
                <line
                  x1={PL}
                  y1={yv}
                  x2={PL + innerW}
                  y2={yv}
                  stroke="#222"
                  strokeWidth={1}
                />
                <text
                  x={PL - 5}
                  y={yv + 4}
                  textAnchor="end"
                  fill="#555"
                  fontSize={9}
                >
                  {fmtNum(val / 1000, 0)}k
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {rows.map((r, i) => {
            const bH = (r.cuotaAjustada / Math.max(maxAcum, maxVal)) * innerH;
            const x = PL + i * ((innerW - barW) / Math.max(rows.length - 1, 1));
            const y = PT + innerH - bH;
            return (
              <rect
                key={i}
                x={x - barW / 2}
                y={y}
                width={barW}
                height={Math.max(1, bH)}
                fill="#880000"
                opacity={0.85}
              />
            );
          })}

          {/* Línea precio total */}
          <line
            x1={PL}
            y1={PT + scaleY(precio)}
            x2={PL + innerW}
            y2={PT + scaleY(precio)}
            stroke="#555"
            strokeWidth={1}
            strokeDasharray="4,3"
          />
          <text
            x={PL + innerW - 4}
            y={PT + scaleY(precio) - 4}
            fill="#666"
            fontSize={9}
            textAnchor="end"
          >
            Precio total
          </text>

          {/* Línea acumulado */}
          {rows.length > 1 && (
            <polyline
              points={acumPts}
              fill="none"
              stroke="#ff8800"
              strokeWidth={2}
            />
          )}

          {/* Eje X: algunos labels */}
          {rows
            .filter((_, i) => i % Math.max(1, Math.floor(rows.length / 6)) === 0)
            .map((r) => {
              const i = rows.indexOf(r);
              const x =
                PL + i * ((innerW - barW) / Math.max(rows.length - 1, 1));
              return (
                <text
                  key={i}
                  x={x}
                  y={H - PB + 14}
                  textAnchor="middle"
                  fill="#555"
                  fontSize={9}
                >
                  M{r.mes}
                </text>
              );
            })}

          {/* Leyenda */}
          <rect x={PL} y={H - 12} width={10} height={8} fill="#880000" opacity={0.85} />
          <text x={PL + 14} y={H - 5} fill="#888" fontSize={9}>Cuota ajustada</text>
          <line x1={PL + 95} y1={H - 8} x2={PL + 110} y2={H - 8} stroke="#ff8800" strokeWidth={2} />
          <text x={PL + 114} y={H - 5} fill="#888" fontSize={9}>Acumulado</text>
          <line x1={PL + 175} y1={H - 8} x2={PL + 190} y2={H - 8} stroke="#555" strokeWidth={1} strokeDasharray="4,3" />
          <text x={PL + 194} y={H - 5} fill="#888" fontSize={9}>Precio total</text>
        </svg>
      </div>
    );
  };

  // ── Gráfico Tab 2: barras horizontales ────────────────────────────────────
  const Chart2 = () => {
    const { gananciaBruta, gananciaPF, totalDesembolsado, alquiler, plazo } =
      calc;
    const gananciaAlquiler = alquiler * plazo;
    const maxVal = Math.max(
      Math.abs(gananciaBruta),
      Math.abs(gananciaPF),
      Math.abs(gananciaAlquiler),
      1
    );
    const W = 500;
    const rowH = 36;
    const H = rowH * 3 + 20;
    const LABEL = 80;
    const BAR_MAX = W - LABEL - 40;

    const escenarios = [
      { label: "Reventa", val: gananciaBruta, color: "#cc0000" },
      { label: "Alquiler", val: gananciaAlquiler, color: "#0077cc" },
      { label: "PF USD", val: gananciaPF, color: "#336633" },
    ];

    return (
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: W }}>
          {escenarios.map((e, i) => {
            const bW = Math.max(2, (Math.abs(e.val) / maxVal) * BAR_MAX);
            const y = i * rowH + 10;
            return (
              <g key={i}>
                <text x={LABEL - 6} y={y + 18} textAnchor="end" fill="#888" fontSize={11}>
                  {e.label}
                </text>
                <rect
                  x={LABEL}
                  y={y + 4}
                  width={bW}
                  height={22}
                  fill={e.color}
                  opacity={0.85}
                  rx={3}
                />
                <text x={LABEL + bW + 6} y={y + 18} fill="#ccc" fontSize={11}>
                  {fmtUSD(e.val, 0)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // ── Helpers para escenarios (Tab 3) ─────────────────────────────────────
  function calcEscenario(
    precioBase: number,
    pctReventa: number,
    ajusteExtra: number,
    plazo: number,
    montoBoleto: number,
    cuotaNominal: number,
    montoEntrega: number,
    ajusteBase: AjusteCuotas,
    tasaCACAnual: number,
    tasaCCLMensual: number,
    pctCostosReventa: number
  ): { totalPagado: number; precioVenta: number; ganancia: number; roi: number; tir: number } {
    const tasaCACMensual = Math.pow(1 + tasaCACAnual, 1 / 12) - 1;
    let totalPagado = montoBoleto;
    const flujos: number[] = [-(montoBoleto)];
    for (let m = 1; m <= plazo; m++) {
      let ajustada = cuotaNominal;
      if (ajusteBase === "cac") {
        ajustada = cuotaNominal * Math.pow(1 + tasaCACMensual, m - 1) * (1 + ajusteExtra);
      } else if (ajusteBase === "ccl") {
        ajustada = cuotaNominal * Math.pow(1 + tasaCCLMensual, m - 1) * (1 + ajusteExtra);
      } else {
        ajustada = cuotaNominal * (1 + ajusteExtra);
      }
      totalPagado += ajustada + (m === plazo ? montoEntrega : 0);
      if (m === plazo) {
        const prVenta = precioBase * (1 + pctReventa);
        const neto = prVenta * (1 - pctCostosReventa);
        flujos.push(-(ajustada + montoEntrega) + neto);
      } else {
        flujos.push(-ajustada);
      }
    }
    const precioVenta = precioBase * (1 + pctReventa) * (1 - pctCostosReventa);
    const ganancia = precioVenta - totalPagado;
    const roi = totalPagado > 0 ? (ganancia / totalPagado) * 100 : 0;
    const tirMensual = calcTIR(flujos);
    const tir = (Math.pow(1 + tirMensual, 12) - 1) * 100;
    return { totalPagado, precioVenta, ganancia, roi, tir };
  }

  // ── Tabla sensibilidad ────────────────────────────────────────────────────
  const SensibilidadTable = () => {
    const pctReventa_cols = [0, 0.1, 0.2, 0.3];
    const ajusteExtra_rows = [0, 0.3, 0.6, 0.9];
    const labels_cols = ["Base", "+10%", "+20%", "+30%"];
    const labels_rows = ["Sin ajuste", "+30%", "+60%", "+90%"];
    const {
      precio,
      plazo,
      montoBoleto,
      cuotaNominal,
      montoEntrega,
    } = calc;
    const tasaCACAnual = (parseFloat(tasaCAC) || 60) / 100;
    const tasaCCLMensual = (parseFloat(apreciacionCCL) || 3) / 100;
    const pctCostosReventa = (parseFloat(costosReventa) || 5) / 100;

    const roiColor = (roi: number): string => {
      if (roi > 20) return "#1a3a1a";
      if (roi >= 10) return "#3a3a00";
      return "#3a0000";
    };
    const roiTextColor = (roi: number): string => {
      if (roi > 20) return "#55cc55";
      if (roi >= 10) return "#cccc00";
      return "#cc4444";
    };

    return (
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Ajuste \ Reventa</th>
              {labels_cols.map((l) => (
                <th key={l} style={{ ...S.th, textAlign: "center" }}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ajusteExtra_rows.map((ajusteExtra, ri) => (
              <tr key={ri}>
                <td style={S.td}>{labels_rows[ri]}</td>
                {pctReventa_cols.map((pctRev, ci) => {
                  const base = precioReventa ? parseFloat(precioReventa) : precio * 1.2;
                  const basePrice = precio > 0 ? precio : 100000;
                  const baseReventa = base > 0 ? base / (1 + 0.2) : basePrice;
                  const esc = calcEscenario(
                    baseReventa,
                    pctRev,
                    ajusteExtra,
                    plazo,
                    montoBoleto,
                    cuotaNominal,
                    montoEntrega,
                    ajuste,
                    tasaCACAnual,
                    tasaCCLMensual,
                    pctCostosReventa
                  );
                  return (
                    <td
                      key={ci}
                      style={{
                        ...S.td,
                        background: roiColor(esc.roi),
                        color: roiTextColor(esc.roi),
                        textAlign: "center",
                        fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {fmtPct(esc.roi, 1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Tab 1 ─────────────────────────────────────────────────────────────────
  const Tab1 = () => {
    const sumPct =
      (etapaBoleto.pct || 0) + (etapaCuotas.pct || 0) + (etapaEntrega.pct || 0);

    return (
      <>
        {/* Proyecto */}
        <div style={S.card}>
          <p style={S.cardTitle}>Proyecto</p>
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Precio total de la unidad (USD)</label>
              <input
                style={S.input}
                type="number"
                value={precioTotal}
                onChange={(e) => setPrecioTotal(e.target.value)}
              />
            </div>
            <div>
              <label style={S.label}>Plazo total de obra (meses)</label>
              <input
                style={S.input}
                type="number"
                value={plazoMeses}
                onChange={(e) => setPlazoMeses(e.target.value)}
              />
            </div>
            <div>
              <label style={S.label}>Fecha de inicio de obra</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  style={{ ...S.select, flex: 1 }}
                  value={fechaInicioMes}
                  onChange={(e) => setFechaInicioMes(e.target.value)}
                >
                  {mesNombres.map((m, i) => (
                    <option
                      key={i}
                      value={String(i + 1).padStart(2, "0")}
                    >
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  style={{ ...S.select, flex: 1 }}
                  value={fechaInicioAnio}
                  onChange={(e) => setFechaInicioAnio(e.target.value)}
                >
                  {Array.from({ length: 6 }, (_, i) => anioActual + i).map(
                    (y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
            <div>
              <label style={S.label}>Moneda de cuotas</label>
              <select
                style={S.select}
                value={monedaCuotas}
                onChange={(e) =>
                  setMonedaCuotas(e.target.value as MonedaCuotas)
                }
              >
                <option value="usd">USD</option>
                <option value="ars_ccl">ARS ajustado por CCL</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
          </div>
        </div>

        {/* Estructura de pagos */}
        <div style={S.card}>
          <p style={S.cardTitle}>Estructura de pagos</p>

          {sumPct !== 100 && (
            <div
              style={{
                background: "#3a1a00",
                border: "1px solid #cc5500",
                borderRadius: 6,
                padding: "8px 12px",
                marginBottom: 14,
                fontSize: "0.82rem",
                color: "#ffaa44",
              }}
            >
              La suma de porcentajes es {fmtNum(sumPct, 1)}% (debe ser 100%)
            </div>
          )}

          {/* Boleto */}
          <p style={S.sectionTitle}>Boleto / Anticipo</p>
          <div style={S.grid3}>
            <div>
              <label style={S.label}>% del total (al inicio)</label>
              <input
                style={S.input}
                type="number"
                value={etapaBoleto.pct}
                onChange={(e) =>
                  setEtapaBoleto({
                    ...etapaBoleto,
                    pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <label style={S.label}>Monto en USD</label>
              <input
                style={{ ...S.input, background: "#050505", color: "#888" }}
                readOnly
                value={fmtUSD(calc.montoBoleto)}
              />
            </div>
          </div>

          <hr style={S.divider} />

          {/* Cuotas en obra */}
          <p style={S.sectionTitle}>Cuotas en obra</p>
          <div style={S.grid3}>
            <div>
              <label style={S.label}>% del total</label>
              <input
                style={S.input}
                type="number"
                value={etapaCuotas.pct}
                onChange={(e) =>
                  setEtapaCuotas({
                    ...etapaCuotas,
                    pct: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <label style={S.label}>Tipo de ajuste</label>
              <select
                style={S.select}
                value={ajuste}
                onChange={(e) => setAjuste(e.target.value as AjusteCuotas)}
              >
                <option value="fijo_usd">Fijo en USD</option>
                <option value="ccl">Ajustado por CCL</option>
                <option value="cac">Ajustado por CAC (construcción)</option>
              </select>
            </div>
            {ajuste === "cac" && (
              <div>
                <label style={S.label}>Tasa CAC anual estimada (%)</label>
                <input
                  style={S.input}
                  type="number"
                  value={tasaCAC}
                  onChange={(e) => setTasaCAC(e.target.value)}
                />
              </div>
            )}
            {ajuste === "ccl" && (
              <div>
                <label style={S.label}>Apreciación CCL mensual (%)</label>
                <input
                  style={S.input}
                  type="number"
                  value={apreciacionCCL}
                  onChange={(e) => setApreciacionCCL(e.target.value)}
                />
              </div>
            )}
          </div>

          <hr style={S.divider} />

          {/* Entrega */}
          <p style={S.sectionTitle}>Entrega final</p>
          <div style={S.grid3}>
            <div>
              <label style={S.label}>% del total (al finalizar)</label>
              <input
                style={{ ...S.input, background: "#050505", color: "#888" }}
                readOnly
                value={fmtNum(calc.pctEntrega, 1)}
              />
            </div>
            <div>
              <label style={S.label}>Monto en USD</label>
              <input
                style={{ ...S.input, background: "#050505", color: "#888" }}
                readOnly
                value={fmtUSD(calc.montoEntrega)}
              />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={S.card}>
          <p style={S.cardTitle}>Resumen de pagos</p>
          <div style={S.grid3}>
            <div style={S.kpi}>
              <p style={S.kpiLabel}>Cuota nominal</p>
              <p style={S.kpiValue}>{fmtUSD(calc.cuotaNominal)}</p>
            </div>
            <div style={S.kpi}>
              <p style={S.kpiLabel}>Total desembolsado</p>
              <p style={S.kpiValue}>{fmtUSD(calc.totalDesembolsado)}</p>
            </div>
            <div style={S.kpi}>
              <p style={S.kpiLabel}>Exceso por ajuste</p>
              <p style={S.kpiValue}>
                {fmtUSD(calc.totalDesembolsado - calc.precio)}
              </p>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div style={S.card}>
          <p style={S.cardTitle}>Flujo de pagos</p>
          <Chart1 />
        </div>

        {/* Tabla */}
        <div style={S.card}>
          <p style={S.cardTitle}>Tabla de cuotas</p>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Mes</th>
                  <th style={S.th}>Concepto</th>
                  <th style={{ ...S.th, textAlign: "right" }}>
                    Cuota nominal
                  </th>
                  <th style={{ ...S.th, textAlign: "right" }}>
                    Cuota ajustada
                  </th>
                  <th style={{ ...S.th, textAlign: "right" }}>
                    Acumulado
                  </th>
                  <th style={{ ...S.th, textAlign: "right" }}>% total</th>
                </tr>
              </thead>
              <tbody>
                {calc.rows.map((r, i) => (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? "transparent" : "#0d0d0d",
                    }}
                  >
                    <td style={S.td}>{r.mes}</td>
                    <td style={S.td}>{r.concepto}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      {fmtUSD(r.cuotaNominal)}
                    </td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      {fmtUSD(r.cuotaAjustada)}
                    </td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      {fmtUSD(r.acumulado)}
                    </td>
                    <td
                      style={{
                        ...S.td,
                        textAlign: "right",
                        color: "#888",
                      }}
                    >
                      {fmtPct(r.pctTotal, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  // ── Tab 2 ─────────────────────────────────────────────────────────────────
  const Tab2 = () => {
    const {
      totalDesembolsado,
      precioNetoReventa,
      gananciaBruta,
      roi,
      tirAnual,
      roiPF,
      gananciaPF,
      yieldBruto,
      recuperoAnios,
      plazo,
    } = calc;
    const tasaPFAnual = (parseFloat(tasaPF) || 8) / 100;
    const pfMeses = plazo;
    const gananciaPFDisplay = gananciaPF;

    return (
      <>
        {/* Hipótesis */}
        <div style={S.card}>
          <p style={S.cardTitle}>Hipótesis de reventa / alquiler</p>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Alternativa</label>
            <div style={S.toggleGroup}>
              {(["reventa", "alquiler"] as AlternativaId[]).map((a) => (
                <button
                  key={a}
                  style={S.toggleBtn(alternativa === a)}
                  onClick={() => setAlternativa(a)}
                >
                  {a === "reventa" ? "Reventa" : "Alquiler"}
                </button>
              ))}
            </div>
          </div>

          {alternativa === "reventa" ? (
            <div style={S.grid3}>
              <div>
                <label style={S.label}>Precio de reventa estimado (USD)</label>
                <input
                  style={S.input}
                  type="number"
                  value={precioReventa}
                  onChange={(e) => setPrecioReventa(e.target.value)}
                />
              </div>
              <div>
                <label style={S.label}>
                  Costos de escritura + comisiones (%)
                </label>
                <input
                  style={S.input}
                  type="number"
                  value={costosReventa}
                  onChange={(e) => setCostosReventa(e.target.value)}
                />
              </div>
              <div>
                <label style={S.label}>Tasa PF USD comparación (% anual)</label>
                <input
                  style={S.input}
                  type="number"
                  value={tasaPF}
                  onChange={(e) => setTasaPF(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div style={S.grid3}>
              <div>
                <label style={S.label}>Alquiler mensual esperado (USD)</label>
                <input
                  style={S.input}
                  type="number"
                  value={alquilerMensual}
                  onChange={(e) => setAlquilerMensual(e.target.value)}
                />
              </div>
              <div>
                <label style={S.label}>Tasa PF USD comparación (% anual)</label>
                <input
                  style={S.input}
                  type="number"
                  value={tasaPF}
                  onChange={(e) => setTasaPF(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {alternativa === "reventa" ? (
          <>
            {/* Resultados reventa */}
            <div style={S.card}>
              <p style={S.cardTitle}>Resultados — Reventa</p>
              <div style={S.grid3}>
                <div style={S.kpi}>
                  <p style={S.kpiLabel}>Total desembolsado</p>
                  <p style={S.kpiValue}>{fmtUSD(totalDesembolsado)}</p>
                </div>
                <div style={S.kpi}>
                  <p style={S.kpiLabel}>Precio neto de venta</p>
                  <p style={S.kpiValue}>{fmtUSD(precioNetoReventa)}</p>
                </div>
                <div style={S.kpi}>
                  <p style={S.kpiLabel}>Ganancia bruta</p>
                  <p
                    style={{
                      ...S.kpiValue,
                      color: gananciaBruta >= 0 ? "#55cc55" : "#cc4444",
                    }}
                  >
                    {gananciaBruta >= 0 ? "+" : ""}
                    {fmtUSD(gananciaBruta)}
                  </p>
                </div>
                <div style={S.kpi}>
                  <p style={S.kpiLabel}>ROI total</p>
                  <p
                    style={{
                      ...S.kpiValue,
                      color: roi >= 0 ? "#55cc55" : "#cc4444",
                    }}
                  >
                    {fmtPct(roi)}
                  </p>
                </div>
                <div style={S.kpi}>
                  <p style={S.kpiLabel}>TIR anualizada</p>
                  <p
                    style={{
                      ...S.kpiValue,
                      color: tirAnual >= 0 ? "#55cc55" : "#cc4444",
                    }}
                  >
                    {isFinite(tirAnual) ? fmtPct(tirAnual * 100) : "—"}
                  </p>
                </div>
                <div style={S.kpi}>
                  <p style={S.kpiLabel}>PF USD {pfMeses}m ({fmtPct(tasaPFAnual * 100, 0)} anual)</p>
                  <p style={{ ...S.kpiValue, color: "#888" }}>
                    {fmtUSD(gananciaPFDisplay)}
                  </p>
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "#0a0a0a",
                  border: "1px solid #222",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  color: "#aaa",
                }}
              >
                {roi > roiPF
                  ? `La inversión en pozo supera al PF USD por ${fmtPct(roi - roiPF)} de ROI.`
                  : `El PF USD supera a esta inversión en pozo por ${fmtPct(roiPF - roi)} de ROI.`}
              </div>
            </div>

            {/* Gráfico comparación */}
            <div style={S.card}>
              <p style={S.cardTitle}>Comparación de ganancia por escenario</p>
              <Chart2 />
            </div>
          </>
        ) : (
          <div style={S.card}>
            <p style={S.cardTitle}>Resultados — Alquiler</p>
            <div style={S.grid3}>
              <div style={S.kpi}>
                <p style={S.kpiLabel}>Total desembolsado</p>
                <p style={S.kpiValue}>{fmtUSD(totalDesembolsado)}</p>
              </div>
              <div style={S.kpi}>
                <p style={S.kpiLabel}>Yield bruto anual</p>
                <p
                  style={{
                    ...S.kpiValue,
                    color: yieldBruto >= 5 ? "#55cc55" : "#cccc00",
                  }}
                >
                  {fmtPct(yieldBruto)}
                </p>
              </div>
              <div style={S.kpi}>
                <p style={S.kpiLabel}>Recupero del capital</p>
                <p style={S.kpiValue}>
                  {isFinite(recuperoAnios)
                    ? `${fmtNum(recuperoAnios, 1)} años`
                    : "—"}
                </p>
              </div>
              <div style={S.kpi}>
                <p style={S.kpiLabel}>Alquiler mensual</p>
                <p style={S.kpiValue}>{fmtUSD(calc.alquiler)}</p>
              </div>
              <div style={S.kpi}>
                <p style={S.kpiLabel}>Alquiler anual</p>
                <p style={S.kpiValue}>{fmtUSD(calc.alquiler * 12)}</p>
              </div>
              <div style={S.kpi}>
                <p style={S.kpiLabel}>
                  PF USD {calc.plazo}m ({fmtPct((parseFloat(tasaPF) || 8), 0)} anual)
                </p>
                <p style={{ ...S.kpiValue, color: "#888" }}>
                  {fmtPct(roiPF)}
                </p>
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "#0a0a0a",
                border: "1px solid #222",
                borderRadius: 8,
                fontSize: "0.82rem",
                color: "#aaa",
              }}
            >
              {yieldBruto > (parseFloat(tasaPF) || 8)
                ? `El yield de alquiler (${fmtPct(yieldBruto)}) supera al PF USD (${fmtPct(parseFloat(tasaPF) || 8)}% anual).`
                : `El PF USD (${fmtPct(parseFloat(tasaPF) || 8)}% anual) supera al yield de alquiler (${fmtPct(yieldBruto)}).`}
            </div>
          </div>
        )}
      </>
    );
  };

  // ── Tab 3 ─────────────────────────────────────────────────────────────────
  const Tab3 = () => {
    const { precio, plazo, montoBoleto, cuotaNominal, montoEntrega } = calc;
    const tasaCACAnual = (parseFloat(tasaCAC) || 60) / 100;
    const tasaCCLMensual = (parseFloat(apreciacionCCL) || 3) / 100;
    const pctCostosReventa = (parseFloat(costosReventa) || 5) / 100;

    const escenarios = [
      {
        nombre: "Optimista",
        pctReventa: 0.3,
        ajusteExtra: 0,
        color: "#1a3a1a",
        textColor: "#55cc55",
        desc: "Reventa +30%, cuotas en USD fijo",
      },
      {
        nombre: "Base",
        pctReventa: 0.2,
        ajusteExtra: 0,
        color: "#2a2a00",
        textColor: "#cccc00",
        desc: "Reventa +20%, ajuste moderado",
      },
      {
        nombre: "Pesimista",
        pctReventa: 0.05,
        ajusteExtra: 0.3,
        color: "#3a0a0a",
        textColor: "#cc4444",
        desc: "Reventa +5%, ajuste cuotas +30%",
      },
    ];

    return (
      <>
        {/* Tarjetas escenarios */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 20 }}>
          {escenarios.map((esc) => {
            const r = calcEscenario(
              precio,
              esc.pctReventa,
              esc.ajusteExtra,
              plazo,
              montoBoleto,
              cuotaNominal,
              montoEntrega,
              ajuste,
              tasaCACAnual,
              tasaCCLMensual,
              pctCostosReventa
            );
            return (
              <div
                key={esc.nombre}
                style={{
                  background: esc.color,
                  border: `1px solid ${esc.textColor}33`,
                  borderRadius: 10,
                  padding: "18px 20px",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 800,
                    color: esc.textColor,
                    marginTop: 0,
                    marginBottom: 4,
                  }}
                >
                  {esc.nombre}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#888",
                    marginTop: 0,
                    marginBottom: 14,
                  }}
                >
                  {esc.desc}
                </p>
                {[
                  ["Total pagado", fmtUSD(r.totalPagado, 0)],
                  ["Precio de venta", fmtUSD(r.precioVenta, 0)],
                  ["Ganancia", fmtUSD(r.ganancia, 0)],
                  ["ROI", fmtPct(r.roi)],
                  ["TIR anual", isFinite(r.tir) ? fmtPct(r.tir) : "—"],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #333",
                      padding: "5px 0",
                      fontSize: "0.82rem",
                    }}
                  >
                    <span style={{ color: "#888" }}>{label}</span>
                    <span
                      style={{
                        color: esc.textColor,
                        fontWeight: 700,
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Tabla sensibilidad */}
        <div style={S.card}>
          <p style={S.cardTitle}>Tabla de sensibilidad — ROI</p>
          <p style={{ fontSize: "0.78rem", color: "#666", marginTop: -8, marginBottom: 14 }}>
            Eje X: precio de reventa vs. base. Eje Y: ajuste adicional de cuotas.
          </p>
          <SensibilidadTable />
          <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: "0.78rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#1a3a1a", borderRadius: 2 }} />
              <span style={{ color: "#888" }}>ROI &gt; 20%</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#3a3a00", borderRadius: 2 }} />
              <span style={{ color: "#888" }}>ROI 10–20%</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, background: "#3a0000", borderRadius: 2 }} />
              <span style={{ color: "#888" }}>ROI &lt; 10%</span>
            </span>
          </div>
        </div>
      </>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Calculadora de Inversión en Pozo</h1>
        <p style={S.subtitle}>
          Análisis de rentabilidad para compra en construcción con cuotas
          escalonadas
        </p>
      </div>

      <div style={S.tabBar}>
        {(
          [
            ["estructura", "1. Estructura de pago"],
            ["rentabilidad", "2. Rentabilidad"],
            ["escenarios", "3. Escenarios"],
          ] as [TabId, string][]
        ).map(([id, label]) => (
          <button key={id} style={S.tabBtn(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div style={S.body}>
        {tab === "estructura" && <Tab1 />}
        {tab === "rentabilidad" && <Tab2 />}
        {tab === "escenarios" && <Tab3 />}
      </div>
    </div>
  );
}
